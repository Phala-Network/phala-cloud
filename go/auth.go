package phala

import "context"

// RevokeSelfToken revokes the API token used for this request.
func (c *Client) RevokeSelfToken(ctx context.Context) error {
	return c.doEmpty(ctx, "DELETE", "/tokens/self")
}

// GetCurrentUser returns the currently authenticated user.
func (c *Client) GetCurrentUser(ctx context.Context) (*CurrentUser, error) {
	var result CurrentUser
	if err := c.doJSON(ctx, "GET", "/auth/me", nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
