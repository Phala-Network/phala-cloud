package phala

import "context"

// GetCVMStatusBatch returns typed status information for multiple CVMs.
func (c *Client) GetCVMStatusBatch(ctx context.Context, vmUUIDs []string) (map[string]CVMStatusEntry, error) {
	var result map[string]CVMStatusEntry
	body := map[string][]string{"vm_uuids": vmUUIDs}
	if err := c.doJSON(ctx, "POST", "/status/batch", body, &result); err != nil {
		return nil, err
	}
	return result, nil
}
