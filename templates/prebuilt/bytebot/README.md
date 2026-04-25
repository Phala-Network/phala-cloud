# ByteBot Template

Deploy ByteBot, an open-source AI desktop agent, on Phala Cloud's secure TEE infrastructure. ByteBot can control a computer desktop to complete tasks for you, running in Docker containers on your own infrastructure.

## What is ByteBot?

ByteBot is an open-source AI agent that can control a computer desktop to complete tasks for you. It runs in Docker containers on your own infrastructure, giving you a virtual assistant that can:

- Use any desktop application (browser, email, office tools, etc.)
- Process uploaded files including PDFs, spreadsheets, and documents
- Read entire files directly into the LLM context for rapid analysis
- Automate repetitive tasks like data entry and form filling
- Handle complex workflows that span multiple applications
- Work 24/7 without human supervision

Simply describe what you need done in plain English, and ByteBot will figure out how to do it – clicking buttons, typing text, navigating websites, reading documents, and completing tasks just like a human would.

## Architecture

This template deploys four main components:

1. **ByteBot Desktop** (`bytebot-desktop`): Ubuntu 22.04 with XFCE4, VSCode, Firefox, Thunderbird email client, and automation daemon (bytebotd)
2. **PostgreSQL Database** (`postgres`): Stores task data and configuration
3. **ByteBot Agent** (`bytebot-agent`): NestJS service that uses LLMs to plan and execute tasks
4. **ByteBot UI** (`bytebot-ui`): Next.js web app for creating and managing tasks

## Features

- 🤖 **Natural Language Control**: Just tell ByteBot what you need done. No coding or complex automation tools required.
- 🖥️ **Full Desktop Access**: ByteBot can use any application you can install - browsers, office tools, custom software.
- 🔒 **Complete Privacy**: Runs entirely on your infrastructure. Your data never leaves your servers.
- 🔄 **Two Operating Modes**: Autonomous Mode for independent task completion and Takeover Mode for manual intervention.
- 🖱️ **Direct Desktop Access**: Desktop tab for free-form access and Task View for monitoring execution.
- 🚀 **Easy Deployment**: One-click deployment with Docker Compose.
- 🔌 **Developer-Friendly**: REST APIs for programmatic control and extensible architecture.

## Quick Start

### Prerequisites

- Docker and Docker Compose installed
- At least one of the following API keys:
  - Anthropic Claude API key
  - OpenAI GPT API key
  - Google Gemini API key

### Required Environment Variables

Create a `.env` file in the same directory as your `docker-compose.yml` with the following variables:

```bash
# Required: At least one LLM API key must be provided
ANTHROPIC_API_KEY=your_anthropic_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
```

**Note**: You must provide at least one of the API keys above. ByteBot will use whichever keys you provide.

### Optional Environment Variables

```bash
# Database connection string (defaults to internal PostgreSQL)
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/bytebotdb

# Service URLs (usually don't need to be changed)
BYTEBOT_DESKTOP_BASE_URL=http://bytebot-desktop:9990
BYTEBOT_AGENT_BASE_URL=http://bytebot-agent:9991
BYTEBOT_DESKTOP_VNC_URL=http://bytebot-desktop:9990/websockify
```

### Deployment

1. **Clone or download this template**
2. **Set up environment variables** (see above)
3. **Deploy with Docker Compose**:

```bash
docker-compose up -d
```

4. **Access ByteBot**:
   - **Web UI**: http://localhost:9992
   - **Desktop VNC**: http://localhost:9990
   - **Agent API**: http://localhost:9991

## Usage

### Creating Tasks

1. Open the ByteBot web interface at `http://localhost:9992`
2. Click "Create New Task"
3. Describe what you want ByteBot to do in natural language
4. Submit the task and watch ByteBot execute it

### Task Examples

- **"Download my bank statement from the online banking portal and save it to the desktop"**
- **"Open Excel, create a new spreadsheet with columns for Name, Email, and Phone, and enter the data from the PDF I uploaded"**
- **"Navigate to the company website, fill out the contact form with the information from the CSV file, and submit it"**
- **"Open the email client, compose a new message with the quarterly report attached, and send it to the management team"**

### Monitoring and Control

- **Task View**: Watch ByteBot execute tasks in real-time
- **Desktop Tab**: Take manual control when needed
- **Task History**: Review completed tasks and their outputs
- **Screenshots**: View screenshots taken during task execution

## Ports

- **9990**: ByteBot Desktop (VNC and automation daemon)
- **9991**: ByteBot Agent API
- **9992**: ByteBot Web UI
- **5432**: PostgreSQL Database (localhost only)

## Security Features

- **Container Isolation**: Each service runs in its own Docker container
- **Network Isolation**: Services communicate only through the internal `bytebot-network`
- **Local Database**: PostgreSQL only accessible from localhost
- **TEE Integration**: Leverage Phala Cloud's secure computation framework

## Troubleshooting

### Common Issues

1. **VNC Connection Issues**: Ensure port 9990 is accessible and not blocked by firewall
2. **API Key Errors**: Verify at least one LLM API key is set in your environment variables
3. **Database Connection**: Check that PostgreSQL is running and accessible on port 5432
4. **Memory Issues**: ByteBot Desktop requires at least 2GB of shared memory (`shm_size: "2g"`)

### Logs

View logs for specific services:

```bash
# View all services
docker-compose logs

# View specific service
docker-compose logs bytebot-agent
docker-compose logs bytebot-desktop
docker-compose logs bytebot-ui
```

### Restart Services

```bash
# Restart all services
docker-compose restart

# Restart specific service
docker-compose restart bytebot-agent
```

## Advanced Configuration

### Custom Desktop Environment

You can customize the desktop environment by modifying the `bytebot-desktop` service in the docker-compose file. The desktop runs Ubuntu 22.04 with XFCE4 by default.

### API Integration

ByteBot provides REST APIs for programmatic control:

- **Task Management**: Create, monitor, and manage tasks
- **Direct Desktop Control**: Send commands directly to the desktop
- **File Operations**: Upload, download, and process files

### Scaling

For production deployments, consider:

- Using external PostgreSQL database
- Setting up reverse proxy (nginx/traefik)
- Implementing health checks and monitoring
- Adding SSL/TLS encryption

## Resources

- [ByteBot Documentation](https://docs.bytebot.ai/introduction)
- [ByteBot GitHub Repository](https://github.com/bytebot-ai/bytebot)
- [Phala Cloud Documentation](https://docs.phala.network/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)

## Support

- Join the [ByteBot Discord Community](https://discord.gg/zcb5wA2t4u)
- Report issues on [GitHub](https://github.com/bytebot-ai/bytebot)

---

**Ready to give your AI its own computer?** Deploy this template and start automating desktop tasks with natural language commands!
