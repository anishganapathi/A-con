# Acon × Dell Pro Max with GB10 — deck copy

Paste-ready copy for the Figma deck template (16:9, 8×8 grid).
Layout names map to the template: cover, statement, contents, section divider,
two-column, 3-up / 4-up cards, steps, compare, table, stats, roadmap, close.

Positioning: automated 3D building generation, running entirely inside the firm
on Qwen-VL. Gemini 3.5 Flash on Replicate comes out of the loop.

---

## 01 — Cover

**Kicker:** Acon × Dell Pro Max GB10

**Title:** Automated 3D building generation, entirely on-premises.

**Subtitle:** Drawings in, measured 3D out. Qwen-VL running locally on Dell Pro
Max with GB10 — no Gemini, no cloud.

**Meta left:** Integration proposal
**Meta right:** August 2026

---

## 02 — Statement

Nothing on the market does this without sending your drawings to someone else's cloud.

---

## 03 — Contents

**Kicker:** Agenda

| No. | Title | One-liner |
|-----|-------|-----------|
| 01 | The product | What Acon does today |
| 02 | The gap | Why this category is empty |
| 03 | The constraint | Confidential drawings |
| 04 | The machine | Dell Pro Max with GB10 |
| 05 | The models | Qwen-VL, running locally |
| 06 | The plan | Ship path, risks, and the ask |

---

## 04 — Section divider

**01 — The product**

---

## 05 — What Acon does (two column)

**Kicker:** 01 — The product

**Headline:** A prompt or a drawing set becomes a measured building.

**Body:** Acon is a construction orchestrator, not a CAD plugin. It reads intent
— "a Walmart supercenter", "a two-storey clinic" — or ingests uploaded sheets,
and returns a strict JSON spec: footprint, massing bands, zones, storey heights,
MEP runs. The scene compiles that spec into 3D. The model never authors geometry;
it only ever emits the schema.

**Right column — In the product today**
- **Construct** — prompt to building
- **Extract** — PDF, DWG, or scan to draft model
- **Edit** — natural-language changes on the live model
- **Explain** — query the model on screen
- **GIS** — NYC address to measured envelope, no LLM involved

---

## 06 — Statement

**Headline:** "Automated" is the word doing the work.

**Body:** Not assisted. No modelling session, no template library, no drafter
sitting in the loop. One pass from document to dimensioned 3D — and the result
is editable, not a render.

---

## 07 — The gap (4-up)

**Kicker:** 02 — The gap

**Headline:** Nothing occupies this cell.

**01 · BIM authoring** — Revit, Archicad. Powerful and manual: a human models
the building. The AI features that exist are cloud add-ons.

**02 · Generative site tools** — TestFit, Autodesk Forma. Parametric massing for
feasibility. They don't read your issued drawing set, and they run as SaaS.

**03 · LLM chat products** — Will happily describe a building. Won't return a
dimensioned, editable model, and the weights are always hosted.

**04 · Scan-to-BIM services** — Accurate, but a paid service with turnaround in
days, and your files leave the firm to get there.

**Footer:** The empty cell is ours: automated document-to-3D, executing on
hardware the firm owns.

---

## 08 — Section divider

**03 — The constraint**

---

## 09 — Problem (3-up)

**Kicker:** 03 — The constraint

**Headline:** Three reasons the cloud planner cannot stay.

**01 · The drawings are privileged** — Blueprints, structural sets, tender
documents, and client site data are contract-confidential. Many carry NDAs that
prohibit third-party processing outright.

**02 · Today the planner is Gemini, in someone else's cloud** — Acon's agent
calls `google/gemini-3.5-flash` through Replicate. Every turn ships project
context off-network.

**03 · Manual modelling is the bottleneck** — Turning a received sheet set into
a workable 3D model is days of drafter time, and it repeats on every revision.

---

## 10 — Confidentiality

**Kicker:** 03 — The constraint

**Headline:** The software has to live inside the firm.

- No drawing, sheet, or site coordinate leaves the office network. Inference
  happens on a box in the building.
- No third-party processor to disclose in a client agreement. Nothing to add to
  a DPA, nothing to indemnify.
- Prompts and outputs are nobody's training data. There is no retention policy
  to take on trust.
- It works when the network doesn't: site trailers, secure floors, air-gapped
  review sessions.
- Deployment stays internal — firm-issued machines talking to a firm-owned
  appliance. No per-seat licence, no per-revision token invoice.

---

## 11 — Section divider

**04 — The approach**

---

## 12 — Solution

**Kicker:** 04 — The approach

**Headline:** Qwen-VL on Dell Pro Max with GB10.

**Body:** Keep the entire product — chat, spec compiler, Three.js scene, GIS
path. Replace exactly one hop: the planner. Gemini on Replicate comes out, and a
local vision-language model on a desk-side Grace Blackwell appliance goes in.
Same JSON contract, same system prompt, same schema validation.

**Callout:** Same contract. Different machine. Nothing leaves the building.

---

## 13 — The machine (4-up)

**Kicker:** 04 — Hardware

**Headline:** Built for models this size.

**01 · Superchip** — NVIDIA GB10 Grace Blackwell. 20-core Arm CPU, Blackwell
GPU, 5th-generation Tensor Cores.

**02 · Memory** — 128 GB coherent LPDDR5x at 273 GB/s. CPU and GPU share one
pool, so model weights and a large page of drawing tokens sit together.

**03 · Compute** — Up to 1 petaFLOP of FP4. NVFP4 is the format we target for
planner latency.

**04 · Ceiling** — Roughly 200B parameters for inference on one unit, ~70B for
fine-tuning, ~400B across two units linked over ConnectX-7.

**Footer:** NVIDIA DGX OS (Ubuntu-based) · up to 4 TB NVMe · same platform as
the GB200/GB300 systems, so the stack ports upward without a recode.

---

## 14 — The models (three column)

**Kicker:** 05 — The models

**Headline:** Vision-language, because the input is a drawing.

**Sheet reader** — Qwen3-VL Instruct. Its document parsing returns text *with
layout position*, so a title block, a dimension string, and a room tag stay
spatially anchored. That is what turns a sheet into zones.

**Planner** — Qwen3-VL on the same endpoint, emitting Acon's
construct / edit / extract JSON. One model serves both jobs, so there is no
separate OCR stage to maintain.

**Sizing** — Start with a compact VL checkpoint in NVFP4 or FP8 to prove the
wire, then move up if zone coverage misses. MoE checkpoints (~3B active) are the
throughput pick on GB10; a dense 32B runs, but slower per token.

**Footer:** vLLM ≥ 0.11 for Qwen3-VL · NVFP4 wants the marlin GEMM backend ·
FLASHINFER attention on Blackwell · out of the loop: Gemini 3.5 Flash, Replicate

---

## 15 — Pipeline (steps)

**Kicker:** 05 — Pipeline

**Headline:** Five steps, none of them off the LAN.

**01 Ingest** — Sheets, scans, or a photographed markup land in chat. Already
accepted today: `image/*`, PDF, DWG.

**02 See** — Qwen-VL reads the sheet on the GB10: dimensions, grid lines, room
names, level markers.

**03 Specify** — The model emits Acon's JSON only — footprint or width and
depth, massing bands, zones, storey heights, MEP flags.

**04 Compile** — `compileSpec` turns the schema into walls, slabs, openings, and
runs. No model-authored geometry ever reaches the scene.

**05 Work** — The 3D model is live: resize a room, strip the roof, change a
finish, all in natural language.

---

## 16 — Before / after (compare)

**Kicker:** 04 — Architecture

**Headline:** One hop changes. The product does not.

**Left — Now**
Acon UI → `/api/agent` → Replicate → `google/gemini-3.5-flash` → JSON spec →
compile → scene.
*Drawings leave the network.*

**Right — Target**
Acon UI → `/api/agent` → GB10 on the LAN → Qwen-VL via vLLM or NIM → JSON spec →
compile → scene.
*Drawings stay on the LAN.*

**Note:** GIS lookups still bypass the model. Locked workspaces still refuse a
rebuild. Schema validation is unchanged.

---

## 17 — Code surface

**Kicker:** 04 — What we change

**Headline:** A provider swap, not a new product.

**Do**
- Promote the local OpenAI-compatible provider to first choice; base URL becomes
  `http://<gb10>:8000/v1`.
- Pin the served Qwen-VL model id as the default model.
- Send attachments as image content parts. Today `ChatAttachment` carries only
  name, type, and size — the pixels never reach the model. This is the one real
  code gap.
- Health-check the GB10 the way `probeOllama()` already checks localhost.
- Rewrite the system prompt, which currently announces "using Gemini 3.5 Flash
  on Replicate".

**Do not**
- Touch `compileSpec`, the Three.js scene, the GIS path, or the JSON schema.
- Leave Gemini as a silent production fallback.
- Fine-tune anything before inference quality is measured.

---

## 18 — Comparison (table)

**Kicker:** 05 — Why local

**Headline:** Gemini off. GB10 on.

| | Gemini 3.5 Flash (today) | Qwen-VL on GB10 (target) |
|---|---|---|
| Where inference runs | Replicate cloud | The firm's own appliance |
| Drawings leave the firm | Yes | No |
| Credentials | `REPLICATE_API_TOKEN` | None for inference |
| Reads an issued sheet set | Text-first | Native vision with layout |
| Works offline | No | Yes |
| Cost per revision | Metered per turn | Fixed hardware |
| Contractual exposure | Third-party processor | None |
| Default in Acon | Yes | Becomes yes |

---

## 19 — Numbers (stats)

**Kicker:** Capacity

- **128 GB** — unified coherent memory
- **1 PFLOP** — FP4 peak on Blackwell
- **200B** — parameter ceiling, single unit
- **0** — drawings leaving the network

**Caption:** GB10 figures from Dell and NVIDIA published specifications.

---

## 20 — Honest read (3-up)

**Kicker:** 06 — Risks

**Headline:** What this box is not.

**01 · Throughput, not capacity** — 128 GB will load large models; the token
rate on a single GB10 is desk-scale, not fleet-scale. Checkpoint choice and MoE
architecture matter more here than parameter count.

**02 · It is a Linux appliance** — DGX OS, container workflows, aarch64 builds.
Not a Windows workstation. Setup time is real and should be budgeted.

**03 · Vision quality needs an eval set** — Dimension strings and messy scans
are exactly where VL models fail. We need a fixed suite of sheets with
hand-checked answers before this replaces drafter time.

---

## 21 — Validation

**Kicker:** 06 — Validation

**Headline:** What we measure before Gemini is switched off.

- **Prompt suite** — big-box retail, clinic, warehouse, office, tower, L-shaped
  plate. Compare specs against current Gemini output on identical prompts.
- **Sheet suite** — real drawing sets with hand-checked footprints and level
  heights. Score dimension accuracy and zone coverage.
- **Latency** — median time-to-spec per turn, and time-to-first-token on a long
  sheet.
- **Failure mode** — how often the model returns non-schema output. Target after
  validation is zero.

---

## 22 — Roadmap

**Kicker:** 06 — The plan

**Now · Wire** — GB10 on the LAN, vLLM serving Qwen-VL on port 8000, one
construct turn end to end with Gemini disabled.

**Next · Default** — Local provider first. Attachments sent as real image parts.
Replicate demoted to optional.

**Then · Quality** — A larger VL checkpoint if the eval set demands it. Sheet
accuracy targets signed off by the modelling team.

**Later · Scale** — A second GB10 for larger checkpoints, or the same stack
pushed to a firm server. No recode either way.

---

## 23 — The ask

**Kicker:** 06 — The ask

**Headline:** We need the box on the network.

**01 Hardware** — One Dell Pro Max with GB10, 2 TB or more NVMe, on the office
network at a static address.

**02 Access** — DGX OS ready, NGC key for NIM, Hugging Face token for NVFP4
checkpoints, Docker on the box.

**03 Data** — Ten real drawing sets, hand-checked, cleared for internal use as
the evaluation corpus.

**04 Decision** — Approval to make local inference the default and retire the
Replicate key from production.

---

## 24 — Close

**On-premises.**

Acon · Qwen-VL · Dell Pro Max with GB10 — no cloud, no Gemini.
