#!/usr/bin/env python3
"""
Extract all original file paths from the pre-migration SUMMARY.md
and convert them to expected URLs to validate against local Mintlify server.
"""

import re
import requests
import time

def extract_urls_from_summary(summary_content):
    """Extract all file paths from SUMMARY.md content."""
    # Pattern to match markdown links like * [Title](path/file.md)
    pattern = r'\* \[.*?\]\((.*?\.md)\)'
    matches = re.findall(pattern, summary_content)

    # Also get README.md files that might be standalone
    readme_pattern = r'\[.*?\]\((.*?README\.md)\)'
    readme_matches = re.findall(readme_pattern, summary_content)

    all_paths = list(set(matches + readme_matches))

    # Convert paths to expected Mintlify URLs
    urls = []
    for path in all_paths:
        # Remove .md extension and convert to URL path
        url_path = path.replace('.md', '')
        # Convert README to index
        url_path = re.sub(r'/README$', '/index', url_path)
        url_path = re.sub(r'^README$', 'index', url_path)
        urls.append(url_path)

    return sorted(urls)

def test_local_page(page_path, base_url="https://phalanetwork-1606097b.mintlify.app"):
    """Test if a page is accessible on local Mintlify server."""
    url = f"{base_url}/{page_path}"
    try:
        response = requests.get(url, timeout=3, allow_redirects=False)

        # If it's a 200, the page exists
        if response.status_code == 200:
            return True, response.status_code, None, url

        # If it's a redirect, check the destination
        if response.status_code in [301, 302, 307, 308]:
            location = response.headers.get('location', '/')
            # Clean up the location header (sometimes contains duplicates like "/, /")
            clean_location = location.split(',')[0].strip()
            # If redirected to root (/), treat as page not found (Mintlify's catch-all)
            if clean_location == '/':
                return False, response.status_code, f"Redirected to root (page not found)", url
            else:
                # Valid redirect to another page
                return True, response.status_code, f"Redirected to {clean_location}", url

        # Other status codes are failures
        return False, response.status_code, None, url

    except requests.exceptions.ConnectionError:
        return False, None, "Connection refused - is Mintlify server running?", url
    except requests.exceptions.Timeout:
        return False, None, "Timeout", url
    except Exception as e:
        return False, None, str(e), url

def extract_gitbook_redirects():
    """Extract GitBook redirects from the original .gitbook.yaml configuration."""
    gitbook_redirects = {
        "en-us/general/phala-network/intro": "README.md",
        "en-us/general/phala-network/products": "other-products/subbridge/README.md",
        "en-us/general/phala-network/governance": "pha-token/governance/governance-mechanism.md",
        "en-us/general/phala-network/phat-contract-fee": "developers/phat-contract/pay-for-cloud-service.md",
        "en-us/general/phala-network/tokenomics": "compute-providers/basic-info/worker-rewards.md",
        "en-us/general/khala-network/intro": "compute-providers/basic-info/introduction.md",
        "en-us/general/khala-network/governance": "pha-token/governance/khala-governance.md",
        "en-us/general/khala-network/tokenomics": "compute-providers/run-workers-on-khala/khala-worker-rewards.md",
        "en-us/general/applications/extension-wallet": "introduction/basic-guidance/README.md",
        "en-us/general/applications/setup-identity": "introduction/basic-guidance/setup-account-identity.md",
        "en-us/general/applications/get-pha": "introduction/basic-guidance/get-pha-and-transfer.md",
        "en-us/general/subbridge/intro": "other-products/subbridge/README.md",
        "en-us/general/subbridge/tutorial": "other-products/subbridge/cross-chain-transfer.md",
        "en-us/general/subbridge/supported-assets": "other-products/subbridge/supported-assets.md",
        "en-us/general/subbridge/asset-integration": "other-products/subbridge/asset-integration-guide.md",
        "en-us/general/subbridge/technical-details": "other-products/subbridge/technical-details.md",
        "en-us/general/applications/stake-pha": "pha-token/delegation/README.md",
        "en-us/general/applications/stakepool": "pha-token/delegation/delegate-to-stakepool.md",
        "en-us/general/applications/vault": "pha-token/delegation/whats-vault.md",
        "en-us/general/applications/share": "pha-token/delegation/whats-share.md",
        "en-us/general/applications/wpha": "pha-token/delegation/wrappedbalances-and-w-pha.md",
        "en-us/general/applications/delegation-example": "pha-token/delegation/examples-of-delegation.md",
        "en-us/general/applications/phala-app": "pha-token/delegation/use-phala-app-to-delegate.md",
        "en-us/general/applications/reward-calculation": "pha-token/delegation/estimate-your-reward.md",
        "en-us/general/applications/use-delegation-to-vote": "pha-token/delegation/wrappedbalances-and-w-pha.md",
        "overview/phala-network/confidential-ai-inference": "overview/phala-network/gpu-tee.md",
        "confidential-ai-inference/getting-started": "overview/phala-network/gpu-tee.md",
        "confidential-ai-inference/confidential-ai-api": "gpu-tee/llm-in-tee.md",
        "confidential-ai-inference/host-llm-in-tee": "gpu-tee/llm-in-tee.md",
        "confidential-ai-inference/implementation": "gpu-tee/llm-in-tee.md",
        "confidential-ai-inference/benchmark": "gpu-tee/benchmark.md",
        "cloud/getting-started/getting-started": "phala-cloud/getting-started/getting-started.md",
        "cloud/getting-started/sign-up-for-cloud-account": "phala-cloud/getting-started/sign-up-for-cloud-account.md",
        "cloud/getting-started/start-from-cloud-cli": "phala-cloud/getting-started/start-from-cloud-cli.md",
        "cloud/getting-started/start-from-cloud-ui": "phala-cloud/getting-started/start-from-cloud-ui.md",
        "cloud/getting-started/start-from-scratch": "phala-cloud/getting-started/start-from-scratch.md",
        "cloud/getting-started/start-from-template": "phala-cloud/getting-started/start-from-template.md",
        "cloud/use-cases/tee_with_fhe_and_mpc": "phala-cloud/use-cases/tee_with_fhe_and_mpc.md",
        "cloud/use-cases/tee_with_zk_and_zkrollup": "phala-cloud/use-cases/tee_with_zk_and_zkrollup.md",
        "ai-agent-contract/getting-started": "cloud/getting-started/getting-started.md",
    }

    # Convert GitBook redirects to Mintlify URLs (remove .md extensions and handle special cases)
    converted_redirects = []
    for old_path, target_path in gitbook_redirects.items():
        # Convert target to Mintlify format
        mintlify_path = target_path.replace('.md', '')
        # Handle README -> index conversion
        mintlify_path = mintlify_path.replace('/README', '/index').replace('README', 'index')
        converted_redirects.append(old_path)

    return sorted(converted_redirects)

def main():
    # Original SUMMARY.md content from pre-migration
    summary_content = """# Table of contents

## Home

* [👾 Phala Network Docs](README.md)

## Overview

* [⚖️ Phala Network](overview/phala-network.md)
  * [💎 Phala Cloud](overview/phala-network/phala-cloud.md)
  * [🥷 Dstack](overview/phala-network/dstack.md)
  * [🔐 GPU TEE](overview/phala-network/gpu-tee.md)
* [💎 PHA Token](overview/pha-token/README.md)
  * [🪙 Introduction](overview/pha-token/introduction.md)
  * [👐 Delegation](overview/pha-token/delegation/README.md)
    * [Delegate to StakePool](overview/pha-token/delegation/delegate-to-stakepool.md)
    * [What is Vault](overview/pha-token/delegation/whats-vault.md)
    * [What is Share](overview/pha-token/delegation/whats-share.md)
    * [WrappedBalances & W-PHA](overview/pha-token/delegation/wrappedbalances-and-w-pha.md)
    * [Examples of Delegation](overview/pha-token/delegation/examples-of-delegation.md)
    * [Use Phala App to Delegate](overview/pha-token/delegation/use-phala-app-to-delegate.md)
    * [Estimate Your Reward](overview/pha-token/delegation/estimate-your-reward.md)
  * [🗳️ Governance](overview/pha-token/governance/README.md)
    * [Governance Mechanism](overview/pha-token/governance/governance-mechanism.md)
    * [Join the Council](overview/pha-token/governance/join-the-council.md)
    * [Voting for Councillors](overview/pha-token/governance/voting-for-councillors.md)
    * [Apply for Project Funding](overview/pha-token/governance/apply-for-project-funding.md)
    * [Phala Treasury](overview/pha-token/governance/khala-treasury.md)
    * [Phala Governance](overview/pha-token/governance/khala-governance.md)
    * [Setting Up an Account Identity](overview/pha-token/governance/setup-account-identity.md)

## Phala Cloud

* [🚀 Getting Started](cloud/getting-started/getting-started.md)
  * [Create Your Phala Cloud Account](cloud/getting-started/sign-up-for-cloud-account.md)
  * [Your First CVM Deployment](cloud/getting-started/start-from-cloud-ui.md)
  * [Explore Templates](phala-cloud/getting-started/explore-templates/README.md)
    * [Launch an Eliza Agent](phala-cloud/getting-started/explore-templates/launch-an-eliza-agent.md)
    * [Start from Template](phala-cloud/getting-started/explore-templates/start-from-template.md)
  * [Core Concepts Refresher](phala-cloud/getting-started/core-concepts-refresher.md)
* [🪨 TEEs, Attestation & Zero Trust Security](phala-cloud/tees-attestation-and-zero-trust-security/README.md)
  * [Attestation](phala-cloud/tees-attestation-and-zero-trust-security/attestation.md)
  * [Security Architecture](phala-cloud/tees-attestation-and-zero-trust-security/security-architecture.md)
* [🥷 Phala Cloud User Guides](phala-cloud/phala-cloud-user-guides/README.md)
  * [Deploy and Manage CVMs](phala-cloud/phala-cloud-user-guides/create-cvm/README.md)
    * [Deploy CVM with Docker Compose](phala-cloud/phala-cloud-user-guides/create-cvm/create-with-docker-compose.md)
    * [Set Secure Environment Variables](phala-cloud/phala-cloud-user-guides/create-cvm/set-secure-environment-variables.md)
    * [Deploy Private Docker Image to CVM](phala-cloud/phala-cloud-user-guides/create-cvm/create-with-private-docker-image.md)
    * [Debugging and Analyzing Logs](phala-cloud/phala-cloud-user-guides/create-cvm/debugging-and-analyzing-logs/README.md)
      * [Check Logs](phala-cloud/phala-cloud-user-guides/create-cvm/debugging-and-analyzing-logs/check-logs.md)
      * [Private Log Viewer](phala-cloud/phala-cloud-user-guides/create-cvm/debugging-and-analyzing-logs/private-log-viewer.md)
      * [Debug Your Application](phala-cloud/phala-cloud-user-guides/create-cvm/debugging-and-analyzing-logs/debug-your-application.md)
    * [Application Scaling & Resource Management](phala-cloud/phala-cloud-user-guides/create-cvm/resize-resource.md)
    * [Upgrade Application](phala-cloud/phala-cloud-user-guides/create-cvm/upgrade-application.md)
    * [Deployment Cheat Sheet](phala-cloud/phala-cloud-user-guides/create-cvm/deployment-cheat-sheet.md)
  * [Building with TEE](phala-cloud/phala-cloud-user-guides/building-with-tee/README.md)
    * [Access Your Applications](phala-cloud/phala-cloud-user-guides/building-with-tee/access-your-applications.md)
    * [Expose Service Port](phala-cloud/phala-cloud-user-guides/building-with-tee/expose-service-port.md)
    * [Setting Up Custom Domain](phala-cloud/phala-cloud-user-guides/building-with-tee/setting-up-custom-domain.md)
    * [Secure Access Database](phala-cloud/phala-cloud-user-guides/building-with-tee/access-database.md)
    * [Create Crypto Wallet](phala-cloud/phala-cloud-user-guides/building-with-tee/create-crypto-wallet.md)
    * [Generate Remote Attestation](phala-cloud/phala-cloud-user-guides/building-with-tee/generate-ra-report.md)
    * [Verify Remote Attestation](phala-cloud/phala-cloud-user-guides/building-with-tee/verify-remote-attestation.md)
  * [Advanced Deployment Options](phala-cloud/phala-cloud-user-guides/advanced-deployment-options/README.md)
    * [Deploy CVM with Phala Cloud CLI](phala-cloud/phala-cloud-user-guides/advanced-deployment-options/start-from-cloud-cli.md)
    * [Deploy CVM with Phala Cloud API](phala-cloud/phala-cloud-user-guides/advanced-deployment-options/deploy-cvm-with-phala-cloud-api.md)
    * [Setup a CI/CD Pipeline](phala-cloud/phala-cloud-user-guides/advanced-deployment-options/setup-a-ci-cd-pipeline.md)
* [🚢 Be Production Ready](phala-cloud/be-production-ready/README.md)
  * [CI/CD Automation](phala-cloud/be-production-ready/ci-cd-automation/README.md)
    * [CI/CD Integration Best Practices](phala-cloud/be-production-ready/ci-cd-automation/ci-cd-integration-best-practices.md)
    * [Setup a CI/CD Pipeline](phala-cloud/be-production-ready/ci-cd-automation/setup-a-ci-cd-pipeline.md)
  * [Production Checklist](phala-cloud/be-production-ready/production-checklist.md)
  * [Troubleshooting Guide](phala-cloud/be-production-ready/troubleshooting.md)
  * [Glossary](phala-cloud/be-production-ready/glossary.md)
* [🔒 Use Cases](cloud/use-cases/use-cases.md)
  * [TEE with AI](cloud/use-cases/tee_with_ai.md)
  * [TEE with FHE and MPC](cloud/use-cases/tee_with_fhe_and_mpc.md)
  * [TEE with ZK and ZKrollup](cloud/use-cases/tee_with_zk_and_zkrollup.md)
* [📋 References](phala-cloud/references/README.md)
  * [Phala Cloud CLI Reference](phala-cloud/references/tee-cloud-cli/README.md)
    * [phala](phala-cloud/references/tee-cloud-cli/phala/README.md)
      * [auth](phala-cloud/references/tee-cloud-cli/phala/auth.md)
      * [cvms](phala-cloud/references/tee-cloud-cli/phala/cvms.md)
      * [docker](phala-cloud/references/tee-cloud-cli/phala/docker.md)
      * [simulator](phala-cloud/references/tee-cloud-cli/phala/simulator.md)
  * [Cloud API (beta)](phala-cloud/references/cloud-api-beta/README.md)
  * [Phala Cloud Pricing](phala-cloud/references/phala-cloud-pricing.md)
* [❓ FAQs](cloud/faqs.md)

***

* [⚙️ CVM Management](management.md)
* [🔄 Deploy Docker App in TEE](migration.md)

## Dstack

* [Overview](dstack/overview.md)
* [Local Development Guide](dstack/local-development.md)
* [Getting Started](dstack/getting-started.md)
* [Hardware Requirements](dstack/hardware-requirements.md)
* [Design Documents](dstack/design-documents/README.md)
  * [Whitepaper](dstack/design-documents/whitepaper.md)
  * [Decentralized Root-of-Trust](dstack/design-documents/decentralized-root-of-trust.md)
  * [Key Management Service](dstack/design-documents/key-management-protocol.md)
  * [Zero Trust HTTPs (TLS)](dstack/design-documents/tee-controlled-domain-certificates.md)
* [Acknowledgement](dstack/acknowledgement.md)
* [❓ FAQs](dstack/faqs.md)

## LLM in GPU TEE

* [👩‍💻 Host LLM in GPU TEE](gpu-tee/llm-in-tee.md)
* [🔐 GPU TEE Inference API](gpu-tee/inference-api.md)
* [🏎️ GPU TEE Benchmark](gpu-tee/benchmark.md)
* [❓ FAQs](gpu-tee/faqs.md)

## Tech Specs

* [⛓️ Blockchain](tech-specs/blockchain/README.md)
  * [Blockchain Entities](tech-specs/blockchain/blockchain-entities.md)
  * [Cluster of Workers](tech-specs/blockchain/cluster-of-workers.md)
  * [Secret Key Hierarchy](tech-specs/blockchain/secret-key-hierarchy.md)

## References

* [🔐 Setting Up a Wallet on Phala](references/basic-guidance/README.md)
  * [Acquiring PHA](references/basic-guidance/get-pha-and-transfer.md)
* [🌉 SubBridge](references/subbridge/README.md)
  * [Cross-chain Transfer](references/subbridge/cross-chain-transfer.md)
  * [Supported Assets](references/subbridge/supported-assets.md)
  * [Asset Integration Guide](references/subbridge/asset-integration-guide.md)
  * [Technical Details](references/subbridge/technical-details.md)
* [👷 Community Builders](references/community-builders.md)
* [🤹 Hackathon Guides](references/hackathon-guides/README.md)
  * [ETHGlobal Singapore](references/hackathon-guides/ethglobal-singapore.md)
  * [ETHGlobal San Francisco](references/hackathon-guides/ethglobal-san-francisco.md)
  * [ETHGlobal Bangkok](references/hackathon-guides/ethglobal-bangkok.md)
* [🤯 Advanced Topics](references/advanced-topics/README.md)
  * [Cross Chain Solutions](references/advanced-topics/cross-chain-solutions.md)
  * [System Contract and Drivers](references/advanced-topics/system-contract-and-drivers.md)
  * [Run Local Testnet](references/advanced-topics/run-local-testnet.md)
  * [SideVM](references/advanced-topics/sidevm.md)
* [🆘 Support](references/support/README.md)
  * [Available Phala Chains](references/support/endpoints.md)
  * [Resource Limits](references/support/resource-limits.md)
  * [Transaction Costs](references/support/transaction-costs.md)
  * [Compatibility Matrix](references/support/compatibility-matrix.md)
  * [Block Explorers](references/support/block-explorers.md)
  * [Faucet](references/support/faucet.md)
* [⁉️ FAQ](references/faq.md)

## Compute Providers

* [🙃 Basic Info](compute-providers/basic-info/README.md)
  * [Introduction](compute-providers/basic-info/introduction.md)
  * [Gemini Tokenomics (Worker Rewards)](compute-providers/basic-info/worker-rewards.md)
  * [Budget balancer](compute-providers/basic-info/budget-balancer.md)
  * [Staking Mechanism](compute-providers/basic-info/staking-mechanism.md)
  * [Requirements in Phala](compute-providers/basic-info/requirements-in-phala-khala.md)
  * [Confidence Level & SGX Function](compute-providers/basic-info/confidence-level-and-sgx-function.md)
  * [Rent Hardware](compute-providers/basic-info/rent-hardware.md)
  * [Error Summary](compute-providers/basic-info/error-summary.md)
* [🦿 Run Workers on Phala](compute-providers/run-workers-on-phala/README.md)
  * [Solo Worker Deployment](compute-providers/run-workers-on-phala/solo-worker-deployment.md)
  * [PRBv3 Deployment](compute-providers/run-workers-on-phala/prbv3-deployment.md)
  * [Using PRBv3 UI](compute-providers/run-workers-on-phala/using-prbv3-ui.md)
  * [PRB Worker Deployment](compute-providers/run-workers-on-phala/prb-worker-deployment.md)
  * [Switch Workers from Solo to PRB Mode](compute-providers/run-workers-on-phala/switch-workers-from-solo-to-prb-mode.md)
  * [Headers-cache deployment](compute-providers/run-workers-on-phala/headers-cache-deployment.md)
  * [Archive node deployment](compute-providers/run-workers-on-phala/archive-node-deployment.md)
* [🏃‍♀️ Run Workers on Khala - Archived](compute-providers/run-workers-on-khala/README.md)
  * [Solo Scripts Guidance - Archived](compute-providers/run-workers-on-khala/solo-scripts-guidance/README.md)
    * [Installing Khala Solo Scripts - Archived](compute-providers/run-workers-on-khala/solo-scripts-guidance/installing-phala-mining-tools.md)
    * [Worker Confidence Level - Archived](compute-providers/run-workers-on-khala/solo-scripts-guidance/worker-confidence-level.md)
    * [Configure the Worker - Archived](compute-providers/run-workers-on-khala/solo-scripts-guidance/configure-the-worker.md)
    * [Deploy the Worker - Archived](compute-providers/run-workers-on-khala/solo-scripts-guidance/deploy-the-worker.md)
    * [Monitor Worker's Status - Archived](compute-providers/run-workers-on-khala/solo-scripts-guidance/monitor-workers-status.md)
    * [Accelerate Khala Syncing - Archived](compute-providers/run-workers-on-khala/solo-scripts-guidance/accelerate-khala-syncing.md)
    * [Update your Worker's Node - Archived](compute-providers/run-workers-on-khala/solo-scripts-guidance/update-your-workers-node.md)
  * [PRBv3 Deployment Guide - Archived](compute-providers/run-workers-on-khala/prbv3-deployment.md)
  * [Using PRBv3 UI - Archived](compute-providers/run-workers-on-khala/using-prbv3-ui.md)
  * [Migration from PRBv2 to v3 - Archived](compute-providers/run-workers-on-khala/migration-from-prbv2-to-v3.md)
  * [Headers-cache deployment - Archived](compute-providers/run-workers-on-khala/headers-cache-deployment.md)
  * [Archive node deployment - Archived](compute-providers/run-workers-on-khala/archive-node-deployment.md)
  * [PRBv2 Deployment Guide - Archived](compute-providers/run-workers-on-khala/deployment-guide-for-prbv2.md)
  * [PRB Worker Deployment - Archived](compute-providers/run-workers-on-khala/prb-worker-deployment.md)
  * [How to switch from Solo scripts to PRB worker - Archived](compute-providers/run-workers-on-khala/how-to-switch-from-solo-mining-to-prb-mining.md)
  * [Khala Worker Rewards - Archived](compute-providers/run-workers-on-khala/khala-worker-rewards.md)
  * [Troubleshooting - Archived](compute-providers/run-workers-on-khala/troubleshooting.md)
* [🛡️ Gatekeeper](compute-providers/gatekeeper/README.md)
  * [Collator](compute-providers/gatekeeper/collator.md)
  * [Gatekeeper](compute-providers/gatekeeper/gatekeeper.md)
"""

    print("🚀 Complete Migration Validator (SUMMARY.md + GitBook redirects -> Mintlify)")
    print("=" * 70)
    print("📍 Testing original doc structure against: https://phalanetwork-1606097b.mintlify.app")
    print("-" * 70)

    # Extract URLs from original SUMMARY.md
    original_urls = extract_urls_from_summary(summary_content)
    print(f"🔍 Found {len(original_urls)} SUMMARY.md pages to test")

    # Extract GitBook redirects
    gitbook_redirects = extract_gitbook_redirects()
    print(f"🔍 Found {len(gitbook_redirects)} GitBook redirect URLs to test")

    # Combine all URLs for testing
    all_urls = sorted(set(original_urls + gitbook_redirects))
    print(f"🔍 Total unique URLs to test: {len(all_urls)}")
    print("-" * 70)

    successful_pages = []
    failed_pages = []

    # Test each URL (both original and GitBook redirects)
    for url_path in all_urls:
        accessible, status_code, error, full_url = test_local_page(url_path)

        if accessible:
            if error and "Redirected to" in error:
                redirect_dest = error.split('Redirected to ')[1]
                print(f"✅ {url_path} → {redirect_dest}")
            else:
                print(f"✅ {url_path}")
            successful_pages.append(url_path)
        else:
            if error:
                status_info = f"({status_code}) {error}" if status_code else f"({error})"
            else:
                status_info = f"({status_code})" if status_code else "(Unknown error)"
            print(f"❌ {url_path} {status_info}")
            failed_pages.append({
                'page': url_path,
                'status_code': status_code,
                'error': error,
                'url': full_url
            })

    # Summary
    print("\n" + "=" * 70)
    print("📊 COMPLETE MIGRATION VALIDATION SUMMARY")
    print("=" * 70)

    total_pages = len(all_urls)
    success_count = len(successful_pages)
    fail_count = len(failed_pages)

    print(f"📄 SUMMARY.md pages: {len(original_urls)}")
    print(f"🔗 GitBook redirects: {len(gitbook_redirects)}")
    print(f"📋 Total unique URLs: {total_pages}")
    print(f"✅ Accessible URLs: {success_count}/{total_pages} ({success_count/total_pages*100:.1f}%)")
    print(f"❌ Failed URLs: {fail_count}/{total_pages} ({fail_count/total_pages*100:.1f}%)")

    if failed_pages:
        print(f"\n🔍 PAGES WITH MIGRATION ISSUES:")
        print("-" * 50)
        for page_info in failed_pages:
            print(f"Page: {page_info['page']}")
            print(f"  ↳ URL: {page_info['url']}")
            if page_info['status_code']:
                print(f"  ↳ Status: {page_info['status_code']}")
            if page_info['error']:
                print(f"  ↳ Error: {page_info['error']}")
            print()

        print("💡 RECOMMENDATIONS:")
        print("   - Check if missing pages exist as .mdx files")
        print("   - Verify docs.json navigation includes all pages")
        print("   - Check for path mismatches between original and migrated structure")
        print("   - Ensure production site is accessible and deployed correctly")

        return 1
    else:
        print(f"\n🎉 Perfect Migration! All {total_pages} URLs are accessible!")
        print("✅ Zero broken links - comprehensive migration validation successful!")
        print("📋 Validated: SUMMARY.md pages + GitBook redirects + Mintlify navigation")

        return 0

if __name__ == "__main__":
    exit(main())
