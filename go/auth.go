package phala

import "context"

// GetCurrentUser returns the currently authenticated user.
func (c *Client) GetCurrentUser(ctx context.Context) (*CurrentUser, error) {
	var result CurrentUser
	if err := c.doJSON(ctx, "GET", "/auth/me", nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
