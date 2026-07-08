# Local AI Fusion Boundary

The backend mainline owns the local AI bridge:

- Backend mainline: `/home/ubuntu/fe/fengQun/jiqun_ai_fresh`
- Bridge module: `src/local_ai_bridge.py`
- API router: `/api/local-ai/*`
- Local runtime: `/home/ubuntu/local-ai`
- Shiguan vault: `/home/ubuntu/CourtOS-Brain`

This frontend repository must not copy Ollama model files, local-ai runtime files, or the Obsidian vault. UI code should consume backend APIs only.

Primary backend endpoints:

```text
GET  /api/local-ai/status
GET  /api/local-ai/audit-courtos-brain
POST /api/local-ai/index-courtos-brain
POST /api/local-ai/ask
GET  /api/preflight    # includes localAI status
```

Frontend responsibility:

- Show local AI/Shiguan fusion status.
- Show read-only Shiguan audit signals from `audit-courtos-brain`.
- Let the user trigger safe backend actions.
- Display citations, status, and failures clearly.

Backend responsibility:

- Own model/provider routing.
- Index CourtOS-Brain through the local-ai bridge.
- Enforce command allowlists and timeout boundaries.
