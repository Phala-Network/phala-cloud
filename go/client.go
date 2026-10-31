package phala

import (
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"
)

// Client is the Phala Cloud API client.
type Client struct {
	baseURL     string
	apiKey      string
	bearerToken string
	workspace   string
	apiVersion  string
	httpClient  *http.Client
	userAgent   string
	headers     map[string]string
	maxRetries  int
}

// withVersion returns an isolated client view for version-specific operations.
func (c *Client) withVersion(version string) *Client {
	copy := *c
	copy.apiVersion = version
	copy.headers = make(map[string]string, len(c.headers))
	for key, value := range c.headers {
		if !strings.EqualFold(key, "X-Phala-Version") {
			copy.headers[key] = value
		}
	}
	return &copy
}

// NewClient creates a new Phala Cloud API client with the given options.
// API key is resolved from options or the PHALA_CLOUD_API_KEY environment variable.
// Base URL is resolved from options or the PHALA_CLOUD_API_PREFIX environment variable.
func NewClient(opts ...Option) (*Client, error) {
	c := &Client{
		baseURL:    DefaultBaseURL,
		apiVersion: DefaultAPIVersion,
		httpClient: &http.Client{Timeout: DefaultTimeout},
		userAgent:  "phala-cloud-sdk-go/" + sdkVersion,
		headers:    make(map[string]string),
		maxRetries: 30,
	}

	for _, opt := range opts {
		opt(c)
	}

	// Environment variable fallbacks.
	if c.apiKey == "" {
		c.apiKey = os.Getenv("PHALA_CLOUD_API_KEY")
	}
	if c.bearerToken == "" {
		c.bearerToken = os.Getenv("PHALA_OIDC_TOKEN")
	}
	if c.workspace == "" {
		c.workspace = os.Getenv("PHALA_CLOUD_WORKSPACE")
	}
	if envURL := os.Getenv("PHALA_CLOUD_API_PREFIX"); envURL != "" {
		// Only use env URL if no explicit option was set (check if still default).
		if c.baseURL == DefaultBaseURL {
			c.baseURL = envURL
		}
	}

	if c.apiKey == "" && c.bearerToken == "" {
		return nil, fmt.Errorf("phala: API key or bearer token is required")
	}

	if c.maxRetries < 0 {
		return nil, fmt.Errorf("phala: max retries must be non-negative")
	}

	c.baseURL = strings.TrimRight(c.baseURL, "/")
	baseURL, err := url.Parse(c.baseURL)
	if err != nil {
		return nil, fmt.Errorf("phala: invalid base URL")
	}
	if baseURL.User != nil {
		return nil, fmt.Errorf("phala: base URL must not contain userinfo")
	}

	// Never forward API credentials to a redirect target, including SSE requests.
	// Apply after options so a custom HTTP client cannot re-enable redirects.
	c.httpClient.CheckRedirect = func(*http.Request, []*http.Request) error {
		return http.ErrUseLastResponse
	}

	return c, nil
}
