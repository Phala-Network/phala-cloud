package phala

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/url"
	"strings"
	"time"
)

// CVMStateEvent represents an event from the CVM state SSE stream.
type CVMStateEvent struct {
	Event string        `json:"event"`
	Data  GenericObject `json:"data,omitempty"`
	Error error         `json:"-"`
}

// WatchStreamError reports a stream ending before a complete event.
// Its cause can be inspected with errors.Is or errors.As.
type WatchStreamError struct {
	Cause error
}

func (e *WatchStreamError) Error() string { return "phala: watch stream: " + e.Cause.Error() }
func (e *WatchStreamError) Unwrap() error { return e.Cause }

// WatchCVMStateOptions holds options for watching CVM state.
type WatchCVMStateOptions struct {
	Target     string
	Interval   int  // 5-30 seconds
	Timeout    int  // 10-600 seconds
	MaxRetries *int // nil = unlimited retries, 0 = no retries
	RetryDelay time.Duration
}

// WatchCVMState watches CVM state changes via SSE. Returns a channel that emits state events.
// The channel is closed when the stream ends or context is cancelled. Reconnects
// are unlimited by default; use a context deadline to bound total waiting time.
func (c *Client) WatchCVMState(ctx context.Context, cvmID string, opts *WatchCVMStateOptions) (<-chan CVMStateEvent, error) {
	options := WatchCVMStateOptions{}
	if opts != nil {
		options = *opts
	}
	opts = &options
	if opts.Target == "" {
		return nil, fmt.Errorf("phala: watch target is required")
	}
	if opts.MaxRetries != nil && *opts.MaxRetries < 0 {
		return nil, fmt.Errorf("phala: max retries must be non-negative")
	}
	if opts.RetryDelay < 0 {
		return nil, fmt.Errorf("phala: retry delay must be non-negative")
	}
	if opts.Interval == 0 {
		opts.Interval = 5
	}
	if opts.Timeout == 0 {
		opts.Timeout = 300
	}
	if opts.RetryDelay == 0 {
		opts.RetryDelay = 5 * time.Second
	}

	if opts.Interval < 5 || opts.Interval > 30 || opts.Timeout < 10 || opts.Timeout > 600 {
		return nil, fmt.Errorf("phala: interval must be 5-30 and timeout must be 10-600 seconds")
	}
	query := url.Values{"interval": {fmt.Sprint(opts.Interval)}, "timeout": {fmt.Sprint(opts.Timeout)}}
	if opts.Target != "" {
		query.Set("target", opts.Target)
	}
	path := cvmPath(cvmID, "state") + "?" + query.Encode()

	ch := make(chan CVMStateEvent, 16)
	if !c.timeoutExplicit {
		clientCopy := *c
		httpCopy := *c.httpClient
		httpCopy.Timeout = 0
		clientCopy.httpClient = &httpCopy
		c = &clientCopy
	}

	go func() {
		defer close(ch)
		retries := 0

		for {
			err := c.streamSSE(ctx, path, ch)
			if err == nil || ctx.Err() != nil {
				return
			}

			var apiErr *APIError
			permanent := errors.As(err, &apiErr) && !watchRetryableStatus(apiErr.StatusCode)
			if permanent || (opts.MaxRetries != nil && retries >= *opts.MaxRetries) {
				select {
				case ch <- CVMStateEvent{Event: "error", Error: err}:
				case <-ctx.Done():
				}
				return
			}
			retries++

			select {
			case <-ctx.Done():
				return
			case <-time.After(opts.RetryDelay):
			}
		}
	}()

	return ch, nil
}

func watchRetryableStatus(status int) bool {
	switch status {
	case 408, 429, 500, 502, 503, 504:
		return true
	default:
		return false
	}
}

func (c *Client) streamSSE(ctx context.Context, path string, ch chan<- CVMStateEvent) error {
	req, err := c.newRequest(ctx, "GET", path, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "text/event-stream")
	req.Header.Set("Cache-Control", "no-cache")

	resp, err := c.do(ctx, req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	scanner := bufio.NewScanner(resp.Body)
	var eventType, data string

	for scanner.Scan() {
		line := scanner.Text()

		if line == "" {
			// Empty line = end of event.
			if eventType != "" || data != "" {
				evt := CVMStateEvent{Event: eventType}
				if data != "" {
					var obj GenericObject
					if json.Unmarshal([]byte(data), &obj) == nil {
						evt.Data = obj
					}
				}
				if eventType == "complete" {
					status, ok := evt.Data["status"].(string)
					if !ok || status == "" {
						return fmt.Errorf("SSE complete event has no status")
					}
				}
				if eventType == "error" {
					evt.Error = fmt.Errorf("SSE error: %s", data)
				}
				select {
				case ch <- evt:
				case <-ctx.Done():
					return ctx.Err()
				}

				if eventType == "complete" {
					return nil
				}
				if eventType == "timeout" {
					return fmt.Errorf("SSE stream timed out")
				}
			}
			eventType = ""
			data = ""
			continue
		}

		if strings.HasPrefix(line, "event:") {
			eventType = strings.TrimSpace(strings.TrimPrefix(line, "event:"))
		} else if strings.HasPrefix(line, "data:") {
			data = strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		}
	}

	if err := scanner.Err(); err != nil {
		return &WatchStreamError{Cause: err}
	}
	return &WatchStreamError{Cause: io.ErrUnexpectedEOF}
}
