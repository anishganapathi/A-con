# Acon

**Architectural plans → intelligent 3D models and iterations.**  
Private construction intelligence, on-premises.

Acon is a local-first agent for construction and architecture teams. Upload a floor plan, get a measured 3D building, then edit it in chat — resize rooms, adjust the roof, add or remove MEP runs, compare the sheet against the model. Inference runs on a **Qwen3-VL GGUF** served by **llama.cpp** on the Dell Pro Max GB10. **NemoClaw** reviews edits and blocks out-of-scale or overflowing changes before they land.

No cloud API in the default path. Drawings stay on the box.

---

## What it does

| Capability | Example prompt |
| --- | --- |
| **Build from a sheet** | Attach a floor plan → `make this house plan` |
| **Ask the model** | `how tall is the roof?` |
| **Edit in chat** | `increase the kitchen dimensions`, `raise the ridge to 9m` |
| **Compare** | Overlay uploaded drawings on the live 3D model |
| **MEP** | `add a pipe in the living room`, `remove the balcony water pipe` |
| **Safety** | NemoClaw card on bad edits (e.g. room overflow) — Accept or Decline |

**UI:** Plan and Experience modes, floor selector, view gizmo (cardinal snaps), drawing compare panel, animated model transitions, middle-mouse pan (Figma-style).

**Agent:** Master intent router → tool calls (`edit_live_model`, `propose_building`, `match_elevation`, …). Vision reads drawings; edits bind to real room/wall/opening IDs in the live plan.

---

## Requirements

- **Node.js 22.18+** (server runs TypeScript directly — no separate server build)
- **llama.cpp** (or compatible OpenAI-compat server) with **Qwen3-VL** on port **8080**
- Optional fallbacks: Ollama, Replicate, Groq, OpenAI — see `.env.example`

---

## Development

```bash
npm install
cp .env.example .env   # set ECON_LOCAL_LLM_URL if the VL box is not at the default
npm run dev            # Vite at http://localhost:5173 — renderer + agent API
```

Point `ECON_LOCAL_LLM_URL` at your vision server, e.g. `http://127.0.0.1:8080/v1`.

```bash
npm test               # vitest
npm run build          # dist/ for production
npm start              # serve dist/ + API on PORT (default 4173)
```

---

## Production on Linux (GB10 / demo box)

One script from clone to running app:

```bash
git clone https://github.com/anishganapathi/A-con.git
cd A-con
./start.sh
```

`start.sh` can bootstrap Node/git on a bare machine, build, serve, and show an interactive menu (update, rebuild, restart, logs, VL status). Open `http://<box-ip>:4173` on the LAN.

On the same machine as llama.cpp:

```bash
ECON_LOCAL_LLM_URL=http://127.0.0.1:8080/v1 ./start.sh
```

For systemd, port/host config, and troubleshooting → **[deploy/README.md](deploy/README.md)**.

---

## Configuration

Copy `.env.example` to `.env`. Main variables:

| Variable | Purpose |
| --- | --- |
| `ECON_LOCAL_LLM_URL` | OpenAI-compat base URL for the VL model (default LAN `:8080`) |
| `ECON_LOCAL_LLM_MODEL` | GGUF name, e.g. `Qwen3VL-30B-A3B-Instruct-Q4_K_M.gguf` |
| `ECON_AGENT_PROVIDER` | Force `local` (default when the box is up) |
| `PORT` / `HOST` | Production server bind (default `4173` / `0.0.0.0`) |

Chat shows `local / Qwen3VL-…` on assistant turns when the local VL is active.

---

## Desktop (optional)

Electron wrapper — same server, native window:

```bash
npm run desktop          # dev
npm run desktop:package  # build app bundle
```

See [desktop-acon/README.md](desktop-acon/README.md).

---

## Stack

- **Frontend:** React 19, Vite, React Three Fiber, drei, motion
- **Agent:** Master intent + tool routing, measured floor layout, edit binding, NemoClaw review
- **Server:** Node `server/serve.ts` + `server/httpServer.ts` — static `dist/` and `/api/agent`
- **Model:** Qwen3-VL via llama.cpp (primary); keyword/intent fallbacks when no model is reachable

---

## License

Private / hackathon submission. See repository for IP terms.
