# F1 Live Telemetry Platform

[![Live Demo](https://img.shields.io/badge/Live_Demo-Visit_App-FF1801?style=for-the-badge&logo=vercel&logoColor=white)](https://harry-s-f1-data.vercel.app)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react&logoColor=black)](https://reactjs.org/)
[![Python](https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat-square&logo=vercel&logoColor=white)](https://vercel.com)

A real-time Formula 1 telemetry and analytics dashboard built from scratch. Consumes live F1 timing data via the OpenF1 API and FastF1 SignalR bridge, rendering race telemetry, championship standings, driver comparisons, and race predictions in a glassmorphism-style React UI.

## Live Demo

👉 **[harry-s-f1-data.vercel.app](https://harry-s-f1-data.vercel.app)**

## Features

- **Live Telemetry Pipeline** — Polls and re-sorts competitive metrics every 5 seconds across the full grid via OpenF1 API
- **Race Hub Dashboard** — Next race countdown, localized schedule, championship standings with team theming
- **Driver & Constructor Standings** — Real-time standings widgets with F1 team colour branding
- **Race Predictions** — ML-style predictions using live session data from OpenF1
- **Historical Race Replay** — Browser-native replay running directly on OpenF1 session, lap, race-control, and position data
- **FastF1 Live Bridge** — Python FastAPI server bridging F1TV SignalR broadcast arrays for sub-second telemetry
- **RAG-Powered Queries** — PostgreSQL with pgvector for vector similarity search on historical race data

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript (Vite + SWC) |
| Styling | Vanilla CSS — glassmorphism, team-branded gradients |
| Backend | Python FastAPI (telemetry bridge) |
| Database | PostgreSQL + pgvector (Neon) |
| Live Data | OpenF1 API, FastF1, F1TV SignalR |
| LLM Integration | OpenRouter API |
| Deployment | Vercel Edge Network |
| Auth | Supabase Google Sign-In |

## Architecture

```
                    ┌─────────────────────────────┐
                    │        Vercel Edge           │
                    │   React + TypeScript SPA     │
                    └──────────┬──────────────────┘
                               │
            ┌──────────────────┼──────────────────┐
            ▼                  ▼                   ▼
      ┌───────────┐    ┌──────────────┐   ┌──────────────┐
      │  OpenF1   │    │  FastAPI     │   │  PostgreSQL  │
      │  REST API │    │  SignalR     │   │  + pgvector  │
      │  (live)   │    │  Bridge      │   │  (Neon)      │
      └───────────┘    └──────────────┘   └──────────────┘
```

## Running Locally

```bash
# Install dependencies
npm install

# Start the dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

For the live telemetry tab, the Python FastAPI bridge must be running:

```bash
cd server
pip install -r requirements.txt
python f1live.py
```

## Project Structure

```
f1-live-telemetry-platform/
├── src/
│   ├── components/     # React components (HUD, widgets, charts)
│   ├── services/       # OpenF1 API client, telemetry parsing
│   ├── hooks/          # Custom React hooks (live polling, countdowns)
│   └── lib/            # Utilities and type definitions
├── server/
│   └── f1live.py       # Python FastAPI — FastF1 SignalR bridge
├── supabase/           # Auth and database configuration
└── tests/              # Playwright E2E test suite
```

## Author

**Harishmaran Subbaiah Thirumaran**
[linkedin.com/in/harishmaran](https://linkedin.com/in/harishmaran) · [harryportfolio-gamma.vercel.app](https://harryportfolio-gamma.vercel.app)

