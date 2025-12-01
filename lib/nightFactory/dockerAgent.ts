// lib/nightFactory/dockerAgent.ts
import { callAI } from "./modelClient";
import * as fs from 'fs';
import * as path from 'path';

/**
 * DOCKER AGENT: Genererar Docker-konfiguration för projekt
 * Stödjer Node.js, Python och hybrid-projekt
 */
export async function generateDockerConfig(
  workspacePath: string, 
  projectType: 'node' | 'python' | 'hybrid'
): Promise<boolean> {
  console.log(`🐳 Generating Docker config for ${projectType} project...`);

  const prompt = `
    You are a DevOps Engineer. Generate strictly valid configuration files.
    
    Project Type: ${projectType}
    
    Requirements:
    1. Create a production-ready 'Dockerfile'.
    2. Create a 'docker-compose.yml' that orchestrates the app and a Postgres DB.
    3. Create a '.dockerignore' file.
    
    For Node.js projects:
    - Use Node 20 LTS
    - Multi-stage build (builder + runner)
    - Install dependencies with npm ci --legacy-peer-deps
    - Expose port 3000
    
    For Python projects:
    - Use Python 3.11 slim
    - Install dependencies from requirements.txt
    - Use uvicorn for FastAPI or streamlit for Streamlit apps
    - Expose appropriate ports
    
    For Hybrid projects:
    - Combine both Node.js and Python services
    - Use docker-compose to orchestrate
    
    OUTPUT FORMAT (JSON only, no markdown):
    {
      "dockerfile": "string content...",
      "dockerCompose": "string content...",
      "ignoreFile": "string content..."
    }
  `;

  try {
    // Använd BACKEND-rollen (Qwen/DeepSeek) för Docker config (billigt och bra på config)
    const raw = await callAI("BACKEND", prompt);
    
    // Försök extrahera JSON från svaret
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("❌ Failed to extract JSON from AI response");
      return false;
    }

    const jsonStr = jsonMatch[0].replace(/```json/g, "").replace(/```/g, "").trim();
    const config = JSON.parse(jsonStr);

    // Skriv filerna
    if (config.dockerfile) {
      fs.writeFileSync(path.join(workspacePath, 'Dockerfile'), config.dockerfile);
      console.log("✅ Dockerfile created");
    }

    if (config.dockerCompose) {
      fs.writeFileSync(path.join(workspacePath, 'docker-compose.yml'), config.dockerCompose);
      console.log("✅ docker-compose.yml created");
    }

    if (config.ignoreFile) {
      fs.writeFileSync(path.join(workspacePath, '.dockerignore'), config.ignoreFile);
      console.log("✅ .dockerignore created");
    } else {
      // Fallback .dockerignore
      const defaultIgnore = `node_modules
.git
.env
.env.local
.next
dist
build
__pycache__
*.pyc
.python-version
`;
      fs.writeFileSync(path.join(workspacePath, '.dockerignore'), defaultIgnore);
      console.log("✅ Created default .dockerignore");
    }

    console.log("✅ Docker configuration generated successfully.");
    return true;
  } catch (e: any) {
    console.error("❌ Failed to generate Docker config:", e.message);
    
    // Fallback: Skapa minimala Docker-filer
    try {
      if (projectType === 'node' || projectType === 'hybrid') {
        const minimalDockerfile = `FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
`;
        fs.writeFileSync(path.join(workspacePath, 'Dockerfile'), minimalDockerfile);
      }
      
      if (projectType === 'python' || projectType === 'hybrid') {
        const pythonDockerfile = `FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
`;
        if (projectType === 'python') {
          fs.writeFileSync(path.join(workspacePath, 'Dockerfile'), pythonDockerfile);
        }
      }
      
      const minimalCompose = `version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/mydb
    depends_on:
      - db
  
  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=mydb
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
`;
      fs.writeFileSync(path.join(workspacePath, 'docker-compose.yml'), minimalCompose);
      
      console.log("✅ Created fallback Docker configuration");
      return true;
    } catch (fallbackError: any) {
      console.error("❌ Fallback Docker config also failed:", fallbackError.message);
      return false;
    }
  }
}

