# 🌐 Remote Development Setup Guide

This guide explains how to set up remote pipeline execution for Frost Night Factory.

## Overview

You (Mac/School) → Push to GitHub → Home PC Auto-Runs Pipeline → Monitor from Anywhere

## Prerequisites

- Home PC running Windows
- Python 3.10+ installed
- GitHub account
- Router access (for port forwarding) OR Tailscale account

---

## Setup Steps

### 1. Install Python Dependencies (Home PC)

```bash
cd C:\Users\vilfro21\frost-night-factory\remote-server
pip install -r requirements.txt
```

### 2. Configure Environment Variables (Home PC)

Create `.env` file in `remote-server/`:

```
WEBHOOK_SECRET=your-secret-token-here # Generate with: openssl rand -hex 32
PROJECT_PATH=C:/Users/vilfro21/frost-night-factory
```

### 3. Setup Tailscale (Easiest Option)

**On Home PC:**
1. Download: https://tailscale.com/download/windows
2. Install and login
3. Note your Tailscale IP (e.g., `100.64.1.5`)

**On Mac/Phone:**
1. Install Tailscale
2. Login with same account
3. Test: `ping 100.64.1.5`

### 4. Start Webhook Server (Home PC)

```bash
cd remote-server
python webhook-server.py
```

OR double-click: `start-server.bat`

You should see:
```
🏭 FROST NIGHT FACTORY - Remote Server
📁 Project path: C:\Users\vilfro21\frost-night-factory
🔑 Token: a1b2c3d4...
🌐 Starting server on http://0.0.0.0:8080
```

### 5. Configure GitHub Secrets

1. Go to: https://github.com/YOUR_USERNAME/frost-night-factory/settings/secrets/actions
2. Add two secrets:
   - `HOME_PC_URL`: `http://100.64.1.5:8080` (your Tailscale IP)
   - `HOME_PC_TOKEN`: Your webhook secret from .env

### 6. Test It!

**From any device:**
```bash
curl -X POST http://100.64.1.5:8080/trigger \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"branch": "main", "commit": "test"}'
```

**Expected:**
```json
{
  "status": "started",
  "pid": 12345,
  "message": "Pipeline started successfully"
}
```

### 7. Monitor from Browser

Open: `http://100.64.1.5:8080/logs`

Or integrate into your existing dashboard (see below).

---

## Integration with `/monitor` Page

Update `app/monitor/page.tsx`:

```tsx
// Add remote trigger button
<button
  onClick={async () => {
    const response = await fetch('http://100.64.1.5:8080/trigger', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer YOUR_TOKEN',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ branch: 'main', commit: 'manual' })
    })
    
    if (response.ok) {
      alert('✅ Pipeline started on home PC!')
    } else {
      alert('❌ Failed to start pipeline')
    }
  }}
  className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
>
  🚀 Run on Home PC
</button>
```

---

## Usage

### From Your Mac (Sofa)
1. Edit code: `vim agent-runner/pipeline-runner.ts`
2. Push: `git push origin main`
3. GitHub Action automatically triggers home PC
4. Monitor: `http://100.64.1.5:8080/logs`

### From School
1. Edit on school PC
2. Push to GitHub
3. Home PC pulls and runs automatically
4. Monitor on phone: open Tailscale app → `http://100.64.1.5:8080/logs`

### From Anywhere
Open your `/monitor` dashboard, click "🚀 Run on Home PC" button.

---

## Troubleshooting

**Server not responding:**
- Check if webhook-server.py is running on home PC
- Verify Tailscale is connected on both devices
- Check firewall isn't blocking port 8080

**GitHub Action fails:**
- Verify `HOME_PC_URL` and `HOME_PC_TOKEN` secrets are set
- Check home PC is online and Tailscale connected
- Look at Actions tab logs for details

**Pipeline doesn't start:**
- Check logs: `http://100.64.1.5:8080/logs`
- Verify `PROJECT_PATH` in .env is correct
- Ensure npm dependencies installed in agent-runner

---

## Security Notes

- Never commit `.env` file (add to `.gitignore`)
- Use strong token (32+ characters)
- Tailscale encrypts all traffic automatically
- For public internet, use Cloudflare Tunnel instead

---

## Advanced: Cloudflare Tunnel (Public Access)

If you want HTTPS access without Tailscale:

```bash
# Install cloudflared
winget install Cloudflare.cloudflared

# Authenticate
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create frost-factory

# Run tunnel
cloudflared tunnel --url http://localhost:8080 run frost-factory
```

Result: `https://frost-factory-abc123.trycloudflare.com`

Update GitHub secret `HOME_PC_URL` to this URL.

