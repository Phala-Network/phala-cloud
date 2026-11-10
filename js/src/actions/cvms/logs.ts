import type { Client } from "../../client";
import { CvmIdSchema, type CvmIdInput } from "../../types/cvm_id";
import { ResourceError } from "../../utils/errors";
import { defaultUserAgent } from "../../user-agent";
import { resolveLogTimeWindow } from "./log-time";

export { resolveLogTimeWindow } from "./log-time";

/** API version that introduced CVMInfo.logs. Pinned so older clients still get URLs. */
export const CVM_LOGS_INFO_API_VERSION = "2026-01-21";

export type CvmLogChannel = "serial" | "stdout" | "stderr";
export type CvmLogFormat = "text" | "ndjson";
export type LogChannel = "stdout" | "stderr" | "stdin" | "console";

const LOG_CHANNELS = new Set<LogChannel>(["stdout", "stderr", "stdin", "console"]);

function logFetchHeaders(client: Client): Headers {
  const headers = new Headers();
  const ua = defaultUserAgent();
  if (ua) headers.set("User-Agent", ua);
  const extra = client.config?.headers;
  if (extra) {
    new Headers(extra as HeadersInit).forEach((value, key) => {
      if (key.toLowerCase() === "user-agent") headers.set("User-Agent", value);
    });
  }
  return headers;
}

function logFetch(client: Client, url: string, signal?: AbortSignal): Promise<Response> {
  return fetch(url, {
    method: "GET",
    headers: logFetchHeaders(client),
    signal,
    redirect: "manual",
  });
}

export type CvmLogSource =
  | { type: "node"; channel: CvmLogChannel }
  | { type: "container"; name?: string; matchContainerIdPrefix?: boolean };

export interface CvmLogsOptions {
  tail?: number | "all";
  since?: string | number;
  until?: string | number;
  timestamps?: boolean;
  ansi?: boolean;
  format?: CvmLogFormat;
  signal?: AbortSignal;
}

export interface CvmLogEntry {
  channel: LogChannel;
  message: string;
}

interface CvmLogUrls {
  serial?: string | null;
  stdout?: string | null;
  stderr?: string | null;
  container_log_base?: string | null;
  auth_query?: string | null;
}

interface CvmInfoWithLogs {
  logs?: CvmLogUrls | null;
  public_logs?: boolean | null;
}

interface ContainerInfo {
  id: string;
  names: string[];
  log_endpoint: string | null;
}

interface CvmCompositionResponse {
  containers: ContainerInfo[] | null;
  error?: string | null;
}

const LOG_ERROR_HTTP_STATUS: Record<string, number> = {
  "ERR-17-001": 400,
  "ERR-17-002": 401,
  "ERR-17-003": 401,
  "ERR-17-004": 404,
  "ERR-17-005": 409,
  "ERR-17-006": 409,
  "ERR-17-007": 404,
  "ERR-17-008": 502,
  "ERR-17-009": 502,
  "ERR-17-010": 504,
  "ERR-17-011": 429,
  "ERR-17-012": 503,
  "ERR-17-013": 404,
};

function logErrorHttpStatus(code: string): number | undefined {
  return LOG_ERROR_HTTP_STATUS[code];
}

/** Structured log-gateway error. Extends ResourceError so callers can use the SDK error hierarchy. */
export class LogAccessError extends ResourceError {
  readonly code?: string;
  readonly httpStatus?: number;
  readonly suggestions: string[];
  /** True when the error was parsed from a 200 stream body, not an HTTP status. */
  readonly fromStreamBody: boolean;

  constructor(options: {
    message: string;
    code?: string;
    httpStatus?: number;
    suggestions?: readonly string[];
    fromStreamBody?: boolean;
    requestId?: string;
    details?: ResourceError["structuredDetails"];
    links?: ResourceError["links"];
  }) {
    const details = options.message;
    const status = options.fromStreamBody
      ? 0
      : (options.httpStatus ?? (options.code ? logErrorHttpStatus(options.code) : undefined) ?? 0);
    super(details, {
      status,
      statusText: "",
      errorCode: options.code,
      suggestions: options.suggestions ? [...options.suggestions] : undefined,
      requestId: options.requestId,
      structuredDetails: options.details,
      links: options.links,
    });
    this.name = "LogAccessError";
    this.code = options.code;
    this.httpStatus = status === 0 ? undefined : status || undefined;
    this.suggestions = options.suggestions ? [...options.suggestions] : [];
    this.fromStreamBody = options.fromStreamBody === true;
  }
}

function resolveCvmId(id: CvmIdInput | string): string {
  return CvmIdSchema.parse(typeof id === "string" ? { id } : id).cvmId;
}

function buildLogUrl(
  baseUrl: string,
  options: {
    since?: number;
    until?: number;
    tail?: number | "all";
    timestamps?: boolean;
    follow?: boolean;
    format?: CvmLogFormat;
    ansi?: boolean;
  },
): string {
  const params: string[] = [];
  if (options.since !== undefined) params.push(`since=${options.since}`);
  if (options.until !== undefined) params.push(`until=${options.until}`);
  if (options.follow) params.push("follow=true");
  if (options.tail !== undefined) params.push(`tail=${options.tail}`);
  if (options.timestamps) params.push("timestamps=true");
  if (options.ansi) params.push("ansi=true");
  if (options.format) params.push(`format=${options.format}`);
  const sep = baseUrl.includes("?") ? "&" : "?";
  return params.length > 0 ? `${baseUrl}${sep}${params.join("&")}` : baseUrl;
}

async function streamResponse(
  response: Response,
  onData: (data: string) => void,
  markDelivered?: () => void,
  ansi?: boolean,
): Promise<boolean> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body available for streaming");

  const decoder = new TextDecoder();
  let buffer = "";
  let finished = false;
  let delivered = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        const line = buffer.slice(0, newline + 1);
        buffer = buffer.slice(newline + 1);
        const content = line.replace(/\r?\n$/, "");
        if (content !== "[vmm heartbeat]" && content !== "[teepod heartbeat]") {
          throwTextStreamError(content);
          markDelivered?.();
          onData(applyAnsiPolicy(line, ansi));
          delivered = true;
        }
        newline = buffer.indexOf("\n");
      }
      if (done) {
        finished = true;
        break;
      }
    }
    if (buffer && buffer !== "[vmm heartbeat]" && buffer !== "[teepod heartbeat]") {
      throwTextStreamError(buffer);
      markDelivered?.();
      onData(applyAnsiPolicy(buffer, ansi));
      delivered = true;
    }
  } finally {
    if (!finished) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  return delivered;
}

interface StructuredLogEntry extends CvmLogEntry {
  timestamp?: string;
}

async function throwResponseError(response: Response): Promise<never> {
  const body = await response.text();
  let envelope: {
    error_code?: unknown;
    message?: unknown;
    suggestions?: unknown;
    details?: unknown;
    links?: unknown;
    request_id?: unknown;
  };
  try {
    envelope = JSON.parse(body) as typeof envelope;
  } catch {
    envelope = {};
  }
  const suggestions = Array.isArray(envelope.suggestions)
    ? envelope.suggestions.filter((item): item is string => typeof item === "string")
    : [];
  throw new LogAccessError({
    code: typeof envelope.error_code === "string" ? envelope.error_code : undefined,
    message:
      typeof envelope.message === "string"
        ? envelope.message
        : `HTTP ${response.status} ${response.statusText}`,
    httpStatus: response.status,
    suggestions,
    requestId: typeof envelope.request_id === "string" ? envelope.request_id : undefined,
    details: Array.isArray(envelope.details) ? (envelope.details as never) : undefined,
    links: Array.isArray(envelope.links) ? (envelope.links as never) : undefined,
  });
}

function throwTextStreamError(line: string): void {
  const match = /^\[error\] (ERR-17-\d{3}) (.*)$/.exec(line.trim());
  const code = match?.[1];
  const message = match?.[2];
  if (code && message !== undefined) {
    throw new LogAccessError({ code, message, httpStatus: 0 });
  }
}

function throwIfTextBodyErrors(text: string): void {
  throwIfGuestAgentError(text);
  for (const line of text.split(/\r?\n/)) throwTextStreamError(line);
}

function parseTimestampedMessage(message: string): {
  timestamp?: string;
  second?: number;
  message?: string;
} {
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})) (.*)$/s.exec(
    message,
  );
  if (!match) return {};
  const time = Date.parse(match[1] as string);
  if (!Number.isFinite(time)) return {};
  return {
    timestamp: match[1],
    second: Math.floor(time / 1000),
    message: match[2],
  };
}

function formatFollowContainerEntry(
  entry: StructuredLogEntry,
  includeTimestamps: boolean,
  ansi?: boolean,
): CvmLogEntry {
  const raw = includeTimestamps
    ? entry.message
    : parseTimestampedMessage(entry.message).timestamp
      ? (parseTimestampedMessage(entry.message).message ?? "")
      : entry.message;
  return { channel: entry.channel, message: applyAnsiPolicy(raw, ansi) };
}

function guestAgentErrorMessage(text: string): string | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  try {
    const parsed = JSON.parse(trimmed) as {
      error?: unknown;
      channel?: unknown;
      message?: unknown;
    };
    if (
      typeof parsed.error === "string" &&
      parsed.channel === undefined &&
      parsed.message === undefined
    ) {
      return parsed.error;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function throwIfGuestAgentError(text: string): void {
  const message = guestAgentErrorMessage(text);
  if (message !== undefined) {
    throw new LogAccessError({
      code: "ERR-17-009",
      message,
      fromStreamBody: true,
    });
  }
}

const ANSI_PATTERN = /\x1B\[[0-9;]*[A-Za-z]/g;

function stripAnsi(text: string): string {
  return text.replace(ANSI_PATTERN, "");
}

function applyAnsiPolicy(text: string, ansi?: boolean): string {
  return ansi ? text : stripAnsi(text);
}

function takeJsonObject(buffer: string): { value: unknown; rest: string } | null {
  let i = 0;
  while (i < buffer.length && /[\s]/.test(buffer[i] as string)) i += 1;
  if (buffer[i] !== "{") return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let j = i; j < buffer.length; j += 1) {
    const char = buffer[j];
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return {
          value: JSON.parse(buffer.slice(i, j + 1)),
          rest: buffer.slice(j + 1),
        };
      }
    }
  }
  return null;
}

function parseStructuredLogLineToEntry(line: string): StructuredLogEntry | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  let parsed: {
    channel?: unknown;
    message?: unknown;
    error?: unknown;
    error_code?: unknown;
    suggestions?: unknown;
    details?: unknown;
    links?: unknown;
    request_id?: unknown;
  };
  try {
    parsed = JSON.parse(trimmed) as typeof parsed;
  } catch {
    throw new LogAccessError({ message: "Invalid NDJSON log record." });
  }

  if (
    typeof parsed.error === "string" &&
    parsed.channel === undefined &&
    parsed.message === undefined
  ) {
    throw new LogAccessError({
      code: "ERR-17-009",
      message: parsed.error,
      fromStreamBody: true,
    });
  }

  if (typeof parsed.error_code === "string") {
    throw new LogAccessError({
      code: parsed.error_code,
      message:
        typeof parsed.message === "string" ? parsed.message : "The log stream ended with an error.",
      httpStatus: 0,
      suggestions: Array.isArray(parsed.suggestions)
        ? parsed.suggestions.filter((item): item is string => typeof item === "string")
        : [],
      details: Array.isArray(parsed.details) ? (parsed.details as never) : undefined,
      links: Array.isArray(parsed.links) ? (parsed.links as never) : undefined,
      requestId: typeof parsed.request_id === "string" ? parsed.request_id : undefined,
    });
  }
  if (!LOG_CHANNELS.has(parsed.channel as LogChannel) || typeof parsed.message !== "string") {
    throw new LogAccessError({ message: "Invalid NDJSON log record." });
  }

  const entry: StructuredLogEntry = {
    channel: parsed.channel as LogChannel,
    message: parsed.message,
  };
  const timestamp = parseTimestampedMessage(entry.message).timestamp;
  if (timestamp) entry.timestamp = timestamp;
  return entry;
}

function parseStructuredLogsToEntries(input: string): CvmLogEntry[] {
  const entries: CvmLogEntry[] = [];
  let buffer = input;
  while (buffer.length > 0) {
    const taken = takeJsonObject(buffer);
    if (!taken) {
      const newline = buffer.indexOf("\n");
      if (newline < 0) {
        const entry = parseStructuredLogLineToEntry(buffer);
        if (entry) entries.push(entry);
        break;
      }
      const entry = parseStructuredLogLineToEntry(buffer.slice(0, newline));
      if (entry) entries.push(entry);
      buffer = buffer.slice(newline + 1);
      continue;
    }
    const entry = parseStructuredLogLineToEntry(JSON.stringify(taken.value));
    if (entry) entries.push(entry);
    buffer = taken.rest;
  }
  return entries;
}

function decodeStructuredLogsText(input: string): string {
  return parseStructuredLogsToEntries(input)
    .map((entry) => (entry.message === "" ? "\n" : entry.message))
    .join("");
}

async function streamNdjsonEntriesResponse(
  response: Response,
  onEntry: (entry: StructuredLogEntry) => void,
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body available for streaming");

  const decoder = new TextDecoder();
  let buffer = "";
  let finished = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      for (;;) {
        const taken = takeJsonObject(buffer);
        if (!taken) break;
        const entry = parseStructuredLogLineToEntry(JSON.stringify(taken.value));
        if (entry) onEntry(entry);
        buffer = taken.rest;
      }
      if (done) {
        finished = true;
        break;
      }
    }
    if (buffer.trim()) {
      const entry = parseStructuredLogLineToEntry(buffer);
      if (entry) onEntry(entry);
    }
  } finally {
    if (!finished) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

function assertSupportedNodeLogOptions(options: CvmLogsOptions): void {
  const unsupported = [
    options.timestamps && "timestamps",
    options.since !== undefined && "since",
    options.until !== undefined && "until",
    options.format === "ndjson" && "format=ndjson",
  ].filter((option): option is string => Boolean(option));
  if (unsupported.length > 0) {
    throw new Error(`${unsupported.join(", ")} not supported for serial/stdout/stderr logs`);
  }
  if (options.ansi && options.format === "ndjson") {
    throw new LogAccessError({
      code: "ERR-17-001",
      message: "ansi is valid only with format=text",
    });
  }
}

async function getCvmInfoLogs(
  client: Client,
  cvmId: string,
  signal?: AbortSignal,
): Promise<CvmInfoWithLogs> {
  return (await client.get(`/cvms/${cvmId}`, {
    headers: { "X-Phala-Version": CVM_LOGS_INFO_API_VERSION },
    signal,
  })) as CvmInfoWithLogs;
}

/** Get a presigned CVM-level log URL for a given node channel. */
export async function getCvmLogEndpoint(
  client: Client,
  id: CvmIdInput | string,
  channel: CvmLogChannel,
  signal?: AbortSignal,
): Promise<string> {
  const cvmId = resolveCvmId(id);
  const info = await getCvmInfoLogs(client, cvmId, signal);
  const endpoint = info.logs?.[channel];
  if (!endpoint) {
    throw new Error(`No ${channel} log endpoint available for CVM '${cvmId}'`);
  }
  return endpoint;
}

function containerLogsDisabledError(): LogAccessError {
  return new LogAccessError({
    code: "ERR-17-006",
    message: "Container logs are disabled",
    httpStatus: 409,
  });
}

async function assertContainerLogsEnabled(
  client: Client,
  id: CvmIdInput | string,
  signal?: AbortSignal,
): Promise<void> {
  const info = await getCvmInfoLogs(client, resolveCvmId(id), signal);
  if (info.public_logs === false) {
    throw containerLogsDisabledError();
  }
}

const CONTAINER_NAME_RE = /^[A-Za-z0-9_.-]+$/;

function assertSafeContainerName(name: string): string {
  const slug = name.replace(/^\//, "");
  if (!CONTAINER_NAME_RE.test(slug)) {
    throw new Error(`Invalid container name '${name}'. Use letters, digits, '_', '.', and '-'.`);
  }
  return slug;
}

function joinContainerLogUrl(base: string, name: string, authQuery?: string | null): string {
  const trimmed = base.replace(/\/$/, "");
  const slug = assertSafeContainerName(name);
  const url = `${trimmed}/${slug}`;
  if (!authQuery) return url;
  return url.includes("?") ? `${url}&${authQuery}` : `${url}?${authQuery}`;
}

function reconnectSinceValue(
  cursorSince: number | undefined,
  first200Second: number | undefined,
  callerSince: number | undefined,
): number | undefined {
  if (cursorSince !== undefined) return cursorSince;
  if (first200Second === undefined) return callerSince;
  if (callerSince === undefined) return first200Second;
  return Math.max(first200Second, callerSince);
}

function exactContainerNameMatch(container: ContainerInfo, name: string): boolean {
  return container.names.some((n) => n === name || n === `/${name}`);
}

async function getContainerLogEndpoint(
  client: Client,
  id: CvmIdInput | string,
  containerName?: string,
  matchContainerIdPrefix = true,
  signal?: AbortSignal,
): Promise<string> {
  const cvmId = resolveCvmId(id);
  let base: string | null = null;
  let auth: string | null = null;
  if (containerName) {
    const info = await getCvmInfoLogs(client, cvmId, signal);
    if (info.public_logs === false) {
      throw containerLogsDisabledError();
    }
    base = info.logs?.container_log_base ?? null;
    auth = info.logs?.auth_query ?? null;
  }

  const composition = (await client.get(`/cvms/${cvmId}/composition`, {
    signal,
  })) as CvmCompositionResponse;
  const containers = composition.containers ?? [];
  const compositionError =
    typeof composition.error === "string" && composition.error ? composition.error : undefined;

  if (containerName) {
    const exact = containers.filter((item) => exactContainerNameMatch(item, containerName));
    if (exact.length > 0) {
      const withEndpoint = exact.find((item) => item.log_endpoint);
      if (withEndpoint?.log_endpoint) return withEndpoint.log_endpoint;
      if (base) return joinContainerLogUrl(base, containerName, auth);
      throw new Error(`Container '${containerName}' not found in CVM '${cvmId}'`);
    }
    if (matchContainerIdPrefix) {
      const prefixed = containers.filter((item) => item.id.startsWith(containerName));
      if (prefixed.length > 1) {
        const labels = prefixed.map((item) => item.names[0] ?? item.id).join(", ");
        throw new Error(`Ambiguous container prefix '${containerName}': ${labels}`);
      }
      if (prefixed.length === 1) {
        const match = prefixed[0];
        if (match?.log_endpoint) return match.log_endpoint;
        const slug = match?.names[0]?.replace(/^\//, "") ?? match?.id;
        if (base && slug) return joinContainerLogUrl(base, slug, auth);
      }
    }
    if (containers.length > 0) {
      throw new Error(`Container '${containerName}' not found in CVM '${cvmId}'`);
    }
    if (compositionError) {
      throw new Error(compositionError);
    }
    if (base) return joinContainerLogUrl(base, containerName, auth);
    throw new Error(`Container '${containerName}' not found in CVM '${cvmId}'`);
  }

  if (compositionError) {
    throw new Error(compositionError);
  }
  if (!containers.length) {
    throw new Error(`No containers found for CVM '${cvmId}'`);
  }
  const withEndpoint = containers.find((item) => item.log_endpoint);
  if (withEndpoint?.log_endpoint) return withEndpoint.log_endpoint;
  const fallback = containers[0];
  const slug = fallback?.names[0]?.replace(/^\//, "") ?? fallback?.id;
  if (base && slug) return joinContainerLogUrl(base, slug, auth);
  throw new Error(`No log endpoints available for CVM '${cvmId}'`);
}

function waitForReconnect(signal: AbortSignal | undefined, delayMs: number): Promise<void> {
  if (signal?.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);
    const onAbort = () => {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
      resolve();
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function getErrorHttpStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  if ("httpStatus" in error && typeof error.httpStatus === "number") {
    return error.httpStatus;
  }
  if ("status" in error && typeof error.status === "number") {
    return error.status;
  }
  return undefined;
}

const EMPTY_STREAM_END_MESSAGE =
  "log stream keeps ending without new output; the container may have stopped";
/** Idle connections longer than this that end cleanly are not treated as a stopped container. */
export const EMPTY_STREAM_QUIET_MS = 10_000;

async function followLogRequests(
  client: Client,
  resolveUrl: () => Promise<string>,
  consume: (response: Response, markDelivered: () => void) => Promise<boolean | void>,
  signal?: AbortSignal,
  refreshCvm?: () => Promise<void>,
  trackEmptyEnds = false,
  onConnected?: () => void,
  shouldStop?: () => boolean,
): Promise<void> {
  let failureCount = 0;
  let expiredRetries = 0;
  let emptyEnds = 0;
  while (!signal?.aborted) {
    let deliveredThisConnection = false;
    const markDelivered = () => {
      deliveredThisConnection = true;
    };
    try {
      const url = await resolveUrl();
      if (signal?.aborted) return;
      const response = await logFetch(client, url, signal);
      if (!response.ok) await throwResponseError(response);
      onConnected?.();
      const connectedAt = Date.now();
      const delivered = (await consume(response, markDelivered)) ?? deliveredThisConnection;
      expiredRetries = 0;
      if (delivered) {
        failureCount = 0;
      }
      if (shouldStop?.()) return;
      if (signal?.aborted) return;
      if (delivered) {
        emptyEnds = 0;
      } else if (Date.now() - connectedAt >= EMPTY_STREAM_QUIET_MS) {
        emptyEnds = 0;
      } else {
        emptyEnds += 1;
        if (trackEmptyEnds && emptyEnds >= 5) {
          throw new LogAccessError({
            message: EMPTY_STREAM_END_MESSAGE,
            fromStreamBody: true,
          });
        }
        await waitForReconnect(signal, Math.min(250 * 2 ** (emptyEnds - 1), 5000));
      }
    } catch (error) {
      if (signal?.aborted || (error instanceof Error && error.name === "AbortError")) {
        return;
      }

      let retryError = error;
      if (error instanceof LogAccessError && error.fromStreamBody) {
        throw error;
      }
      emptyEnds = 0;
      if (error instanceof LogAccessError && error.code === "ERR-17-003") {
        expiredRetries += 1;
        if (expiredRetries > 3) throw error;
        try {
          await refreshCvm?.();
          continue;
        } catch (refreshError) {
          retryError = refreshError;
        }
      }

      const status = getErrorHttpStatus(retryError);
      const code = retryError instanceof LogAccessError ? retryError.code : undefined;
      const retryableCodes = new Set([
        "ERR-17-008",
        "ERR-17-009",
        "ERR-17-010",
        "ERR-17-011",
        "ERR-17-012",
      ]);
      if (code === "ERR-17-002") {
        try {
          await refreshCvm?.();
        } catch (refreshError) {
          retryError = refreshError;
        }
      } else if (
        retryableCodes.has(code ?? "") ||
        status === 429 ||
        (status !== undefined && status >= 500) ||
        retryError instanceof TypeError
      ) {
        // retry as a failure below
      } else {
        throw retryError;
      }

      if (deliveredThisConnection) {
        failureCount = 0;
      }
      failureCount += 1;
      if (failureCount >= 5) throw retryError;
      const delayMs = Math.min(250 * 2 ** (failureCount - 1), 5000);
      await waitForReconnect(signal, delayMs);
    }
  }
}

export async function fetchCvmChannelLogs(
  client: Client,
  id: CvmIdInput | string,
  channel: CvmLogChannel,
  options: CvmLogsOptions = {},
): Promise<string> {
  assertSupportedNodeLogOptions(options);
  const times = resolveLogTimeWindow(options.since, options.until);
  const baseUrl = await getCvmLogEndpoint(client, id, channel);
  const url = buildLogUrl(baseUrl, {
    since: times.since,
    until: times.until,
    tail: options.tail,
    ansi: options.ansi,
  });
  const response = await logFetch(client, url, options.signal);
  if (!response.ok) await throwResponseError(response);
  const text = await response.text();
  throwIfTextBodyErrors(text);
  return applyAnsiPolicy(
    text
      .split(/(?<=\n)/)
      .filter((line) => {
        const content = line.replace(/\r?\n$/, "");
        return content !== "[vmm heartbeat]" && content !== "[teepod heartbeat]";
      })
      .join(""),
    options.ansi,
  );
}

export async function streamCvmChannelLogs(
  client: Client,
  id: CvmIdInput | string,
  channel: CvmLogChannel,
  onData: (data: string) => void,
  options: CvmLogsOptions = {},
  signal?: AbortSignal,
): Promise<void> {
  assertSupportedNodeLogOptions(options);
  const abort = signal ?? options.signal;
  const times = resolveLogTimeWindow(options.since, options.until);
  let firstRequest = true;
  await followLogRequests(
    client,
    async () => {
      const baseUrl = await getCvmLogEndpoint(client, id, channel, abort);
      const tail = firstRequest ? options.tail : 0;
      return buildLogUrl(baseUrl, {
        since: times.since,
        until: times.until,
        tail,
        follow: true,
        ansi: options.ansi,
      });
    },
    (response, markDelivered) => streamResponse(response, onData, markDelivered, options.ansi),
    abort,
    async () => {
      await getCvmInfoLogs(client, resolveCvmId(id), abort);
    },
    false,
    () => {
      firstRequest = false;
    },
  );
}

export async function fetchContainerLogsEntries(
  client: Client,
  id: CvmIdInput | string,
  options: CvmLogsOptions & { container?: string; matchContainerIdPrefix?: boolean } = {},
): Promise<CvmLogEntry[]> {
  if (options.ansi && (options.format ?? "ndjson") === "ndjson") {
    throw new LogAccessError({
      code: "ERR-17-001",
      message: "ansi is valid only with format=text",
    });
  }
  const times = resolveLogTimeWindow(options.since, options.until);
  await assertContainerLogsEnabled(client, id);
  const baseUrl = await getContainerLogEndpoint(
    client,
    id,
    options.container,
    options.matchContainerIdPrefix ?? true,
  );
  const url = buildLogUrl(baseUrl, {
    ...times,
    tail: options.tail,
    timestamps: options.timestamps,
    format: options.format ?? "ndjson",
  });
  const response = await logFetch(client, url, options.signal);
  if (!response.ok) await throwResponseError(response);
  return parseStructuredLogsToEntries(await response.text()).map((entry) => ({
    ...entry,
    message: applyAnsiPolicy(entry.message, options.ansi),
  }));
}

export async function fetchContainerLogs(
  client: Client,
  id: CvmIdInput | string,
  options: CvmLogsOptions & { container?: string; matchContainerIdPrefix?: boolean } = {},
): Promise<string> {
  if (options.format === "text") {
    const times = resolveLogTimeWindow(options.since, options.until);
    await assertContainerLogsEnabled(client, id);
    const baseUrl = await getContainerLogEndpoint(
      client,
      id,
      options.container,
      options.matchContainerIdPrefix ?? true,
    );
    const url = buildLogUrl(baseUrl, {
      ...times,
      tail: options.tail,
      timestamps: options.timestamps,
      ansi: options.ansi,
      format: "text",
    });
    const response = await logFetch(client, url, options.signal);
    if (!response.ok) await throwResponseError(response);
    const text = await response.text();
    throwIfTextBodyErrors(text);
    return applyAnsiPolicy(text, options.ansi);
  }
  const entries = await fetchContainerLogsEntries(client, id, {
    ...options,
    format: "ndjson",
  });
  return entries.map((entry) => (entry.message === "" ? "\n" : entry.message)).join("");
}

export async function streamContainerLogsEntries(
  client: Client,
  id: CvmIdInput | string,
  onEntry: (entry: CvmLogEntry) => void,
  options: CvmLogsOptions & { container?: string; matchContainerIdPrefix?: boolean } = {},
  signal?: AbortSignal,
): Promise<void> {
  const abort = signal ?? options.signal;
  const times = resolveLogTimeWindow(options.since, options.until);
  await assertContainerLogsEnabled(client, id, abort);
  const cursor: {
    since?: number;
    boundarySecond?: number;
    boundaryCounts: Map<string, number>;
  } = { boundaryCounts: new Map() };
  let replayCounts = new Map<string, number>();
  let firstRequest = true;
  let first200Second: number | undefined;

  const buildRequestUrl = async (): Promise<string> => {
    const baseUrl = await getContainerLogEndpoint(
      client,
      id,
      options.container,
      options.matchContainerIdPrefix ?? true,
      abort,
    );
    const tail = firstRequest ? options.tail : "all";
    replayCounts = new Map(cursor.boundaryCounts);
    return buildLogUrl(baseUrl, {
      since: firstRequest
        ? times.since
        : reconnectSinceValue(cursor.since, first200Second, times.since),
      until: times.until,
      tail,
      follow: true,
      timestamps: true,
      format: "ndjson",
    });
  };

  await followLogRequests(
    client,
    buildRequestUrl,
    async (response, markDelivered) => {
      let delivered = false;
      await streamNdjsonEntriesResponse(response, (entry) => {
        const timestamp = parseTimestampedMessage(entry.message);
        if (timestamp.second === undefined || !timestamp.timestamp) {
          delivered = true;
          markDelivered();
          onEntry(formatFollowContainerEntry(entry, options.timestamps ?? false, options.ansi));
          return;
        }

        const key = JSON.stringify([entry.channel, entry.message]);
        if (cursor.boundarySecond !== undefined && timestamp.second < cursor.boundarySecond) {
          delivered = true;
          markDelivered();
          onEntry(formatFollowContainerEntry(entry, options.timestamps ?? false, options.ansi));
          return;
        }
        if (timestamp.second === cursor.boundarySecond) {
          const replayCount = replayCounts.get(key) ?? 0;
          if (replayCount > 0) {
            replayCounts.set(key, replayCount - 1);
            return;
          }
        } else if (
          cursor.boundarySecond === undefined ||
          timestamp.second > cursor.boundarySecond
        ) {
          cursor.boundarySecond = timestamp.second;
          cursor.boundaryCounts.clear();
        }

        cursor.since = Math.max(cursor.since ?? timestamp.second, timestamp.second);
        cursor.boundaryCounts.set(key, (cursor.boundaryCounts.get(key) ?? 0) + 1);
        delivered = true;
        markDelivered();
        onEntry(formatFollowContainerEntry(entry, options.timestamps ?? false, options.ansi));
      });
      return delivered;
    },
    abort,
    async () => {
      await assertContainerLogsEnabled(client, id, abort);
    },
    true,
    () => {
      firstRequest = false;
      if (first200Second === undefined) first200Second = Math.floor(Date.now() / 1000);
    },
    () => times.until !== undefined && cursor.since !== undefined && cursor.since >= times.until,
  );
}

async function streamContainerText(
  response: Response,
  onData: (data: string) => void,
): Promise<boolean> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body available for streaming");
  const decoder = new TextDecoder();
  let buffer = "";
  let finished = false;
  let delivered = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        throwTextStreamError(line);
        throwIfGuestAgentError(line);
        onData(line + "\n");
        delivered = true;
        newline = buffer.indexOf("\n");
      }
      if (done) {
        finished = true;
        break;
      }
    }
    if (buffer) {
      throwTextStreamError(buffer);
      throwIfGuestAgentError(buffer);
      onData(buffer);
      delivered = true;
    }
  } finally {
    if (!finished) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  return delivered;
}

export async function streamContainerLogs(
  client: Client,
  id: CvmIdInput | string,
  onData: (data: string) => void,
  options: CvmLogsOptions & { container?: string; matchContainerIdPrefix?: boolean } = {},
  signal?: AbortSignal,
): Promise<void> {
  if (options.format === "text") {
    const abort = signal ?? options.signal;
    const times = resolveLogTimeWindow(options.since, options.until);
    await assertContainerLogsEnabled(client, id, abort);
    const cursor: {
      since?: number;
      boundarySecond?: number;
      boundaryCounts: Map<string, number>;
    } = { boundaryCounts: new Map() };
    let replayCounts = new Map<string, number>();
    let firstRequest = true;
    let first200Second: number | undefined;
    await followLogRequests(
      client,
      async () => {
        const baseUrl = await getContainerLogEndpoint(
          client,
          id,
          options.container,
          options.matchContainerIdPrefix ?? true,
          abort,
        );
        const tail = firstRequest ? options.tail : "all";
        replayCounts = new Map(cursor.boundaryCounts);
        return buildLogUrl(baseUrl, {
          since: firstRequest
            ? times.since
            : reconnectSinceValue(cursor.since, first200Second, times.since),
          until: times.until,
          tail,
          follow: true,
          timestamps: true,
          ansi: options.ansi,
          format: "text",
        });
      },
      async (response, markDelivered) => {
        let delivered = false;
        await streamContainerText(response, (line) => {
          const raw = line.endsWith("\n") ? line.slice(0, -1) : line;
          throwTextStreamError(raw);
          const timestamp = parseTimestampedMessage(raw);
          const out = options.timestamps
            ? line
            : timestamp.timestamp
              ? `${timestamp.message ?? ""}${line.endsWith("\n") ? "\n" : ""}`
              : line;
          if (timestamp.second === undefined || !timestamp.timestamp) {
            delivered = true;
            markDelivered();
            onData(out);
            return;
          }
          const key = raw;
          if (cursor.boundarySecond !== undefined && timestamp.second < cursor.boundarySecond) {
            delivered = true;
            markDelivered();
            onData(out);
            return;
          }
          if (timestamp.second === cursor.boundarySecond) {
            const replayCount = replayCounts.get(key) ?? 0;
            if (replayCount > 0) {
              replayCounts.set(key, replayCount - 1);
              return;
            }
          } else if (
            cursor.boundarySecond === undefined ||
            timestamp.second > cursor.boundarySecond
          ) {
            cursor.boundarySecond = timestamp.second;
            cursor.boundaryCounts.clear();
          }
          cursor.since = Math.max(cursor.since ?? timestamp.second, timestamp.second);
          cursor.boundaryCounts.set(key, (cursor.boundaryCounts.get(key) ?? 0) + 1);
          delivered = true;
          markDelivered();
          onData(out);
        });
        return delivered;
      },
      abort,
      async () => {
        await assertContainerLogsEnabled(client, id, abort);
      },
      true,
      () => {
        firstRequest = false;
        if (first200Second === undefined) first200Second = Math.floor(Date.now() / 1000);
      },
      () => times.until !== undefined && cursor.since !== undefined && cursor.since >= times.until,
    );
    return;
  }
  return streamContainerLogsEntries(
    client,
    id,
    (entry) => onData(entry.message === "" ? "\n" : entry.message),
    options,
    signal,
  );
}

export async function fetchCvmLogs(
  client: Client,
  id: CvmIdInput | string,
  source: CvmLogSource,
  options: CvmLogsOptions = {},
): Promise<string | CvmLogEntry[]> {
  if (source.type === "node") {
    return fetchCvmChannelLogs(client, id, source.channel, options);
  }
  if (options.format === "ndjson") {
    return fetchContainerLogsEntries(client, id, {
      ...options,
      container: source.name,
      matchContainerIdPrefix: source.matchContainerIdPrefix,
    });
  }
  return fetchContainerLogs(client, id, {
    ...options,
    container: source.name,
    matchContainerIdPrefix: source.matchContainerIdPrefix,
  });
}

export async function* followCvmLogs(
  client: Client,
  id: CvmIdInput | string,
  source: CvmLogSource,
  options: CvmLogsOptions = {},
): AsyncGenerator<string | CvmLogEntry> {
  const pending: Array<string | CvmLogEntry> = [];
  let wake: (() => void) | undefined;
  let done = false;
  let error: unknown;
  const abort = new AbortController();
  if (options.signal) {
    if (options.signal.aborted) abort.abort();
    else options.signal.addEventListener("abort", () => abort.abort(), { once: true });
  }
  const signal = abort.signal;

  const push = (item: string | CvmLogEntry) => {
    pending.push(item);
    wake?.();
  };

  const run =
    source.type === "node"
      ? streamCvmChannelLogs(client, id, source.channel, push, options, signal)
      : options.format === "text"
        ? streamContainerLogs(
            client,
            id,
            (data) => push(data),
            {
              ...options,
              container: source.name,
              matchContainerIdPrefix: source.matchContainerIdPrefix,
            },
            signal,
          )
        : streamContainerLogsEntries(
            client,
            id,
            push,
            {
              ...options,
              container: source.name,
              matchContainerIdPrefix: source.matchContainerIdPrefix,
            },
            signal,
          );

  void run.then(
    () => {
      done = true;
      wake?.();
    },
    (reason: unknown) => {
      error = reason;
      done = true;
      wake?.();
    },
  );

  try {
    while (!done || pending.length > 0) {
      if (pending.length > 0) {
        yield pending.shift() as string | CvmLogEntry;
        continue;
      }
      await new Promise<void>((resolve) => {
        wake = resolve;
      });
    }
    if (error) throw error;
  } finally {
    abort.abort();
  }
}
