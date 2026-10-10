package phala

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

// TestRedirectCredentialIsolation reproduces the vulnerable transport, then
// checks SDK requests and SSE against the same two real HTTP origins.
func TestRedirectCredentialIsolation(t *testing.T) {
	const key = "redirect-regression-secret"
	statuses := []int{301, 302, 303, 307, 308}
	methods := []string{"GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"}
	for _, status := range statuses {
		for _, method := range methods {
			t.Run(fmt.Sprintf("%s/%d", method, status), func(t *testing.T) {
				var attackerHits, attackerKeys, apiKeys atomic.Int32
				attacker := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					attackerHits.Add(1)
					if r.Header.Get("X-API-Key") == key {
						attackerKeys.Add(1)
					}
					_, _ = io.WriteString(w, `{"ok":true}`)
				}))
				defer attacker.Close()
				api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					if r.Header.Get("X-API-Key") == key {
						apiKeys.Add(1)
					} else {
						t.Error("API request lost authentication")
					}
					if r.URL.Path != "/ok" {
						w.Header().Set("Location", attacker.URL+"/stolen")
						w.WriteHeader(status)
						return
					}
					if r.Method == "POST" {
						var body map[string]string
						if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body["hello"] != "world" {
							t.Errorf("legitimate POST body changed: %v, %v", body, err)
						}
					}
					if r.Header.Get("Accept") == "text/event-stream" {
						w.Header().Set("Content-Type", "text/event-stream")
						_, _ = io.WriteString(w, "event: complete\ndata: {\"status\":\"running\"}\n\n")
					} else {
						_, _ = io.WriteString(w, `{"ok":true}`)
					}
				}))
				defer api.Close()

				// Control: Go's default client leaks the custom auth header.
				unsafe := &http.Client{Timeout: 2 * time.Second}
				req, err := http.NewRequest(method, api.URL+"/redirect", nil)
				if err != nil {
					t.Fatal(err)
				}
				req.Header.Set("X-API-Key", key)
				resp, err := unsafe.Do(req)
				if err != nil {
					t.Fatal(err)
				}
				resp.Body.Close()
				if attackerHits.Load() != 1 || attackerKeys.Load() != 1 {
					t.Fatal("control did not reproduce the credential leak")
				}
				attackerHits.Store(0)
				attackerKeys.Store(0)

				var customRedirects atomic.Int32
				unsafe.Transport = api.Client().Transport
				unsafe.Jar, err = cookiejar.New(nil)
				if err != nil {
					t.Fatal(err)
				}
				unsafe.CheckRedirect = func(*http.Request, []*http.Request) error {
					customRedirects.Add(1)
					return nil
				}
				for _, custom := range []bool{false, true} {
					opts := []Option{WithAPIKey(key), WithBaseURL(api.URL)}
					if custom {
						opts = append(opts, WithHTTPClient(unsafe), WithTimeout(time.Second))
					}
					client, err := NewClient(opts...)
					if err != nil {
						t.Fatal(err)
					}
					if custom && (client.httpClient == unsafe || client.httpClient.Transport != unsafe.Transport || client.httpClient.Jar != unsafe.Jar) {
						t.Fatal("SDK did not preserve custom transport and cookie jar in its private client copy")
					}
					err = client.doJSON(context.Background(), method, "/redirect", nil, nil)
					var apiErr *APIError
					if !errors.As(err, &apiErr) || apiErr.StatusCode != status {
						t.Fatalf("expected APIError status %d, got %v", status, err)
					}
					var result map[string]bool
					if err := client.doJSON(context.Background(), "POST", "/ok", map[string]string{"hello": "world"}, &result); err != nil || !result["ok"] {
						t.Fatalf("legitimate POST failed: %v, %v", result, err)
					}
					ch := make(chan CVMStateEvent, 1)
					if err := client.streamSSE(context.Background(), "/redirect", ch); err == nil {
						t.Fatal("SSE accepted redirect")
					}
					if err := client.streamSSE(context.Background(), "/ok", ch); err != nil {
						t.Fatal(err)
					}
					if event := <-ch; event.Event != "complete" {
						t.Fatalf("unexpected SSE event: %v", event)
					}
				}
				if unsafe.Timeout != 2*time.Second || customRedirects.Load() != 0 {
					t.Fatal("SDK mutated or invoked caller redirect policy")
				}
				// The caller still follows redirects outside SDK use.
				resp, err = unsafe.Do(req)
				if err != nil {
					t.Fatal(err)
				}
				resp.Body.Close()
				if customRedirects.Load() != 1 || attackerHits.Load() != 1 || attackerKeys.Load() != 1 {
					t.Fatal("caller redirect behavior was not preserved, or SDK leaked credentials")
				}
				if apiKeys.Load() != 10 {
					t.Fatalf("unexpected authenticated request count: %d", apiKeys.Load())
				}
			})
		}
	}
}
