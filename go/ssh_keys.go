package phala

import "context"

// ListSSHKeys returns the list of SSH keys for the current user.
func (c *Client) ListSSHKeys(ctx context.Context) ([]SSHKey, error) {
	var result []SSHKey
	if err := c.doJSON(ctx, "GET", "/user/ssh-keys", nil, &result); err != nil {
		return nil, err
	}
	return result, nil
}

// CreateSSHKey creates a new SSH key.
func (c *Client) CreateSSHKey(ctx context.Context, req *CreateSSHKeyRequest) (*SSHKey, error) {
	var result SSHKey
	if err := c.doJSON(ctx, "POST", "/user/ssh-keys", req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// DeleteSSHKey deletes an SSH key by ID.
func (c *Client) DeleteSSHKey(ctx context.Context, keyID string) error {
	return c.doEmpty(ctx, "DELETE", "/user/ssh-keys/"+keyID)
}

// ImportGithubProfileSSHKeys imports SSH keys from a GitHub user profile.
func (c *Client) ImportGithubProfileSSHKeys(ctx context.Context, username string) (*ImportGithubResponse, error) {
	var result ImportGithubResponse
	body := map[string]string{"github_username": username}
	if err := c.doJSON(ctx, "POST", "/user/ssh-keys/github-profile", body, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// SyncGithubSSHKeys syncs SSH keys from GitHub.
func (c *Client) SyncGithubSSHKeys(ctx context.Context) (*SyncGithubResponse, error) {
	var result SyncGithubResponse
	if err := c.doJSON(ctx, "POST", "/user/ssh-keys/github-sync", nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
