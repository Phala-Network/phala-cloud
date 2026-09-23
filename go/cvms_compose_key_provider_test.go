package phala

import (
	"encoding/json"
	"testing"
)

func TestComposeKeyProviderJSON(t *testing.T) {
	t.Parallel()
	keyProvider := "kms"
	for _, value := range []any{
		ComposeFile{Name: "app", DockerComposeFile: "services: {}", KeyProvider: &keyProvider},
		ProvisionComposeUpdateRequest{Name: "app", DockerComposeFile: "services: {}", KeyProvider: &keyProvider},
	} {
		data, err := json.Marshal(value)
		if err != nil {
			t.Fatal(err)
		}
		var payload map[string]any
		if err := json.Unmarshal(data, &payload); err != nil {
			t.Fatal(err)
		}
		if payload["key_provider"] != "kms" {
			t.Fatalf("missing key_provider in %s", data)
		}
		if _, exists := payload["key_provider_id"]; exists {
			t.Fatalf("backend-owned key_provider_id should be omitted from %s", data)
		}
	}
}
