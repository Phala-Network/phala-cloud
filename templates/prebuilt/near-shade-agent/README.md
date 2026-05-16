# NEAR Shade Agent Template

Deploy verifiable blockchain agents and oracles on NEAR Protocol using Phala Cloud's TEE infrastructure. This template includes an ETH price oracle example and provides a framework for custom agent development with hardware-backed security.

[![Deploy on Phala Cloud](https://cloud.phala.com/deploy-button.svg)](https://cloud.phala.com/templates/near-shade-agent)

## Features

- 🔐 **TEE Security**: All operations run in Phala Cloud's Trusted Execution Environment
- 🌐 **NEAR Integration**: Direct interaction with NEAR Protocol blockchain
- 📊 **Oracle Framework**: Built-in ETH price oracle with extensible architecture
- 🚀 **Dual Deployment**: Support for local development and TEE production deployment
- 🐳 **Docker Ready**: Complete containerization for easy deployment
- 🔑 **Private Key Management**: Secure storage and handling in TEE environment
- 🛡️ **Attestation**: Hardware-based proof of execution environment
- 📡 **REST API**: Complete API endpoints for agent interaction

## Quick Start

### 1. Prerequisites

Before deployment, ensure you have:
- NEAR testnet account created via `near-cli-rs`
- Phala Cloud account and API key
- Docker installed (for local development)
- Basic understanding of NEAR Protocol and smart contracts

### 2. Environment Configuration

Configure the following environment variables:

#### Required Environment Variables

- `NEAR_ACCOUNT_ID`: Your NEAR account ID obtained from near-cli-rs
- `NEAR_SEED_PHRASE`: NEAR account seed phrase for authentication
- `NEXT_PUBLIC_contractId`: Contract ID format:
  - **Local**: `ac-proxy.[NEAR_ACCOUNT_ID]` 
  - **Phala Cloud**: `ac-sandbox.[NEAR_ACCOUNT_ID]`
- `API_CODEHASH`: Shade agent API code hash (do not modify)
  - Default: `a86e3a4300b069c08d629a38d61a3d780f7992eaf36aa505e4527e466553e2e5`
- `APP_CODEHASH`: Your app's code hash (updates automatically)
  - Default: `af0c4432864489eb8c6650a6dc61f03ef831240a4199e602cd4d6bd8f4d7163f`
- `DOCKER_TAG`: Docker image tag in format `docker_username/image_name`
  - Default: `pivortex/my-app`
- `PHALA_API_KEY`: API key from [Phala Cloud Dashboard](https://cloud.phala.com/dashboard/tokens)

### 3. Deployment Options

#### Option A: Phala Cloud Deployment (Recommended)

1. Click the **Deploy on Phala Cloud** button above
2. Configure environment variables in Phala Cloud dashboard
3. Wait for deployment completion
4. Access your agent via provided URL

#### Option B: Local Development

1. Clone the template repository:
   ```bash
   git clone https://github.com/HashWarlock/shade-agent-template.git -b phala-cloud
   cd shade-agent-template
   ```

2. Configure environment:
   ```bash
   cp .env.development.local.example .env.development.local
   # Edit .env.development.local with your values
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Start development server:
   ```bash
   npm run dev
   ```

5. Access at `https://localhost:3000`

## API Endpoints

The template provides these REST API endpoints:

### Agent Account Details
- **GET** `/api/agent-account`
- **Description**: Returns NEAR agent account information and status
- **Authentication**: None at the HTTP layer; requires a real NEAR testnet account, seed phrase, and Phala API key for a successful agent-account response
- **Response**:
```json
{
  "accountId": "your-agent.testnet",
  "balance": "1000.5 NEAR"
}
```

### Ethereum Account Details  
- **GET** `/api/eth-account`
- **Description**: Get Ethereum account information for oracle operations
- **Authentication**: None at the HTTP layer
- **Response**:
```json
{
  "senderAddress": "0x1234567890123456789012345678901234567890",
  "balance": 0.5
}
```

### Send Transaction
- **GET** `/api/transaction`
- **Description**: Send the ETH price oracle update transaction through the TEE agent
- **Authentication**: None at the HTTP layer; requires real NEAR testnet credentials, a valid Phala API key, and funding for the derived Ethereum account
- **Response**:
```json
{
  "txHash": "0xabcdef...",
  "newPrice": "2500.00"
}
```

## Smoke Testing

For shallow deployment smoke tests, generated dummy values for `NEAR_SEED_PHRASE` and `PHALA_API_KEY` can bring up the web app and allow `GET /` plus `GET /api/eth-account` to respond. These checks only verify that the image is serving and that the Ethereum account derivation route is reachable.

`GET /api/agent-account` and `GET /api/transaction` are expected to fail with dummy NEAR or Phala credentials. Full agent-account and transaction behavior requires a real NEAR testnet account ID, the matching seed phrase, a valid Phala API key, the correct `NEXT_PUBLIC_contractId`, and any required funding for the derived Ethereum account. During dummy-credential smoke tests, the `shade-agent-api` sidecar may restart while failing to authenticate; treat that as expected unless real credentials were provided.

## Architecture

```
┌─────────────────────────────────────────┐
│           Phala Cloud TEE               │
├─────────────────────────────────────────┤
│  ┌─────────────────┐ ┌─────────────────┐ │
│  │  Shade Agent    │ │  Shade Agent    │ │
│  │    API Server   │ │   Frontend App  │ │
│  │ (mattdlockyer)  │ │  (Custom Image) │ │
│  └─────────┬───────┘ └────────┬────────┘ │
│            │                  │          │
│  ┌─────────┴──────────────────┴────────┐ │
│  │       TEE Socket (/var/run/tappd)   │ │
│  └─────────────────────────────────────────┘ │
└─────────────────────────────────────────┘
              │
    ┌─────────┴─────────┐
    │  NEAR Protocol    │
    │     Testnet       │
    └───────────────────┘
```

### Components

1. **Shade Agent API**: Core TEE agent handling NEAR interactions
2. **Frontend Interface**: React-based user interface for agent interaction  
3. **Oracle Service**: ETH price feed oracle with configurable intervals
4. **TEE Security Layer**: Phala Cloud confidential computing integration

### Security Features

- **Private Key Management**: Secure storage in TEE environment
- **Attestation**: Hardware-based proof of execution environment
- **Network Isolation**: Restricted external network access
- **Audit Logging**: Complete operation tracking for security

## Environment Details

### Local Development Environment
- Uses `ac-proxy.[NEAR_ACCOUNT_ID]` contract prefix
- Direct NEAR testnet connectivity
- Local Docker composition
- Development-friendly logging and debugging

### TEE Production Environment  
- Uses `ac-sandbox.[NEAR_ACCOUNT_ID]` contract prefix
- Enhanced security through hardware attestation
- Phala Cloud managed infrastructure
- Production-grade monitoring and alerting

## Customization

### Adding Custom Oracle Logic

1. Modify the oracle service configuration
2. Implement custom data fetching logic
3. Update smart contract integration points
4. Test thoroughly in development environment

### Extending Agent Capabilities

1. Add new API endpoints for additional functionality
2. Integrate with other blockchain protocols as needed
3. Implement custom business logic in secure TEE environment
4. Update frontend interface to support new features

## Troubleshooting

### Common Issues

**Issue**: "Not a git repository" error during deployment
**Solution**: Ensure you're deploying from a proper git repository context

**Issue**: Environment variables not loading
**Solution**: Verify `.env` file format and variable names match requirements:
```bash
# Check required variables are set
echo "NEAR_ACCOUNT_ID: $NEAR_ACCOUNT_ID"
echo "NEXT_PUBLIC_contractId: $NEXT_PUBLIC_contractId" 
echo "PHALA_API_KEY: ${PHALA_API_KEY:0:10}..." # Show only first 10 chars
```

**Issue**: NEAR connection failures
**Solution**: 
1. Check NEAR_ACCOUNT_ID and NEAR_SEED_PHRASE configuration
2. Test NEAR RPC connectivity:
```bash
curl -s https://rpc.testnet.near.org/status
```

**Issue**: Docker container startup failures
**Solution**: 
1. Verify Docker daemon is running and images are available
2. Check container logs:
```bash
docker-compose logs shade-agent-app
docker-compose logs shade-agent-api
```

**Issue**: TEE Socket Connection Failures  
**Symptoms**: "Cannot connect to tappd socket" errors
**Solution**:
1. Verify TEE daemon status (Phala Cloud specific)
2. Check socket file permissions:
```bash
ls -la /var/run/tappd.sock
```

**Issue**: Contract ID Format Errors
**Symptoms**: "Invalid contract ID" errors in logs
**Solution**:
- **Local development**: Use `ac-proxy.[NEAR_ACCOUNT_ID]`
- **TEE deployment**: Use `ac-sandbox.[NEAR_ACCOUNT_ID]`
- Update `NEXT_PUBLIC_contractId` environment variable accordingly

### Getting Help

- Review the [NEAR Protocol documentation](https://docs.near.org/)
- Check [Phala Cloud documentation](https://docs.phala.com/phala-cloud/getting-started/overview)
- Submit issues to the [template repository](https://github.com/HashWarlock/shade-agent-template/issues)

## Security Considerations

⚠️ **Important Security Notes**:

- **Never commit seed phrases or private keys** to version control
- Always use environment variables for sensitive configuration
- Regularly rotate API keys and access credentials
- Monitor agent operations for unexpected behavior
- All sensitive operations run in TEE environment
- Private keys never leave secure enclave
- Request/response data is encrypted in transit
- Audit logging for all authenticated operations

⚠️ **Audit Warning**: This technology has not yet undergone formal security audit. Please conduct your own due diligence before production use.

## Performance Considerations

### Resource Requirements
- **CPU**: 2 vCPU minimum for agent processing
- **Memory**: 4GB RAM for Next.js application and NEAR SDK
- **Disk**: 20GB storage for containers and logs
- **Network**: Stable connection to NEAR RPC and external APIs

### Rate Limiting
- **Standard endpoints**: 100 requests per minute per IP
- **Transaction endpoints**: 10 requests per minute per authenticated user

## Resources

- [NEAR Shade Agent Template Repository](https://github.com/HashWarlock/shade-agent-template/tree/phala-cloud)
- [NEAR Protocol Documentation](https://docs.near.org/)
- [Phala Cloud TEE Documentation](https://docs.phala.com/phala-cloud/getting-started/overview)
- [Phala Cloud Dashboard](https://cloud.phala.com/dashboard/)

## Contributing

Contributions are welcome! Please read the contributing guidelines and submit pull requests for improvements.

## License

This template is provided as-is for educational and development purposes. Please review licensing terms before production use.
