# phala simulator

TEE simulator for local development

## Usage

```
phala simulator [subcommand] [options]
```

Running `phala simulator` without subcommands shows the current status.

## Subcommands

### simulator start

Start the TEE simulator

#### Options

| Flag        | Short | Default | Description                   |
| ----------- | ----- | ------- | ----------------------------- |
| `--port`    | `-p`  | 8090    | Port number for the simulator |
| `--verbose` | `-v`  | false   | Enable verbose logging        |

#### Examples

```bash
$ phala simulator start
$ phala simulator start -p 9000
$ phala simulator start -p 9000 --verbose
```

### simulator stop

Stop the TEE simulator

#### Examples

```bash
$ phala simulator stop
```

## Environment Variables

When the simulator is running, set these environment variables to connect your application:

```bash
export DSTACK_SIMULATOR_ENDPOINT=/path/to/dstack.sock
export TAPPD_SIMULATOR_ENDPOINT=/path/to/tappd.sock
```
