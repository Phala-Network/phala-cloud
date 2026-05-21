# McDonald's China MCP

Deploy a protected proxy for the official McDonald's China Streamable HTTP MCP service on Phala Cloud.

The upstream service is hosted by McDonald's China at `https://mcp.mcd.cn` and supports tools for McDelivery ordering, in-store pickup, group meals, coupons, points redemption, nutrition data, nearby stores, and campaign calendars for mainland China users.

## Required environment variables

- `MCD_MCP_TOKEN`: Token from the McDonald's China MCP console at https://open.mcd.cn/mcp.
- `BEARER_TOKEN`: Token that your MCP client must send to this Phala Cloud deployment. Generate a strong value and keep it separate from `MCD_MCP_TOKEN`.

## MCP client configuration

After deployment, use your Phala Cloud app URL as the Streamable HTTP endpoint:

```json
{
  "mcpServers": {
    "mcd-mcp": {
      "type": "streamablehttp",
      "url": "https://YOUR-PHALA-APP-DOMAIN",
      "headers": {
        "Authorization": "Bearer YOUR_BEARER_TOKEN"
      }
    }
  }
}
```

## Notes

- The upstream MCP service supports MCP protocol version `2025-06-18` and earlier.
- McDonald's China limits each upstream token to 600 requests per minute.
- This template keeps `MCD_MCP_TOKEN` inside the CVM and sends it only to `mcp.mcd.cn`.
- The public Phala Cloud endpoint accepts requests only when the client presents `BEARER_TOKEN`.
