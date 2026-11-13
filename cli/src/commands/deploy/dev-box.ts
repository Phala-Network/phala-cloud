/**
 * `phala deploy --dev-os` compose rewriting for dstack 0.6 and newer.
 *
 * Older dstack releases ship a dev OS image with sshd built in, so `--dev-os`
 * only had to ask the backend to pick that image (`prefer_dev`). dstack 0.6
 * dropped the dev image: SSH access now comes from a `dev-box` container that
 * joins the app's docker compose, runs sshd on port 22 and shares the host
 * PID, network and UTS namespaces. That keeps the existing
 * `<app-id>-22.<gateway>` connection path working, so `phala ssh` and
 * `phala cp` are unaffected.
 *
 * Everything here is pure: the OS image catalog is fetched by the caller and
 * passed in.
 *
 * Reading and writing are deliberately separate. Deciding whether a compose
 * already carries a dev box works on the *parsed* YAML, so anchors, merge keys,
 * flow mappings, inline comments and the `True`/`yes` boolean spellings the
 * backend's PyYAML accepts are all understood the same way the backend
 * understands them. Writing (adding the service) still edits the text at the
 * two places it changes — the end of the top-level `services` mapping and the
 * top-level `volumes` mapping — so the user's comments, anchors and formatting
 * survive deployment.
 */

import { parse } from "yaml";

/**
 * Marks a service as the dev box. The backend detects the dev box from these
 * four keys alone, so the CLI refuses to author anything it would read
 * differently.
 *
 * `privileged` is the one YAML boolean among them: only a boolean `true`
 * counts, never the quoted string `"true"`. The other three are the string
 * `host`.
 */
const DEV_BOX_MARKERS: ReadonlyArray<readonly [string, boolean | string]> = [
	["privileged", true],
	["pid", "host"],
	["network_mode", "host"],
	["uts", "host"],
];

export const DEV_BOX_SERVICE_NAME = "dev-box";
const DEV_BOX_IMAGE_REPOSITORY = "ghcr.io/dstack-tee/dstack-dev-box";
export const DEV_BOX_IMAGE = `${DEV_BOX_IMAGE_REPOSITORY}:sha-7725235@sha256:0dc661ea51fcbd70007d117b9e60883d9a96bac510a80683f5bdd6b7947b0291`;

/**
 * The image references a compose must use to count as the CLI's dev box.
 *
 * Exact match on purpose: a tag or digest of the same repository points at a
 * build this CLI has not chosen, and the dev box is the container that grants
 * SSH access to the whole host. When the injection pin above moves, update this
 * list in the same commit.
 */
const DEV_BOX_IMAGE_PINS: readonly string[] = [DEV_BOX_IMAGE];

/** The env var the dev box's entrypoint merges the user_config keys with. */
const DEV_BOX_ENV_KEY = "SSH_AUTHORIZED_KEYS";

/**
 * Named volumes the dev box owns, as `[name, mount path]`. They keep host keys
 * and `/root` across redeploys, so a compose that already uses either name for
 * something else cannot host a dev box.
 */
const DEV_BOX_NAMED_VOLUMES: ReadonlyArray<readonly [string, string]> = [
	["ssh-host-keys", "/etc/ssh/host-keys"],
	["home", "/root"],
];

const DEV_BOX_VOLUME_NAMES = DEV_BOX_NAMED_VOLUMES.map(([name]) => name);

/**
 * Required mounts, as `[source, target]`. The dev box reads the host's
 * filesystem and keeps its host keys and `/root` on named volumes, so a
 * service without them cannot be the SSH server the platform relies on.
 */
const DEV_BOX_REQUIRED_MOUNTS: ReadonlyArray<readonly [string, string]> = [
	["/", "/host"],
	["ssh-host-keys", "/etc/ssh/host-keys"],
	["home", "/root"],
];

/**
 * Fields that replace or delay the entrypoint, or park the service behind a
 * profile. `entrypoint` is stricter than the other two: in compose an empty
 * entrypoint replaces the image's and runs nothing, so only "absent" counts as
 * unset there.
 */
const DEV_BOX_DISQUALIFYING_FIELDS = ["command", "profiles"] as const;

const DEFAULT_INDENT_STEP = 2;

/** dstack release that replaced the dev OS image with the dev-box container. */
const DEV_BOX_MIN_VERSION: readonly number[] = [0, 6, 0];

export const OS_IMAGES_HINT =
	"Run `phala os-images` to list the available images and pass one with --image <slug>.";

export type DevOsMode = "dev-box" | "dev-image";

/** The fields of `GET /os-images` that decide how `--dev-os` is satisfied. */
export interface OsImageCatalogEntry {
	readonly name: string;
	readonly slug: string;
	readonly version: string;
	readonly is_dev: boolean;
	readonly os_image_hash: string | null;
}

/** How a deployment satisfies `--dev-os`, and with which image. */
export interface DevOsPlan {
	readonly mode: DevOsMode;
	/**
	 * The OS image to send. Below dstack 0.6 this is the dev variant of the
	 * requested release, because sshd comes from the image itself; otherwise the
	 * image the caller asked for. Undefined when the plan only repeats a recorded
	 * choice and the caller's own image stands.
	 */
	readonly image?: string;
}

/**
 * Parse an OS image release such as `0.5.7`, `0.5.4.1` or `0.6.0-rc1` into
 * comparable parts. Returns undefined when the value carries no release, which
 * is a catalog problem rather than a user choice.
 */
export function parseImageVersion(
	release: string | undefined,
): number[] | undefined {
	if (!release) return undefined;
	const match =
		/(\d+)\.(\d+)\.(\d+)/.exec(release) ?? /(\d+)\.(\d+)/.exec(release);
	if (!match) return undefined;
	return [Number(match[1]), Number(match[2]), Number(match[3] ?? 0)];
}

function compareVersions(left: number[], right: readonly number[]): number {
	const length = Math.max(left.length, right.length);
	for (let i = 0; i < length; i += 1) {
		const difference = (left[i] ?? 0) - (right[i] ?? 0);
		if (difference !== 0) return difference;
	}
	return 0;
}

/** Whether an image reference names the dev-box repository, on any tag. */
function usesDevBoxRepository(image: unknown): boolean {
	if (typeof image !== "string") return false;
	const value = image.trim();
	return (
		value === DEV_BOX_IMAGE_REPOSITORY ||
		value.startsWith(`${DEV_BOX_IMAGE_REPOSITORY}:`) ||
		value.startsWith(`${DEV_BOX_IMAGE_REPOSITORY}@`)
	);
}

/** Whether an image reference is exactly one of the pins the CLI injects. */
function isPinnedDevBoxImage(image: unknown): boolean {
	return typeof image === "string" && DEV_BOX_IMAGE_PINS.includes(image.trim());
}

/** Catalog naming for a dev OS image: `dev-0.5.7`, `dstack-dev-0.5.7`. */
const DEV_IMAGE_NAME = /(^|[-_.])dev([-_.]|$)/i;

/** Whether a catalog entry ships a dev OS image (sshd built in). */
function isDevImage(entry: OsImageCatalogEntry): boolean {
	return (
		entry.is_dev ||
		DEV_IMAGE_NAME.test(entry.name) ||
		DEV_IMAGE_NAME.test(entry.slug)
	);
}

/**
 * Find the catalog entry an `--image` value names. The backend identifies an
 * image by slug, and accepts a name or an image hash when resolving an
 * existing CVM, so all three forms are tried here.
 */
export function findOsImage(
	catalog: readonly OsImageCatalogEntry[],
	identifier: string,
): OsImageCatalogEntry | undefined {
	const matches = (predicate: (entry: OsImageCatalogEntry) => boolean) => {
		const found = catalog.filter(predicate);
		return found.length === 1 ? found[0] : undefined;
	};
	return (
		matches((entry) => entry.slug === identifier) ??
		matches((entry) => entry.name === identifier) ??
		matches((entry) => entry.os_image_hash === identifier)
	);
}

/**
 * Require the image `--dev-os` needs before anything is fetched from the API.
 * An unpinned image would leave the release unknown, and a guess would deploy
 * the wrong SSH setup.
 */
export function requireDevOsImage(identifier: string | undefined): string {
	if (!identifier) {
		throw new Error(
			`--dev-os needs an explicit OS image so its dstack release is known. ${OS_IMAGES_HINT}`,
		);
	}
	return identifier;
}

/**
 * The dev OS images of the same dstack release.
 *
 * Below dstack 0.6 sshd lives in the image, so `--dev-os` cannot be satisfied
 * by a production image of that release. The catalog marks the dev variants
 * with `is_dev`; older rows only carry it in the name.
 */
function findDevImageVariants(
	catalog: readonly OsImageCatalogEntry[],
	image: OsImageCatalogEntry,
): OsImageCatalogEntry[] {
	const version = parseImageVersion(image.version);
	if (!version) return [];
	return catalog.filter(
		(entry) =>
			entry.slug !== image.slug &&
			isDevImage(entry) &&
			compareVersions(parseImageVersion(entry.version) ?? [], version) === 0,
	);
}

/**
 * Decide how `--dev-os` is satisfied for the OS image the user pinned.
 *
 * The release decides it, never a guess: an image that is not in the catalog
 * would leave the CLI unable to tell whether to prefer a dev image or to inject
 * the dev box, and guessing 0.6 silently produces a CVM with the wrong SSH
 * setup.
 *
 * Below 0.6 the plan also resolves the *image*. The backend ignores
 * `prefer_dev` when the request names an image, so passing a production image
 * of a release that has a dev variant would deploy a CVM with no sshd at all.
 */
export function resolveDevOsPlan(
	identifier: string | undefined,
	catalog: readonly OsImageCatalogEntry[],
): DevOsPlan {
	const requested = requireDevOsImage(identifier);
	const image = findOsImage(catalog, requested);
	if (!image) {
		throw new Error(
			`--dev-os cannot tell which dstack release the OS image "${requested}" is: it is not in the OS image catalog. ${OS_IMAGES_HINT}`,
		);
	}

	const version = parseImageVersion(image.version);
	if (!version) {
		throw new Error(
			`OS image "${requested}" has no recognizable dstack release (version "${image.version}").`,
		);
	}

	if (compareVersions(version, DEV_BOX_MIN_VERSION) >= 0) {
		return { mode: "dev-box", image: requested };
	}

	if (isDevImage(image)) {
		return { mode: "dev-image", image: requested };
	}

	const variants = findDevImageVariants(catalog, image);
	if (variants.length === 1) {
		return {
			mode: "dev-image",
			image: (variants[0] as OsImageCatalogEntry).slug,
		};
	}
	if (variants.length > 1) {
		throw new Error(
			`--dev-os cannot pick the dev OS image for "${requested}": the catalog holds ${variants.length} dev variants of dstack ${image.version} (${variants.map((entry) => entry.slug).join(", ")}). ${OS_IMAGES_HINT}`,
		);
	}
	throw new Error(
		`--dev-os cannot use the OS image "${requested}": dstack releases below 0.6 take SSH from a dev OS image, and the catalog has no dev variant of "${image.version}". ${OS_IMAGES_HINT}`,
	);
}

/** A parsed YAML mapping. */
type YamlMapping = Record<string, unknown>;

function asMapping(value: unknown): YamlMapping | undefined {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return undefined;
	}
	return value as YamlMapping;
}

/**
 * Parse a compose file the way the backend does.
 *
 * `version: "1.1"` matches the PyYAML SafeLoader behind the backend's detector:
 * `privileged: yes` is a boolean there and must be one here too. `merge: true`
 * resolves `<<` keys, so a dev box declared through an anchor or an alias is
 * visible instead of looking like an ordinary service. `uniqueKeys: false`
 * keeps a repeated key readable (the last one wins), which is what PyYAML does;
 * refusing those files would reject composes the backend accepts.
 *
 * Throws on YAML the parser rejects; callers decide whether that refusal is
 * fatal (a write) or means "no dev box" (detection).
 */
function parseCompose(composeYaml: string): unknown {
	return parse(composeYaml, {
		version: "1.1",
		merge: true,
		uniqueKeys: false,
	});
}

/** The services of a compose, or undefined when the section is not a mapping. */
function composeServices(composeYaml: string): YamlMapping | undefined {
	const root = asMapping(parseCompose(composeYaml));
	return root ? asMapping(root.services) : undefined;
}

/** Text of a scalar, trimmed; empty for anything else. */
function textValue(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

/** Whether a service field says nothing: absent, null, blank or empty collection. */
function isBlank(value: unknown): boolean {
	if (value == null) return true;
	if (typeof value === "string") return value.trim() === "";
	if (Array.isArray(value)) return value.length === 0;
	const mapping = asMapping(value);
	return mapping !== undefined && Object.keys(mapping).length === 0;
}

/**
 * Whether an `entrypoint` is unset.
 *
 * Only absent or null. `entrypoint: []` and `entrypoint: ""` replace the
 * image's entrypoint with nothing, which leaves no sshd running, so they are
 * not the dev box however many markers the service carries.
 */
function isEntrypointUnset(value: unknown): boolean {
	return value == null;
}

/** Whether a service carries every dev-box marker. */
function hasDevBoxMarkers(service: YamlMapping): boolean {
	return DEV_BOX_MARKERS.every(([key, expected]) =>
		typeof expected === "boolean"
			? service[key] === true
			: service[key] === expected,
	);
}

/**
 * The whole `SSH_AUTHORIZED_KEYS` value, when it passes the platform keys
 * through: `$DSTACK_AUTHORIZED_KEYS`, `${DSTACK_AUTHORIZED_KEYS}`, or either
 * default form (`${DSTACK_AUTHORIZED_KEYS:-...}` / `${DSTACK_AUTHORIZED_KEYS-...}`).
 *
 * Anchored on purpose, and deliberately narrow — it mirrors the launch form's
 * `bindsAuthorizedKeys`:
 * - `:+` / `+` substitute an *alternate* value when the variable is set, so
 *   `${DSTACK_AUTHORIZED_KEYS:+x}` hands sshd `x` instead of the keys;
 * - `:?` / `?` make the expansion *fail* when the variable is unset, and a
 *   deployment whose keys come from `user_config` only leaves it unset, so the
 *   container would not start at all — it never falls back to those keys;
 * - `$${...}` is compose's escape for a literal `$`, so nothing is expanded;
 * - any prefix or suffix (`prefix${...}`, `${...}suffix`) makes the variable
 *   part of a larger string, which is not a key list any more;
 * - the default itself may not contain braces: nested expressions are not
 *   resolved here, and a default that may contain `}` can smuggle a suffix past
 *   the closing brace (`${DSTACK_AUTHORIZED_KEYS:-}suffix}`).
 */
const AUTHORIZED_KEYS_REFERENCE =
	/^\$(?:DSTACK_AUTHORIZED_KEYS|\{DSTACK_AUTHORIZED_KEYS(?::?-[^{}]*)?\})$/;

/**
 * A service's `environment`, in list or mapping form, as name/value pairs.
 *
 * The value is null when the entry only names a variable (`KEY:` in a mapping,
 * a bare `KEY` in a list), which compose fills from the host environment — no
 * binding of its own.
 */
function serviceEnvironment(
	service: YamlMapping,
): Array<{ name: string; value: string | null }> {
	const environment = service.environment;
	const mapping = asMapping(environment);
	if (mapping) {
		return Object.entries(mapping).map(([name, value]) => ({
			name: name.trim(),
			value: typeof value === "string" ? value.trim() : null,
		}));
	}
	if (!Array.isArray(environment)) return [];
	return environment.map((entry) => {
		const text = typeof entry === "string" ? entry : "";
		const separator = text.indexOf("=");
		if (separator < 0) return { name: text.trim(), value: null };
		return {
			name: text.slice(0, separator).trim(),
			value: text.slice(separator + 1).trim(),
		};
	});
}

/**
 * Whether the dev box's env actually delivers the platform's key variable.
 *
 * The name alone is not a binding: `SSH_AUTHORIZED_KEYS=` and
 * `SSH_AUTHORIZED_KEYS=${SOME_OTHER_VAR}` both declare it and hand sshd
 * nothing, so a service carrying either is not the box this platform relies on
 * — it is refused, never skipped as if it were canonical. The whole value has
 * to be the variable; see `AUTHORIZED_KEYS_REFERENCE`.
 */
function bindsAuthorizedKeys(service: YamlMapping): boolean {
	return serviceEnvironment(service).some(
		(entry) =>
			entry.name === DEV_BOX_ENV_KEY &&
			entry.value !== null &&
			AUTHORIZED_KEYS_REFERENCE.test(entry.value),
	);
}

/** A service's volume mounts, short (`src:dst[:opts]`) or long syntax. */
function serviceMounts(service: YamlMapping): Array<{
	source: string;
	target: string;
}> {
	const volumes = service.volumes;
	if (!Array.isArray(volumes)) return [];
	const mounts: Array<{ source: string; target: string }> = [];
	for (const volume of volumes) {
		if (typeof volume === "string") {
			const [source = "", target = ""] = volume.split(":");
			mounts.push({ source: source.trim(), target: target.trim() });
			continue;
		}
		const mount = asMapping(volume);
		if (!mount) continue;
		mounts.push({
			source: textValue(mount.source),
			target: textValue(mount.target),
		});
	}
	return mounts;
}

/**
 * Whether a service is the dev box the platform can rely on.
 *
 * The marks: the exact image this CLI injects, all four markers, nothing that
 * replaces or delays the entrypoint (`command`, `profiles`, `entrypoint`), an
 * `SSH_AUTHORIZED_KEYS` value that is the platform variable and nothing else
 * (see `bindsAuthorizedKeys`), and every mount the SSH server reads keys from.
 *
 * The launch form's `isPlatformDevBox` checks the same fields but treats an
 * empty `entrypoint` as unset; compose does not, so this one does not either.
 */
export function isCanonicalDevBoxService(service: unknown): boolean {
	const mapping = asMapping(service);
	if (!mapping) return false;
	if (!isPinnedDevBoxImage(mapping.image)) return false;
	if (!hasDevBoxMarkers(mapping)) return false;
	if (!isEntrypointUnset(mapping.entrypoint)) return false;
	for (const field of DEV_BOX_DISQUALIFYING_FIELDS) {
		if (!isBlank(mapping[field])) return false;
	}
	if (!bindsAuthorizedKeys(mapping)) return false;
	const mounts = serviceMounts(mapping);
	return DEV_BOX_REQUIRED_MOUNTS.every(([source, target]) =>
		mounts.some((mount) => mount.source === source && mount.target === target),
	);
}

/** Whether any service in the compose is the canonical dev box. */
function hasCanonicalDevBox(services: YamlMapping): boolean {
	return Object.values(services).some(isCanonicalDevBoxService);
}

/**
 * Whether the compose already declares a usable dev box service.
 *
 * Detection never breaks a write path: a file the parser rejects (or that has
 * no `services` mapping) simply has no dev box. Injection is the one place that
 * reports those files, and it does so with a readable error.
 */
export function composeHasDevBox(composeYaml: string): boolean {
	try {
		const services = composeServices(composeYaml);
		return services ? hasCanonicalDevBox(services) : false;
	} catch {
		return false;
	}
}

/**
 * The compose an argument holds.
 *
 * `--app-compose` passes a whole AppCompose JSON document, whose compose lives
 * in `docker_compose_file`; every other argument is the compose itself. Trying
 * JSON first is safe: a compose that happens to be valid JSON but carries no
 * `docker_compose_file` comes back unchanged.
 */
export function unwrapAppCompose(payload: string): string {
	let parsed: unknown;
	try {
		parsed = JSON.parse(payload);
	} catch {
		return payload;
	}
	const compose = asMapping(parsed)?.docker_compose_file;
	return typeof compose === "string" ? compose : payload;
}

/**
 * Whether a payload ships a dev box, on the backend's own rule.
 *
 * The backend grants SSH access on the four markers alone (see
 * `teehouse/cvms/dev_box.py`): any service with `privileged: true` and the
 * three `host` namespaces, whatever its image, volume names or environment.
 * The markers are the claim about SSH access, so they decide the key channel;
 * `composeHasDevBox` above is the narrower question — can the CLI treat a
 * service as the box it injects — and stays strict.
 *
 * Accepts an AppCompose JSON document as well as a compose file.
 */
export function composeHasDevBoxMarkers(payload: string): boolean {
	try {
		const services = composeServices(unwrapAppCompose(payload));
		if (!services) return false;
		return Object.values(services).some((service) => {
			const mapping = asMapping(service);
			return mapping !== undefined && hasDevBoxMarkers(mapping);
		});
	} catch {
		return false;
	}
}

/**
 * Refuse a compose the CLI cannot extend unambiguously, and report whether it
 * already carries a canonical dev box (nothing left to do then).
 *
 * Only a service that is already a canonical dev box is accepted as "done".
 * Anything close to it — the dev-box image without the markers, the `dev-box`
 * name for something else, or the four markers on another image — is a
 * conflict: the backend would read it as the dev box, or the two boxes would
 * fight over the same host network and volume names.
 */
function checkDevBoxCompose(composeYaml: string): boolean {
	let services: YamlMapping | undefined;
	try {
		services = composeServices(composeYaml);
	} catch (error) {
		throw new Error(
			`Cannot add the dev box to this docker compose file: it is not valid YAML. ${error instanceof Error ? error.message : String(error)}`,
		);
	}
	if (!services) {
		throw new Error(
			"Cannot add the dev box to this docker compose file: it has no top-level services section.",
		);
	}
	if (hasCanonicalDevBox(services)) return true;

	const markers = DEV_BOX_MARKERS.map(
		([key, value]) => `${key}: ${value}`,
	).join(", ");
	for (const [name, service] of Object.entries(services)) {
		const mapping = asMapping(service) ?? {};
		if (usesDevBoxRepository(mapping.image)) {
			throw new Error(
				`Service "${name}" uses the dev-box image but is not configured as the dev box. Set ${markers} on it, or rename it.`,
			);
		}
		if (name === DEV_BOX_SERVICE_NAME) {
			throw new Error(
				`Service "${name}" is not a dev box: it must use the image ${DEV_BOX_IMAGE}. Rename it, or make it the dev box.`,
			);
		}
		if (hasDevBoxMarkers(mapping)) {
			throw new Error(
				`Service "${name}" already sets ${markers}, which Phala Cloud reads as the dev box. Remove those keys from it, or use the image ${DEV_BOX_IMAGE}.`,
			);
		}
	}
	return false;
}

/* ------------------------------------------------------------------------- *
 * Text editing: everything below only runs on a compose that needs the dev box
 * added, and only touches the two places described at the top of the file.
 * ------------------------------------------------------------------------- */

interface BlockSpan {
	/** Index of the line that opens the block (`key:`). */
	readonly keyIndex: number;
	/** Exclusive index of the block's last line. */
	readonly endIndex: number;
	/** Indentation of the block's direct children; undefined when it has none. */
	readonly childIndent: number | undefined;
}

interface ServiceBlock extends BlockSpan {
	readonly name: string;
}

const TOP_LEVEL_KEY = /^["']?([A-Za-z0-9_.-]+)["']?:(.*)$/;
const PROPERTY = /^["']?([A-Za-z0-9_.-]+)["']?\s*:\s*(.*)$/;

function indentOf(line: string): number {
	let count = 0;
	while (line[count] === " ") count += 1;
	return count;
}

function isContentLine(line: string): boolean {
	const text = line.trim();
	return text !== "" && !text.startsWith("#");
}

function splitLines(composeYaml: string): { lines: string[]; eol: string } {
	return {
		lines: composeYaml.split(/\r?\n/),
		eol: composeYaml.includes("\r\n") ? "\r\n" : "\n",
	};
}

function shallowestIndent(
	lines: string[],
	from: number,
	to: number,
): number | undefined {
	let indent: number | undefined;
	for (let i = from; i < to; i += 1) {
		if (!isContentLine(lines[i])) continue;
		const current = indentOf(lines[i]);
		if (indent === undefined || current < indent) indent = current;
	}
	return indent;
}

function findTopLevelBlock(
	lines: string[],
	key: string,
): BlockSpan | undefined {
	const keyIndex = lines.findIndex((line) => {
		if (indentOf(line) !== 0 || !isContentLine(line)) return false;
		return TOP_LEVEL_KEY.exec(line)?.[1] === key;
	});
	if (keyIndex === -1) return undefined;

	// A block can open with an anchor or a tag (`services: &all`) and still be
	// block style; only the rest of the line decides.
	const rest = (TOP_LEVEL_KEY.exec(lines[keyIndex])?.[2] ?? "")
		.trim()
		.replace(/^&\S*/, "")
		.replace(/^!\S*/, "")
		.trim();
	if (rest !== "" && !rest.startsWith("#")) {
		throw new Error(
			`Cannot add the dev box to this docker compose file: its "${key}" section is written inline. Rewrite that section in block style, or add the dev-box service by hand.`,
		);
	}

	let endIndex = lines.length;
	for (let i = keyIndex + 1; i < lines.length; i += 1) {
		if (indentOf(lines[i]) !== 0 || !isContentLine(lines[i])) continue;
		endIndex = i;
		break;
	}

	return {
		keyIndex,
		endIndex,
		childIndent: shallowestIndent(lines, keyIndex + 1, endIndex),
	};
}

function listServices(lines: string[], services: BlockSpan): ServiceBlock[] {
	const serviceIndent = services.childIndent;
	if (serviceIndent === undefined) return [];

	const starts: number[] = [];
	for (let i = services.keyIndex + 1; i < services.endIndex; i += 1) {
		if (isContentLine(lines[i]) && indentOf(lines[i]) === serviceIndent) {
			starts.push(i);
		}
	}

	return starts.map((start, position) => {
		const endIndex =
			position + 1 < starts.length
				? (starts[position + 1] as number)
				: services.endIndex;
		return {
			name: PROPERTY.exec(lines[start].trim())?.[1] ?? lines[start].trim(),
			keyIndex: start,
			endIndex,
			childIndent: shallowestIndent(lines, start + 1, endIndex),
		};
	});
}

function indentStep(lines: string[], services: BlockSpan): number {
	const serviceIndent = services.childIndent;
	if (serviceIndent === undefined) return DEFAULT_INDENT_STEP;
	for (const service of listServices(lines, services)) {
		const propertyIndent = service.childIndent;
		if (propertyIndent !== undefined && propertyIndent > serviceIndent) {
			return propertyIndent - serviceIndent;
		}
	}
	return DEFAULT_INDENT_STEP;
}

function devBoxServiceLines(serviceIndent: number, step: number): string[] {
	const namePad = " ".repeat(serviceIndent);
	const propertyPad = " ".repeat(serviceIndent + step);
	const itemPad = " ".repeat(serviceIndent + step + step);
	return [
		`${namePad}${DEV_BOX_SERVICE_NAME}:`,
		`${propertyPad}image: ${DEV_BOX_IMAGE}`,
		`${propertyPad}restart: unless-stopped`,
		...DEV_BOX_MARKERS.map(([key, value]) => `${propertyPad}${key}: ${value}`),
		`${propertyPad}environment:`,
		`${itemPad}- ${DEV_BOX_ENV_KEY}=\${DSTACK_AUTHORIZED_KEYS}`,
		`${propertyPad}volumes:`,
		`${itemPad}- /:/host:rslave`,
		`${itemPad}- /var/run/docker.sock:/var/run/docker.sock`,
		`${itemPad}- /dev/pts:/dev/pts`,
		...DEV_BOX_NAMED_VOLUMES.map(
			([name, mount]) => `${itemPad}- ${name}:${mount}`,
		),
	];
}

function lastContentIndex(lines: string[], from: number, to: number): number {
	for (let i = to - 1; i >= from; i -= 1) {
		if (isContentLine(lines[i])) return i;
	}
	return from - 1;
}

function insertLines(
	lines: string[],
	index: number,
	block: string[],
): string[] {
	return [...lines.slice(0, index), ...block, ...lines.slice(index)];
}

/**
 * The top-level volume names a compose declares, after merge keys and anchors
 * are resolved.
 *
 * Reading them from the parsed document rather than from the text is what keeps
 * a merge inherited definition safe: `volumes: {<<: *storage}` owns every name
 * `storage` brings with it, and appending a bare `home:` beside the merge would
 * silently replace the operator's volume with an empty default one.
 */
function declaredVolumeNames(composeYaml: string): string[] {
	const root = asMapping(parseCompose(composeYaml));
	const volumes = root?.volumes;
	if (volumes === undefined || volumes === null) return [];
	const mapping = asMapping(volumes);
	if (!mapping) {
		throw new Error(
			'Cannot add the dev box to this docker compose file: its "volumes" section is not a mapping. Rewrite it in block style, or add the dev-box volumes by hand.',
		);
	}
	return Object.keys(mapping);
}

/**
 * Add a top-level `volumes` section holding the two named volumes the dev box
 * mounts. A compose that already uses either name would hand the dev box
 * somebody else's data, so that is a conflict rather than a merge.
 */
function addDevBoxVolumes(composeYaml: string, lines: string[]): string[] {
	const declared = declaredVolumeNames(composeYaml);
	const conflict = DEV_BOX_VOLUME_NAMES.find((name) => declared.includes(name));
	if (conflict !== undefined) {
		throw new Error(
			`The compose already declares a top-level volume named "${conflict}", which the dev box needs for its own data. Rename it before deploying with --dev-os.`,
		);
	}

	const volumes = findTopLevelBlock(lines, "volumes");
	if (!volumes) {
		const block = [
			"volumes:",
			...DEV_BOX_VOLUME_NAMES.map((name) => `  ${name}:`),
		];
		const insertAt = lastContentIndex(lines, 0, lines.length) + 1;
		return insertLines(lines, insertAt, block);
	}

	const block = DEV_BOX_VOLUME_NAMES.map(
		(name) =>
			`${" ".repeat(volumes.childIndent ?? DEFAULT_INDENT_STEP)}${name}:`,
	);
	const insertAt =
		volumes.childIndent === undefined
			? volumes.keyIndex + 1
			: lastContentIndex(lines, volumes.keyIndex + 1, volumes.endIndex) + 1;
	return insertLines(lines, insertAt, block);
}

/**
 * Return the compose with the canonical dev box service added.
 *
 * Idempotent: a compose that already carries a canonical dev box is returned
 * untouched, however it was written (anchors, merge keys and flow mappings
 * included). Anything the CLI would have to overwrite or guess about throws
 * instead, and so does YAML the parser rejects — a compose the CLI cannot read
 * is never a compose to add a second dev box to.
 */
export function injectDevBoxService(composeYaml: string): string {
	if (checkDevBoxCompose(composeYaml)) return composeYaml;

	const { lines, eol } = splitLines(composeYaml);
	if (findTopLevelBlock(lines, "services") === undefined) {
		throw new Error(
			"Cannot add the dev box to this docker compose file: it has no top-level services section.",
		);
	}

	const withVolumes = addDevBoxVolumes(composeYaml, lines);
	const services = findTopLevelBlock(withVolumes, "services");
	if (services === undefined) {
		throw new Error(
			"Cannot add the dev box to this docker compose file: it has no top-level services section.",
		);
	}
	const step = indentStep(withVolumes, services);
	const block = devBoxServiceLines(
		services.childIndent ?? DEFAULT_INDENT_STEP,
		step,
	);
	const insertAt =
		lastContentIndex(withVolumes, services.keyIndex + 1, services.endIndex) + 1;
	return insertLines(withVolumes, insertAt, block).join(eol);
}
