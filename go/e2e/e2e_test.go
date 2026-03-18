//go:build e2e

package e2e

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/ecdh"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	phala "github.com/Phala-Network/phala-cloud/sdks/go"
	"golang.org/x/crypto/ssh"
)

const testCompose = `services:
  app:
    image: ghcr.io/phala-network/phala-cloud-bun-starter:latest
    restart: unless-stopped
    ports:
      - "80:3000"
    volumes:
      - /var/run/tappd.sock:/var/run/tappd.sock
      - /var/run/dstack.sock:/var/run/dstack.sock
`

// transientStates are CVM states that indicate an operation is in progress.
var transientStates = map[string]bool{
	"starting":      true,
	"stopping":      true,
	"restarting":    true,
	"shutting_down": true,
	"provisioning":  true,
	"in_progress":   true,
	"updating":      true,
}

func mustEnv(t *testing.T, key, fallback string) string {
	t.Helper()
	v := os.Getenv(key)
	if v == "" {
		v = fallback
	}
	if v == "" {
		t.Fatalf("environment variable %s is required", key)
	}
	if !strings.HasPrefix(v, "http://") && !strings.HasPrefix(v, "https://") && key == "PHALA_CLOUD_E2E_BASE_URL" {
		v = "https://" + v
	}
	return v
}

func genCVMName() string {
	b := make([]byte, 4)
	rand.Read(b)
	return "e2e-test-" + hex.EncodeToString(b)
}

// encryptEnvVars encrypts environment variables using X25519 + AES-256-GCM,
// matching dstack_sdk.encrypt_env_vars format.
// Returns hex(ephemeral_pubkey || iv || ciphertext).
func encryptEnvVars(t *testing.T, serverPubkeyHex string, envs map[string]string) string {
	t.Helper()

	serverPubkeyBytes, err := hex.DecodeString(serverPubkeyHex)
	if err != nil {
		t.Fatalf("decode server pubkey: %v", err)
	}

	serverPubkey, err := ecdh.X25519().NewPublicKey(serverPubkeyBytes)
	if err != nil {
		t.Fatalf("parse server pubkey: %v", err)
	}

	// Generate ephemeral X25519 keypair.
	ephemeralPriv, err := ecdh.X25519().GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("generate ephemeral key: %v", err)
	}

	// X25519 key exchange.
	sharedSecret, err := ephemeralPriv.ECDH(serverPubkey)
	if err != nil {
		t.Fatalf("ECDH: %v", err)
	}

	// Build JSON payload: {"env": [{"key": "...", "value": "..."}, ...]}
	type envVar struct {
		Key   string `json:"key"`
		Value string `json:"value"`
	}
	var envList []envVar
	for k, v := range envs {
		envList = append(envList, envVar{Key: k, Value: v})
	}
	payload, err := json.Marshal(map[string][]envVar{"env": envList})
	if err != nil {
		t.Fatalf("marshal env payload: %v", err)
	}

	// AES-256-GCM encrypt.
	block, err := aes.NewCipher(sharedSecret)
	if err != nil {
		t.Fatalf("new AES cipher: %v", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		t.Fatalf("new GCM: %v", err)
	}

	iv := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(iv); err != nil {
		t.Fatalf("generate IV: %v", err)
	}

	ciphertext := gcm.Seal(nil, iv, payload, nil)

	// Concatenate: ephemeral_pubkey || iv || ciphertext
	result := make([]byte, 0, len(ephemeralPriv.PublicKey().Bytes())+len(iv)+len(ciphertext))
	result = append(result, ephemeralPriv.PublicKey().Bytes()...)
	result = append(result, iv...)
	result = append(result, ciphertext...)

	return hex.EncodeToString(result)
}

func newE2EClient(t *testing.T) *phala.Client {
	t.Helper()
	apiKey := mustEnv(t, "PHALA_CLOUD_E2E_API_KEY", "")
	baseURL := mustEnv(t, "PHALA_CLOUD_E2E_BASE_URL", "https://cloud-api.phala.com/api/v1")
	client, err := phala.NewClient(
		phala.WithAPIKey(apiKey),
		phala.WithBaseURL(baseURL),
	)
	if err != nil {
		t.Fatalf("failed to create client: %v", err)
	}
	return client
}

func waitIdle(t *testing.T, client *phala.Client, cvmID string, timeout time.Duration) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	start := time.Now()
	lastLog := start

	for {
		info, err := client.GetCVMInfo(ctx, cvmID)
		if err != nil {
			t.Logf("waitIdle: GetCVMInfo error: %v", err)
		} else {
			status := info.Status
			hasProgress := info.Progress != nil && info.Progress.Target != nil && *info.Progress.Target != ""

			if now := time.Now(); now.Sub(lastLog) >= 30*time.Second {
				target := ""
				if info.Progress != nil && info.Progress.Target != nil {
					target = *info.Progress.Target
				}
				t.Logf("waitIdle: status=%s progress_target=%s elapsed=%s", status, target, now.Sub(start).Round(time.Second))
				lastLog = now
			}

			if !transientStates[status] && !hasProgress {
				return
			}
		}

		select {
		case <-ctx.Done():
			t.Fatalf("waitIdle: timed out after %s", timeout)
		case <-time.After(5 * time.Second):
		}
	}
}

func assertIdle(t *testing.T, client *phala.Client, cvmID, label string) {
	t.Helper()
	ctx := context.Background()
	info, err := client.GetCVMInfo(ctx, cvmID)
	if err != nil {
		t.Fatalf("%s: GetCVMInfo error: %v", label, err)
	}
	if transientStates[info.Status] {
		t.Fatalf("%s: expected idle state, got %s", label, info.Status)
	}
}

func deploy(t *testing.T, client *phala.Client) (cvmID, appID, encryptPubkey string) {
	t.Helper()
	ctx := context.Background()
	name := genCVMName()
	t.Logf("deploying CVM: %s", name)

	provResp, err := client.ProvisionCVM(ctx, &phala.ProvisionCVMRequest{
		Name:         name,
		InstanceType: "tdx.small",
		ComposeFile: &phala.ComposeFile{
			DockerComposeFile: testCompose,
			GatewayEnabled:    phala.Bool(true),
		},
	})
	if err != nil {
		t.Fatalf("ProvisionCVM: %v", err)
	}
	t.Logf("provisioned: app_id=%s encrypt_pubkey=%v", provResp.AppID, provResp.AppEnvEncryptPubkey != "")

	commitResp, err := client.CommitCVMProvision(ctx, &phala.CommitCVMProvisionRequest{
		AppID:       provResp.AppID,
		ComposeHash: provResp.ComposeHash,
	})
	if err != nil {
		t.Fatalf("CommitCVMProvision: %v", err)
	}
	cvmID = commitResp.CvmID()
	if cvmID == "" {
		cvmID = provResp.AppID
	}
	t.Logf("committed: cvm_id=%s", cvmID)

	waitIdle(t, client, cvmID, 10*time.Minute)
	return cvmID, provResp.AppID, provResp.AppEnvEncryptPubkey
}

func TestE2EAllInterfaces(t *testing.T) {
	client := newE2EClient(t)
	ctx := context.Background()

	// ── 1. Read-only APIs ──

	t.Run("get_current_user", func(t *testing.T) {
		user, err := client.GetCurrentUser(ctx)
		if err != nil {
			t.Fatalf("GetCurrentUser: %v", err)
		}
		t.Logf("user: %s", user.User.Username)
	})

	t.Run("get_available_nodes", func(t *testing.T) {
		nodes, err := client.GetAvailableNodes(ctx)
		if err != nil {
			t.Fatalf("GetAvailableNodes: %v", err)
		}
		t.Logf("tier=%s nodes=%d", nodes.Tier, len(nodes.Nodes))
	})

	t.Run("get_cvm_list", func(t *testing.T) {
		list, err := client.GetCVMList(ctx, nil)
		if err != nil {
			t.Fatalf("GetCVMList: %v", err)
		}
		t.Logf("total CVMs: %d", list.Total)
	})

	var kmsID string
	t.Run("kms", func(t *testing.T) {
		kmsList, err := client.GetKMSList(ctx)
		if err != nil {
			t.Fatalf("GetKMSList: %v", err)
		}
		t.Logf("kms count: %d", len(kmsList.Items))

		if len(kmsList.Items) > 0 {
			kmsID = kmsList.Items[0].ID
			info, err := client.GetKMSInfo(ctx, kmsID)
			if err != nil {
				t.Fatalf("GetKMSInfo: %v", err)
			}
			t.Logf("kms: id=%s url=%s", info.ID, info.URL)
		}

		_, err = client.NextAppIDs(ctx)
		if err != nil {
			t.Fatalf("NextAppIDs: %v", err)
		}

		// safe call — on-chain detail may not be available
		_, _ = client.GetKMSOnChainDetail(ctx, "base")
	})

	var workspaceSlug string
	t.Run("workspaces", func(t *testing.T) {
		ws, err := client.ListWorkspaces(ctx)
		if err != nil {
			t.Fatalf("ListWorkspaces: %v", err)
		}
		t.Logf("workspaces: %v", ws)

		// Try to extract slug from the response.
		// Response format: {data: [...], pagination: {...}}
		if data, ok := (*ws)["data"]; ok {
			if items, ok := data.([]any); ok && len(items) > 0 {
				if item, ok := items[0].(map[string]any); ok {
					if slug, ok := item["slug"].(string); ok && slug != "" {
						workspaceSlug = slug
					}
				}
			}
		}

		if workspaceSlug != "" {
			_, err = client.GetWorkspace(ctx, workspaceSlug)
			if err != nil {
				t.Logf("GetWorkspace: %v (may be expected)", err)
			}
			_, _ = client.GetWorkspaceNodes(ctx, workspaceSlug, nil)
			_, _ = client.GetWorkspaceQuotas(ctx, workspaceSlug)
		}
	})

	t.Run("instance_types", func(t *testing.T) {
		families, err := client.ListAllInstanceTypeFamilies(ctx)
		if err != nil {
			t.Fatalf("ListAllInstanceTypeFamilies: %v", err)
		}
		t.Logf("instance type families: %v", families)

		_, _ = client.ListFamilyInstanceTypes(ctx, "tdx")
	})

	t.Run("ssh_keys", func(t *testing.T) {
		keys, err := client.ListSSHKeys(ctx)
		if err != nil {
			t.Fatalf("ListSSHKeys: %v", err)
		}
		t.Logf("ssh keys: %d", len(keys))

		// Create and delete a test key (generate a real ed25519 key).
		_, privKey, _ := ed25519.GenerateKey(rand.Reader)
		sshPub, _ := ssh.NewPublicKey(privKey.Public())
		pubKeyStr := strings.TrimSpace(string(ssh.MarshalAuthorizedKey(sshPub))) + " e2e-test"
		created, err := client.CreateSSHKey(ctx, &phala.CreateSSHKeyRequest{
			Name:      "e2e-test-" + hex.EncodeToString([]byte(genCVMName())[:4]),
			PublicKey: pubKeyStr,
		})
		if err != nil {
			t.Logf("CreateSSHKey: %v (may already exist)", err)
		} else {
			t.Logf("created ssh key: %s", created.ID)
			if err := client.DeleteSSHKey(ctx, created.ID); err != nil {
				t.Logf("DeleteSSHKey: %v", err)
			}
		}
	})

	t.Run("os_images", func(t *testing.T) {
		imgs, err := client.GetOSImages(ctx)
		if err != nil {
			t.Fatalf("GetOSImages: %v", err)
		}
		t.Logf("os images: %d", len(imgs.Items))
	})

	t.Run("app_list", func(t *testing.T) {
		apps, err := client.GetAppList(ctx)
		if err != nil {
			t.Fatalf("GetAppList: %v", err)
		}
		t.Logf("apps: %d", apps.Total)

		_, _ = client.GetAppFilterOptions(ctx)
	})

	// ── 2. Deploy CVM ──

	cvmID, appID, encryptPubkey := deploy(t, client)
	defer func() {
		t.Log("cleaning up: deleting CVM")
		_ = client.DeleteCVM(context.Background(), cvmID)
	}()

	// ── 3. CVM reads ──

	t.Run("cvm_reads", func(t *testing.T) {
		info, err := client.GetCVMInfo(ctx, cvmID)
		if err != nil {
			t.Fatalf("GetCVMInfo: %v", err)
		}
		t.Logf("cvm status: %s", info.Status)

		_, err = client.GetCVMComposeFile(ctx, cvmID)
		if err != nil {
			t.Logf("GetCVMComposeFile: %v", err)
		}

		_, err = client.GetCVMPreLaunchScript(ctx, cvmID)
		if err != nil {
			t.Logf("GetCVMPreLaunchScript: %v", err)
		}

		_, _ = client.GetCVMState(ctx, cvmID)
		_, _ = client.GetCVMStats(ctx, cvmID)
		_, _ = client.GetCVMNetwork(ctx, cvmID)
		_, _ = client.GetCVMDockerCompose(ctx, cvmID)
		_, _ = client.GetCVMContainersStats(ctx, cvmID)
		_, _ = client.GetCVMAttestation(ctx, cvmID)
		_, _ = client.GetCVMUserConfig(ctx, cvmID)
		_, _ = client.GetAvailableOSImages(ctx, cvmID)

		if info.VMUUID != nil {
			_, _ = client.GetCVMStatusBatch(ctx, []string{*info.VMUUID})
		}
	})

	// ── 4. App reads ──

	t.Run("app_reads", func(t *testing.T) {
		if appID == "" {
			t.Skip("no app_id")
		}

		appInfo, err := client.GetAppInfo(ctx, appID)
		if err != nil {
			t.Fatalf("GetAppInfo: %v", err)
		}
		t.Logf("app: %s", appInfo.Name)

		_, _ = client.GetAppCVMs(ctx, appID)

		revisions, err := client.GetAppRevisions(ctx, appID, nil)
		if err != nil {
			t.Logf("GetAppRevisions: %v", err)
		} else if len(revisions.Revisions) > 0 {
			revID := revisions.Revisions[0].RevisionID
			_, _ = client.GetAppRevisionDetail(ctx, appID, revID)
		}

		_, _ = client.GetAppAttestation(ctx, appID)
		_, _ = client.GetAppDeviceAllowlist(ctx, appID)
		_, _ = client.GetAppEnvEncryptPubKey(ctx, "phala", appID)
	})

	// ── 5. Watch SSE ──

	t.Run("watch_cvm_state", func(t *testing.T) {
		state, err := client.GetCVMState(ctx, cvmID)
		if err != nil {
			t.Fatalf("GetCVMState: %v", err)
		}
		status, _ := (*state)["status"].(string)
		if status == "" {
			t.Skip("no status available")
		}

		watchCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
		defer cancel()

		ch, err := client.WatchCVMState(watchCtx, cvmID, &phala.WatchCVMStateOptions{
			Target:     status,
			Timeout:    20,
			MaxRetries: phala.Int(0),
		})
		if err != nil {
			t.Fatalf("WatchCVMState: %v", err)
		}

		for evt := range ch {
			t.Logf("SSE event: %s", evt.Event)
			if evt.Error != nil {
				t.Logf("SSE error: %v", evt.Error)
			}
		}
	})

	// ── 6. CVM mutations ──

	t.Run("mutations", func(t *testing.T) {
		assertIdle(t, client, cvmID, "before mutations")

		// Visibility
		_, err := client.UpdateCVMVisibility(ctx, cvmID, &phala.UpdateVisibilityRequest{
			PublicSysinfo: phala.Bool(true),
			PublicLogs:    phala.Bool(true),
		})
		if err != nil {
			t.Fatalf("UpdateCVMVisibility: %v", err)
		}
		waitIdle(t, client, cvmID, 5*time.Minute)

		// Docker compose
		_, err = client.UpdateDockerCompose(ctx, cvmID, testCompose, nil)
		if err != nil {
			t.Logf("UpdateDockerCompose: %v", err)
		}
		waitIdle(t, client, cvmID, 5*time.Minute)

		// Pre-launch script
		_, err = client.UpdatePreLaunchScript(ctx, cvmID, "#!/bin/sh\ntrue", nil)
		if err != nil {
			t.Logf("UpdatePreLaunchScript: %v", err)
		}
		waitIdle(t, client, cvmID, 5*time.Minute)

		// Refresh instance ID
		_, err = client.RefreshCVMInstanceID(ctx, cvmID, nil)
		if err != nil {
			t.Logf("RefreshCVMInstanceID: %v", err)
		}

		_, err = client.RefreshCVMInstanceIDs(ctx, nil)
		if err != nil {
			t.Logf("RefreshCVMInstanceIDs: %v", err)
		}

		// UpdateCVMEnvs (requires encryption)
		if encryptPubkey != "" {
			assertIdle(t, client, cvmID, "before update_cvm_envs")
			encrypted := encryptEnvVars(t, encryptPubkey, map[string]string{"E2E_TEST": "1"})
			_, err = client.UpdateCVMEnvs(ctx, cvmID, &phala.UpdateEnvsRequest{
				EncryptedEnv: encrypted,
			})
			if err != nil {
				t.Logf("UpdateCVMEnvs: %v", err)
			}
			waitIdle(t, client, cvmID, 5*time.Minute)
		} else {
			t.Log("[skip] UpdateCVMEnvs: no encrypt_pubkey from provision")
		}
	})

	// ── 7. Lifecycle ──

	t.Run("lifecycle", func(t *testing.T) {
		assertIdle(t, client, cvmID, "before lifecycle")

		// Restart
		_, err := client.RestartCVM(ctx, cvmID, nil)
		if err != nil {
			t.Fatalf("RestartCVM: %v", err)
		}
		waitIdle(t, client, cvmID, 10*time.Minute)
		info, _ := client.GetCVMInfo(ctx, cvmID)
		t.Logf("after restart: status=%s", info.Status)

		// Stop
		_, err = client.StopCVM(ctx, cvmID)
		if err != nil {
			t.Fatalf("StopCVM: %v", err)
		}
		waitIdle(t, client, cvmID, 10*time.Minute)

		// Start
		_, err = client.StartCVM(ctx, cvmID)
		if err != nil {
			t.Fatalf("StartCVM: %v", err)
		}
		waitIdle(t, client, cvmID, 10*time.Minute)
		info, _ = client.GetCVMInfo(ctx, cvmID)
		t.Logf("after start: status=%s", info.Status)

		// Shutdown
		_, err = client.ShutdownCVM(ctx, cvmID)
		if err != nil {
			t.Fatalf("ShutdownCVM: %v", err)
		}
		waitIdle(t, client, cvmID, 10*time.Minute)
	})

	// ── 8. Patch CVM ──

	t.Run("patch_cvm", func(t *testing.T) {
		// Start CVM back up for patching.
		_, err := client.StartCVM(ctx, cvmID)
		if err != nil {
			t.Logf("StartCVM for patch: %v", err)
		}
		waitIdle(t, client, cvmID, 10*time.Minute)

		// Visibility-only patch
		_, err = client.PatchCVM(ctx, cvmID, &phala.PatchCVMRequest{
			PublicSysinfo: phala.Bool(true),
			PublicLogs:    phala.Bool(true),
		})
		if err != nil {
			t.Logf("PatchCVM visibility: %v", err)
		}
		waitIdle(t, client, cvmID, 10*time.Minute)

		// Docker compose patch
		compose := testCompose
		_, err = client.PatchCVM(ctx, cvmID, &phala.PatchCVMRequest{
			DockerComposeFile: &compose,
		})
		if err != nil {
			t.Logf("PatchCVM docker_compose: %v", err)
		}
		waitIdle(t, client, cvmID, 10*time.Minute)

		// Pre-launch script patch
		script := "#!/bin/sh\ntrue"
		_, err = client.PatchCVM(ctx, cvmID, &phala.PatchCVMRequest{
			PreLaunchScript: &script,
		})
		if err != nil {
			t.Logf("PatchCVM pre_launch_script: %v", err)
		}
		waitIdle(t, client, cvmID, 10*time.Minute)

		// Multi-field patch
		_, err = client.PatchCVM(ctx, cvmID, &phala.PatchCVMRequest{
			PublicSysinfo:     phala.Bool(true),
			DockerComposeFile: &compose,
		})
		if err != nil {
			t.Logf("PatchCVM multi-field: %v", err)
		}
		waitIdle(t, client, cvmID, 10*time.Minute)

		// Verify
		info, err := client.GetCVMInfo(ctx, cvmID)
		if err != nil {
			t.Fatalf("GetCVMInfo after patch: %v", err)
		}
		t.Logf("after patches: status=%s public_sysinfo=%v", info.Status, info.PublicSysinfo)
	})
}

func TestE2EPatchCVM(t *testing.T) {
	client := newE2EClient(t)
	ctx := context.Background()

	cvmID, _, encryptPubkey := deploy(t, client)
	defer func() {
		_ = client.DeleteCVM(context.Background(), cvmID)
	}()

	tests := []struct {
		name  string
		patch *phala.PatchCVMRequest
		skip  bool
	}{
		{
			name: "visibility_only",
			patch: &phala.PatchCVMRequest{
				PublicSysinfo: phala.Bool(true),
				PublicLogs:    phala.Bool(true),
			},
		},
		{
			name: "docker_compose",
			patch: func() *phala.PatchCVMRequest {
				c := testCompose
				return &phala.PatchCVMRequest{DockerComposeFile: &c}
			}(),
		},
		{
			name: "pre_launch_script",
			patch: func() *phala.PatchCVMRequest {
				s := "#!/bin/sh\ntrue"
				return &phala.PatchCVMRequest{PreLaunchScript: &s}
			}(),
		},
		{
			name: "encrypted_env",
			patch: func() *phala.PatchCVMRequest {
				if encryptPubkey == "" {
					return nil
				}
				// Can't call t.Helper() from here; encryption is done in test body.
				return nil
			}(),
			skip: encryptPubkey == "",
		},
		{
			name: "multi_field",
			patch: func() *phala.PatchCVMRequest {
				c := testCompose
				return &phala.PatchCVMRequest{
					PublicSysinfo:     phala.Bool(true),
					DockerComposeFile: &c,
				}
			}(),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.skip {
				t.Skip("no encrypt_pubkey from provision")
			}

			assertIdle(t, client, cvmID, fmt.Sprintf("before %s", tt.name))

			patch := tt.patch
			// Build encrypted_env patch dynamically (needs *testing.T for encryptEnvVars).
			if tt.name == "encrypted_env" {
				encrypted := encryptEnvVars(t, encryptPubkey, map[string]string{"E2E_TEST": "1"})
				patch = &phala.PatchCVMRequest{EncryptedEnv: &encrypted}
			}

			resp, err := client.PatchCVM(ctx, cvmID, patch)
			if err != nil {
				t.Logf("PatchCVM %s: %v", tt.name, err)
				return
			}
			t.Logf("PatchCVM %s: requires_on_chain=%v", tt.name, resp.RequiresOnChainHash)
			waitIdle(t, client, cvmID, 5*time.Minute)
		})
	}
}
