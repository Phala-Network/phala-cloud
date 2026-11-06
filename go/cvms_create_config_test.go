package phala

import (
	"context"
	"net/http"
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
