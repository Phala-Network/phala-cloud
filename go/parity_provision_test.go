package phala

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestProvisionCurrentSchemaWire(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body map[string]json.RawMessage
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Error(err)
		}
		if _, ok := body["instance_type"]; ok {
			t.Errorf("instance_type should be omitted: %s", body["instance_type"])
		}
		if string(body["ssh_key_ids"]) != "[]" || string(body["env_keys"]) != "[]" {
			t.Errorf("replacement arrays: %s %s", body["ssh_key_ids"], body["env_keys"])
		}
		var compose map[string]json.RawMessage
		json.Unmarshal(body["compose_file"], &compose)
		if _, ok := compose["docker_compose_file"]; ok {
			t.Errorf("optional compose body present: %s", compose["docker_compose_file"])
		}
		if string(compose["kms_enabled"]) != "false" || string(compose["verity_volumes"]) != "[]" {
			t.Errorf("compose fields: %s", body["compose_file"])
		}
		w.Write([]byte(`{}`))
	}))
	defer server.Close()
	c, _ := NewClient(WithAPIKey("key"), WithBaseURL(server.URL))
	disabled := false
	_, err := c.ProvisionCVM(context.Background(), &ProvisionCVMRequest{Name: "hello", SSHKeyIDs: []string{}, EnvKeys: []string{}, ComposeFile: &ComposeFile{Name: "hello", KMSEnabled: &disabled, VerityVolumes: []VerityVolume{}}})
	if err != nil {
		t.Fatal(err)
	}
}
