"""
Frost Night Factory - Remote Webhook Server
Runs on home PC, receives triggers from GitHub Actions or manual calls
"""

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
import subprocess
import asyncio
import os
import sys
from datetime import datetime
from pathlib import Path

app = FastAPI(title="Frost Night Factory Remote Server")

# CORS for dashboard access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
SECRET_TOKEN = os.getenv("WEBHOOK_SECRET", "CHANGE_THIS_TOKEN_PLEASE")
PROJECT_PATH = Path(os.getenv("PROJECT_PATH", "C:/Users/vilfro21/frost-night-factory"))
AGENT_RUNNER_PATH = PROJECT_PATH / "agent-runner"

# Global state
current_pipeline = None
pipeline_logs = []
MAX_LOGS = 1000

def log(message: str):
    """Add log with timestamp"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_line = f"[{timestamp}] {message}"
    print(log_line)
    pipeline_logs.append(log_line)
    if len(pipeline_logs) > MAX_LOGS:
        pipeline_logs.pop(0)

@app.get("/")
async def root():
    return {
        "service": "Frost Night Factory Remote Server",
        "status": "running",
        "version": "1.0.0"
    }

@app.post("/trigger")
async def trigger_pipeline(
    authorization: str = Header(None),
    request: Request = None
):
    """Trigger a new pipeline run"""
    global current_pipeline
    
    # Verify token
    if not authorization or authorization != f"Bearer {SECRET_TOKEN}":
        raise HTTPException(401, "Unauthorized - Invalid token")
    
    log("🚀 Pipeline trigger received")
    
    # Get request data
    data = await request.json() if request else {}
    branch = data.get("branch", "main")
    commit = data.get("commit", "unknown")
    
    log(f"📍 Branch: {branch}, Commit: {commit[:8]}")
    
    # Kill existing pipeline if running
    if current_pipeline and current_pipeline.poll() is None:
        current_pipeline.kill()
        log("⚠️ Killed previous pipeline")
    
    # Pull latest code
    try:
        log("📥 Pulling latest code from GitHub...")
        result = subprocess.run(
            ["git", "pull", "origin", branch],
            cwd=str(PROJECT_PATH),
            capture_output=True,
            text=True,
            timeout=30
        )
        log(f"Git output: {result.stdout.strip()}")
        if result.returncode != 0:
            log(f"⚠️ Git pull warning: {result.stderr}")
    except Exception as e:
        log(f"❌ Git pull failed: {e}")
        # Continue anyway - might be running on detached HEAD or local changes
    
    # Start new pipeline
    try:
        log("🏭 Starting Frost Night Factory pipeline...")
        
        # Use npm start in agent-runner
        current_pipeline = subprocess.Popen(
            ["npm", "start"],
            cwd=str(AGENT_RUNNER_PATH),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1
        )
        
        log(f"✅ Pipeline started (PID: {current_pipeline.pid})")
        
        return {
            "status": "started",
            "pid": current_pipeline.pid,
            "branch": branch,
            "commit": commit,
            "message": "Pipeline started successfully"
        }
    except Exception as e:
        log(f"❌ Failed to start pipeline: {e}")
        raise HTTPException(500, f"Failed to start pipeline: {e}")

@app.get("/status")
async def get_status():
    """Get current pipeline status"""
    if not current_pipeline:
        return {
            "status": "idle",
            "running": False,
            "message": "No pipeline has been started yet"
        }
    
    running = current_pipeline.poll() is None
    
    return {
        "status": "running" if running else "completed",
        "running": running,
        "pid": current_pipeline.pid,
        "exit_code": current_pipeline.returncode if not running else None
    }

@app.get("/logs")
async def get_logs(lines: int = 100):
    """Get recent logs"""
    return {
        "logs": pipeline_logs[-lines:],
        "total": len(pipeline_logs)
    }

@app.get("/logs/stream")
async def stream_logs():
    """Stream live logs via Server-Sent Events"""
    async def log_generator():
        # Send existing logs first
        for log_line in pipeline_logs[-50:]:
            yield f"data: {log_line}\n\n"
        
        # Stream new logs
        if not current_pipeline:
            yield "data: [SYSTEM] No pipeline running\n\n"
            return
        
        while current_pipeline.poll() is None:
            try:
                line = current_pipeline.stdout.readline()
                if line:
                    timestamp = datetime.now().strftime("%H:%M:%S")
                    log_line = f"[{timestamp}] {line.strip()}"
                    pipeline_logs.append(log_line)
                    yield f"data: {log_line}\n\n"
                else:
                    await asyncio.sleep(0.1)
            except Exception as e:
                yield f"data: [ERROR] {e}\n\n"
                break
        
        yield "data: [SYSTEM] Pipeline completed\n\n"
    
    return StreamingResponse(
        log_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )

@app.post("/stop")
async def stop_pipeline(authorization: str = Header(None)):
    """Stop the current pipeline"""
    global current_pipeline
    
    if not authorization or authorization != f"Bearer {SECRET_TOKEN}":
        raise HTTPException(401, "Unauthorized")
    
    if not current_pipeline or current_pipeline.poll() is not None:
        return {"status": "idle", "message": "No pipeline running"}
    
    current_pipeline.kill()
    log("🛑 Pipeline stopped by user")
    
    return {"status": "stopped", "message": "Pipeline killed"}

if __name__ == "__main__":
    import uvicorn
    
    print("=" * 60)
    print("🏭 FROST NIGHT FACTORY - Remote Server")
    print("=" * 60)
    print(f"📁 Project path: {PROJECT_PATH}")
    print(f"🔑 Token: {SECRET_TOKEN[:8]}...")
    print(f"🌐 Starting server on http://0.0.0.0:8080")
    print("=" * 60)
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8080,
        log_level="info"
    )

