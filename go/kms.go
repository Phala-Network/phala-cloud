package phala

import (
	"context"
	"fmt"
)

// GetKMSList returns the list of KMS servers (legacy, node-centric shape).
//
// Deprecated: From API version 2026-06-23 the KMS API is contract-centric. Use
// ListKMSContracts to list contracts and ListKMSContractNodes to list a
// contract's nodes. This method stays pinned to the legacy node-list shape.
func (c *Client) GetKMSList(ctx context.Context) (*GetKMSListResponse, error) {
	var result GetKMSListResponse
	if err := c.doJSONVersioned(ctx, "GET", "/kms", "2026-05-22", nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// ListKMSContracts returns the list of available KMS contracts.
func (c *Client) ListKMSContracts(ctx context.Context) (*ListKMSContractsResponse, error) {
	var result ListKMSContractsResponse
	if err := c.doJSONVersioned(ctx, "GET", "/kms", kmsContractAPIVersion, nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetKMSContract returns a single KMS contract by slug (a kc_ hashed id also resolves).
func (c *Client) GetKMSContract(ctx context.Context, slug string) (*KMSContract, error) {
	var result KMSContract
	if err := c.doJSONVersioned(ctx, "GET", "/kms/"+slug, kmsContractAPIVersion, nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// ListKMSContractNodes returns the KMS nodes (with RPC url) under a contract.
func (c *Client) ListKMSContractNodes(ctx context.Context, slug string) (*ListKMSContractNodesResponse, error) {
	var result ListKMSContractNodesResponse
	if err := c.doJSONVersioned(ctx, "GET", "/kms/"+slug+"/nodes", kmsContractAPIVersion, nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetKMSInfo returns information about a specific KMS node.
//
// Pinned to the node-keyed shape: kmsID resolves a KMS node. From API version
// 2026-06-23 the same path resolves a contract; use GetKMSContract instead.
func (c *Client) GetKMSInfo(ctx context.Context, kmsID string) (*KMSInfo, error) {
	var result KMSInfo
	if err := c.doJSONVersioned(ctx, "GET", "/kms/"+kmsID, "2026-05-22", nil, &result); err != nil {
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
//
// Pinned to the node-keyed shape: kmsType is a KMS node id/slug.
func (c *Client) GetAppEnvEncryptPubKey(ctx context.Context, kmsType, appID string) (*AppEnvPubKeyResponse, error) {
	var result AppEnvPubKeyResponse
	path := fmt.Sprintf("/kms/%s/pubkey/%s", kmsType, appID)
	if err := c.doJSONVersioned(ctx, "GET", path, "2026-05-22", nil, &result); err != nil {
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
