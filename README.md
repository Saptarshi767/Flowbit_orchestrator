# 🧠 Flowbit + LangFlow Orchestration System

This project is a **production-ready AI workflow orchestrator** combining **LangFlow** (for LLM flow creation) with **Flowbit** (Next.js-based frontend). It enables end-to-end real-time execution, monitoring, and logging of AI workflows.

---

## 🚀 Features

- 🔄 Auto-import LangFlow `.json` flows from `/flows/`
- ⚡ Trigger flows manually, via webhook, or on a cron schedule
- 📈 Real executions logged to `executions.json`
- 📡 Real-time log streaming using Server-Sent Events (SSE)
- 🧾 View past executions with detailed logs
- 🐳 Dockerized setup for LangFlow, Redis, Ollama

---

## 🗂 Project Structure

```
project-root/
├── app/                      # API routes
├── components/               # UI components (shadcn/ui)
├── flows/                    # LangFlow JSON workflows
├── logs/                     # Execution log files (*.log)
├── public/, styles/, lib/   # Frontend assets
├── run_flow.py              # Main executor for LangFlow flows
├── executions.json          # All past executions
├── docker-compose.yml       # LangFlow + Redis + Ollama stack
# Flowbit-Orchestrator: LangFlow-Powered Workflow Automation

This project provides a complete workflow orchestration system built using LangFlow for backend agent execution and a modern frontend interface (Flowbit) using Next.js and shadcn/ui. It supports manual, webhook, and cron-based triggers, and provides real-time execution logs using Server-Sent Events (SSE).

---

## Overview

LangFlow is used to design and save modular workflows (agents) as `.json` files. These are picked up by the Flowbit frontend automatically without needing a server restart. Users can trigger workflows from the UI, via API (webhook), or through scheduled cron jobs.

---

## System Architecture

The system includes:

- LangFlow (running inside Docker)
- Redis (for state sharing)
- Flowbit frontend (Next.js + Tailwind + shadcn/ui)
- API extensions to support triggers, polling workflows, and live SSE logs

---

## Project Structure

```
flowbit-orchestrator/
├── flows/                         # All LangFlow workflows (*.json)
├── docker-compose.yml            # Docker services: LangFlow + Redis
├── app/                          # Next.js application
│   ├── api/                      # API Routes
│   │   ├── executions/           # Runs LangFlow workflows and returns results
│   │   ├── hooks/[workflowId]/   # Webhook triggers for public workflows
│   │   ├── trigger/              # Manual/webhook/cron execution logic
│   │   └── langflow/workflows/   # Detects and lists saved flows
├── components/                   # UI Components
└── lib/cron.ts                   # Cron scheduling (via node-cron)
```

---


### 1. Clone and Install
```bash
git clone <repo-url>
cd flowbit-orchestrator
pnpm install
```

### 2. Start LangFlow + Redis + Ollama
```bash
```

### 3. Start Frontend
```bash
pnpm dev
```

---


Use the API to trigger:
```bash
curl -X POST http://localhost:3000/api/trigger \
  -H "Content-Type: application/json" \
  -d '{
    "workflow": "Email",
    "input": {
      "email_text": "Hey, when is our next meeting?"
    }
  }'
```

---

## 🔁 Trigger Types

| Type     | How it Works |
|----------|--------------|
| Manual   | Via UI modal with JSON input |
| Webhook  | `GET /api/hooks/:workflowId` |
| Cron     | Uses `lib/cron.ts` + JSON job store |

---

## 📡 SSE Log Streaming

- Route: `GET /api/langflow/runs/:id/stream`
- Returns: real-time logs from `logs/<id>.log`

---

## 📊 Execution Tracking

Each run is stored in `executions.json`:
```json
{
  "id": "uuid",
  "flow": "Email",
  "status": "Success",
  "duration": 2.3,
  "startTime": "2025-06-05T04:45:23.000Z",
  "input": {...},
  "output": "...",
  "error": null
}
```

---

## ✅ Agents Included

These flows are prebuilt and auto-loaded:
- `Email.json`
- `PDF.json`
- `Json agent.json`
- `Classifier.json`

---

## 🏁 Final Result

A fully working real-time orchestrator that:
- Connects LangFlow flows to a production-grade UI
- Executes real models via Ollama
- Tracks and streams execution logs
Access LangFlow at: `http://localhost:7860`

### Start Flowbit Frontend

```bash
pnpm install
pnpm dev
# or
npm install
npm run dev
```

Frontend is available at: `http://localhost:3000`
![Screenshot 2025-06-04 111502](https://github.com/user-attachments/assets/c161e2aa-ccff-4444-bc99-e30dd1932830)

---

## Creating Workflows in LangFlow
![Screenshot 2025-06-04 111507](https://github.com/user-attachments/assets/295bc132-34cd-45f6-b72c-42a7c9ee694a)

Create agents in LangFlow using this structure:

```
Chat Input → PromptTemplate → OllamaModel → Chat Output
```

Then save the workflow in the `/flows` directory. Example agents:

### Email Agent

- Prompt: `Classify the intent of this email: {email_text}`
- Input Variable: `email_text`

### PDF Agent

- Prompt: `Summarize the following PDF content: {text}`
- Input Variable: `text`

### JSON Agent

- Prompt: `Extract key fields from JSON: {json_input}`
- Input Variable: `json_input`

### Classifier Agent

- Prompt: `What is the intent of this message: {text}`
- Input Variable: `text`

Each agent should be saved in `flows/` as:
- `Email Agent.json`
- `PDF Agent.json`
- `JSON Agent.json`
- `Classifier Agent.json`

---

## Trigger Methods

### Manual Trigger (UI or API)

```http
POST /api/trigger
Content-Type: application/json

{
  "workflow": "JSON Agent",
  "input": {
    "json_input": "{"user": "Alice"}"
  }
}
```

### Webhook Trigger

```http
GET /api/hooks/JSON Agent
```

### Cron Scheduling

Edit `lib/cron.ts` to register cron jobs like:

```ts
registerCron("*/5 * * * *", "PDF Agent", { text: "Quarterly report PDF content here." });
```

---

## Execution Log Streaming

Flowbit fetches step-by-step log updates from LangFlow using SSE:

```
GET /api/langflow/runs/:id/stream
```

These logs are displayed inside the Execution Details modal.

---

## Screenshot

Add this markdown below once you capture your UI screenshot:

```md
![Flowbit Workflow UI](./screenshots/flowbit-dashboard.png)
```

Create a `screenshots/` folder in the repo and place the PNG file there.

---
![Screenshot 2025-06-04 111517](https://github.com/user-attachments/assets/cbb02af5-53db-40c9-ac98-14fc58c943a9)

## API Summary

| Route                                | Method | Description                                      |
|-------------------------------------|--------|--------------------------------------------------|
| /api/langflow/workflows             | GET    | Lists all `.json` workflows from `flows/`        |
| /api/hooks/[workflowId]             | GET    | Public webhook trigger for a workflow            |
| /api/trigger                         | POST   | Manual or cron-based workflow execution          |
| /api/langflow/runs                  | GET    | (Mock) List recent executions                    |
| /api/langflow/runs/:id/stream       | GET    | Server-Sent Events (SSE) for live logs           |

---

## License

MIT License. Use this project freely with attribution.

