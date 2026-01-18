## [1.1.3-beta.2](https://github.com/Phala-Network/phala-cloud/compare/cli-v1.1.2...cli-v1.1.3-beta.2) (2026-01-18)

### feat

* **cli:** add unit tests for prefer_dev payload building ([0910785](https://github.com/Phala-Network/phala-cloud/commit/09107857b41260d859f8033c500f1044ed5511d7))
* **cli:** add update check and self update ([e88f795](https://github.com/Phala-Network/phala-cloud/commit/e88f795ed26451e751577895543eb05d015583e9))

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
