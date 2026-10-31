package phala

import "testing"

func TestComposeHashDefaultNormalization(t *testing.T) {
	c := AppCompose{Runner: "docker-compose", Name: "example", DockerComposeFile: "services: {}", BashScript: "ignored"}
	normalized, err := GetComposeHashFromMap(map[string]any{"runner": "docker-compose", "name": "example", "docker_compose_file": "services: {}", "bash_script": "ignored"})
	if err != nil {
		t.Fatal(err)
	}
	got, err := GetComposeHash(c)
	if err != nil {
		t.Fatal(err)
	}
	if got != normalized {
		t.Fatalf("default hash %s, want %s", got, normalized)
	}
	raw, err := GetComposeHash(c, false)
	if err != nil {
		t.Fatal(err)
	}
	if raw == normalized {
		t.Fatal("explicit false must preserve the raw compose")
	}
}
