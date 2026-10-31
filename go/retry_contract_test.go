package phala

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"slices"
	"testing"
	"testing/synctest"
	"time"
)

func TestSharedReadRetryContract(t *testing.T) {
	var contract struct {
		DefaultRetries int     `json:"default_max_retries"`
		RequestTimeout float64 `json:"request_timeout"`
		Cases          []struct {
			Name             string    `json:"name"`
			Method           string    `json:"method"`
			MaxRetries       *int      `json:"max_retries"`
			OperationTimeout *float64  `json:"operation_timeout"`
			CancelAfter      *float64  `json:"cancel_after"`
			ExpectedTimes    []float64 `json:"expected_times"`
			ExpectedStatus   int       `json:"expected_status"`
			ExpectedError    string    `json:"expected_error"`
			Responses        []struct {
				Status      int      `json:"status"`
				After       string   `json:"retry_after"`
				DateSeconds *float64 `json:"http_date_seconds"`
				ErrorCode   *string  `json:"error_code"`
			} `json:"responses"`
		} `json:"cases"`
	}
	data, err := os.ReadFile("testdata/read-retry.json")
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(data, &contract); err != nil {
		t.Fatal(err)
	}
	for _, scenario := range contract.Cases {
		t.Run(scenario.Name, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				start := time.Now()
				var calls []float64
				transport := readRetryTransport(func(req *http.Request) (*http.Response, error) {
					calls = append(calls, time.Since(start).Seconds())
					if req.Method != scenario.Method {
						t.Errorf("method=%s", req.Method)
					}
					reply := scenario.Responses[min(len(calls)-1, len(scenario.Responses)-1)]
					after := reply.After
					if reply.DateSeconds != nil {
						after = time.Now().Add(time.Duration(*reply.DateSeconds * float64(time.Second))).UTC().Format(http.TimeFormat)
					}
					body := map[string]any{"ok": true}
					if reply.ErrorCode != nil {
						body["error_code"] = *reply.ErrorCode
					}
					encoded, err := json.Marshal(body)
					if err != nil {
						return nil, err
					}
					return retryResponse(reply.Status, after, string(encoded)), nil
				})
				opts := []Option{WithAPIKey("test-key"), WithBaseURL("https://example.invalid"), WithHTTPClient(&http.Client{Transport: transport, Timeout: time.Duration(contract.RequestTimeout * float64(time.Second))})}
				if scenario.MaxRetries != nil {
					opts = append(opts, WithMaxRetries(*scenario.MaxRetries))
				}
				client, err := NewClient(opts...)
				if err != nil {
					t.Fatal(err)
				}
				if scenario.MaxRetries == nil && client.maxRetries != contract.DefaultRetries {
					t.Fatal("default retry budget differs from shared contract")
				}
				ctx, cancel := context.WithCancel(context.Background())
				defer cancel()
				if scenario.OperationTimeout != nil {
					var deadlineCancel context.CancelFunc
					ctx, deadlineCancel = context.WithTimeout(ctx, time.Duration(*scenario.OperationTimeout*float64(time.Second)))
					defer deadlineCancel()
				}
				if scenario.CancelAfter != nil {
					timer := time.AfterFunc(time.Duration(*scenario.CancelAfter*float64(time.Second)), cancel)
					defer timer.Stop()
				}
				err = client.doJSON(ctx, scenario.Method, "/retry-contract", nil, nil)
				if !slices.Equal(calls, scenario.ExpectedTimes) {
					t.Errorf("times=%v want=%v", calls, scenario.ExpectedTimes)
				}
				switch scenario.ExpectedError {
				case "deadline":
					if !errors.Is(err, context.DeadlineExceeded) {
						t.Fatalf("want deadline, got %v", err)
					}
				case "cancelled":
					if !errors.Is(err, context.Canceled) {
						t.Fatalf("want cancellation, got %v", err)
					}
				default:
					if scenario.ExpectedStatus < 400 {
						if err != nil {
							t.Fatal(err)
						}
					} else {
						var apiErr *APIError
						if !errors.As(err, &apiErr) || apiErr.StatusCode != scenario.ExpectedStatus {
							t.Fatalf("want status %d got %v", scenario.ExpectedStatus, err)
						}
					}
				}
			})
		})
	}
}
