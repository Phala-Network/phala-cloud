package phala

// CurrentUser represents the current authenticated user (API version 2026-01-21).
type CurrentUser struct {
	User      UserInfo      `json:"user"`
	Workspace WorkspaceInfo `json:"workspace"`
	Credits   CreditsInfo   `json:"credits"`
	// Features contains account-scoped feature flags.
	Features []FeatureFlag `json:"features,omitempty"`
}

// FeatureFlag is a feature flag entry returned by bootstrap endpoints
// (GET /auth/me and GET /workspaces/{slug}).
type FeatureFlag struct {
	Name       string        `json:"name"`
	Enabled    bool          `json:"enabled"`
	Options    []string      `json:"options,omitempty"`
	Reason     *string       `json:"reason,omitempty"`
	ActionText *string       `json:"action_text,omitempty"`
	ActionURL  *string       `json:"action_url,omitempty"`
	Metadata   GenericObject `json:"metadata,omitempty"`
}

// UserInfo contains user profile information.
type UserInfo struct {
	Username        string  `json:"username"`
	Email           string  `json:"email"`
	Role            string  `json:"role"`
	Avatar          *string `json:"avatar,omitempty"`
	EmailVerified   *bool   `json:"email_verified,omitempty"`
	TOTPEnabled     *bool   `json:"totp_enabled,omitempty"`
	HasBackupCodes  *bool   `json:"has_backup_codes,omitempty"`
	FlagHasPassword *bool   `json:"flag_has_password,omitempty"`
}

// WorkspaceInfo contains workspace information for the current user.
type WorkspaceInfo struct {
	ID     string  `json:"id"`
	Name   string  `json:"name"`
	Slug   *string `json:"slug,omitempty"`
	Tier   string  `json:"tier"`
	Role   string  `json:"role"`
	Avatar *string `json:"avatar,omitempty"`
}

// CreditsInfo contains credit balance information.
type CreditsInfo struct {
	Balance           *string `json:"balance,omitempty"`
	GrantedBalance    *string `json:"granted_balance,omitempty"`
	IsPostPaid        *bool   `json:"is_post_paid,omitempty"`
	OutstandingAmount *string `json:"outstanding_amount,omitempty"`
}
