package phala

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"
)

func TestGetCVMComposeFileInitScriptWire(t *testing.T) {
	for _, tc := range []struct {
		name, wire string
		want       []string
	}{
		{"legacy string", `"echo legacy"`, []string{"echo legacy"}},
		{"legacy empty", `""`, []string{}},
		{"current array", `["one","two"]`, []string{"one", "two"}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.Method != "GET" || r.URL.Path != "/cvms/id/compose_file" {
					t.Errorf("unexpected request: %s %s", r.Method, r.URL.Path)
				}
				fmt.Fprintf(w, `{"name":"app","init_script":%s}`, tc.wire)
			}))
			defer server.Close()
			c, err := NewClient(WithAPIKey("key"), WithBaseURL(server.URL))
			if err != nil {
				t.Fatal(err)
			}
			result, err := c.GetCVMComposeFile(context.Background(), "id")
			if err != nil {
				t.Fatal(err)
			}
			if !reflect.DeepEqual([]string(result.InitScript), tc.want) {
				t.Fatalf("got %v want %v", result.InitScript, tc.want)
			}
		})
	}
}
