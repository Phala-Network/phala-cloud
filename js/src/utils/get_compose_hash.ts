import crypto from "crypto";

export type SortableValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | SortableObject
  | SortableArray;

export interface SortableObject {
  [key: string]: SortableValue;
}

export interface SortableArray extends Array<SortableValue> {}

export function sortObject(obj: SortableValue): SortableValue {
  if (obj === undefined || obj === null) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(sortObject);
  } else if (obj && typeof obj === "object" && obj.constructor === Object) {
    return Object.keys(obj)
      .sort()
      .reduce((result: SortableObject, key) => {
        const value = (obj as SortableObject)[key];
        result[key] = sortObject(value);
        return result;
      }, {});
  }
  return obj;
}

export type KeyProviderKind = "none" | "kms" | "local" | "tpm";

export interface DockerConfig extends SortableObject {
  registry?: string;
  username?: string;
  token_key?: string;
}

export interface AppCompose extends SortableObject {
  manifest_version?: number | string;
  name?: string;
  features?: string[];
  runner?: string;
  docker_compose_file?: string;
  docker_config?: DockerConfig;
  public_logs?: boolean;
  public_sysinfo?: boolean;
  public_tcbinfo?: boolean;
  kms_enabled?: boolean;
  gateway_enabled?: boolean;
  tproxy_enabled?: boolean;
  local_key_provider_enabled?: boolean;
  key_provider?: KeyProviderKind;
  key_provider_id?: string;
  allowed_envs?: string[];
  no_instance_id?: boolean;
  secure_time?: boolean;
  storage_fs?: string;
  swap_size?: string;
  bash_script?: string | null;
  pre_launch_script?: string | null;
  init_script?: string | string[];
  storage_discard?: boolean | null;
  event_log_version?: number | null;
  snapshotter?: string | null;
  verity_volumes?: SortableArray | null;
  requirements?: SortableObject | null;
  port_policy?: SortableObject | null;
}

/** Optional fields the backend omits from the hashed compose when null. */
const OMIT_WHEN_NULL = [
  "event_log_version",
  "key_provider",
  "port_policy",
  "requirements",
  "snapshotter",
  "storage_discard",
  "swap_size",
  "verity_volumes",
] as const;
/** Optional fields the backend omits from the hashed compose when null or empty. */
const OMIT_WHEN_EMPTY = [
  "default_gateway_domain",
  "key_provider_id",
  "pre_launch_script",
  "salt",
] as const;

/**
 * Parse a dstack OS image version like the backend: leading digits of each
 * dot-separated part, stopping at the first suffix ("0.6.0-rc0" is 0.6.0).
 */
function parseOsImageVersion(version: string): number[] {
  const parts: number[] = [];
  for (const raw of version.split(".")) {
    const match = /^\d+/.exec(raw);
    if (!match) break;
    parts.push(Number(match[0]));
    if (match[0].length !== raw.length) break;
  }
  while (parts.length < 3) parts.push(0);
  return parts;
}

function isBelowDstack060(version: string): boolean {
  const [major = 0, minor = 0] = parseOsImageVersion(version);
  return major === 0 && minor < 6;
}

/**
 * Apply the same normalization as the Phala Cloud backend before hashing:
 * drop the script field the runner does not use, drop optional fields that are
 * null (or empty for string fields), and always emit `tproxy_enabled`.
 *
 * With `osImageVersion` (the OS image the CVM runs, e.g. "0.6.0"), also write
 * the OS-dependent wire format: below 0.6.0, `manifest_version` 2 and
 * `init_script` as a single string (omitted when empty); from 0.6.0,
 * `manifest_version` "3" and `init_script` as a list. Without it,
 * `manifest_version` and `init_script` are hashed as given, which is right for
 * a compose read back from Phala Cloud.
 */
export function preprocessAppCompose(dic: AppCompose, osImageVersion?: string): AppCompose {
  const obj: AppCompose = { ...dic };
  if (obj.runner === "bash") {
    delete obj.docker_compose_file;
  } else if (obj.runner === "docker-compose") {
    delete obj.bash_script;
  }
  if (!("tproxy_enabled" in obj)) {
    obj.tproxy_enabled = "gateway_enabled" in obj ? obj.gateway_enabled : true;
  }
  for (const key of OMIT_WHEN_NULL) {
    if (obj[key] == null) {
      delete obj[key];
    }
  }
  for (const key of OMIT_WHEN_EMPTY) {
    if (!obj[key]) {
      delete obj[key];
    }
  }
  if (osImageVersion !== undefined) {
    const raw = obj.init_script;
    const scripts = Array.isArray(raw) ? raw : raw ? [raw] : [];
    if (isBelowDstack060(osImageVersion)) {
      obj.manifest_version = 2;
      if (scripts.length === 0) {
        delete obj.init_script;
      } else if (scripts.length === 1) {
        obj.init_script = scripts[0];
      } else {
        throw new Error("OS images below 0.6.0 accept at most one init_script");
      }
    } else {
      obj.manifest_version = "3";
      obj.init_script = scripts;
    }
  }
  return obj;
}

/**
 * Serialize like the backend: sorted keys, compact separators, and non-ASCII
 * text left as UTF-8. Nested keys are sorted too, which matches the backend
 * because its nested models declare their fields alphabetically.
 */
export function dumpAppCompose(dic: AppCompose): string {
  return JSON.stringify(sortObject(dic));
}

/**
 * Compute the compose hash exactly as the Phala Cloud backend does.
 *
 * Pass `osImageVersion` when hashing a compose you built yourself, so the
 * OS-dependent `manifest_version` and `init_script` wire format is applied (see
 * `preprocessAppCompose`).
 */
export function getComposeHash(app_compose: AppCompose, osImageVersion?: string): string {
  const preprocessed = preprocessAppCompose(app_compose, osImageVersion);
  const manifest_str = dumpAppCompose(preprocessed);
  return crypto.createHash("sha256").update(manifest_str, "utf8").digest("hex");
}

/**
 * Attach utility methods to an AppCompose-compatible object
 *
 * @example
 * ```typescript
 * const compose = withComposeMethods(rawCompose);
 * console.log(compose.getHash());
 * console.log(compose.dump());
 * ```
 */
export function withComposeMethods<T extends Record<string, unknown>>(compose: T) {
  // Type assertion is safe because getComposeHash/dumpAppCompose handle any object structure
  const appCompose = compose as unknown as AppCompose;
  return {
    ...compose,
    getHash: () => getComposeHash(appCompose),
    toString: () => dumpAppCompose(preprocessAppCompose(appCompose)),
  };
}

export type AppComposeWithMethods = ReturnType<typeof withComposeMethods>;
