package phala

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestOtherOptionalArraysSerializeEmpty(t *testing.T) {
	cases := []struct {
		name, field string
		encode      func() ([]byte, error)
	}{
		{"compose allowed", "allowed_envs", func() ([]byte, error) { return json.Marshal(ComposeFile{AllowedEnvs: []string{}}) }},
		{"provision compose allowed", "allowed_envs", func() ([]byte, error) { return json.Marshal(ProvisionComposeUpdateRequest{AllowedEnvs: []string{}}) }},
		{"compose commit env", "env_keys", func() ([]byte, error) { return json.Marshal(CommitComposeUpdateRequest{EnvKeys: []string{}}) }},
		{"provision commit env", "env_keys", func() ([]byte, error) { return json.Marshal(CommitCVMProvisionRequest{EnvKeys: []string{}}) }},
		{"provision ssh", "ssh_authorized_keys", func() ([]byte, error) { return json.Marshal(ProvisionCVMRequest{SSHAuthorizedKeys: []string{}}) }},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			data, err := tc.encode()
			if err != nil {
				t.Fatal(err)
			}
			var object map[string]json.RawMessage
			if err := json.Unmarshal(data, &object); err != nil {
				t.Fatal(err)
			}
			if string(object[tc.field]) != "[]" {
				t.Fatalf("field %s: %s", tc.field, data)
			}
		})
	}
}

func TestReplacementArraysWire(t *testing.T) {
	var payload map[string]json.RawMessage
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		payload = map[string]json.RawMessage{}
		json.NewDecoder(r.Body).Decode(&payload)
		w.Write([]byte(`{}`))
	}))
	defer server.Close()
	c, _ := NewClient(WithAPIKey("key"), WithBaseURL(server.URL), WithMaxRetries(0))
	for _, empty := range []bool{false, true} {
		var values []string
		if empty {
			values = []string{}
		}
		_, err := c.PatchCVM(context.Background(), "id", &PatchCVMRequest{AllowedEnvs: values})
		if err != nil {
			t.Fatal(err)
		}
		b, ok := payload["allowed_envs"]
		if ok != empty || (ok && string(b) != "[]") {
			t.Fatalf("patch empty=%v: %s", empty, b)
		}
		_, err = c.UpdateCVMEnvs(context.Background(), "id", &UpdateEnvsRequest{EnvKeys: values})
		if err != nil {
			t.Fatal(err)
		}
		b, ok = payload["env_keys"]
		if ok != empty || (ok && string(b) != "[]") {
			t.Fatalf("env empty=%v: %s", empty, b)
		}
	}
}
