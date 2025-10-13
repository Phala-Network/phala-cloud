Your task is to build an e2e test of the cloud CLI.

It should test the core features:

- Auth: check user info, level, etc
- Deploy new CVM (use "phala deploy")
- Update Code in CVM (use "phala deploy")
- Resize (1 vCPU to 2 vCPU, 20G disk to 40G disk)
- Power: stop, power off, restart, start
- Check logs
- Check exposed port
- There are available nodes
- dstack API is good

While developing the e2e test, you should also take care of the developer user journey:

- Is the current design good enough?
- Broken feature?
- Inconsistent copywriting / behavior?

Requirements:

- Make sure it's easy to add additional test logic in the future.
- Preserve throughout test logs for future audit
- Build a simple testing docker image to deploy and update 

Resources:

- API key: phak_F4noxZsVgi4pPgIBsQwDR_33JKdZlNuj9UkDips8oik
- Ask deepwiki for questions (Phala-Network/phala-cloud)
- Use "SearchPhala" to read Phala Cloud docs via MCP






