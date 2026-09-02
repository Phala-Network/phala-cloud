# Phala Cloud Responsible Disclosure

At Phala, we take the security of Phala Cloud seriously. If you believe you have found a security vulnerability in an in-scope Phala Cloud asset, please report it to us so we can investigate and remediate it.

Submit reports by email to <cert@phala.com>. Please do not open a public GitHub issue for a security report. Please do not submit product bugs, feature requests, or issues without practical security impact through this program.

This Responsible Disclosure program, Bug Bounty program, scope, and listed rewards are subject to change at any time.

## In Scope

The program covers security vulnerabilities with clear, reproducible end-to-end impact against production Phala Cloud services operated by Phala, including:

- The Phala Cloud web app and API at `cloud.phala.com` and `cloud-api.phala.com`, including login and API keys.
- Isolation between tenants, covering workspaces, accounts, and billing.
- CVM provisioning, isolation, and management on Phala's TDX and GPU TEE hosts.
- Encrypted environment variables and secret sealing.
- Attestation services Phala runs, including the Trust Center at `trust.phala.com`.
- Phala's confidential GPU inference and hosted model endpoints.
- The `phala` CLI and the JavaScript, Python, and Go SDKs in this repository.
- Other production assets that Phala explicitly announces as in scope.

Third-party and open-source code we run, including dstack, is in scope if you can show impact on Phala Cloud.

## Out of Scope

The following are out of scope unless Phala explicitly announces otherwise:

- The Phala Network blockchain: chain, parachain, runtime, pRuntime, pherry, runtime-bridge, and Phat Contract.
- Bugs in dstack or other upstream projects that you cannot show affect Phala Cloud. Report dstack bugs through the [dstack security policy](https://github.com/Dstack-TEE/dstack/blob/master/SECURITY.md).
- Hardware and firmware such as Intel TDX, NVIDIA confidential computing, and CPU side channels, unless we failed to apply a fix the vendor already shipped.
- Apps that users deploy in their own CVMs. Report those to whoever runs the app. How Phala Cloud isolates them is in scope.
- Non-production assets, such as test, staging, demo, and parked hosts, and the example templates and docs in this repository.
- Services Phala does not run, such as container registries, cloud providers, and payment processors.
- Findings without a clear, reproducible impact in production, including raw scanner output and best-practice reports with no exploit path.
- Security headers, SPF, DKIM, DMARC, DANE, CORS, clickjacking, open directories, weak ciphers, open redirect, and HTML injection, unless you can show real impact such as account takeover or token leakage.
- Rate limiting, resource exhaustion, and noisy neighbors, unless you can show real abuse or a cross-tenant break.
- Social engineering, spam, denial of service, physical attacks, and attacks against Phala employees, users, vendors, or offices.
- Duplicate reports and variants that require the same remediation as an existing report.

## Reporting Requirements

To help us evaluate your report, please include:

- The affected production asset, such as the URL, API endpoint, CVM ID, app ID, or IP address.
- A clear description of the vulnerability and its security impact.
- Reproducible steps, proof of concept, screenshots, request/response samples, or logs sufficient for us to validate the issue.
- The CLI, SDK, or CVM image version, where relevant.
- Any limits or assumptions in your testing.

A report qualifies for bounty consideration only when it demonstrates clear, reproducible end-to-end impact in production on an in-scope asset.

## Researcher Rules

When testing and reporting, please:

- Test only against your own workspace, account, and CVMs, not against other tenants.
- Do not access, download, modify, delete, or disclose data beyond what is necessary to demonstrate the vulnerability.
- Do not interrupt, degrade, or deny service to Phala systems, tenants, or users.
- Do not use social engineering, phishing, spam, physical attacks, or third-party attacks.
- Keep the vulnerability confidential until Phala has resolved it and authorized disclosure.
- Disclose any AI help you used to find, reproduce, or write up the issue, as described below.

## AI-Assisted Submissions

We follow the [Linux kernel guidelines for tool-generated content](https://www.kernel.org/doc/html/latest/process/generated-content.html). Review time is scarce, and unverified machine-generated reports burn it without producing fixes.

- This applies when a meaningful part of the report was written by a tool rather than by you: a write-up drafted by an AI, a proof of concept generated from a prompt, or a bug found by an AI assistant. It does not cover spelling, grammar, translation, or formatting help.
- Tell us which tools you used, which parts they wrote, the prompts if there were only a few, and how you checked the result.
- You must understand what you send and be able to answer our questions about it. If you cannot, do not send it.
- Reproduce the issue yourself against the affected asset and include the evidence. Do not send a bug that only a model claims is real.
- We may handle an AI-assisted report like any other, ask for more evidence, review it at a lower priority, or reject it. Expect more scrutiny the more of it was generated.
- If a report is AI-generated in a way we can tell apart from genuine human work, we reserve the right to refuse to process it, close it without detailed review, and decline it for a bounty. Repeated submissions of this kind may get you removed from the program.

## What We Promise

- We will acknowledge receipt of your report within 3 business days.
- Full technical assessment, remediation, and any bounty decision may take longer depending on complexity, severity, affected systems, and remediation requirements.
- If you follow this policy, we will not take legal action against you in regard to the report.
- We will handle your report with strict confidentiality and will not pass on your personal details to third parties without your permission.
- We will keep you informed of material progress where practical.
- We will tell you whether the report is accepted as a valid security issue or denied because it is out of scope, not reproducible, already known, or does not demonstrate qualifying security impact.
- In public information concerning the reported issue, we will credit you as the discoverer unless you prefer otherwise.
- As a token of our gratitude, we offer rewards for accepted reports of security issues that were not yet known to us. The type and amount of any reward are determined based on severity, impact, exploitability, report quality, and remediation complexity.

| Severity: | Critical | High     | Medium   | Low       |
| --------- | -------- | -------- | -------- | --------- |
|  Up to:   | $7,500   | $2,250   | $750     | $1 - $150 |

Reward amounts will be determined only at the end of remediation of the disclosed issue. Actual reward amounts may exceed $7,500 or be as low as $1. The SYSOPS / CERT Team will provide their assessment and recommendation regarding severity or regarding reward amount but the final decision is solely at the discretion of the Phala Team.

We strive to resolve valid security issues as quickly as practical and would like to play an active role in any publication of the issue after it is resolved.
