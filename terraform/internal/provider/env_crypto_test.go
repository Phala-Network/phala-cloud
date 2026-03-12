package provider

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/ecdh"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"testing"
)

func TestEncryptEnvMapRoundTrip(t *testing.T) {
	curve := ecdh.X25519()
	receiverPriv, err := curve.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("generate receiver key: %v", err)
	}

	env := map[string]string{
		"DATABASE_URL": "postgres://user:pass@db.internal/app",
		"API_KEY":      "super-secret",
	}
	pubkeyB64 := base64.StdEncoding.EncodeToString(receiverPriv.PublicKey().Bytes())

	encryptedHex, err := encryptEnvMap(env, pubkeyB64)
	if err != nil {
		t.Fatalf("encrypt env map: %v", err)
	}

	packet, err := hex.DecodeString(encryptedHex)
	if err != nil {
		t.Fatalf("decode encrypted hex: %v", err)
	}
	// Minimum: 32 (ephemeral pub) + 12 (GCM nonce) + 16 (GCM tag) + 1 (ciphertext) = 61
	if len(packet) < 61 {
		t.Fatalf("encrypted packet too short: got %d, minimum valid is 61", len(packet))
	}

	ephemeralPubBytes := packet[:32]
	nonce := packet[32:44]
	ciphertext := packet[44:]

	ephemeralPub, err := curve.NewPublicKey(ephemeralPubBytes)
	if err != nil {
		t.Fatalf("parse ephemeral public key: %v", err)
	}
	sharedSecret, err := receiverPriv.ECDH(ephemeralPub)
	if err != nil {
		t.Fatalf("derive shared secret: %v", err)
	}

	block, err := aes.NewCipher(sharedSecret[:32])
	if err != nil {
		t.Fatalf("create AES cipher: %v", err)
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		t.Fatalf("create AES-GCM: %v", err)
	}

	plaintext, err := aead.Open(nil, nonce, ciphertext, ephemeralPubBytes)
	if err != nil {
		t.Fatalf("decrypt payload: %v", err)
	}

	var payload struct {
		Env map[string]string `json:"env"`
	}
	if err := json.Unmarshal(plaintext, &payload); err != nil {
		t.Fatalf("unmarshal decrypted JSON: %v", err)
	}

	if len(payload.Env) != len(env) {
		t.Fatalf("unexpected env count: got %d want %d", len(payload.Env), len(env))
	}
	for k, want := range env {
		got, ok := payload.Env[k]
		if !ok {
			t.Fatalf("missing env key %q", k)
		}
		if got != want {
			t.Fatalf("unexpected env value for %q: got %q want %q", k, got, want)
		}
	}
}

func TestEncryptEnvMapInvalidPublicKey(t *testing.T) {
	t.Run("invalid base64", func(t *testing.T) {
		_, err := encryptEnvMap(map[string]string{"A": "1"}, "%%%not-base64%%%")
		if err == nil {
			t.Fatal("expected error for invalid base64 key")
		}
	})

	t.Run("wrong key length", func(t *testing.T) {
		short := base64.StdEncoding.EncodeToString([]byte{1, 2, 3})
		_, err := encryptEnvMap(map[string]string{"A": "1"}, short)
		if err == nil {
			t.Fatal("expected error for invalid key length")
		}
	})
}

func TestEncryptEnvMapAcceptsHexPublicKey(t *testing.T) {
	curve := ecdh.X25519()
	receiverPriv, err := curve.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("generate receiver key: %v", err)
	}

	pubHex := hex.EncodeToString(receiverPriv.PublicKey().Bytes())
	_, err = encryptEnvMap(map[string]string{"A": "1"}, pubHex)
	if err != nil {
		t.Fatalf("expected hex public key to work, got error: %v", err)
	}
}
