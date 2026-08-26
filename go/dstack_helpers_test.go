package phala

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"strings"
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

	t.Run("KMS CA pubkey vector", func(t *testing.T) {
		got, err := GetMrConfigIdHex(
			"4f475ed201ac079f2e4760fb7554763edcc97c48132d554666a2ec3fd2c9e099",
			"8d8f406cf93e1cf54207fbf99c9bc437dd4d6aef",
			KeyProviderKMS,
			"3059301306072a8648ce3d020106082a8648ce3d030107034200048844eb42ccdf8c52fd4f174f362fcb9bbd19c45fd48f1edec2d8f1ca23536ec1a74021b4cee610c074f8294d431b2b7fee2c39e5333fdaf0a4522d43fb159d9f",
		)
		if err != nil {
			t.Fatal(err)
		}
		want := "0x02dd0db3893b8c47b5e4098d7630d22959a1423af536890d10aaf3f0a7b169921b000000000000000000000000000000"
		if got != want {
			t.Fatalf("KMS CA pubkey vector:\n got  %s\n want %s", got, want)
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

// ---------------------------------------------------------------------------
// MrConfigV3
//
// Every vector below was printed by dstack itself, not by this implementation:
// a scratch crate with a path dependency on dstack/dstack-types (at
// origin/next) built each document with MrConfigV3::new(...) and printed
// to_canonical_json(), to_tdx_mr_config_id() and to_snp_host_data().
// The same six vectors are pinned in the JS and Python suites.
// ---------------------------------------------------------------------------

const (
	v3AppID             = "1111111111111111111111111111111111111111"
	v3ComposeHash       = "2222222222222222222222222222222222222222222222222222222222222222"
	v3KmsKeyProviderID  = "3333333333333333333333333333333333333333333333333333333333333333"
	v3InstanceID        = "4444444444444444444444444444444444444444"
	v3DefaultGpuPolicy  = "44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a"
	v3Padding           = "000000000000000000000000000000"
	v3KmsWithInstanceID = "0350fc88d0a462b6a0b06ba25859abc02e98c2a8d9bd000b7dc0d8bae65e71ecbb" + v3Padding
)

func mustBuildV3(t *testing.T, input MrConfigV3Input) MrConfigV3Document {
	t.Helper()
	document, err := BuildMrConfigV3Document(input)
	if err != nil {
		t.Fatalf("BuildMrConfigV3Document: %v", err)
	}
	return document
}

func assertV3(t *testing.T, document MrConfigV3Document, wantJSON, wantID, wantHostData string) {
	t.Helper()
	if got := CanonicalizeMrConfigV3Document(document); got != wantJSON {
		t.Errorf("canonical JSON\n got: %s\nwant: %s", got, wantJSON)
	}
	id := GetMrConfigIdV3(document)
	if got := hex.EncodeToString(id[:]); got != wantID {
		t.Errorf("tdx mr_config_id\n got: %s\nwant: %s", got, wantID)
	}
	hostData := GetSnpHostDataV3(document)
	if got := hex.EncodeToString(hostData[:]); got != wantHostData {
		t.Errorf("snp host_data\n got: %s\nwant: %s", got, wantHostData)
	}
}

func TestMrConfigV3KmsWithInstanceID(t *testing.T) {
	document := mustBuildV3(t, MrConfigV3Input{
		AppID:         v3AppID,
		ComposeHash:   v3ComposeHash,
		KeyProvider:   KeyProviderKMS,
		KeyProviderID: v3KmsKeyProviderID,
		InstanceID:    v3InstanceID,
	})
	assertV3(t, document,
		`{"app_id":"`+v3AppID+`","compose_hash":"`+v3ComposeHash+`","instance_id":"`+v3InstanceID+
			`","key_provider":"kms","key_provider_id":"`+v3KmsKeyProviderID+`","version":3}`,
		v3KmsWithInstanceID,
		"50fc88d0a462b6a0b06ba25859abc02e98c2a8d9bd000b7dc0d8bae65e71ecbb",
	)
}

func TestMrConfigV3BindsGpuPolicyHash(t *testing.T) {
	document := mustBuildV3(t, MrConfigV3Input{
		AppID:         v3AppID,
		ComposeHash:   v3ComposeHash,
		GpuPolicyHash: v3DefaultGpuPolicy,
		KeyProvider:   KeyProviderKMS,
		KeyProviderID: v3KmsKeyProviderID,
		InstanceID:    v3InstanceID,
	})
	assertV3(t, document,
		`{"app_id":"`+v3AppID+`","compose_hash":"`+v3ComposeHash+`","gpu_policy_hash":"`+v3DefaultGpuPolicy+
			`","instance_id":"`+v3InstanceID+`","key_provider":"kms","key_provider_id":"`+v3KmsKeyProviderID+
			`","version":3}`,
		"03893655c09844af05adb4d67af5917998038afe711bdcd3a3ec1dbd94ad272b85"+v3Padding,
		"893655c09844af05adb4d67af5917998038afe711bdcd3a3ec1dbd94ad272b85",
	)
}

func TestMrConfigV3BindsOrderedInitScriptHashes(t *testing.T) {
	document := mustBuildV3(t, MrConfigV3Input{
		AppID:            v3AppID,
		ComposeHash:      v3ComposeHash,
		KeyProvider:      KeyProviderLocal,
		KeyProviderID:    "5555555555555555555555555555555555555555",
		InstanceID:       v3InstanceID,
		InitScriptHashes: []string{strings.Repeat("aa", 32), strings.Repeat("bb", 32)},
	})
	assertV3(t, document,
		`{"app_id":"`+v3AppID+`","compose_hash":"`+v3ComposeHash+
			`","init_script_hashes":["`+strings.Repeat("aa", 32)+`","`+strings.Repeat("bb", 32)+
			`"],"instance_id":"`+v3InstanceID+
			`","key_provider":"local","key_provider_id":"5555555555555555555555555555555555555555","version":3}`,
		"039af46bdc5deb1ea74f2c77b4f83165f1f3e4e37e3ce15462b5fee0d235912390"+v3Padding,
		"9af46bdc5deb1ea74f2c77b4f83165f1f3e4e37e3ce15462b5fee0d235912390",
	)
}

func TestMrConfigV3EmptyInitScriptHashesIsNotOmitted(t *testing.T) {
	base := MrConfigV3Input{
		AppID:         v3AppID,
		ComposeHash:   v3ComposeHash,
		KeyProvider:   KeyProviderKMS,
		KeyProviderID: v3KmsKeyProviderID,
		InstanceID:    v3InstanceID,
	}
	withEmpty := base
	withEmpty.InitScriptHashes = []string{}

	withEmptyDoc := mustBuildV3(t, withEmpty)
	if !strings.Contains(CanonicalizeMrConfigV3Document(withEmptyDoc), `"init_script_hashes":[]`) {
		t.Fatalf("an empty init_script_hashes list must survive canonicalization")
	}
	assertV3(t, withEmptyDoc,
		`{"app_id":"`+v3AppID+`","compose_hash":"`+v3ComposeHash+
			`","init_script_hashes":[],"instance_id":"`+v3InstanceID+
			`","key_provider":"kms","key_provider_id":"`+v3KmsKeyProviderID+`","version":3}`,
		"03ce2f8b8e4aa4cccdae73fb3a118047726b77d70b1e47bb0e3e48600603fd612c"+v3Padding,
		"ce2f8b8e4aa4cccdae73fb3a118047726b77d70b1e47bb0e3e48600603fd612c",
	)

	omitted := GetMrConfigIdV3(mustBuildV3(t, base))
	present := GetMrConfigIdV3(withEmptyDoc)
	if omitted == present {
		t.Fatalf("omitting init_script_hashes must not equal an empty list")
	}
}

func TestMrConfigV3OmitsEmptyOptionalFields(t *testing.T) {
	document := mustBuildV3(t, MrConfigV3Input{
		AppID:       v3AppID,
		ComposeHash: v3ComposeHash,
		KeyProvider: KeyProviderNone,
	})
	assertV3(t, document,
		`{"app_id":"`+v3AppID+`","compose_hash":"`+v3ComposeHash+`","key_provider":"none","version":3}`,
		"0301d4d7e6ca2922bb80683c27fe1f4da318cf14d1c38db97563c2b6209af7dba5"+v3Padding,
		"01d4d7e6ca2922bb80683c27fe1f4da318cf14d1c38db97563c2b6209af7dba5",
	)
}

func TestMrConfigV3EveryOptionalFieldOnTpm(t *testing.T) {
	document := mustBuildV3(t, MrConfigV3Input{
		AppID:            v3AppID,
		ComposeHash:      v3ComposeHash,
		GpuPolicyHash:    strings.Repeat("55", 32),
		KeyProvider:      "tpm",
		KeyProviderID:    strings.Repeat("66", 16),
		InstanceID:       v3InstanceID,
		InitScriptHashes: []string{strings.Repeat("cc", 32)},
	})
	id := GetMrConfigIdV3(document)
	if got := hex.EncodeToString(id[:]); got != "03633f5444c26877f68c293d90a6feef58064e1e57367ac55c94b255cf3bdf8885"+v3Padding {
		t.Errorf("tpm tdx mr_config_id = %s", got)
	}
	hostData := GetSnpHostDataV3(document)
	if got := hex.EncodeToString(hostData[:]); got != "633f5444c26877f68c293d90a6feef58064e1e57367ac55c94b255cf3bdf8885" {
		t.Errorf("tpm snp host_data = %s", got)
	}
}

func TestMrConfigV3AcceptsPrefixedAndBareHex(t *testing.T) {
	prefixed := mustBuildV3(t, MrConfigV3Input{
		AppID:       "0x" + v3AppID,
		ComposeHash: "0x" + v3ComposeHash,
		KeyProvider: KeyProviderNone,
	})
	bare := mustBuildV3(t, MrConfigV3Input{
		AppID:       v3AppID,
		ComposeHash: v3ComposeHash,
		KeyProvider: KeyProviderNone,
	})
	if CanonicalizeMrConfigV3Document(prefixed) != CanonicalizeMrConfigV3Document(bare) {
		t.Fatalf("0x prefix must not change the document")
	}
}

func TestMrConfigV3RejectsWrongByteLengths(t *testing.T) {
	if _, err := BuildMrConfigV3Document(MrConfigV3Input{ComposeHash: "2222", KeyProvider: KeyProviderNone}); err == nil {
		t.Fatalf("expected a compose_hash length error")
	}
	_, err := BuildMrConfigV3Document(MrConfigV3Input{
		AppID:       strings.Repeat("11", 32),
		ComposeHash: v3ComposeHash,
		KeyProvider: KeyProviderNone,
	})
	if err == nil {
		t.Fatalf("expected an app_id length error")
	}
}

func TestMrConfigV3RejectsTooManyInitScripts(t *testing.T) {
	hashes := make([]string, 6)
	for i := range hashes {
		hashes[i] = strings.Repeat("aa", 32)
	}
	_, err := BuildMrConfigV3Document(MrConfigV3Input{
		ComposeHash:      v3ComposeHash,
		KeyProvider:      KeyProviderNone,
		InitScriptHashes: hashes,
	})
	if err == nil {
		t.Fatalf("expected an init_script_hashes count error")
	}
}

func TestVerifyMrConfigIdAnyVersionDispatchesOnVersionByte(t *testing.T) {
	input := MrConfigV3Input{
		AppID:         v3AppID,
		ComposeHash:   v3ComposeHash,
		KeyProvider:   KeyProviderKMS,
		KeyProviderID: v3KmsKeyProviderID,
		InstanceID:    v3InstanceID,
	}

	var composeHash [32]byte
	decoded, err := hex.DecodeString(v3ComposeHash)
	if err != nil {
		t.Fatalf("decode compose hash: %v", err)
	}
	copy(composeHash[:], decoded)
	v1 := GetMrConfigIdV1(composeHash)
	ok, err := VerifyMrConfigIdAnyVersion("0x"+hex.EncodeToString(v1[:]), input)
	if err != nil || !ok {
		t.Fatalf("V1 quote should verify: ok=%v err=%v", ok, err)
	}

	v2, err := GetMrConfigIdHex(v3ComposeHash, v3AppID, KeyProviderKMS, v3KmsKeyProviderID)
	if err != nil {
		t.Fatalf("V2 hex: %v", err)
	}
	ok, err = VerifyMrConfigIdAnyVersion(v2, input)
	if err != nil || !ok {
		t.Fatalf("V2 quote should verify: ok=%v err=%v", ok, err)
	}

	ok, err = VerifyMrConfigIdAnyVersion("0x"+v3KmsWithInstanceID, input)
	if err != nil || !ok {
		t.Fatalf("V3 quote should verify: ok=%v err=%v", ok, err)
	}

	changed := input
	changed.InstanceID = strings.Repeat("45", 20)
	ok, err = VerifyMrConfigIdAnyVersion("0x"+v3KmsWithInstanceID, changed)
	if err != nil || ok {
		t.Fatalf("a different instance_id must not verify: ok=%v err=%v", ok, err)
	}

	ok, err = VerifyMrConfigIdAnyVersion("0x04"+v3KmsWithInstanceID[2:], input)
	if err != nil || ok {
		t.Fatalf("an unknown version byte must not verify: ok=%v err=%v", ok, err)
	}
}
