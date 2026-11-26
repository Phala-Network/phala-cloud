package phala

import (
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"testing"
)

// fakeReply is one scripted HTTP response.
type fakeReply struct {
	status     int
	retryAfter string // Retry-After header value; empty means absent
	body       string
}

func (r fakeReply) response(req *http.Request) *http.Response {
	h := http.Header{"Content-Type": {"application/json"}}
	if r.retryAfter != "" {
		h.Set("Retry-After", r.retryAfter)
	}
	body := r.body
	if body == "" {
		body = `{}`
	}
	return &http.Response{
		StatusCode: r.status,
		Status:     strconv.Itoa(r.status) + " " + http.StatusText(r.status),
		Header:     h,
		Body:       io.NopCloser(strings.NewReader(body)),
		Request:    req,
	}
}

// fakeTransport answers requests from a script without touching the network.
// Once the script is used up, the last reply repeats.
type fakeTransport struct {
	mu      sync.Mutex
	script  []fakeReply
	methods []string
	paths   []string
	queries []string
}

func (f *fakeTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	i := len(f.methods)
	f.methods = append(f.methods, req.Method)
	f.paths = append(f.paths, req.URL.Path)
	f.queries = append(f.queries, req.URL.RawQuery)
	if i >= len(f.script) {
		i = len(f.script) - 1
	}
	return f.script[i].response(req), nil
}

func (f *fakeTransport) requests() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.methods)
}

// newFakeClient returns a client wired to a scripted transport.
func newFakeClient(t *testing.T, maxRetries int, script ...fakeReply) (*Client, *fakeTransport) {
	t.Helper()
	tr := &fakeTransport{script: script}
	c, err := NewClient(
		WithAPIKey("k"),
		WithBaseURL("http://api.invalid"),
		WithHTTPClient(&http.Client{Transport: tr}),
		WithMaxRetries(maxRetries),
	)
	if err != nil {
		t.Fatal(err)
	}
	return c, tr
}
