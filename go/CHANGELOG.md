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

