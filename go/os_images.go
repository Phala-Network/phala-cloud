package phala

import "context"

// GetOSImages returns the list of available OS images.
func (c *Client) GetOSImages(ctx context.Context) (*OSImagesResponse, error) {
	var result OSImagesResponse
	if err := c.doJSON(ctx, "GET", "/os-images", nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
