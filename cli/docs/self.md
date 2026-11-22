# phala self

CLI self-management

## Usage

```
phala self <subcommand> [options]
```

## Subcommands

### self update

Update the Phala CLI to the latest version

#### Options

| Flag                | Short | Default     | Description                                        |
| ------------------- | ----- | ----------- | -------------------------------------------------- |
| `--json`            | `-j`  | false       | Output result in JSON format                       |
| `--yes`             | `-y`  | false       | Skip confirmation prompt                           |
| `--dry-run`         |       | false       | Print update command without executing             |
| `--package-manager` |       | auto-detect | Override package manager (npm, pnpm, yarn, bun)    |
| `--channel`         |       | latest      | Release channel/dist-tag (e.g. latest, beta, next) |

#### Environment Variables

| Variable               | Description                                             |
| ---------------------- | ------------------------------------------------------- |
| `PHALA_UPDATE_CHANNEL` | Set the release channel (alternative to --channel flag) |

#### Examples

```bash
$ phala self update
$ phala self update --yes
$ phala self update --channel beta
$ phala self update --dry-run
$ phala self update --package-manager pnpm
$ PHALA_UPDATE_CHANNEL=beta phala self update
```
