"""Builds the Acon x Dell Pro Max GB10 deck as a 16:9 .pptx.

Mirrors the Figma template's grid: 1920x1080, 8 columns, generous margins,
one idea per slide. Copy lives in acon-gb10-local-qwen-vl.md.

    python3 -m venv /tmp/deckvenv
    /tmp/deckvenv/bin/pip install python-pptx
    /tmp/deckvenv/bin/python docs/deck/build_deck.py
"""

from pathlib import Path

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.util import Inches, Pt

OUT = Path(__file__).resolve().parent / "acon-gb10-local-qwen-vl.pptx"

PAPER = RGBColor(0xF4, 0xF2, 0xED)
INK = RGBColor(0x14, 0x14, 0x13)
MUTED = RGBColor(0x77, 0x73, 0x6C)
RULE = RGBColor(0xD3, 0xCF, 0xC6)
ACCENT = RGBColor(0x0F, 0x76, 0x6E)
PAPER_ON_INK = RGBColor(0xF4, 0xF2, 0xED)

FONT = "Helvetica Neue"

W, H = 13.3333, 7.5
M = 0.8333
COLW = (W - 2 * M) / 8


def col(i: int) -> float:
    """Left edge of grid column i."""
    return M + i * COLW


def span(n: int) -> float:
    return n * COLW


class Deck:
    def __init__(self) -> None:
        self.prs = Presentation()
        self.prs.slide_width = Inches(W)
        self.prs.slide_height = Inches(H)
        self.blank = self.prs.slide_layouts[6]
        self.number = 0

    def slide(self, dark: bool = False, numbered: bool = True):
        s = self.prs.slides.add_slide(self.blank)
        fill = s.background.fill
        fill.solid()
        fill.fore_color.rgb = INK if dark else PAPER
        self.number += 1
        if numbered:
            self.foot(s, dark)
        return s

    def foot(self, s, dark: bool) -> None:
        colour = MUTED if not dark else RGBColor(0x8A, 0x86, 0x7E)
        self.text(
            s, col(0), H - 0.62, span(4), 0.3,
            [("Acon x Dell Pro Max GB10", 8.5, False, colour, 0)],
        )
        self.text(
            s, col(7), H - 0.62, span(1), 0.3,
            [(f"{self.number:02d}", 8.5, False, colour, 0)],
            align=PP_ALIGN.RIGHT,
        )

    def text(self, s, x, y, w, h, lines, align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP):
        """lines: list of (text, pt, bold, colour, space_after_pt)."""
        box = s.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
        tf = box.text_frame
        tf.word_wrap = True
        tf.vertical_anchor = anchor
        tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
        for i, (body, size, bold, colour, after) in enumerate(lines):
            p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
            p.alignment = align
            p.space_after = Pt(after)
            p.line_spacing = 1.18 if size < 20 else 1.02
            run = p.add_run()
            run.text = body
            run.font.size = Pt(size)
            run.font.bold = bold
            run.font.name = FONT
            run.font.color.rgb = colour
        return box

    def rule(self, s, x, y, w, colour=RULE, thickness=0.012) -> None:
        bar = s.shapes.add_shape(
            MSO_SHAPE.RECTANGLE, Inches(x), Inches(y), Inches(w), Inches(thickness)
        )
        bar.fill.solid()
        bar.fill.fore_color.rgb = colour
        bar.line.fill.background()
        bar.shadow.inherit = False

    def kicker(self, s, label, y=M, dark=False) -> None:
        self.text(
            s, col(0), y, span(5), 0.3,
            [(label.upper(), 9.5, True, ACCENT if not dark else PAPER_ON_INK, 0)],
        )

    # ---------- slide archetypes ----------

    def cover(self, kicker, title, subtitle, meta_left, meta_right) -> None:
        s = self.slide(numbered=False)
        self.kicker(s, kicker, y=1.05)
        self.text(
            s, col(0), 2.05, span(6.4), 2.6,
            [(title, 44, True, INK, 0)],
        )
        self.rule(s, col(0), 4.95, span(2))
        self.text(
            s, col(0), 5.25, span(4.6), 1.0,
            [(subtitle, 13.5, False, MUTED, 0)],
        )
        self.text(s, col(0), H - 0.9, span(3), 0.3, [(meta_left, 9.5, False, MUTED, 0)])
        self.text(
            s, col(6), H - 0.9, span(2), 0.3,
            [(meta_right, 9.5, False, MUTED, 0)], align=PP_ALIGN.RIGHT,
        )

    def statement(self, line, footer=None, body=None) -> None:
        s = self.slide()
        self.text(
            s, col(0), 2.0, span(7), 3.0,
            [(line, 34, True, INK, 0)],
        )
        y = 4.9
        if body:
            self.rule(s, col(0), y, span(1.4))
            self.text(s, col(0), y + 0.3, span(4.4), 1.0, [(body, 13, False, MUTED, 0)])
        if footer:
            self.text(s, col(0), H - 1.15, span(6), 0.3, [(footer, 10, False, MUTED, 0)])

    def divider(self, number, title) -> None:
        s = self.slide(dark=True)
        self.text(s, col(0), 2.6, span(2), 1.2, [(number, 64, True, PAPER_ON_INK, 0)])
        self.rule(s, col(0), 4.15, span(1.2), colour=ACCENT, thickness=0.03)
        self.text(s, col(0), 4.5, span(5), 0.8, [(title, 26, True, PAPER_ON_INK, 0)])

    def contents(self, kicker, rows) -> None:
        s = self.slide()
        self.kicker(s, kicker)
        self.text(s, col(0), 1.35, span(4), 0.7, [("Contents", 30, True, INK, 0)])
        y = 2.35
        for num, title, note in rows:
            self.rule(s, col(0), y - 0.16, span(6.6))
            self.text(s, col(0), y, span(0.7), 0.4, [(num, 11, True, ACCENT, 0)])
            self.text(s, col(0.8), y - 0.03, span(2.4), 0.4, [(title, 14, True, INK, 0)])
            self.text(s, col(3.4), y, span(3.2), 0.4, [(note, 11.5, False, MUTED, 0)])
            y += 0.72

    def two_col(self, kicker, headline, body, right_title, right_items) -> None:
        s = self.slide()
        self.kicker(s, kicker)
        self.text(s, col(0), 1.35, span(4.4), 1.5, [(headline, 27, True, INK, 0)])
        self.text(s, col(0), 3.15, span(4.0), 2.6, [(body, 12.5, False, MUTED, 0)])
        self.rule(s, col(5), 1.4, span(3))
        self.text(
            s, col(5), 1.6, span(3), 0.35,
            [(right_title.upper(), 9.5, True, INK, 0)],
        )
        y = 2.15
        for item in right_items:
            self.text(s, col(5), y, span(3), 0.55, [(item, 11.5, False, MUTED, 0)])
            y += 0.62

    def cards(self, kicker, headline, cards, footer=None, per_row=None) -> None:
        s = self.slide()
        self.kicker(s, kicker)
        self.text(s, col(0), 1.3, span(5.5), 0.9, [(headline, 27, True, INK, 0)])
        n = per_row or len(cards)
        width = span(6.9) / n
        for i, (label, body) in enumerate(cards):
            x = col(0) + i * (width + span(0.12))
            self.rule(s, x, 2.7, width - 0.12, colour=ACCENT, thickness=0.022)
            self.text(s, x, 2.95, width - 0.2, 0.4, [(label, 12, True, INK, 0)])
            self.text(s, x, 3.55, width - 0.25, 2.4, [(body, 11, False, MUTED, 0)])
        if footer:
            self.text(s, col(0), H - 1.2, span(6.8), 0.5, [(footer, 10, False, MUTED, 0)])

    def bullets(self, kicker, headline, items, footer=None) -> None:
        s = self.slide()
        self.kicker(s, kicker)
        self.text(s, col(0), 1.3, span(4.6), 1.3, [(headline, 27, True, INK, 0)])
        y = 2.85
        for item in items:
            self.rule(s, col(0), y - 0.14, span(6.6))
            self.text(s, col(0), y, span(6.4), 0.6, [(item, 12, False, MUTED, 0)])
            y += 0.78
        if footer:
            self.text(s, col(0), H - 1.1, span(6.6), 0.4, [(footer, 10, False, MUTED, 0)])

    def steps(self, kicker, headline, items) -> None:
        s = self.slide()
        self.kicker(s, kicker)
        self.text(s, col(0), 1.3, span(5), 0.8, [(headline, 27, True, INK, 0)])
        width = span(6.9) / len(items)
        for i, (num, label, body) in enumerate(items):
            x = col(0) + i * (width + span(0.1))
            self.text(s, x, 2.6, width - 0.15, 0.4, [(num, 20, True, ACCENT, 0)])
            self.rule(s, x, 3.15, width - 0.15)
            self.text(s, x, 3.35, width - 0.2, 0.4, [(label, 11.5, True, INK, 0)])
            self.text(s, x, 3.9, width - 0.25, 2.2, [(body, 10.5, False, MUTED, 0)])

    def compare(self, kicker, headline, left, right, note) -> None:
        s = self.slide()
        self.kicker(s, kicker)
        self.text(s, col(0), 1.3, span(5), 0.8, [(headline, 27, True, INK, 0)])
        for i, (title, flow, tag, colour) in enumerate((left, right)):
            x = col(0) + i * span(3.6)
            self.rule(s, x, 2.5, span(3.2), colour=RULE if i == 0 else ACCENT, thickness=0.022)
            self.text(s, x, 2.72, span(3), 0.35, [(title.upper(), 9.5, True, INK, 0)])
            y = 3.2
            for step in flow:
                self.text(s, x, y, span(3), 0.4, [(step, 11.5, False, MUTED, 0)])
                y += 0.42
            self.text(s, x, y + 0.15, span(3), 0.4, [(tag, 11, True, colour, 0)])
        self.text(s, col(0), H - 1.15, span(6.8), 0.5, [(note, 10, False, MUTED, 0)])

    def do_dont(self, kicker, headline, do, dont) -> None:
        s = self.slide()
        self.kicker(s, kicker)
        self.text(s, col(0), 1.3, span(5), 0.8, [(headline, 27, True, INK, 0)])
        for i, (title, items, colour) in enumerate((("Do", do, ACCENT), ("Do not", dont, MUTED))):
            x = col(0) + i * span(3.6)
            self.rule(s, x, 2.35, span(3.2), colour=colour, thickness=0.022)
            self.text(s, x, 2.57, span(3), 0.35, [(title.upper(), 9.5, True, INK, 0)])
            y = 2.98
            for item in items:
                self.text(s, x, y, span(3.1), 0.68, [(item, 10.5, False, MUTED, 0)])
                y += 0.74

    def table(self, kicker, headline, headers, rows) -> None:
        s = self.slide()
        self.kicker(s, kicker)
        self.text(s, col(0), 1.3, span(5), 0.7, [(headline, 27, True, INK, 0)])
        xs = [col(0), col(2.9), col(5.2)]
        widths = [span(2.7), span(2.2), span(2.5)]
        self.rule(s, col(0), 2.4, span(7.7), colour=INK, thickness=0.014)
        for i, header in enumerate(headers):
            self.text(
                s, xs[i], 2.55, widths[i], 0.35,
                [(header.upper(), 9, True, INK if i == 0 else ACCENT, 0)],
            )
        y = 2.98
        for row in rows:
            for i, cell in enumerate(row):
                bold = i == 0
                self.text(
                    s, xs[i], y, widths[i], 0.4,
                    [(cell, 10.5, bold, INK if bold else MUTED, 0)],
                )
            self.rule(s, col(0), y + 0.32, span(7.7))
            y += 0.46

    def stats(self, kicker, items, caption) -> None:
        s = self.slide()
        self.kicker(s, kicker)
        width = span(7.7) / len(items)
        for i, (value, label) in enumerate(items):
            x = col(0) + i * width
            self.text(s, x, 2.6, width - 0.2, 1.0, [(value, 40, True, INK, 0)])
            self.rule(s, x, 3.75, width - 0.5)
            self.text(s, x, 3.95, width - 0.35, 0.8, [(label, 11, False, MUTED, 0)])
        self.text(s, col(0), H - 1.15, span(6.8), 0.5, [(caption, 10, False, MUTED, 0)])

    def roadmap(self, kicker, headline, phases) -> None:
        s = self.slide()
        self.kicker(s, kicker)
        self.text(s, col(0), 1.3, span(5), 0.8, [(headline, 27, True, INK, 0)])
        width = span(7.7) / len(phases)
        self.rule(s, col(0), 2.65, span(7.7), colour=INK, thickness=0.014)
        for i, (phase, title, body) in enumerate(phases):
            x = col(0) + i * width
            self.text(s, x, 2.85, width - 0.25, 0.35, [(phase.upper(), 9, True, ACCENT, 0)])
            self.text(s, x, 3.25, width - 0.25, 0.5, [(title, 14, True, INK, 0)])
            self.text(s, x, 3.9, width - 0.35, 2.2, [(body, 10.5, False, MUTED, 0)])

    def close(self, big, line) -> None:
        s = self.slide(dark=True, numbered=False)
        self.text(s, col(0), 2.7, span(6), 1.4, [(big, 60, True, PAPER_ON_INK, 0)])
        self.rule(s, col(0), 4.35, span(1.2), colour=ACCENT, thickness=0.03)
        self.text(
            s, col(0), 4.7, span(6), 0.6,
            [(line, 12.5, False, RGBColor(0xA9, 0xA5, 0x9C), 0)],
        )

    def save(self) -> None:
        self.prs.save(OUT)


d = Deck()

d.cover(
    "Acon x Dell Pro Max GB10",
    "Automated 3D building generation, entirely on-premises.",
    "Drawings in, measured 3D out. Qwen-VL running locally on Dell Pro Max with "
    "GB10 \u2014 no Gemini, no cloud.",
    "Integration proposal",
    "August 2026",
)

d.statement(
    "Nothing on the market does this without sending your drawings to someone "
    "else's cloud.",
    footer="Acon \u00b7 automated document-to-3D \u00b7 NVIDIA GB10 Grace Blackwell",
)

d.contents(
    "Agenda",
    [
        ("01", "The product", "What Acon does today"),
        ("02", "The gap", "Why this category is empty"),
        ("03", "The constraint", "Confidential drawings"),
        ("04", "The machine", "Dell Pro Max with GB10"),
        ("05", "The models", "Qwen-VL, running locally"),
        ("06", "The plan", "Ship path, risks, and the ask"),
    ],
)

d.divider("01", "The product")

d.two_col(
    "01 \u2014 The product",
    "A prompt or a drawing set becomes a measured building.",
    "Acon is a construction orchestrator, not a CAD plugin. It reads intent "
    "\u2014 \u201ca Walmart supercenter\u201d, \u201ca two-storey clinic\u201d "
    "\u2014 or ingests uploaded sheets, and returns a strict JSON spec: "
    "footprint, massing bands, zones, storey heights, MEP runs. The scene "
    "compiles that spec into 3D. The model never authors geometry; it only ever "
    "emits the schema.",
    "In the product today",
    [
        "Construct \u2014 prompt to building",
        "Extract \u2014 PDF, DWG, or scan to draft model",
        "Edit \u2014 natural-language changes on the live model",
        "Explain \u2014 query the model on screen",
        "GIS \u2014 address to measured envelope, no LLM",
    ],
)

d.statement(
    "\u201cAutomated\u201d is the word doing the work.",
    body="Not assisted. No modelling session, no template library, no drafter in "
    "the loop. One pass from document to dimensioned 3D \u2014 and the result is "
    "editable, not a render.",
)

d.divider("02", "The gap")

d.cards(
    "02 \u2014 The gap",
    "Nothing occupies this cell.",
    [
        (
            "01 \u00b7 BIM authoring",
            "Revit, Archicad. Powerful and manual: a human models the building. "
            "The AI features that exist are cloud add-ons.",
        ),
        (
            "02 \u00b7 Generative site tools",
            "TestFit, Autodesk Forma. Parametric massing for feasibility. They "
            "don't read your issued drawing set, and they run as SaaS.",
        ),
        (
            "03 \u00b7 LLM chat products",
            "Will happily describe a building. Won't return a dimensioned, "
            "editable model \u2014 and the weights are always hosted.",
        ),
        (
            "04 \u00b7 Scan-to-BIM services",
            "Accurate, but a paid service with turnaround in days, and your "
            "files leave the firm to get there.",
        ),
    ],
    footer="The empty cell is ours: automated document-to-3D, executing on "
    "hardware the firm owns.",
)

d.divider("03", "The constraint")

d.cards(
    "03 \u2014 The constraint",
    "Three reasons the cloud planner cannot stay.",
    [
        (
            "01 \u00b7 The drawings are privileged",
            "Blueprints, structural sets, tender documents, and client site data "
            "are contract-confidential. Many carry NDAs that prohibit "
            "third-party processing outright.",
        ),
        (
            "02 \u00b7 The planner is in someone else's cloud",
            "Acon's agent calls google/gemini-3.5-flash through Replicate. Every "
            "turn ships project context off-network.",
        ),
        (
            "03 \u00b7 Manual modelling is the bottleneck",
            "Turning a received sheet set into a workable 3D model is days of "
            "drafter time \u2014 and it repeats on every revision.",
        ),
    ],
)

d.bullets(
    "03 \u2014 The constraint",
    "The software has to live inside the firm.",
    [
        "No drawing, sheet, or site coordinate leaves the office network. "
        "Inference happens on a box in the building.",
        "No third-party processor to disclose in a client agreement. Nothing to "
        "add to a DPA, nothing to indemnify.",
        "Prompts and outputs are nobody's training data. There is no retention "
        "policy to take on trust.",
        "It works when the network doesn't: site trailers, secure floors, "
        "air-gapped review sessions.",
        "Deployment stays internal \u2014 firm-issued machines talking to a "
        "firm-owned appliance. No per-seat licence, no per-revision invoice.",
    ],
)

d.divider("04", "The approach")

d.two_col(
    "04 \u2014 The approach",
    "Qwen-VL on Dell Pro Max with GB10.",
    "Keep the entire product \u2014 chat, spec compiler, Three.js scene, GIS "
    "path. Replace exactly one hop: the planner. Gemini on Replicate comes out, "
    "and a local vision-language model on a desk-side Grace Blackwell appliance "
    "goes in. Same JSON contract, same system prompt, same schema validation.",
    "The whole change",
    [
        "Same contract.",
        "Different machine.",
        "Nothing leaves the building.",
    ],
)

d.cards(
    "04 \u2014 Hardware",
    "Built for models this size.",
    [
        (
            "01 \u00b7 Superchip",
            "NVIDIA GB10 Grace Blackwell. 20-core Arm CPU, Blackwell GPU, "
            "5th-generation Tensor Cores.",
        ),
        (
            "02 \u00b7 Memory",
            "128 GB coherent LPDDR5x at 273 GB/s. CPU and GPU share one pool, "
            "so weights and a large page of drawing tokens sit together.",
        ),
        (
            "03 \u00b7 Compute",
            "Up to 1 petaFLOP of FP4. NVFP4 is the format we target for planner "
            "latency.",
        ),
        (
            "04 \u00b7 Ceiling",
            "~200B parameters for inference on one unit, ~70B for fine-tuning, "
            "~400B across two units over ConnectX-7.",
        ),
    ],
    footer="NVIDIA DGX OS (Ubuntu-based) \u00b7 up to 4 TB NVMe \u00b7 same "
    "platform as GB200/GB300, so the stack ports upward without a recode.",
)

d.cards(
    "05 \u2014 The models",
    "Vision-language, because the input is a drawing.",
    [
        (
            "Sheet reader",
            "Qwen3-VL Instruct. Its document parsing returns text with layout "
            "position, so a title block, a dimension string, and a room tag stay "
            "spatially anchored. That is what turns a sheet into zones.",
        ),
        (
            "Planner",
            "Qwen3-VL on the same endpoint, emitting Acon's construct / edit / "
            "extract JSON. One model serves both jobs, so there is no separate "
            "OCR stage to maintain.",
        ),
        (
            "Sizing",
            "Start with a compact VL checkpoint in NVFP4 or FP8 to prove the "
            "wire, then move up if zone coverage misses. MoE checkpoints (~3B "
            "active) are the throughput pick; a dense 32B runs, but slower.",
        ),
    ],
    footer="vLLM \u2265 0.11 for Qwen3-VL \u00b7 NVFP4 wants the marlin GEMM "
    "backend \u00b7 FLASHINFER attention on Blackwell \u00b7 out of the loop: "
    "Gemini 3.5 Flash, Replicate",
)

d.steps(
    "05 \u2014 Pipeline",
    "Five steps, none of them off the LAN.",
    [
        (
            "01",
            "Ingest",
            "Sheets, scans, or a photographed markup land in chat. Already "
            "accepted today: image/*, PDF, DWG.",
        ),
        (
            "02",
            "See",
            "Qwen-VL reads the sheet on the GB10: dimensions, grid lines, room "
            "names, level markers.",
        ),
        (
            "03",
            "Specify",
            "The model emits Acon's JSON only \u2014 footprint or width and "
            "depth, massing bands, zones, storey heights, MEP flags.",
        ),
        (
            "04",
            "Compile",
            "compileSpec turns the schema into walls, slabs, openings, and runs. "
            "No model-authored geometry reaches the scene.",
        ),
        (
            "05",
            "Work",
            "The 3D model is live: resize a room, strip the roof, change a "
            "finish, all in natural language.",
        ),
    ],
)

d.compare(
    "04 \u2014 Architecture",
    "One hop changes. The product does not.",
    (
        "Now",
        [
            "Acon UI",
            "\u2192 /api/agent",
            "\u2192 Replicate",
            "\u2192 google/gemini-3.5-flash",
            "\u2192 JSON spec \u2192 compile \u2192 scene",
        ],
        "Drawings leave the network.",
        MUTED,
    ),
    (
        "Target",
        [
            "Acon UI",
            "\u2192 /api/agent",
            "\u2192 GB10 on the LAN",
            "\u2192 Qwen-VL via vLLM or NIM",
            "\u2192 JSON spec \u2192 compile \u2192 scene",
        ],
        "Drawings stay on the LAN.",
        ACCENT,
    ),
    "GIS lookups still bypass the model. Locked workspaces still refuse a "
    "rebuild. Schema validation is unchanged.",
)

d.do_dont(
    "04 \u2014 What we change",
    "A provider swap, not a new product.",
    [
        "Promote the local OpenAI-compatible provider to first choice; base URL "
        "becomes http://<gb10>:8000/v1.",
        "Pin the served Qwen-VL model id as the default model.",
        "Send attachments as image content parts. ChatAttachment carries only "
        "name, type, and size today \u2014 the pixels never reach the model. "
        "This is the one real code gap.",
        "Health-check the GB10 the way probeOllama() already checks localhost.",
        "Rewrite the system prompt, which currently announces \u201cusing Gemini "
        "3.5 Flash on Replicate\u201d.",
    ],
    [
        "Touch compileSpec, the Three.js scene, the GIS path, or the JSON schema.",
        "Leave Gemini as a silent production fallback.",
        "Fine-tune anything before inference quality is measured.",
    ],
)

d.table(
    "05 \u2014 Why local",
    "Gemini off. GB10 on.",
    ["", "Gemini 3.5 Flash (today)", "Qwen-VL on GB10 (target)"],
    [
        ("Where inference runs", "Replicate cloud", "The firm's own appliance"),
        ("Drawings leave the firm", "Yes", "No"),
        ("Credentials", "REPLICATE_API_TOKEN", "None for inference"),
        ("Reads an issued sheet set", "Text-first", "Native vision with layout"),
        ("Works offline", "No", "Yes"),
        ("Cost per revision", "Metered per turn", "Fixed hardware"),
        ("Contractual exposure", "Third-party processor", "None"),
        ("Default in Acon", "Yes", "Becomes yes"),
    ],
)

d.stats(
    "Capacity",
    [
        ("128 GB", "Unified coherent memory"),
        ("1 PFLOP", "FP4 peak on Blackwell"),
        ("200B", "Parameter ceiling, single unit"),
        ("0", "Drawings leaving the network"),
    ],
    "GB10 figures from Dell and NVIDIA published specifications.",
)

d.cards(
    "06 \u2014 Risks",
    "What this box is not.",
    [
        (
            "01 \u00b7 Throughput, not capacity",
            "128 GB will load large models; the token rate on a single GB10 is "
            "desk-scale, not fleet-scale. Checkpoint choice and MoE architecture "
            "matter more here than parameter count.",
        ),
        (
            "02 \u00b7 It is a Linux appliance",
            "DGX OS, container workflows, aarch64 builds. Not a Windows "
            "workstation. Setup time is real and should be budgeted.",
        ),
        (
            "03 \u00b7 Vision quality needs an eval set",
            "Dimension strings and messy scans are exactly where VL models fail. "
            "We need a fixed suite of sheets with hand-checked answers before "
            "this replaces drafter time.",
        ),
    ],
)

d.bullets(
    "06 \u2014 Validation",
    "What we measure before Gemini is switched off.",
    [
        "Prompt suite \u2014 big-box retail, clinic, warehouse, office, tower, "
        "L-shaped plate. Compare specs against current Gemini output on "
        "identical prompts.",
        "Sheet suite \u2014 real drawing sets with hand-checked footprints and "
        "level heights. Score dimension accuracy and zone coverage.",
        "Latency \u2014 median time-to-spec per turn, and time-to-first-token on "
        "a long sheet.",
        "Failure mode \u2014 how often the model returns non-schema output. "
        "Target after validation is zero.",
    ],
)

d.roadmap(
    "06 \u2014 The plan",
    "Desk, then site.",
    [
        (
            "Now",
            "Wire",
            "GB10 on the LAN, vLLM serving Qwen-VL on port 8000, one construct "
            "turn end to end with Gemini disabled.",
        ),
        (
            "Next",
            "Default",
            "Local provider first. Attachments sent as real image parts. "
            "Replicate demoted to optional.",
        ),
        (
            "Then",
            "Quality",
            "A larger VL checkpoint if the eval set demands it. Sheet accuracy "
            "targets signed off by the modelling team.",
        ),
        (
            "Later",
            "Scale",
            "A second GB10 for larger checkpoints, or the same stack pushed to a "
            "firm server. No recode either way.",
        ),
    ],
)

d.cards(
    "06 \u2014 The ask",
    "We need the box on the network.",
    [
        (
            "01 Hardware",
            "One Dell Pro Max with GB10, 2 TB or more NVMe, on the office "
            "network at a static address.",
        ),
        (
            "02 Access",
            "DGX OS ready, NGC key for NIM, Hugging Face token for NVFP4 "
            "checkpoints, Docker on the box.",
        ),
        (
            "03 Data",
            "Ten real drawing sets, hand-checked, cleared for internal use as "
            "the evaluation corpus.",
        ),
        (
            "04 Decision",
            "Approval to make local inference the default and retire the "
            "Replicate key from production.",
        ),
    ],
)

d.close(
    "On-premises.",
    "Acon \u00b7 Qwen-VL \u00b7 Dell Pro Max with GB10 \u2014 no cloud, no Gemini.",
)

d.save()
print(f"wrote {OUT} ({len(d.prs.slides.__iter__.__self__._sldIdLst)} slides)")
