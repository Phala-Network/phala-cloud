## [](https://github.com/Phala-Network/phala-cloud/compare/cli-v1.1.21...cli-v) (2026-08-15)

### feat

* **cli,js:** support GitHub Actions OIDC bearer auth ([bfa8db2](https://github.com/Phala-Network/phala-cloud/commit/bfa8db201781b83b03316a6bfc24c45099b479d4))
## [](https://github.com/Phala-Network/phala-cloud/compare/cli-v1.1.21-beta.2...cli-v) (2026-08-14)
## [](https://github.com/Phala-Network/phala-cloud/compare/cli-v1.1.20...cli-v) (2026-08-13)

### feat

* **cli:** add `phala docs` — explore live docs from the terminal (agent-friendly) (#485) ([d8da13c](https://github.com/Phala-Network/phala-cloud/commit/d8da13c5d3fdd5737db68923e609e4ded3d53d31)), closes [#485](https://github.com/Phala-Network/phala-cloud/issues/485)
* **cli:** add profiles refresh command ([4020c3d](https://github.com/Phala-Network/phala-cloud/commit/4020c3d7f66905c4ca8384d8985690c6b4106f3c))
* **cli:** remove deprecated auth subcommands ([53a265e](https://github.com/Phala-Network/phala-cloud/commit/53a265ee3b9809f155bc441386002a95509812b1))
* **cli:** revoke API tokens server-side on logout and profiles delete ([e5ff349](https://github.com/Phala-Network/phala-cloud/commit/e5ff349fd035ea51ac4b656b9556c604ff76482f))
* **cli:** show SSH key fingerprints in runtime-config ([272560d](https://github.com/Phala-Network/phala-cloud/commit/272560d365195120984da84d2253daa83cd2bf3b))

### fix

* **cli:** add request timeout to docs MCP calls ([db34bf9](https://github.com/Phala-Network/phala-cloud/commit/db34bf9d72cef4ea4d7c4a363e65ddd535d9a37d))
* **cli:** flush piped stdout before process exit ([2362e23](https://github.com/Phala-Network/phala-cloud/commit/2362e232eb67716bc0e24ded81b02b4c00147d7f))
* **cli:** pass docs grep pattern via -e to rg ([b06e5e2](https://github.com/Phala-Network/phala-cloud/commit/b06e5e20c7e5bbcb60b934281b870768a01fcadf))
* **cli:** pin workspace and default to current profile in profiles refresh ([644ccbc](https://github.com/Phala-Network/phala-cloud/commit/644ccbc837fc107771c053d50871dac6616b23df))
* **cli:** preserve binary bodies in phala api ([43fd62a](https://github.com/Phala-Network/phala-cloud/commit/43fd62a6bc47a5e0ca0566992db337afcc46d4ca))
* **cli:** preserve repeated API query parameters ([fcd2bcc](https://github.com/Phala-Network/phala-cloud/commit/fcd2bcc9255ea43a395b5778478eee440be09e5d))
* **cli:** read env encrypt pubkey from current CVM schema on deploy ([a057b41](https://github.com/Phala-Network/phala-cloud/commit/a057b4151d2c7500dda1aadcdd78781bd78f1d49))
* **cli:** send phala-cli/{version} User-Agent on all HTTP clients ([31f4a45](https://github.com/Phala-Network/phala-cloud/commit/31f4a454b86c35530bbb4230216ebca4148b145a))

### refactor

* **cli:** centralize API error presentation ([abad667](https://github.com/Phala-Network/phala-cloud/commit/abad667702e8ad380e3c4d10305429f29d34c3c7))
## [](https://github.com/Phala-Network/phala-cloud/compare/cli-v1.1.20...cli-v) (2026-08-06)

### feat

* **cli:** add `phala docs` — explore live docs from the terminal (agent-friendly) (#485) ([d8da13c](https://github.com/Phala-Network/phala-cloud/commit/d8da13c5d3fdd5737db68923e609e4ded3d53d31)), closes [#485](https://github.com/Phala-Network/phala-cloud/issues/485)

### fix

* **cli:** add request timeout to docs MCP calls ([db34bf9](https://github.com/Phala-Network/phala-cloud/commit/db34bf9d72cef4ea4d7c4a363e65ddd535d9a37d))
* **cli:** pass docs grep pattern via -e to rg ([b06e5e2](https://github.com/Phala-Network/phala-cloud/commit/b06e5e20c7e5bbcb60b934281b870768a01fcadf))
* **cli:** preserve binary bodies in phala api ([43fd62a](https://github.com/Phala-Network/phala-cloud/commit/43fd62a6bc47a5e0ca0566992db337afcc46d4ca))

### refactor

* **cli:** centralize API error presentation ([abad667](https://github.com/Phala-Network/phala-cloud/commit/abad667702e8ad380e3c4d10305429f29d34c3c7))
## [](https://github.com/Phala-Network/phala-cloud/compare/cli-v1.1.20-beta.1...cli-v) (2026-07-26)

### feat

* **cli:** 0x-prefix hex values, clarify whitelists, add kms phala ([dcb18e6](https://github.com/Phala-Network/phala-cloud/commit/dcb18e6d9f69ed71766fa1f49ed401dad01b1f5d))
* **cli:** add force-stop deploy option ([260b6dc](https://github.com/Phala-Network/phala-cloud/commit/260b6dcf1e3faa76cdb0db7798c215137cd060c9))
* **cli:** list KMS contracts and contract nodes ([164d737](https://github.com/Phala-Network/phala-cloud/commit/164d737cdae9108d4fba0b1e16b95cd07c44a30e))
* **sdk/cli:** surface KMS contract verification anchors in on-chain detail ([35a48a3](https://github.com/Phala-Network/phala-cloud/commit/35a48a3a81a4d762cb3a7b49bdcddfb196fd6db1))

### fix

* **cli:** include error code in deploy provision error output ([84a5118](https://github.com/Phala-Network/phala-cloud/commit/84a511857b221f287f15796b172eefd37418f0ab))
* **cli:** make force-stop bypass graceful shutdown ([d245edd](https://github.com/Phala-Network/phala-cloud/commit/d245edd8ba9da2f4e7a326d09c29d1b8533a963f))
* **cli:** plain, aligned layout for kms ethereum/base output ([5c21e87](https://github.com/Phala-Network/phala-cloud/commit/5c21e87f8a7b80384f25386b9beea8237a5ec4d6))
* **cli:** reject api method before endpoint ([ad4f1ff](https://github.com/Phala-Network/phala-cloud/commit/ad4f1ff40db541f9488871ca6ceac97accafd483))
* **cli:** remove legacy cvms create command ([cad4098](https://github.com/Phala-Network/phala-cloud/commit/cad409879b461630349347f32052a6b3d77a1cb8))
* **cli:** resolve viem chain from chain_id, not the injected `chain` field ([9d7187b](https://github.com/Phala-Network/phala-cloud/commit/9d7187ba1a8e16e365d34ef30c69684039e83c14))
* **cli:** surface request details in API errors ([c53a329](https://github.com/Phala-Network/phala-cloud/commit/c53a329b4cfa3027e05d27c7e3ed5bb8e0fbbfbb))
* **cli:** verify KMS env encryption pubkeys ([0300d64](https://github.com/Phala-Network/phala-cloud/commit/0300d645970198ca08530caa724d3651a6eb833b))

### refactor

* migrate resize endpoint across all SDKs ([56638f1](https://github.com/Phala-Network/phala-cloud/commit/56638f1c1592a1a48dab7fedf9152b60c8e52a01))
## [](https://github.com/Phala-Network/phala-cloud/compare/cli-v1.1.19...cli-v) (2026-06-17)

### feat

* add kms_contract_id to CVM SDK schemas, deprecate kms_id ([16734b9](https://github.com/Phala-Network/phala-cloud/commit/16734b9d22c2e6584c3c320b64d2bd48cdcb5a2b))
* add versioned CVM hashid SDK schemas ([b5b3766](https://github.com/Phala-Network/phala-cloud/commit/b5b376620be08e1efbcb26f1ce78fd71bef90544))
* **cli:** add --experimental-mr-config-id flag to deploy ([6877beb](https://github.com/Phala-Network/phala-cloud/commit/6877beb14bed34f23aa3fa9c1009631619a4651c))
* **cli:** add --timeout global flag ([484d9f9](https://github.com/Phala-Network/phala-cloud/commit/484d9f982d86aa8546376a4d7fe63a5e33d8bd90))
* **cli:** add keccak256 subcommand for hex hash computation ([31f04ab](https://github.com/Phala-Network/phala-cloud/commit/31f04ab3e421b1f7bb2c5e00680f9f11593dcb2e))
* **cli:** rename --experimental-mr-config-id to --experimental-key-provider-type ([fb09481](https://github.com/Phala-Network/phala-cloud/commit/fb09481c404451a77742878686d3769d0dc98814))
* **cli:** rename to keccak256sum, add stdin and -c/--quiet/--status ([a19cd38](https://github.com/Phala-Network/phala-cloud/commit/a19cd38c2c53b27d85d1b2c4cbde1eeff6bc48cd))
* **cli:** surface the configured timeout in timeout error messages ([6eec093](https://github.com/Phala-Network/phala-cloud/commit/6eec09386d6fbb1f7bc76ccdbb9cb5f1e018491e))
* expose latest CVM hashid schemas ([d317ebf](https://github.com/Phala-Network/phala-cloud/commit/d317ebf8acb4a1b53d5c080725af07a2a700d2a5))
* **js,cli:** add compose types and mr_config_id computation ([c5e321f](https://github.com/Phala-Network/phala-cloud/commit/c5e321fafd91d2063395a76b541cd2b72c8f41ff))

### fix

* align CLI schemas with hashid responses ([07527a1](https://github.com/Phala-Network/phala-cloud/commit/07527a13cef8a5adaf7fa71247f2564250e3f26d))
* **cli:** preserve SDK error details and stop duplicating error output ([6e517e1](https://github.com/Phala-Network/phala-cloud/commit/6e517e10350fd5b0f32281df52f1c8c9f34b680e))
* **cli:** show usage when keccak256 called with no args ([2c23662](https://github.com/Phala-Network/phala-cloud/commit/2c23662934375e11abe31ab0bfd845e417be90cb))
* **cli:** skip DSTACK_AUTHORIZED_KEYS injection when --no-dev-os is set ([ebd53ae](https://github.com/Phala-Network/phala-cloud/commit/ebd53aee77a6b90d7ba169ae2d88cbdf1464c713))
* **cli:** use k256_pubkey instead of ca_pubkey for key_provider_id ([69e6b82](https://github.com/Phala-Network/phala-cloud/commit/69e6b8227b646a171385319e256a15b5ed758ccd))

### refactor

* **cli:** remove docker command group ([946631e](https://github.com/Phala-Network/phala-cloud/commit/946631e1caeaa7ae7455481aeb8e82e7c27fb0d8))
## [1.1.19](https://github.com/Phala-Network/phala-cloud/compare/cli-v1.1.18...cli-v1.1.19) (2026-05-19)

### feat

* **cli:** add app instance name option ([2ed537c](https://github.com/Phala-Network/phala-cloud/commit/2ed537cf802e122b24f2d9e3aff8af20f56fb367))
* **cli:** add CVM create resource graph ([dc7a788](https://github.com/Phala-Network/phala-cloud/commit/dc7a7880b1ea83f8cfb3332776a42b84acfbcff7))
## [1.1.18](https://github.com/Phala-Network/phala-cloud/compare/cli-v1.1.17...cli-v1.1.18) (2026-04-17)

### feat

* **cli:** add instances rm command with multi-UUID support ([0f78fc6](https://github.com/Phala-Network/phala-cloud/commit/0f78fc63116b65368830a13df387df50d819b87d))
* **cli:** move apps instances to top-level instances command, add instances ls ([67046a1](https://github.com/Phala-Network/phala-cloud/commit/67046a18644c3e84a022c0bf66d67fbb5964081a))
* **sdk,cli:** add POST /apps/{app_id}/instances support ([80498ab](https://github.com/Phala-Network/phala-cloud/commit/80498ab02f56610a21cbbc807b92d878304a1eb2))

### fix

* **cli:** include live status in instances ls --json output ([06b0360](https://github.com/Phala-Network/phala-cloud/commit/06b0360ed7d28779d61335facf51666f27fc2892))
* **cli:** polish instances/link UX and add commit-token routing ([4ab23c5](https://github.com/Phala-Network/phala-cloud/commit/4ab23c52f51abd73f13de2a28213f8f1ba36b20c))
* **cli:** poll both deviceAllowed and composeHashAllowed before commit ([755a256](https://github.com/Phala-Network/phala-cloud/commit/755a256e47e38c82d3566fedf30b53d7a278500f))
* **cli:** poll on-chain state before commit after registering compose hash ([2fb4094](https://github.com/Phala-Network/phala-cloud/commit/2fb409430f06a3bc530d0e5841fb4be567f0a936))
* **cli:** preserve all existing fields when backfilling app_id in link ([1108cc7](https://github.com/Phala-Network/phala-cloud/commit/1108cc7415fb300595381d516c4535b4900ae21b))
* **cli:** reject unknown subcommand paths for leaf commands ([397b92b](https://github.com/Phala-Network/phala-cloud/commit/397b92b9e0ccf3c2073a13f9a753901fe8bb4ec6))
* **cli:** resolve profile by workspace slug fallback and use actual profile key in link ([a06748b](https://github.com/Phala-Network/phala-cloud/commit/a06748ba58f2874b90dcb3bdd363b1b6e8408028))
* **cli:** skip CVM fetch in instances add when no env-file provided ([98bb666](https://github.com/Phala-Network/phala-cloud/commit/98bb6668700b4ca9f4b6e812a85424a36eadd719))
* **cli:** write workspace slug as profile key, not workspace name ([e707e84](https://github.com/Phala-Network/phala-cloud/commit/e707e846b62023f3b5436785f346748d6c56dddd))
## [1.1.17](https://github.com/Phala-Network/phala-cloud/compare/cli-v1.1.16...cli-v1.1.17) (2026-04-10)
## [1.1.16](https://github.com/Phala-Network/phala-cloud/compare/cli-v1.1.15...cli-v1.1.16) (2026-04-10)

### fix

* **cli:** correct deploy --commit requirements in --help ([157f103](https://github.com/Phala-Network/phala-cloud/commit/157f103bb4033cc49abdacc6541d28db15b8a82b))

### refactor

* clarify --help strings and unify --transaction-hash option ([0749dc0](https://github.com/Phala-Network/phala-cloud/commit/0749dc0bc193697ef44d1ac86069d689838b9f58))
## [1.1.15](https://github.com/Phala-Network/phala-cloud/compare/cli-v1.1.14...cli-v1.1.15) (2026-04-10)

### feat

* **cli:** add profiles command aliases (list, rm, mv) ([b46dbc7](https://github.com/Phala-Network/phala-cloud/commit/b46dbc7c46ef30e5829edaee1e72ddaec9041b2b))
* **cli:** add profiles use, rename, delete subcommands ([3a7ab22](https://github.com/Phala-Network/phala-cloud/commit/3a7ab22e5635aa4906cf0e22d41d07141ffdea86))
* **cli:** add renameProfile utility to credentials ([1e07a24](https://github.com/Phala-Network/phala-cloud/commit/1e07a24f847d86b7c5c08050f4d91a7bc447e5fe))
* **cli:** unify global option handling ([8dc77c1](https://github.com/Phala-Network/phala-cloud/commit/8dc77c19c5ddd241e4baeb568981563f670b857f))

### fix

* **cli:** add two-phase replicate flow with on-chain approval ([a77a011](https://github.com/Phala-Network/phala-cloud/commit/a77a011e47e34129c3a5b17c9adcd7f60ee3bec8))
* **cli:** improve replicate output formatting and error display ([87cd7c8](https://github.com/Phala-Network/phala-cloud/commit/87cd7c8bff9c963219da4f03201f26ca2b57e966))
* **cli:** resolve app_id ambiguity with --compose-hash in replicate ([15ff65d](https://github.com/Phala-Network/phala-cloud/commit/15ff65d20a86702c519df63df4b86989832152f1))
* **cli:** show full values in on-chain registration error ([600cb66](https://github.com/Phala-Network/phala-cloud/commit/600cb66b9c8732a9e89fe296fc01d117a6d3f012))
* **cli:** show on-chain status before requiring private key in replicate ([986f1ac](https://github.com/Phala-Network/phala-cloud/commit/986f1acd6b925e452a0608c8fc91717822363d0f))
* **cli:** strip app_ prefix when matching cvm list by app_id ([fcfed6e](https://github.com/Phala-Network/phala-cloud/commit/fcfed6e7dab1a609ff09e52c2a1448ea1c3f4fc4))
* **cli:** support universal cvm ids for replicate ([5fa84ba](https://github.com/Phala-Network/phala-cloud/commit/5fa84ba486cb3329e6b222bbc8a4edf03e1a41a3))
* **cli:** use app CVMs endpoint for compose-hash disambiguation ([2f2266a](https://github.com/Phala-Network/phala-cloud/commit/2f2266a7ab0ffb93c94d458298ec5082111e402c))
* **cli:** use correct pubkey source for CVM replicate env encryption ([2b3b98b](https://github.com/Phala-Network/phala-cloud/commit/2b3b98b9fdcd369f94887a05cea1827978cddeb1))
* **cli:** use instance-level cvm replication ([fd0cb03](https://github.com/Phala-Network/phala-cloud/commit/fd0cb0352c35987606d1efe901fb6a6b305b6319))
* **cli:** use plaintext output for cvm replicate ([1a9ba68](https://github.com/Phala-Network/phala-cloud/commit/1a9ba688895a3334cae4a69defc3f4d429062841))
* **cli:** use sdk private key flow in allow-devices ([d697761](https://github.com/Phala-Network/phala-cloud/commit/d697761a30a7b19cbbefff61ed0b74d82ae94ae4))
* **sdk:** chain resolution, owner pre-check, and ABI error definitions ([0c6a50c](https://github.com/Phala-Network/phala-cloud/commit/0c6a50c7fc57370ecb61359f34f04210c645ca18))

### refactor

* add `phala help <topic>` subcommand with bundled topics ([8880334](https://github.com/Phala-Network/phala-cloud/commit/88803342ad4a5506642d3d517be55361659b1b0e))
* add RPC timeout + retry hint for allow-devices ([7a20577](https://github.com/Phala-Network/phala-cloud/commit/7a20577545e3da42bd37017574db962f5fc953f6))
* add transaction progress logging and RPC transport timeouts ([29849a2](https://github.com/Phala-Network/phala-cloud/commit/29849a283025fe74543254e75afae888ab29f848))
* allow direct app identifier in allow-devices to avoid CVM ambiguity ([a440bed](https://github.com/Phala-Network/phala-cloud/commit/a440bedb6334c87ed3b2bf82a6813421ee5204a4))
* log RPC URL before blockchain operations ([c9956b2](https://github.com/Phala-Network/phala-cloud/commit/c9956b22b0fe1c7a66b13f9b7bc04051600fb1f4))
* skip device list in allow-devices ls when allowAnyDevice is on ([597bbb4](https://github.com/Phala-Network/phala-cloud/commit/597bbb4be1e69d1832093ee167bf69eda801e3e2))
* unify --private-key / --rpc-url and add ETH_RPC_URL fallback ([162ff8a](https://github.com/Phala-Network/phala-cloud/commit/162ff8a0451ca799061534d3eb9711a85aebd1af))
## [1.1.14](https://github.com/Phala-Network/phala-cloud/compare/cli-v1.1.13...cli-v1.1.14) (2026-03-27)

### feat

* **cli:** add --prepare-only and --commit flags for multisig CVM updates ([99edfc0](https://github.com/Phala-Network/phala-cloud/commit/99edfc0f0a472bc8c92dc81dc1bebe26ac174ae0))
* **cli:** show chain ID and block explorer URL in --prepare-only output ([6de7e4a](https://github.com/Phala-Network/phala-cloud/commit/6de7e4aec4a8e0be258ff1db4638f2bd4e961441))
* display on-chain status in --prepare-only output ([f98f614](https://github.com/Phala-Network/phala-cloud/commit/f98f6149f13b9452099e23409964dcedbfb82ff7))
* **js,cli:** add on-chain prerequisite checks and improve update flow ([d3209e1](https://github.com/Phala-Network/phala-cloud/commit/d3209e1fd2b0be61455f5ec69de64a7919b1b7e2))
* **js:** add patchCvm and confirmCvmPatch for unified PATCH /cvms/{id} ([30cabaf](https://github.com/Phala-Network/phala-cloud/commit/30cabaf7084e72dbda656504d9f4359db95e2a16))

### fix

* **cli:** --commit mode no longer requires API key ([39bdd7a](https://github.com/Phala-Network/phala-cloud/commit/39bdd7ae98cfb39579a471e0abda3ba86cd56fb4))
* **cli:** 0x prefix on explorer URL, expired token hint ([4cb7398](https://github.com/Phala-Network/phala-cloud/commit/4cb73980850cab2a9f95f08ba0d1433c39a1faab))
* **cli:** add 0x prefix to compose hash in --prepare-only output ([62e4122](https://github.com/Phala-Network/phala-cloud/commit/62e4122486c281b82de0b538839ae3cff2ca6671))
* **cli:** add missing return after --prepare-only warning on non-on-chain CVM ([6a4abb8](https://github.com/Phala-Network/phala-cloud/commit/6a4abb8fc27fadcd90f3dc27f3cc5dc9b0a5755b))
* **cli:** fix --prepare-only output formatting for shell continuation ([732cbb8](https://github.com/Phala-Network/phala-cloud/commit/732cbb82787b04479db04d0d29f760bae78ca895))
* **cli:** fix --prepare-only output indentation, make --transaction-hash optional ([79e695f](https://github.com/Phala-Network/phala-cloud/commit/79e695f3402e38ba0c7233c30a517c63472157b2))
* **cli:** warn when --prepare-only used on non-on-chain KMS CVM ([f874b65](https://github.com/Phala-Network/phala-cloud/commit/f874b6526bcfe130e2078e5ecf4a7a64a429869c))
* **js,cli:** add missing files and fix compose hash tx verification ([7656a45](https://github.com/Phala-Network/phala-cloud/commit/7656a459ced2843a03146d6757fd019ede2f1f53))
## [1.1.13](https://github.com/Phala-Network/phala-cloud/compare/cli-v1.1.12...cli-v1.1.13) (2026-03-14)

### feat

* add device management blockchain actions to SDK and CLI ([290ca2a](https://github.com/Phala-Network/phala-cloud/commit/290ca2a8d4b246b8d9d4b87281132bf573128989))
* add os-images listing, kms on-chain detail to SDK and CLI ([9fe5c9a](https://github.com/Phala-Network/phala-cloud/commit/9fe5c9a845ca6c46d3c8777eeb8eec50476a396b))
* add phala cvms device-allowlist CLI command ([6d7b48f](https://github.com/Phala-Network/phala-cloud/commit/6d7b48f58198e85e17bc48aef56948a61f4e84dd))
* **cli,sdk:** add --fs option to deploy command for filesystem selection ([716723d](https://github.com/Phala-Network/phala-cloud/commit/716723d5e6a4ca3f443ee073dc8f74c44af162d6))
* **cli:** add --wait RPC verification for device allowlist ops ([97447f0](https://github.com/Phala-Network/phala-cloud/commit/97447f01a25a8642d50f8658ca3b005ec9cda6de))
* **cli:** add `phala envs encrypt` and `phala envs update` commands ([ddd4cfc](https://github.com/Phala-Network/phala-cloud/commit/ddd4cfc4a8c56970685d0c0478b8a5e807e99fe0))
* **cli:** add disallow-any and toggle-allow-any commands ([dbff4e5](https://github.com/Phala-Network/phala-cloud/commit/dbff4e5007d4241dad40270bfe62875011af0581))
* **cli:** add interactive multi-select for devices add/remove ([4f0f2d4](https://github.com/Phala-Network/phala-cloud/commit/4f0f2d4560cdbfd944a784fae09d4de12ab1c002))
* **cli:** add pagination flags to os-images command ([1ef6cd9](https://github.com/Phala-Network/phala-cloud/commit/1ef6cd941d88a9818e4ce196e145a9159427348b))
* **cli:** move device allowlist to top-level `phala allow-devices` ([430cd9c](https://github.com/Phala-Network/phala-cloud/commit/430cd9cd7a6e44a9f89ed0f6301e82128bae06a0))
* **kms:** simplify CLI output and include device node names ([e48019c](https://github.com/Phala-Network/phala-cloud/commit/e48019cb972c96c049aadc2e285f4b3a06de0c14))
* query and display contract owner in allow-devices list ([37fe2e1](https://github.com/Phala-Network/phala-cloud/commit/37fe2e124880f59b3e9bb0087cafb71b350781f5))

### fix

* **cli:** add viem as direct dependency for CI type-check ([bcc4df3](https://github.com/Phala-Network/phala-cloud/commit/bcc4df3bebea07e564743e17ccf0456e35734a3e))
* **cli:** address Sentry review issues in allow-devices commands ([a205282](https://github.com/Phala-Network/phala-cloud/commit/a2052828f9f5ce8324b1dbefed4df3109720c7b1))
* **cli:** ensure timeout floor of 5000ms for small command groups ([370eb98](https://github.com/Phala-Network/phala-cloud/commit/370eb985abc7a1e7b18a1de8339688ff2f7dc7eb))
* **cli:** exclude already-allowed devices from add interactive list ([f0a6b53](https://github.com/Phala-Network/phala-cloud/commit/f0a6b53ce52af6ad6d34624a707096e699a3d71d))
* **cli:** fix node name matching and separate chain line in ls ([b7a4ce3](https://github.com/Phala-Network/phala-cloud/commit/b7a4ce3ba68b5cb3713c95421bfbb5ef1ee9595e))
* **cli:** increase timeout for command existence compat tests ([a9889be](https://github.com/Phala-Network/phala-cloud/commit/a9889befdc562c4d02f38a40ad7090ab101cf7dd))
* **cli:** query chain directly for allow-devices list ([b40d8e3](https://github.com/Phala-Network/phala-cloud/commit/b40d8e39220c9a7f6491456ea2133faa3087a626))
* **cli:** remove redundant status column from devices list ([b49744d](https://github.com/Phala-Network/phala-cloud/commit/b49744df0407cd66b98dcfd0769b6fea644ad461))
* **cli:** use shared walletClient with nonceManager for batch tx ([ef93049](https://github.com/Phala-Network/phala-cloud/commit/ef93049ccf2293bfa3ecf8440fc70cccc6fa9be7))
* guard against null app_id in device-allowlist command ([0b8bdd8](https://github.com/Phala-Network/phala-cloud/commit/0b8bdd802c4d93bf8d41f1f6a77e603bdf0b506c))
* replace event scanning with readContract for device allowlist ([fb2a4b2](https://github.com/Phala-Network/phala-cloud/commit/fb2a4b275912d4bd2931c1b12d3b5b1368a26458))

### perf

* **cli:** skip prerequisite checks in batch add/remove ([e814237](https://github.com/Phala-Network/phala-cloud/commit/e814237bbf9259a9d7a397a9bfb7adec2f0d29c8))
## [1.1.12](https://github.com/Phala-Network/phala-cloud/compare/cli-v1.1.12-beta.1...cli-v1.1.12) (2026-03-04)

### feat

* **cli:** add --api-version global option ([f96397f](https://github.com/Phala-Network/phala-cloud/commit/f96397f81056af09fb854b3fc99cda09721c5e2f))

### fix

* **cli:** validate --api-version flag against supported versions ([a6b4f68](https://github.com/Phala-Network/phala-cloud/commit/a6b4f684039cf5e676160fcce2bc6f4084e26dee))
## [1.1.12-beta.1](https://github.com/Phala-Network/phala-cloud/compare/cli-v1.1.11...cli-v1.1.12-beta.1) (2026-03-03)

### feat

* **cli:** show changelog URL in self update command ([8f569e8](https://github.com/Phala-Network/phala-cloud/commit/8f569e8c4361848708e2b0e06a423686d9461942))
* **cli:** show changelog URL in update notifications ([22a6648](https://github.com/Phala-Network/phala-cloud/commit/22a6648b5f21384c4675f652bc25bcd6d0bb97e6))

### fix

* **cli:** use --no-cache and exact version for bun global installs ([a63a11d](https://github.com/Phala-Network/phala-cloud/commit/a63a11d19e0b6248e99acf93851c2dabec462fcc))
* **cli:** use generic id field in waitForCvmReady poller ([4b2132d](https://github.com/Phala-Network/phala-cloud/commit/4b2132dd25ef752ada519570efcfb0c744b1cfcb))
## [1.1.11](https://github.com/Phala-Network/phala-cloud/compare/cli-v1.1.10...cli-v1.1.11) (2026-03-02)

### fix

* **cli:** error when body provided with GET/HEAD/OPTIONS ([abf6ab9](https://github.com/Phala-Network/phala-cloud/commit/abf6ab9fd8eeddc0e2465cf10ac536dcfd479a61))
* **cli:** restore -i/--interactive flag for switch command ([b4786fa](https://github.com/Phala-Network/phala-cloud/commit/b4786fae5a2449b19e123905407c09e7c2b06239))

### refactor

* **cli:** split -f (query) and -F (body) into distinct roles ([b5c465d](https://github.com/Phala-Network/phala-cloud/commit/b5c465dfd9f7ddd90ebe877b7393413138f93ec1))
## [1.1.10](https://github.com/Phala-Network/phala-cloud/compare/cli-v1.1.9...cli-v1.1.10) (2026-02-25)

### docs

* **cli:** add ssh-keys and runtime-config command reference ([006e697](https://github.com/Phala-Network/phala-cloud/commit/006e69749ae0ffea1947d78027d03fa624e03d62))

### feat

* **cli:** improve SSH key commands ([565f36a](https://github.com/Phala-Network/phala-cloud/commit/565f36a90a1145bd68bd493d9b3857a15e24866f))
* **sdk+cli:** add SSH key and CVM runtime-config commands ([692321a](https://github.com/Phala-Network/phala-cloud/commit/692321a05bacdbc4da9bcfbc9b82ab8fcfc9d25a))

### fix

* **cli:** add --json output support to all ssh-keys commands ([6c93846](https://github.com/Phala-Network/phala-cloud/commit/6c938469d6bee77b36d34c70d5b5a5e8ff89c6ac))
* **cli:** fix selectCvm() to use correct API response shape ([47f2c34](https://github.com/Phala-Network/phala-cloud/commit/47f2c346463fdc0ee3d2dcb07660817adad29a96))
* **cli:** improve help display, interactive rm, and key naming ([e98824d](https://github.com/Phala-Network/phala-cloud/commit/e98824df39287d8f7319a0212868c7d744ffb56d))
* **cli:** ssh-keys rm requires -i for interactive mode ([fc7b4ba](https://github.com/Phala-Network/phala-cloud/commit/fc7b4bac070f2c795fa41ad53714888b02415da2))
* **cli:** tighten tilde path expansion in ssh-keys add ([3a218e8](https://github.com/Phala-Network/phala-cloud/commit/3a218e85e34f67e230c6916a15684b74384edb4c))
* **cli:** update help shorthand conflict test for current global options ([6eec811](https://github.com/Phala-Network/phala-cloud/commit/6eec8112a0f4370e6470a2308ab282124efca3d5))

### refactor

* **cli:** centralize --json handling in dispatcher ([ae05446](https://github.com/Phala-Network/phala-cloud/commit/ae054465b8389803114524e4bb8d21ef814f5b38))
* **cli:** promote runtime-config to top-level command ([5aaa56e](https://github.com/Phala-Network/phala-cloud/commit/5aaa56e76362067c70346b53110360d0721eb839))
## [1.1.9](https://github.com/Phala-Network/phala-cloud/compare/cli-v1.1.8...cli-v1.1.9) (2026-02-12)

### docs

* **cli:** group commands in README, add link to quick start, drop deprecated ([8703e6f](https://github.com/Phala-Network/phala-cloud/commit/8703e6f36c15f3260380ec370d14967555d1351e))
* **cli:** move skill to sdks/skills/, add best practices ([a96f696](https://github.com/Phala-Network/phala-cloud/commit/a96f696aa91e1169ee4f89038abc9ad48b7886ed))
* **cli:** rewrite README, add command reference and agent skill ([456bea2](https://github.com/Phala-Network/phala-cloud/commit/456bea2c82e98200c5a61f66b88c4a2dad6a8568))

### feat

* **cli:** add `phala whoami` command ([4fa9e30](https://github.com/Phala-Network/phala-cloud/commit/4fa9e3039f28e7e0bef55b55e476c5f84946a313))
* **cli:** add CVM channel log API functions ([3b867dd](https://github.com/Phala-Network/phala-cloud/commit/3b867ddaa00976b57ca7e449f100f6bdb3a5fb18))
* **cli:** redesign `phala logs` as unified log command ([f3b8a5b](https://github.com/Phala-Network/phala-cloud/commit/f3b8a5b2e1e44c516971bc85fc67c93a7c6bde26))
* **cli:** show workspace in whoami, add upgrade check to status ([5bac9cc](https://github.com/Phala-Network/phala-cloud/commit/5bac9cc2b46944c0541efd713214479233b8ea1f))

### fix

* **cli:** percent-encode query parameter values in `phala api` ([f407411](https://github.com/Phala-Network/phala-cloud/commit/f407411ebab2d5588118cab8939af84616e3ec2c))
* **cli:** print full compose hash trace in deploy --debug update flow ([1c40950](https://github.com/Phala-Network/phala-cloud/commit/1c409501af98310602c874ceeeb4543678b6ce96))
* **cli:** unify CVM ID handling across commands ([abff9bb](https://github.com/Phala-Network/phala-cloud/commit/abff9bb2e906a80a61607f7b324860763f348727))

### refactor

* **cli:** mark `cvms logs` and `cvms serial-logs` as deprecated ([c8314eb](https://github.com/Phala-Network/phala-cloud/commit/c8314eb7640b5244adb626747bf37ecd3d185be3))
## [1.1.8](https://github.com/Phala-Network/phala-cloud/compare/cli-v1.1.7...cli-v1.1.8) (2026-02-07)

### feat

* add 200KB size limit for compose file + pre-launch script ([fe45765](https://github.com/Phala-Network/phala-cloud/commit/fe4576593cc08c2576e4c91d1c2b6b68cb3b9601))
* add filter flags to apps and cvms list commands ([3f5ac90](https://github.com/Phala-Network/phala-cloud/commit/3f5ac907a08155171d93ad487ba8b226f2682e97))

### fix

* wire --pre-launch-script flag to payload and fix combined size check ([cecca57](https://github.com/Phala-Network/phala-cloud/commit/cecca57279eafecaffe4bce207f77bb561067ed6))
## [1.1.7](https://github.com/Phala-Network/phala-cloud/compare/cli-v1.1.6...cli-v1.1.7) (2026-01-31)

### feat

* use workspace slug as profile name, add profiles command, update default API dom ([5c150a0](https://github.com/Phala-Network/phala-cloud/commit/5c150a024d575414e60d6ead26f19a1fc9eaad4a))

### fix

* **cli:** use base_domain instead of cname for SSH/SCP ([4afaa6e](https://github.com/Phala-Network/phala-cloud/commit/4afaa6e5755c3dbf37d435ab30655b7233ff9b1f))
## [1.1.6](https://github.com/Phala-Network/phala-cloud/compare/cli-v1.1.5...cli-v1.1.6) (2026-01-31)

### feat

* **cli:** add `phala ps` command to list CVM containers ([4e218b1](https://github.com/Phala-Network/phala-cloud/commit/4e218b1f91b6b315422600ba037343fdf7d25ddc))
* **cli:** add `phala switch` command for profile switching ([907f1fe](https://github.com/Phala-Network/phala-cloud/commit/907f1fe693d8ca90843726b118f371cefd6deb84))
* **cli:** add phala apps command and align cvms ls output ([eb194b7](https://github.com/Phala-Network/phala-cloud/commit/eb194b74adb7433a15ee806715a2053c7ddeba3f))
* **cli:** add phala instance-types command ([7cba272](https://github.com/Phala-Network/phala-cloud/commit/7cba272c4156d79f1ed8ecf7fce0ca0d38de9e8a))
* **cli:** add phala logs command ([fa281ba](https://github.com/Phala-Network/phala-cloud/commit/fa281ba3705208f0d66ef1f6c776ba156204e8ab))
* **cli:** migrate nodes list to workspace nodes API ([08e39e7](https://github.com/Phala-Network/phala-cloud/commit/08e39e7825bf72cd627c27ff4c91ab3056213be9))
* **sdk:** add apps API actions and fix versioned client types ([3ee04e9](https://github.com/Phala-Network/phala-cloud/commit/3ee04e9611047a47890e852bdf6f3244fd457c98))

### fix

* **cli:** comply with RFC 8628 slow_down by permanently increasing polling interval ([f3eb624](https://github.com/Phala-Network/phala-cloud/commit/f3eb624db4b9a8156b679dfc62b28961ad24e6e4))
* **cli:** fix boolean flag handling and visibility update race condition ([a9f94e1](https://github.com/Phala-Network/phala-cloud/commit/a9f94e1c177e675009ea503afe92a12514d903b1))
* **cli:** improve package manager detection and self update version check ([7e89210](https://github.com/Phala-Network/phala-cloud/commit/7e892106430865a8b0580544a510429e6203e6db))
* **cli:** show actual error before public_logs hint in logs commands ([1cd3c01](https://github.com/Phala-Network/phala-cloud/commit/1cd3c01f1e1a75a1a73952eab6131d93965e9de9))
* **cli:** update help text compatibility test ([06586ec](https://github.com/Phala-Network/phala-cloud/commit/06586ec93d6b5217c9cab9583edd421ea4d501e8))
* **cli:** use legacy API version for deploy handler and E2E tests ([85dcb31](https://github.com/Phala-Network/phala-cloud/commit/85dcb31751b701a1500b45456373da22154b89eb))
* **cli:** use normalized CVM ID for serial log endpoint lookup ([33d3acb](https://github.com/Phala-Network/phala-cloud/commit/33d3acbde9b48c5ae6a93bf10880c242873e8d52))
* **cli:** use workspace slug instead of name for API calls ([fc92027](https://github.com/Phala-Network/phala-cloud/commit/fc9202784870ab8d0bf700b65c358afa3428a0ba))
* **deploy:** default public logs/sysinfo to true in CLI ([4576dea](https://github.com/Phala-Network/phala-cloud/commit/4576dea806d559fcc30ae74c6f38796141d2ce2d))
* force legacy version header for serial log endpoint lookup ([783c37c](https://github.com/Phala-Network/phala-cloud/commit/783c37cbfeef8109929531686ef13a8f0c144cef))
* typing ([8588ac2](https://github.com/Phala-Network/phala-cloud/commit/8588ac2760122f2a5aeea460a47c1b91b10f0249))
* upgrade CLI to API version 2026-01-21 ([9a92b54](https://github.com/Phala-Network/phala-cloud/commit/9a92b54038daba79f9e54e6e6c42c37744031d5c))

### refactor

* **cli:** apply anti-slop guidelines to command descriptions ([a4aa29e](https://github.com/Phala-Network/phala-cloud/commit/a4aa29e583f0a713d14e2ec25db38aa8347dd4ab))
* **cli:** replace single api-key with multi-profile credentials ([c545053](https://github.com/Phala-Network/phala-cloud/commit/c5450535797844c996d96eea58d068c33eaca2c3))
* **cli:** simplify --dev-os/--non-dev-os to single flag with negatedName ([556d7a0](https://github.com/Phala-Network/phala-cloud/commit/556d7a0a4c97d3dc1764d77a9849ae0e8bad3b4b))
* **cli:** unify error handling with SDK's ResourceError ([fd815b1](https://github.com/Phala-Network/phala-cloud/commit/fd815b13a241a1c22d0c59ae24f99cfec8828712))
* extract auth schemas into credentials module and fix CLI type safety ([21a545b](https://github.com/Phala-Network/phala-cloud/commit/21a545b3901c80a203372195358cbcb37dcfad5f))
## [1.1.5](https://github.com/Phala-Network/phala-cloud/compare/cli-v1.1.4...cli-v1.1.5) (2026-01-23)

### feat

* **cli:** add -d/--data and @file syntax for api command ([93d6bb3](https://github.com/Phala-Network/phala-cloud/commit/93d6bb3670283e92fd15f8ba676d615b96b20e98))
* **cli:** add privacy settings to deploy command ([edf9b40](https://github.com/Phala-Network/phala-cloud/commit/edf9b407d154f696ca2521af2bbc1d01971f3cd3)), closes [#148](https://github.com/Phala-Network/phala-cloud/issues/148)
* **cli:** improve help output with option grouping ([e67faa8](https://github.com/Phala-Network/phala-cloud/commit/e67faa808b6fcbedd1e22b5fe40629a25f6de877))
* **cli:** simplify KMS option to --kms [phala|ethereum|eth|base] ([35d1fcd](https://github.com/Phala-Network/phala-cloud/commit/35d1fcd090c4dceaa8b502297a26d552b3ca4195))

### fix

* **cli:** make --custom-app-id work correctly in deploy command ([ba64170](https://github.com/Phala-Network/phala-cloud/commit/ba64170adf5c6e26321290d7276a570e6d1329f3))
* **cli:** use real Phala gateway domain in help examples ([0c6765d](https://github.com/Phala-Network/phala-cloud/commit/0c6765d0b422c647f228c6d67283d76fbf18d9d3)), closes [#139](https://github.com/Phala-Network/phala-cloud/issues/139)
## [1.1.4](https://github.com/Phala-Network/phala-cloud/compare/cli-v1.1.4-beta.1...cli-v1.1.4) (2026-01-19)

### feat

* **cli:** add link command to connect local directory to existing CVM ([9c33607](https://github.com/Phala-Network/phala-cloud/commit/9c33607e546ded7e373b3b80173fdeac07ad419e))
* **cli:** add update check and self update ([714ea99](https://github.com/Phala-Network/phala-cloud/commit/714ea995c17992a43fe69dfd2069641238ef5861))

### fix

* **cli:** auto-switch to POST when body parameters are provided ([f0f8551](https://github.com/Phala-Network/phala-cloud/commit/f0f8551c3fb592b0582c8dc290496956e65e85da))
* **cli:** change deploy command JSON output default to false ([db89fc8](https://github.com/Phala-Network/phala-cloud/commit/db89fc86a686d4f8aea06ec1b61b19b0301dde8e))
* **cli:** require --yes for non-interactive self update ([50445ee](https://github.com/Phala-Network/phala-cloud/commit/50445eed936f0083407c538a7714c5f3fe896baf))
* **cli:** restore arg parsing inside try-catch block ([fbbb020](https://github.com/Phala-Network/phala-cloud/commit/fbbb02024c218e7a942dae193be8858de1d77f30))
* **cli:** truncate description to first line in command listings ([c575c33](https://github.com/Phala-Network/phala-cloud/commit/c575c33e996a7a02f814dd1ed950e4acc6b67de4))
## [1.1.4-beta.1](https://github.com/Phala-Network/phala-cloud/compare/cli-v1.1.3...cli-v1.1.4-beta.1) (2026-01-17)

### docs

* **cli:** clarify that deploy command supports both create and update ([ed53f48](https://github.com/Phala-Network/phala-cloud/commit/ed53f4863d5a93b01dbf28310d4910f768e338cc))

### feat

* **cli:** add api command for raw HTTP requests ([eaaecec](https://github.com/Phala-Network/phala-cloud/commit/eaaecec8a38421b29f62b6e9eb908215b837f987))
* **cli:** add update check and self update ([e88f795](https://github.com/Phala-Network/phala-cloud/commit/e88f795ed26451e751577895543eb05d015583e9))

## [1.1.3](https://github.com/Phala-Network/phala-cloud/compare/cli-v1.1.3-beta.1...cli-v1.1.3) (2026-01-16)
## [1.1.3-beta.1](https://github.com/Phala-Network/phala-cloud/compare/cli-v1.1.2...cli-v1.1.3-beta.1) (2026-01-16)

### feat

* **cli:** add unit tests for prefer_dev payload building ([0910785](https://github.com/Phala-Network/phala-cloud/commit/09107857b41260d859f8033c500f1044ed5511d7))

### fix

* migrate URLs from cloud.phala.network to cloud.phala.com ([cd48ed4](https://github.com/Phala-Network/phala-cloud/commit/cd48ed4a69ffc3bd4f4c8483946cf21c2b5d38a6))
* **release:** handle main branch protection and improve release UX ([963e9f9](https://github.com/Phala-Network/phala-cloud/commit/963e9f9391582ba0f33217635e3fdcc18ebc85d7))
* **sdk:** smart default for instance_type to allow vcpu/memory params to work ([9f0780d](https://github.com/Phala-Network/phala-cloud/commit/9f0780d892d43bcb354a5ada1b8edf7c2912e0fc))
## [1.1.2](https://github.com/Phala-Network/phala-cloud/compare/cli-v1.1.1...cli-v1.1.2) (2026-01-09)

### fix

* **cli:** Update environment variables when using onchain KMS ([3acbb61](https://github.com/Phala-Network/phala-cloud/commit/3acbb618ccc2b6e95fd134ceb7a8286fd27e7569))

## [1.1.1](https://github.com/Phala-Network/phala-cloud/compare/cli-v1.1.0...cli-v1.1.1) (2026-01-06)

### doc

* **cli:** document --json flag for machine-readable output ([19a5b9b](https://github.com/Phala-Network/phala-cloud/commit/19a5b9bd307bef2821ca4163306ed8900b007bb9)), closes [#87](https://github.com/Phala-Network/phala-cloud/issues/87)
* **cli:** document PHALA_CLOUD_API_KEYa ([700f260](https://github.com/Phala-Network/phala-cloud/commit/700f260ada808c088cb8c2c55c4074ed820a7367))
* **cli:** document PHALA_CLOUD_API_PREFIX environment variable ([c7a4816](https://github.com/Phala-Network/phala-cloud/commit/c7a481698a9d0dc4a1784ff495b69bb4d4610a40))

### docs

* **cli:** clarify single-container behavior in logs functions ([d5cc675](https://github.com/Phala-Network/phala-cloud/commit/d5cc675718f6defea3c737d143d1ea022c04905c))

### feat

* **cli:** add --interactive flag to logs commands ([4d7e7f4](https://github.com/Phala-Network/phala-cloud/commit/4d7e7f4889125fe8e6007447ff006ac3a830f53e))
* **cli:** add logs and serial-logs commands for CVMs ([793de6b](https://github.com/Phala-Network/phala-cloud/commit/793de6b6c5e1545e270109228fbfc127c0692cf3))

### fix

* **cli:** remove spinner from logs command for pipeline compatibility ([89b44d4](https://github.com/Phala-Network/phala-cloud/commit/89b44d4b750807a1a797980ae3536977dfd91d2e))
* **cli:** use SDK CvmIdSchema for proper CVM ID resolution in logs ([aa58744](https://github.com/Phala-Network/phala-cloud/commit/aa587444fab8a36e74d100dfa8b927bc45e190e6))

### refactor

* **cli:** improve logs command robustness and error messages ([f0f1b9e](https://github.com/Phala-Network/phala-cloud/commit/f0f1b9ed1eb253dc5858f363276479e9986ffdee))
* **cli:** improve logs commands based on review ([ee891ec](https://github.com/Phala-Network/phala-cloud/commit/ee891ec215036071b352ac4a5821ad3ed5b31186))
* **cli:** inline extractCvmId function in logs handler ([6dfaa06](https://github.com/Phala-Network/phala-cloud/commit/6dfaa06488b8f875fff3fd2a0d207bb65284e233))
## 1.1.0 (2025-12-22)

### docs

* added api versioning docs ([443f71c](https://github.com/Phala-Network/phala-cloud/commit/443f71c7873eae7fc81e6760b716614edcc55f7f))

### feat

* add auto-converter for cvm name generation & validator ([ec8b6d6](https://github.com/Phala-Network/phala-cloud/commit/ec8b6d6b06c22202339fddbbd90a8ef4699f91dc))
* add CLI completion support ([37dc21b](https://github.com/Phala-Network/phala-cloud/commit/37dc21b14bb7377bbdefd35c9663bf0a74bda4ab))
* add libressl check for ssh related commands ([402b5c1](https://github.com/Phala-Network/phala-cloud/commit/402b5c1ef892c426166aed9e0bcd396de1f0b440))
* add pass through support for ssh ([2f1a27b](https://github.com/Phala-Network/phala-cloud/commit/2f1a27b40ce8c8923d9c1c12a3faef0546ee9006))
* added phala.toml support ([e02c130](https://github.com/Phala-Network/phala-cloud/commit/e02c1307790066f0de4e2d9913acb8ebb5ab6650))
* cli add customize ssh pubkey when deploy ([d9c8249](https://github.com/Phala-Network/phala-cloud/commit/d9c824904813d70ee2661b723c504f961ce95bd9))
* **cli:** add --dry-run option to ssh and cp commands ([e08dff9](https://github.com/Phala-Network/phala-cloud/commit/e08dff92251e63b1d0116c3423d7b495b865566c))
* **cli:** add --json flag support to multiple commands ([1ea0c34](https://github.com/Phala-Network/phala-cloud/commit/1ea0c348bb5b7fb3d5db055a67dfb29b758fa4f3))
* **cli:** add --wait flag to deploy command for CVM updates ([b11f739](https://github.com/Phala-Network/phala-cloud/commit/b11f73982391fa1c46beef4f968cd8ad02dacbc2))
* **cli:** add --wait flag to deploy command for CVM updates ([bf0f85a](https://github.com/Phala-Network/phala-cloud/commit/bf0f85ae5c519cf11a81345be2aa0c391130c72b))
* **cli:** add stability classification to commands ([46635fe](https://github.com/Phala-Network/phala-cloud/commit/46635febba351ef8f34c75a8c74009d0677c031d)), closes [#118](https://github.com/Phala-Network/phala-cloud/issues/118)
* **cli:** added command ssh ([89161d9](https://github.com/Phala-Network/phala-cloud/commit/89161d930321833abbb2f85fe2d93ae7619182f1))
* **cli:** added cp command ([4d320c5](https://github.com/Phala-Network/phala-cloud/commit/4d320c5ed07541200aa2a21f16b340afb7f3df2d))
* **cli:** embed git commit info in version at build time ([a8f31fc](https://github.com/Phala-Network/phala-cloud/commit/a8f31fc4ab613f5195b3da3a84dc5334c99b859c))
* **cli:** inject project config resolver on cli startup ([4eb1f79](https://github.com/Phala-Network/phala-cloud/commit/4eb1f79384ef3a08dd06168baafc167f089989ae))
* **cli:** open browser & login workflow ([2b56074](https://github.com/Phala-Network/phala-cloud/commit/2b560742b9e6f9e1d3f1da173d3d05e6feac880e))
* **cli:** retry on http 409 ([11091c7](https://github.com/Phala-Network/phala-cloud/commit/11091c7845623de6fba20240764b610b451908aa))
* **cli:** skip API call in SSH command when gateway domain is provided ([73bf977](https://github.com/Phala-Network/phala-cloud/commit/73bf9776e7d3bd36d71d25a20a001cb64bf650f5))
* **cli:** support -e KEY=VALUE format for deploy command ([d152c12](https://github.com/Phala-Network/phala-cloud/commit/d152c12d63e5f168c6c70d7d56f1b5f8f3aa3e87))
* **cli:** warn when ssh/cp target CVM is not a dev image ([a7e6157](https://github.com/Phala-Network/phala-cloud/commit/a7e6157fdf77c35ca39601b384724ca1aa0d6708))
* for ssh command also support read gateway port from phala.toml ([1360f9b](https://github.com/Phala-Network/phala-cloud/commit/1360f9b3d3cac4a2b6992bf54fc1948612127553))
* improve error handling for cli login ([b71b648](https://github.com/Phala-Network/phala-cloud/commit/b71b648c486059d157cb66f8ce99378467c6c3fe))
* improve error message & fix linting ([cc177ff](https://github.com/Phala-Network/phala-cloud/commit/cc177ff923a499fee05b9f18fc3199bf2569a66e))
* move auth login to login and added deprecated warning ([dd1c096](https://github.com/Phala-Network/phala-cloud/commit/dd1c096208e2dd81623a8c6e730bef4a9a780770))
* move cvm id parsing & interactive mode handler to dispatcher ([aed96be](https://github.com/Phala-Network/phala-cloud/commit/aed96becab8a67a48d375e48974df56a13da8f89))
* no spinner for json mode ([9daf848](https://github.com/Phala-Network/phala-cloud/commit/9daf848a1d082d9531b7c0d7d7fd6f2ab0d5ba40))
* only set ssh pubkey automatically on deploying ([c26a2e1](https://github.com/Phala-Network/phala-cloud/commit/c26a2e16438f8a7cb2569313cf50e42041146ba2))
* refine cvm_id parsing & loading for deploy & ssh command ([b2bb5a2](https://github.com/Phala-Network/phala-cloud/commit/b2bb5a21b146b0ceb3f424e6ef4fc6906ebb84f5))
* rename cvm-id to cvm-name, shorten gateway-domain to gateway in args ([602b0cd](https://github.com/Phala-Network/phala-cloud/commit/602b0cd409c522bf2b00b14819089b5e741b67d0))
* show help message as default behavior ([ed60eec](https://github.com/Phala-Network/phala-cloud/commit/ed60eecc66056868debb23f51937c71014020c0a))
* unify name convention across cli & sdk ([9f0d1e5](https://github.com/Phala-Network/phala-cloud/commit/9f0d1e5d5f7b600a1c963816ce38bd1b402885ef))
* using universal cvm_id in CLI ([86f12fd](https://github.com/Phala-Network/phala-cloud/commit/86f12fd783da9d166c1a455269afdf4eba40e705))

### fix

* CLI error handling to expose full HTTP details ([e74eb37](https://github.com/Phala-Network/phala-cloud/commit/e74eb377a276ae0cbb0c4521b893f92330861cce))
* **cli-ssh:** -v not pass through to final args ([9ce4123](https://github.com/Phala-Network/phala-cloud/commit/9ce412363e0f6eb53c51f9a0297091c22c65b147))
* **cli:** adapt error-handling to new SDK error types ([0ab651b](https://github.com/Phala-Network/phala-cloud/commit/0ab651b78677632d815eeaf7a5e4e2ffeb0892cb))
* **cli:** expose full HTTP details in error handling ([1861230](https://github.com/Phala-Network/phala-cloud/commit/1861230ef96406b55b4a99e7228363fbb1ea5d98))
* **cli:** improve non-interactive mode and JSON output ([9e9e2e2](https://github.com/Phala-Network/phala-cloud/commit/9e9e2e236e00995ba23c4f3e30f2211ba9388b28))
* **cli:** mark 6 fields as nullable in CVM schemas ([80f5230](https://github.com/Phala-Network/phala-cloud/commit/80f523056e967e099a438f5a9a013435e0675b44))
* **cli:** resize command JSON output and E2E test reliability ([6733ec6](https://github.com/Phala-Network/phala-cloud/commit/6733ec618ee42e3c190b3696e432c47cd3736bd1))
* **cli:** resolve lint and type-check errors ([90d996f](https://github.com/Phala-Network/phala-cloud/commit/90d996f595c1c3b5d4aa21feefa2e5e01483c670))
* **cli:** restore v1.0.40 compatibility and add interface tests ([77d7e79](https://github.com/Phala-Network/phala-cloud/commit/77d7e79d0bb112fd10db7f1573cf059df888e03e))
* **cli:** schema validation and automation improvements ([83924e1](https://github.com/Phala-Network/phala-cloud/commit/83924e1c180e4ee72f285c5dcf79f8c36962e69e))
* compatible to latest sdk ([cf418e4](https://github.com/Phala-Network/phala-cloud/commit/cf418e449b3bc6417abc50455ddd448f11360069))
* gateway domain maybe with port suffix ([0fc6332](https://github.com/Phala-Network/phala-cloud/commit/0fc633280ec47f6fb19f0f9ab48cf1cc5c7a6954))
* improve interactive deploy experience ([8974b52](https://github.com/Phala-Network/phala-cloud/commit/8974b5257934cd3d2a9a5478dab10c1f85525da4))
* kms list item types ([31bef68](https://github.com/Phala-Network/phala-cloud/commit/31bef689027e99fab0eca83516cd4a1385d30a61))
* make sigstore happier ([58b8063](https://github.com/Phala-Network/phala-cloud/commit/58b8063f78a21cdd8e70a5985081d524fa789db6))
* remove cli's 250G limit of disk size ([3e914b2](https://github.com/Phala-Network/phala-cloud/commit/3e914b25b4a93a5450631ba1e0c203bc3e483474))
* remove cvm's name length limit ([be523e8](https://github.com/Phala-Network/phala-cloud/commit/be523e849f2439b216e6efc331af2b5003118c90))
* remove non-existent error-handling import in ssh command ([59f33c1](https://github.com/Phala-Network/phala-cloud/commit/59f33c15efeeea68930d05aba445eb95c0728999))
* **sdk,cli:** send update_env_vars flag when updating CVM env vars ([26077d1](https://github.com/Phala-Network/phala-cloud/commit/26077d17e418182d96b995e23e26a48da697d3ea))
* skip start/stop/restart response schema ([5bbc953](https://github.com/Phala-Network/phala-cloud/commit/5bbc9532ae1ac19ee8ce027892ff9dc79d03806e))
* the built artifact should bundled @phala/cloud as well ([c47324e](https://github.com/Phala-Network/phala-cloud/commit/c47324e55d51c5f0ba372cebdb5b9255a24ab8b3))
* the envs not update with deploy command ([1d23a32](https://github.com/Phala-Network/phala-cloud/commit/1d23a32f11e8fb1e8baf71171dc1dfd597ab4da5))
* typing. ([3da96ab](https://github.com/Phala-Network/phala-cloud/commit/3da96ab02195d6bb2b436491a81aee9449f77c75))

### refactor

* apis ([ca0b974](https://github.com/Phala-Network/phala-cloud/commit/ca0b974705a3a97cf132c32aac965ed6617c2dbc))
* CI ([565e382](https://github.com/Phala-Network/phala-cloud/commit/565e38278efad02ab785ebfacb29203ba38ba96f))
* **cli:** remove unused import ([55860f1](https://github.com/Phala-Network/phala-cloud/commit/55860f190253ae7dc04ee6841c5117880d7f7784))
* **cli:** unify JSON output with context.success/fail methods ([b825bcc](https://github.com/Phala-Network/phala-cloud/commit/b825bcc0517566a6e66232f6c31a2984ceb3f97b))
* fix build check ([bc39d18](https://github.com/Phala-Network/phala-cloud/commit/bc39d18d0706f34cd1d298a4299d1cecb04d1d9b))
* move login, logout, status from sub-command to top-level command ([cfc9fb9](https://github.com/Phala-Network/phala-cloud/commit/cfc9fb9e12d2bc977695a42cd29cb085d23b0296))
* move to arg + zod ([e7d5922](https://github.com/Phala-Network/phala-cloud/commit/e7d59226547b552af4e8d2714bbc46b0829f4cc6))
* removed constant API_ENDPOINTS ([e9e944a](https://github.com/Phala-Network/phala-cloud/commit/e9e944a5b7b4c2b5a971b28f702098e931fc7f98))
* ssh & cp with ssh-utils.ts ([2542ec7](https://github.com/Phala-Network/phala-cloud/commit/2542ec780fe4ee3249e18ddf29230336740477d6))
* unify CVM ID resolution across commands ([f6cf8b2](https://github.com/Phala-Network/phala-cloud/commit/f6cf8b209db83cb06c6a324d157396bad0a98f0f))
* use latest sdk in cli as possible ([cb0b815](https://github.com/Phala-Network/phala-cloud/commit/cb0b81570a411d9e55a77738697dc3082667a830))
* use sdk as possible. ([9efa163](https://github.com/Phala-Network/phala-cloud/commit/9efa1630db360d840b2bd1eb72d21be5d3f62144))
## 1.1.0-beta.14 (2025-12-16)

### docs

* added api versioning docs ([443f71c](https://github.com/Phala-Network/phala-cloud/commit/443f71c7873eae7fc81e6760b716614edcc55f7f))

### feat

* add auto-converter for cvm name generation & validator ([ec8b6d6](https://github.com/Phala-Network/phala-cloud/commit/ec8b6d6b06c22202339fddbbd90a8ef4699f91dc))
* add CLI completion support ([37dc21b](https://github.com/Phala-Network/phala-cloud/commit/37dc21b14bb7377bbdefd35c9663bf0a74bda4ab))
* add libressl check for ssh related commands ([402b5c1](https://github.com/Phala-Network/phala-cloud/commit/402b5c1ef892c426166aed9e0bcd396de1f0b440))
* add pass through support for ssh ([2f1a27b](https://github.com/Phala-Network/phala-cloud/commit/2f1a27b40ce8c8923d9c1c12a3faef0546ee9006))
* added phala.toml support ([e02c130](https://github.com/Phala-Network/phala-cloud/commit/e02c1307790066f0de4e2d9913acb8ebb5ab6650))
* cli add customize ssh pubkey when deploy ([d9c8249](https://github.com/Phala-Network/phala-cloud/commit/d9c824904813d70ee2661b723c504f961ce95bd9))
* **cli:** add --dry-run option to ssh and cp commands ([e08dff9](https://github.com/Phala-Network/phala-cloud/commit/e08dff92251e63b1d0116c3423d7b495b865566c))
* **cli:** add --json flag support to multiple commands ([1ea0c34](https://github.com/Phala-Network/phala-cloud/commit/1ea0c348bb5b7fb3d5db055a67dfb29b758fa4f3))
* **cli:** add --wait flag to deploy command for CVM updates ([b11f739](https://github.com/Phala-Network/phala-cloud/commit/b11f73982391fa1c46beef4f968cd8ad02dacbc2))
* **cli:** add --wait flag to deploy command for CVM updates ([bf0f85a](https://github.com/Phala-Network/phala-cloud/commit/bf0f85ae5c519cf11a81345be2aa0c391130c72b))
* **cli:** add stability classification to commands ([46635fe](https://github.com/Phala-Network/phala-cloud/commit/46635febba351ef8f34c75a8c74009d0677c031d)), closes [#118](https://github.com/Phala-Network/phala-cloud/issues/118)
* **cli:** added command ssh ([89161d9](https://github.com/Phala-Network/phala-cloud/commit/89161d930321833abbb2f85fe2d93ae7619182f1))
* **cli:** added cp command ([4d320c5](https://github.com/Phala-Network/phala-cloud/commit/4d320c5ed07541200aa2a21f16b340afb7f3df2d))
* **cli:** embed git commit info in version at build time ([a8f31fc](https://github.com/Phala-Network/phala-cloud/commit/a8f31fc4ab613f5195b3da3a84dc5334c99b859c))
* **cli:** inject project config resolver on cli startup ([4eb1f79](https://github.com/Phala-Network/phala-cloud/commit/4eb1f79384ef3a08dd06168baafc167f089989ae))
* **cli:** open browser & login workflow ([2b56074](https://github.com/Phala-Network/phala-cloud/commit/2b560742b9e6f9e1d3f1da173d3d05e6feac880e))
* **cli:** retry on http 409 ([11091c7](https://github.com/Phala-Network/phala-cloud/commit/11091c7845623de6fba20240764b610b451908aa))
* **cli:** skip API call in SSH command when gateway domain is provided ([73bf977](https://github.com/Phala-Network/phala-cloud/commit/73bf9776e7d3bd36d71d25a20a001cb64bf650f5))
* **cli:** support -e KEY=VALUE format for deploy command ([d152c12](https://github.com/Phala-Network/phala-cloud/commit/d152c12d63e5f168c6c70d7d56f1b5f8f3aa3e87))
* **cli:** warn when ssh/cp target CVM is not a dev image ([a7e6157](https://github.com/Phala-Network/phala-cloud/commit/a7e6157fdf77c35ca39601b384724ca1aa0d6708))
* for ssh command also support read gateway port from phala.toml ([1360f9b](https://github.com/Phala-Network/phala-cloud/commit/1360f9b3d3cac4a2b6992bf54fc1948612127553))
* improve error handling for cli login ([b71b648](https://github.com/Phala-Network/phala-cloud/commit/b71b648c486059d157cb66f8ce99378467c6c3fe))
* improve error message & fix linting ([cc177ff](https://github.com/Phala-Network/phala-cloud/commit/cc177ff923a499fee05b9f18fc3199bf2569a66e))
* move auth login to login and added deprecated warning ([dd1c096](https://github.com/Phala-Network/phala-cloud/commit/dd1c096208e2dd81623a8c6e730bef4a9a780770))
* move cvm id parsing & interactive mode handler to dispatcher ([aed96be](https://github.com/Phala-Network/phala-cloud/commit/aed96becab8a67a48d375e48974df56a13da8f89))
* no spinner for json mode ([9daf848](https://github.com/Phala-Network/phala-cloud/commit/9daf848a1d082d9531b7c0d7d7fd6f2ab0d5ba40))
* only set ssh pubkey automatically on deploying ([c26a2e1](https://github.com/Phala-Network/phala-cloud/commit/c26a2e16438f8a7cb2569313cf50e42041146ba2))
* refine cvm_id parsing & loading for deploy & ssh command ([b2bb5a2](https://github.com/Phala-Network/phala-cloud/commit/b2bb5a21b146b0ceb3f424e6ef4fc6906ebb84f5))
* rename cvm-id to cvm-name, shorten gateway-domain to gateway in args ([602b0cd](https://github.com/Phala-Network/phala-cloud/commit/602b0cd409c522bf2b00b14819089b5e741b67d0))
* show help message as default behavior ([ed60eec](https://github.com/Phala-Network/phala-cloud/commit/ed60eecc66056868debb23f51937c71014020c0a))
* unify name convention across cli & sdk ([9f0d1e5](https://github.com/Phala-Network/phala-cloud/commit/9f0d1e5d5f7b600a1c963816ce38bd1b402885ef))
* using universal cvm_id in CLI ([86f12fd](https://github.com/Phala-Network/phala-cloud/commit/86f12fd783da9d166c1a455269afdf4eba40e705))

### fix

* CLI error handling to expose full HTTP details ([e74eb37](https://github.com/Phala-Network/phala-cloud/commit/e74eb377a276ae0cbb0c4521b893f92330861cce))
* **cli-ssh:** -v not pass through to final args ([9ce4123](https://github.com/Phala-Network/phala-cloud/commit/9ce412363e0f6eb53c51f9a0297091c22c65b147))
* **cli:** adapt error-handling to new SDK error types ([0ab651b](https://github.com/Phala-Network/phala-cloud/commit/0ab651b78677632d815eeaf7a5e4e2ffeb0892cb))
* **cli:** expose full HTTP details in error handling ([1861230](https://github.com/Phala-Network/phala-cloud/commit/1861230ef96406b55b4a99e7228363fbb1ea5d98))
* **cli:** improve non-interactive mode and JSON output ([9e9e2e2](https://github.com/Phala-Network/phala-cloud/commit/9e9e2e236e00995ba23c4f3e30f2211ba9388b28))
* **cli:** mark 6 fields as nullable in CVM schemas ([80f5230](https://github.com/Phala-Network/phala-cloud/commit/80f523056e967e099a438f5a9a013435e0675b44))
* **cli:** resize command JSON output and E2E test reliability ([6733ec6](https://github.com/Phala-Network/phala-cloud/commit/6733ec618ee42e3c190b3696e432c47cd3736bd1))
* **cli:** resolve lint and type-check errors ([90d996f](https://github.com/Phala-Network/phala-cloud/commit/90d996f595c1c3b5d4aa21feefa2e5e01483c670))
* **cli:** restore v1.0.40 compatibility and add interface tests ([77d7e79](https://github.com/Phala-Network/phala-cloud/commit/77d7e79d0bb112fd10db7f1573cf059df888e03e))
* **cli:** schema validation and automation improvements ([83924e1](https://github.com/Phala-Network/phala-cloud/commit/83924e1c180e4ee72f285c5dcf79f8c36962e69e))
* compatible to latest sdk ([cf418e4](https://github.com/Phala-Network/phala-cloud/commit/cf418e449b3bc6417abc50455ddd448f11360069))
* gateway domain maybe with port suffix ([0fc6332](https://github.com/Phala-Network/phala-cloud/commit/0fc633280ec47f6fb19f0f9ab48cf1cc5c7a6954))
* improve interactive deploy experience ([8974b52](https://github.com/Phala-Network/phala-cloud/commit/8974b5257934cd3d2a9a5478dab10c1f85525da4))
* kms list item types ([31bef68](https://github.com/Phala-Network/phala-cloud/commit/31bef689027e99fab0eca83516cd4a1385d30a61))
* make sigstore happier ([58b8063](https://github.com/Phala-Network/phala-cloud/commit/58b8063f78a21cdd8e70a5985081d524fa789db6))
* remove cli's 250G limit of disk size ([3e914b2](https://github.com/Phala-Network/phala-cloud/commit/3e914b25b4a93a5450631ba1e0c203bc3e483474))
* remove cvm's name length limit ([be523e8](https://github.com/Phala-Network/phala-cloud/commit/be523e849f2439b216e6efc331af2b5003118c90))
* remove non-existent error-handling import in ssh command ([59f33c1](https://github.com/Phala-Network/phala-cloud/commit/59f33c15efeeea68930d05aba445eb95c0728999))
* **sdk,cli:** send update_env_vars flag when updating CVM env vars ([26077d1](https://github.com/Phala-Network/phala-cloud/commit/26077d17e418182d96b995e23e26a48da697d3ea))
* skip start/stop/restart response schema ([5bbc953](https://github.com/Phala-Network/phala-cloud/commit/5bbc9532ae1ac19ee8ce027892ff9dc79d03806e))
* the built artifact should bundled @phala/cloud as well ([c47324e](https://github.com/Phala-Network/phala-cloud/commit/c47324e55d51c5f0ba372cebdb5b9255a24ab8b3))
* the envs not update with deploy command ([1d23a32](https://github.com/Phala-Network/phala-cloud/commit/1d23a32f11e8fb1e8baf71171dc1dfd597ab4da5))
* typing. ([3da96ab](https://github.com/Phala-Network/phala-cloud/commit/3da96ab02195d6bb2b436491a81aee9449f77c75))

### refactor

* apis ([ca0b974](https://github.com/Phala-Network/phala-cloud/commit/ca0b974705a3a97cf132c32aac965ed6617c2dbc))
* CI ([565e382](https://github.com/Phala-Network/phala-cloud/commit/565e38278efad02ab785ebfacb29203ba38ba96f))
* **cli:** remove unused import ([55860f1](https://github.com/Phala-Network/phala-cloud/commit/55860f190253ae7dc04ee6841c5117880d7f7784))
* **cli:** unify JSON output with context.success/fail methods ([b825bcc](https://github.com/Phala-Network/phala-cloud/commit/b825bcc0517566a6e66232f6c31a2984ceb3f97b))
* fix build check ([bc39d18](https://github.com/Phala-Network/phala-cloud/commit/bc39d18d0706f34cd1d298a4299d1cecb04d1d9b))
* move login, logout, status from sub-command to top-level command ([cfc9fb9](https://github.com/Phala-Network/phala-cloud/commit/cfc9fb9e12d2bc977695a42cd29cb085d23b0296))
* move to arg + zod ([e7d5922](https://github.com/Phala-Network/phala-cloud/commit/e7d59226547b552af4e8d2714bbc46b0829f4cc6))
* removed constant API_ENDPOINTS ([e9e944a](https://github.com/Phala-Network/phala-cloud/commit/e9e944a5b7b4c2b5a971b28f702098e931fc7f98))
* ssh & cp with ssh-utils.ts ([2542ec7](https://github.com/Phala-Network/phala-cloud/commit/2542ec780fe4ee3249e18ddf29230336740477d6))
* unify CVM ID resolution across commands ([f6cf8b2](https://github.com/Phala-Network/phala-cloud/commit/f6cf8b209db83cb06c6a324d157396bad0a98f0f))
* use latest sdk in cli as possible ([cb0b815](https://github.com/Phala-Network/phala-cloud/commit/cb0b81570a411d9e55a77738697dc3082667a830))
* use sdk as possible. ([9efa163](https://github.com/Phala-Network/phala-cloud/commit/9efa1630db360d840b2bd1eb72d21be5d3f62144))
## 1.1.0-beta.13 (2025-12-04)

### docs

* added api versioning docs ([443f71c](https://github.com/Phala-Network/phala-cloud/commit/443f71c7873eae7fc81e6760b716614edcc55f7f))

### feat

* add auto-converter for cvm name generation & validator ([ec8b6d6](https://github.com/Phala-Network/phala-cloud/commit/ec8b6d6b06c22202339fddbbd90a8ef4699f91dc))
* add CLI completion support ([37dc21b](https://github.com/Phala-Network/phala-cloud/commit/37dc21b14bb7377bbdefd35c9663bf0a74bda4ab))
* added phala.toml support ([e02c130](https://github.com/Phala-Network/phala-cloud/commit/e02c1307790066f0de4e2d9913acb8ebb5ab6650))
* cli add customize ssh pubkey when deploy ([d9c8249](https://github.com/Phala-Network/phala-cloud/commit/d9c824904813d70ee2661b723c504f961ce95bd9))
* **cli:** add --json flag support to multiple commands ([1ea0c34](https://github.com/Phala-Network/phala-cloud/commit/1ea0c348bb5b7fb3d5db055a67dfb29b758fa4f3))
* **cli:** add --wait flag to deploy command for CVM updates ([b11f739](https://github.com/Phala-Network/phala-cloud/commit/b11f73982391fa1c46beef4f968cd8ad02dacbc2))
* **cli:** add --wait flag to deploy command for CVM updates ([bf0f85a](https://github.com/Phala-Network/phala-cloud/commit/bf0f85ae5c519cf11a81345be2aa0c391130c72b))
* **cli:** added command ssh ([89161d9](https://github.com/Phala-Network/phala-cloud/commit/89161d930321833abbb2f85fe2d93ae7619182f1))
* **cli:** added cp command ([4d320c5](https://github.com/Phala-Network/phala-cloud/commit/4d320c5ed07541200aa2a21f16b340afb7f3df2d))
* **cli:** embed git commit info in version at build time ([a8f31fc](https://github.com/Phala-Network/phala-cloud/commit/a8f31fc4ab613f5195b3da3a84dc5334c99b859c))
* **cli:** inject project config resolver on cli startup ([4eb1f79](https://github.com/Phala-Network/phala-cloud/commit/4eb1f79384ef3a08dd06168baafc167f089989ae))
* **cli:** open browser & login workflow ([2b56074](https://github.com/Phala-Network/phala-cloud/commit/2b560742b9e6f9e1d3f1da173d3d05e6feac880e))
* **cli:** retry on http 409 ([11091c7](https://github.com/Phala-Network/phala-cloud/commit/11091c7845623de6fba20240764b610b451908aa))
* **cli:** skip API call in SSH command when gateway domain is provided ([73bf977](https://github.com/Phala-Network/phala-cloud/commit/73bf9776e7d3bd36d71d25a20a001cb64bf650f5))
* for ssh command also support read gateway port from phala.toml ([1360f9b](https://github.com/Phala-Network/phala-cloud/commit/1360f9b3d3cac4a2b6992bf54fc1948612127553))
* improve error handling for cli login ([b71b648](https://github.com/Phala-Network/phala-cloud/commit/b71b648c486059d157cb66f8ce99378467c6c3fe))
* improve error message & fix linting ([cc177ff](https://github.com/Phala-Network/phala-cloud/commit/cc177ff923a499fee05b9f18fc3199bf2569a66e))
* move auth login to login and added deprecated warning ([dd1c096](https://github.com/Phala-Network/phala-cloud/commit/dd1c096208e2dd81623a8c6e730bef4a9a780770))
* move cvm id parsing & interactive mode handler to dispatcher ([aed96be](https://github.com/Phala-Network/phala-cloud/commit/aed96becab8a67a48d375e48974df56a13da8f89))
* no spinner for json mode ([9daf848](https://github.com/Phala-Network/phala-cloud/commit/9daf848a1d082d9531b7c0d7d7fd6f2ab0d5ba40))
* only set ssh pubkey automatically on deploying ([c26a2e1](https://github.com/Phala-Network/phala-cloud/commit/c26a2e16438f8a7cb2569313cf50e42041146ba2))
* refine cvm_id parsing & loading for deploy & ssh command ([b2bb5a2](https://github.com/Phala-Network/phala-cloud/commit/b2bb5a21b146b0ceb3f424e6ef4fc6906ebb84f5))
* show help message as default behavior ([ed60eec](https://github.com/Phala-Network/phala-cloud/commit/ed60eecc66056868debb23f51937c71014020c0a))
* unify name convention across cli & sdk ([9f0d1e5](https://github.com/Phala-Network/phala-cloud/commit/9f0d1e5d5f7b600a1c963816ce38bd1b402885ef))
* using universal cvm_id in CLI ([86f12fd](https://github.com/Phala-Network/phala-cloud/commit/86f12fd783da9d166c1a455269afdf4eba40e705))

### fix

* CLI error handling to expose full HTTP details ([e74eb37](https://github.com/Phala-Network/phala-cloud/commit/e74eb377a276ae0cbb0c4521b893f92330861cce))
* **cli:** adapt error-handling to new SDK error types ([0ab651b](https://github.com/Phala-Network/phala-cloud/commit/0ab651b78677632d815eeaf7a5e4e2ffeb0892cb))
* **cli:** expose full HTTP details in error handling ([1861230](https://github.com/Phala-Network/phala-cloud/commit/1861230ef96406b55b4a99e7228363fbb1ea5d98))
* **cli:** improve non-interactive mode and JSON output ([9e9e2e2](https://github.com/Phala-Network/phala-cloud/commit/9e9e2e236e00995ba23c4f3e30f2211ba9388b28))
* **cli:** mark 6 fields as nullable in CVM schemas ([80f5230](https://github.com/Phala-Network/phala-cloud/commit/80f523056e967e099a438f5a9a013435e0675b44))
* **cli:** resize command JSON output and E2E test reliability ([6733ec6](https://github.com/Phala-Network/phala-cloud/commit/6733ec618ee42e3c190b3696e432c47cd3736bd1))
* **cli:** resolve lint and type-check errors ([90d996f](https://github.com/Phala-Network/phala-cloud/commit/90d996f595c1c3b5d4aa21feefa2e5e01483c670))
* **cli:** restore v1.0.40 compatibility and add interface tests ([77d7e79](https://github.com/Phala-Network/phala-cloud/commit/77d7e79d0bb112fd10db7f1573cf059df888e03e))
* **cli:** schema validation and automation improvements ([83924e1](https://github.com/Phala-Network/phala-cloud/commit/83924e1c180e4ee72f285c5dcf79f8c36962e69e))
* compatible to latest sdk ([cf418e4](https://github.com/Phala-Network/phala-cloud/commit/cf418e449b3bc6417abc50455ddd448f11360069))
* gateway domain maybe with port suffix ([0fc6332](https://github.com/Phala-Network/phala-cloud/commit/0fc633280ec47f6fb19f0f9ab48cf1cc5c7a6954))
* improve interactive deploy experience ([8974b52](https://github.com/Phala-Network/phala-cloud/commit/8974b5257934cd3d2a9a5478dab10c1f85525da4))
* kms list item types ([31bef68](https://github.com/Phala-Network/phala-cloud/commit/31bef689027e99fab0eca83516cd4a1385d30a61))
* make sigstore happier ([58b8063](https://github.com/Phala-Network/phala-cloud/commit/58b8063f78a21cdd8e70a5985081d524fa789db6))
* remove cli's 250G limit of disk size ([3e914b2](https://github.com/Phala-Network/phala-cloud/commit/3e914b25b4a93a5450631ba1e0c203bc3e483474))
* remove cvm's name length limit ([be523e8](https://github.com/Phala-Network/phala-cloud/commit/be523e849f2439b216e6efc331af2b5003118c90))
* remove non-existent error-handling import in ssh command ([59f33c1](https://github.com/Phala-Network/phala-cloud/commit/59f33c15efeeea68930d05aba445eb95c0728999))
* **sdk,cli:** send update_env_vars flag when updating CVM env vars ([26077d1](https://github.com/Phala-Network/phala-cloud/commit/26077d17e418182d96b995e23e26a48da697d3ea))
* skip start/stop/restart response schema ([5bbc953](https://github.com/Phala-Network/phala-cloud/commit/5bbc9532ae1ac19ee8ce027892ff9dc79d03806e))
* the built artifact should bundled @phala/cloud as well ([c47324e](https://github.com/Phala-Network/phala-cloud/commit/c47324e55d51c5f0ba372cebdb5b9255a24ab8b3))
* the envs not update with deploy command ([1d23a32](https://github.com/Phala-Network/phala-cloud/commit/1d23a32f11e8fb1e8baf71171dc1dfd597ab4da5))
* typing. ([3da96ab](https://github.com/Phala-Network/phala-cloud/commit/3da96ab02195d6bb2b436491a81aee9449f77c75))

### refactor

* apis ([ca0b974](https://github.com/Phala-Network/phala-cloud/commit/ca0b974705a3a97cf132c32aac965ed6617c2dbc))
* CI ([565e382](https://github.com/Phala-Network/phala-cloud/commit/565e38278efad02ab785ebfacb29203ba38ba96f))
* **cli:** remove unused import ([55860f1](https://github.com/Phala-Network/phala-cloud/commit/55860f190253ae7dc04ee6841c5117880d7f7784))
* **cli:** unify JSON output with context.success/fail methods ([b825bcc](https://github.com/Phala-Network/phala-cloud/commit/b825bcc0517566a6e66232f6c31a2984ceb3f97b))
* fix build check ([bc39d18](https://github.com/Phala-Network/phala-cloud/commit/bc39d18d0706f34cd1d298a4299d1cecb04d1d9b))
* move login, logout, status from sub-command to top-level command ([cfc9fb9](https://github.com/Phala-Network/phala-cloud/commit/cfc9fb9e12d2bc977695a42cd29cb085d23b0296))
* move to arg + zod ([e7d5922](https://github.com/Phala-Network/phala-cloud/commit/e7d59226547b552af4e8d2714bbc46b0829f4cc6))
* removed constant API_ENDPOINTS ([e9e944a](https://github.com/Phala-Network/phala-cloud/commit/e9e944a5b7b4c2b5a971b28f702098e931fc7f98))
* ssh & cp with ssh-utils.ts ([2542ec7](https://github.com/Phala-Network/phala-cloud/commit/2542ec780fe4ee3249e18ddf29230336740477d6))
* unify CVM ID resolution across commands ([f6cf8b2](https://github.com/Phala-Network/phala-cloud/commit/f6cf8b209db83cb06c6a324d157396bad0a98f0f))
* use latest sdk in cli as possible ([cb0b815](https://github.com/Phala-Network/phala-cloud/commit/cb0b81570a411d9e55a77738697dc3082667a830))
* use sdk as possible. ([9efa163](https://github.com/Phala-Network/phala-cloud/commit/9efa1630db360d840b2bd1eb72d21be5d3f62144))
## 1.1.0-beta.12 (2025-11-28)

### docs

* added api versioning docs ([443f71c](https://github.com/Phala-Network/phala-cloud/commit/443f71c7873eae7fc81e6760b716614edcc55f7f))

### feat

* add auto-converter for cvm name generation & validator ([ec8b6d6](https://github.com/Phala-Network/phala-cloud/commit/ec8b6d6b06c22202339fddbbd90a8ef4699f91dc))
* add CLI completion support ([37dc21b](https://github.com/Phala-Network/phala-cloud/commit/37dc21b14bb7377bbdefd35c9663bf0a74bda4ab))
* added phala.toml support ([e02c130](https://github.com/Phala-Network/phala-cloud/commit/e02c1307790066f0de4e2d9913acb8ebb5ab6650))
* cli add customize ssh pubkey when deploy ([d9c8249](https://github.com/Phala-Network/phala-cloud/commit/d9c824904813d70ee2661b723c504f961ce95bd9))
* **cli:** add --json flag support to multiple commands ([1ea0c34](https://github.com/Phala-Network/phala-cloud/commit/1ea0c348bb5b7fb3d5db055a67dfb29b758fa4f3))
* **cli:** add --wait flag to deploy command for CVM updates ([b11f739](https://github.com/Phala-Network/phala-cloud/commit/b11f73982391fa1c46beef4f968cd8ad02dacbc2))
* **cli:** add --wait flag to deploy command for CVM updates ([bf0f85a](https://github.com/Phala-Network/phala-cloud/commit/bf0f85ae5c519cf11a81345be2aa0c391130c72b))
* **cli:** added command ssh ([89161d9](https://github.com/Phala-Network/phala-cloud/commit/89161d930321833abbb2f85fe2d93ae7619182f1))
* **cli:** added cp command ([4d320c5](https://github.com/Phala-Network/phala-cloud/commit/4d320c5ed07541200aa2a21f16b340afb7f3df2d))
* **cli:** inject project config resolver on cli startup ([4eb1f79](https://github.com/Phala-Network/phala-cloud/commit/4eb1f79384ef3a08dd06168baafc167f089989ae))
* **cli:** open browser & login workflow ([2b56074](https://github.com/Phala-Network/phala-cloud/commit/2b560742b9e6f9e1d3f1da173d3d05e6feac880e))
* **cli:** retry on http 409 ([11091c7](https://github.com/Phala-Network/phala-cloud/commit/11091c7845623de6fba20240764b610b451908aa))
* **cli:** skip API call in SSH command when gateway domain is provided ([73bf977](https://github.com/Phala-Network/phala-cloud/commit/73bf9776e7d3bd36d71d25a20a001cb64bf650f5))
* for ssh command also support read gateway port from phala.toml ([1360f9b](https://github.com/Phala-Network/phala-cloud/commit/1360f9b3d3cac4a2b6992bf54fc1948612127553))
* improve error handling for cli login ([b71b648](https://github.com/Phala-Network/phala-cloud/commit/b71b648c486059d157cb66f8ce99378467c6c3fe))
* improve error message & fix linting ([cc177ff](https://github.com/Phala-Network/phala-cloud/commit/cc177ff923a499fee05b9f18fc3199bf2569a66e))
* move auth login to login and added deprecated warning ([dd1c096](https://github.com/Phala-Network/phala-cloud/commit/dd1c096208e2dd81623a8c6e730bef4a9a780770))
* move cvm id parsing & interactive mode handler to dispatcher ([aed96be](https://github.com/Phala-Network/phala-cloud/commit/aed96becab8a67a48d375e48974df56a13da8f89))
* no spinner for json mode ([9daf848](https://github.com/Phala-Network/phala-cloud/commit/9daf848a1d082d9531b7c0d7d7fd6f2ab0d5ba40))
* only set ssh pubkey automatically on deploying ([c26a2e1](https://github.com/Phala-Network/phala-cloud/commit/c26a2e16438f8a7cb2569313cf50e42041146ba2))
* refine cvm_id parsing & loading for deploy & ssh command ([b2bb5a2](https://github.com/Phala-Network/phala-cloud/commit/b2bb5a21b146b0ceb3f424e6ef4fc6906ebb84f5))
* show help message as default behavior ([ed60eec](https://github.com/Phala-Network/phala-cloud/commit/ed60eecc66056868debb23f51937c71014020c0a))
* unify name convention across cli & sdk ([9f0d1e5](https://github.com/Phala-Network/phala-cloud/commit/9f0d1e5d5f7b600a1c963816ce38bd1b402885ef))
* using universal cvm_id in CLI ([86f12fd](https://github.com/Phala-Network/phala-cloud/commit/86f12fd783da9d166c1a455269afdf4eba40e705))

### fix

* CLI error handling to expose full HTTP details ([e74eb37](https://github.com/Phala-Network/phala-cloud/commit/e74eb377a276ae0cbb0c4521b893f92330861cce))
* **cli:** adapt error-handling to new SDK error types ([0ab651b](https://github.com/Phala-Network/phala-cloud/commit/0ab651b78677632d815eeaf7a5e4e2ffeb0892cb))
* **cli:** expose full HTTP details in error handling ([1861230](https://github.com/Phala-Network/phala-cloud/commit/1861230ef96406b55b4a99e7228363fbb1ea5d98))
* **cli:** improve non-interactive mode and JSON output ([9e9e2e2](https://github.com/Phala-Network/phala-cloud/commit/9e9e2e236e00995ba23c4f3e30f2211ba9388b28))
* **cli:** mark 6 fields as nullable in CVM schemas ([80f5230](https://github.com/Phala-Network/phala-cloud/commit/80f523056e967e099a438f5a9a013435e0675b44))
* **cli:** resize command JSON output and E2E test reliability ([6733ec6](https://github.com/Phala-Network/phala-cloud/commit/6733ec618ee42e3c190b3696e432c47cd3736bd1))
* **cli:** resolve lint and type-check errors ([90d996f](https://github.com/Phala-Network/phala-cloud/commit/90d996f595c1c3b5d4aa21feefa2e5e01483c670))
* **cli:** restore v1.0.40 compatibility and add interface tests ([77d7e79](https://github.com/Phala-Network/phala-cloud/commit/77d7e79d0bb112fd10db7f1573cf059df888e03e))
* **cli:** schema validation and automation improvements ([83924e1](https://github.com/Phala-Network/phala-cloud/commit/83924e1c180e4ee72f285c5dcf79f8c36962e69e))
* compatible to latest sdk ([cf418e4](https://github.com/Phala-Network/phala-cloud/commit/cf418e449b3bc6417abc50455ddd448f11360069))
* gateway domain maybe with port suffix ([0fc6332](https://github.com/Phala-Network/phala-cloud/commit/0fc633280ec47f6fb19f0f9ab48cf1cc5c7a6954))
* kms list item types ([31bef68](https://github.com/Phala-Network/phala-cloud/commit/31bef689027e99fab0eca83516cd4a1385d30a61))
* make sigstore happier ([58b8063](https://github.com/Phala-Network/phala-cloud/commit/58b8063f78a21cdd8e70a5985081d524fa789db6))
* remove cli's 250G limit of disk size ([3e914b2](https://github.com/Phala-Network/phala-cloud/commit/3e914b25b4a93a5450631ba1e0c203bc3e483474))
* remove cvm's name length limit ([be523e8](https://github.com/Phala-Network/phala-cloud/commit/be523e849f2439b216e6efc331af2b5003118c90))
* remove non-existent error-handling import in ssh command ([59f33c1](https://github.com/Phala-Network/phala-cloud/commit/59f33c15efeeea68930d05aba445eb95c0728999))
* skip start/stop/restart response schema ([5bbc953](https://github.com/Phala-Network/phala-cloud/commit/5bbc9532ae1ac19ee8ce027892ff9dc79d03806e))
* the built artifact should bundled @phala/cloud as well ([c47324e](https://github.com/Phala-Network/phala-cloud/commit/c47324e55d51c5f0ba372cebdb5b9255a24ab8b3))
* the envs not update with deploy command ([1d23a32](https://github.com/Phala-Network/phala-cloud/commit/1d23a32f11e8fb1e8baf71171dc1dfd597ab4da5))
* typing. ([3da96ab](https://github.com/Phala-Network/phala-cloud/commit/3da96ab02195d6bb2b436491a81aee9449f77c75))

### refactor

* apis ([ca0b974](https://github.com/Phala-Network/phala-cloud/commit/ca0b974705a3a97cf132c32aac965ed6617c2dbc))
* CI ([565e382](https://github.com/Phala-Network/phala-cloud/commit/565e38278efad02ab785ebfacb29203ba38ba96f))
* **cli:** remove unused import ([55860f1](https://github.com/Phala-Network/phala-cloud/commit/55860f190253ae7dc04ee6841c5117880d7f7784))
* **cli:** unify JSON output with context.success/fail methods ([b825bcc](https://github.com/Phala-Network/phala-cloud/commit/b825bcc0517566a6e66232f6c31a2984ceb3f97b))
* fix build check ([bc39d18](https://github.com/Phala-Network/phala-cloud/commit/bc39d18d0706f34cd1d298a4299d1cecb04d1d9b))
* move login, logout, status from sub-command to top-level command ([cfc9fb9](https://github.com/Phala-Network/phala-cloud/commit/cfc9fb9e12d2bc977695a42cd29cb085d23b0296))
* move to arg + zod ([e7d5922](https://github.com/Phala-Network/phala-cloud/commit/e7d59226547b552af4e8d2714bbc46b0829f4cc6))
* removed constant API_ENDPOINTS ([e9e944a](https://github.com/Phala-Network/phala-cloud/commit/e9e944a5b7b4c2b5a971b28f702098e931fc7f98))
* ssh & cp with ssh-utils.ts ([2542ec7](https://github.com/Phala-Network/phala-cloud/commit/2542ec780fe4ee3249e18ddf29230336740477d6))
* use latest sdk in cli as possible ([cb0b815](https://github.com/Phala-Network/phala-cloud/commit/cb0b81570a411d9e55a77738697dc3082667a830))
* use sdk as possible. ([9efa163](https://github.com/Phala-Network/phala-cloud/commit/9efa1630db360d840b2bd1eb72d21be5d3f62144))
## [1.1.0-beta.11](https://github.com/Phala-Network/phala-cloud/compare/cli-v1.1.0-beta.11...cli-v1.1.0-beta.11) (2025-11-28)

### feat

* add auto-converter for cvm name generation & validator ([ec8b6d6](https://github.com/Phala-Network/phala-cloud/commit/ec8b6d6b06c22202339fddbbd90a8ef4699f91dc))
* move cvm id parsing & interactive mode handler to dispatcher ([aed96be](https://github.com/Phala-Network/phala-cloud/commit/aed96becab8a67a48d375e48974df56a13da8f89))
* unify name convention across cli & sdk ([9f0d1e5](https://github.com/Phala-Network/phala-cloud/commit/9f0d1e5d5f7b600a1c963816ce38bd1b402885ef))
* using universal cvm_id in CLI ([86f12fd](https://github.com/Phala-Network/phala-cloud/commit/86f12fd783da9d166c1a455269afdf4eba40e705))

### fix

* remove cvm's name length limit ([be523e8](https://github.com/Phala-Network/phala-cloud/commit/be523e849f2439b216e6efc331af2b5003118c90))

## [1.1.0-beta.11](https://github.com/Phala-Network/phala-cloud/compare/cli-v1.1.0-beta.10...cli-v1.1.0-beta.11) (2025-11-19)

### fix

* remove cli's 250G limit of disk size ([3e914b2](https://github.com/Phala-Network/phala-cloud/commit/3e914b25b4a93a5450631ba1e0c203bc3e483474))

## [1.1.0-beta.10](https://github.com/Phala-Network/phala-cloud/compare/cli-v1.1.0-beta.9...cli-v1.1.0-beta.10) (2025-11-17)

### feat

* cli add customize ssh pubkey when deploy ([d9c8249](https://github.com/Phala-Network/phala-cloud/commit/d9c824904813d70ee2661b723c504f961ce95bd9))
* improve error handling for cli login ([b71b648](https://github.com/Phala-Network/phala-cloud/commit/b71b648c486059d157cb66f8ce99378467c6c3fe))
* only set ssh pubkey automatically on deploying ([c26a2e1](https://github.com/Phala-Network/phala-cloud/commit/c26a2e16438f8a7cb2569313cf50e42041146ba2))

### fix

* gateway domain maybe with port suffix ([0fc6332](https://github.com/Phala-Network/phala-cloud/commit/0fc633280ec47f6fb19f0f9ab48cf1cc5c7a6954))

### refactor

* ssh & cp with ssh-utils.ts ([2542ec7](https://github.com/Phala-Network/phala-cloud/commit/2542ec780fe4ee3249e18ddf29230336740477d6))

## [1.1.0-beta.9](https://github.com/Phala-Network/phala-cloud/compare/cli-v1.1.0-beta.8...cli-v1.1.0-beta.9) (2025-11-13)

### feat

* **cli:** added cp command ([4d320c5](https://github.com/Phala-Network/phala-cloud/commit/4d320c5ed07541200aa2a21f16b340afb7f3df2d))

## [1.1.0-beta.8](https://github.com/Phala-Network/phala-cloud/compare/cli-v1.1.0-beta.7...cli-v1.1.0-beta.8) (2025-11-11)

### feat

* **cli:** skip API call in SSH command when gateway domain is provided ([73bf977](https://github.com/Phala-Network/phala-cloud/commit/73bf9776e7d3bd36d71d25a20a001cb64bf650f5))
* for ssh command also support read gateway port from phala.toml ([1360f9b](https://github.com/Phala-Network/phala-cloud/commit/1360f9b3d3cac4a2b6992bf54fc1948612127553))

## [1.1.0-beta.7](https://github.com/Phala-Network/phala-cloud/compare/cli-v1.1.0-beta.6...cli-v1.1.0-beta.7) (2025-11-11)

## [1.1.0-beta.6](https://github.com/Phala-Network/phala-cloud/compare/cli-v1.1.0-beta.2...cli-v1.1.0-beta.6) (2025-11-11)

### docs

* added api versioning docs ([443f71c](https://github.com/Phala-Network/phala-cloud/commit/443f71c7873eae7fc81e6760b716614edcc55f7f))

### feat

* added phala.toml support ([e02c130](https://github.com/Phala-Network/phala-cloud/commit/e02c1307790066f0de4e2d9913acb8ebb5ab6650))
* **cli:** add --json flag support to multiple commands ([1ea0c34](https://github.com/Phala-Network/phala-cloud/commit/1ea0c348bb5b7fb3d5db055a67dfb29b758fa4f3))
* **cli:** add --wait flag to deploy command for CVM updates ([b11f739](https://github.com/Phala-Network/phala-cloud/commit/b11f73982391fa1c46beef4f968cd8ad02dacbc2))
* **cli:** add --wait flag to deploy command for CVM updates ([bf0f85a](https://github.com/Phala-Network/phala-cloud/commit/bf0f85ae5c519cf11a81345be2aa0c391130c72b))
* **cli:** added command ssh ([89161d9](https://github.com/Phala-Network/phala-cloud/commit/89161d930321833abbb2f85fe2d93ae7619182f1))
* **cli:** inject project config resolver on cli startup ([4eb1f79](https://github.com/Phala-Network/phala-cloud/commit/4eb1f79384ef3a08dd06168baafc167f089989ae))
* **cli:** open browser & login workflow ([2b56074](https://github.com/Phala-Network/phala-cloud/commit/2b560742b9e6f9e1d3f1da173d3d05e6feac880e))
* **cli:** retry on http 409 ([11091c7](https://github.com/Phala-Network/phala-cloud/commit/11091c7845623de6fba20240764b610b451908aa))
* improve error message & fix linting ([cc177ff](https://github.com/Phala-Network/phala-cloud/commit/cc177ff923a499fee05b9f18fc3199bf2569a66e))
* move auth login to login and added deprecated warning ([dd1c096](https://github.com/Phala-Network/phala-cloud/commit/dd1c096208e2dd81623a8c6e730bef4a9a780770))
* refine cvm_id parsing & loading for deploy & ssh command ([b2bb5a2](https://github.com/Phala-Network/phala-cloud/commit/b2bb5a21b146b0ceb3f424e6ef4fc6906ebb84f5))

### fix

* CLI error handling to expose full HTTP details ([e74eb37](https://github.com/Phala-Network/phala-cloud/commit/e74eb377a276ae0cbb0c4521b893f92330861cce))
* **cli:** adapt error-handling to new SDK error types ([0ab651b](https://github.com/Phala-Network/phala-cloud/commit/0ab651b78677632d815eeaf7a5e4e2ffeb0892cb))
* **cli:** expose full HTTP details in error handling ([1861230](https://github.com/Phala-Network/phala-cloud/commit/1861230ef96406b55b4a99e7228363fbb1ea5d98))
* **cli:** improve non-interactive mode and JSON output ([9e9e2e2](https://github.com/Phala-Network/phala-cloud/commit/9e9e2e236e00995ba23c4f3e30f2211ba9388b28))
* **cli:** mark 6 fields as nullable in CVM schemas ([80f5230](https://github.com/Phala-Network/phala-cloud/commit/80f523056e967e099a438f5a9a013435e0675b44))
* **cli:** resize command JSON output and E2E test reliability ([6733ec6](https://github.com/Phala-Network/phala-cloud/commit/6733ec618ee42e3c190b3696e432c47cd3736bd1))
* **cli:** resolve lint and type-check errors ([90d996f](https://github.com/Phala-Network/phala-cloud/commit/90d996f595c1c3b5d4aa21feefa2e5e01483c670))
* **cli:** restore v1.0.40 compatibility and add interface tests ([77d7e79](https://github.com/Phala-Network/phala-cloud/commit/77d7e79d0bb112fd10db7f1573cf059df888e03e))
* **cli:** schema validation and automation improvements ([83924e1](https://github.com/Phala-Network/phala-cloud/commit/83924e1c180e4ee72f285c5dcf79f8c36962e69e))
* compatible to latest sdk ([cf418e4](https://github.com/Phala-Network/phala-cloud/commit/cf418e449b3bc6417abc50455ddd448f11360069))
* make sigstore happier ([58b8063](https://github.com/Phala-Network/phala-cloud/commit/58b8063f78a21cdd8e70a5985081d524fa789db6))
* remove non-existent error-handling import in ssh command ([59f33c1](https://github.com/Phala-Network/phala-cloud/commit/59f33c15efeeea68930d05aba445eb95c0728999))

### refactor

* **cli:** remove unused import ([55860f1](https://github.com/Phala-Network/phala-cloud/commit/55860f190253ae7dc04ee6841c5117880d7f7784))
* **cli:** unify JSON output with context.success/fail methods ([b825bcc](https://github.com/Phala-Network/phala-cloud/commit/b825bcc0517566a6e66232f6c31a2984ceb3f97b))
* move login, logout, status from sub-command to top-level command ([cfc9fb9](https://github.com/Phala-Network/phala-cloud/commit/cfc9fb9e12d2bc977695a42cd29cb085d23b0296))

## [1.1.0-beta.2](https://github.com/Phala-Network/phala-cloud/compare/cli-v1.0.39...cli-v1.1.0-beta.2) (2025-10-13)

### feat

* add CLI completion support ([37dc21b](https://github.com/Phala-Network/phala-cloud/commit/37dc21b14bb7377bbdefd35c9663bf0a74bda4ab))
* show help message as default behavior ([ed60eec](https://github.com/Phala-Network/phala-cloud/commit/ed60eecc66056868debb23f51937c71014020c0a))

### fix

* skip start/stop/restart response schema ([5bbc953](https://github.com/Phala-Network/phala-cloud/commit/5bbc9532ae1ac19ee8ce027892ff9dc79d03806e))

### refactor

* move to arg + zod ([e7d5922](https://github.com/Phala-Network/phala-cloud/commit/e7d59226547b552af4e8d2714bbc46b0829f4cc6))

## [1.0.39](https://github.com/Phala-Network/phala-cloud/compare/cli-v1.0.38...cli-v1.0.39) (2025-10-13)

### feat

* no spinner for json mode ([9daf848](https://github.com/Phala-Network/phala-cloud/commit/9daf848a1d082d9531b7c0d7d7fd6f2ab0d5ba40))

### fix

* kms list item types ([31bef68](https://github.com/Phala-Network/phala-cloud/commit/31bef689027e99fab0eca83516cd4a1385d30a61))
* the envs not update with deploy command ([1d23a32](https://github.com/Phala-Network/phala-cloud/commit/1d23a32f11e8fb1e8baf71171dc1dfd597ab4da5))

## [1.0.38](https://github.com/Phala-Network/phala-cloud/compare/cb0b81570a411d9e55a77738697dc3082667a830...cli-v1.0.38) (2025-10-11)

### fix

* the built artifact should bundled @phala/cloud as well ([c47324e](https://github.com/Phala-Network/phala-cloud/commit/c47324e55d51c5f0ba372cebdb5b9255a24ab8b3))
* typing. ([3da96ab](https://github.com/Phala-Network/phala-cloud/commit/3da96ab02195d6bb2b436491a81aee9449f77c75))

### refactor

* apis ([ca0b974](https://github.com/Phala-Network/phala-cloud/commit/ca0b974705a3a97cf132c32aac965ed6617c2dbc))
* CI ([565e382](https://github.com/Phala-Network/phala-cloud/commit/565e38278efad02ab785ebfacb29203ba38ba96f))
* fix build check ([bc39d18](https://github.com/Phala-Network/phala-cloud/commit/bc39d18d0706f34cd1d298a4299d1cecb04d1d9b))
* removed constant API_ENDPOINTS ([e9e944a](https://github.com/Phala-Network/phala-cloud/commit/e9e944a5b7b4c2b5a971b28f702098e931fc7f98))
* use latest sdk in cli as possible ([cb0b815](https://github.com/Phala-Network/phala-cloud/commit/cb0b81570a411d9e55a77738697dc3082667a830))
* use sdk as possible. ([9efa163](https://github.com/Phala-Network/phala-cloud/commit/9efa1630db360d840b2bd1eb72d21be5d3f62144))
