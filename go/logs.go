package phala

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// CVMLogChannel is a node log stream.
type CVMLogChannel string

const (
	CVMLogSerial CVMLogChannel = "serial"
	CVMLogStdout CVMLogChannel = "stdout"
	CVMLogStderr CVMLogChannel = "stderr"
)

// LogSource selects node vs container logs.
type LogSource struct {
	Type    string        // "node" or "container"
	Channel CVMLogChannel // node channel
	Name    string        // container name
}

// LogsOptions are the shared display parameters.
type LogsOptions struct {
	Tail       any // int | "all"
	Since      any // RFC3339, unix seconds, or <n>[smhd]
	Until      any
	Timestamps bool
	ANSI       bool
	Format     string // "text" or "ndjson"
}

// LogEntry is one container NDJSON record.
type LogEntry struct {
	Channel string `json:"channel"`
	Message string `json:"message"`
}

var logErrorStatus = map[string]int{
	"ERR-17-001": 400, "ERR-17-002": 401, "ERR-17-003": 401, "ERR-17-004": 404,
	"ERR-17-005": 409, "ERR-17-006": 409, "ERR-17-007": 404, "ERR-17-008": 502,
	"ERR-17-009": 502, "ERR-17-010": 504, "ERR-17-011": 429, "ERR-17-012": 503,
	"ERR-17-013": 404,
}

var textStreamError = regexp.MustCompile(`^\[error\] (ERR-17-\d{3}) (.*)$`)
var timestampPrefix = regexp.MustCompile(`^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})) (.*)$`)

func buildLogURL(base string, opts map[string]string) string {
	u, err := url.Parse(base)
	if err != nil {
		return base
	}
	q := u.Query()
	for k, v := range opts {
		if v != "" {
			q.Set(k, v)
		}
	}
	u.RawQuery = q.Encode()
	return u.String()
}

func assertNodeLogOptions(opts *LogsOptions) error {
	if opts == nil {
		return nil
	}
	var unsupported []string
	if opts.Timestamps {
		unsupported = append(unsupported, "timestamps")
	}
	if opts.Since != nil {
		unsupported = append(unsupported, "since")
	}
	if opts.Until != nil {
		unsupported = append(unsupported, "until")
	}
	if strings.EqualFold(opts.Format, "ndjson") {
		unsupported = append(unsupported, "format=ndjson")
	}
	if len(unsupported) > 0 {
		return fmt.Errorf("%s not supported for serial/stdout/stderr logs", strings.Join(unsupported, ", "))
	}
	return nil
}

func errContainerLogsDisabled() error {
	return &APIError{
		StatusCode: 409,
		ErrorCode:  "ERR-17-006",
		Message:    "ERR-17-006: Container logs are disabled",
	}
}

func tailValue(v any) string {
	if v == nil {
		return ""
	}
	switch t := v.(type) {
	case string:
		return t
	case int:
		return strconv.Itoa(t)
	case int64:
		return strconv.FormatInt(t, 10)
	default:
		return fmt.Sprint(t)
	}
}

// cvmLogsInfoAPIVersion is the API version that introduced CVMInfo.logs.
const cvmLogsInfoAPIVersion = "2026-01-21"

func (c *Client) apiGetJSON(ctx context.Context, path string, dest any) error {
	return c.doJSON(ctx, "GET", path, nil, dest)
}

func (c *Client) nodeLogURL(ctx context.Context, cvmID string, channel CVMLogChannel) (string, error) {
	var info struct {
		Logs map[string]*string `json:"logs"`
	}
	if err := c.doJSONVersioned(ctx, "GET", cvmPath(cvmID), cvmLogsInfoAPIVersion, nil, &info); err != nil {
		return "", err
	}
	if info.Logs == nil || info.Logs[string(channel)] == nil || *info.Logs[string(channel)] == "" {
		return "", fmt.Errorf("phala: no %s log endpoint available for CVM %s", channel, cvmID)
	}
	return *info.Logs[string(channel)], nil
}

func (c *Client) containerLogURL(ctx context.Context, cvmID, name string) (string, error) {
	var info struct {
		PublicLogs *bool `json:"public_logs"`
	}
	if err := c.doJSONVersioned(ctx, "GET", cvmPath(cvmID), cvmLogsInfoAPIVersion, nil, &info); err != nil {
		return "", err
	}
	if info.PublicLogs != nil && !*info.PublicLogs {
		return "", errContainerLogsDisabled()
	}
	var composition struct {
		Containers []struct {
			ID          string   `json:"id"`
			Names       []string `json:"names"`
			LogEndpoint *string  `json:"log_endpoint"`
		} `json:"containers"`
	}
	if err := c.apiGetJSON(ctx, cvmPath(cvmID, "composition"), &composition); err != nil {
		return "", err
	}
	containers := composition.Containers
	if name != "" {
		filtered := containers[:0]
		for _, item := range containers {
			matched := false
			for _, n := range item.Names {
				if n == name || n == "/"+name {
					matched = true
					break
				}
			}
			if !matched && strings.HasPrefix(item.ID, name) {
				matched = true
			}
			if matched {
				filtered = append(filtered, item)
			}
		}
		containers = filtered
	}
	for _, item := range containers {
		if item.LogEndpoint != nil && *item.LogEndpoint != "" {
			return *item.LogEndpoint, nil
		}
	}
	return "", fmt.Errorf("phala: no log endpoints available for CVM %s", cvmID)
}

func parseLogAccessError(resp *http.Response) error {
	body, _ := io.ReadAll(resp.Body)
	var envelope struct {
		ErrorCode   string   `json:"error_code"`
		Message     string   `json:"message"`
		Suggestions []string `json:"suggestions"`
	}
	_ = json.Unmarshal(body, &envelope)
	msg := envelope.Message
	if msg == "" {
		msg = fmt.Sprintf("HTTP %d", resp.StatusCode)
	}
	if envelope.ErrorCode != "" {
		msg = envelope.ErrorCode + ": " + msg
	}
	return &APIError{
		StatusCode:  resp.StatusCode,
		Message:     msg,
		ErrorCode:   envelope.ErrorCode,
		Suggestions: envelope.Suggestions,
		Body:        string(body),
	}
}

func logHTTPDo(ctx context.Context, rawURL string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return nil, err
	}
	return (&http.Client{}).Do(req)
}

// FetchCVMLogs fetches a one-shot log snapshot.
func (c *Client) FetchCVMLogs(ctx context.Context, cvmID string, source LogSource, opts *LogsOptions) (string, error) {
	if opts == nil {
		opts = &LogsOptions{}
	}
	if source.Type == "container" {
		entryOpts := *opts
		entryOpts.Format = "ndjson"
		entries, err := c.FetchCVMLogEntries(ctx, cvmID, source, &entryOpts)
		if err != nil {
			return "", err
		}
		var b strings.Builder
		for _, entry := range entries {
			if entry.Message == "" {
				b.WriteByte('\n')
			} else {
				b.WriteString(entry.Message)
			}
		}
		return b.String(), nil
	}
	if err := assertNodeLogOptions(opts); err != nil {
		return "", err
	}
	base, err := c.nodeLogURL(ctx, cvmID, source.Channel)
	if err != nil {
		return "", err
	}
	params := map[string]string{}
	if t := tailValue(opts.Tail); t != "" {
		params["tail"] = t
	}
	if opts.ANSI {
		params["ansi"] = "true"
	}
	resp, err := logHTTPDo(ctx, buildLogURL(base, params))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return "", parseLogAccessError(resp)
	}
	body, err := io.ReadAll(resp.Body)
	return string(body), err
}

// FetchCVMLogEntries fetches container logs as NDJSON entries.
func (c *Client) FetchCVMLogEntries(ctx context.Context, cvmID string, source LogSource, opts *LogsOptions) ([]LogEntry, error) {
	if opts == nil {
		opts = &LogsOptions{}
	}
	format := opts.Format
	if format == "" {
		format = "ndjson"
	}
	if !strings.EqualFold(format, "ndjson") {
		return nil, fmt.Errorf("phala: FetchCVMLogEntries requires format=ndjson")
	}
	base, err := c.containerLogURL(ctx, cvmID, source.Name)
	if err != nil {
		return nil, err
	}
	times, err := resolveLogTimeWindow(opts.Since, opts.Until, time.Now())
	if err != nil {
		return nil, err
	}
	params := map[string]string{"format": "ndjson"}
	if t := tailValue(opts.Tail); t != "" {
		params["tail"] = t
	}
	if times.Since != nil {
		params["since"] = strconv.FormatInt(*times.Since, 10)
	}
	if times.Until != nil {
		params["until"] = strconv.FormatInt(*times.Until, 10)
	}
	if opts.Timestamps {
		params["timestamps"] = "true"
	}
	if opts.ANSI {
		params["ansi"] = "true"
	}
	resp, err := logHTTPDo(ctx, buildLogURL(base, params))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return nil, parseLogAccessError(resp)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	return parseNDJSON(string(body))
}

func parseNDJSON(text string) ([]LogEntry, error) {
	var entries []LogEntry
	for _, line := range strings.Split(text, "\n") {
		entry, err := parseNDJSONLine(line)
		if err != nil {
			return nil, err
		}
		if entry != nil {
			entries = append(entries, *entry)
		}
	}
	return entries, nil
}

func parseNDJSONLine(line string) (*LogEntry, error) {
	trimmed := strings.TrimSpace(line)
	if trimmed == "" {
		return nil, nil
	}
	var parsed map[string]any
	if err := json.Unmarshal([]byte(trimmed), &parsed); err != nil {
		return nil, &APIError{Message: "Invalid NDJSON log record."}
	}
	if errMsg, ok := parsed["error"].(string); ok {
		_, hasChannel := parsed["channel"]
		_, hasMessage := parsed["message"]
		if errMsg != "" && !hasChannel && !hasMessage {
			return nil, &APIError{
				StatusCode:     logErrorStatus["ERR-17-009"],
				ErrorCode:      "ERR-17-009",
				Message:        "ERR-17-009: " + errMsg,
				fromStreamBody: true,
			}
		}
	}
	if code, ok := parsed["error_code"].(string); ok {
		msg, _ := parsed["message"].(string)
		if msg == "" {
			msg = "The log stream ended with an error."
		}
		status := logErrorStatus[code]
		return nil, &APIError{StatusCode: status, Message: code + ": " + msg, ErrorCode: code}
	}
	channel, _ := parsed["channel"].(string)
	message, _ := parsed["message"].(string)
	if (channel != "stdout" && channel != "stderr") || message == "" && parsed["message"] == nil {
		if channel != "stdout" && channel != "stderr" {
			return nil, &APIError{Message: "Invalid NDJSON log record."}
		}
	}
	if _, ok := parsed["message"].(string); !ok {
		return nil, &APIError{Message: "Invalid NDJSON log record."}
	}
	return &LogEntry{Channel: channel, Message: message}, nil
}

// FollowCVMLogs follows a log stream until ctx is cancelled.
func (c *Client) FollowCVMLogs(ctx context.Context, cvmID string, source LogSource, opts *LogsOptions) (<-chan string, <-chan error) {
	lines := make(chan string)
	errs := make(chan error, 1)
	go func() {
		defer close(lines)
		defer close(errs)
		if source.Type == "container" {
			err := c.followContainer(ctx, cvmID, source, opts, lines)
			if err != nil && !errors.Is(err, context.Canceled) {
				errs <- err
			}
			return
		}
		err := c.followNode(ctx, cvmID, source.Channel, opts, lines)
		if err != nil && !errors.Is(err, context.Canceled) {
			errs <- err
		}
	}()
	return lines, errs
}

func (c *Client) followNode(ctx context.Context, cvmID string, channel CVMLogChannel, opts *LogsOptions, lines chan<- string) error {
	if opts == nil {
		opts = &LogsOptions{}
	}
	if err := assertNodeLogOptions(opts); err != nil {
		return err
	}
	first := true
	failureCount := 0
	expiredRetries := 0
	for {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		base, err := c.nodeLogURL(ctx, cvmID, channel)
		if err != nil {
			return err
		}
		tail := tailValue(opts.Tail)
		if !first {
			tail = "0"
		}
		first = false
		params := map[string]string{"follow": "true"}
		if tail != "" {
			params["tail"] = tail
		}
		if opts.ANSI {
			params["ansi"] = "true"
		}
		resp, err := logHTTPDo(ctx, buildLogURL(base, params))
		if err != nil {
			failureCount++
			if failureCount >= 5 {
				return err
			}
			time.Sleep(time.Duration(minInt(250<<uint(failureCount-1), 5000)) * time.Millisecond)
			continue
		}
		if resp.StatusCode >= 400 {
			apiErr := parseLogAccessError(resp)
			resp.Body.Close()
			var typed *APIError
			if errors.As(apiErr, &typed) && typed.ErrorCode == "ERR-17-003" {
				expiredRetries++
				if expiredRetries > 3 {
					return apiErr
				}
				_, _ = c.nodeLogURL(ctx, cvmID, channel)
				continue
			}
			if typed != nil && typed.StatusCode < 500 {
				return apiErr
			}
			failureCount++
			if failureCount >= 5 {
				return apiErr
			}
			time.Sleep(time.Duration(minInt(250<<uint(failureCount-1), 5000)) * time.Millisecond)
			continue
		}
		failureCount = 0
		err = scanNodeBody(resp.Body, lines)
		resp.Body.Close()
		expiredRetries = 0
		if err != nil {
			var typed *APIError
			if errors.As(err, &typed) && typed.ErrorCode == "ERR-17-003" {
				expiredRetries++
				if expiredRetries > 3 {
					return err
				}
				continue
			}
			if errors.As(err, &typed) {
				return err
			}
		}
		if ctx.Err() != nil {
			return ctx.Err()
		}
	}
}

func scanNodeBody(body io.Reader, lines chan<- string) error {
	scanner := bufio.NewScanner(body)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	for scanner.Scan() {
		content := scanner.Text()
		if content == "[vmm heartbeat]" || content == "[teepod heartbeat]" {
			continue
		}
		if match := textStreamError.FindStringSubmatch(content); match != nil {
			return &APIError{ErrorCode: match[1], Message: match[1] + ": " + match[2], StatusCode: logErrorStatus[match[1]]}
		}
		lines <- content + "\n"
	}
	return scanner.Err()
}

func (c *Client) followContainer(ctx context.Context, cvmID string, source LogSource, opts *LogsOptions, lines chan<- string) error {
	if opts == nil {
		opts = &LogsOptions{}
	}
	times, err := resolveLogTimeWindow(opts.Since, opts.Until, time.Now())
	if err != nil {
		return err
	}
	var since *int64 = times.Since
	var boundarySecond *int64
	boundaryCounts := map[string]int{}
	first := true
	failureCount := 0
	expiredRetries := 0
	for {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		base, err := c.containerLogURL(ctx, cvmID, source.Name)
		if err != nil {
			return err
		}
		params := map[string]string{"follow": "true", "timestamps": "true", "format": "ndjson"}
		if first {
			if t := tailValue(opts.Tail); t != "" {
				params["tail"] = t
			}
			first = false
		}
		if since != nil {
			params["since"] = strconv.FormatInt(*since, 10)
		}
		if times.Until != nil {
			params["until"] = strconv.FormatInt(*times.Until, 10)
		}
		replayCounts := copyCounts(boundaryCounts)
		resp, err := logHTTPDo(ctx, buildLogURL(base, params))
		if err != nil {
			failureCount++
			if failureCount >= 5 {
				return err
			}
			time.Sleep(time.Duration(minInt(250<<uint(failureCount-1), 5000)) * time.Millisecond)
			continue
		}
		if resp.StatusCode >= 400 {
			apiErr := parseLogAccessError(resp)
			resp.Body.Close()
			var typed *APIError
			if errors.As(apiErr, &typed) && typed.ErrorCode == "ERR-17-003" {
				expiredRetries++
				if expiredRetries > 3 {
					return apiErr
				}
				var info map[string]any
				_ = c.doJSONVersioned(ctx, "GET", cvmPath(cvmID), cvmLogsInfoAPIVersion, nil, &info)
				continue
			}
			if typed != nil && typed.StatusCode < 500 {
				return apiErr
			}
			failureCount++
			if failureCount >= 5 {
				return apiErr
			}
			continue
		}
		failureCount = 0
		err = scanContainerBody(resp.Body, opts.Timestamps, &since, &boundarySecond, boundaryCounts, replayCounts, lines)
		resp.Body.Close()
		if err != nil {
			return err
		}
		expiredRetries = 0
	}
}

func scanContainerBody(
	body io.Reader,
	includeTimestamps bool,
	since **int64,
	boundarySecond **int64,
	boundaryCounts, replayCounts map[string]int,
	lines chan<- string,
) error {
	scanner := bufio.NewScanner(body)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	for scanner.Scan() {
		entry, err := parseNDJSONLine(scanner.Text())
		if err != nil {
			return err
		}
		if entry == nil {
			continue
		}
		second, rest, ok := parseTS(entry.Message)
		out := entry.Message
		if !includeTimestamps && ok {
			out = rest
		}
		if !ok {
			lines <- out
			continue
		}
		key := entry.Channel + "\x00" + entry.Message
		if *boundarySecond != nil && second < **boundarySecond {
			lines <- out
			continue
		}
		if *boundarySecond != nil && second == **boundarySecond {
			if replayCounts[key] > 0 {
				replayCounts[key]--
				continue
			}
		} else if *boundarySecond == nil || second > **boundarySecond {
			v := second
			*boundarySecond = &v
			for k := range boundaryCounts {
				delete(boundaryCounts, k)
			}
		}
		if *since == nil || second > **since {
			v := second
			*since = &v
		}
		boundaryCounts[key]++
		lines <- out
	}
	return scanner.Err()
}

func parseTS(message string) (int64, string, bool) {
	match := timestampPrefix.FindStringSubmatch(message)
	if match == nil {
		return 0, "", false
	}
	t, err := time.Parse(time.RFC3339Nano, strings.Replace(match[1], "Z", "+00:00", 1))
	if err != nil {
		t, err = time.Parse(time.RFC3339, match[1])
		if err != nil {
			return 0, "", false
		}
	}
	return t.Unix(), match[2], true
}

func copyCounts(in map[string]int) map[string]int {
	out := make(map[string]int, len(in))
	for k, v := range in {
		out[k] = v
	}
	return out
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}
