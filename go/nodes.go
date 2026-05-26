package phala

import "context"

// GetAvailableNodes returns available nodes for CVM deployment.
func (c *Client) GetAvailableNodes(ctx context.Context) (*AvailableNodes, error) {
	var result AvailableNodes
	if err := c.doJSON(ctx, "GET", "/teepods/available", nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetCVMCreateResources returns the resource graph for CVM creation.
func (c *Client) GetCVMCreateResources(ctx context.Context) (*CVMCreateResources, error) {
	var result CVMCreateResources
	if err := c.doJSON(ctx, "GET", "/teepods/cvm-create-resources", nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetCVMCreateResourcesV20260121 returns the resource graph using the pre-hashid-only schema.
func (c *Client) GetCVMCreateResourcesV20260121(ctx context.Context) (*CVMCreateResourcesV20260121, error) {
	var result CVMCreateResourcesV20260121
	if err := c.doJSON(ctx, "GET", "/teepods/cvm-create-resources", nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
