## [0.4.4](https://github.com/Phala-Network/phala-cloud/compare/python-v0.4.3...python-v0.4.4) (2026-11-11)

### fix

* **sdk:** align log error handling and container resolution across SDKs ([1d66cde](https://github.com/Phala-Network/phala-cloud/commit/1d66cde27ce0ad52d40a689c3b401873d80e5307))
* **sdk:** saturate JS backoff and clarify follow return types ([5731406](https://github.com/Phala-Network/phala-cloud/commit/57314061a5edd7ec3207bf08a30ebd8f83f1cb4e))
* **sdks:** close remaining log helper gaps from review ([c62ece4](https://github.com/Phala-Network/phala-cloud/commit/c62ece4ec338f73e9d44e08a6829bd589d001187))
* **sdks:** make log helpers behave the same in JS, Python, Go and the CLI ([873ff86](https://github.com/Phala-Network/phala-cloud/commit/873ff86de3f59b3af38a9014f4c93c22702c1aa6))
## [0.4.3](https://github.com/Phala-Network/phala-cloud/compare/python-v0.4.2...python-v0.4.3) (2026-11-10)

### fix

* **sdks:** align follow behavior verified against live log endpoints ([200cda6](https://github.com/Phala-Network/phala-cloud/commit/200cda6248e947e6bf125928feffdd391195fb80))
## [0.4.2](https://github.com/Phala-Network/phala-cloud/compare/python-v0.4.1...python-v0.4.2) (2026-11-10)

### fix

* **sdks:** handle guest errors in text streams and stop empty follow loops ([6e3cdeb](https://github.com/Phala-Network/phala-cloud/commit/6e3cdeb38c1fe01bd85727ba40e2be76711c7035))
* **sdks:** surface guest log errors instead of an NDJSON parse error ([28b49e4](https://github.com/Phala-Network/phala-cloud/commit/28b49e46184f9656f80beb3e9f764675aeb43e18))
## [0.4.1](https://github.com/Phala-Network/phala-cloud/compare/python-v0.4.0...python-v0.4.1) (2026-11-10)

### fix

* **sdks:** align log helper options and errors across SDKs ([a70487a](https://github.com/Phala-Network/phala-cloud/commit/a70487aae559bd5cb49b6906fb87f01936b8387c))
## [0.4.0](https://github.com/Phala-Network/phala-cloud/compare/python-v0.2.0...python-v0.4.0) (2026-11-10)

### ⚠ BREAKING CHANGE

* **python:** Python: update_cvm_visibility returns {message, correlation_id, status} instead of the CVM record.
* **python:** SDK requests reject cross-origin URLs. With cookie auth off, combined API-key and Authorization headers are rejected. When SDK API-key or bearer authentication is selected, HTTPX client or request auth and credentials in the request or HTTPX base URL are also rejected. Cookie mode retains caller-supplied authentication.
* **python:** encrypt_env_vars now returns a string synchronously; use async_encrypt_env_vars for awaited calls. The nonfunctional add_compose_hash and deploy_app_auth wrappers and their safe and functional forms are removed. Watch retry exhaustion raises RequestError instead of TimeoutError, and watch HTTP errors use SDK ApiError subclasses instead of httpx.HTTPStatusError. A raw state followed by EOF is no longer returned as success; only a complete event succeeds. Timeout events, incomplete streams, and transient network failures reconnect within max_retries, while HTTP failures and certificate validation errors are terminal. Cross-origin requests and conflicting authentication are rejected.
* **sdk:** DeviceIdEntry.os_image_ids (python) and
DeviceIDEntry.OSImageIDs (go) are removed. No caller in this repo referenced
either; consumers reading them were reading an empty list.

### docs

* **python:** clarify authentication migration limits ([9bfe358](https://github.com/Phala-Network/phala-cloud/commit/9bfe3586c498d38caf65904b19d8e09474f52077))
* **python:** clarify credential precedence ([fd0174d](https://github.com/Phala-Network/phala-cloud/commit/fd0174d59fc125204c6fc5e4d90dc8fee4ea39cb))
* **python:** describe the compose patch, launch token and compose-hash OS version ([0bee5cb](https://github.com/Phala-Network/phala-cloud/commit/0bee5cb31bd87e9d53ce6f72e5b6e1497223cf3d))
* **python:** document parity migration ([c828281](https://github.com/Phala-Network/phala-cloud/commit/c828281f8a39c309e2461ae633badd743e292bf8))
* **python:** note the compose-hash normalization change in the upgrade notes ([8da9947](https://github.com/Phala-Network/phala-cloud/commit/8da9947b6b31bb18484252ed7b82b62605692f9d))
* **python:** record CVM update contract changes in the upgrade notes ([151a57c](https://github.com/Phala-Network/phala-cloud/commit/151a57c9a8f6f5e43c95933ad9aff681d6107ad1))
* **sdk:** describe presigned CVM log URL fields ([c37ccce](https://github.com/Phala-Network/phala-cloud/commit/c37ccce205a7f6c1839a8e67e18c35745b6884bc))
* **sdk:** describe the credits fields of the current user ([cbb3501](https://github.com/Phala-Network/phala-cloud/commit/cbb35011c1018fa7856c3f6af0994dc407a31a81))
* **sdk:** say what a suspended workspace means for its CVMs ([5694677](https://github.com/Phala-Network/phala-cloud/commit/56946773738a50828f29110dbbba880e2072ff08))

### feat

* **python:** accept bash_script in the PATCH compose model ([f5c46f4](https://github.com/Phala-Network/phala-cloud/commit/f5c46f4c37a2d290d72235d9b94661623ebe1174))
* **python:** add CVM annotations, app launch token and init-scripts actions ([55fc51f](https://github.com/Phala-Network/phala-cloud/commit/55fc51f00b53228fe25f0161fb6f0572ef49ca2c))
* **python:** commit prepared CVM updates ([8dc78f7](https://github.com/Phala-Network/phala-cloud/commit/8dc78f7ca83c47937eaeaec08050de832083a0eb))
* **python:** manage CVM authorized SSH keys ([226d9cb](https://github.com/Phala-Network/phala-cloud/commit/226d9cb76b3fee131cf18656fd878315c82a2648))
* **python:** revoke the current API token ([897d410](https://github.com/Phala-Network/phala-cloud/commit/897d410899f32b60f71f25d59e06d0e3231efaa3))
* **python:** same-path two-phase CVM create on POST /cvms ([4d83996](https://github.com/Phala-Network/phala-cloud/commit/4d83996bcd79fb6f7aa4b92ebeebe5a0dadddcef))
* **python:** send the compose merge patch, init_scripts and confirm_data_wipe from patch_cvm ([377dddd](https://github.com/Phala-Network/phala-cloud/commit/377dddd2a785dd777050d7bc16bb123485765ed5))
* **python:** support OIDC and workspace configuration ([71ef5bb](https://github.com/Phala-Network/phala-cloud/commit/71ef5bb8cd1bc5c0e7d2c76de387ad96261200a7))
* **python:** type available OS images response with requires_gpu ([10240a9](https://github.com/Phala-Network/phala-cloud/commit/10240a9f6daea72e4befe30bd93f929ccaa7fe94))
* **python:** type the create fields for init scripts, launch token, annotations, raw compose ([00e6689](https://github.com/Phala-Network/phala-cloud/commit/00e66899048bcf993ca75067d93388d1613a4514))
* **sdk:** add disk usage fields to CVM resource usage ([7274d17](https://github.com/Phala-Network/phala-cloud/commit/7274d17d22f062e660cc0a669eecd614969deb5b))
* **sdk:** add managed_env to CVM detail schemas ([17ff65c](https://github.com/Phala-Network/phala-cloud/commit/17ff65c6d4faba2958ef5f211e79fb1d24cea014))
* **sdk:** add max_placeable_count to ProductGpuAvailability (R2-1) ([78d9c7d](https://github.com/Phala-Network/phala-cloud/commit/78d9c7d048bbddcff5ee27b0f4caf66b5a2c145c))
* **sdk:** add mr_config_id V3 helpers across JS, Python and Go ([e7d2f3a](https://github.com/Phala-Network/phala-cloud/commit/e7d2f3adc479b6a377d3b4efa405574fc00b58e2))
* **sdk:** add pre-launch script upgrade actions ([992e13d](https://github.com/Phala-Network/phala-cloud/commit/992e13d27dad1d1fff2f5f411f5f915b1a47d73b))
* **sdk:** align the default request timeout at 60s ([db83998](https://github.com/Phala-Network/phala-cloud/commit/db8399813df52803c0c36b2d00a204d58436cc37))
* **sdk:** carry GPU product requirement and product-scoped availability ([100dd56](https://github.com/Phala-Network/phala-cloud/commit/100dd5617ac70ba22f91e375752896e40946cac5))
* **sdk:** declare the full workspace response schema ([12e5e40](https://github.com/Phala-Network/phala-cloud/commit/12e5e4059a7084dfb19e3c0a103ea04fe1fec60a))
* **sdk:** expose compose_unchanged on compose file update provisioning ([234dd77](https://github.com/Phala-Network/phala-cloud/commit/234dd773c62a3a06932a90c98d6d9aa4ad4ff682))
* **sdk:** expose unified OS image hardware support ([8e61cc8](https://github.com/Phala-Network/phala-cloud/commit/8e61cc8938c4eddef15f8abd052d838f3a026779))
* **sdks:** add CVM log fetch and follow helpers ([1a1f8a9](https://github.com/Phala-Network/phala-cloud/commit/1a1f8a99b61cc5911deb9512e40d8225f43b5052))
* **sdks:** expose GPU rental renewal state ([b0f474b](https://github.com/Phala-Network/phala-cloud/commit/b0f474b3a742ee19d2d90188a9275385303a5d19))
* **sdks:** send a unified User-Agent from every SDK ([900700d](https://github.com/Phala-Network/phala-cloud/commit/900700da97788f474fbd2a6e820a8d6e29742aa4))
* **sdk:** support replica OS image selection ([277bb2b](https://github.com/Phala-Network/phala-cloud/commit/277bb2ba649a2615fc0a0b1ae9de00cbaabe6bf8))
* select creation nodes by physical name ([51be05b](https://github.com/Phala-Network/phala-cloud/commit/51be05b12d18cb3205ea5801d17f530f3f9f2df9))
* use node names for replicas and allowance checks ([a8009eb](https://github.com/Phala-Network/phala-cloud/commit/a8009ebafbc1c75ac57ce9bf972fb637d00432e6))

### fix

* prevent API key leaks across SDK redirects ([e3dbb83](https://github.com/Phala-Network/phala-cloud/commit/e3dbb834a7cc85ba031894df663e660b9ec0d815))
* **python:** accept snake case watch retry options ([8f61974](https://github.com/Phala-Network/phala-cloud/commit/8f61974c69c465969c77807a1ef6afcc701e6757))
* **python:** align patch_cvm with the PATCH /cvms/{id} request ([59f0183](https://github.com/Phala-Network/phala-cloud/commit/59f018372c8070c8a863d2553ec1ef0fb18d6336))
* **python:** continue watching after transient SSE errors ([3f2763e](https://github.com/Phala-Network/phala-cloud/commit/3f2763e433f5eb9d910b3e23ab486a232ef23b0c))
* **python:** drop credential conflict guards ([33c1876](https://github.com/Phala-Network/phala-cloud/commit/33c187655d9d01fea2cf124830406e42446b1541))
* **python:** hash app-compose like the backend dump_dict ([74b92f4](https://github.com/Phala-Network/phala-cloud/commit/74b92f47771e095ce8207c22e8f11d18fb7c6f39))
* **python:** hash app-compose with the backend's normalization ([434c9fd](https://github.com/Phala-Network/phala-cloud/commit/434c9fd845aef60641bcd0f0f488d17e35a0be4f))
* **python:** keep a boolean compose event_log_version from passing as 1 ([fb6c509](https://github.com/Phala-Network/phala-cloud/commit/fb6c509864ca2f80783d904c22be7f5cb097ba12))
* **python:** make watch errors and retries predictable ([0e09be4](https://github.com/Phala-Network/phala-cloud/commit/0e09be4154509579b3c81f6e028330a2ca9bbc21))
* **python:** move update_cvm_visibility to the unified PATCH endpoint ([3ae54d4](https://github.com/Phala-Network/phala-cloud/commit/3ae54d494791132ad29694e72594788130695440))
* **python:** preserve client behavior across versions ([08a83f3](https://github.com/Phala-Network/phala-cloud/commit/08a83f3bbf240311ffe97c5614e4a48baf8806ff))
* **python:** prevent cross-origin and conflicting credentials ([7586807](https://github.com/Phala-Network/phala-cloud/commit/758680716735e526e7b77065383fc5cbd4fd255a))
* **python:** provide sync and async env encryption ([6994171](https://github.com/Phala-Network/phala-cloud/commit/69941718535181bb794f9428ed581225e87f2885))
* **python:** reject conflicting HTTPX authentication ([cc1c094](https://github.com/Phala-Network/phala-cloud/commit/cc1c0941ae2c397eed3e574c0f2c5236027afca8))
* **python:** reject credentials in injected base URLs ([12f7456](https://github.com/Phala-Network/phala-cloud/commit/12f74560fe37ddbf67acd7f3187b468981ee14f8))
* **python:** remove unsupported blockchain wrappers ([dec3601](https://github.com/Phala-Network/phala-cloud/commit/dec3601df1d2469e47d77f057b1ece74d3c88436))
* **python:** replace obsolete Keccak dependency ([c425283](https://github.com/Phala-Network/phala-cloud/commit/c425283c2953796c3bc595ea14fcba0324ad12df))
* **python:** require certifi 2026.10.19 to drop emSign roots ([06c25c6](https://github.com/Phala-Network/phala-cloud/commit/06c25c6c3768f73f677985c2f8c26cc2c9e03aee))
* **python:** require complete event to finish watch ([0ac3c2b](https://github.com/Phala-Network/phala-cloud/commit/0ac3c2bbed52902b0bc1fa0abf17a902a4c2edbe))
* **python:** require the target status on watch complete events ([f8c2a94](https://github.com/Phala-Network/phala-cloud/commit/f8c2a94caf793ea587760eacadefaea8bd0e7677))
* **python:** retry interrupted watch streams safely ([edeb1fc](https://github.com/Phala-Network/phala-cloud/commit/edeb1fcbfffd9f790205fafca579751919f1ebaf))
* **python:** return empty app_id when the 465 payload has none ([283a362](https://github.com/Phala-Network/phala-cloud/commit/283a3621f22d8c560578d9bca1dba5871e6f3002))
* **python:** stop sending allow_restart from update_cvm_resources ([d983378](https://github.com/Phala-Network/phala-cloud/commit/d983378126f6ef9a76d3ba750fcc793e4f6c9547))
* **python:** unwrap successful empty results ([767c455](https://github.com/Phala-Network/phala-cloud/commit/767c4556202ca72265b9679b0ea4619545cd86da))
* **sdk:** finish the unified PATCH migration in the async Python client ([2a71dd6](https://github.com/Phala-Network/phala-cloud/commit/2a71dd67a1b604125ff840965ac0a7bc4e2352b9))
* **sdk:** stop pinning the pubkey request to the node-keyed API ([c29470b](https://github.com/Phala-Network/phala-cloud/commit/c29470b2f7ae46754351f2177a4a5fb6daac5a81))

### refactor

* **python:** parse 465 hash-registration details in one place ([3476723](https://github.com/Phala-Network/phala-cloud/commit/347672382bce1d1cacb46ecfc44610e27aaf53cb))
* **sdk:** drop os_image_ids from DeviceIdEntry ([fb69cec](https://github.com/Phala-Network/phala-cloud/commit/fb69cec58a9cda10ad1b4bbd24bc39134a27aafc))
## [0.3.0](https://github.com/Phala-Network/phala-cloud/compare/python-v0.2.0...python-v0.3.0) (2026-11-07)

### ⚠ BREAKING CHANGE

* **python:** Python: update_cvm_visibility returns {message, correlation_id, status} instead of the CVM record.
* **python:** SDK requests reject cross-origin URLs. With cookie auth off, combined API-key and Authorization headers are rejected. When SDK API-key or bearer authentication is selected, HTTPX client or request auth and credentials in the request or HTTPX base URL are also rejected. Cookie mode retains caller-supplied authentication.
* **python:** encrypt_env_vars now returns a string synchronously; use async_encrypt_env_vars for awaited calls. The nonfunctional add_compose_hash and deploy_app_auth wrappers and their safe and functional forms are removed. Watch retry exhaustion raises RequestError instead of TimeoutError, and watch HTTP errors use SDK ApiError subclasses instead of httpx.HTTPStatusError. A raw state followed by EOF is no longer returned as success; only a complete event succeeds. Timeout events, incomplete streams, and transient network failures reconnect within max_retries, while HTTP failures and certificate validation errors are terminal. Cross-origin requests and conflicting authentication are rejected.
* **sdk:** DeviceIdEntry.os_image_ids (python) and
DeviceIDEntry.OSImageIDs (go) are removed. No caller in this repo referenced
either; consumers reading them were reading an empty list.

### docs

* **python:** clarify authentication migration limits ([9bfe358](https://github.com/Phala-Network/phala-cloud/commit/9bfe3586c498d38caf65904b19d8e09474f52077))
* **python:** clarify credential precedence ([fd0174d](https://github.com/Phala-Network/phala-cloud/commit/fd0174d59fc125204c6fc5e4d90dc8fee4ea39cb))
* **python:** describe the compose patch, launch token and compose-hash OS version ([0bee5cb](https://github.com/Phala-Network/phala-cloud/commit/0bee5cb31bd87e9d53ce6f72e5b6e1497223cf3d))
* **python:** document parity migration ([c828281](https://github.com/Phala-Network/phala-cloud/commit/c828281f8a39c309e2461ae633badd743e292bf8))
* **python:** note the compose-hash normalization change in the upgrade notes ([8da9947](https://github.com/Phala-Network/phala-cloud/commit/8da9947b6b31bb18484252ed7b82b62605692f9d))
* **python:** record CVM update contract changes in the upgrade notes ([151a57c](https://github.com/Phala-Network/phala-cloud/commit/151a57c9a8f6f5e43c95933ad9aff681d6107ad1))
* **sdk:** describe the credits fields of the current user ([cbb3501](https://github.com/Phala-Network/phala-cloud/commit/cbb35011c1018fa7856c3f6af0994dc407a31a81))
* **sdk:** say what a suspended workspace means for its CVMs ([5694677](https://github.com/Phala-Network/phala-cloud/commit/56946773738a50828f29110dbbba880e2072ff08))

### feat

* **python:** accept bash_script in the PATCH compose model ([f5c46f4](https://github.com/Phala-Network/phala-cloud/commit/f5c46f4c37a2d290d72235d9b94661623ebe1174))
* **python:** add CVM annotations, app launch token and init-scripts actions ([55fc51f](https://github.com/Phala-Network/phala-cloud/commit/55fc51f00b53228fe25f0161fb6f0572ef49ca2c))
* **python:** commit prepared CVM updates ([8dc78f7](https://github.com/Phala-Network/phala-cloud/commit/8dc78f7ca83c47937eaeaec08050de832083a0eb))
* **python:** manage CVM authorized SSH keys ([226d9cb](https://github.com/Phala-Network/phala-cloud/commit/226d9cb76b3fee131cf18656fd878315c82a2648))
* **python:** revoke the current API token ([897d410](https://github.com/Phala-Network/phala-cloud/commit/897d410899f32b60f71f25d59e06d0e3231efaa3))
* **python:** same-path two-phase CVM create on POST /cvms ([4d83996](https://github.com/Phala-Network/phala-cloud/commit/4d83996bcd79fb6f7aa4b92ebeebe5a0dadddcef))
* **python:** send the compose merge patch, init_scripts and confirm_data_wipe from patch_cvm ([377dddd](https://github.com/Phala-Network/phala-cloud/commit/377dddd2a785dd777050d7bc16bb123485765ed5))
* **python:** support OIDC and workspace configuration ([71ef5bb](https://github.com/Phala-Network/phala-cloud/commit/71ef5bb8cd1bc5c0e7d2c76de387ad96261200a7))
* **python:** type available OS images response with requires_gpu ([10240a9](https://github.com/Phala-Network/phala-cloud/commit/10240a9f6daea72e4befe30bd93f929ccaa7fe94))
* **python:** type the create fields for init scripts, launch token, annotations, raw compose ([00e6689](https://github.com/Phala-Network/phala-cloud/commit/00e66899048bcf993ca75067d93388d1613a4514))
* **sdk:** add disk usage fields to CVM resource usage ([7274d17](https://github.com/Phala-Network/phala-cloud/commit/7274d17d22f062e660cc0a669eecd614969deb5b))
* **sdk:** add managed_env to CVM detail schemas ([17ff65c](https://github.com/Phala-Network/phala-cloud/commit/17ff65c6d4faba2958ef5f211e79fb1d24cea014))
* **sdk:** add max_placeable_count to ProductGpuAvailability (R2-1) ([78d9c7d](https://github.com/Phala-Network/phala-cloud/commit/78d9c7d048bbddcff5ee27b0f4caf66b5a2c145c))
* **sdk:** add mr_config_id V3 helpers across JS, Python and Go ([e7d2f3a](https://github.com/Phala-Network/phala-cloud/commit/e7d2f3adc479b6a377d3b4efa405574fc00b58e2))
* **sdk:** add pre-launch script upgrade actions ([992e13d](https://github.com/Phala-Network/phala-cloud/commit/992e13d27dad1d1fff2f5f411f5f915b1a47d73b))
* **sdk:** align the default request timeout at 60s ([db83998](https://github.com/Phala-Network/phala-cloud/commit/db8399813df52803c0c36b2d00a204d58436cc37))
* **sdk:** carry GPU product requirement and product-scoped availability ([100dd56](https://github.com/Phala-Network/phala-cloud/commit/100dd5617ac70ba22f91e375752896e40946cac5))
* **sdk:** declare the full workspace response schema ([12e5e40](https://github.com/Phala-Network/phala-cloud/commit/12e5e4059a7084dfb19e3c0a103ea04fe1fec60a))
* **sdk:** expose compose_unchanged on compose file update provisioning ([234dd77](https://github.com/Phala-Network/phala-cloud/commit/234dd773c62a3a06932a90c98d6d9aa4ad4ff682))
* **sdk:** expose unified OS image hardware support ([8e61cc8](https://github.com/Phala-Network/phala-cloud/commit/8e61cc8938c4eddef15f8abd052d838f3a026779))
* **sdks:** expose GPU rental renewal state ([b0f474b](https://github.com/Phala-Network/phala-cloud/commit/b0f474b3a742ee19d2d90188a9275385303a5d19))
* **sdk:** support replica OS image selection ([277bb2b](https://github.com/Phala-Network/phala-cloud/commit/277bb2ba649a2615fc0a0b1ae9de00cbaabe6bf8))
* select creation nodes by physical name ([51be05b](https://github.com/Phala-Network/phala-cloud/commit/51be05b12d18cb3205ea5801d17f530f3f9f2df9))
* use node names for replicas and allowance checks ([a8009eb](https://github.com/Phala-Network/phala-cloud/commit/a8009ebafbc1c75ac57ce9bf972fb637d00432e6))

### fix

* prevent API key leaks across SDK redirects ([e3dbb83](https://github.com/Phala-Network/phala-cloud/commit/e3dbb834a7cc85ba031894df663e660b9ec0d815))
* **python:** accept snake case watch retry options ([8f61974](https://github.com/Phala-Network/phala-cloud/commit/8f61974c69c465969c77807a1ef6afcc701e6757))
* **python:** align patch_cvm with the PATCH /cvms/{id} request ([59f0183](https://github.com/Phala-Network/phala-cloud/commit/59f018372c8070c8a863d2553ec1ef0fb18d6336))
* **python:** continue watching after transient SSE errors ([3f2763e](https://github.com/Phala-Network/phala-cloud/commit/3f2763e433f5eb9d910b3e23ab486a232ef23b0c))
* **python:** drop credential conflict guards ([33c1876](https://github.com/Phala-Network/phala-cloud/commit/33c187655d9d01fea2cf124830406e42446b1541))
* **python:** hash app-compose like the backend dump_dict ([74b92f4](https://github.com/Phala-Network/phala-cloud/commit/74b92f47771e095ce8207c22e8f11d18fb7c6f39))
* **python:** hash app-compose with the backend's normalization ([434c9fd](https://github.com/Phala-Network/phala-cloud/commit/434c9fd845aef60641bcd0f0f488d17e35a0be4f))
* **python:** keep a boolean compose event_log_version from passing as 1 ([fb6c509](https://github.com/Phala-Network/phala-cloud/commit/fb6c509864ca2f80783d904c22be7f5cb097ba12))
* **python:** make watch errors and retries predictable ([0e09be4](https://github.com/Phala-Network/phala-cloud/commit/0e09be4154509579b3c81f6e028330a2ca9bbc21))
* **python:** move update_cvm_visibility to the unified PATCH endpoint ([3ae54d4](https://github.com/Phala-Network/phala-cloud/commit/3ae54d494791132ad29694e72594788130695440))
* **python:** preserve client behavior across versions ([08a83f3](https://github.com/Phala-Network/phala-cloud/commit/08a83f3bbf240311ffe97c5614e4a48baf8806ff))
* **python:** prevent cross-origin and conflicting credentials ([7586807](https://github.com/Phala-Network/phala-cloud/commit/758680716735e526e7b77065383fc5cbd4fd255a))
* **python:** provide sync and async env encryption ([6994171](https://github.com/Phala-Network/phala-cloud/commit/69941718535181bb794f9428ed581225e87f2885))
* **python:** reject conflicting HTTPX authentication ([cc1c094](https://github.com/Phala-Network/phala-cloud/commit/cc1c0941ae2c397eed3e574c0f2c5236027afca8))
* **python:** reject credentials in injected base URLs ([12f7456](https://github.com/Phala-Network/phala-cloud/commit/12f74560fe37ddbf67acd7f3187b468981ee14f8))
* **python:** remove unsupported blockchain wrappers ([dec3601](https://github.com/Phala-Network/phala-cloud/commit/dec3601df1d2469e47d77f057b1ece74d3c88436))
* **python:** replace obsolete Keccak dependency ([c425283](https://github.com/Phala-Network/phala-cloud/commit/c425283c2953796c3bc595ea14fcba0324ad12df))
* **python:** require certifi 2026.10.19 to drop emSign roots ([06c25c6](https://github.com/Phala-Network/phala-cloud/commit/06c25c6c3768f73f677985c2f8c26cc2c9e03aee))
* **python:** require complete event to finish watch ([0ac3c2b](https://github.com/Phala-Network/phala-cloud/commit/0ac3c2bbed52902b0bc1fa0abf17a902a4c2edbe))
* **python:** require the target status on watch complete events ([f8c2a94](https://github.com/Phala-Network/phala-cloud/commit/f8c2a94caf793ea587760eacadefaea8bd0e7677))
* **python:** retry interrupted watch streams safely ([edeb1fc](https://github.com/Phala-Network/phala-cloud/commit/edeb1fcbfffd9f790205fafca579751919f1ebaf))
* **python:** return empty app_id when the 465 payload has none ([283a362](https://github.com/Phala-Network/phala-cloud/commit/283a3621f22d8c560578d9bca1dba5871e6f3002))
* **python:** stop sending allow_restart from update_cvm_resources ([d983378](https://github.com/Phala-Network/phala-cloud/commit/d983378126f6ef9a76d3ba750fcc793e4f6c9547))
* **python:** unwrap successful empty results ([767c455](https://github.com/Phala-Network/phala-cloud/commit/767c4556202ca72265b9679b0ea4619545cd86da))
* **sdk:** finish the unified PATCH migration in the async Python client ([2a71dd6](https://github.com/Phala-Network/phala-cloud/commit/2a71dd67a1b604125ff840965ac0a7bc4e2352b9))
* **sdk:** stop pinning the pubkey request to the node-keyed API ([c29470b](https://github.com/Phala-Network/phala-cloud/commit/c29470b2f7ae46754351f2177a4a5fb6daac5a81))

### refactor

* **python:** parse 465 hash-registration details in one place ([3476723](https://github.com/Phala-Network/phala-cloud/commit/347672382bce1d1cacb46ecfc44610e27aaf53cb))
* **sdk:** drop os_image_ids from DeviceIdEntry ([fb69cec](https://github.com/Phala-Network/phala-cloud/commit/fb69cec58a9cda10ad1b4bbd24bc39134a27aafc))
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

