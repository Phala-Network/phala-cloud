package phala

import (
	"context"
	"net/http"
	"reflect"
	"testing"
)

func TestProvisionCVMSendsTheNewCreateFields(t *testing.T) {
	client, seen := recordingServer(t, http.StatusOK, `{"app_id":"app-1","compose_hash":"abc","token":"tok-1"}`)
	raw := `{"name":"raw","runner":"bash","bash_script":"echo hi"}`
	_, err := client.ProvisionCVM(context.Background(), &ProvisionCVMRequest{
		Name:                "my-app",
		ComposeFileRaw:      &raw,
		InitScripts:         []InitScriptSlug{InitScriptDockerCleanup, InitScriptEnvMerge},
		GenerateLaunchToken: Bool(true),
		Annotations:         map[string]string{"memory_tier": "fast"},
	})
	if err != nil {
		t.Fatalf("ProvisionCVM: %v", err)
	}
	assertBody(t, (*seen)[0].body, `{
		"name": "my-app",
		"compose_file_raw": "{\"name\":\"raw\",\"runner\":\"bash\",\"bash_script\":\"echo hi\"}",
		"init_scripts": ["docker_cleanup", "env_merge"],
		"generate_launch_token": true,
		"annotations": {"memory_tier": "fast"}
	}`)
}

func TestProvisionCVMSendsAnInitScriptNameItDoesNotKnow(t *testing.T) {
	client, seen := recordingServer(t, http.StatusOK, `{"app_id":"app-1","compose_hash":"abc"}`)
	_, err := client.ProvisionCVM(context.Background(), &ProvisionCVMRequest{
		Name:        "my-app",
		InitScripts: []InitScriptSlug{"future_script"},
	})
	if err != nil {
		t.Fatalf("ProvisionCVM: %v", err)
	}
	assertBody(t, (*seen)[0].body, `{"name": "my-app", "init_scripts": ["future_script"]}`)
}

func TestProvisionCVMSendsACallerLaunchTokenAndRunner(t *testing.T) {
	client, seen := recordingServer(t, http.StatusOK, `{"app_id":"app-1","compose_hash":"abc"}`)
	token := "0123456789abcdef0123456789abcdef"
	runner := ComposeRunnerNerdctlCompose
	_, err := client.ProvisionCVM(context.Background(), &ProvisionCVMRequest{
		Name:        "my-app",
		ComposeFile: &ComposeFile{Name: "my-app", DockerComposeFile: "services: {}", Runner: &runner},
		LaunchToken: &token,
	})
	if err != nil {
		t.Fatalf("ProvisionCVM: %v", err)
	}
	assertBody(t, (*seen)[0].body, `{
		"name": "my-app",
		"compose_file": {"name": "my-app", "docker_compose_file": "services: {}", "runner": "nerdctl-compose"},
		"launch_token": "0123456789abcdef0123456789abcdef"
	}`)
}

func TestProvisionCVMSendsGuestAgentGatewayAccess(t *testing.T) {
	client, seen := recordingServer(t, http.StatusOK, `{"app_id":"app-1","compose_hash":"abc"}`)
	closed := "closed"
	_, err := client.ProvisionCVM(context.Background(), &ProvisionCVMRequest{
		Name:                    "my-app",
		GuestAgentGatewayAccess: &closed,
	})
	if err != nil {
		t.Fatalf("ProvisionCVM: %v", err)
	}
	assertBody(t, (*seen)[0].body, `{"name": "my-app", "guest_agent_gateway_access": "closed"}`)
}

func TestCommitCVMProvisionSendsContractFields(t *testing.T) {
	client, seen := recordingServer(t, http.StatusOK, `{"id":"cvm_1","name":"my-app","status":"starting"}`)
	kmsID := "kms_1"
	contract := "0xabc"
	deployer := "0xdef"
	_, err := client.CommitCVMProvision(context.Background(), &CommitCVMProvisionRequest{
		AppID:           "app-1",
		ComposeHash:     "abc",
		KMSID:           &kmsID,
		ContractAddress: &contract,
		DeployerAddress: &deployer,
	})
	if err != nil {
		t.Fatalf("CommitCVMProvision: %v", err)
	}
	if r := (*seen)[0]; r.method != "POST" || r.path != "/cvms" {
		t.Fatalf("request = %s %s", r.method, r.path)
	}
	assertBody(t, (*seen)[0].body, `{
		"app_id": "app-1",
		"compose_hash": "abc",
		"kms_id": "kms_1",
		"contract_address": "0xabc",
		"deployer_address": "0xdef"
	}`)
}

func TestProvisionCVMRequestOmitsFieldsTheCreateAPIDoesNotRead(t *testing.T) {
	typ := reflect.TypeOf(ProvisionCVMRequest{})
	for _, name := range []string{"KMSType", "Encrypted", "SecureTime", "SSHAuthorizedKeys", "CustomAppID", "StorageFS"} {
		if _, ok := typ.FieldByName(name); ok {
			t.Errorf("ProvisionCVMRequest still has %s, which POST /cvms does not read", name)
		}
	}
}

func TestCommitCVMProvisionReturnsTheIssuedLaunchToken(t *testing.T) {
	client, _ := recordingServer(t, http.StatusOK, `{"id":"cvm_1","name":"my-app","status":"starting","launch_token":"lt"}`)
	token := "tok-1"
	resp, err := client.CommitCVMProvision(context.Background(), &CommitCVMProvisionRequest{Token: &token})
	if err != nil {
		t.Fatalf("CommitCVMProvision: %v", err)
	}
	if resp.LaunchToken != "lt" {
		t.Fatalf("LaunchToken = %q, want lt", resp.LaunchToken)
	}
}
