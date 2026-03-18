package phala

// CurrentUser represents the current authenticated user (API version 2026-01-21).
type CurrentUser struct {
	User      UserInfo      `json:"user"`
	Workspace WorkspaceInfo `json:"workspace"`
	Credits   CreditsInfo   `json:"credits"`
}

// UserInfo contains user profile information.
type UserInfo struct {
	Username        string `json:"username"`
	Email           string `json:"email"`
	Role            string `json:"role"`
	Avatar          string `json:"avatar"`
	EmailVerified   bool   `json:"email_verified"`
	TOTPEnabled     bool   `json:"totp_enabled"`
	HasBackupCodes  bool   `json:"has_backup_codes"`
	FlagHasPassword bool   `json:"flag_has_password"`
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
	Balance           any  `json:"balance"`
	GrantedBalance    any  `json:"granted_balance"`
	IsPostPaid        bool `json:"is_post_paid"`
	OutstandingAmount any  `json:"outstanding_amount,omitempty"`
}
