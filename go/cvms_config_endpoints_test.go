package phala

import (
	"context"
	"net/http"
	"reflect"
	"strings"
	"testing"
)

func TestGetCVMAnnotations(t *testing.T) {
	client, seen := recordingServer(t, http.StatusOK, `{"annotations":{"tier":"fast"}}`)
	got, err := client.GetCVMAnnotations(context.Background(), "cvm-1")
	if err != nil {
		t.Fatal(err)
	}
	if r := (*seen)[0]; r.method != "GET" || r.path != "/cvms/cvm-1/annotations" {
		t.Fatalf("request = %s %s", r.method, r.path)
	}
	if !reflect.DeepEqual(got.Annotations, map[string]string{"tier": "fast"}) {
		t.Fatalf("annotations = %v", got.Annotations)
	}
}

func TestUpdateCVMAnnotationsSendsAnEmptyMapToClear(t *testing.T) {
	client, seen := recordingServer(t, http.StatusOK, `{"annotations":{}}`)
	got, err := client.UpdateCVMAnnotations(context.Background(), "cvm-1", map[string]string{})
	if err != nil {
		t.Fatal(err)
	}
	r := (*seen)[0]
	if r.method != "PUT" || r.path != "/cvms/cvm-1/annotations" {
		t.Fatalf("request = %s %s", r.method, r.path)
	}
	assertBody(t, r.body, `{"annotations": {}}`)
	if got.Annotations == nil || len(got.Annotations) != 0 {
		t.Fatalf("annotations = %v", got.Annotations)
	}
}

func TestSetAppLaunchTokenLetsTheAPIGenerateOne(t *testing.T) {
	hash := strings.Repeat("ab", 32)
	client, seen := recordingServer(t, http.StatusOK, `{"launch_token":"tok","launch_token_hash":"`+hash+`"}`)
	got, err := client.SetAppLaunchToken(context.Background(), "abc123", nil)
	if err != nil {
		t.Fatal(err)
	}
	r := (*seen)[0]
	if r.method != "POST" || r.path != "/apps/abc123/launch-token" {
		t.Fatalf("request = %s %s", r.method, r.path)
	}
	assertBody(t, r.body, `{}`)
	if got.LaunchToken != "tok" || got.LaunchTokenHash != hash {
		t.Fatalf("resp = %+v", got)
	}
}

func TestSetAppLaunchTokenSendsACallerToken(t *testing.T) {
	client, seen := recordingServer(t, http.StatusOK, `{"launch_token":"x","launch_token_hash":"y"}`)
	token := strings.Repeat("t", 32)
	if _, err := client.SetAppLaunchToken(context.Background(), "abc123", &SetAppLaunchTokenRequest{LaunchToken: &token}); err != nil {
		t.Fatal(err)
	}
	assertBody(t, (*seen)[0].body, `{"launch_token": "`+token+`"}`)
}

func TestClearAppLaunchToken(t *testing.T) {
	client, seen := recordingServer(t, http.StatusNoContent, ``)
	if err := client.ClearAppLaunchToken(context.Background(), "abc123"); err != nil {
		t.Fatal(err)
	}
	if r := (*seen)[0]; r.method != "DELETE" || r.path != "/apps/abc123/launch-token" {
		t.Fatalf("request = %s %s", r.method, r.path)
	}
}

func TestGetCVMInitScripts(t *testing.T) {
	client, seen := recordingServer(t, http.StatusOK, `{"items":[
		{"slug":"docker_cleanup","selected":true,"selectable":true,"reason":null},
		{"slug":"env_merge","selected":false,"selectable":false,"reason":"not enabled"}
	]}`)
	got, err := client.GetCVMInitScripts(context.Background(), "cvm-1")
	if err != nil {
		t.Fatal(err)
	}
	if r := (*seen)[0]; r.method != "GET" || r.path != "/cvms/cvm-1/init-scripts" {
		t.Fatalf("request = %s %s", r.method, r.path)
	}
	reason := "not enabled"
	want := []CVMInitScript{
		{Slug: InitScriptDockerCleanup, Selected: true, Selectable: true},
		{Slug: InitScriptEnvMerge, Reason: &reason},
	}
	if !reflect.DeepEqual(got.Items, want) {
		t.Fatalf("items = %+v", got.Items)
	}
}
