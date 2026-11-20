package phala

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"
)

func TestNewClient_WithoutCredentials(t *testing.T) {
	t.Setenv("PHALA_CLOUD_API_KEY", "")
	t.Setenv("PHALA_OIDC_TOKEN", "")

	c, err := NewClient()
	if err != nil {
		t.Fatalf("unexpected error without credentials: %v", err)
	}
	if c.apiKey != "" || c.bearerToken != "" {
		t.Errorf("expected empty credentials, got apiKey=%q bearerToken=%q", c.apiKey, c.bearerToken)
	}
}

func TestKeylessClientSendsNoAuthHeaders(t *testing.T) {
	t.Setenv("PHALA_CLOUD_API_KEY", "")
	t.Setenv("PHALA_OIDC_TOKEN", "")
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, ok := r.Header["X-Api-Key"]; ok {
			t.Errorf("unexpected X-API-Key header: %v", r.Header)
		}
		if _, ok := r.Header["Authorization"]; ok {
			t.Errorf("unexpected Authorization header: %v", r.Header)
		}
		w.Write([]byte(`{"public_key":"pk","signature":"sig"}`))
	}))
	defer server.Close()

	c, err := NewClient(WithBaseURL(server.URL))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := c.GetAppEnvEncryptPubKey(context.Background(), "kms", "app"); err != nil {
		t.Fatal(err)
	}
}

func TestClientWithAPIKeySendsKeyHeader(t *testing.T) {
	t.Setenv("PHALA_OIDC_TOKEN", "")
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("X-API-Key"); got != "test-key" {
			t.Errorf("X-API-Key = %q, want test-key", got)
		}
		if _, ok := r.Header["Authorization"]; ok {
			t.Errorf("unexpected Authorization header: %v", r.Header)
		}
		w.Write([]byte(`{"public_key":"pk","signature":"sig"}`))
	}))
	defer server.Close()

	c, err := NewClient(WithBaseURL(server.URL), WithAPIKey("test-key"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := c.GetAppEnvEncryptPubKey(context.Background(), "kms", "app"); err != nil {
		t.Fatal(err)
	}
}

func TestNewClient_WithAPIKey(t *testing.T) {
	c, err := NewClient(WithAPIKey("test-key"))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if c.apiKey != "test-key" {
		t.Errorf("apiKey = %q, want %q", c.apiKey, "test-key")
	}
}

func TestNewClient_Defaults(t *testing.T) {
	c, err := NewClient(WithAPIKey("k"))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if c.baseURL != DefaultBaseURL {
		t.Errorf("baseURL = %q, want %q", c.baseURL, DefaultBaseURL)
	}
	if c.apiVersion != DefaultAPIVersion {
		t.Errorf("apiVersion = %q, want %q", c.apiVersion, DefaultAPIVersion)
	}
	if c.maxRetries != 30 {
		t.Errorf("maxRetries = %d, want 30", c.maxRetries)
	}
}

func TestNewClient_EnvFallback(t *testing.T) {
	orig := os.Getenv("PHALA_CLOUD_API_KEY")
	os.Setenv("PHALA_CLOUD_API_KEY", "env-key")
	defer func() {
		if orig != "" {
			os.Setenv("PHALA_CLOUD_API_KEY", orig)
		} else {
			os.Unsetenv("PHALA_CLOUD_API_KEY")
		}
	}()

	c, err := NewClient()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if c.apiKey != "env-key" {
		t.Errorf("apiKey = %q, want %q", c.apiKey, "env-key")
	}
}

func TestNewClient_BaseURLEnvFallback(t *testing.T) {
	origKey := os.Getenv("PHALA_CLOUD_API_KEY")
	origURL := os.Getenv("PHALA_CLOUD_API_PREFIX")
	os.Setenv("PHALA_CLOUD_API_KEY", "k")
	os.Setenv("PHALA_CLOUD_API_PREFIX", "https://custom.example.com/api/v1")
	defer func() {
		if origKey != "" {
			os.Setenv("PHALA_CLOUD_API_KEY", origKey)
		} else {
			os.Unsetenv("PHALA_CLOUD_API_KEY")
		}
		if origURL != "" {
			os.Setenv("PHALA_CLOUD_API_PREFIX", origURL)
		} else {
			os.Unsetenv("PHALA_CLOUD_API_PREFIX")
		}
	}()

	c, err := NewClient()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if c.baseURL != "https://custom.example.com/api/v1" {
		t.Errorf("baseURL = %q, want custom URL", c.baseURL)
	}
}

func TestNewClient_ExplicitBaseURLOverridesEnv(t *testing.T) {
	origKey := os.Getenv("PHALA_CLOUD_API_KEY")
	origURL := os.Getenv("PHALA_CLOUD_API_PREFIX")
	os.Setenv("PHALA_CLOUD_API_KEY", "k")
	os.Setenv("PHALA_CLOUD_API_PREFIX", "https://env.example.com")
	defer func() {
		if origKey != "" {
			os.Setenv("PHALA_CLOUD_API_KEY", origKey)
		} else {
			os.Unsetenv("PHALA_CLOUD_API_KEY")
		}
		if origURL != "" {
			os.Setenv("PHALA_CLOUD_API_PREFIX", origURL)
		} else {
			os.Unsetenv("PHALA_CLOUD_API_PREFIX")
		}
	}()

	c, err := NewClient(WithBaseURL("https://explicit.example.com"))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if c.baseURL != "https://explicit.example.com" {
		t.Errorf("baseURL = %q, want explicit URL", c.baseURL)
	}
}

func TestNewClient_TrailingSlashStripped(t *testing.T) {
	c, err := NewClient(WithAPIKey("k"), WithBaseURL("https://example.com/api/"))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if c.baseURL != "https://example.com/api" {
		t.Errorf("baseURL = %q, want trailing slash stripped", c.baseURL)
	}
}

func TestOptions(t *testing.T) {
	customHTTP := &http.Client{Timeout: 99 * time.Second}
	c, err := NewClient(
		WithAPIKey("k"),
		WithBaseURL("https://test.com"),
		WithAPIVersion("2025-01-01"),
		WithHTTPClient(customHTTP),
		WithUserAgent("my-app/1.0"),
		WithHeader("X-Custom", "val"),
		WithMaxRetries(5),
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if c.baseURL != "https://test.com" {
		t.Errorf("baseURL = %q", c.baseURL)
	}
	if c.apiVersion != "2025-01-01" {
		t.Errorf("apiVersion = %q", c.apiVersion)
	}
	if c.httpClient == customHTTP || c.httpClient.Timeout != customHTTP.Timeout {
		t.Error("httpClient was not copied with its configuration preserved")
	}
	if c.userAgent != "my-app/1.0" {
		t.Errorf("userAgent = %q", c.userAgent)
	}
	if c.headers["X-Custom"] != "val" {
		t.Errorf("headers[X-Custom] = %q", c.headers["X-Custom"])
	}
	if c.maxRetries != 5 {
		t.Errorf("maxRetries = %d", c.maxRetries)
	}
}

func TestWithTimeout(t *testing.T) {
	c, err := NewClient(WithAPIKey("k"), WithTimeout(30*time.Second))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if c.httpClient.Timeout != 30*time.Second {
		t.Errorf("timeout = %v, want 30s", c.httpClient.Timeout)
	}
}

// TestDefaultTimeout pins the 60s per-request timeout shared with the JS and
// Python SDKs. Go's zero-valued http.Client means no timeout at all, so a
// hung connection used to block a caller forever.
func TestDefaultTimeout(t *testing.T) {
	client, err := NewClient(WithAPIKey("k"))
	if err != nil {
		t.Fatalf("NewClient: %v", err)
	}
	if client.httpClient.Timeout != DefaultTimeout {
		t.Fatalf("timeout = %v, want %v", client.httpClient.Timeout, DefaultTimeout)
	}
	if DefaultTimeout != 60*time.Second {
		t.Fatalf("DefaultTimeout = %v, want 60s", DefaultTimeout)
	}

	overridden, err := NewClient(WithAPIKey("k"), WithTimeout(5*time.Second))
	if err != nil {
		t.Fatalf("NewClient with timeout: %v", err)
	}
	if overridden.httpClient.Timeout != 5*time.Second {
		t.Fatalf("overridden timeout = %v, want 5s", overridden.httpClient.Timeout)
	}
}
