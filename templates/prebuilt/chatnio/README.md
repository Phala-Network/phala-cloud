# Chatnio

Chatnio is a powerful **privacy-first** AI service management platform that supports 70+ AI models across text, image, audio, and video domains. By integrating with **Phala Network's secure computation framework**, Chatnio ensures that all AI model interactions and data processing occur within a trusted execution environment (TEE), providing unparalleled privacy protection for sensitive data. 

The platform offers flexible deployment options including open-source, commercial, and enterprise editions, featuring comprehensive model management, multi-tenant isolation, and end-to-end encrypted communications. With its scalable architecture and privacy-preserving design, Chatnio enables businesses and developers to securely manage and deploy AI services while maintaining strict data confidentiality.

**Notice**

Set these required environment variables before deploying:

- `MYSQL_ROOT_PASSWORD`: internal MySQL root password.
- `MYSQL_PASSWORD`: internal password for the `chatnio` MySQL user.
- `SECRET`: Chatnio JWT signing secret. Use at least 32 characters.
- `CHATNIO_ROOT_PASSWORD`: initial password for the `root` Chatnio admin user. Use 12-36 characters, do not include whitespace, and do not use Chatnio's public default password.

Example generation commands:

```sh
openssl rand -base64 32 # MYSQL_ROOT_PASSWORD
openssl rand -base64 32 # MYSQL_PASSWORD
openssl rand -hex 32    # SECRET
openssl rand -base64 24 # CHATNIO_ROOT_PASSWORD
```

Keep these values stable across redeploys. The template initializes the `root` admin user with `CHATNIO_ROOT_PASSWORD` before Chatnio starts, so the upstream fallback admin password `chatnio123456` is not used. MySQL and Redis are only reachable on the private compose network; the public web port remains `8000`.
