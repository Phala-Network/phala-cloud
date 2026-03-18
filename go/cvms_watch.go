package phala

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// CVMStateEvent represents an event from the CVM state SSE stream.
type CVMStateEvent struct {
	Event string        `json:"event"`
	Data  GenericObject `json:"data,omitempty"`
	Error error         `json:"-"`
}

// WatchCVMStateOptions holds options for watching CVM state.
type WatchCVMStateOptions struct {
	Target     string
	Interval   int  // 5-30 seconds
	Timeout    int  // 10-600 seconds
	MaxRetries *int // nil = unlimited retries, 0 = no retries
	RetryDelay time.Duration
}

// WatchCVMState watches CVM state changes via SSE. Returns a channel that emits state events.
// The channel is closed when the stream ends or context is cancelled.
func (c *Client) WatchCVMState(ctx context.Context, cvmID string, opts *WatchCVMStateOptions) (<-chan CVMStateEvent, error) {
	if opts == nil {
		opts = &WatchCVMStateOptions{}
	}
	if opts.Interval == 0 {
		opts.Interval = 5
	}
	if opts.Timeout == 0 {
		opts.Timeout = 60
	}
	if opts.RetryDelay == 0 {
		opts.RetryDelay = 5 * time.Second
	}

	path := fmt.Sprintf("%s?interval=%d&timeout=%d", cvmPath(cvmID, "state"), opts.Interval, opts.Timeout)
	if opts.Target != "" {
		path += "&target=" + opts.Target
	}

	ch := make(chan CVMStateEvent, 16)

	go func() {
		defer close(ch)
		retries := 0

		for {
			err := c.streamSSE(ctx, path, ch)
			if err == nil || ctx.Err() != nil {
				return
			}

			if opts.MaxRetries != nil && retries >= *opts.MaxRetries {
				ch <- CVMStateEvent{Event: "error", Error: err}
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

func (c *Client) streamSSE(ctx context.Context, path string, ch chan<- CVMStateEvent) error {
	req, err := c.newRequest(ctx, "GET", path, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "text/event-stream")
	req.Header.Set("Cache-Control", "no-cache")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("SSE stream returned status %d", resp.StatusCode)
	}

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
				select {
				case ch <- evt:
				case <-ctx.Done():
					return ctx.Err()
				}

				if eventType == "complete" || eventType == "error" || eventType == "timeout" {
					return nil
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

	return scanner.Err()
}
