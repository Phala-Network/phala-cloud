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

func TestGetMrConfigId(t *testing.T) {
	// Test vectors match dstack-types/src/mr_config.rs and the JS SDK tests.
	// compose_hash = 0x00..1f, app_id = 0x00..13, kp=kms(2), kp_id=0xaabbccdd
	var composeHash [32]byte
	for i := range composeHash {
		composeHash[i] = byte(i)
	}
	var appID [20]byte
	for i := range appID {
		appID[i] = byte(i)
	}

	t.Run("V2 kms with key_provider_id", func(t *testing.T) {
		result, err := GetMrConfigId(MrConfigIdInput{
			ComposeHash:     composeHash,
			AppID:           appID,
			KeyProviderType: KeyProviderKMS,
			KeyProviderID:   []byte{0xaa, 0xbb, 0xcc, 0xdd},
		})
		if err != nil {
			t.Fatal(err)
		}
		got := "0x" + hex.EncodeToString(result[:])
		want := "0x02e472ed80a08042f044ba63b53b798e98e3ea5219cd078007b1ac8b3dfc762b94000000000000000000000000000000"
		if got != want {
			t.Fatalf("V2 kms:\n got  %s\n want %s", got, want)
		}
	})

	t.Run("V2 none with empty key_provider_id", func(t *testing.T) {
		result, err := GetMrConfigId(MrConfigIdInput{
			ComposeHash:     composeHash,
			AppID:           appID,
			KeyProviderType: KeyProviderNone,
			KeyProviderID:   nil,
		})
		if err != nil {
			t.Fatal(err)
		}
		got := "0x" + hex.EncodeToString(result[:])
		want := "0x02b21a3a65891c2c3955d82000b30fab13f4adc1a12dc4a84793ea322b71f1882a000000000000000000000000000000"
		if got != want {
			t.Fatalf("V2 none:\n got  %s\n want %s", got, want)
		}
	})

	t.Run("V1", func(t *testing.T) {
		result := GetMrConfigIdV1(composeHash)
		got := "0x" + hex.EncodeToString(result[:])
		want := "0x01000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f000000000000000000000000000000"
		if got != want {
			t.Fatalf("V1:\n got  %s\n want %s", got, want)
		}
	})

	t.Run("hex convenience wrapper", func(t *testing.T) {
		got, err := GetMrConfigIdHex(
			"0x000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
			"0x000102030405060708090a0b0c0d0e0f10111213",
			KeyProviderKMS,
			"aabbccdd",
		)
		if err != nil {
			t.Fatal(err)
		}
		want := "0x02e472ed80a08042f044ba63b53b798e98e3ea5219cd078007b1ac8b3dfc762b94000000000000000000000000000000"
		if got != want {
			t.Fatalf("hex wrapper:\n got  %s\n want %s", got, want)
		}
	})

	t.Run("verify", func(t *testing.T) {
		ok, err := VerifyMrConfigId(
			"0x02e472ed80a08042f044ba63b53b798e98e3ea5219cd078007b1ac8b3dfc762b94000000000000000000000000000000",
			"0x000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
			"0x000102030405060708090a0b0c0d0e0f10111213",
			KeyProviderKMS,
			"aabbccdd",
		)
		if err != nil {
			t.Fatal(err)
		}
		if !ok {
			t.Fatal("expected verify to pass")
		}
	})
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
