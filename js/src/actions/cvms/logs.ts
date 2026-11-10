import type { Client } from "../../client";
import { CvmIdSchema, type CvmIdInput } from "../../types/cvm_id";
import { ResourceError } from "../../utils/errors";
import { resolveLogTimeWindow } from "./log-time";

export { resolveLogTimeWindow } from "./log-time";

/** API version that introduced CVMInfo.logs. Pinned so older clients still get URLs. */
export const CVM_LOGS_INFO_API_VERSION = "2026-01-21";

export type CvmLogChannel = "serial" | "stdout" | "stderr";
export type CvmLogFormat = "text" | "ndjson";
export type LogChannel = "stdout" | "stderr";

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
  }) {
    const details = options.message;
    const suggestionText = options.suggestions?.length
      ? `\nSuggestions:\n${options.suggestions.map((suggestion) => `- ${suggestion}`).join("\n")}`
      : "";
    const status = options.fromStreamBody
      ? 0
      : (options.httpStatus ?? (options.code ? logErrorHttpStatus(options.code) : undefined) ?? 0);
    super(`${details}${suggestionText}`, {
      status,
      statusText: "",
      errorCode: options.code,
      suggestions: options.suggestions ? [...options.suggestions] : undefined,
    });
    this.name = "LogAccessError";
    this.code = options.code;
    this.httpStatus = status || undefined;
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

async function streamResponse(response: Response, onData: (data: string) => void): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body available for streaming");

  const decoder = new TextDecoder();
  let buffer = "";
  let finished = false;
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
          onData(line);
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
      onData(buffer);
    }
  } finally {
    if (!finished) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
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
  });
}

function throwTextStreamError(line: string): void {
  const match = /^\[error\] (ERR-17-\d{3}) (.*)$/.exec(line.trim());
  const code = match?.[1];
  const message = match?.[2];
  if (code && message !== undefined) throw new LogAccessError({ code, message });
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
): CvmLogEntry {
  if (includeTimestamps) return { channel: entry.channel, message: entry.message };
  const timestamp = parseTimestampedMessage(entry.message);
  return {
    channel: entry.channel,
    message: timestamp.timestamp ? (timestamp.message ?? "") : entry.message,
  };
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

function parseStructuredLogLineToEntry(line: string): StructuredLogEntry | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  let parsed: {
    channel?: unknown;
    message?: unknown;
    error?: unknown;
    error_code?: unknown;
    suggestions?: unknown;
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
      suggestions: Array.isArray(parsed.suggestions)
        ? parsed.suggestions.filter((item): item is string => typeof item === "string")
        : [],
    });
  }
  if (
    (parsed.channel !== "stdout" && parsed.channel !== "stderr") ||
    typeof parsed.message !== "string"
  ) {
    throw new LogAccessError({ message: "Invalid NDJSON log record." });
  }

  const entry: StructuredLogEntry = {
    channel: parsed.channel,
    message: parsed.message,
  };
  const timestamp = parseTimestampedMessage(entry.message).timestamp;
  if (timestamp) entry.timestamp = timestamp;
  return entry;
}

function parseStructuredLogsToEntries(input: string): CvmLogEntry[] {
  const entries: CvmLogEntry[] = [];
  for (const line of input.split(/\r?\n/)) {
    const entry = parseStructuredLogLineToEntry(line);
    if (entry) entries.push(entry);
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
      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        const entry = parseStructuredLogLineToEntry(buffer.slice(0, newline));
        if (entry) onEntry(entry);
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf("\n");
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

async function getCvmInfoLogs(client: Client, cvmId: string): Promise<CvmInfoWithLogs> {
  return (await client.get(`/cvms/${cvmId}`, {
    headers: { "X-Phala-Version": CVM_LOGS_INFO_API_VERSION },
  })) as CvmInfoWithLogs;
}

/** Get a presigned CVM-level log URL for a given node channel. */
export async function getCvmLogEndpoint(
  client: Client,
  id: CvmIdInput | string,
  channel: CvmLogChannel,
): Promise<string> {
  const cvmId = resolveCvmId(id);
  const info = await getCvmInfoLogs(client, cvmId);
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

async function assertContainerLogsEnabled(client: Client, id: CvmIdInput | string): Promise<void> {
  const info = await getCvmInfoLogs(client, resolveCvmId(id));
  if (info.public_logs === false) {
    throw containerLogsDisabledError();
  }
}

async function getContainerLogEndpoint(
  client: Client,
  id: CvmIdInput | string,
  containerName?: string,
  matchContainerIdPrefix = true,
): Promise<string> {
  const cvmId = resolveCvmId(id);
  const composition = (await client.get(`/cvms/${cvmId}/composition`)) as CvmCompositionResponse;

  if (!composition.containers?.length) {
    throw new Error(`No containers found for CVM '${cvmId}'`);
  }

  let containers = composition.containers;
  if (containerName) {
    containers = containers.filter((c) => {
      const matchedByName = c.names.some((n) => n === containerName || n === `/${containerName}`);
      if (matchedByName) return true;
      if (!matchContainerIdPrefix) return false;
      return c.id.startsWith(containerName);
    });

    if (!containers.length) {
      throw new Error(`Container '${containerName}' not found in CVM '${cvmId}'`);
    }
  }

  const container = containers.find((c) => c.log_endpoint);
  if (!container?.log_endpoint) {
    throw new Error(`No log endpoints available for CVM '${cvmId}'`);
  }
  return container.log_endpoint;
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

async function followLogRequests(
  resolveUrl: () => Promise<string>,
  consume: (response: Response) => Promise<boolean | void>,
  signal?: AbortSignal,
  refreshCvm?: () => Promise<void>,
  trackEmptyEnds = false,
): Promise<void> {
  let failureCount = 0;
  let expiredRetries = 0;
  let emptyEnds = 0;
  while (!signal?.aborted) {
    try {
      const url = await resolveUrl();
      if (signal?.aborted) return;
      const response = await fetch(url, { signal });
      if (!response.ok) await throwResponseError(response);
      failureCount = 0;
      const delivered = (await consume(response)) ?? true;
      expiredRetries = 0;
      if (signal?.aborted) return;
      if (trackEmptyEnds) {
        if (delivered) {
          emptyEnds = 0;
        } else {
          emptyEnds += 1;
          if (emptyEnds >= 5) {
            throw new LogAccessError({
              message: EMPTY_STREAM_END_MESSAGE,
              fromStreamBody: true,
            });
          }
          await waitForReconnect(signal, Math.min(250 * 2 ** (emptyEnds - 1), 5000));
        }
      }
    } catch (error) {
      if (signal?.aborted || (error instanceof Error && error.name === "AbortError")) {
        return;
      }

      let retryError = error;
      if (error instanceof LogAccessError && error.fromStreamBody) {
        throw error;
      }
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
      if (status !== undefined && status < 500) throw retryError;
      if (retryError instanceof LogAccessError && status === undefined) {
        throw retryError;
      }
      if (status === undefined && !(retryError instanceof TypeError)) {
        throw retryError;
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
  const response = await fetch(url, { signal: options.signal });
  if (!response.ok) await throwResponseError(response);
  return response.text();
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
    async () => {
      const baseUrl = await getCvmLogEndpoint(client, id, channel);
      const tail = firstRequest ? options.tail : 0;
      firstRequest = false;
      return buildLogUrl(baseUrl, {
        since: times.since,
        until: times.until,
        tail,
        follow: true,
        ansi: options.ansi,
      });
    },
    (response) => streamResponse(response, onData),
    abort,
    async () => {
      await getCvmInfoLogs(client, resolveCvmId(id));
    },
  );
}

export async function fetchContainerLogsEntries(
  client: Client,
  id: CvmIdInput | string,
  options: CvmLogsOptions & { container?: string; matchContainerIdPrefix?: boolean } = {},
): Promise<CvmLogEntry[]> {
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
    format: options.format ?? "ndjson",
  });
  const response = await fetch(url, { signal: options.signal });
  if (!response.ok) await throwResponseError(response);
  return parseStructuredLogsToEntries(await response.text());
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
    const response = await fetch(url, { signal: options.signal });
    if (!response.ok) await throwResponseError(response);
    const text = await response.text();
    throwIfGuestAgentError(text);
    return text;
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
  await assertContainerLogsEnabled(client, id);
  const cursor: {
    since?: number;
    boundarySecond?: number;
    boundaryCounts: Map<string, number>;
  } = { since: times.since, boundaryCounts: new Map() };
  let replayCounts = new Map<string, number>();
  let firstRequest = true;

  const buildRequestUrl = async (): Promise<string> => {
    const baseUrl = await getContainerLogEndpoint(
      client,
      id,
      options.container,
      options.matchContainerIdPrefix ?? true,
    );
    const tail = firstRequest ? options.tail : undefined;
    firstRequest = false;
    replayCounts = new Map(cursor.boundaryCounts);
    return buildLogUrl(baseUrl, {
      since: cursor.since,
      until: times.until,
      tail,
      follow: true,
      timestamps: true,
      format: "ndjson",
    });
  };

  await followLogRequests(
    buildRequestUrl,
    async (response) => {
      let delivered = false;
      await streamNdjsonEntriesResponse(response, (entry) => {
        const timestamp = parseTimestampedMessage(entry.message);
        if (timestamp.second === undefined || !timestamp.timestamp) {
          delivered = true;
          onEntry(formatFollowContainerEntry(entry, options.timestamps ?? false));
          return;
        }

        const key = JSON.stringify([entry.channel, entry.message]);
        if (cursor.boundarySecond !== undefined && timestamp.second < cursor.boundarySecond) {
          delivered = true;
          onEntry(formatFollowContainerEntry(entry, options.timestamps ?? false));
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
        onEntry(formatFollowContainerEntry(entry, options.timestamps ?? false));
      });
      return delivered;
    },
    abort,
    async () => {
      await assertContainerLogsEnabled(client, id);
    },
    true,
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
    await assertContainerLogsEnabled(client, id);
    let firstRequest = true;
    await followLogRequests(
      async () => {
        const baseUrl = await getContainerLogEndpoint(
          client,
          id,
          options.container,
          options.matchContainerIdPrefix ?? true,
        );
        const tail = firstRequest ? options.tail : undefined;
        firstRequest = false;
        return buildLogUrl(baseUrl, {
          ...times,
          tail,
          follow: true,
          timestamps: options.timestamps,
          ansi: options.ansi,
          format: "text",
        });
      },
      (response) => streamContainerText(response, onData),
      abort,
      async () => {
        await assertContainerLogsEnabled(client, id);
      },
      true,
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

  const push = (item: string | CvmLogEntry) => {
    pending.push(item);
    wake?.();
  };

  const run =
    source.type === "node"
      ? streamCvmChannelLogs(client, id, source.channel, push, options, options.signal)
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
            options.signal,
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
            options.signal,
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
}
