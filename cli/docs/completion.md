# phala completion

Generate shell completion scripts

## Usage

```
phala completion [options]
```

## Options

| Flag      | Short | Default     | Description                           |
| --------- | ----- | ----------- | ------------------------------------- |
| `--shell` |       | auto-detect | Shell type (bash, zsh, fish)          |
| `--fig`   |       |             | Generate Fig/Amazon Q completion spec |

If `--shell` is omitted, the CLI will auto-detect the shell from the `$SHELL` environment variable.

## Examples

### Bash

```bash
$ phala completion --shell bash >> ~/.bashrc && source ~/.bashrc
```

### Zsh

```bash
$ phala completion --shell zsh >> ~/.zshrc && source ~/.zshrc
```

### Fish

```bash
$ phala completion --shell fish > ~/.config/fish/completions/phala.fish
```

### Fig/Amazon Q

```bash
$ phala completion --fig
```
