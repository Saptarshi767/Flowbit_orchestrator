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
```

---

## ⚙️ Setup Instructions

### 1. Clone and Install
```bash
git clone <repo-url>
cd flowbit-orchestrator
pnpm install
```

### 2. Start LangFlow + Redis + Ollama
```bash
docker-compose up
```

### 3. Start Frontend
```bash
pnpm dev
```

---

## 🧪 Triggering a Workflow

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