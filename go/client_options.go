package phala

import (
	"net/http"
	"time"
)

// Option configures the Client.
type Option func(*Client)

// WithAPIKey sets the API key for authentication.
func WithAPIKey(key string) Option {
	return func(c *Client) { c.apiKey = key }
}

// WithBaseURL sets the base URL for the API.
func WithBaseURL(url string) Option {
	return func(c *Client) { c.baseURL = url }
}

// WithAPIVersion sets the API version header value.
func WithAPIVersion(v string) Option {
	return func(c *Client) { c.apiVersion = v }
}

// WithHTTPClient copies a custom HTTP client. Its transport and cookie jar are
// shared, but SDK timeout and redirect policy do not mutate the caller's client.
func WithHTTPClient(hc *http.Client) Option {
	return func(c *Client) {
		copy := *hc
		c.httpClient = &copy
	}
}

// WithTimeout sets the HTTP client timeout.
func WithTimeout(d time.Duration) Option {
	return func(c *Client) { c.httpClient.Timeout = d }
}

// WithUserAgent sets a custom User-Agent header.
func WithUserAgent(ua string) Option {
	return func(c *Client) { c.userAgent = ua }
}

// WithHeader adds a custom header to all requests.
func WithHeader(key, value string) Option {
	return func(c *Client) { c.headers[key] = value }
}

// WithMaxRetries sets the maximum number of retries for retryable errors.
func WithMaxRetries(n int) Option {
	return func(c *Client) { c.maxRetries = n }
}
