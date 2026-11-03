package phala

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"
)

func TestProvisionEncryptedEnvironmentSchema(t *testing.T) {
	for _, typ := range []reflect.Type{reflect.TypeOf(ComposeFile{}), reflect.TypeOf(ProvisionComposeUpdateRequest{})} {
		if _, ok := typ.FieldByName("EncryptedEnv"); ok {
			t.Errorf("%s exposes forbidden nested encrypted_env", typ.Name())
		}
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body map[string]json.RawMessage
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Error(err)
		}
		switch r.URL.Path {
		case "/cvms":
			if string(body["encrypted_env"]) != `"ciphertext"` {
				t.Errorf("top-level encrypted_env: %s", body["encrypted_env"])
			}
			var compose map[string]json.RawMessage
			if err := json.Unmarshal(body["compose_file"], &compose); err != nil {
				t.Error(err)
			}
			if _, ok := compose["encrypted_env"]; ok {
				t.Error("invalid compose encrypted_env sent")
			}
		case "/cvms/id/compose_file/provision":
			if _, ok := body["encrypted_env"]; ok {
				t.Error("invalid compose update encrypted_env sent")
			}
			if string(body["docker_compose_file"]) != `"services: {}"` {
				t.Errorf("compose update: %s", body["docker_compose_file"])
			}
		default:
			t.Errorf("unexpected path %s", r.URL.Path)
		}
		w.Write([]byte(`{}`))
	}))
	defer server.Close()
	c, _ := NewClient(WithAPIKey("key"), WithBaseURL(server.URL))
	encrypted := "ciphertext"
	if _, err := c.ProvisionCVM(context.Background(), &ProvisionCVMRequest{Name: "hello", ComposeFile: &ComposeFile{Name: "hello"}, EncryptedEnv: &encrypted}); err != nil {
		t.Fatal(err)
	}
	if _, err := c.ProvisionCVMComposeFileUpdate(context.Background(), "id", &ProvisionComposeUpdateRequest{Name: "hello", DockerComposeFile: "services: {}"}); err != nil {
		t.Fatal(err)
	}
}
