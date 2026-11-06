package phala

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"regexp"
	"strconv"
	"strings"
)

// composeOmitWhenNil lists optional fields the backend drops from the hashed
// compose when they are null.
var composeOmitWhenNil = []string{
	"event_log_version",
	"key_provider",
	"port_policy",
	"requirements",
	"snapshotter",
	"storage_discard",
	"swap_size",
	"verity_volumes",
}

// composeOmitWhenEmpty lists optional fields the backend drops from the hashed
// compose when they are null or an empty string.
var composeOmitWhenEmpty = []string{"default_gateway_domain", "key_provider_id", "pre_launch_script", "salt"}

// GetComposeHash computes the compose hash the way the Phala Cloud backend does.
//
// The compose is normalized by default (see GetComposeHashFromMap).
// Pass false to hash the unnormalized compose. AppCompose only models a subset of the app-compose
// fields, so fields such as port_policy, requirements or init_script cannot
// be hashed through it; use GetComposeHashFromMap for those.
func GetComposeHash(appCompose AppCompose, normalize ...bool) (string, error) {
	compose, err := composeToMap(appCompose)
	if err != nil {
		return "", err
	}
	if len(normalize) == 0 || normalize[0] {
		normalizeComposeMap(compose)
	}
	return hashComposeMap(compose)
}

// GetComposeHashFromMap computes the compose hash of a decoded app-compose
// document. It applies the backend's normalization first: the script field the
// runner does not use is dropped, optional fields that are null (or empty, for
// string fields) are dropped, and tproxy_enabled is always emitted (defaulting
// to gateway_enabled). manifest_version and init_script are hashed as given;
// use GetComposeHashFromMapForOSImage for the backend's OS-dependent format.
//
// Decode the document with json.Decoder.UseNumber to keep numbers exactly as
// written. The input map is not modified.
func GetComposeHashFromMap(compose map[string]any) (string, error) {
	return hashComposeMap(normalizedComposeCopy(compose))
}

// DumpAppComposeFromMap returns the normalized, canonical JSON that
// GetComposeHashFromMap hashes: sorted keys, compact separators, and non-ASCII
// text and <, >, & left unescaped.
func DumpAppComposeFromMap(compose map[string]any) (string, error) {
	return dumpComposeMap(normalizedComposeCopy(compose))
}

// GetComposeHashFromMapForOSImage computes the compose hash the backend
// computes for a CVM on the given OS image version (for example "0.6.0"). On
// top of GetComposeHashFromMap's normalization it applies the OS-dependent
// wire format: below 0.6.0 manifest_version is 2 and init_script is a single
// string (or absent); from 0.6.0 manifest_version is "3" and init_script is a
// list. The input map is not modified.
func GetComposeHashFromMapForOSImage(compose map[string]any, osImageVersion string) (string, error) {
	normalized, err := normalizedComposeForOSImage(compose, osImageVersion)
	if err != nil {
		return "", err
	}
	return hashComposeMap(normalized)
}

// DumpAppComposeFromMapForOSImage returns the canonical JSON that
// GetComposeHashFromMapForOSImage hashes.
func DumpAppComposeFromMapForOSImage(compose map[string]any, osImageVersion string) (string, error) {
	normalized, err := normalizedComposeForOSImage(compose, osImageVersion)
	if err != nil {
		return "", err
	}
	return dumpComposeMap(normalized)
}

func normalizedComposeForOSImage(compose map[string]any, osImageVersion string) (map[string]any, error) {
	normalized := normalizedComposeCopy(compose)
	scripts, err := initScriptList(normalized["init_script"])
	if err != nil {
		return nil, err
	}
	if osImageBelow060(osImageVersion) {
		normalized["manifest_version"] = 2
		switch len(scripts) {
		case 0:
			delete(normalized, "init_script")
		case 1:
			normalized["init_script"] = scripts[0]
		default:
			return nil, errors.New("OS images below 0.6.0 accept at most one init_script")
		}
	} else {
		normalized["manifest_version"] = "3"
		normalized["init_script"] = scripts
	}
	return normalized, nil
}

// initScriptList reads init_script in either wire form: a single string
// (pre-0.6) or a list of strings.
func initScriptList(value any) ([]any, error) {
	switch v := value.(type) {
	case nil:
		return []any{}, nil
	case string:
		if v == "" {
			return []any{}, nil
		}
		return []any{v}, nil
	case []any:
		return v, nil
	case []string:
		scripts := make([]any, len(v))
		for i, script := range v {
			scripts[i] = script
		}
		return scripts, nil
	default:
		return nil, errors.New("init_script must be a string or a list of strings")
	}
}

var osImageVersionPart = regexp.MustCompile(`^\d+`)

// osImageBelow060 parses an OS image version like the backend: leading digits
// of each dot-separated part, stopping at the first non-numeric suffix
// ("0.6.0-rc0" is 0.6.0). An unparseable version counts as 0.0.0.
func osImageBelow060(version string) bool {
	parts := make([]int, 0, 3)
	for _, raw := range strings.Split(version, ".") {
		digits := osImageVersionPart.FindString(raw)
		if digits == "" {
			break
		}
		n, err := strconv.Atoi(digits)
		if err != nil {
			break
		}
		parts = append(parts, n)
		if len(digits) != len(raw) {
			break
		}
	}
	for len(parts) < 2 {
		parts = append(parts, 0)
	}
	return parts[0] == 0 && parts[1] < 6
}

func hashComposeMap(compose map[string]any) (string, error) {
	canonical, err := dumpComposeMap(compose)
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256([]byte(canonical))
	return hex.EncodeToString(sum[:]), nil
}

func composeToMap(appCompose AppCompose) (map[string]any, error) {
	raw, err := json.Marshal(appCompose)
	if err != nil {
		return nil, err
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.UseNumber()
	var compose map[string]any
	if err := decoder.Decode(&compose); err != nil {
		return nil, err
	}
	return compose, nil
}

func normalizedComposeCopy(compose map[string]any) map[string]any {
	copied := make(map[string]any, len(compose))
	for key, value := range compose {
		copied[key] = value
	}
	normalizeComposeMap(copied)
	return copied
}

func normalizeComposeMap(compose map[string]any) {
	switch compose["runner"] {
	case "bash":
		delete(compose, "docker_compose_file")
	case "docker-compose":
		delete(compose, "bash_script")
	}
	if _, ok := compose["tproxy_enabled"]; !ok {
		gateway, ok := compose["gateway_enabled"]
		if !ok {
			gateway = true
		}
		compose["tproxy_enabled"] = gateway
	}
	for _, key := range composeOmitWhenNil {
		if value, ok := compose[key]; ok && value == nil {
			delete(compose, key)
		}
	}
	for _, key := range composeOmitWhenEmpty {
		if value, ok := compose[key]; ok && (value == nil || value == "") {
			delete(compose, key)
		}
	}
}

// dumpComposeMap serializes like Python's
// json.dumps(sort_keys, separators=(",", ":"), ensure_ascii=False).
// encoding/json sorts map keys at every level, but escapes <, >, & and the
// U+2028/U+2029 separators, which the backend leaves as-is.
func dumpComposeMap(compose map[string]any) (string, error) {
	var buf bytes.Buffer
	encoder := json.NewEncoder(&buf)
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(compose); err != nil {
		return "", err
	}
	return unescapeLineSeparators(strings.TrimSuffix(buf.String(), "\n")), nil
}

// lineSeparatorEscapes maps the escapes encoding/json writes for U+2028 and
// U+2029 to the raw characters.
var lineSeparatorEscapes = map[string]string{
	"\\u2028": string(rune(0x2028)),
	"\\u2029": string(rune(0x2029)),
}

// unescapeLineSeparators turns the \u2028 and \u2029 escapes written by
// encoding/json back into the raw characters. It walks escape pairs so that an
// escaped backslash followed by the text "u2028" is left alone.
func unescapeLineSeparators(encoded string) string {
	var out strings.Builder
	out.Grow(len(encoded))
	for i := 0; i < len(encoded); i++ {
		if encoded[i] != '\\' {
			out.WriteByte(encoded[i])
			continue
		}
		if i+6 <= len(encoded) {
			if raw, ok := lineSeparatorEscapes[encoded[i:i+6]]; ok {
				out.WriteString(raw)
				i += 5
				continue
			}
		}
		out.WriteByte('\\')
		if i+1 < len(encoded) {
			i++
			out.WriteByte(encoded[i])
		}
	}
	return out.String()
}
