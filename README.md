# Phala Cloud

[![](https://cloud.phala.com/deploy-button.svg)](https://cloud.phala.com/templates)

Welcome to the Phala Cloud Open Source!

This space is designed for developers like you to explore, collaborate, and participate in the evolution of [Phala Cloud](https://cloud.phala.com/register?invite=PHALAWIKI). Whether you're here to submit feature requests, report bugs, share your innovative projects and tools built on [Phala Cloud](https://cloud.phala.com/register?invite=PHALAWIKI), or contribute to our documentation, you've come to the right place. This repository also hosts open source tools and SDKs for Phala Cloud.

A curated list of awesome Phala Cloud resources, tools, and templates.

## About Phala Cloud

[Phala Cloud](https://cloud.phala.com/register?invite=PHALAWIKI) is a Confidential Computing native cloud platform that offers secure and scalable computing. By leveraging Trusted Execution Environments (TEEs), Phala ensures that your applications run in a trustless environment, providing both security and privacy.

## What's in This Repository

- **CLI** (`/cli`) - Official Phala Cloud CLI tools
- **JavaScript/TypeScript SDK** (`/js`) - Official Phala Cloud API client for managing cloud resources
- **Terraform Provider** (`/terraform`) - Official Phala Cloud Terraform provider, vendored here as a git submodule from `terraform-provider-phala`
- **Documentation & Guides** (`/docs`) - Integration guides and examples  
- **Templates** (`/templates`) - Curated collection of Phala Cloud templates and prebuilt applications
- **Community Issues** - Feature requests, bug reports, and discussions

## Clone With Submodules

The Terraform provider now lives in its own repository and is included here as a git submodule.

Clone this repository with:

```bash
git clone --recurse-submodules git@github.com:Phala-Network/phala-cloud.git
```

If you already cloned it without submodules, run:

```bash
git submodule update --init --recursive
```

## Use Phala Cloud

It's easy to deploy arbitrary dockerized applications on Phala Cloud. Check the [documentation](https://docs.phala.network/overview/phala-network/phala-cloud) for more information.

Phala Cloud is built on top of [dstack](https://github.com/dstack-TEE/dstack/). To simulate the TEE-specific features, you can use the [tappd simulator](https://github.com/leechael/tappd-simulator/). There are several starter templates available that you can check out to learn more:

- Phala Cloud Python Starter, with FastAPI: https://github.com/Phala-Network/phala-cloud-python-starter
- Phala Cloud Bun Starter, using Bun + TypeScript: https://github.com/Phala-Network/phala-cloud-bun-starter
- Phala Cloud NextJS Starter: https://github.com/Phala-Network/nextjs-viem-tee-sim-template

If you want to integrate the SDK into your existing apps, here are the SDKs we currently have:

- JavaScript/TypeScript: https://www.npmjs.com/package/@phala/dstack-sdk
- Python: https://pypi.org/project/dstack-sdk/
- Golang: https://pkg.go.dev/github.com/Dstack-TEE/dstack/sdk/go/tappd

## Templates

### MCP (Model Context Protocol) Servers

- [**MOOF MCP**](https://github.com/moofdotfun/MOOF-MCP) - An MCP server enables LLMs to work with the MOOF platform, deployed on Phala Cloud. It can list flows, create new flows, and deploy other MCP servers on Phala Cloud. Additionally, it supports fetching public flow templates, forking flows from templates, retrieving authenticated user flows, publishing or unpublishing flows to/from the shared flow store, and deploying MCP servers directly from GitHub with optional Phala hosting and environment variable support. *by MOOF*
- [**DeMCP Defillama**](https://github.com/Phala-Network/phala-cloud/tree/main/templates/prebuilt/demap-defilama) - A DeFiLlama MCP server deployed on Phala Cloud that enables AI agents to fetch real-time DeFi data, including protocol TVL (Total Value Locked), chain metrics, and token prices. *by DeMCP*
- [**Context7 MCP**](https://github.com/Phala-Network/phala-cloud/tree/main/templates/prebuilt/context7-mcp) - A Context7 MCP server deployed on Phala Cloud that enables AI agents to fetch real-time Context7 data, including protocol TVL (Total Value Locked), chain metrics, and token prices. *by Phala-Network*
- [**MCP Server Fetch**](https://github.com/Phala-Network/mcp-servers/tree/main/src/fetch) - A MCP server deployed on Phala Cloud that enables AI agents to fetch real-time data from a given URL. *by Leechael*
- [**MCP Server Sequential Thinking**](https://github.com/Phala-Network/mcp-servers/tree/main/src/sequentialthinking) - A MCP server deployed on Phala Cloud that enables AI agents to think sequentially. *by Leechael*
- [**Swarms Agent in Phala TEE**](https://github.com/The-Swarm-Corporation/Phala-Deployment-Template) - A Swarms agent deployed on Phala Cloud that perform a comprehensive legal team swarm for contract creation and management. *by The-Swarm-Corporation*
- [**Armor Crypto**](https://github.com/HashWarlock/armor-crypto-mcp/tree/phala-mcp) - A single source for integrating AI Agents with the Crypto ecosystem. This includes Wallet creation and management, swaps, transfers, event-based trades like DCA, stop loss and take profit, and much more. The Armor MCP supports Solana in Alpha and, when in beta, will support more than a dozen blockchains, including Ethereum. Base, Avalanche, Bitcoin, Sui, Berachain, megaETH, Optimism, Ton, BNB, and Arbitrum, among others. Using Armor's MCP you can bring all of crypto into your AI Agent with unified logic and a complete set of tools. *by Armor Crypto*
- [**Moralis MCP**](https://github.com/HashWarlock/moralis-mcp-server) - The Moralis MCP Server is a local or cloud-deployable engine that connects natural language prompts to real blockchain insights — allowing AI models to query wallet activity, token metrics, dapp usage, and more without custom code or SQL. *by Moralis*
- [**Zep Graphiti MCP**](https://github.com/HashWarlock/graphiti/tree/main/mcp_server) - The [Zep Graphiti MCP Server](https://www.getzep.com/product/knowledge-graph-mcp/) is a framework for building and querying temporally-aware knowledge graphs, specifically tailored for AI agents operating in dynamic environments. Unlike traditional retrieval-augmented generation (RAG) methods, Graphiti continuously integrates user interactions, structured and unstructured enterprise data, and external information into a coherent, queryable graph. The framework supports incremental data updates, efficient retrieval, and precise historical queries without requiring complete graph recomputation, making it suitable for developing interactive, context-aware AI applications. **by Zep**

### Starter Templates

- [**Next.js Starter**](https://github.com/Phala-Network/phala-cloud-nextjs-starter) - Template for developing a Next.js-based app with boilerplate code targeting deployment on Phala Cloud and DStack. It includes the SDK by default to make integration with TEE features easier. *by Phala-Network*
- [**Python Starter**](https://github.com/Phala-Network/phala-cloud-python-starter) - Template for developing a FastAPI-based app with boilerplate code targeting deployment on Phala Cloud and DStack. It includes the SDK by default to make integration with TEE features easier. *by Phala-Network*
- [**Bun + TypeScript Starter**](https://github.com/Phala-Network/phala-cloud-bun-starter) - Template for developing a Bun-based app with boilerplate code targeting deployment on Phala Cloud and DStack. It includes the SDK by default to make integration with TEE features easier. *by Phala-Network*
- [**Node.js + Express + TypeScript Starter**](https://github.com/Gldywn/phala-cloud-node-starter) - Template for developing a Node.js (Typescript) w/ Express app with boilerplate code targeting deployment on Phala Cloud and DStack. It includes the SDK by default to make integration with TEE features easier. *by [Gldywn](https://github.com/Gldywn)*

### Oracles & Data Feeds

- [**Node.js Oracle Template**](https://github.com/Gldywn/phala-cloud-oracle-template) - A template for building high-integrity oracles that provides a two-fold guarantee: verifiable computation and verifiable networking. It includes a price aggregator example that demonstrates how to securely fetch, aggregate, and attest to external data, making it a robust foundation for any oracle use case. *by [Gldywn](https://github.com/Gldywn)*
- [**VRF in TEE**](https://github.com/Phala-Network/phala-cloud-vrf-template) - This is a template for developing a VRF generator on Phala Cloud and DStack. It delivers cryptographically verifiable randomness for Web3 applications with hardware-backed security and unprecedented efficiency. *by Phala-Network*
- [**NEAR Shade Agent**](https://github.com/HashWarlock/shade-agent-template/tree/phala-cloud) - Deploy verifiable blockchain agents and oracles on NEAR Protocol using Phala Cloud's TEE infrastructure. Includes ETH price oracle example and framework for custom agent development with hardware-backed security, private key management, and attestation. *by Near*

### Other Templates

- [**n8n Workflow Automation**](https://github.com/Phala-Network/phala-cloud/tree/main/templates/n8n) - A powerful workflow automation tool deployed on Phala Cloud with OAuth2 authentication fixes for TEE environment. Build complex automations, integrate with 400+ services, and run workflows securely within the TEE. *by n8n*
- [**Maybe Finance**](https://github.com/Phala-Network/phala-cloud/tree/main/templates/maybe-ai) - A comprehensive open-source personal finance management app deployed on Phala Cloud. Track expenses, budgets, investments, and net worth with bank syncing, AI insights, and beautiful analytics - all secured within TEE infrastructure. *by Maybe Finance*
- [**Anyone Anon Service**](https://github.com/rA3ka/dstack-examples/tree/main/anyone-anon-service) - Sets up a Anyone Anon (hidden) service and serves an nginx website from that. *by Anyone*
- [**Anyone Network Relay**](https://github.com/rA3ka/anon-relay-docker/tree/main) - Set up a Anon relay and participate in expanding the Anyone Network by providing bandwidth to earn recognition rewards. *by Anyone*
- [**TEE Tor Hidden Service**](https://github.com/Dstack-TEE/dstack-examples/tree/main/tor-hidden-service) - This docker compose example sets up a Tor hidden service and serves an nginx website from that. *by Dstack-TEE*
- [**TEE Coprocessors in Dstack**](https://github.com/Dstack-TEE/dstack-examples/tree/main/lightclient) - Minimal docker file for using the Helios light client to provide a trustworthy view of the blockchain. *by Dstack-TEE*
- [**Webshell**](https://github.com/Dstack-TEE/dstack-examples/tree/main/webshell) - This guide outlines the steps to set up and use a webshell with the ttyd service. *by Dstack-TEE*
- [**Coinbase x402 TEE**](https://github.com/HashWarlock/402-api-test/tree/phala-cloud) - A demonstration of a Node.js Express server that integrates TEE and the [X402 payment protocol](https://www.x402.org/) for monetizing API endpoints. *by Phala-Network*
- [**Microsoft Presidio in TEE**](https://github.com/HashWarlock/presidio/tree/phala-cloud/docs/samples/python/streamlit) - This is a demo application for Microsoft Presidio, a powerful open-source framework for PII (Personally Identifiable Information) detection and de-identification. This demo is optimized for deployment on Phala Cloud's Confidential Virtual Machines (CVMs). *by Microsoft*
- [**NEAR Shade Agent**](https://github.com/HashWarlock/shade-agent-template/tree/phala-cloud) - Deploy verifiable blockchain agents and oracles on NEAR Protocol using Phala Cloud's TEE infrastructure. Includes ETH price oracle example and framework for custom agent development with hardware-backed security, private key management, and attestation. *by Near*
- [**bytebot**](https://github.com/bytebot-ai/bytebot) - Bytebot is a desktop AI agent with its own virtual computer—not just a browser script or RPA bot. It can use any app, manage files, log in with a password manager, read PDFs and spreadsheets, and execute complex multi-step workflows. Think of it as a virtual employee that sees the screen, moves the mouse, types, and gets work done like a human. *by bytebot*
- [**Primus Attestor Node**](https://github.com/primus-labs/primus-network-startup) - An attestor node is a computing node of the Primus network, which forms a secure computation layer for executing zkTLS protocol. The attestor node is designated to run zkTLS tasks with zkTLS software including web version (Primus extension) and mobile versions (Primus AppClips and Primus Instant Apps) on indicated data sources. For security consideration, the attestor node runs inside a Trusted Execution Environment (TEE), ensuring runtime integrity and providing stronger version control.

## Build on Phala Cloud

Phala Cloud API allows you to build your own applications programmatically. It offers all the features availabe on the Cloud Platform.

- [Phala Cloud SDK](/js)
- [Phala Cloud API](https://cloud-api.phala.network/docs)
- [Cloud API Examples](https://github.com/Leechael/phala-cloud-api-example) (by @Leechael)
- [Phala Cloud CLI](https://github.com/Phala-Network/tee-cloud-cli.git)
- [Phala Cloud CI/CD GitHub Action Template](https://github.com/Phala-Network/cloud-tee-starter-template)

## Contribution Guidelines

For Feature Requests and Bug Reports:

- Search existing issues to avoid duplicates.
- Provide detailed information about the issue or feature you need.

For Documentation Contributions:

- Fork the repository and create a new branch for your changes.
- Write clear, concise documentation that helps other developers.
- Submit a pull request with a clear description of your changes.

For Code Contributions:

- You can contribute to open-source tools and integrations.
- Fork the repository and create a new branch for your feature or fix.
- Write clean, well-documented code with tests where appropriate.
- Submit a pull request with a clear description of your changes.

For detailed guidelines, please refer to our [Contributing guidelines](CONTRIBUTING.md).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Stay Connected

Keep up with the latest developments:
- [Phala Cloud](https://cloud.phala.com)
- [Documentation](https://docs.phala.com)
- Telegram Community: [🌍 Global](https://t.me/+nbhjx1ADG9EyYmI9), [🇨🇳 中文](https://t.me/+4PcAE9qTZ1kzM2M9)
- [Phala Network Website](https://phala.network)
- [Phala Discord](https://discord.gg/phala-network)

Join the community and help build the future of confidential computing!
