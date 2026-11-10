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
	Name    string        // container name or container ID prefix
}

// LogsOptions are the shared display parameters.
type LogsOptions struct {
	Tail       any // int | "all"
	Since      any // RFC3339, unix seconds, or <n>[smhd]
	Until      any
	Timestamps bool
	// ANSI keeps ANSI escape sequences. When false they are stripped from
	// delivered output on every path, including NDJSON messages.
	ANSI   bool
	Format string // "text" or "ndjson"
}

// LogEntry is one container NDJSON record.
type LogEntry struct {
	Channel string `json:"channel"`
	Message string `json:"message"`
}

// cvmLogsInfoAPIVersion is the API version that introduced CVMInfo.logs.
const cvmLogsInfoAPIVersion = "2026-01-21"

const emptyStreamEndMessage = "log stream keeps ending without new output; the container may have stopped"

// emptyStreamQuiet is how long an idle 200 must last before a clean EOF is
// treated as a quiet container (reconnect immediately) rather than a stop.
const emptyStreamQuiet = 10 * time.Second

const (
	maxFollowFailures   = 5
	maxFollowEmptyEnds  = 5
	maxFollowExpiredURL = 3
)

// followMinConnectionInterval is the minimum time between the starts of two
// consecutive follow connections. The VMM node endpoint can answer 200 with a
// single plain-text error line and end at once; that counts as delivered output,
// so without this floor follow would reconnect in a hot loop.
var followMinConnectionInterval = time.Second

// followNow is the clock used by follow; tests replace it.
var followNow = time.Now

var (
	textStreamError = regexp.MustCompile(`^\[error\] (ERR-17-\d{3}) (.*)$`)
	timestampPrefix = regexp.MustCompile(`(?s)^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})) (.*)$`)
	// ansiEscape matches OSC (ESC ] ... BEL or ESC \, e.g. OSC 8 hyperlinks),
	// CSI (ESC [ params intermediates final, including private modes such as
	// ESC[?25l), and the remaining ESC sequences (ESC intermediates final).
	ansiEscape         = regexp.MustCompile(`\x1b(?:\][^\x07\x1b]*(?:\x07|\x1b\\)|\[[0-?]*[ -/]*[@-~]|[ -/]*[0-~])`)
	containerNameChars = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$`)
)

func validLogChannel(channel string) bool {
	return channel == "stdout" || channel == "stderr" || channel == "stdin" || channel == "console"
}

func isHeartbeat(content string) bool {
	return content == "[vmm heartbeat]" || content == "[teepod heartbeat]"
}

func applyANSIPolicy(text string, keep bool) string {
	if keep {
		return text
	}
	return ansiEscape.ReplaceAllString(text, "")
}

func sendValue[T any](ctx context.Context, ch chan<- T, v T) error {
	select {
	case ch <- v:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// logQuery is the gateway query string. The gateway rejects any '%' in the
// request target, so parameters are appended raw, never re-encoded.
type logQuery struct {
	since      *int64
	until      *int64
	follow     bool
	tail       string
	timestamps bool
	ansi       bool
	format     string
}

func (q logQuery) apply(base string) string {
	var params []string
	if q.since != nil {
		params = append(params, "since="+strconv.FormatInt(*q.since, 10))
	}
	if q.until != nil {
		params = append(params, "until="+strconv.FormatInt(*q.until, 10))
	}
	if q.follow {
		params = append(params, "follow=true")
	}
	if q.tail != "" {
		params = append(params, "tail="+q.tail)
	}
	if q.timestamps {
		params = append(params, "timestamps=true")
	}
	// The gateway accepts ansi only with format=text (node streams are text).
	if q.ansi && (q.format == "" || q.format == "text") {
		params = append(params, "ansi=true")
	}
	if q.format != "" {
		params = append(params, "format="+q.format)
	}
	if len(params) == 0 {
		return base
	}
	sep := "?"
	if strings.Contains(base, "?") {
		sep = "&"
	}
	return base + sep + strings.Join(params, "&")
}

func tailValue(v any) string {
	switch t := v.(type) {
	case nil:
		return ""
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

func assertNodeLogOptions(opts *LogsOptions) error {
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
		return errLogValidation("%s not supported for serial/stdout/stderr logs", strings.Join(unsupported, ", "))
	}
	return nil
}

func isTextFormat(opts *LogsOptions) bool {
	return strings.EqualFold(opts.Format, "text")
}

// containerSlug validates a container name before any request is made.
func containerSlug(name string) (string, error) {
	slug := strings.TrimPrefix(name, "/")
	if !containerNameChars.MatchString(slug) || strings.Contains(slug, "..") {
		return "", errLogValidation("invalid container name %q; use 1-128 letters, digits, '_', '.', or '-', starting with a letter or digit, without '..'", name)
	}
	return slug, nil
}

func validateLogSource(source LogSource) error {
	if source.Type == "container" && source.Name != "" {
		_, err := containerSlug(source.Name)
		return err
	}
	return nil
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

// errLogValidation is a client-side validation error: ERR-17-001 without an
// HTTP status, raised before any request.
func errLogValidation(format string, args ...any) error {
	return &APIError{ErrorCode: "ERR-17-001", Message: fmt.Sprintf(format, args...)}
}

// assertEntriesRequest validates the *Entries APIs: container source, NDJSON.
func assertEntriesRequest(api string, source LogSource, opts *LogsOptions) error {
	if source.Type != "container" {
		return errLogValidation("%s supports container logs only", api)
	}
	if opts.Format != "" && !strings.EqualFold(opts.Format, "ndjson") {
		return errLogValidation("%s requires format=ndjson", api)
	}
	return nil
}

// errContainerNotFound is raised when no container in the composition matches.
func errContainerNotFound() error {
	return &APIError{ErrorCode: "ERR-17-007", Message: "Container not found"}
}

func errContainerLogsDisabled() error {
	return &APIError{
		StatusCode: 409,
		ErrorCode:  "ERR-17-006",
		Message:    "Container logs are disabled",
	}
}

func errGuestAgent(message string) error {
	return &APIError{ErrorCode: "ERR-17-009", Message: message, fromStreamBody: true}
}

func errInvalidLogRecord() error {
	return &APIError{Message: "Invalid NDJSON log record.", fromStreamBody: true}
}

// gatewayStreamError is a gateway error line or record read from a 200 body.
// Follow treats it as a retryable failure; callers receive the inner *APIError.
type gatewayStreamError struct{ apiErr *APIError }

func (e *gatewayStreamError) Error() string { return e.apiErr.Error() }
func (e *gatewayStreamError) Unwrap() error { return e.apiErr }

func publicLogError(err error) error {
	var gw *gatewayStreamError
	if errors.As(err, &gw) {
		return gw.apiErr
	}
	return err
}

// applyErrorEnvelope copies the structured envelope fields onto e, ignoring
// fields whose shape does not match.
func applyErrorEnvelope(e *APIError, fields map[string]json.RawMessage) {
	if v, ok := fields["error_code"]; ok {
		_ = json.Unmarshal(v, &e.ErrorCode)
	}
	if v, ok := fields["message"]; ok {
		_ = json.Unmarshal(v, &e.Message)
	}
	if v, ok := fields["details"]; ok {
		var details []ErrorDetail
		if json.Unmarshal(v, &details) == nil {
			e.Details = details
		}
	}
	if v, ok := fields["suggestions"]; ok {
		var suggestions []string
		if json.Unmarshal(v, &suggestions) == nil {
			e.Suggestions = suggestions
		}
	}
	if v, ok := fields["links"]; ok {
		var links []ErrorLink
		if json.Unmarshal(v, &links) == nil {
			e.Links = links
		}
	}
	if v, ok := fields["request_id"]; ok {
		_ = json.Unmarshal(v, &e.RequestID)
	}
}

func parseLogAccessError(resp *http.Response) error {
	body, _ := io.ReadAll(resp.Body)
	apiErr := &APIError{StatusCode: resp.StatusCode, Body: string(body), Headers: resp.Header}
	var fields map[string]json.RawMessage
	if json.Unmarshal(body, &fields) == nil {
		applyErrorEnvelope(apiErr, fields)
	}
	if apiErr.Message == "" {
		apiErr.Message = fmt.Sprintf("HTTP %d", resp.StatusCode)
	}
	return apiErr
}

// textLineError returns the error carried by a text log line, if any:
// a gateway "[error] ERR-17-0xx ..." line or, when checkGuest is set, a guest
// {"error":"..."} record at the start of the line (possibly glued to the next record).
func textLineError(content string, checkGuest bool) error {
	if m := textStreamError.FindStringSubmatch(strings.TrimSpace(content)); m != nil {
		return &gatewayStreamError{&APIError{ErrorCode: m[1], Message: m[2]}}
	}
	if checkGuest {
		if msg, ok := guestRecordPrefix(content); ok {
			return errGuestAgent(msg)
		}
	}
	return nil
}

// guestRecordPrefix reports whether text starts with a guest agent error
// record ({"error":"..."} without channel/message).
func guestRecordPrefix(text string) (string, bool) {
	trimmed := strings.TrimLeft(text, " \t\r\n")
	if !strings.HasPrefix(trimmed, "{") {
		return "", false
	}
	var fields map[string]json.RawMessage
	if json.NewDecoder(strings.NewReader(trimmed)).Decode(&fields) != nil {
		return "", false
	}
	return guestRecordMessage(fields)
}

func guestRecordMessage(fields map[string]json.RawMessage) (string, bool) {
	raw, ok := fields["error"]
	if !ok {
		return "", false
	}
	if _, has := fields["channel"]; has {
		return "", false
	}
	if _, has := fields["message"]; has {
		return "", false
	}
	var msg string
	if json.Unmarshal(raw, &msg) != nil {
		return "", false
	}
	return msg, true
}

// parseLogRecord classifies one NDJSON value: a log entry, a guest error
// record (stop), or a gateway error record (retryable).
func parseLogRecord(raw json.RawMessage) (LogEntry, error) {
	var fields map[string]json.RawMessage
	if json.Unmarshal(raw, &fields) != nil || fields == nil {
		return LogEntry{}, errInvalidLogRecord()
	}
	if msg, ok := guestRecordMessage(fields); ok {
		return LogEntry{}, errGuestAgent(msg)
	}
	if _, ok := fields["error_code"]; ok {
		apiErr := &APIError{}
		applyErrorEnvelope(apiErr, fields)
		if apiErr.Message == "" {
			apiErr.Message = "The log stream ended with an error."
		}
		return LogEntry{}, &gatewayStreamError{apiErr}
	}
	var entry LogEntry
	chRaw, okCh := fields["channel"]
	msgRaw, okMsg := fields["message"]
	if !okCh || !okMsg || json.Unmarshal(chRaw, &entry.Channel) != nil || json.Unmarshal(msgRaw, &entry.Message) != nil {
		return LogEntry{}, errInvalidLogRecord()
	}
	if !validLogChannel(entry.Channel) {
		return LogEntry{}, errInvalidLogRecord()
	}
	return entry, nil
}

// decodeLogRecords streams NDJSON values from body (a JSON stream decoder, so a
// record glued to the next one on the same line still parses) and calls onEntry
// for each log entry. A clean EOF returns nil.
func decodeLogRecords(body io.Reader, onEntry func(LogEntry) error) error {
	dec := json.NewDecoder(body)
	for {
		var raw json.RawMessage
		if err := dec.Decode(&raw); err != nil {
			if errors.Is(err, io.EOF) {
				return nil
			}
			var syntaxErr *json.SyntaxError
			if errors.As(err, &syntaxErr) {
				return errInvalidLogRecord()
			}
			return err
		}
		entry, err := parseLogRecord(raw)
		if err != nil {
			return err
		}
		if err := onEntry(entry); err != nil {
			return err
		}
	}
}

// readLines calls onLine for each line of body with its line ending kept.
// A final line without a newline is delivered only on a clean EOF; a partial
// line cut by a read error is dropped (the reconnect replays it).
func readLines(body io.Reader, onLine func(string) error) error {
	r := bufio.NewReader(body)
	for {
		line, err := r.ReadString('\n')
		if err != nil && !errors.Is(err, io.EOF) {
			return err
		}
		if line != "" {
			if lerr := onLine(line); lerr != nil {
				return lerr
			}
		}
		if err != nil {
			return nil
		}
	}
}

func trimLineEnding(line string) string {
	return strings.TrimSuffix(strings.TrimSuffix(line, "\n"), "\r")
}

// parseTS splits "RFC3339Nano<space>rest" into the unix second and rest.
func parseTS(message string) (int64, string, bool) {
	match := timestampPrefix.FindStringSubmatch(message)
	if match == nil {
		return 0, "", false
	}
	t, err := time.Parse(time.RFC3339Nano, match[1])
	if err != nil {
		return 0, "", false
	}
	return t.Unix(), match[2], true
}

// ---------------------------------------------------------------------------
// URL resolution
// ---------------------------------------------------------------------------

type cvmLogInfo struct {
	PublicLogs *bool              `json:"public_logs"`
	Logs       map[string]*string `json:"logs"`
}

func (i *cvmLogInfo) logURL(key string) string {
	if i.Logs == nil || i.Logs[key] == nil {
		return ""
	}
	return *i.Logs[key]
}

func (c *Client) getCVMLogInfo(ctx context.Context, cvmID string) (*cvmLogInfo, error) {
	var info cvmLogInfo
	if err := c.doJSONVersioned(ctx, "GET", cvmPath(cvmID), cvmLogsInfoAPIVersion, nil, &info); err != nil {
		return nil, err
	}
	return &info, nil
}

func (c *Client) nodeLogURL(ctx context.Context, cvmID string, channel CVMLogChannel) (string, error) {
	info, err := c.getCVMLogInfo(ctx, cvmID)
	if err != nil {
		return "", err
	}
	u := info.logURL(string(channel))
	if u == "" {
		return "", fmt.Errorf("phala: no %s log endpoint available for CVM %s", channel, cvmID)
	}
	return u, nil
}

type compositionContainer struct {
	ID    string   `json:"id"`
	Names []string `json:"names"`
}

func (item compositionContainer) slug() string {
	if len(item.Names) > 0 {
		return strings.TrimPrefix(item.Names[0], "/")
	}
	return item.ID
}

func joinContainerLogURL(base, name, authQuery string) (string, error) {
	slug, err := containerSlug(name)
	if err != nil {
		return "", err
	}
	u := strings.TrimSuffix(base, "/") + "/" + slug
	if authQuery == "" {
		return u, nil
	}
	if strings.Contains(u, "?") {
		return u + "&" + authQuery, nil
	}
	return u + "?" + authQuery, nil
}

// containerTarget is a container resolved once per fetch or follow. Every
// connection builds {container_log_base}/{slug}?{auth_query} from a fresh CVM
// info lookup; the composition is never re-queried.
type containerTarget struct {
	cvmID string
	slug  string
	// info is the lookup made during resolution, used by the first connection.
	info *cvmLogInfo
}

// containerLogInfo looks up the CVM log URLs and enforces the Public Logs setting.
func (c *Client) containerLogInfo(ctx context.Context, cvmID string) (*cvmLogInfo, error) {
	info, err := c.getCVMLogInfo(ctx, cvmID)
	if err != nil {
		return nil, err
	}
	if info.PublicLogs != nil && !*info.PublicLogs {
		return nil, errContainerLogsDisabled()
	}
	return info, nil
}

// resolveContainer checks Public Logs, then resolves the container from the
// composition: an exact name first, else a unique container ID prefix, else
// the first container when no name is given.
func (c *Client) resolveContainer(ctx context.Context, cvmID, name string) (*containerTarget, error) {
	info, err := c.containerLogInfo(ctx, cvmID)
	if err != nil {
		return nil, err
	}
	var composition struct {
		Containers []compositionContainer `json:"containers"`
		Error      *string                `json:"error"`
	}
	if err := c.doJSON(ctx, "GET", cvmPath(cvmID, "composition"), nil, &composition); err != nil {
		return nil, err
	}
	containers := composition.Containers
	if len(containers) == 0 && composition.Error != nil && *composition.Error != "" {
		return nil, &APIError{Message: *composition.Error}
	}
	target := &containerTarget{cvmID: cvmID, info: info}
	if name == "" {
		if len(containers) == 0 {
			return nil, errContainerNotFound()
		}
		target.slug = containers[0].slug()
		return target, nil
	}
	for _, item := range containers {
		for _, n := range item.Names {
			if n == name || n == "/"+name {
				target.slug = strings.TrimPrefix(name, "/")
				return target, nil
			}
		}
	}
	var prefixed []compositionContainer
	for _, item := range containers {
		if strings.HasPrefix(item.ID, name) {
			prefixed = append(prefixed, item)
		}
	}
	switch len(prefixed) {
	case 0:
		return nil, errContainerNotFound()
	case 1:
		target.slug = prefixed[0].slug()
		return target, nil
	default:
		labels := make([]string, 0, len(prefixed))
		for _, item := range prefixed {
			labels = append(labels, item.slug())
		}
		return nil, errLogValidation("ambiguous container prefix %q matches: %s", name, strings.Join(labels, ", "))
	}
}

// logURL builds a freshly signed URL for the next connection: one CVM info
// lookup per connection (the first reuses the resolution lookup).
func (t *containerTarget) logURL(ctx context.Context, c *Client) (string, error) {
	info := t.info
	t.info = nil
	if info == nil {
		var err error
		if info, err = c.containerLogInfo(ctx, t.cvmID); err != nil {
			return "", err
		}
	}
	base := info.logURL("container_log_base")
	if base == "" {
		return "", fmt.Errorf("phala: no container log endpoint available for CVM %s", t.cvmID)
	}
	return joinContainerLogURL(base, t.slug, info.logURL("auth_query"))
}

// lazyContainerTarget resolves the container on the first connection attempt,
// so transient lookup failures there follow the follow retry rules.
type lazyTarget struct {
	c      *Client
	cvmID  string
	name   string
	target *containerTarget
}

func (c *Client) lazyContainerTarget(cvmID, name string) *lazyTarget {
	return &lazyTarget{c: c, cvmID: cvmID, name: name}
}

func (l *lazyTarget) url(ctx context.Context) (string, error) {
	if l.target == nil {
		target, err := l.c.resolveContainer(ctx, l.cvmID, l.name)
		if err != nil {
			return "", err
		}
		l.target = target
	}
	return l.target.logURL(ctx, l.c)
}

// containerLogURL resolves the container and returns a signed URL (one-shot fetch).
func (c *Client) containerLogURL(ctx context.Context, cvmID, name string) (string, error) {
	target, err := c.resolveContainer(ctx, cvmID, name)
	if err != nil {
		return "", err
	}
	return target.logURL(ctx, c)
}

// logHTTPDo GETs a presigned log-gateway URL using the client's Transport and
// User-Agent (including WithUserAgent / a User-Agent header override).
// API credentials are not sent: the URL is already signed.
// stream=true clones the client with Timeout=0 so the 60s API timeout cannot
// cut a long-lived follow; cancellation still comes from ctx.
func (c *Client) logHTTPDo(ctx context.Context, rawURL string, stream bool) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", c.userAgent)
	for k, v := range c.headers {
		if strings.EqualFold(k, "User-Agent") {
			req.Header.Set("User-Agent", v)
		}
	}
	hc := c.httpClient
	if stream && hc != nil && hc.Timeout > 0 {
		copy := *hc
		copy.Timeout = 0
		hc = &copy
	}
	return hc.Do(req)
}

// fetchLogBody performs a one-shot log request and returns the open 200 response.
func (c *Client) fetchLogBody(ctx context.Context, rawURL string) (*http.Response, error) {
	resp, err := c.logHTTPDo(ctx, rawURL, false)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		defer resp.Body.Close()
		return nil, parseLogAccessError(resp)
	}
	return resp, nil
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

// FetchCVMLogs fetches a one-shot log snapshot as text.
func (c *Client) FetchCVMLogs(ctx context.Context, cvmID string, source LogSource, opts *LogsOptions) (string, error) {
	if opts == nil {
		opts = &LogsOptions{}
	}
	if err := validateLogSource(source); err != nil {
		return "", err
	}
	if source.Type == "container" {
		if isTextFormat(opts) {
			return c.fetchContainerText(ctx, cvmID, source, opts)
		}
		entryOpts := *opts
		entryOpts.Format = "ndjson"
		entries, err := c.FetchCVMLogEntries(ctx, cvmID, source, &entryOpts)
		if err != nil {
			return "", err
		}
		var b strings.Builder
		for _, entry := range entries {
			b.WriteString(entry.Message)
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
	q := logQuery{tail: tailValue(opts.Tail), ansi: opts.ANSI}
	resp, err := c.fetchLogBody(ctx, q.apply(base))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	var b strings.Builder
	err = readLines(resp.Body, func(line string) error {
		content := trimLineEnding(line)
		if isHeartbeat(content) {
			return nil
		}
		if lerr := textLineError(content, false); lerr != nil {
			return lerr
		}
		b.WriteString(applyANSIPolicy(line, opts.ANSI))
		return nil
	})
	if err != nil {
		return "", publicLogError(err)
	}
	return b.String(), nil
}

// FetchCVMLogEntries fetches container logs as NDJSON entries.
func (c *Client) FetchCVMLogEntries(ctx context.Context, cvmID string, source LogSource, opts *LogsOptions) ([]LogEntry, error) {
	if opts == nil {
		opts = &LogsOptions{}
	}
	if err := assertEntriesRequest("FetchCVMLogEntries", source, opts); err != nil {
		return nil, err
	}
	if err := validateLogSource(source); err != nil {
		return nil, err
	}
	times, err := resolveLogTimeWindow(opts.Since, opts.Until, time.Now())
	if err != nil {
		return nil, err
	}
	base, err := c.containerLogURL(ctx, cvmID, source.Name)
	if err != nil {
		return nil, err
	}
	q := logQuery{
		since: times.Since, until: times.Until, tail: tailValue(opts.Tail),
		timestamps: opts.Timestamps, format: "ndjson",
	}
	resp, err := c.fetchLogBody(ctx, q.apply(base))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var entries []LogEntry
	err = decodeLogRecords(resp.Body, func(entry LogEntry) error {
		entry.Message = applyANSIPolicy(entry.Message, opts.ANSI)
		entries = append(entries, entry)
		return nil
	})
	if err != nil {
		return nil, publicLogError(err)
	}
	return entries, nil
}

func (c *Client) fetchContainerText(ctx context.Context, cvmID string, source LogSource, opts *LogsOptions) (string, error) {
	times, err := resolveLogTimeWindow(opts.Since, opts.Until, time.Now())
	if err != nil {
		return "", err
	}
	base, err := c.containerLogURL(ctx, cvmID, source.Name)
	if err != nil {
		return "", err
	}
	q := logQuery{
		since: times.Since, until: times.Until, tail: tailValue(opts.Tail),
		timestamps: opts.Timestamps, ansi: opts.ANSI, format: "text",
	}
	resp, err := c.fetchLogBody(ctx, q.apply(base))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	var b strings.Builder
	atBodyStart := true
	err = readLines(resp.Body, func(line string) error {
		// Mid-stream text lines may legitimately be {"error":...} JSON; only the
		// start of the body can carry the guest agent error record.
		if lerr := textLineError(trimLineEnding(line), atBodyStart); lerr != nil {
			return lerr
		}
		atBodyStart = false
		b.WriteString(applyANSIPolicy(line, opts.ANSI))
		return nil
	})
	if err != nil {
		return "", publicLogError(err)
	}
	return b.String(), nil
}

// ---------------------------------------------------------------------------
// Follow
// ---------------------------------------------------------------------------

// FollowCVMLogs follows a log stream as text chunks until ctx is cancelled, the
// stream stops, or the caller's until window is reached. Both channels are
// closed when following ends; a terminal error is sent on the error channel.
func (c *Client) FollowCVMLogs(ctx context.Context, cvmID string, source LogSource, opts *LogsOptions) (<-chan string, <-chan error) {
	lines := make(chan string)
	errs := make(chan error, 1)
	go func() {
		defer close(lines)
		defer close(errs)
		emit := func(s string) error { return sendValue(ctx, lines, s) }
		reportFollowError(errs, c.followText(ctx, cvmID, source, opts, emit))
	}()
	return lines, errs
}

// FollowCVMLogEntries follows container logs as NDJSON entries with the same
// reconnect and stop rules as FollowCVMLogs. Node sources are not supported.
func (c *Client) FollowCVMLogEntries(ctx context.Context, cvmID string, source LogSource, opts *LogsOptions) (<-chan LogEntry, <-chan error) {
	entries := make(chan LogEntry)
	errs := make(chan error, 1)
	go func() {
		defer close(entries)
		defer close(errs)
		if opts == nil {
			opts = &LogsOptions{}
		}
		if err := assertEntriesRequest("FollowCVMLogEntries", source, opts); err != nil {
			errs <- err
			return
		}
		emit := func(e LogEntry) error { return sendValue(ctx, entries, e) }
		reportFollowError(errs, c.followContainerEntries(ctx, cvmID, source, opts, emit))
	}()
	return entries, errs
}

func reportFollowError(errs chan<- error, err error) {
	if err != nil && !errors.Is(err, context.Canceled) {
		errs <- publicLogError(err)
	}
}

func (c *Client) followText(ctx context.Context, cvmID string, source LogSource, opts *LogsOptions, emit func(string) error) error {
	if opts == nil {
		opts = &LogsOptions{}
	}
	if err := validateLogSource(source); err != nil {
		return err
	}
	if source.Type == "container" {
		if isTextFormat(opts) {
			return c.followContainerText(ctx, cvmID, source, opts, emit)
		}
		return c.followContainerEntries(ctx, cvmID, source, opts, func(e LogEntry) error {
			return emit(e.Message)
		})
	}
	if err := assertNodeLogOptions(opts); err != nil {
		return err
	}
	return c.followNode(ctx, cvmID, source.Channel, opts, emit)
}

// followPlan describes one kind of follow stream for runFollow.
type followPlan struct {
	// requestURL resolves a fresh signed URL and builds the query for the next connection.
	requestURL func(ctx context.Context) (string, error)
	// accepted runs after each HTTP 200.
	accepted func()
	// consume reads one 200 body, counting delivered records.
	consume func(ctx context.Context, body io.Reader, delivered *int) error
	// stopOnEmptyEnds stops after repeated quick clean ends (container streams).
	stopOnEmptyEnds bool
	// windowDone reports that the caller's until window has been reached.
	windowDone func() bool
}

type followAction int

const (
	followStop followAction = iota
	followFailure
	followExpiredURL
)

func classifyFollowError(err error) followAction {
	var gw *gatewayStreamError
	if errors.As(err, &gw) {
		return followFailure
	}
	var apiErr *APIError
	if !errors.As(err, &apiErr) {
		return followFailure // network or read error
	}
	switch {
	case apiErr.fromStreamBody || apiErr.StatusCode == 0:
		return followStop
	case apiErr.ErrorCode == "ERR-17-003":
		return followExpiredURL
	case apiErr.ErrorCode == "ERR-17-002",
		apiErr.ErrorCode == "ERR-17-011",
		apiErr.StatusCode == http.StatusTooManyRequests,
		apiErr.StatusCode >= 500:
		return followFailure
	default:
		return followStop
	}
}

// classifyLookupError decides whether a failed URL lookup (CVM info or
// composition) is retried: network errors, HTTP 5xx and 429 count as failures;
// everything else (Public Logs off, missing container, invalid input) stops.
func classifyLookupError(err error) followAction {
	var urlErr *url.Error
	if errors.As(err, &urlErr) {
		return followFailure
	}
	var apiErr *APIError
	if errors.As(err, &apiErr) && (apiErr.StatusCode >= 500 || apiErr.StatusCode == http.StatusTooManyRequests) {
		return followFailure
	}
	return followStop
}

// runFollow implements the shared reconnect rules: every connection resolves a
// fresh URL (lookup failures follow classifyLookupError); failures back off 250 ms doubling to 5 s and give up after 5 in a
// row; a connection that delivered records resets the failure counter even if
// it later fails; quick clean ends without output back off and, for container
// streams, stop after 5 in a row.
func (c *Client) runFollow(ctx context.Context, plan followPlan) error {
	failures, expired, emptyEnds := 0, 0, 0
	var lastStart time.Time
	for {
		if err := ctx.Err(); err != nil {
			return err
		}
		if !lastStart.IsZero() {
			if err := waitDuration(ctx, followMinConnectionInterval-time.Since(lastStart)); err != nil {
				return err
			}
		}
		lastStart = time.Now()
		delivered := 0
		rawURL, err := plan.requestURL(ctx)
		lookupFailed := err != nil
		var resp *http.Response
		if !lookupFailed {
			resp, err = c.logHTTPDo(ctx, rawURL, true)
		}
		if !lookupFailed && err == nil {
			if resp.StatusCode < 200 || resp.StatusCode >= 300 {
				err = parseLogAccessError(resp)
				resp.Body.Close()
			} else {
				plan.accepted()
				connectedAt := followNow()
				err = plan.consume(ctx, resp.Body, &delivered)
				resp.Body.Close()
				if err == nil {
					expired = 0
					if delivered > 0 {
						failures, emptyEnds = 0, 0
					}
					if plan.windowDone != nil && plan.windowDone() {
						return nil
					}
					if delivered > 0 {
						continue
					}
					if followNow().Sub(connectedAt) >= emptyStreamQuiet {
						emptyEnds = 0
						continue
					}
					emptyEnds++
					if plan.stopOnEmptyEnds && emptyEnds >= maxFollowEmptyEnds {
						return &APIError{Message: emptyStreamEndMessage, fromStreamBody: true}
					}
					if err := waitBackoff(ctx, emptyEnds); err != nil {
						return err
					}
					continue
				}
			}
		}
		if ctxErr := ctx.Err(); ctxErr != nil {
			return ctxErr
		}
		emptyEnds = 0
		action := classifyFollowError(err)
		if lookupFailed {
			action = classifyLookupError(err)
		}
		switch action {
		case followStop:
			return err
		case followExpiredURL:
			expired++
			if expired > maxFollowExpiredURL {
				return err
			}
		case followFailure:
			if delivered > 0 {
				failures, expired = 0, 0
			}
			failures++
			if failures >= maxFollowFailures {
				return err
			}
			if err := waitBackoff(ctx, failures); err != nil {
				return err
			}
		}
	}
}

func (c *Client) followNode(ctx context.Context, cvmID string, channel CVMLogChannel, opts *LogsOptions, emit func(string) error) error {
	accepted := false
	return c.runFollow(ctx, followPlan{
		requestURL: func(ctx context.Context) (string, error) {
			base, err := c.nodeLogURL(ctx, cvmID, channel)
			if err != nil {
				return "", err
			}
			q := logQuery{follow: true, tail: tailValue(opts.Tail), ansi: opts.ANSI}
			if accepted {
				q.tail = "0"
			}
			return q.apply(base), nil
		},
		accepted: func() { accepted = true },
		consume: func(ctx context.Context, body io.Reader, delivered *int) error {
			return readLines(body, func(line string) error {
				content := trimLineEnding(line)
				if isHeartbeat(content) {
					return nil
				}
				if err := textLineError(content, false); err != nil {
					return err
				}
				if err := emit(applyANSIPolicy(line, opts.ANSI)); err != nil {
					return err
				}
				*delivered++
				return nil
			})
		},
	})
}

// followCursor tracks the container reconnect position: the last timestamp
// second and how many identical records of that second were delivered, so a
// reconnect with since=<second> can skip them.
type followCursor struct {
	callerTail     string
	callerSince    *int64
	until          *int64
	since          *int64
	first200       *int64
	boundarySecond *int64
	boundaryCounts map[string]int
	replayCounts   map[string]int
}

func newFollowCursor(opts *LogsOptions, times logTimeWindow) *followCursor {
	return &followCursor{
		callerTail:     tailValue(opts.Tail),
		callerSince:    times.Since,
		until:          times.Until,
		boundaryCounts: map[string]int{},
	}
}

// query returns the tail/since for the next connection and starts a replay window.
func (c *followCursor) query(q logQuery) logQuery {
	c.replayCounts = make(map[string]int, len(c.boundaryCounts))
	for k, v := range c.boundaryCounts {
		c.replayCounts[k] = v
	}
	q.until = c.until
	if c.first200 == nil {
		q.tail = c.callerTail
		q.since = c.callerSince
		return q
	}
	q.tail = "all"
	q.since = c.reconnectSince()
	return q
}

// reconnectSince is the last delivered timestamp second; before any timestamped
// record it is the caller's since if set, else the second of the first HTTP 200.
func (c *followCursor) reconnectSince() *int64 {
	if c.since != nil {
		return c.since
	}
	if c.callerSince != nil {
		return c.callerSince
	}
	return c.first200
}

func (c *followCursor) accepted() {
	if c.first200 == nil {
		v := followNow().Unix()
		c.first200 = &v
	}
}

// admit reports whether a timestamped record should be delivered.
func (c *followCursor) admit(second int64, key string) bool {
	switch {
	case c.boundarySecond != nil && second < *c.boundarySecond:
		return true
	case c.boundarySecond != nil && second == *c.boundarySecond:
		if c.replayCounts[key] > 0 {
			c.replayCounts[key]--
			return false
		}
	default:
		v := second
		c.boundarySecond = &v
		clear(c.boundaryCounts)
	}
	if c.since == nil || second > *c.since {
		v := second
		c.since = &v
	}
	c.boundaryCounts[key]++
	return true
}

func (c *followCursor) windowDone() bool {
	if c.until == nil {
		return false
	}
	if c.since != nil && *c.since >= *c.until {
		return true
	}
	return followNow().Unix() >= *c.until
}

func (c *Client) followContainerText(ctx context.Context, cvmID string, source LogSource, opts *LogsOptions, emit func(string) error) error {
	times, err := resolveLogTimeWindow(opts.Since, opts.Until, time.Now())
	if err != nil {
		return err
	}
	cur := newFollowCursor(opts, times)
	target := c.lazyContainerTarget(cvmID, source.Name)
	return c.runFollow(ctx, followPlan{
		requestURL: func(ctx context.Context) (string, error) {
			base, err := target.url(ctx)
			if err != nil {
				return "", err
			}
			q := cur.query(logQuery{follow: true, timestamps: true, ansi: opts.ANSI, format: "text"})
			return q.apply(base), nil
		},
		accepted: cur.accepted,
		consume: func(ctx context.Context, body io.Reader, delivered *int) error {
			atBodyStart := true
			return readLines(body, func(line string) error {
				content := trimLineEnding(line)
				// Only the start of the body can carry the guest agent error record.
				if err := textLineError(content, atBodyStart); err != nil {
					return err
				}
				atBodyStart = false
				out := line
				if second, rest, ok := parseTS(line); ok {
					if !cur.admit(second, content) {
						return nil
					}
					if !opts.Timestamps {
						out = rest
					}
				}
				if err := emit(applyANSIPolicy(out, opts.ANSI)); err != nil {
					return err
				}
				*delivered++
				return nil
			})
		},
		stopOnEmptyEnds: true,
		windowDone:      cur.windowDone,
	})
}

func (c *Client) followContainerEntries(ctx context.Context, cvmID string, source LogSource, opts *LogsOptions, emit func(LogEntry) error) error {
	if err := validateLogSource(source); err != nil {
		return err
	}
	times, err := resolveLogTimeWindow(opts.Since, opts.Until, time.Now())
	if err != nil {
		return err
	}
	cur := newFollowCursor(opts, times)
	target := c.lazyContainerTarget(cvmID, source.Name)
	return c.runFollow(ctx, followPlan{
		requestURL: func(ctx context.Context) (string, error) {
			base, err := target.url(ctx)
			if err != nil {
				return "", err
			}
			q := cur.query(logQuery{follow: true, timestamps: true, format: "ndjson"})
			return q.apply(base), nil
		},
		accepted: cur.accepted,
		consume: func(ctx context.Context, body io.Reader, delivered *int) error {
			return decodeLogRecords(body, func(entry LogEntry) error {
				out := entry.Message
				if second, rest, ok := parseTS(entry.Message); ok {
					if !cur.admit(second, entry.Channel+"\x00"+entry.Message) {
						return nil
					}
					if !opts.Timestamps {
						out = rest
					}
				}
				if err := emit(LogEntry{Channel: entry.Channel, Message: applyANSIPolicy(out, opts.ANSI)}); err != nil {
					return err
				}
				*delivered++
				return nil
			})
		},
		stopOnEmptyEnds: true,
		windowDone:      cur.windowDone,
	})
}

func backoffDelay(attempt int) time.Duration {
	const maxDelay = 5 * time.Second
	if attempt < 1 {
		attempt = 1
	}
	if attempt > 6 {
		return maxDelay
	}
	return min(250*time.Millisecond<<(attempt-1), maxDelay)
}

func waitBackoff(ctx context.Context, attempt int) error {
	return waitDuration(ctx, backoffDelay(attempt))
}

func waitDuration(ctx context.Context, d time.Duration) error {
	if d <= 0 {
		return ctx.Err()
	}
	timer := time.NewTimer(d)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}
