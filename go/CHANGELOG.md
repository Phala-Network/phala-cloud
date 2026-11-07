## [](https://github.com/Phala-Network/phala-cloud/compare/sdks/go/v0.2.0...sdks/go/v) (2026-11-07)

### ⚠ BREAKING CHANGE

* **go:** replace InitScripts: &ProvisionInitScripts{EnvMerge: true}
with InitScripts: []InitScriptSlug{InitScriptEnvMerge}.
* **go:** PatchCVMRequest.Listed is removed. Call UpdateCVMListed.
* **go:** Go: UpdateCVMVisibility returns *CVMUpdateResponse instead of *CVMVisibility, and the CVMVisibility type is removed.
* **go:** Go: PatchCVMRequest drops GatewayEnabled, SecureTime and AllowRestart, which the API never applied. PatchCVM returns a 465 as a PatchCVMResponse with RequiresOnChainHash set instead of an *APIError.
* **sdk:** Go: ProvisionComposeUpdateRequest.EncryptedEnv is removed. GetComposeHash normalizes by default, so callers comparing stored hashes get different values unless they pass false. NewClient returns an error for a negative WithMaxRetries, a base URL with userinfo, and missing credentials. WatchCVMState reconnects when the stream ends without a complete event, and the default MaxRetries of nil means unlimited, so pass a cancellable context or set MaxRetries. []string request fields use omitzero instead of omitempty, so a non-nil empty slice is sent as []. ConfirmCVMPatch sends X-Compose-Hash and X-Transaction-Hash headers with an empty JSON object body and returns correlation_id.
* **sdk:** JavaScript: watchCvmState with maxRetries N allows N+1 attempts, and MaxRetriesExceededError.attempts is N+1. The extend() factory receives Client<ApiVersion>, its result type omits withVersion and extend and re-types them, and extension methods on a withVersion clone return unknown.
* **go:** type GetAvailableOSImages response with requires_gpu
* **sdk:** DeviceIdEntry.os_image_ids (python) and
DeviceIDEntry.OSImageIDs (go) are removed. No caller in this repo referenced
either; consumers reading them were reading an empty list.

### docs

* clarify inherited replica placement ([a33e890](https://github.com/Phala-Network/phala-cloud/commit/a33e8904470d10dd08060731a3b825899096e658))
* **go:** describe 465 handling and visibility request changes ([151ad33](https://github.com/Phala-Network/phala-cloud/commit/151ad339d42357cdb04ba14d799621389c4c101b))
* **go:** describe the compose patch, launch token and init-script upgrade notes ([280b3b0](https://github.com/Phala-Network/phala-cloud/commit/280b3b0a1b1121b78d50559560cfe64a6f59342e))
* **go:** record CVM update contract changes in the upgrade notes ([9991aee](https://github.com/Phala-Network/phala-cloud/commit/9991aee0f82b93eeef0ff07252ea78c1f1e42382))
* **sdk:** describe the credits fields of the current user ([cbb3501](https://github.com/Phala-Network/phala-cloud/commit/cbb35011c1018fa7856c3f6af0994dc407a31a81))
* **sdk:** record breaking changes in Go and JavaScript SDKs ([b174cf0](https://github.com/Phala-Network/phala-cloud/commit/b174cf016082397296da4494fedb2e504e0d1271))
* **sdk:** say what a suspended workspace means for its CVMs ([5694677](https://github.com/Phala-Network/phala-cloud/commit/56946773738a50828f29110dbbba880e2072ff08))

### feat

* **go:** add CVM annotations, app launch token and init-scripts methods ([1be1f8f](https://github.com/Phala-Network/phala-cloud/commit/1be1f8f2c1207d6321abb426a4d4e9c37d84c3b7))
* **go:** add CVM update SSH key and token actions ([9d3d2f3](https://github.com/Phala-Network/phala-cloud/commit/9d3d2f31eecb0f2d7c22d51bcff9f58001bad42f))
* **go:** add encrypted_env to app redeploy and add RedeployCVMRevision ([e5bef6c](https://github.com/Phala-Network/phala-cloud/commit/e5bef6cbcf27763bc231a598a8040cd0695cec9a))
* **go:** add ephemeral_data_disk to ComposeRequirements ([52086e4](https://github.com/Phala-Network/phala-cloud/commit/52086e4596d33beff3641898c603870fc94e136e))
* **go:** allow redeploy with mismatched env keys ([7fe2086](https://github.com/Phala-Network/phala-cloud/commit/7fe2086d42858b72c169bb4ef95d98860499e3c6))
* **go:** patch a bash app's script through ComposePatch.BashScript ([13c9400](https://github.com/Phala-Network/phala-cloud/commit/13c9400a4a85cb2b74e63c02de9398ce60e43dd8))
* **go:** same-path two-phase CVM create on POST /cvms ([ff34f01](https://github.com/Phala-Network/phala-cloud/commit/ff34f01ea557131d968993e4014339d6c2ce100e))
* **go:** send create init_scripts as slugs and add launch token, annotations and raw comp ([ff6f404](https://github.com/Phala-Network/phala-cloud/commit/ff6f40442e3a78500bde65b3e50e921c083e5c22))
* **go:** send the compose merge patch, init scripts and confirm_data_wipe from PatchCVM ([66e37e1](https://github.com/Phala-Network/phala-cloud/commit/66e37e1f419489e366ed801f3d9bb35936a62a74))
* **go:** type GetAvailableOSImages response with requires_gpu ([3975aa0](https://github.com/Phala-Network/phala-cloud/commit/3975aa077e04b373b7612b0bb64482789a6e2477))
* **sdk:** add disk usage fields to CVM resource usage ([7274d17](https://github.com/Phala-Network/phala-cloud/commit/7274d17d22f062e660cc0a669eecd614969deb5b))
* **sdk:** add managed_env to CVM detail schemas ([17ff65c](https://github.com/Phala-Network/phala-cloud/commit/17ff65c6d4faba2958ef5f211e79fb1d24cea014))
* **sdk:** add max_placeable_count to ProductGpuAvailability (R2-1) ([78d9c7d](https://github.com/Phala-Network/phala-cloud/commit/78d9c7d048bbddcff5ee27b0f4caf66b5a2c145c))
* **sdk:** add mr_config_id V3 helpers across JS, Python and Go ([e7d2f3a](https://github.com/Phala-Network/phala-cloud/commit/e7d2f3adc479b6a377d3b4efa405574fc00b58e2))
* **sdk:** add pre-launch script upgrade actions ([992e13d](https://github.com/Phala-Network/phala-cloud/commit/992e13d27dad1d1fff2f5f411f5f915b1a47d73b))
* **sdk:** align the default request timeout at 60s ([db83998](https://github.com/Phala-Network/phala-cloud/commit/db8399813df52803c0c36b2d00a204d58436cc37))
* **sdk:** carry GPU product requirement and product-scoped availability ([100dd56](https://github.com/Phala-Network/phala-cloud/commit/100dd5617ac70ba22f91e375752896e40946cac5))
* **sdk:** declare the full workspace response schema ([12e5e40](https://github.com/Phala-Network/phala-cloud/commit/12e5e4059a7084dfb19e3c0a103ea04fe1fec60a))
* **sdk:** discriminate update results by status in the Go SDK ([a00c057](https://github.com/Phala-Network/phala-cloud/commit/a00c0572bd2e8edebf0c0300acd6749ccebae980))
* **sdk:** expose compose_unchanged on compose file update provisioning ([234dd77](https://github.com/Phala-Network/phala-cloud/commit/234dd773c62a3a06932a90c98d6d9aa4ad4ff682))
* **sdk:** expose unified OS image hardware support ([8e61cc8](https://github.com/Phala-Network/phala-cloud/commit/8e61cc8938c4eddef15f8abd052d838f3a026779))
* **sdks:** expose GPU rental renewal state ([b0f474b](https://github.com/Phala-Network/phala-cloud/commit/b0f474b3a742ee19d2d90188a9275385303a5d19))
* **sdk:** support replica OS image selection ([277bb2b](https://github.com/Phala-Network/phala-cloud/commit/277bb2ba649a2615fc0a0b1ae9de00cbaabe6bf8))
* select creation nodes by physical name ([51be05b](https://github.com/Phala-Network/phala-cloud/commit/51be05b12d18cb3205ea5801d17f530f3f9f2df9))
* use node names for replicas and allowance checks ([a8009eb](https://github.com/Phala-Network/phala-cloud/commit/a8009ebafbc1c75ac57ce9bf972fb637d00432e6))

### fix

* **go:** align PatchCVM with the PATCH /cvms/{id} request ([2084deb](https://github.com/Phala-Network/phala-cloud/commit/2084debe2f698ed9052c0114d626a2dc9d746271))
* **go:** align provision and compose request schemas ([bbf55d1](https://github.com/Phala-Network/phala-cloud/commit/bbf55d1cada8cf758be05127316888517931057a))
* **go:** always send a gpus array in GPUConfig ([b957a0e](https://github.com/Phala-Network/phala-cloud/commit/b957a0ef5a3b94c87d33b1b3070e69187be8e669))
* **go:** apply Listed only after the CVM patch is accepted ([7a858dd](https://github.com/Phala-Network/phala-cloud/commit/7a858ddff48779330f1cfea9fa8f3ced6a5ffd34))
* **go:** correct CVM patch confirmation wire contract ([311ab5e](https://github.com/Phala-Network/phala-cloud/commit/311ab5ec5976c246d9ce968657608880eac75061))
* **go:** decode 465 kms_info as KMSInfo ([425c4dd](https://github.com/Phala-Network/phala-cloud/commit/425c4dd8338565f67c79c01fbb49171a82f6b772))
* **go:** hash app-compose like the backend dump_dict ([a65e457](https://github.com/Phala-Network/phala-cloud/commit/a65e45767e2b36d32491c1e4c797759e7c76bfe3))
* **go:** hash app-compose with the backend's compact JSON ([840633a](https://github.com/Phala-Network/phala-cloud/commit/840633a7c23bdb387354f1f027987b3692f4eea9))
* **go:** keep 465 without a compose hash as an APIError ([ce403b8](https://github.com/Phala-Network/phala-cloud/commit/ce403b82f6c4059d557e1c2a78abd6db152a0802))
* **go:** keep Go 1.25 minimum for x/crypto bump ([95f793b](https://github.com/Phala-Network/phala-cloud/commit/95f793b4e5552f09b16f1d9ec9d8d50bf2a2db1d))
* **go:** make CVM state watches reliable ([1828094](https://github.com/Phala-Network/phala-cloud/commit/1828094e9f89576dbc4a2b20045c66ba8bf46131))
* **go:** move UpdateCVMVisibility to the unified PATCH endpoint ([641401d](https://github.com/Phala-Network/phala-cloud/commit/641401d59485fcdd757b2754bc337c2271656fa2))
* **go:** normalize typed compose hashes by default ([c0bb3d9](https://github.com/Phala-Network/phala-cloud/commit/c0bb3d960d33031ebc91a9b1fb7fbe3a57e6df0d))
* **go:** pin historical methods to their API version ([4adae95](https://github.com/Phala-Network/phala-cloud/commit/4adae957bfe3878d16fb6db8263d74c43753e1f2))
* **go:** reject negative retry limits ([4a7237d](https://github.com/Phala-Network/phala-cloud/commit/4a7237dd1c9c0ee684e60bb8c14b12a87d580c2b))
* **go:** stop sending allow_restart from UpdateCVMResources ([c42386b](https://github.com/Phala-Network/phala-cloud/commit/c42386b1b737b2e2fe10ab17fb8fe55324a00b89))
* **go:** support bearer authentication and workspace selection ([76e77b2](https://github.com/Phala-Network/phala-cloud/commit/76e77b2f7833efa1083eecc6726701231ac9629a))
* prevent API key leaks across SDK redirects ([e3dbb83](https://github.com/Phala-Network/phala-cloud/commit/e3dbb834a7cc85ba031894df663e660b9ec0d815))
* **sdk:** stop pinning the pubkey request to the node-keyed API ([c29470b](https://github.com/Phala-Network/phala-cloud/commit/c29470b2f7ae46754351f2177a4a5fb6daac5a81))
* **sdk:** use canonical resource identifiers for non-admin requests ([3f96e25](https://github.com/Phala-Network/phala-cloud/commit/3f96e25d68f47a3b28ccb6197088bb8e61eb40ab))

### refactor

* **go:** drop Listed from PatchCVMRequest ([d9a1d44](https://github.com/Phala-Network/phala-cloud/commit/d9a1d44a86c11babdaad4a483e5d9a38f2939c6e))
* **go:** let the backend validate empty patches ([b6124d0](https://github.com/Phala-Network/phala-cloud/commit/b6124d0d2fedc5fc8a61f0935aad0090c300fbb6))
* **sdk:** drop os_image_ids from DeviceIdEntry ([fb69cec](https://github.com/Phala-Network/phala-cloud/commit/fb69cec58a9cda10ad1b4bbd24bc39134a27aafc))
## [](https://github.com/Phala-Network/phala-cloud/compare/sdks/go/v0.1.1...sdks/go/v) (2026-07-26)

### feat

* add algorithm_version to DeviceIdEntry ([701ac00](https://github.com/Phala-Network/phala-cloud/commit/701ac0017acc5fb7851e285e27cc1e9ba7af05cd))
* add device_ids matrix to node schemas ([de36a3a](https://github.com/Phala-Network/phala-cloud/commit/de36a3af84b1f16abdadeada607d00843817e244))
* add kms_contract_id to CVM SDK schemas, deprecate kms_id ([16734b9](https://github.com/Phala-Network/phala-cloud/commit/16734b9d22c2e6584c3c320b64d2bd48cdcb5a2b))
* add versioned CVM hashid SDK schemas ([b5b3766](https://github.com/Phala-Network/phala-cloud/commit/b5b376620be08e1efbcb26f1ce78fd71bef90544))
* expose latest CVM hashid schemas ([d317ebf](https://github.com/Phala-Network/phala-cloud/commit/d317ebf8acb4a1b53d5c080725af07a2a700d2a5))
* expose request IDs on structured errors ([adcc644](https://github.com/Phala-Network/phala-cloud/commit/adcc6444cf35a993bb37a36ae166e2d4b9b25f50))
* **go,python:** add mr_config_id computation ([d558b09](https://github.com/Phala-Network/phala-cloud/commit/d558b09cb114300c861ac99d76915779e3363993))
* **go:** add APIError.ComposePrecondition helper ([abc66ca](https://github.com/Phala-Network/phala-cloud/commit/abc66ca01034ead2ba984c732a5fc781eb2a9acf))
* **go:** add ChainName helper to CvmKmsInfo ([b9770a4](https://github.com/Phala-Network/phala-cloud/commit/b9770a4c10157c2aad5d8e95ce73c50d42d312a4))
* **go:** add ComposeHashRegistered to ProvisionCVMResponse ([52207cf](https://github.com/Phala-Network/phala-cloud/commit/52207cfa0bab4468a54c2bf0e6d82c98e4187e0d))
* **go:** add CreateAppInstance and CreateAppInstanceRequest ([73f25e1](https://github.com/Phala-Network/phala-cloud/commit/73f25e18adbbd5ec44d19f6f57ec490d4042b528))
* **go:** add CVM create resource graph ([52168d2](https://github.com/Phala-Network/phala-cloud/commit/52168d21a9ebe2cf07105e8add2552c3e0c2a198))
* **go:** add RedeployAppRevision ([d10f7f9](https://github.com/Phala-Network/phala-cloud/commit/d10f7f9261b99b281e84d84bafdf0b70fba0e198)), closes [#303](https://github.com/Phala-Network/phala-cloud/issues/303)
* **go:** add typed CVMStatusEntry to GetCVMStatusBatch ([f83e0ec](https://github.com/Phala-Network/phala-cloud/commit/f83e0ec5677032e4ee2e715e037db56752b5f20c))
* **go:** add UpdateCVMListed for in-place marketplace visibility ([132f434](https://github.com/Phala-Network/phala-cloud/commit/132f434b0ecdadc83d16f3c3d81efa918c5a3e87))
* **go:** support app instance names ([ee0fe0b](https://github.com/Phala-Network/phala-cloud/commit/ee0fe0b946fef915648cc47ddfdc9b15bd10fefa))
* **go:** type app attestation response ([3dff5e8](https://github.com/Phala-Network/phala-cloud/commit/3dff5e816099db53121d379ccc7846b19678d68e))
* **sdk/cli:** surface KMS contract verification anchors in on-chain detail ([35a48a3](https://github.com/Phala-Network/phala-cloud/commit/35a48a3a81a4d762cb3a7b49bdcddfb196fd6db1))
* **sdk:** add hourly_rate, billing_interval, gpu_rental_order to CVM v20260121 ([0f665eb](https://github.com/Phala-Network/phala-cloud/commit/0f665ebaa68158804a835488be4dd76cf1708895))
* **sdk:** contract-centric KMS API, default to version 2026-06-23 ([0fb89e2](https://github.com/Phala-Network/phala-cloud/commit/0fb89e23c2c7a62bca6ef7f32649d06c9eabf2e4))
* version CVM create resource hashid schemas ([f34d2c7](https://github.com/Phala-Network/phala-cloud/commit/f34d2c7e69d4b4a939477d28278acd3e6545c4d2))

### fix

* align CVMInfo schemas with hashid responses ([49ba6fd](https://github.com/Phala-Network/phala-cloud/commit/49ba6fd53d6ee73ed4d429ea5957d6e4c6f5e71b))
* **ci:** scope changelog generation to each package's subdirectory ([e2364a8](https://github.com/Phala-Network/phala-cloud/commit/e2364a87872665e5cbc9f62ba0e5ffb15dc04e9b))
* **cli:** surface request details in API errors ([c53a329](https://github.com/Phala-Network/phala-cloud/commit/c53a329b4cfa3027e05d27c7e3ed5bb8e0fbbfbb))
* **sdk:** expose k256_pubkey on Go and Python CVM KMS info ([b9721b6](https://github.com/Phala-Network/phala-cloud/commit/b9721b6702c93da00370e99b66aa46463a108e53))
* use hashed CVM IDs in schemas ([0268fa0](https://github.com/Phala-Network/phala-cloud/commit/0268fa0bf24d2d7449e2e338e42a484973bd46f2))

### refactor

* migrate resize endpoint across all SDKs ([56638f1](https://github.com/Phala-Network/phala-cloud/commit/56638f1c1592a1a48dab7fedf9152b60c8e52a01))
# Changelog

