# 1.1.0-beta.4 (2025-11-11)


### Bug Fixes

* CLI error handling to expose full HTTP details ([e74eb37](https://github.com/Phala-Network/phala-cloud-cli/commit/e74eb377a276ae0cbb0c4521b893f92330861cce))
* **cli:** adapt error-handling to new SDK error types ([0ab651b](https://github.com/Phala-Network/phala-cloud-cli/commit/0ab651b78677632d815eeaf7a5e4e2ffeb0892cb))
* **cli:** improve non-interactive mode and JSON output ([9e9e2e2](https://github.com/Phala-Network/phala-cloud-cli/commit/9e9e2e236e00995ba23c4f3e30f2211ba9388b28))
* **cli:** mark 6 fields as nullable in CVM schemas ([80f5230](https://github.com/Phala-Network/phala-cloud-cli/commit/80f523056e967e099a438f5a9a013435e0675b44))
* **cli:** schema validation and automation improvements ([83924e1](https://github.com/Phala-Network/phala-cloud-cli/commit/83924e1c180e4ee72f285c5dcf79f8c36962e69e))
* compatible to latest sdk ([cf418e4](https://github.com/Phala-Network/phala-cloud-cli/commit/cf418e449b3bc6417abc50455ddd448f11360069))
* kms list item types ([31bef68](https://github.com/Phala-Network/phala-cloud-cli/commit/31bef689027e99fab0eca83516cd4a1385d30a61))
* skip start/stop/restart response schema ([5bbc953](https://github.com/Phala-Network/phala-cloud-cli/commit/5bbc9532ae1ac19ee8ce027892ff9dc79d03806e))
* the built artifact should bundled @phala/cloud as well ([c47324e](https://github.com/Phala-Network/phala-cloud-cli/commit/c47324e55d51c5f0ba372cebdb5b9255a24ab8b3))
* the envs not update with deploy command ([1d23a32](https://github.com/Phala-Network/phala-cloud-cli/commit/1d23a32f11e8fb1e8baf71171dc1dfd597ab4da5))
* typing. ([3da96ab](https://github.com/Phala-Network/phala-cloud-cli/commit/3da96ab02195d6bb2b436491a81aee9449f77c75))


### Features

* add CLI completion support ([37dc21b](https://github.com/Phala-Network/phala-cloud-cli/commit/37dc21b14bb7377bbdefd35c9663bf0a74bda4ab))
* added phala.toml support ([e02c130](https://github.com/Phala-Network/phala-cloud-cli/commit/e02c1307790066f0de4e2d9913acb8ebb5ab6650))
* **cli:** add --wait flag to deploy command for CVM updates ([bf0f85a](https://github.com/Phala-Network/phala-cloud-cli/commit/bf0f85ae5c519cf11a81345be2aa0c391130c72b))
* **cli:** added command ssh ([76467cd](https://github.com/Phala-Network/phala-cloud-cli/commit/76467cd0344386302092117b2aa2efe3dc10ff7b))
* **cli:** inject project config resolver on cli startup ([09e7cd9](https://github.com/Phala-Network/phala-cloud-cli/commit/09e7cd9cfaf89528c6971b160da6a8fdf4691c01))
* **cli:** open browser & login workflow ([2b56074](https://github.com/Phala-Network/phala-cloud-cli/commit/2b560742b9e6f9e1d3f1da173d3d05e6feac880e))
* **cli:** retry on http 409 ([11091c7](https://github.com/Phala-Network/phala-cloud-cli/commit/11091c7845623de6fba20240764b610b451908aa))
* improve error message & fix linting ([cc177ff](https://github.com/Phala-Network/phala-cloud-cli/commit/cc177ff923a499fee05b9f18fc3199bf2569a66e))
* move auth login to login and added deprecated warning ([dd1c096](https://github.com/Phala-Network/phala-cloud-cli/commit/dd1c096208e2dd81623a8c6e730bef4a9a780770))
* no spinner for json mode ([9daf848](https://github.com/Phala-Network/phala-cloud-cli/commit/9daf848a1d082d9531b7c0d7d7fd6f2ab0d5ba40))
* refine cvm_id parsing & loading for deploy & ssh command ([bef2a54](https://github.com/Phala-Network/phala-cloud-cli/commit/bef2a54272446c03ed89cbe408cab2ff065580f4))
* show help message as default behavior ([ed60eec](https://github.com/Phala-Network/phala-cloud-cli/commit/ed60eecc66056868debb23f51937c71014020c0a))



# 1.1.0-beta.3 (2025-11-11)


### Bug Fixes

* CLI error handling to expose full HTTP details ([e74eb37](https://github.com/Phala-Network/phala-cloud-cli/commit/e74eb377a276ae0cbb0c4521b893f92330861cce))
* **cli:** adapt error-handling to new SDK error types ([0ab651b](https://github.com/Phala-Network/phala-cloud-cli/commit/0ab651b78677632d815eeaf7a5e4e2ffeb0892cb))
* **cli:** improve non-interactive mode and JSON output ([9e9e2e2](https://github.com/Phala-Network/phala-cloud-cli/commit/9e9e2e236e00995ba23c4f3e30f2211ba9388b28))
* **cli:** mark 6 fields as nullable in CVM schemas ([80f5230](https://github.com/Phala-Network/phala-cloud-cli/commit/80f523056e967e099a438f5a9a013435e0675b44))
* **cli:** schema validation and automation improvements ([83924e1](https://github.com/Phala-Network/phala-cloud-cli/commit/83924e1c180e4ee72f285c5dcf79f8c36962e69e))
* compatible to latest sdk ([cf418e4](https://github.com/Phala-Network/phala-cloud-cli/commit/cf418e449b3bc6417abc50455ddd448f11360069))
* kms list item types ([31bef68](https://github.com/Phala-Network/phala-cloud-cli/commit/31bef689027e99fab0eca83516cd4a1385d30a61))
* skip start/stop/restart response schema ([5bbc953](https://github.com/Phala-Network/phala-cloud-cli/commit/5bbc9532ae1ac19ee8ce027892ff9dc79d03806e))
* the built artifact should bundled @phala/cloud as well ([c47324e](https://github.com/Phala-Network/phala-cloud-cli/commit/c47324e55d51c5f0ba372cebdb5b9255a24ab8b3))
* the envs not update with deploy command ([1d23a32](https://github.com/Phala-Network/phala-cloud-cli/commit/1d23a32f11e8fb1e8baf71171dc1dfd597ab4da5))
* typing. ([3da96ab](https://github.com/Phala-Network/phala-cloud-cli/commit/3da96ab02195d6bb2b436491a81aee9449f77c75))


### Features

* add CLI completion support ([37dc21b](https://github.com/Phala-Network/phala-cloud-cli/commit/37dc21b14bb7377bbdefd35c9663bf0a74bda4ab))
* added phala.toml support ([e02c130](https://github.com/Phala-Network/phala-cloud-cli/commit/e02c1307790066f0de4e2d9913acb8ebb5ab6650))
* **cli:** add --wait flag to deploy command for CVM updates ([bf0f85a](https://github.com/Phala-Network/phala-cloud-cli/commit/bf0f85ae5c519cf11a81345be2aa0c391130c72b))
* **cli:** added command ssh ([76467cd](https://github.com/Phala-Network/phala-cloud-cli/commit/76467cd0344386302092117b2aa2efe3dc10ff7b))
* **cli:** inject project config resolver on cli startup ([09e7cd9](https://github.com/Phala-Network/phala-cloud-cli/commit/09e7cd9cfaf89528c6971b160da6a8fdf4691c01))
* **cli:** open browser & login workflow ([2b56074](https://github.com/Phala-Network/phala-cloud-cli/commit/2b560742b9e6f9e1d3f1da173d3d05e6feac880e))
* **cli:** retry on http 409 ([11091c7](https://github.com/Phala-Network/phala-cloud-cli/commit/11091c7845623de6fba20240764b610b451908aa))
* improve error message & fix linting ([cc177ff](https://github.com/Phala-Network/phala-cloud-cli/commit/cc177ff923a499fee05b9f18fc3199bf2569a66e))
* move auth login to login and added deprecated warning ([dd1c096](https://github.com/Phala-Network/phala-cloud-cli/commit/dd1c096208e2dd81623a8c6e730bef4a9a780770))
* no spinner for json mode ([9daf848](https://github.com/Phala-Network/phala-cloud-cli/commit/9daf848a1d082d9531b7c0d7d7fd6f2ab0d5ba40))
* refine cvm_id parsing & loading for deploy & ssh command ([bef2a54](https://github.com/Phala-Network/phala-cloud-cli/commit/bef2a54272446c03ed89cbe408cab2ff065580f4))
* show help message as default behavior ([ed60eec](https://github.com/Phala-Network/phala-cloud-cli/commit/ed60eecc66056868debb23f51937c71014020c0a))



# 1.1.0-beta.2 (2025-10-13)


### Bug Fixes

* kms list item types ([31bef68](https://github.com/Phala-Network/phala-cloud-cli/commit/31bef689027e99fab0eca83516cd4a1385d30a61))
* skip start/stop/restart response schema ([5bbc953](https://github.com/Phala-Network/phala-cloud-cli/commit/5bbc9532ae1ac19ee8ce027892ff9dc79d03806e))
* the built artifact should bundled @phala/cloud as well ([c47324e](https://github.com/Phala-Network/phala-cloud-cli/commit/c47324e55d51c5f0ba372cebdb5b9255a24ab8b3))
* the envs not update with deploy command ([1d23a32](https://github.com/Phala-Network/phala-cloud-cli/commit/1d23a32f11e8fb1e8baf71171dc1dfd597ab4da5))
* typing. ([3da96ab](https://github.com/Phala-Network/phala-cloud-cli/commit/3da96ab02195d6bb2b436491a81aee9449f77c75))


### Features

* add CLI completion support ([37dc21b](https://github.com/Phala-Network/phala-cloud-cli/commit/37dc21b14bb7377bbdefd35c9663bf0a74bda4ab))
* no spinner for json mode ([9daf848](https://github.com/Phala-Network/phala-cloud-cli/commit/9daf848a1d082d9531b7c0d7d7fd6f2ab0d5ba40))
* show help message as default behavior ([ed60eec](https://github.com/Phala-Network/phala-cloud-cli/commit/ed60eecc66056868debb23f51937c71014020c0a))



## 1.0.39 (2025-10-13)


### Bug Fixes

* kms list item types ([31bef68](https://github.com/Phala-Network/phala-cloud-cli/commit/31bef689027e99fab0eca83516cd4a1385d30a61))
* the built artifact should bundled @phala/cloud as well ([c47324e](https://github.com/Phala-Network/phala-cloud-cli/commit/c47324e55d51c5f0ba372cebdb5b9255a24ab8b3))
* the envs not update with deploy command ([1d23a32](https://github.com/Phala-Network/phala-cloud-cli/commit/1d23a32f11e8fb1e8baf71171dc1dfd597ab4da5))
* typing. ([3da96ab](https://github.com/Phala-Network/phala-cloud-cli/commit/3da96ab02195d6bb2b436491a81aee9449f77c75))


### Features

* no spinner for json mode ([9daf848](https://github.com/Phala-Network/phala-cloud-cli/commit/9daf848a1d082d9531b7c0d7d7fd6f2ab0d5ba40))



