package provider

import (
	"context"
	"strings"

	"github.com/hashicorp/terraform-plugin-framework/types"
)

type authMeResponse struct {
	User authMeUser `json:"user"`

	Workspace authMeWorkspace `json:"workspace"`
	Credits   authMeCredits   `json:"credits"`
}

type authMeUser struct {
	Username        string  `json:"username"`
	Email           string  `json:"email"`
	Role            string  `json:"role"`
	Avatar          *string `json:"avatar"`
	EmailVerified   *bool   `json:"email_verified"`
	TotpEnabled     *bool   `json:"totp_enabled"`
	HasBackupCodes  *bool   `json:"has_backup_codes"`
	FlagHasPassword *bool   `json:"flag_has_password"`
}

type authMeWorkspace struct {
	ID     string  `json:"id"`
	Name   string  `json:"name"`
	Slug   string  `json:"slug"`
	Tier   string  `json:"tier"`
	Role   string  `json:"role"`
	Avatar *string `json:"avatar"`
}

type authMeCredits struct {
	Balance           string  `json:"balance"`
	GrantedBalance    string  `json:"granted_balance"`
	IsPostPaid        *bool   `json:"is_post_paid"`
	OutstandingAmount *string `json:"outstanding_amount"`
}

func fetchAuthMe(ctx context.Context, client *APIClient) (*authMeResponse, error) {
	var out authMeResponse
	if err := client.GetJSON(ctx, "/auth/me", &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func nullableBool(v *bool) types.Bool {
	if v == nil {
		return types.BoolNull()
	}
	return types.BoolValue(*v)
}

func nullableStringPtr(v *string) types.String {
	if v == nil || strings.TrimSpace(*v) == "" {
		return types.StringNull()
	}
	return types.StringValue(strings.TrimSpace(*v))
}
