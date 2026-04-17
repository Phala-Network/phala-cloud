export type TableColumn = string;

// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape sequences require ESC (0x1b)
const ANSI_RE = /\x1b\[[0-9;]*m/g;
const visibleLength = (value: string): number =>
	value.replace(ANSI_RE, "").length;
const padCell = (value: string, width: number): string =>
	value + " ".repeat(Math.max(0, width - visibleLength(value)));

export function printTable(
	columns: readonly TableColumn[],
	rows: readonly Record<TableColumn, string>[],
): void {
	const widths: Record<string, number> = {};
	for (const col of columns) {
		widths[col] = col.length;
		for (const row of rows) {
			widths[col] = Math.max(widths[col], visibleLength(row[col] ?? ""));
		}
	}

	const formatRow = (values: Record<string, string>) =>
		columns.map((col) => padCell(values[col] ?? "", widths[col])).join("  ");

	// header
	console.log(formatRow(Object.fromEntries(columns.map((c) => [c, c]))));
	for (const row of rows) {
		console.log(formatRow(row));
	}
}
