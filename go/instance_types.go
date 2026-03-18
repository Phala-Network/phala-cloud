package phala

import "context"

// ListAllInstanceTypeFamilies returns all instance type families.
func (c *Client) ListAllInstanceTypeFamilies(ctx context.Context) (*InstanceTypeFamiliesResponse, error) {
	var result InstanceTypeFamiliesResponse
	if err := c.doJSON(ctx, "GET", "/instance-types", nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// ListFamilyInstanceTypes returns instance types in a specific family.
func (c *Client) ListFamilyInstanceTypes(ctx context.Context, family string) (*FamilyInstanceTypesResponse, error) {
	var result FamilyInstanceTypesResponse
	if err := c.doJSON(ctx, "GET", "/instance-types/"+family, nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
