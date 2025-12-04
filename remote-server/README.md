# 🏭 Frost Night Factory - Remote Server

Webhook server that runs on your home PC to trigger pipeline executions remotely.

## Quick Start

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Create `.env` file:**
   ```
   WEBHOOK_SECRET=your-secret-token-here
   PROJECT_PATH=C:/Users/vilfro21/frost-night-factory
   ```

3. **Start server:**
   ```bash
   python webhook-server.py
   ```
   
   Or double-click `start-server.bat` on Windows.

## API Endpoints

- `GET /` - Health check
- `POST /trigger` - Start a new pipeline (requires Bearer token)
- `GET /status` - Check if pipeline is running
- `GET /logs` - Get recent logs
- `GET /logs/stream` - Stream live logs (SSE)
- `POST /stop` - Stop current pipeline (requires Bearer token)

## Security

- Always use a strong `WEBHOOK_SECRET` token
- Never commit `.env` file to git
- Use Tailscale or VPN for secure access
- For public access, use Cloudflare Tunnel

## See Also

- [Complete Setup Guide](../docs/REMOTE_SETUP.md)
- [GitHub Actions Workflow](../.github/workflows/trigger-home-pc.yml)

