package phala

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCVMDetailVersionAndOptions(t *testing.T) {
	var version, query string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		version, query = r.Header.Get("X-Phala-Version"), r.URL.RawQuery
		if r.URL.Path != "/cvms/id" {
			t.Errorf("path = %q", r.URL.Path)
		}
		if version == "2026-06-23" {
			fmt.Fprint(w, `{"id":"id","resource":{"memory_in_gb":1.5},"compose_file":{"name":"legacy-app"}}`)
			return
		}
		if version != "2026-11-11" {
			t.Errorf("unexpected version %q", version)
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		if r.URL.Query().Get("include_compose") == "true" {
			fmt.Fprint(w, `{"id":"id","resource":{"memory_in_mb":1537},"compose_file":{"name":"app"},"gpu":{"product_id":"10de:2331","gpus":2,"cc_mode":{"expected":"on"}}}`)
			return
		}
		fmt.Fprint(w, `{"id":"id","resource":{"memory_in_mb":1537},"gpu":{"product_id":null,"gpus":2,"cc_mode":{"expected":"devtools"}},"dapp_dashboard_url":null,"syslog_endpoint":"syslog://host"}`)
	}))
	defer server.Close()
	client, _ := NewClient(WithAPIKey("key"), WithBaseURL(server.URL))
	var method func(context.Context, string) (*CVMInfo, error) = client.GetCVMInfo
	info, err := method(context.Background(), "id")
	if err != nil {
		t.Fatal(err)
	}
	if version != "2026-06-23" || query != "" {
		t.Fatalf("version=%q query=%q", version, query)
	}
	legacyCompose, ok := info.ComposeFile.(map[string]any)
	if !ok || legacyCompose["name"] != "legacy-app" || info.Resource.MemoryInGB == nil || *info.Resource.MemoryInGB != 1.5 || info.GPU != nil {
		t.Fatalf("legacy info = %#v", info)
	}
	client, _ = NewClient(WithAPIKey("key"), WithBaseURL(server.URL), WithAPIVersion("2026-11-11"))
	for _, tc := range []struct {
		option *bool
		want   string
	}{{nil, ""}, {boolPointer(true), "include_compose=true"}, {boolPointer(false), "include_compose=false"}} {
		info, err = client.GetCVMInfoWithOptions(context.Background(), "id", &GetCVMInfoOptions{IncludeCompose: tc.option})
		if err != nil {
			t.Fatal(err)
		}
		if version != "2026-11-11" || query != tc.want {
			t.Fatalf("version=%q query=%q want=%q", version, query, tc.want)
		}
		if tc.want == "include_compose=true" {
			compose, ok := info.ComposeFile.(map[string]any)
			if !ok || compose["name"] != "app" || info.GPU == nil || info.GPU.ProductID == nil || *info.GPU.ProductID != "10de:2331" || info.GPU.CCMode.Expected != "on" {
				t.Fatalf("included detail = %#v", info)
			}
		} else if info.ComposeFile != nil || info.Resource.MemoryInMB == nil || *info.Resource.MemoryInMB != 1537 || info.GPU == nil || info.GPU.ProductID != nil || info.GPU.GPUs != 2 || info.GPU.CCMode.Expected != "devtools" || info.DappDashboardURL != nil || info.SyslogEndpoint == nil || *info.SyslogEndpoint != "syslog://host" {
			t.Fatalf("detail = %#v for %q", info, tc.want)
		}
	}
}

func boolPointer(v bool) *bool { return &v }

func TestCVMGPUStatus(t *testing.T) {
	response := `{"observed":[{"slot":"0000:01:00.0","cc_mode":"unknown"}]}`
	statusCode := http.StatusOK
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/cvms/id/gpu-status" || r.Header.Get("X-Phala-Version") != "2026-11-11" {
			t.Errorf("path=%q version=%q", r.URL.Path, r.Header.Get("X-Phala-Version"))
		}
		w.WriteHeader(statusCode)
		fmt.Fprint(w, response)
	}))
	defer server.Close()
	client, _ := NewClient(WithAPIKey("key"), WithBaseURL(server.URL), WithAPIVersion("2026-11-11"))
	status, err := client.GetCVMGPUStatus(context.Background(), "id")
	if err != nil || len(status.Observed) != 1 || status.Observed[0].CCMode != "unknown" || status.Observed[0].Slot != "0000:01:00.0" {
		t.Fatalf("status=%#v err=%v", status, err)
	}
	response = `{"observed":null}`
	status, err = client.GetCVMGPUStatus(context.Background(), "id")
	if err != nil || status.Observed != nil {
		t.Fatalf("status=%#v err=%v", status, err)
	}
	statusCode = http.StatusNotFound
	_, err = client.GetCVMGPUStatus(context.Background(), "id")
	var apiErr *APIError
	if !errors.As(err, &apiErr) || apiErr.StatusCode != 404 {
		t.Fatalf("error = %v", err)
	}
}
