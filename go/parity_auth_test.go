package phala

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestBearerAndWorkspaceOptionsOverrideEnvironment(t *testing.T) {
	t.Setenv("PHALA_CLOUD_API_KEY", "")
	t.Setenv("PHALA_OIDC_TOKEN", "env-token")
	t.Setenv("PHALA_CLOUD_WORKSPACE", "env-workspace")
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer option-token" || r.Header.Get("X-Phala-Workspace") != "option-workspace" {
			t.Errorf("headers: %v", r.Header)
		}
		w.Write([]byte(`{}`))
	}))
	defer server.Close()
	c, err := NewClient(WithBaseURL(server.URL), WithBearerToken("option-token"), WithWorkspace("option-workspace"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := c.GetCVMInfo(context.Background(), "id"); err != nil {
		t.Fatal(err)
	}
}

func TestAPIKeyWinsCredentialConflicts(t *testing.T) {
	t.Setenv("PHALA_CLOUD_API_KEY", "")
	t.Setenv("PHALA_OIDC_TOKEN", "")
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-API-Key") != "key" || r.Header.Get("Authorization") != "" {
			t.Errorf("expected only API key, got %v", r.Header)
		}
		w.Write([]byte(`{}`))
	}))
	defer server.Close()
	cases := []struct {
		name    string
		options []Option
	}{
		{"resolved", []Option{WithAPIKey("key"), WithBearerToken("token")}},
		{"environment key", []Option{WithBearerToken("token")}},
		{"custom key", []Option{WithBearerToken("token"), WithHeader("x-aPi-kEy", "key")}},
		{"custom authorization", []Option{WithAPIKey("key"), WithHeader("aUtHoRiZaTiOn", "Bearer token")}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if tc.name == "environment key" {
				t.Setenv("PHALA_CLOUD_API_KEY", "key")
			}
			opts := append([]Option{WithBaseURL(server.URL)}, tc.options...)
			c, err := NewClient(opts...)
			if err != nil {
				t.Fatal(err)
			}
			if _, err := c.GetCVMInfo(context.Background(), "id"); err != nil {
				t.Fatal(err)
			}
		})
	}
}

func TestBaseURLRejectsUserinfo(t *testing.T) {
	t.Setenv("PHALA_CLOUD_API_KEY", "")
	t.Setenv("PHALA_OIDC_TOKEN", "")
	var apiKey, authorization string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		apiKey = r.Header.Get("X-API-Key")
		authorization = r.Header.Get("Authorization")
		w.Write([]byte(`{}`))
	}))
	defer server.Close()
	baseURL := strings.Replace(server.URL, "http://", "http://user:password@", 1)
	c, err := NewClient(WithAPIKey("key"), WithBaseURL(baseURL))
	if err == nil {
		_, requestErr := c.GetCVMInfo(context.Background(), "id")
		t.Fatalf("userinfo accepted: request error %v, API key %q, Authorization %q", requestErr, apiKey, authorization)
	}
	if !strings.Contains(err.Error(), "userinfo") {
		t.Fatalf("unclear error: %v", err)
	}
}

func TestOIDCEnvironmentAuthentication(t *testing.T) {
	t.Setenv("PHALA_CLOUD_API_KEY", "")
	t.Setenv("PHALA_OIDC_TOKEN", "oidc")
	t.Setenv("PHALA_CLOUD_WORKSPACE", "workspace")
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer oidc" || r.Header.Get("X-Phala-Workspace") != "workspace" || r.Header.Get("X-API-Key") != "" {
			t.Errorf("unexpected headers: %v", r.Header)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{}`))
	}))
	defer server.Close()
	c, err := NewClient(WithBaseURL(server.URL))
	if err != nil {
		t.Fatal(err)
	}
	_, err = c.GetCVMInfo(context.Background(), "cvm")
	if err != nil {
		t.Fatal(err)
	}
}
