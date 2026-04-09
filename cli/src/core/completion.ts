import { globalCommandOptions } from "./common-flags";
import type { CommandRegistry } from "./registry";
import type { CommandOption, CommandPath } from "./types";

export interface CompletionContext {
	readonly registry: CommandRegistry;
	readonly line: string;
	readonly fragment: string;
	readonly before: string;
	readonly after: string;
}

export interface CompletionResult {
	readonly suggestions: string[];
}

/**
 * Generate completion suggestions for the current input
 */
export function getCompletions(context: CompletionContext): CompletionResult {
	const { registry, line, fragment } = context;

	// Parse the command line to understand context
	const tokens = line.trim().split(/\s+/);
	const executableName = tokens[0]; // e.g., "phala"

	// Remove executable name
	const commandTokens = tokens.slice(1);

	// If we're completing the first token after executable
	if (
		commandTokens.length === 0 ||
		(commandTokens.length === 1 && line.endsWith(fragment))
	) {
		return getTopLevelCompletions(registry, fragment);
	}

	// Check if we're completing flags
	if (fragment.startsWith("-")) {
		return getFlagCompletions(registry, commandTokens, fragment);
	}

	// Try to find the command path
	const commandPath: string[] = [];
	for (const token of commandTokens) {
		if (token.startsWith("-")) {
			break;
		}
		commandPath.push(token);
	}

	// Get subcommands for the current path
	return getSubcommandCompletions(registry, commandPath, fragment);
}

function getTopLevelCompletions(
	registry: CommandRegistry,
	fragment: string,
): CompletionResult {
	const children = registry.getChildren([]);
	const suggestions = children
		.map((node) => node.name)
		.filter((name): name is string => name !== null)
		.filter((name) => name.startsWith(fragment));

	return { suggestions };
}

function getSubcommandCompletions(
	registry: CommandRegistry,
	commandPath: CommandPath,
	fragment: string,
): CompletionResult {
	// Try to find the node for this path
	const node = registry.getNode(commandPath.slice(0, -1));

	if (!node) {
		return { suggestions: [] };
	}

	const children = registry.getChildren(commandPath.slice(0, -1));
	const lastFragment = commandPath[commandPath.length - 1] || fragment;

	const suggestions = children
		.map((child) => child.name)
		.filter((name): name is string => name !== null)
		.filter((name) => name.startsWith(lastFragment));

	return { suggestions };
}

function getFlagCompletions(
	registry: CommandRegistry,
	commandTokens: string[],
	fragment: string,
): CompletionResult {
	// Find the command being completed
	const commandPath: string[] = [];
	for (const token of commandTokens) {
		if (token.startsWith("-")) {
			break;
		}
		commandPath.push(token);
	}

	const node = registry.getNode(commandPath);
	if (!node?.command) {
		return {
			suggestions: collectOptionCompletions(globalCommandOptions).filter(
				(flag) => flag.startsWith(fragment),
			),
		};
	}

	const flags = Array.from(
		new Set([
			...collectOptionCompletions(globalCommandOptions),
			...collectOptionCompletions(node.command.meta.options || []),
		]),
	);

	const suggestions = flags.filter((flag) => flag.startsWith(fragment));

	return { suggestions };
}

function collectOptionCompletions(options: readonly CommandOption[]): string[] {
	const flags: string[] = [];

	for (const option of options) {
		if (option.hidden) continue;
		flags.push(`--${option.name}`);
		if (option.shorthand) {
			flags.push(`-${option.shorthand}`);
		}
		for (const alias of option.aliases ?? []) {
			flags.push(`--${alias}`);
		}
		if (option.type === "boolean" && option.negatedName) {
			flags.push(`--${option.negatedName}`);
		}
	}

	return flags;
}

/**
 * Generate shell-specific completion script
 */
export function generateCompletionScript(
	executableName: string,
	shell: "bash" | "zsh" | "fish",
	version?: string,
): string {
	switch (shell) {
		case "bash":
			return generateBashCompletion(executableName, version);
		case "zsh":
			return generateZshCompletion(executableName, version);
		case "fish":
			return generateFishCompletion(executableName, version);
	}
}

function generateBashCompletion(
	executableName: string,
	version?: string,
): string {
	const versionCheck = version
		? `
    # Version check (once per day)
    local completion_version="${version}"
    local check_file=~/."${executableName}"/completion-check
    local today=$(date +%Y%m%d)

    if [[ ! -f "$check_file" ]] || [[ "$(cat "$check_file" 2>/dev/null)" != "$today" ]]; then
        local cli_version=$(${executableName} --version 2>/dev/null | grep -oE '[0-9]+\\.[0-9]+\\.[0-9]+' | head -1)

        if [[ -n "$cli_version" ]] && [[ "$cli_version" != "$completion_version" ]]; then
            echo "" >&2
            echo "⚠️  ${executableName} completion is outdated" >&2
            echo "   CLI version: v$cli_version" >&2
            echo "   Completion version: v$completion_version" >&2
            echo "   Update with: ${executableName} completion --shell bash > ~/."${executableName}"_completion && source ~/."${executableName}"_completion" >&2
            echo "" >&2
        fi

        mkdir -p ~/."${executableName}"
        echo "$today" > "$check_file"
    fi
`
		: "";

	return `
# ${executableName} bash completion${version ? `\n# Generated for CLI version: ${version}` : ""}

_${executableName}_completions() {
    local cur="\${COMP_WORDS[COMP_CWORD]}"
    local prev="\${COMP_WORDS[COMP_CWORD-1]}"
    local line="\${COMP_LINE}"
${versionCheck}
    # Call the CLI's completion endpoint
    local completions=$( ${executableName} __complete -- "\${line}" "\${cur}" 2>/dev/null )

    COMPREPLY=( $(compgen -W "$completions" -- "$cur") )
}

complete -F _${executableName}_completions ${executableName}
`.trim();
}

function generateZshCompletion(
	executableName: string,
	version?: string,
): string {
	const versionCheck = version
		? `
    # Version check (once per day)
    local completion_version="${version}"
    local check_file=~/."${executableName}"/completion-check
    local today=$(date +%Y%m%d)

    if [[ ! -f "$check_file" ]] || [[ "$(cat "$check_file" 2>/dev/null)" != "$today" ]]; then
        local cli_version=$(${executableName} --version 2>/dev/null | grep -oE '[0-9]+\\.[0-9]+\\.[0-9]+' | head -1)

        if [[ -n "$cli_version" ]] && [[ "$cli_version" != "$completion_version" ]]; then
            echo "" >&2
            echo "⚠️  ${executableName} completion is outdated" >&2
            echo "   CLI version: v$cli_version" >&2
            echo "   Completion version: v$completion_version" >&2
            echo "   Update with: ${executableName} completion --shell zsh > ~/."${executableName}"_completion && source ~/."${executableName}"_completion" >&2
            echo "" >&2
        fi

        mkdir -p ~/."${executableName}"
        echo "$today" > "$check_file"
    fi
`
		: "";

	return `
#compdef ${executableName}${version ? `\n# Generated for CLI version: ${version}` : ""}

_${executableName}() {
    local line state
${versionCheck}
    _arguments -C \\
        "1: :->cmds" \\
        "*::arg:->args"

    case $state in
        cmds)
            local completions=$( ${executableName} __complete -- "\${words[@]}" "\${words[CURRENT]}" 2>/dev/null )
            _describe 'command' completions
            ;;
        args)
            local completions=$( ${executableName} __complete -- "\${words[@]}" "\${words[CURRENT]}" 2>/dev/null )
            _describe 'argument' completions
            ;;
    esac
}

_${executableName}
`.trim();
}

function generateFishCompletion(
	executableName: string,
	version?: string,
): string {
	const versionCheck = version
		? `
    # Version check (once per day)
    set -l completion_version "${version}"
    set -l check_file ~/."${executableName}"/completion-check
    set -l today (date +%Y%m%d)

    if not test -f $check_file; or test (cat $check_file 2>/dev/null) != $today
        set -l cli_version (${executableName} --version 2>/dev/null | grep -oE '[0-9]+\\.[0-9]+\\.[0-9]+' | head -1)

        if test -n "$cli_version"; and test "$cli_version" != "$completion_version"
            echo "" >&2
            echo "⚠️  ${executableName} completion is outdated" >&2
            echo "   CLI version: v$cli_version" >&2
            echo "   Completion version: v$completion_version" >&2
            echo "   Update with: ${executableName} completion --shell fish > ~/.config/fish/completions/${executableName}.fish" >&2
            echo "" >&2
        end

        mkdir -p ~/."${executableName}"
        echo $today > $check_file
    end
`
		: "";

	return `
# ${executableName} fish completion${version ? `\n# Generated for CLI version: ${version}` : ""}

function __${executableName}_complete
    set -l line (commandline -cp)
    set -l token (commandline -ct)
${versionCheck}
    ${executableName} __complete -- $line $token 2>/dev/null
end

complete -c ${executableName} -f -a "(__${executableName}_complete)"
`.trim();
}
