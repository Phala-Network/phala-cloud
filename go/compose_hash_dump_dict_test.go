package phala

import (
	"maps"
	"strings"
	"testing"
)

// backendModelDump is the backend's AppComposeV2.model_dump() of a minimal
// docker-compose app. The expected hashes below come from the backend's
// AppComposeV2.dump_string(os_image_version).
func backendModelDump(fields map[string]any) map[string]any {
	compose := map[string]any{
		"allowed_envs":               []any{},
		"bash_script":                nil,
		"default_gateway_domain":     nil,
		"docker_compose_file":        "services:\n  app:\n    image: nginx:latest\n",
		"init_script":                []any{},
		"key_provider":               nil,
		"key_provider_id":            nil,
		"kms_enabled":                true,
		"local_key_provider_enabled": false,
		"manifest_version":           2,
		"no_instance_id":             false,
		"port_policy":                nil,
		"pre_launch_script":          nil,
		"public_logs":                true,
		"public_sysinfo":             true,
		"public_tcbinfo":             true,
		"runner":                     "docker-compose",
		"requirements":               nil,
		"storage_discard":            nil,
		"event_log_version":          nil,
		"snapshotter":                nil,
		"verity_volumes":             nil,
		"gateway_enabled":            true,
		"features":                   []any{"kms", "tproxy-net"},
		"salt":                       nil,
		"secure_time":                false,
		"storage_fs":                 "zfs",
		"swap_size":                  nil,
		"tproxy_enabled":             true,
	}
	maps.Copy(compose, fields)
	return compose
}

func TestGetComposeHashForOSImageMatchesBackendDumpDict(t *testing.T) {
	withoutTproxy := backendModelDump(map[string]any{"name": "gw", "gateway_enabled": false})
	delete(withoutTproxy, "tproxy_enabled")

	cases := []struct {
		name      string
		osVersion string
		compose   map[string]any
		hash      string
	}{
		{"null_06_fields_dropped", "0.6.0", backendModelDump(map[string]any{"name": "n06"}),
			"9b01dbd4ac096f647c1a709707b7454a30575122259077911ab02a19d24743fa"},
		{"dstack_06_fields_sent", "0.6.0", backendModelDump(map[string]any{
			"name": "n06s", "storage_discard": false, "event_log_version": 2, "verity_volumes": []any{},
		}), "acdd7633bd55ccd8721218b7c7a85be2cde7a92f08543d0367e909b4b5a662bb"},
		{"requirements_explicit_defaults", "0.6.3", backendModelDump(map[string]any{
			"name": "req",
			"requirements": map[string]any{
				"ephemeral_data_disk": false,
				"health_check":        false,
				"launch_token_hash":   strings.Repeat("ab", 32),
			},
		}), "9965034b23da36a324e507e37e591e595e744e632e1483a3d1a6fd10ef9f47c7"},
		{"os_055_single_init_script", "0.5.5", backendModelDump(map[string]any{
			"name": "old", "init_script": []any{"echo hi"},
		}), "331eadc105c565b0cd6837eb9e5984a7f51764760d373d0c94e8849eb781a5ae"},
		{"os_055_no_init_script", "0.5.5", backendModelDump(map[string]any{"name": "old0"}),
			"5d94cf4591624d38539546c0f63aebe32c4076c44c4036868a0b446dc3fa079d"},
		{"os_060_init_script_string", "0.6.0", backendModelDump(map[string]any{
			"name": "new1", "init_script": "echo hi",
		}), "7c4e0234412fdc856d851b283c763d748fefbd20bb1f086d74b0d99848dcdb85"},
		{"tproxy_enabled_follows_gateway_enabled", "0.6.0", withoutTproxy,
			"4097f4c5d35f1f34741c21d851e50b6030eff17da5bf2862d5a4716c23297693"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := GetComposeHashFromMapForOSImage(tc.compose, tc.osVersion)
			if err != nil {
				t.Fatal(err)
			}
			if got != tc.hash {
				canonical, _ := DumpAppComposeFromMapForOSImage(tc.compose, tc.osVersion)
				t.Fatalf("hash = %s, want %s\ncanonical: %s", got, tc.hash, canonical)
			}
		})
	}
}

func TestGetComposeHashForOSImageRejectsSeveralInitScriptsBelow06(t *testing.T) {
	compose := backendModelDump(map[string]any{"name": "old2", "init_script": []any{"a", "b"}})
	if _, err := GetComposeHashFromMapForOSImage(compose, "0.5.9"); err == nil ||
		!strings.Contains(err.Error(), "at most one init_script") {
		t.Fatalf("err = %v, want at most one init_script", err)
	}
}

func TestGetComposeHashForOSImageLeavesTheInputUnchanged(t *testing.T) {
	compose := backendModelDump(map[string]any{"name": "old"})
	if _, err := GetComposeHashFromMapForOSImage(compose, "0.5.5"); err != nil {
		t.Fatal(err)
	}
	if compose["manifest_version"] != 2 || compose["storage_discard"] != nil {
		t.Fatalf("input changed: %v", compose)
	}
	if _, ok := compose["init_script"]; !ok {
		t.Fatal("input lost init_script")
	}
}
