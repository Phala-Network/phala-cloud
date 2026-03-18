package phala

import (
	"context"
	"fmt"
)

// GetKMSList returns the list of KMS servers.
func (c *Client) GetKMSList(ctx context.Context) (*GetKMSListResponse, error) {
	var result GetKMSListResponse
	if err := c.doJSON(ctx, "GET", "/kms", nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetKMSInfo returns information about a specific KMS server.
func (c *Client) GetKMSInfo(ctx context.Context, kmsID string) (*KMSInfo, error) {
	var result KMSInfo
	if err := c.doJSON(ctx, "GET", "/kms/"+kmsID, nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// NextAppIDs returns the next available app IDs.
func (c *Client) NextAppIDs(ctx context.Context) (*NextAppIDsResponse, error) {
	var result NextAppIDsResponse
	if err := c.doJSON(ctx, "GET", "/kms/phala/next_app_id", nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetAppEnvEncryptPubKey returns the environment encryption public key for an app.
func (c *Client) GetAppEnvEncryptPubKey(ctx context.Context, kmsType, appID string) (*AppEnvPubKeyResponse, error) {
	var result AppEnvPubKeyResponse
	path := fmt.Sprintf("/kms/%s/pubkey/%s", kmsType, appID)
	if err := c.doJSON(ctx, "GET", path, nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetKMSOnChainDetail returns KMS on-chain detail for a given chain.
func (c *Client) GetKMSOnChainDetail(ctx context.Context, chain string) (*KMSOnChainDetail, error) {
	var result KMSOnChainDetail
	if err := c.doJSON(ctx, "GET", "/kms/on-chain/"+chain, nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
