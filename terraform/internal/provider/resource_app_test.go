package provider

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/hashicorp/terraform-plugin-framework/types"
)

func TestAppResourceFetchAppAndCVMsReturnsReplicaListWarning(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/api/v1/apps/test":
			writeJSON(t, w, http.StatusOK, `{"app_id":"app_test","name":"demo","cvms":[]}`)
			return
		case r.Method == http.MethodGet && r.URL.Path == "/api/v1/apps/test/cvms":
			writeJSON(t, w, http.StatusServiceUnavailable, `{"message":"replica list unavailable"}`)
			return
		default:
			w.WriteHeader(http.StatusNotFound)
			_, _ = io.WriteString(w, "not found")
		}
	}))
	defer srv.Close()

	resource := &appResource{
		client: NewAPIClient(srv.URL+"/api/v1", "phat_test_key", "2026-01-21", 5*time.Second),
	}

	fetched, err := resource.fetchAppAndCVMs(context.Background(), "app_test")
	if err != nil {
		t.Fatalf("expected transient replica list failure to degrade to warning, got: %v", err)
	}
	if fetched == nil {
		t.Fatal("expected fetch result")
	}
	if fetched.ReplicaListWarning == nil {
		t.Fatal("expected replica list warning")
	}
	apiErr, ok := fetched.ReplicaListWarning.(*APIError)
	if !ok {
		t.Fatalf("expected *APIError warning, got %T: %v", fetched.ReplicaListWarning, fetched.ReplicaListWarning)
	}
	if apiErr.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("unexpected status code: got %d want %d", apiErr.StatusCode, http.StatusServiceUnavailable)
	}
	if len(fetched.CVMs) != 0 {
		t.Fatalf("expected no fresh cvm data on warning, got %#v", fetched.CVMs)
	}
}

func TestAppResourcePopulateStateKeepsUnmanagedPreLaunchScriptNull(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/api/v1/cvms/cvm123/docker-compose.yml":
			w.WriteHeader(http.StatusOK)
			_, _ = io.WriteString(w, "services:\n  app:\n")
			return
		case r.Method == http.MethodGet && r.URL.Path == "/api/v1/cvms/cvm123/pre-launch-script":
			w.WriteHeader(http.StatusOK)
			_, _ = io.WriteString(w, "#!/bin/sh\necho ready\n")
			return
		default:
			w.WriteHeader(http.StatusNotFound)
			_, _ = io.WriteString(w, "not found")
		}
	}))
	defer srv.Close()

	resource := &appResource{
		client: NewAPIClient(srv.URL+"/api/v1", "phat_test_key", "2026-01-21", 5*time.Second),
	}

	state := appResourceModel{
		ID:              types.StringValue("app_test"),
		DockerCompose:   types.StringNull(),
		PreLaunchScript: types.StringNull(),
		Replicas:        types.Int64Null(),
	}
	app := &appAPIResponse{
		AppID: "app_test",
		Name:  "demo",
	}
	cvms := []cvmAPIResponse{{
		VMUUID: "cvm123",
		Status: "running",
	}}

	diags := resource.populateState(context.Background(), &state, app, cvms)
	if diags.HasError() {
		t.Fatalf("unexpected diagnostics: %v", diags)
	}
	if !state.PreLaunchScript.IsNull() {
		t.Fatalf("pre_launch_script should remain null when unmanaged, got %#v", state.PreLaunchScript)
	}
	if state.DockerCompose.IsNull() || state.DockerCompose.ValueString() != "services:\n  app:\n" {
		t.Fatalf("docker_compose was not hydrated from API: %#v", state.DockerCompose)
	}
}

func TestAppResourcePopulateStateRefreshesManagedPreLaunchScript(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/api/v1/cvms/cvm123/pre-launch-script":
			w.WriteHeader(http.StatusOK)
			_, _ = io.WriteString(w, "#!/bin/sh\necho updated\n")
			return
		default:
			w.WriteHeader(http.StatusNotFound)
			_, _ = io.WriteString(w, "not found")
		}
	}))
	defer srv.Close()

	resource := &appResource{
		client: NewAPIClient(srv.URL+"/api/v1", "phat_test_key", "2026-01-21", 5*time.Second),
	}

	state := appResourceModel{
		ID:              types.StringValue("app_test"),
		PreLaunchScript: types.StringValue("#!/bin/sh\necho old\n"),
		Replicas:        types.Int64Null(),
	}
	app := &appAPIResponse{
		AppID: "app_test",
		Name:  "demo",
	}
	cvms := []cvmAPIResponse{{
		VMUUID: "cvm123",
		Status: "running",
	}}

	diags := resource.populateState(context.Background(), &state, app, cvms)
	if diags.HasError() {
		t.Fatalf("unexpected diagnostics: %v", diags)
	}
	if state.PreLaunchScript.IsNull() || state.PreLaunchScript.ValueString() != "#!/bin/sh\necho updated\n" {
		t.Fatalf("pre_launch_script was not refreshed from API: %#v", state.PreLaunchScript)
	}
}

func TestAppResourcePopulateStatePreservesReplicaDerivedFieldsWithoutFreshCVMs(t *testing.T) {
	ctx := context.Background()
	cvmIDs, diags := types.ListValueFrom(ctx, types.StringType, []string{"cvm-old"})
	if diags.HasError() {
		t.Fatalf("build cvm ids: %v", diags)
	}

	state := appResourceModel{
		ID:              types.StringValue("app_test"),
		AppID:           types.StringValue("app_test"),
		Name:            types.StringValue("existing"),
		DiskSize:        types.Int64Value(40),
		Status:          types.StringValue("running"),
		Endpoint:        types.StringValue("https://example"),
		PrimaryCVMID:    types.StringValue("cvm-old"),
		CVMIDs:          cvmIDs,
		Replicas:        types.Int64Value(2),
		DockerCompose:   types.StringValue("services:\n  app:\n"),
		PreLaunchScript: types.StringValue("#!/bin/sh\necho existing\n"),
	}
	app := &appAPIResponse{
		AppID: "app_test",
		Name:  "renamed",
	}

	resource := &appResource{}
	diags = resource.populateState(ctx, &state, app, nil)
	if diags.HasError() {
		t.Fatalf("unexpected diagnostics: %v", diags)
	}
	if state.Name.ValueString() != "renamed" {
		t.Fatalf("expected app-level fields to refresh, got %q", state.Name.ValueString())
	}
	if state.DiskSize.ValueInt64() != 40 {
		t.Fatalf("disk size should be preserved, got %#v", state.DiskSize)
	}
	if state.Status.ValueString() != "running" {
		t.Fatalf("status should be preserved, got %#v", state.Status)
	}
	if state.Endpoint.ValueString() != "https://example" {
		t.Fatalf("endpoint should be preserved, got %#v", state.Endpoint)
	}
	if state.PrimaryCVMID.ValueString() != "cvm-old" {
		t.Fatalf("primary_cvm_id should be preserved, got %#v", state.PrimaryCVMID)
	}
	if state.Replicas.ValueInt64() != 2 {
		t.Fatalf("replicas should be preserved, got %#v", state.Replicas)
	}
	if state.CVMIDs.IsNull() || state.CVMIDs.IsUnknown() {
		t.Fatalf("cvm_ids should be preserved, got %#v", state.CVMIDs)
	}
	var ids []string
	diags = state.CVMIDs.ElementsAs(ctx, &ids, false)
	if diags.HasError() {
		t.Fatalf("decode cvm ids: %v", diags)
	}
	if len(ids) != 1 || ids[0] != "cvm-old" {
		t.Fatalf("unexpected cvm ids: %#v", ids)
	}
}

func TestAppResourceWaitForAppReadyFailsFastOnStoppedReplica(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/api/v1/apps/test/cvms":
			writeJSON(t, w, http.StatusOK, `[{"vm_uuid":"cvm-stopped","status":"stopped","in_progress":false}]`)
			return
		default:
			w.WriteHeader(http.StatusNotFound)
			_, _ = io.WriteString(w, "not found")
		}
	}))
	defer srv.Close()

	resource := &appResource{
		client: NewAPIClient(srv.URL+"/api/v1", "phat_test_key", "2026-01-21", 5*time.Second),
	}

	err := resource.waitForAppReady(context.Background(), "app_test", 1, 2*time.Second)
	if err == nil {
		t.Fatal("expected waitForAppReady to fail on stable stopped replica")
	}
	if !strings.Contains(err.Error(), "cvm-stopped") {
		t.Fatalf("expected error to include replica id, got: %v", err)
	}
	if !strings.Contains(err.Error(), "stopped") {
		t.Fatalf("expected error to include stopped status, got: %v", err)
	}
}

func TestAppResourcePopulateStatePrefersComposeFileVisibilityFlags(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/api/v1/cvms/cvm123":
			writeJSON(t, w, http.StatusOK, `{
				"vm_uuid":"cvm123",
				"status":"running",
				"public_logs":true,
				"public_sysinfo":true,
				"public_tcbinfo":true,
				"compose_file":{
					"public_logs":false,
					"public_sysinfo":false,
					"public_tcbinfo":false,
					"storage_fs":"zfs"
				}
			}`)
			return
		default:
			w.WriteHeader(http.StatusNotFound)
			_, _ = io.WriteString(w, "not found")
		}
	}))
	defer srv.Close()

	resource := &appResource{
		client: NewAPIClient(srv.URL+"/api/v1", "phat_test_key", "2026-01-21", 5*time.Second),
	}
	state := appResourceModel{
		ID:              types.StringValue("app_test"),
		Replicas:        types.Int64Null(),
		DockerCompose:   types.StringValue("services:\n  app:\n"),
		PreLaunchScript: types.StringNull(),
	}
	trueValue := true
	app := &appAPIResponse{
		AppID: "app_test",
		Name:  "demo",
	}
	cvms := []cvmAPIResponse{{
		VMUUID:        "cvm123",
		Status:        "running",
		PublicLogs:    &trueValue,
		PublicSysinfo: &trueValue,
		PublicTCBInfo: &trueValue,
	}}

	diags := resource.populateState(context.Background(), &state, app, cvms)
	if diags.HasError() {
		t.Fatalf("unexpected diagnostics: %v", diags)
	}
	if state.PublicLogs.IsNull() || state.PublicLogs.ValueBool() {
		t.Fatalf("public_logs should prefer compose_file value, got %#v", state.PublicLogs)
	}
	if state.PublicSysinfo.IsNull() || state.PublicSysinfo.ValueBool() {
		t.Fatalf("public_sysinfo should prefer compose_file value, got %#v", state.PublicSysinfo)
	}
	if state.PublicTCBInfo.IsNull() || state.PublicTCBInfo.ValueBool() {
		t.Fatalf("public_tcbinfo should prefer compose_file value, got %#v", state.PublicTCBInfo)
	}
	if state.StorageFS.IsNull() || state.StorageFS.ValueString() != "zfs" {
		t.Fatalf("storage_fs should prefer compose_file value, got %#v", state.StorageFS)
	}
}

func TestComposeEnvKeysFromAttrs(t *testing.T) {
	t.Parallel()

	ctx := context.Background()

	t.Run("prefers_env_map", func(t *testing.T) {
		envMap, diags := types.MapValueFrom(ctx, types.StringType, map[string]string{
			"ZED": "1",
			"API": "2",
		})
		if diags.HasError() {
			t.Fatalf("build env map: %v", diags)
		}

		keys, known, diags := composeEnvKeysFromAttrs(ctx, envMap, types.ListNull(types.StringType))
		if diags.HasError() {
			t.Fatalf("unexpected diagnostics: %v", diags)
		}
		if !known {
			t.Fatal("expected env keys to be known")
		}
		if len(keys) != 2 || keys[0] != "API" || keys[1] != "ZED" {
			t.Fatalf("unexpected env keys: %#v", keys)
		}
	})

	t.Run("uses_env_keys_list", func(t *testing.T) {
		envKeys, diags := types.ListValueFrom(ctx, types.StringType, []string{"ZED", "API"})
		if diags.HasError() {
			t.Fatalf("build env_keys list: %v", diags)
		}

		keys, known, diags := composeEnvKeysFromAttrs(ctx, types.MapNull(types.StringType), envKeys)
		if diags.HasError() {
			t.Fatalf("unexpected diagnostics: %v", diags)
		}
		if !known {
			t.Fatal("expected env keys to be known")
		}
		if len(keys) != 2 || keys[0] != "API" || keys[1] != "ZED" {
			t.Fatalf("unexpected env keys: %#v", keys)
		}
	})

	t.Run("handles_explicit_empty_env", func(t *testing.T) {
		envMap, diags := types.MapValueFrom(ctx, types.StringType, map[string]string{})
		if diags.HasError() {
			t.Fatalf("build empty env map: %v", diags)
		}

		keys, known, diags := composeEnvKeysFromAttrs(ctx, envMap, types.ListNull(types.StringType))
		if diags.HasError() {
			t.Fatalf("unexpected diagnostics: %v", diags)
		}
		if !known {
			t.Fatal("expected empty env map to be treated as explicit")
		}
		if len(keys) != 0 {
			t.Fatalf("unexpected env keys: %#v", keys)
		}
	})
}
