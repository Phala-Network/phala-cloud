package phala

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"runtime"
	"strings"
	"testing"
)

func TestDefaultUserAgent(t *testing.T) {
	ua := DefaultUserAgent()
	want := "phala-cloud-sdk-go/" + sdkVersion + " go/" + strings.TrimPrefix(runtime.Version(), "go")
	if ua != want {
		t.Fatalf("DefaultUserAgent() = %q, want %q", ua, want)
	}
	if ua == "node" || ua == "undici" || strings.HasPrefix(ua, "Bun/") || strings.HasPrefix(ua, "phala-cli/") {
		t.Fatalf("DefaultUserAgent() %q collides with a legacy log-access User-Agent", ua)
	}
}

func TestRequestSendsDefaultUserAgent(t *testing.T) {
	var got string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got = r.Header.Get("User-Agent")
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `[]`)
	}))
	defer srv.Close()

	client, err := NewClient(WithAPIKey("k"), WithBaseURL(srv.URL))
	if err != nil {
		t.Fatalf("NewClient: %v", err)
	}
	if _, err := client.ListSSHKeys(context.Background()); err != nil {
		t.Fatalf("ListSSHKeys: %v", err)
	}
	if got != DefaultUserAgent() {
		t.Fatalf("User-Agent = %q, want %q", got, DefaultUserAgent())
	}
}

func TestWithUserAgentReplacesDefault(t *testing.T) {
	var got string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got = r.Header.Get("User-Agent")
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `[]`)
	}))
	defer srv.Close()

	client, err := NewClient(WithAPIKey("k"), WithBaseURL(srv.URL), WithUserAgent("MyApp/1.0"))
	if err != nil {
		t.Fatalf("NewClient: %v", err)
	}
	if _, err := client.ListSSHKeys(context.Background()); err != nil {
		t.Fatalf("ListSSHKeys: %v", err)
	}
	if got != "MyApp/1.0" {
		t.Fatalf("User-Agent = %q, want MyApp/1.0", got)
	}
}

func TestWithHeaderUserAgentOverrides(t *testing.T) {
	var got string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got = r.Header.Get("User-Agent")
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `[]`)
	}))
	defer srv.Close()

	client, err := NewClient(
		WithAPIKey("k"),
		WithBaseURL(srv.URL),
		WithUserAgent("MyApp/1.0"),
		WithHeader("User-Agent", "Wrapper/2.0"),
	)
	if err != nil {
		t.Fatalf("NewClient: %v", err)
	}
	if _, err := client.ListSSHKeys(context.Background()); err != nil {
		t.Fatalf("ListSSHKeys: %v", err)
	}
	if got != "Wrapper/2.0" {
		t.Fatalf("User-Agent = %q, want Wrapper/2.0", got)
	}
}
