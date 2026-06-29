package phala

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestListKMSContracts(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/kms" {
			t.Errorf("path = %q, want /kms", r.URL.Path)
		}
		if v := r.Header.Get("X-Phala-Version"); v != "2026-06-23" {
			t.Errorf("X-Phala-Version = %q, want 2026-06-23", v)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{
			"items": [
				{"id":"kc_abc","slug":"phala","label":"Phala KMS","contract_address":"phala","chain_id":0,"k256_pubkey":"0x0334c7","ca_pubkey":"0xca00","node_count":16}
			],
			"total": 1, "page": 1, "page_size": 20, "pages": 1
		}`)
	}))
	defer srv.Close()

	client, err := NewClient(WithAPIKey("k"), WithBaseURL(srv.URL))
	if err != nil {
		t.Fatal(err)
	}
	result, err := client.ListKMSContracts(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Items) != 1 {
		t.Fatalf("items = %d, want 1", len(result.Items))
	}
	c := result.Items[0]
	if c.Slug == nil || *c.Slug != "phala" {
		t.Errorf("slug = %v, want phala", c.Slug)
	}
	if c.K256Pubkey == nil || *c.K256Pubkey != "0x0334c7" {
		t.Errorf("k256_pubkey = %v, want 0x0334c7", c.K256Pubkey)
	}
	if c.NodeCount != 16 {
		t.Errorf("node_count = %d, want 16", c.NodeCount)
	}
}

func TestListKMSContractNodes(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/kms/phala/nodes" {
			t.Errorf("path = %q, want /kms/phala/nodes", r.URL.Path)
		}
		if v := r.Header.Get("X-Phala-Version"); v != "2026-06-23" {
			t.Errorf("X-Phala-Version = %q, want 2026-06-23", v)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{
			"items": [
				{"id":"kms_1","slug":"phala-prod3","url":"https://kms.dstack-pha-prod3.phala.network","version":"0.5.7","kms_type":"phala"}
			],
			"total": 1
		}`)
	}))
	defer srv.Close()

	client, err := NewClient(WithAPIKey("k"), WithBaseURL(srv.URL))
	if err != nil {
		t.Fatal(err)
	}
	result, err := client.ListKMSContractNodes(context.Background(), "phala")
	if err != nil {
		t.Fatal(err)
	}
	if result.Total != 1 || len(result.Items) != 1 {
		t.Fatalf("total = %d, items = %d, want 1/1", result.Total, len(result.Items))
	}
	if result.Items[0].URL != "https://kms.dstack-pha-prod3.phala.network" {
		t.Errorf("url = %q", result.Items[0].URL)
	}
}

func TestGetKMSListStaysLegacyVersion(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if v := r.Header.Get("X-Phala-Version"); v != "2026-05-22" {
			t.Errorf("X-Phala-Version = %q, want 2026-05-22 (legacy pin)", v)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"items":[],"total":0,"page":1,"page_size":20,"pages":0}`)
	}))
	defer srv.Close()

	client, err := NewClient(WithAPIKey("k"), WithBaseURL(srv.URL))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := client.GetKMSList(context.Background()); err != nil {
		t.Fatal(err)
	}
}
