package phala

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"testing"

	"golang.org/x/crypto/curve25519"
)

func TestEncryptEnvVars(t *testing.T) {
	remotePriv := make([]byte, 32)
	if _, err := rand.Read(remotePriv); err != nil {
		t.Fatal(err)
	}
	remotePub, err := curve25519.X25519(remotePriv, curve25519.Basepoint)
	if err != nil {
		t.Fatal(err)
	}

	envs := []EnvVar{
		{Key: "NODE_ENV", Value: "production"},
		{Key: "MESSAGE", Value: "Hello world"},
	}

	encryptedHex, err := EncryptEnvVars(envs, hex.EncodeToString(remotePub))
	if err != nil {
		t.Fatal(err)
	}

	encrypted, err := hex.DecodeString(encryptedHex)
	if err != nil {
		t.Fatal(err)
	}
	if len(encrypted) <= 44 {
		t.Fatalf("expected encrypted payload > 44 bytes, got %d", len(encrypted))
	}

	ephemeralPub := encrypted[:32]
	iv := encrypted[32:44]
	ciphertext := encrypted[44:]

	sharedSecret, err := curve25519.X25519(remotePriv, ephemeralPub)
	if err != nil {
		t.Fatal(err)
	}

	block, err := aes.NewCipher(sharedSecret)
	if err != nil {
		t.Fatal(err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		t.Fatal(err)
	}

	plaintext, err := gcm.Open(nil, iv, ciphertext, nil)
	if err != nil {
		t.Fatal(err)
	}

	var payload struct {
		Env []EnvVar `json:"env"`
	}
	if err := json.Unmarshal(plaintext, &payload); err != nil {
		t.Fatal(err)
	}

	if len(payload.Env) != len(envs) {
		t.Fatalf("expected %d env vars, got %d", len(envs), len(payload.Env))
	}
	for i := range envs {
		if payload.Env[i] != envs[i] {
			t.Fatalf("env var mismatch at %d: expected %+v, got %+v", i, envs[i], payload.Env[i])
		}
	}
}

func TestGetComposeHash(t *testing.T) {
	got, err := GetComposeHash(AppCompose{
		Runner:            "docker-compose",
		DockerComposeFile: "services:\n  app:\n    image: nginx:latest\n",
		AllowedEnvs:       []string{"API_KEY"},
	}, true)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 64 {
		t.Fatalf("expected 64-char sha256 hex, got %q", got)
	}
}
