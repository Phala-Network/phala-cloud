# phala switch

Switch between authentication profiles.

## Usage

```bash
phala switch [profile-name]
```

## Arguments

| Name           | Required | Description                                                            |
| -------------- | -------- | ---------------------------------------------------------------------- |
| `profile-name` | No       | Name of the profile to switch to. If omitted, shows interactive picker |

If no profile name is provided, shows an interactive picker.

## Examples

### Switch to specific profile

```bash
$ phala switch work
✓ Switched to profile: work
```

### Interactive profile picker

```bash
$ phala switch
? Select a profile:
  default
❯ work
  personal

✓ Switched to profile: work
```

### Verify active profile

```bash
$ phala switch work
✓ Switched to profile: work

$ phala status
✓ Authenticated as work@example.com
Profile: work
```

### Switch in scripts

```bash
#!/bin/bash
phala switch work
phala deploy -n work-app

phala switch personal
phala deploy -n personal-app
```
