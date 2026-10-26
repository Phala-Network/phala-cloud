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
  bash_script?: string;
  pre_launch_script?: string;
}

/** Optional fields the backend omits from the hashed compose when null. */
const OMIT_WHEN_NULL = ["key_provider", "port_policy", "requirements", "swap_size"] as const;
/** Optional fields the backend omits from the hashed compose when null or empty. */
const OMIT_WHEN_EMPTY = [
  "default_gateway_domain",
  "key_provider_id",
  "pre_launch_script",
  "salt",
] as const;

/**
 * Apply the same normalization as the Phala Cloud backend before hashing:
 * drop the script field the runner does not use, and drop optional fields
 * that are null (or empty for string fields).
 */
export function preprocessAppCompose(dic: AppCompose): AppCompose {
  const obj: AppCompose = { ...dic };
  if (obj.runner === "bash") {
    delete obj.docker_compose_file;
  } else if (obj.runner === "docker-compose") {
    delete obj.bash_script;
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

export function getComposeHash(app_compose: AppCompose): string {
  const preprocessed = preprocessAppCompose(app_compose);
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
