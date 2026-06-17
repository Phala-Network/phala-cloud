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
  manifest_version?: number;
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

export function preprocessAppCompose(dic: AppCompose): AppCompose {
  const obj: AppCompose = { ...dic };
  if (obj.runner === "bash" && "docker_compose_file" in obj) {
    delete obj.docker_compose_file;
  } else if (obj.runner === "docker-compose" && "bash_script" in obj) {
    delete obj.bash_script;
  }
  if ("pre_launch_script" in obj && !obj.pre_launch_script) {
    delete obj.pre_launch_script;
  }
  return obj;
}

export function dumpAppCompose(dic: AppCompose): string {
  const ordered = sortObject(dic);
  let json = JSON.stringify(ordered, null, 4);
  json = json.replace(/": /g, '":');
  return json;
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
