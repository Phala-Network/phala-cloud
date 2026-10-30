package phala

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestPlacementNameRequests(t *testing.T) {
	// The physical node name is not the Teepod display name.
	physicalName := "physical-node-42"
	deviceID := "device-123"
	cases := []struct {
		name string
		path string
		want map[string]string
		call func(*Client) error
	}{
		{
			name: "replica", path: "/cvms/source/replicas", want: map[string]string{"node": physicalName},
			call: func(c *Client) error {
				_, err := c.ReplicateCVM(context.Background(), "source", &ReplicateCVMOptions{Node: &physicalName})
				return err
			},
		},
		{
			name: "replica automatic", path: "/cvms/source/replicas",
			call: func(c *Client) error {
				_, err := c.ReplicateCVM(context.Background(), "source", &ReplicateCVMOptions{})
				return err
			},
		},
		{
			name: "CVM allowance", path: "/cvms/source/is-allowed", want: map[string]string{"node": physicalName},
			call: func(c *Client) error {
				_, err := c.CheckCvmIsAllowed(context.Background(), "source", &CheckCvmIsAllowedRequest{Node: &physicalName})
				return err
			},
		},
		{
			name: "CVM allowance device", path: "/cvms/source/is-allowed", want: map[string]string{"device_id": deviceID},
			call: func(c *Client) error {
				_, err := c.CheckCvmIsAllowed(context.Background(), "source", &CheckCvmIsAllowedRequest{DeviceID: &deviceID})
				return err
			},
		},
		{
			name: "app allowance", path: "/apps/app_test/is-allowed", want: map[string]string{"node": physicalName, "compose_hash": "hash"},
			call: func(c *Client) error {
				_, err := c.CheckAppIsAllowed(context.Background(), "app_test", &CheckAppIsAllowedRequest{Node: &physicalName, ComposeHash: "hash"})
				return err
			},
		},
		{
			name: "app allowance device", path: "/apps/app_test/is-allowed", want: map[string]string{"device_id": deviceID, "compose_hash": "hash"},
			call: func(c *Client) error {
				_, err := c.CheckAppIsAllowed(context.Background(), "app_test", &CheckAppIsAllowedRequest{DeviceID: &deviceID, ComposeHash: "hash"})
				return err
			},
		},
		{
			name: "app instance", path: "/apps/app_test/instances", want: map[string]string{"node": physicalName},
			call: func(c *Client) error {
				_, err := c.CreateAppInstance(context.Background(), "app_test", &CreateAppInstanceRequest{Node: &physicalName})
				return err
			},
		},
		{
			name: "app instance automatic", path: "/apps/app_test/instances",
			call: func(c *Client) error {
				_, err := c.CreateAppInstance(context.Background(), "app_test", &CreateAppInstanceRequest{})
				return err
			},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.Method != http.MethodPost || r.URL.Path != tc.path {
					t.Errorf("request = %s %s, want POST %s", r.Method, r.URL.Path, tc.path)
				}
				var body map[string]json.RawMessage
				if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
					t.Fatalf("decode request: %v", err)
				}
				for _, key := range []string{"node_id", "teepod_id"} {
					if _, ok := body[key]; ok {
						t.Errorf("legacy selector %s present in request", key)
					}
				}
				for _, key := range []string{"node", "device_id"} {
					if _, expected := tc.want[key]; !expected {
						if _, present := body[key]; present {
							t.Errorf("unexpected %s in request", key)
						}
					}
				}
				for key, want := range tc.want {
					var got string
					if err := json.Unmarshal(body[key], &got); err != nil || got != want {
						t.Errorf("%s = %s, want string %q (error: %v)", key, body[key], want, err)
					}
				}
				w.Header().Set("Content-Type", "application/json")
				_, _ = w.Write([]byte(`{"compose_hash":"hash","id":"cvm_test","status":"running"}`))
			}))
			defer server.Close()
			client, err := NewClient(WithAPIKey("test"), WithBaseURL(server.URL))
			if err != nil {
				t.Fatal(err)
			}
			if err := tc.call(client); err != nil {
				t.Fatal(err)
			}
		})
	}
}

func TestCapacityHashIDResponse(t *testing.T) {
	var capacity TeepodCapacity
	if err := json.Unmarshal([]byte(`{"teepod_id":7,"node_id":42,"teepod_id_hashid":"teepod_placement7","node_id_hashid":"node_physical42","name":"teepod-name","node":"physical-name"}`), &capacity); err != nil {
		t.Fatal(err)
	}
	if capacity.Node != "physical-name" || capacity.Name != "teepod-name" {
		t.Fatalf("capacity names were not preserved: %+v", capacity)
	}
	if capacity.TeepodID != 7 || capacity.NodeID == nil || *capacity.NodeID != 42 || capacity.TeepodIDHashid != "teepod_placement7" || capacity.NodeIDHashid == nil || *capacity.NodeIDHashid != "node_physical42" {
		t.Fatalf("capacity IDs were not preserved: %+v", capacity)
	}
}
