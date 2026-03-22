package phala

// SSHKey represents an SSH key.
type SSHKey struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	PublicKey   string  `json:"public_key"`
	Fingerprint *string `json:"fingerprint,omitempty"`
	KeyType     *string `json:"key_type,omitempty"`
	Source      *string `json:"source,omitempty"`
	CreatedAt   *string `json:"created_at,omitempty"`
	UpdatedAt   *string `json:"updated_at,omitempty"`
}

// CreateSSHKeyRequest is the request for creating an SSH key.
type CreateSSHKeyRequest struct {
	Name      string `json:"name"`
	PublicKey string `json:"public_key"`
}

// ImportGithubResponse is the response for importing GitHub SSH keys.
type ImportGithubResponse = GenericObject

// SyncGithubResponse is the response for syncing GitHub SSH keys.
type SyncGithubResponse = GenericObject
