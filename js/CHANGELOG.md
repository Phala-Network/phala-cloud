## [](https://github.com/Phala-Network/phala-cloud/compare/js-v0.3.0...js-v) (2026-07-25)

### ⚠ BREAKING CHANGE

* **sdk:** reject deprecated user_id/teepod_id/node_id CVM list filters

### feat

* add algorithm_version to DeviceIdEntry ([701ac00](https://github.com/Phala-Network/phala-cloud/commit/701ac0017acc5fb7851e285e27cc1e9ba7af05cd))
* add device_ids matrix to node schemas ([de36a3a](https://github.com/Phala-Network/phala-cloud/commit/de36a3af84b1f16abdadeada607d00843817e244))
* add kms_contract_id to CVM SDK schemas, deprecate kms_id ([16734b9](https://github.com/Phala-Network/phala-cloud/commit/16734b9d22c2e6584c3c320b64d2bd48cdcb5a2b))
* drop os_image_ids from DeviceIdEntry ([8509162](https://github.com/Phala-Network/phala-cloud/commit/8509162d47b0973333e6bb2526ec6ae5261c69aa))
* **js,cli:** add compose types and mr_config_id computation ([c5e321f](https://github.com/Phala-Network/phala-cloud/commit/c5e321fafd91d2063395a76b541cd2b72c8f41ff))
* **js:** add compose_unchanged and no_change status to SDK schemas ([33699d8](https://github.com/Phala-Network/phala-cloud/commit/33699d8c8d836ce94c2e09e1bf5d98635be6ac58))
* **js:** add disk_used_bytes and disk_total_bytes to CvmResourceUsageSchema ([5d5d385](https://github.com/Phala-Network/phala-cloud/commit/5d5d3855ed6197775a377a0133cdb0afa2333a4c))
* **js:** add resource_usage and events to CvmStatusSchema ([fbb4ee6](https://github.com/Phala-Network/phala-cloud/commit/fbb4ee6ff407b255616786113b093f1c177afcbd))
* **js:** declare billing_status and suspended_at on the workspace schema ([2fd4205](https://github.com/Phala-Network/phala-cloud/commit/2fd4205dd678c04909bba8f6ee0a41ee7977a0a8))
* **js:** expose CVM shutdown operation phase ([c9fdbd3](https://github.com/Phala-Network/phala-cloud/commit/c9fdbd3fd2d0abe2bcb7908782ac87f12089e9ec))
* **js:** expose mr_config_id in app attestations ([a1e7454](https://github.com/Phala-Network/phala-cloud/commit/a1e74547e8a38786f7aa5bf3aaca99de728e37d6))
* **js:** model CVM operation status as an object ([1c4292a](https://github.com/Phala-Network/phala-cloud/commit/1c4292a7b219b87482c4cfd68f7fe08b64f4d623))
* **sdk/cli:** surface KMS contract verification anchors in on-chain detail ([35a48a3](https://github.com/Phala-Network/phala-cloud/commit/35a48a3a81a4d762cb3a7b49bdcddfb196fd6db1))
* **sdk:** add hourly_rate, billing_interval, gpu_rental_order to CVM v20260121 ([0f665eb](https://github.com/Phala-Network/phala-cloud/commit/0f665ebaa68158804a835488be4dd76cf1708895))
* **sdk:** contract-centric KMS API, default to version 2026-06-23 ([0fb89e2](https://github.com/Phala-Network/phala-cloud/commit/0fb89e23c2c7a62bca6ef7f32649d06c9eabf2e4))

### fix

* **cli:** surface request details in API errors ([c53a329](https://github.com/Phala-Network/phala-cloud/commit/c53a329b4cfa3027e05d27c7e3ed5bb8e0fbbfbb))
* **cli:** verify KMS env encryption pubkeys ([0300d64](https://github.com/Phala-Network/phala-cloud/commit/0300d645970198ca08530caa724d3651a6eb833b))
* **js:** correct kms_info.chain_id type in app attestation schema ([f11735e](https://github.com/Phala-Network/phala-cloud/commit/f11735e927f1f006e36622dffdb3d9b88a81a607))
* **js:** render dict/array StructuredErrorDetail values as JSON ([90d4f0b](https://github.com/Phala-Network/phala-cloud/commit/90d4f0bdbdaf3c5b551cfa7d3db3a58d75a88114))
* **js:** type kms_info.chain_id as number in app attestation schema ([c403f86](https://github.com/Phala-Network/phala-cloud/commit/c403f8648dd0ceda2d1b6f14b1cb0fe61e3afc0d))
* **js:** update provision assertions for the compose_unchanged default ([ced4741](https://github.com/Phala-Network/phala-cloud/commit/ced4741e9676a1fd38342fcf654a556d3dcfa973)), closes [#468](https://github.com/Phala-Network/phala-cloud/issues/468)
* **sdk:** reject deprecated user_id/teepod_id/node_id CVM list filters ([399cea5](https://github.com/Phala-Network/phala-cloud/commit/399cea5a56054f7566b36ba6f950e4e8eb4bfeef))

### refactor

* **sdk:** migrate updateCvmResources to unified PATCH /cvms/{id} ([c881889](https://github.com/Phala-Network/phala-cloud/commit/c8818894012f318d82b1230e113c53c0cb42f81e))
## [0.3.0](https://github.com/Phala-Network/phala-cloud/compare/js-v0.2.10...js-v0.3.0) (2026-06-02)

### fix

* **js:** add version-based schema selection for versioned action responses ([d96f402](https://github.com/Phala-Network/phala-cloud/commit/d96f402353cbbd6557c14908c6d2ba795dab28b7))
* **js:** regenerate CHANGELOG with correct per-package path filter ([bdbcf9c](https://github.com/Phala-Network/phala-cloud/commit/bdbcf9c029e251944eff43823de555a37b436f46))
## [0.2.10](https://github.com/Phala-Network/phala-cloud/compare/js-v0.2.9...js-v0.2.10) (2026-06-02)

### feat

* add McDonald's China MCP template (#280) ([7c0c815](https://github.com/Phala-Network/phala-cloud/commit/7c0c815f1a76c15c5a960a514948f0dabc7d5d78)), closes [#280](https://github.com/Phala-Network/phala-cloud/issues/280) [#1449](https://github.com/Phala-Network/phala-cloud/issues/1449)
* add versioned CVM hashid SDK schemas ([b5b3766](https://github.com/Phala-Network/phala-cloud/commit/b5b376620be08e1efbcb26f1ce78fd71bef90544))
* expose latest CVM hashid schemas ([d317ebf](https://github.com/Phala-Network/phala-cloud/commit/d317ebf8acb4a1b53d5c080725af07a2a700d2a5))
* expose request IDs on structured errors ([adcc644](https://github.com/Phala-Network/phala-cloud/commit/adcc6444cf35a993bb37a36ae166e2d4b9b25f50))
* **js:** add CVM create resource graph ([f229758](https://github.com/Phala-Network/phala-cloud/commit/f229758f8f895ec870664749dbf098d0f624c837))
* **js:** add pre-launch script upgrade-status and upgrade actions ([dd5dbb3](https://github.com/Phala-Network/phala-cloud/commit/dd5dbb3cd0928edb9f226918a8f7eb6f584b3f9b))
* **js:** add TCB identity fields to AppAttestationInstanceSchema ([087d36d](https://github.com/Phala-Network/phala-cloud/commit/087d36de8a7575bd2bbd06c70bb40d484e3421c1))
* **js:** bump default request timeout to 60s ([0b6e022](https://github.com/Phala-Network/phala-cloud/commit/0b6e0227c392106f9f8fd7a24aca884b867c759e))
* **js:** expose workspace avatar URL ([35236c5](https://github.com/Phala-Network/phala-cloud/commit/35236c5c5a87a733dfa26dae45569d332d78a902))
* **js:** support app instance names ([4839715](https://github.com/Phala-Network/phala-cloud/commit/48397154b13361d10653084f0df64e03aec71aae))
* **types:** add port_policy field to LooseAppCompose ([bbdc704](https://github.com/Phala-Network/phala-cloud/commit/bbdc704af2112332454cf84faf9a2ec08db931d6))
* version CVM create resource hashid schemas ([f34d2c7](https://github.com/Phala-Network/phala-cloud/commit/f34d2c7e69d4b4a939477d28278acd3e6545c4d2))

### fix

* accept versioned IDs in legacy CVM schemas ([0b91912](https://github.com/Phala-Network/phala-cloud/commit/0b91912eacbe7e08a86426575d6340cf8ab23094))
* align CVMInfo schemas with hashid responses ([49ba6fd](https://github.com/Phala-Network/phala-cloud/commit/49ba6fd53d6ee73ed4d429ea5957d6e4c6f5e71b))
* allow nullable CVM IDs in instance refresh results ([5c22c18](https://github.com/Phala-Network/phala-cloud/commit/5c22c18f07a0ae5a7d383eb41ab3ffeca11e76a0))
* drop minimal app response schema ([24617ff](https://github.com/Phala-Network/phala-cloud/commit/24617ffe55dabaeb96981090b7a42859597899ef))
* **js:** pass through unknown keys on provision compose_file ([409bbca](https://github.com/Phala-Network/phala-cloud/commit/409bbcad38cd5b088cfb4964228a777700409d4c))
* **js:** shorten timeout message and expose code on PhalaCloudError ([4966c1e](https://github.com/Phala-Network/phala-cloud/commit/4966c1eb949f67e22725818f534999cd670c4c69))
* **js:** stop rewriting node_id to teepod_id on provision ([c267fec](https://github.com/Phala-Network/phala-cloud/commit/c267fece644b054990260edf0286d9f7adaca5c4)), closes [#1449](https://github.com/Phala-Network/phala-cloud/issues/1449)
* **js:** surface friendly error for request timeouts ([8c367fd](https://github.com/Phala-Network/phala-cloud/commit/8c367fdd327945b2f944802455591614c6f24665))
* use hashed CVM IDs in schemas ([0268fa0](https://github.com/Phala-Network/phala-cloud/commit/0268fa0bf24d2d7449e2e338e42a484973bd46f2))

## [0.2.9](https://github.com/Phala-Network/phala-cloud/compare/js-v0.2.8...js-v0.2.9) (2026-04-17)

### feat

* **sdk,cli:** add POST /apps/{app_id}/instances support ([80498ab](https://github.com/Phala-Network/phala-cloud/commit/80498ab02f56610a21cbbc807b92d878304a1eb2))

## [0.2.8](https://github.com/Phala-Network/phala-cloud/compare/js-v0.2.7...js-v0.2.8) (2026-04-10)

## [0.2.7](https://github.com/Phala-Network/phala-cloud/compare/js-v0.2.6...js-v0.2.7) (2026-04-10)

### feat

* add compose_hash_registered to provision response schema ([be02cf9](https://github.com/Phala-Network/phala-cloud/commit/be02cf903d1219c63693d2e355ea86114bdf4841))

### fix

* **js:** update addComposeHash test mock for owner pre-check ([456ce00](https://github.com/Phala-Network/phala-cloud/commit/456ce0022f23e315e6e0b06341026fa1ec1a73c0))
* parse StructuredError details array in 465 error handlers ([50129dc](https://github.com/Phala-Network/phala-cloud/commit/50129dcc87803e979fde0d624f3187e0547a5aca))
* preserve StructuredError response body in error conversion ([ae7eecc](https://github.com/Phala-Network/phala-cloud/commit/ae7eecc487ea1c6f0892b383e2a22e41e0e6593d))
* **sdk:** chain resolution, owner pre-check, and ABI error definitions ([0c6a50c](https://github.com/Phala-Network/phala-cloud/commit/0c6a50c7fc57370ecb61359f34f04210c645ca18))

### refactor

* add transaction progress logging and RPC transport timeouts ([29849a2](https://github.com/Phala-Network/phala-cloud/commit/29849a283025fe74543254e75afae888ab29f848))

## [0.2.6](https://github.com/Phala-Network/phala-cloud/compare/js-v0.2.5...js-v0.2.6) (2026-03-27)

### feat

* add is-allowed API to JS, Python, and Go SDKs ([1fa61f0](https://github.com/Phala-Network/phala-cloud/commit/1fa61f0581ce111213f721f1c2d2f4744c3c2f00))
* add structured error codes and idempotency support across all SDKs ([2dd6d0b](https://github.com/Phala-Network/phala-cloud/commit/2dd6d0bae4d5fd7acdef551c3c9bf507ac1b0e4e)), closes [#1041](https://github.com/Phala-Network/phala-cloud/issues/1041)
* display on-chain status in --prepare-only output ([f98f614](https://github.com/Phala-Network/phala-cloud/commit/f98f6149f13b9452099e23409964dcedbfb82ff7))
* **js-sdk:** add webhook signature verification via @phala/cloud/webhook ([3544694](https://github.com/Phala-Network/phala-cloud/commit/3544694efbd70a7f2cbd123b2ca92ccbf3c99428))
* **js,cli:** add on-chain prerequisite checks and improve update flow ([d3209e1](https://github.com/Phala-Network/phala-cloud/commit/d3209e1fd2b0be61455f5ec69de64a7919b1b7e2))
* **js:** add patchCvm and confirmCvmPatch for unified PATCH /cvms/{id} ([30cabaf](https://github.com/Phala-Network/phala-cloud/commit/30cabaf7084e72dbda656504d9f4359db95e2a16))
* **sdk:** add prepareOnly support to patchCvm and new commitCvmUpdate action ([38d6bf4](https://github.com/Phala-Network/phala-cloud/commit/38d6bf40b9209f4fcfae70fcc4c5db2d0de379e8))

### fix

* **js,cli:** add missing files and fix compose hash tx verification ([7656a45](https://github.com/Phala-Network/phala-cloud/commit/7656a459ced2843a03146d6757fd019ede2f1f53))
* **js:** handle FormData Content-Type in post/put/patch methods ([68d77ef](https://github.com/Phala-Network/phala-cloud/commit/68d77ef29a865c4cf8fb8dd91afc703064dac416))
* **js:** send empty body in confirmCvmPatch instead of undefined ([a228001](https://github.com/Phala-Network/phala-cloud/commit/a22800121b6d4db6fa719864f8775cd70c28801d))
* **js:** use toMatchObject for viem Chain comparisons in tests ([5b5d00c](https://github.com/Phala-Network/phala-cloud/commit/5b5d00c0b8f32d8147e2d784e9a10ad7fcaf152e))

## [0.2.5](https://github.com/Phala-Network/phala-cloud/compare/js-v0.2.4...js-v0.2.5) (2026-03-14)

### docs

* **js:** fix ETHEREUM typo in provision example ([15c3940](https://github.com/Phala-Network/phala-cloud/commit/15c394024467085491438fa5a52d0a1eafb565bf))

### feat

* add device management blockchain actions to SDK and CLI ([290ca2a](https://github.com/Phala-Network/phala-cloud/commit/290ca2a8d4b246b8d9d4b87281132bf573128989))
* add getAppAttestation action for app-level attestation API ([4d534e9](https://github.com/Phala-Network/phala-cloud/commit/4d534e91bb3a845ab4a13549bb271f51bf85bc21))
* add getAppDeviceAllowlist SDK action ([9b6fbf4](https://github.com/Phala-Network/phala-cloud/commit/9b6fbf4553a03308fc36783e7911806dd10b9624))
* add os-images listing, kms on-chain detail to SDK and CLI ([9fe5c9a](https://github.com/Phala-Network/phala-cloud/commit/9fe5c9a845ca6c46d3c8777eeb8eec50476a396b))
* **cli,sdk:** add --fs option to deploy command for filesystem selection ([716723d](https://github.com/Phala-Network/phala-cloud/commit/716723d5e6a4ca3f443ee073dc8f74c44af162d6))
* export attestation Zod schemas for frontend reuse ([cbd3245](https://github.com/Phala-Network/phala-cloud/commit/cbd3245bec7448790b4016816cca20ac1bb0c56c))
* **js-sdk:** add instance-id refresh actions and v20260121 field ([038810a](https://github.com/Phala-Network/phala-cloud/commit/038810a87350a00c719c430091b2a1882aed031b))
* **js:** add confidential_models_enabled to WorkspaceResponseSchema ([6a8b924](https://github.com/Phala-Network/phala-cloud/commit/6a8b9244d103a5fafdec931270d45259780666ea))
* **kms:** simplify CLI output and include device node names ([e48019c](https://github.com/Phala-Network/phala-cloud/commit/e48019cb972c96c049aadc2e285f4b3a06de0c14))
* query and display contract owner in allow-devices list ([37fe2e1](https://github.com/Phala-Network/phala-cloud/commit/37fe2e124880f59b3e9bb0087cafb71b350781f5))
* **sdk:** add replicateCvm action for CVM scaling ([1cb8203](https://github.com/Phala-Network/phala-cloud/commit/1cb820395a9d835146a034aa33f18062a6c8db40))

### fix

* **js-sdk:** add listed field to CvmInfoV20260121Schema ([a85adaf](https://github.com/Phala-Network/phala-cloud/commit/a85adaf3e650a6af41c27d50748a1a117f29037b))
* make base_image optional in VMSchema ([043b81b](https://github.com/Phala-Network/phala-cloud/commit/043b81b6be0662d195b202cc28b08fc249f0ceaf))
* replace event scanning with readContract for device allowlist ([fb2a4b2](https://github.com/Phala-Network/phala-cloud/commit/fb2a4b275912d4bd2931c1b12d3b5b1368a26458))
* replay events chronologically in getAllowedDevices ([cccb120](https://github.com/Phala-Network/phala-cloud/commit/cccb120b9af2651e1468d98862bd0a7b713b1a59))

### perf

* use multicall for batch device allowlist checks ([4fb338f](https://github.com/Phala-Network/phala-cloud/commit/4fb338f0f7e383fdfee016e02712075c22ae3af0))

## [0.2.4](https://github.com/Phala-Network/phala-cloud/compare/js-v0.2.3...js-v0.2.4) (2026-02-25)

### feat

* **sdk+cli:** add SSH key and CVM runtime-config commands ([692321a](https://github.com/Phala-Network/phala-cloud/commit/692321a05bacdbc4da9bcfbc9b82ab8fcfc9d25a))
* **sdk:** add create, delete, and sync SSH key actions ([a688f29](https://github.com/Phala-Network/phala-cloud/commit/a688f2909932500be88ac238d5fcb894f7af98d6))

## [0.2.3](https://github.com/Phala-Network/phala-cloud/compare/js-v0.2.2...js-v0.2.3) (2026-02-07)

### feat

* add 200KB size limit for compose file + pre-launch script ([fe45765](https://github.com/Phala-Network/phala-cloud/commit/fe4576593cc08c2576e4c91d1c2b6b68cb3b9601))
* add profile field to app schemas and getAppFilterOptions action ([cf3c2eb](https://github.com/Phala-Network/phala-cloud/commit/cf3c2eb2e1ddc1b9984484630bc603e48f48aafb))
* add public_tcbinfo to update visibility action ([39cfd3f](https://github.com/Phala-Network/phala-cloud/commit/39cfd3f0c5f0628d8c13a25fb99a400a32cecb06))

### fix

* rename teepod_name to node in get_app_list action ([f863436](https://github.com/Phala-Network/phala-cloud/commit/f8634367fb5b03eb3f84877b56c8e914dc03fd55))

### refactor

* **js:** add revision_id to app revisions and use revisionId for detail ([8d72149](https://github.com/Phala-Network/phala-cloud/commit/8d72149e69a71bfc11eb35c2240753b4ecc014b7))

## [0.2.2](https://github.com/Phala-Network/phala-cloud/compare/js-v0.2.1...js-v0.2.2) (2026-01-31)

### feat

* **sdk-js:** add is_default to workspaces response schema ([85996b3](https://github.com/Phala-Network/phala-cloud/commit/85996b395c5fa7efdfe37dbf1a300964d4d441fd))
* use workspace slug as profile name, add profiles command, update default API dom ([5c150a0](https://github.com/Phala-Network/phala-cloud/commit/5c150a024d575414e60d6ead26f19a1fc9eaad4a))

### refactor

* sync NodeRef schema from backend ([f699002](https://github.com/Phala-Network/phala-cloud/commit/f699002fc24785c58cfa0452c0ab151d6c661117))

## [0.2.1](https://github.com/Phala-Network/phala-cloud/compare/js-v0.2.1-beta.4...js-v0.2.1) (2026-01-31)

### feat

* add standalone patch api for docker compose & prelaunch script ([efc9a05](https://github.com/Phala-Network/phala-cloud/commit/efc9a052c2fb0b4cf6eedce628c81ef86826fa4d))
* add validate rule to cvm name when creating cvm ([92138c0](https://github.com/Phala-Network/phala-cloud/commit/92138c0de0021aa06e597aa321c9a293bb078e2a))
* **js:** add batch CVM status action ([e99e0d8](https://github.com/Phala-Network/phala-cloud/commit/e99e0d86b79b9cf871f58d0e878a569e4808d6bc))
* **js:** add workspace nodes and quotas API ([2adf971](https://github.com/Phala-Network/phala-cloud/commit/2adf971646d0b628ad68e9a07a28b98bba02e88d))
* **sdk:** add apps API actions and fix versioned client types ([3ee04e9](https://github.com/Phala-Network/phala-cloud/commit/3ee04e9611047a47890e852bdf6f3244fd457c98))
* **sdk:** add generic request methods with full response support ([b15c2c6](https://github.com/Phala-Network/phala-cloud/commit/b15c2c627ece4472edf1ecb8a877cd619808e662))
* **sdk:** add versioned API client with type-safe return types ([4378e37](https://github.com/Phala-Network/phala-cloud/commit/4378e373966efbd72d987d399e0f7c9136c2d9dd))
* unify name convention across cli & sdk ([9f0d1e5](https://github.com/Phala-Network/phala-cloud/commit/9f0d1e5d5f7b600a1c963816ce38bd1b402885ef))
* update cvm_id ([a66bc1f](https://github.com/Phala-Network/phala-cloud/commit/a66bc1fe4a42dd01ef3f1548e54562eb5541e193))

### fix

* api path for batch cvm status query ([5764b05](https://github.com/Phala-Network/phala-cloud/commit/5764b05be417e568f91b88235d7f1511b62b4724))
* **deploy:** default public logs/sysinfo to true in CLI ([4576dea](https://github.com/Phala-Network/phala-cloud/commit/4576dea806d559fcc30ae74c6f38796141d2ce2d))
* **js:** expose instance_type in CVM response ([0c30066](https://github.com/Phala-Network/phala-cloud/commit/0c300668e821a58d30cceff5dff264dcbedbddee))
* **js:** restore BaseClient request* methods to match Client interface ([5123018](https://github.com/Phala-Network/phala-cloud/commit/5123018f01025e7dfaa5ea6d3986275de9e495b8))
* migrate URLs from cloud.phala.network to cloud.phala.com ([cd48ed4](https://github.com/Phala-Network/phala-cloud/commit/cd48ed4a69ffc3bd4f4c8483946cf21c2b5d38a6))
* **schema:** add fallback defaults for deprecated CVM fields ([6d3b934](https://github.com/Phala-Network/phala-cloud/commit/6d3b93425d6634dc11d7337cdd6d0a44a68f4f0a))
* **sdk,cli:** send update_env_vars flag when updating CVM env vars ([26077d1](https://github.com/Phala-Network/phala-cloud/commit/26077d17e418182d96b995e23e26a48da697d3ea))
* **sdk:** add missing kms_info field to ProvisionCvmSchema ([6fc3b6a](https://github.com/Phala-Network/phala-cloud/commit/6fc3b6aa9d0c733ad2394108e388ebb907324e22))
* **sdk:** smart default for instance_type to allow vcpu/memory params to work ([9f0780d](https://github.com/Phala-Network/phala-cloud/commit/9f0780d892d43bcb354a5ada1b8edf7c2912e0fc))
* **test:** update e2e test assertions to match schema changes ([8cc1ac3](https://github.com/Phala-Network/phala-cloud/commit/8cc1ac354d1a5c0eaafa5cccaeb8434dab36d4b6))
* typing ([8588ac2](https://github.com/Phala-Network/phala-cloud/commit/8588ac2760122f2a5aeea460a47c1b91b10f0249))
* upgrade CLI to API version 2026-01-21 ([9a92b54](https://github.com/Phala-Network/phala-cloud/commit/9a92b54038daba79f9e54e6e6c42c37744031d5c))

### refactor

* **auth:** update v20260121 schema to remove sensitive fields and add avatar support ([7543c21](https://github.com/Phala-Network/phala-cloud/commit/7543c21943537d7f0797d9661e5f8d6233bf7a8e))
* **cli:** unify error handling with SDK's ResourceError ([fd815b1](https://github.com/Phala-Network/phala-cloud/commit/fd815b13a241a1c22d0c59ae24f99cfec8828712))
* extract auth schemas into credentials module and fix CLI type safety ([21a545b](https://github.com/Phala-Network/phala-cloud/commit/21a545b3901c80a203372195358cbcb37dcfad5f))
* **js:** simplify versioned response types and add withVersion method ([b952770](https://github.com/Phala-Network/phala-cloud/commit/b9527706568c288ba36e5d14e159503dac75c5f0))

## [0.2.1-beta.4](https://github.com/Phala-Network/phala-cloud/compare/js-v0.2.1-beta.2...js-v0.2.1-beta.4) (2025-11-12)

### feat

* add smart CVM ID format detection and normalization ([da007bd](https://github.com/Phala-Network/phala-cloud/commit/da007bd4e9b9156968158bdecb9a9a1c264a532f))
* added support for custom nonce & app-id on provisioning ([da7c944](https://github.com/Phala-Network/phala-cloud/commit/da7c944eba3520ff68a7ece253f93c883b9364ec))
* added transaction_hash to update_cvm_envs ([6789070](https://github.com/Phala-Network/phala-cloud/commit/678907042de1336c3c48a7f7b0fb37504c6bc7b1))
* added updateCvmEnvs action ([87b1f14](https://github.com/Phala-Network/phala-cloud/commit/87b1f146dc0ab757bf8410038e71879483612e03))
* **js:** export SUPPORTED_API_VERSIONS ([be627f9](https://github.com/Phala-Network/phala-cloud/commit/be627f9f1540fdab72990a1ed9eac13ab9c3cec7))

### fix

* make sigstore happier ([58b8063](https://github.com/Phala-Network/phala-cloud/commit/58b8063f78a21cdd8e70a5985081d524fa789db6))

## [0.2.1-beta.2](https://github.com/Phala-Network/phala-cloud/compare/js-v0.2.1-beta.1...js-v0.2.1-beta.2) (2025-11-10)

### feat

* adjust the cvm state schema ([9900535](https://github.com/Phala-Network/phala-cloud/commit/990053566103adfd9924d5ffd68b8032b32f9384))
* example script deploy-gpu-instance.ts ([ea429b2](https://github.com/Phala-Network/phala-cloud/commit/ea429b290a8985338ded6420931674e09ecd9a4a))
* update @phala/dstack-sdk to 0.5.7 ([ed0e0cf](https://github.com/Phala-Network/phala-cloud/commit/ed0e0cf24443b162f49ef2a083918bf26878ac2c))

### fix

* provision CVM argument signature is incorrect ([cbee5db](https://github.com/Phala-Network/phala-cloud/commit/cbee5db03178250db9d147f8879a841dcdb82ca3))

## [0.2.1-beta.1](https://github.com/Phala-Network/phala-cloud/compare/js-v0.2.0...js-v0.2.1-beta.1) (2025-11-10)

### feat

* added list instance types API ([b1f3294](https://github.com/Phala-Network/phala-cloud/commit/b1f3294788705a647a52a226d535763c044e1fd0))
* added parser for structured error ([71d5e45](https://github.com/Phala-Network/phala-cloud/commit/71d5e453de557099c48cb3faf0f2d50938d997fe))
* adjust cvm provision API & deploy API schemas ([f42fccf](https://github.com/Phala-Network/phala-cloud/commit/f42fccfc029e02b5d65ae1c8643d24984e8283b9))
* improve error message & fix linting ([cc177ff](https://github.com/Phala-Network/phala-cloud/commit/cc177ff923a499fee05b9f18fc3199bf2569a66e))
* update deploy script example ([a6806a5](https://github.com/Phala-Network/phala-cloud/commit/a6806a5cb028044376c548309073654ac988a037))

### fix

* FastApiValidationErrorItem not parsed correctly ([6d696c7](https://github.com/Phala-Network/phala-cloud/commit/6d696c7021a98ab748b1a85dde62518c494e6f3a))
* provision cvm schema ([031fc32](https://github.com/Phala-Network/phala-cloud/commit/031fc3242fd7fa5f894f319ea613f891b104cca9))
* when provisioning compose_file.name is optional ([0259de0](https://github.com/Phala-Network/phala-cloud/commit/0259de0408507368d378610f7bf84b63dd72f6dc))

## [0.2.0](https://github.com/Phala-Network/phala-cloud/compare/js-v0.1.2...js-v0.2.0) (2025-11-05)

### feat

* added actions get_available_os_images and update_os_image ([95e5688](https://github.com/Phala-Network/phala-cloud/commit/95e5688c14f9451791fd8b59bef6950a5e326652))
* added getCvmState & safeGetCvmState ([fc791ac](https://github.com/Phala-Network/phala-cloud/commit/fc791acc28834f1255b5a8def32494cc128935cf))
* added next-app-ids API ([26d9dfc](https://github.com/Phala-Network/phala-cloud/commit/26d9dfce02e29f80bf572aff1268e60db314d580))
* experimental watchCvmState implementation ([ce316d9](https://github.com/Phala-Network/phala-cloud/commit/ce316d9d3af9c865c7b27471a8844f5d8e025485))
* improve type inference for define-action ([e32a71c](https://github.com/Phala-Network/phala-cloud/commit/e32a71c3dd6d4460bcd06c7761da17124b70676a))

## [0.1.2](https://github.com/Phala-Network/phala-cloud/compare/js-v0.1.1...js-v0.1.2) (2025-10-29)

### docs

* added api versioning docs ([443f71c](https://github.com/Phala-Network/phala-cloud/commit/443f71c7873eae7fc81e6760b716614edcc55f7f))

### feat

* **sdk:** redesign errors & added event emitter support ([c2036fa](https://github.com/Phala-Network/phala-cloud/commit/c2036fa6a87587269c516538ea9573bed7596f9a))

### fix

* **cvms:** include update_env_vars in compose file update request body ([f3eb2cd](https://github.com/Phala-Network/phala-cloud/commit/f3eb2cd40ae7515e5e26fd8543e088da780d579c))
* error check in define-action ([ed8b8b9](https://github.com/Phala-Network/phala-cloud/commit/ed8b8b9578bd4b213b0a7bfdd457c8108af0b466))

## [0.1.1](https://github.com/Phala-Network/phala-cloud/compare/js-v0.1.1-beta.3...js-v0.1.1) (2025-10-24)

### feat

* attach getHash & toString to AppCompose object ([d013f99](https://github.com/Phala-Network/phala-cloud/commit/d013f99ac269a5bea196c801104e1868fcaa91df))
* export utils function in get_compose_hash ([4c4c5fc](https://github.com/Phala-Network/phala-cloud/commit/4c4c5fcce1c2cfe2aaaad48f7539512d220e4621))
* remove autofillComposeFileName for provision_cvm ([853028e](https://github.com/Phala-Network/phala-cloud/commit/853028e67281adf1db26c92400f6b97f4b8c0f24))

## [0.1.1-beta.3](https://github.com/Phala-Network/phala-cloud/compare/js-v0.1.1-beta.2...js-v0.1.1-beta.3) (2025-10-15)

### feat

* added all new actions to decorated client ([5f96a36](https://github.com/Phala-Network/phala-cloud/commit/5f96a361e7215ef0cfd9216bb7c7cdc08b405bb6))
* added cvm operations ([1b3dd21](https://github.com/Phala-Network/phala-cloud/commit/1b3dd21e3eaa0408cc12417ee29687e9f648defb))
* added schema CvmId ([c15b115](https://github.com/Phala-Network/phala-cloud/commit/c15b115d4d424fe6f521e571c8184c8b70bad2a4))
* cvm query actions ([6281c4f](https://github.com/Phala-Network/phala-cloud/commit/6281c4f3d23acd02bccd421a4ac0498015215b35))
* CVM Update Operations ([0faf460](https://github.com/Phala-Network/phala-cloud/commit/0faf460840545f396d66b9221d0388bdec748a44))
* optimized for CvmLegacyDetailSchema & added VMSchema ([7f8a1ad](https://github.com/Phala-Network/phala-cloud/commit/7f8a1ada619ad892911257cc90a57ba5a58d7c93))

### fix

* API request payload structure & adjust schemas ([b18db5e](https://github.com/Phala-Network/phala-cloud/commit/b18db5ec3c28b92509ffec985f89a3bb7062cd74))

### refactor

* using the new CvmId in get_cvm_info & get_cvm_compose_file ([728ac08](https://github.com/Phala-Network/phala-cloud/commit/728ac08281385cf9d88f0b0554a9923326a65119))

## [0.1.1-beta.2](https://github.com/Phala-Network/phala-cloud/compare/js-v0.1.1-beta.1...js-v0.1.1-beta.2) (2025-10-13)

### docs

* update code examples ([4476b29](https://github.com/Phala-Network/phala-cloud/commit/4476b2935a3e0c778865698c47c0082b99795a8c))

### feat

* improve type hints for the decorated client ([32c03cf](https://github.com/Phala-Network/phala-cloud/commit/32c03cf181d06c6fa2f7f8e7d3688cf7403d9c33))

### refactor

* **js:** simplify package exports and add createBaseClient ([d7e1c97](https://github.com/Phala-Network/phala-cloud/commit/d7e1c976b61c8b7b0f127e2913c375e4d07d59c4))

## [0.1.1-beta.1](https://github.com/Phala-Network/phala-cloud/compare/js-v0.0.12...js-v0.1.1-beta.1) (2025-10-13)

### feat

* added client.extend ([3830d9c](https://github.com/Phala-Network/phala-cloud/commit/3830d9c1e9c9592fa4f84b2810386d0167285787))
* added new factory function createClient ([067a5bf](https://github.com/Phala-Network/phala-cloud/commit/067a5bfb4f09f84cc32ffc39068699b1e59d11d5))
* define_action accepts override return type ([d775fff](https://github.com/Phala-Network/phala-cloud/commit/d775fff2ae026555b8618c9bf97212b0fb81ffd1))
* **js:** added defineAction ([3953e3b](https://github.com/Phala-Network/phala-cloud/commit/3953e3bb7fbdf8d00e54655fd82c8a5378abd446))
* override return types for kms ([c00815b](https://github.com/Phala-Network/phala-cloud/commit/c00815b788d05d9f71d9d445df188e993a660747))

### fix

* broken type inference compatible ([1fcdea6](https://github.com/Phala-Network/phala-cloud/commit/1fcdea6f6d1a2214d1544d052914c52f1f337b9c))
* override return type for getCvmInfo ([87311f2](https://github.com/Phala-Network/phala-cloud/commit/87311f25b22adea6044d067f05b6ca887aa14790))
* type inference ([cb2a319](https://github.com/Phala-Network/phala-cloud/commit/cb2a3191f78b39dfc0e0f4b81370e0b900b59711))

### refactor

* get_current_user with defineAction ([6774c30](https://github.com/Phala-Network/phala-cloud/commit/6774c300a5546153c4311d38c608ceb3ace414e6))
* refcator all actions & typing ([db2fe40](https://github.com/Phala-Network/phala-cloud/commit/db2fe403881d49294afd0fa67a6981b0c3211bf2))
* reorganized action functions ([017c62c](https://github.com/Phala-Network/phala-cloud/commit/017c62c88ccd58df0f21c3f78c0f97fd7c567d68))
* **test:** consolidate action tests and reduce duplication ([99659bd](https://github.com/Phala-Network/phala-cloud/commit/99659bd4e383f2839ba22b344d47b6787d5e2239))

## [0.0.12](https://github.com/Phala-Network/phala-cloud/compare/57cb8ef05d2227ee6f9fb9135aa9f1ff5dfbd021...js-v0.0.12) (2025-10-11)

### doc

* add action functions development guide ([1637f68](https://github.com/Phala-Network/phala-cloud/commit/1637f685ec7d3465bec848cb308959fba3bae661))

### docs

* @phala/dstack-sdk 0.5.2 ([aee3b77](https://github.com/Phala-Network/phala-cloud/commit/aee3b770dd6131fa0c018188d57619ef7ee3c582))
* update action-functions-guide ([69ad4c9](https://github.com/Phala-Network/phala-cloud/commit/69ad4c9b0b0a51c578a2f2dbca0dc1a663bf0faf))
* update action-functions-guide ([d58e4fe](https://github.com/Phala-Network/phala-cloud/commit/d58e4feefab30438832f4090d5f6720b295d3ed7))

### feat

* **actions:** add_compose_hash ([f13e3ee](https://github.com/Phala-Network/phala-cloud/commit/f13e3eeb41024844a7fd4de0c39db5d3b1adb08c))
* **actions:** commit_cvm_compose_file_update ([1bc4acc](https://github.com/Phala-Network/phala-cloud/commit/1bc4acc28867de4ce1d3b45b90767db0447557eb))
* **actions:** commit_cvm_provision ([8dd5de4](https://github.com/Phala-Network/phala-cloud/commit/8dd5de41470e920834d3fd91bc42d7a6a024cfa2))
* **actions:** deploy_app_auth ([dffaec2](https://github.com/Phala-Network/phala-cloud/commit/dffaec229a8fbc8569a977d0aee336343d8f199e))
* **actions:** get_available_nodes ([598c3fb](https://github.com/Phala-Network/phala-cloud/commit/598c3fb310110ae9bc671e60d2f0a23cd4fa5909))
* **actions:** get_current_user ([45f8725](https://github.com/Phala-Network/phala-cloud/commit/45f8725fee5138263fb1b4e3e589440219f7f64f))
* **actions:** get_cvm_compose_file ([db69691](https://github.com/Phala-Network/phala-cloud/commit/db6969167756942b19d04d703b4a6d51b308ca08))
* **actions:** provision_cvm ([975e767](https://github.com/Phala-Network/phala-cloud/commit/975e76734deae234776886bea5e895dd42d89988))
* **actions:** provision_cvm_compose_file_update ([65f2058](https://github.com/Phala-Network/phala-cloud/commit/65f2058eb8a2db6fad308273a162bee8297d3900))
* add debug & debug logging ([00031a7](https://github.com/Phala-Network/phala-cloud/commit/00031a726eb2dfa15b2dcaf1f78884689ec25d03))
* added default_kms & kms_list to get_available_nodes & added example ([9ce56d5](https://github.com/Phala-Network/phala-cloud/commit/9ce56d510c46c79ee4af765dbe9b2fbd97f95a2f))
* added listInstanceTypes ([a21b36f](https://github.com/Phala-Network/phala-cloud/commit/a21b36fe698ea253d66a70eb094a098002ee8cb8))
* added support for browser scenario. ([d278f44](https://github.com/Phala-Network/phala-cloud/commit/d278f448b61cfbf6ca3da62d964a71371e7ca592))
* added update_env_vars flag for app compose update ([fc05423](https://github.com/Phala-Network/phala-cloud/commit/fc054238d1b92fb4762b0513cb3259efa5a52087))
* added x-phala-version to headers. ([754c313](https://github.com/Phala-Network/phala-cloud/commit/754c3136b86b4a69da974bc40d4257e83f6c29e6))
* apis for CVM deploy & update ([d9ee4a0](https://github.com/Phala-Network/phala-cloud/commit/d9ee4a08273d7966793ff07551a8706cd0c460e9))
* combined deploy & update in one example. ([955581b](https://github.com/Phala-Network/phala-cloud/commit/955581bcde0f20c14f1786efd7ec25d53afc7afc))
* cvm list & get info APIs ([300a04b](https://github.com/Phala-Network/phala-cloud/commit/300a04b32e11f3aea30a5cea5c63d4c94e1b91f1))
* **js:** env var support & test isolation for client config ([bd45b71](https://github.com/Phala-Network/phala-cloud/commit/bd45b71b48c94a5ae565c2378208b4b435140812))
* parse_dotenv ([0129f14](https://github.com/Phala-Network/phala-cloud/commit/0129f148131649d404fae825321332482a35ef9e))
* utils for deployment ([0756cb6](https://github.com/Phala-Network/phala-cloud/commit/0756cb6bbcde6d5edcd2afc765e3ccbd62148b53))
* workspace APIs. ([1ab4339](https://github.com/Phala-Network/phala-cloud/commit/1ab433915e5d38b2a528c7245eb4a84dc1ed86bf))

### fix

* add CvmLegacyDetailSchema for get_cvm_info ([24e91f7](https://github.com/Phala-Network/phala-cloud/commit/24e91f71b1160903af85990999972bc934a47340))
* add_compose_hash no more requires kmsContractAddress ([351e9ef](https://github.com/Phala-Network/phala-cloud/commit/351e9ef7084a3dddf95e9c30002c4892845badd8))
* added kms_id in provision cvm request ([2f381d4](https://github.com/Phala-Network/phala-cloud/commit/2f381d43d7c4e93515582ae1858c6c1a79a22b19))
* build error. ([5920500](https://github.com/Phala-Network/phala-cloud/commit/59205001edcd646ab410d1f5f5e878ed7112a8f2))
* export EnvVar type ([5c40572](https://github.com/Phala-Network/phala-cloud/commit/5c40572c14dc4224d0422b2dd68af84da20b07d3))
* inacccurate type for chain_id ([4fe4745](https://github.com/Phala-Network/phala-cloud/commit/4fe4745fdf9fe7248a64fd458f84b70e03be61cf))
* os image version can be x.y.z.{i} optionally. ([f8eb062](https://github.com/Phala-Network/phala-cloud/commit/f8eb0621f045e876927d1a026aa2d4e0fc8be2ba))
* test cases ([058548a](https://github.com/Phala-Network/phala-cloud/commit/058548add905a83a31126d6de55e835276e694a8))
* the kms_info is unexpected struct in cvm_info ([f410b81](https://github.com/Phala-Network/phala-cloud/commit/f410b81da4ce2cf63e37296b2063e9241b93a227))
* typing of CommitCvmComposeFileUpdateRequest ([fcb6b0b](https://github.com/Phala-Network/phala-cloud/commit/fcb6b0b92733dd4d6f53f6157666e4a4a2cc88c1))

### refactor

* Init JS SDK design. ([57cb8ef](https://github.com/Phala-Network/phala-cloud/commit/57cb8ef05d2227ee6f9fb9135aa9f1ff5dfbd021))
* allow customize RPC URL for deployAppAuth & addComposeHash ([ff9c5f9](https://github.com/Phala-Network/phala-cloud/commit/ff9c5f904daa8da050090e6138a238c9fa06e4be))
* allows app_id with 0x prefix ([b591c07](https://github.com/Phala-Network/phala-cloud/commit/b591c079105a517053a1c26d1759f64b16dccbdd))
* base Client ([ed3bdfc](https://github.com/Phala-Network/phala-cloud/commit/ed3bdfc8477e87be555a8b8a0779ed6ebbb86580))
* consistent name style for params. ([1cd44f8](https://github.com/Phala-Network/phala-cloud/commit/1cd44f8f443d7d9c6a78244b892376de5d3d7640))
* switch fetchInstance to protected that extend friendly. ([b228598](https://github.com/Phala-Network/phala-cloud/commit/b22859854b624863e12233e78ea83b6ee299d92b))
* tsconfig.json in the example ([7eb5096](https://github.com/Phala-Network/phala-cloud/commit/7eb5096af47252d76e99bf663ccba86a2ca9b2df))
* typing & tests ([eb25449](https://github.com/Phala-Network/phala-cloud/commit/eb25449d39f4f513a6e4038f6ad3937a47ba9758))
* typing for KmsInfo ([984ed28](https://github.com/Phala-Network/phala-cloud/commit/984ed284d90f82e63b2af83dd5c1478cf8c911f1))
* use same schema for app compose for loose restrction. ([41b1fcd](https://github.com/Phala-Network/phala-cloud/commit/41b1fcdaf6910d23066f96adaf09e4d1fbd9fbcd))
