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
 * passed in, and the compose rewrite works on text instead of parsing and
 * re-emitting it, so a user's comments, anchors and formatting survive
 * deployment. It only touches two places: the end of the top-level `services`
 * mapping and the top-level `volumes` mapping.
 */

/**
 * Marks a service as the dev box. The backend detects the dev box from these
 * four keys alone, so the CLI refuses to author anything it would read
 * differently.
 */
const DEV_BOX_MARKERS: ReadonlyArray<readonly [string, string]> = [
	["privileged", "true"],
	["pid", "host"],
	["network_mode", "host"],
	["uts", "host"],
];

export const DEV_BOX_SERVICE_NAME = "dev-box";
const DEV_BOX_IMAGE_REPOSITORY = "ghcr.io/dstack-tee/dstack-dev-box";
export const DEV_BOX_IMAGE = `${DEV_BOX_IMAGE_REPOSITORY}:latest`;

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

function isDevBoxImage(image: string | undefined): boolean {
	return (
		typeof image === "string" && image.startsWith(DEV_BOX_IMAGE_REPOSITORY)
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
 * Decide how `--dev-os` is satisfied for the OS image the user pinned.
 *
 * The release decides it, never a guess: an image that is not in the catalog
 * would leave the CLI unable to tell whether to prefer a dev image or to inject
 * the dev box, and guessing 0.6 silently produces a CVM with the wrong SSH
 * setup.
 */
export function resolveDevOsMode(
	identifier: string | undefined,
	catalog: readonly OsImageCatalogEntry[],
): DevOsMode {
	const image = findOsImage(catalog, requireDevOsImage(identifier));
	if (!image) {
		throw new Error(
			`--dev-os cannot tell which dstack release the OS image "${identifier}" is: it is not in the OS image catalog. ${OS_IMAGES_HINT}`,
		);
	}

	const version = parseImageVersion(image.version);
	if (!version) {
		throw new Error(
			`OS image "${identifier}" has no recognizable dstack release (version "${image.version}").`,
		);
	}

	return compareVersions(version, DEV_BOX_MIN_VERSION) >= 0
		? "dev-box"
		: "dev-image";
}

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
	readonly properties: ReadonlyMap<string, string>;
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

function unquote(value: string): string {
	if (value.length < 2) return value;
	const quoted =
		(value.startsWith('"') && value.endsWith('"')) ||
		(value.startsWith("'") && value.endsWith("'"));
	return quoted ? value.slice(1, -1) : value;
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

	const rest = (TOP_LEVEL_KEY.exec(lines[keyIndex])?.[2] ?? "").trim();
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

function readProperties(
	lines: string[],
	span: { from: number; to: number },
	indent: number | undefined,
): Map<string, string> {
	const properties = new Map<string, string>();
	if (indent === undefined) return properties;
	for (let i = span.from; i < span.to; i += 1) {
		if (!isContentLine(lines[i]) || indentOf(lines[i]) !== indent) continue;
		const match = PROPERTY.exec(lines[i].trim());
		if (!match) continue;
		const [, name, value] = match;
		if (!properties.has(name)) properties.set(name, unquote(value.trim()));
	}
	return properties;
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
		const propertyIndent = shallowestIndent(lines, start + 1, endIndex);
		return {
			name: PROPERTY.exec(lines[start].trim())?.[1] ?? lines[start].trim(),
			keyIndex: start,
			endIndex,
			childIndent: propertyIndent,
			properties: readProperties(
				lines,
				{ from: start + 1, to: endIndex },
				propertyIndent,
			),
		};
	});
}

function hasDevBoxMarkers(service: ServiceBlock): boolean {
	return DEV_BOX_MARKERS.every(
		([key, value]) => service.properties.get(key) === value,
	);
}

function isCanonicalDevBox(service: ServiceBlock): boolean {
	return (
		isDevBoxImage(service.properties.get("image")) && hasDevBoxMarkers(service)
	);
}

/** Whether the compose already declares a usable dev box service. */
export function composeHasDevBox(composeYaml: string): boolean {
	const { lines } = splitLines(composeYaml);
	const services = findTopLevelBlock(lines, "services");
	if (!services) return false;
	return listServices(lines, services).some(isCanonicalDevBox);
}

function requireServices(lines: string[]): BlockSpan {
	const services = findTopLevelBlock(lines, "services");
	if (!services) {
		throw new Error(
			"Cannot add the dev box to this docker compose file: it has no top-level services section.",
		);
	}
	return services;
}

/**
 * Refuse compose files the CLI cannot extend unambiguously.
 *
 * Only a service that is already a canonical dev box is accepted as "done".
 * Anything close to it — the dev-box image without the markers, the `dev-box`
 * name for something else, or the four markers on another image — is a
 * conflict: the backend would read it as the dev box, or the two boxes would
 * fight over the same host network and volume names.
 */
function assertNoDevBoxConflicts(
	lines: string[],
	services: BlockSpan,
): ServiceBlock | undefined {
	for (const service of listServices(lines, services)) {
		if (isCanonicalDevBox(service)) return service;
		if (isDevBoxImage(service.properties.get("image"))) {
			throw new Error(
				`Service "${service.name}" uses the dev-box image but is not configured as the dev box. Set ${DEV_BOX_MARKERS.map(([key, value]) => `${key}: ${value}`).join(", ")} on it, or rename it.`,
			);
		}
		if (service.name === DEV_BOX_SERVICE_NAME) {
			throw new Error(
				`Service "${service.name}" is not a dev box: it must use the image ${DEV_BOX_IMAGE}. Rename it, or make it the dev box.`,
			);
		}
		if (hasDevBoxMarkers(service)) {
			throw new Error(
				`Service "${service.name}" already sets ${DEV_BOX_MARKERS.map(([key, value]) => `${key}: ${value}`).join(", ")}, which Phala Cloud reads as the dev box. Remove those keys from it, or use the image ${DEV_BOX_IMAGE}.`,
			);
		}
	}
	return undefined;
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
		`${itemPad}- SSH_AUTHORIZED_KEYS=\${DSTACK_AUTHORIZED_KEYS}`,
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
 * Add a top-level `volumes` section holding the two named volumes the dev box
 * mounts. A compose that already uses either name would hand the dev box
 * somebody else's data, so that is a conflict rather than a merge.
 */
function addDevBoxVolumes(lines: string[]): string[] {
	const volumes = findTopLevelBlock(lines, "volumes");
	if (!volumes) {
		const block = [
			"volumes:",
			...DEV_BOX_VOLUME_NAMES.map((name) => `  ${name}:`),
		];
		const insertAt = lastContentIndex(lines, 0, lines.length) + 1;
		return insertLines(lines, insertAt, block);
	}

	const declared = readProperties(
		lines,
		{ from: volumes.keyIndex + 1, to: volumes.endIndex },
		volumes.childIndent,
	);
	const conflict = DEV_BOX_VOLUME_NAMES.find((name) => declared.has(name));
	if (conflict !== undefined) {
		throw new Error(
			`The compose already declares a top-level volume named "${conflict}", which the dev box needs for its own data. Rename it before deploying with --dev-os.`,
		);
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
 * Idempotent: a compose that already carries a canonical dev box (the dev-box
 * image with `privileged`, `pid`, `network_mode` and `uts` set to their dev-box
 * values) is returned untouched. Anything the CLI would have to overwrite or
 * guess about throws instead.
 */
export function injectDevBoxService(composeYaml: string): string {
	const { lines, eol } = splitLines(composeYaml);
	const services = requireServices(lines);
	if (assertNoDevBoxConflicts(lines, services) !== undefined) {
		return composeYaml;
	}

	const withVolumes = addDevBoxVolumes(lines);
	const mergedServices = requireServices(withVolumes);
	const step = indentStep(withVolumes, mergedServices);
	const block = devBoxServiceLines(
		mergedServices.childIndent ?? DEFAULT_INDENT_STEP,
		step,
	);
	const insertAt =
		lastContentIndex(
			withVolumes,
			mergedServices.keyIndex + 1,
			mergedServices.endIndex,
		) + 1;
	return insertLines(withVolumes, insertAt, block).join(eol);
}
