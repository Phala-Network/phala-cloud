## [](https://github.com/Phala-Network/phala-cloud/compare/python-v0.1.3...python-v) (2026-07-26)

### ⚠ BREAKING CHANGE

* **sdk:** reject deprecated user_id/teepod_id/node_id CVM list filters

### feat

* add algorithm_version to DeviceIdEntry ([701ac00](https://github.com/Phala-Network/phala-cloud/commit/701ac0017acc5fb7851e285e27cc1e9ba7af05cd))
* add device_ids matrix to node schemas ([de36a3a](https://github.com/Phala-Network/phala-cloud/commit/de36a3af84b1f16abdadeada607d00843817e244))
* add kms_contract_id to CVM SDK schemas, deprecate kms_id ([16734b9](https://github.com/Phala-Network/phala-cloud/commit/16734b9d22c2e6584c3c320b64d2bd48cdcb5a2b))
* **go,python:** add mr_config_id computation ([d558b09](https://github.com/Phala-Network/phala-cloud/commit/d558b09cb114300c861ac99d76915779e3363993))
* **python:** add typed CvmStatus response to get_cvm_status_batch ([01ee3fd](https://github.com/Phala-Network/phala-cloud/commit/01ee3fd2e460700f518278f41cb2ea6b701a61c5))
* **python:** type app attestation response ([058197b](https://github.com/Phala-Network/phala-cloud/commit/058197ba6940c3fcc0de2d857b4fef3ff562cedc))
* **sdk/cli:** surface KMS contract verification anchors in on-chain detail ([35a48a3](https://github.com/Phala-Network/phala-cloud/commit/35a48a3a81a4d762cb3a7b49bdcddfb196fd6db1))
* **sdk:** add hourly_rate, billing_interval, gpu_rental_order to CVM v20260121 ([0f665eb](https://github.com/Phala-Network/phala-cloud/commit/0f665ebaa68158804a835488be4dd76cf1708895))
* **sdk:** contract-centric KMS API, default to version 2026-06-23 ([0fb89e2](https://github.com/Phala-Network/phala-cloud/commit/0fb89e23c2c7a62bca6ef7f32649d06c9eabf2e4))

### fix

* **ci:** scope changelog generation to each package's subdirectory ([e2364a8](https://github.com/Phala-Network/phala-cloud/commit/e2364a87872665e5cbc9f62ba0e5ffb15dc04e9b))
* **cli:** surface request details in API errors ([c53a329](https://github.com/Phala-Network/phala-cloud/commit/c53a329b4cfa3027e05d27c7e3ed5bb8e0fbbfbb))
* **js:** add version-based schema selection for versioned action responses ([d96f402](https://github.com/Phala-Network/phala-cloud/commit/d96f402353cbbd6557c14908c6d2ba795dab28b7))
* **python:** lock pysha3 dependency ([e13cc57](https://github.com/Phala-Network/phala-cloud/commit/e13cc57a71699001b0f423361795c0b5084fd00b))
* **python:** resolve ruff E402 and E501 lint errors ([2b493ce](https://github.com/Phala-Network/phala-cloud/commit/2b493ce2332faeeb9777d57528bf4239ec7d6a8a))
* **sdk:** expose k256_pubkey on Go and Python CVM KMS info ([b9721b6](https://github.com/Phala-Network/phala-cloud/commit/b9721b6702c93da00370e99b66aa46463a108e53))
* **sdk:** reject deprecated user_id/teepod_id/node_id CVM list filters ([399cea5](https://github.com/Phala-Network/phala-cloud/commit/399cea5a56054f7566b36ba6f950e4e8eb4bfeef))

### refactor

* migrate resize endpoint across all SDKs ([56638f1](https://github.com/Phala-Network/phala-cloud/commit/56638f1c1592a1a48dab7fedf9152b60c8e52a01))
# Changelog

