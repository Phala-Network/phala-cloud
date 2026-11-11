const DURATION_SECONDS: Record<string, number> = {
  s: 1,
  m: 60,
  h: 60 * 60,
  d: 24 * 60 * 60,
};

function parseRfc3339(value: string): { seconds: number; fractionNonZero: boolean } | undefined {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|([+-])(\d{2}):(\d{2}))$/.exec(
      value,
    );
  if (!match) return undefined;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const fraction = match[7];
  const sign = match[9];
  const offsetHour = Number(match[10] ?? 0);
  const offsetMinute = Number(match[11] ?? 0);
  const lastDateOfMonth = new Date(0);
  lastDateOfMonth.setUTCFullYear(year, month, 0);
  const daysInMonth = lastDateOfMonth.getUTCDate();
  if (
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetHour > 23 ||
    offsetMinute > 59
  ) {
    return undefined;
  }

  const offset = sign === "+" ? 1 : sign === "-" ? -1 : 0;
  const offsetSeconds = offset * (offsetHour * 60 + offsetMinute) * 60;
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, 0);
  const seconds = Math.floor(date.getTime() / 1000) - offsetSeconds;
  const fractionNonZero = Boolean(fraction && /[1-9]/.test(fraction));
  return { seconds, fractionNonZero };
}

function resolveLogInstant(value: string | number, nowMs: number, ceil: boolean): number {
  if (typeof value === "number") {
    return ceil ? Math.ceil(value) : Math.floor(value);
  }
  if (/^-?\d+$/.test(value)) {
    const seconds = Number(value);
    const milliseconds = seconds * 1000;
    if (Number.isSafeInteger(seconds) && Number.isSafeInteger(milliseconds)) {
      return seconds;
    }
  }

  const relative = /^(\d+)([smhd])$/.exec(value);
  if (relative) {
    const unit = relative[2];
    if (!unit || !(unit in DURATION_SECONDS)) {
      throw new Error(
        `Invalid log time '${value}'. Use RFC3339, Unix seconds, or a relative duration such as 10m.`,
      );
    }
    const duration = Number(relative[1]) * (DURATION_SECONDS[unit] ?? 0);
    const milliseconds = nowMs - duration * 1000;
    if (Number.isFinite(milliseconds) && Number.isSafeInteger(Math.floor(milliseconds / 1000))) {
      return ceil ? Math.ceil(milliseconds / 1000) : Math.floor(milliseconds / 1000);
    }
  }

  const rfc3339 = parseRfc3339(value);
  if (rfc3339 !== undefined) {
    return ceil && rfc3339.fractionNonZero ? rfc3339.seconds + 1 : rfc3339.seconds;
  }

  throw new Error(
    `Invalid log time '${value}'. Use RFC3339, Unix seconds, or a relative duration such as 10m.`,
  );
}

/** Resolve since/until to unix seconds. Relative values are anchored to `nowMs`. */
export function resolveLogTimeWindow(
  since: string | number | undefined,
  until: string | number | undefined,
  nowMs: number = Date.now(),
): { since?: number; until?: number } {
  const resolvedSince = since === undefined ? undefined : resolveLogInstant(since, nowMs, false);
  const resolvedUntil = until === undefined ? undefined : resolveLogInstant(until, nowMs, true);
  if (
    (resolvedSince !== undefined && !Number.isSafeInteger(resolvedSince)) ||
    (resolvedUntil !== undefined && !Number.isSafeInteger(resolvedUntil))
  ) {
    throw new Error("Log time is outside the supported Unix seconds range.");
  }
  return {
    ...(resolvedSince === undefined ? {} : { since: resolvedSince }),
    ...(resolvedUntil === undefined ? {} : { until: resolvedUntil }),
  };
}
