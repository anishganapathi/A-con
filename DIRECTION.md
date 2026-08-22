# DIRECTION — Acon demo film

Dell × NVIDIA Local AI on Dell Pro Max with GB10 · 22 Aug 2026 · NYC

This file is the shot list, the UI moves, and the voiceover. Record the picture first. Then give **this file + the silent video** to Gemini for analysis, and feed Gemini's timing notes into ElevenLabs.

Do not improvise the prompts. Every line below was rehearsed against the live local VL on `:8080`.

## Inference — say this out loud, once, early

There is no outer model. No OpenAI, no Groq, no Gemini, no Cursor, no hosted API.

The only planner is the GGUF on the Linux box:

`Qwen3VL-30B-A3B-Instruct-Q4_K_M.gguf`

served by llama.cpp on port `8080` of the Dell Pro Max with GB10. Every construct, edit, and explain turn is an HTTP call to that endpoint. The drawing stays on the machine.

On screen that looks like `local / Qwen3VL-30B-A3B-Instruct-Q4_K_M.gguf` on every assistant line. If a take ever shows openai, groq, replicate, or cursor, throw the take away.

---

## One sentence for the judges

Monday morning at a contractor: a permit PDF lands, the owner wants the ridge higher, and the plumber put a pipe on the wrong balcony. Acon is the agent on the office GB10 that reads the sheet, stands the building up, and takes those three instructions in the same chat — without the drawings ever leaving the machine.

## Who this is for (say the job titles)

Not “anyone who likes 3D.” Three people who already exist in a real office:

| Person | What they do today | What they do in Acon |
| --- | --- | --- |
| **Project manager** at a GC or design-build firm | Forwards a PDF to a junior, waits half a day for a SketchUp/Revit remodel before the 10am coordination meeting | Drops the sheet. Has a measured model before the meeting starts |
| **Architect / job captain** in owner review | Client says “raise the ridge, widen the living room, slide that window.” That is a change-order cycle: redlines, remodel, new sheet | Types the three sentences. The live model is the redline |
| **MEP coordinator** | A balcony supply was drawn in the wrong place. Finding it on a 2D sheet and killing it in the model is two tools and two people | “Remove the balcony water pipe.” The run that was just placed is the one that goes |

The buyer is the firm, not the intern. The box sits in the **site trailer or the project room** the way a plotter does: always on, no login to a cloud CAD copilot, no uploading a not-yet-permitted house to someone else’s GPU.

## Why local is the product, not a constraint

These sheets are not public. Pre-permit residential, healthcare, schools, anything with an owner who signed an NDA — a PM who pastes that PDF into a hosted model has just sent the building out of the contract. Job-site wifi is also bad. The GB10 is the argument: the same machine that runs the GGUF is the machine that holds the drawing.

If a judge asks “why not just use Revit + Copilot?” the answer is one sentence: **the sheet is already here, the meeting is in twelve minutes, and this file cannot go to the cloud.**

## What to make Gemini understand

Acon is not a chatbot with a 3D skin. Each shot in the film is a real office move:

- **Build from the sheet** = intake. The junior remodel, skipped.
- **Compare overlay** = design review. Sheet vs model, same as a light table.
- **“How tall is the roof?”** = an RFI. Answer from the live model, not a hunt through title blocks.
- **Raise the ridge / widen the room / slide the window** = owner comments in the review, applied before anyone opens CAD.
- **Add the pipe, then remove it** = MEP coordination. The test of a real coordinator is taking the bad run out, not adding another.

Use-case bucket for the rubric: **operations + knowledge + design review** for a construction / architecture practice. Not a personal assistant. Not a toy house.

Local-first proof, visible on camera: every assistant turn is labelled  
`local / Qwen3VL-30B-A3B-Instruct-Q4_K_M.gguf`. Nothing else should appear there.

---

## Before you press record

1. llama.cpp is up on the box. In `start.sh`, press **5**. You want `Vision model reachable`.
2. If the app and the model are the same machine:  
   `ECON_LOCAL_LLM_URL=http://127.0.0.1:8080/v1 ./start.sh`
3. Browser at `http://<box-ip>:4173`. Full screen. Chat open. Plan mode (not Experience).
4. View: **Show all floors ON**, roof ON, pipes ON, electrical ON, 3D (not 2D).
5. Orbit to a **three-quarter front elevation** — you can see the gable and the south wall. Do this before the first edit. Do not orbit during an edit; the ridge has to rise in a locked frame.
6. Demo sheets on the machine (they are **not** in the repo): the two-storey floor plan (`test-2.png` or equivalent) and, if you have it, the front elevation.
7. Dry-run the prompts once. The model is temperature 0; the take you rehearse is the take you film.
8. Cursor large. Do not hover the gizmo during a spoken beat — it is easy to snap the camera by accident.

**Hold each edit for the full 1.4 s tween** plus one extra second. The ridge, the room, and the window now ease. If you cut early it still looks like a jump.

---

## Picture runtime

**110–125 seconds** of picture. That is the film. The live evening pitch is five minutes and uses this film plus two spoken minutes; see the bottom.

| Clock | Shot | You do | Hold |
| --- | --- | --- | --- |
| 0:00–0:08 | Badge | Chat already open. Point at `Local VL · GB10` / the model name on the last assistant line. Do not type yet. | 8 s |
| 0:08–0:16 | Hello | Type `hello` → Enter. Wait for the reply. | until the sentence is fully on screen |
| 0:16–0:40 | Build | Attach the floor-plan sheet. Type `make this house plan` → Enter. **Do not touch the camera.** Construction playback runs ~12 s: slabs, walls, roof. | let playback finish |
| 0:40–0:50 | Compare | Click **Compare** under the gizmo. Side-by-side, then Overlay. Leave overlay on for 3 s. Close the panel. | 10 s |
| 0:50–0:58 | Question | Type `how tall is the roof?` → Enter. | until the numbers land |
| 0:58–1:10 | Ridge | Orbit stays put. Type `raise the ridge to 9m` → Enter. **Watch the gable rise.** Do not click anything. | 1.4 s tween + 2 s hold |
| 1:10–1:20 | Room | Type `make the living room 6m wide` → Enter. | tween + 1 s |
| 1:20–1:30 | Window | Type `move the living room window 1m to the right` → Enter. The opening slides on the wall. | tween + 1 s |
| 1:30–1:44 | MEP | `add a water pipe in the balcony` → Enter. Hold. Then `remove the balcony water pipe` → Enter. The run must disappear. | 2 s + 2 s |
| 1:44–1:58 | Nemoclaw | Type `increase the L3 to 900 m` → Enter. **Do not touch anything.** The amber Nemoclaw card appears with the claw mark, tag "Irrelevant", title "Third Floor at 900 m is not a storey". The model does not move. Hold the card on screen. Then click **Decline**. | card visible 6 s, then Decline, hold 2 s |
| 1:58–2:05 | Nav | Click the gizmo **+Z / +X** heads so the view snaps. Middle-mouse drag to pan. Floor dropdown: Ground, then First. | 7 s |

If you only get one take, **never skip**: build from the sheet, ridge raise, window slide, remove the pipe, Nemoclaw card. Those five shots are the argument.

---

## Voiceover — read this into ElevenLabs

Tone: a principal who has shipped buildings, not a founder pitching a deck. Confident, short sentences, pauses between ideas. Mid-register, slightly slower than conversational. Let the silence after each line do the work.

Suggested ElevenLabs settings: stability 0.75, similarity 0.8, style 0.15, speed 0.92. English (US). No music. The numbers — Qwen3, seven point six, twelve point two, nine hundred — must land clean.

### Line 1 — 0:00–0:08

This is the project room. The box is a Dell Pro Max with GB10. The only model is a Qwen3 vision GGUF on llama.cpp. No cloud. No API keys. The drawings never leave this machine.

### Line 2 — 0:08–0:16

A permit set just landed. The ten o'clock meeting is in forty minutes. The PM does not open CAD. They talk to the agent the way they talk to a junior — a question, a change, a greeting. Same chat. The agent decides what kind of turn it is.

### Line 3 — 0:16–0:40

This is intake. A real sheet — ground and first floor, dimensioned in feet. The agent counts the storeys from the drawing, converts twenty-five by forty feet to seven point six by twelve point two metres, and stands up the rooms that are actually on the page. Not a twelve-storey tower. The rooms that are drawn. What used to be a half-day for a junior takes one prompt.

### Line 4 — 0:40–0:50

Design review. Overlay the sheet on the model — a light table, on screen. The job captain sees what was extracted and what was missed before anyone walks into the owner meeting.

### Line 5 — 0:50–0:58

An RFI: how tall is the roof. The answer comes from the live model, not a title block. Eave six point four. Ridge seven point eight. The building answers for itself.

### Line 6 — 0:58–1:10

Owner comment, said out loud in the meeting: raise the ridge to nine metres. Watch the gable. That is a change order applied in the room, on the same building — not a ticket back to the drafting set.

### Line 7 — 1:10–1:20

Widen the living room to six metres. The wall moves with the room. The conversation that used to wait for a revised sheet happens now, in the meeting, while the owner is still talking.

### Line 8 — 1:20–1:30

Slide the living-room window one metre to the right. The agent finds that opening on that wall and moves it. In the office that is a redline. Here it is a sentence.

### Line 9 — 1:30–1:44

MEP coordination. A supply appeared on the balcony that should not be there. Adding a run is easy. The coordinator's job is taking the bad one out — the same pipe, not another one. Watch it disappear.

### Line 10 — 1:44–1:58

Now the test. Increase the third floor to nine hundred metres. That is not a storey — it is a tower. Nemoclaw catches it. The amber card, the claw mark, the question. The model did not move. Decline. The building stays where it is. That is the monitor, not the model guessing.

### Line 11 — 1:58–2:05

Snap to elevation. Pan the sheet. Step the floors. The meeting stays in the chat. The building stays on the box. The file never went to the cloud.

### Closer — only if you have five seconds

The trailer holds the drawings. The GB10 holds the agent. That is the product.

---

## Exact prompts (copy, do not rewrite)

```
hello
make this house plan
how tall is the roof?
raise the ridge to 9m
make the living room 6m wide
move the living room window 1m to the right
add a water pipe in the balcony
remove the balcony water pipe
increase the L3 to 900 m
```

Attachment for line 3: the two-storey floor plan only. Do not attach the elevation on the rebuild unless you have already rehearsed that pairing — the VL sometimes compresses the first floor when it sees too much at once.

If you have a clean elevation and twenty extra seconds after the ridge:

```
make the elevation similar
```

Hold compare overlay on while it restages the front windows. Skip this beat if the first rebuild already ate time.

---

## What the UI must show (Gemini checklist)

Give Gemini this list and ask it to confirm each item is visible in the silent video before you generate audio.

- [ ] Model badge reads local / Qwen3VL, not OpenAI, Groq, or Cursor
- [ ] `hello` returns a spoken reply and **does not** rebuild the house
- [ ] Rebuild reply mentions two storeys and ~7.6 × 12.2 m — not 12 storeys
- [ ] Construction playback is visible (walls rising, then roof)
- [ ] Compare panel opens from under the gizmo
- [ ] Roof question answers with eave and ridge numbers
- [ ] Ridge visibly **eases** upward after `raise the ridge to 9m` (about a second and a half)
- [ ] Window visibly **slides** after the offset prompt
- [ ] Pipe appears, then the **same** pipe disappears on remove
- [ ] `increase the L3 to 900 m` shows the amber **Nemoclaw card** with claw mark, tag "Irrelevant" — the model does **not** move
- [ ] Clicking **Decline** on the Nemoclaw card leaves the building unchanged
- [ ] Chat never shows `Updated electrical undefined` or `Added pipe` on a remove

If Gemini flags a miss, re-take that shot. Do not paper it with voiceover.

---

## What not to film

- Experience mode. Dark and pretty; it does not help the argument.
- The first-floor landing if the VL compressed the upper plan. Stay on the whole-building three-quarter.
- Stairs. They are circulation zones, not modelled geometry.
- Settings, provider menus, or `.env`.
- Failed turns. If a reply is wrong, cut, reset, take again. The model is local — a retry is free.
- Typing mistakes left on screen. If you typo, wait, then take the line over.

---

## Five-minute live pitch (top 8, after the film)

Speak as if a GC principal is in the room. Do not say “hackathon,” “cool,” or “AI-powered.”

| Time | Who | What |
| --- | --- | --- |
| 0:00–0:25 | You | **Job.** A permit PDF hits the project room at 8:40. Coordination is at 10:00. The owner will ask for the ridge and a window. The plumber will have put a pipe on the wrong balcony. Today that is a junior in CAD and a change-order cycle. Those drawings also cannot go to a hosted model. |
| 0:25–2:15 | Film | Play the 125 s picture with the ElevenLabs track. Do not talk over it. The film *is* those three people working. |
| 2:15–3:20 | You | **How.** A master intent on the GB10 picks one tool per turn — intake, question, edit, elevation match. A layout engine tiles the rooms so they cannot overlap. Edits bind to real IDs in the live plan. Inference is the Qwen3-VL GGUF on llama.cpp on this box. No outer model. |
| 3:20–4:20 | Live | One prompt the film did not use: `add a power socket circuit in the living room`. Then `how tall is the roof?` so the judges see the agent still answers from the live building, not a script. |
| 4:10–4:45 | You | **Who pays.** The GC or the design-build firm. The box sits next to the plotter. First seat: the PM who owns Monday coordination. Next: the job captain in owner review, then MEP. We would put it in one trailer on one job and measure time-to-model and redlines closed in the meeting. |
| 4:45–5:00 | You | **Close.** The sheet stays in the contract. The agent stays on the GB10. That is the product. |

### Rubric, in their language

| They score | You pointed at |
| --- | --- |
| Usefulness | Intake before 10am, RFIs, owner redlines, MEP take-off — named jobs, not features |
| Local-first | GGUF on this box; drawings that cannot leave; trailer wifi |
| Technical execution | Tool routing, measured layout, IDs that survive add-then-remove, the ridge easing on camera, Nemoclaw holding a 900 m floor |
| Pitch quality | One office, three people, one meeting. Then sit down. |

---

## Gemini prompt (paste with the video)

```
You are timing a silent product demo for a voiceover.

Read DIRECTION.md (attached). Watch the video.

1. List each shot you can actually see, with start/end timestamps.
2. Mark any checklist item that is missing or too short.
3. For each voiceover Line 1–11, give the exact in/out time in the video
   where that line should sit. If a line has no picture, say so.
4. Note any moment where the model jumps instead of easing (ridge, room, window).
5. Note whether the Nemoclaw card appears and whether the model stays still during it.
6. Do not rewrite the voiceover. Only align it.

Return a timestamp table I can paste into ElevenLabs as markers.
```

---

## Reset between takes

If a take goes wrong:

- Undo in the editor (⌘Z / Ctrl+Z) back to the built house, **or**
- Re-run `make this house plan` on the same sheet and wait for playback.

Do not keep stacking edits across failed takes. The window prompt assumes the living-room opening is still the one from the sheet. The Nemoclaw prompt assumes L3 is still at its original height — if you accepted a 900 m override by mistake, undo before re-taking.
