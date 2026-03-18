package phala

import (
	"fmt"
	"net/http"
	"os"
	"strings"
)

// Client is the Phala Cloud API client.
type Client struct {
	baseURL    string
	apiKey     string
	apiVersion string
	httpClient *http.Client
	userAgent  string
	headers    map[string]string
	maxRetries int
}

// NewClient creates a new Phala Cloud API client with the given options.
// API key is resolved from options or the PHALA_CLOUD_API_KEY environment variable.
// Base URL is resolved from options or the PHALA_CLOUD_API_PREFIX environment variable.
func NewClient(opts ...Option) (*Client, error) {
	c := &Client{
		baseURL:    DefaultBaseURL,
		apiVersion: DefaultAPIVersion,
		httpClient: &http.Client{},
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
	if envURL := os.Getenv("PHALA_CLOUD_API_PREFIX"); envURL != "" {
		// Only use env URL if no explicit option was set (check if still default).
		if c.baseURL == DefaultBaseURL {
			c.baseURL = envURL
		}
	}

	if c.apiKey == "" {
		return nil, fmt.Errorf("phala: API key is required (set via WithAPIKey or PHALA_CLOUD_API_KEY)")
	}

	c.baseURL = strings.TrimRight(c.baseURL, "/")

	return c, nil
}
