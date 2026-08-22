"""Builds the Acon x Dell Pro Max GB10 deck as a 16:9 .pptx.

Mirrors the Figma template's grid: 1920x1080, 8 columns, generous margins,
one idea per slide. Copy lives in acon-gb10-local-qwen-vl.md.

Plain-language deck: describes what the product does and why it runs in-house,
without implementation detail.

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


def col(i: float) -> float:
    """Left edge of grid column i."""
    return M + i * COLW


def span(n: float) -> float:
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
            p.line_spacing = 1.2 if size < 20 else 1.02
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
        self.text(s, col(0), 2.05, span(6.4), 2.6, [(title, 42, True, INK, 0)])
        self.rule(s, col(0), 4.95, span(2))
        self.text(s, col(0), 5.25, span(5.2), 1.2, [(subtitle, 13.5, False, MUTED, 0)])
        self.text(s, col(0), H - 0.9, span(3), 0.3, [(meta_left, 9.5, False, MUTED, 0)])
        self.text(
            s, col(6), H - 0.9, span(2), 0.3,
            [(meta_right, 9.5, False, MUTED, 0)], align=PP_ALIGN.RIGHT,
        )

    def statement(self, line, footer=None, body=None) -> None:
        s = self.slide()
        self.text(s, col(0), 1.75, span(7), 2.2, [(line, 32, True, INK, 0)])
        if body:
            self.rule(s, col(0), 4.3, span(1.4))
            self.text(s, col(0), 4.6, span(6.4), 1.7, [(body, 12.5, False, MUTED, 0)])
        if footer:
            self.text(s, col(0), H - 1.15, span(6.8), 0.4, [(footer, 10, False, MUTED, 0)])

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
        self.text(s, col(0), 1.35, span(4.4), 1.5, [(headline, 26, True, INK, 0)])
        self.text(s, col(0), 3.1, span(4.1), 2.8, [(body, 12.5, False, MUTED, 0)])
        self.rule(s, col(5), 1.4, span(3))
        self.text(
            s, col(5), 1.6, span(3), 0.35, [(right_title.upper(), 9.5, True, INK, 0)]
        )
        y = 2.15
        for item in right_items:
            self.text(s, col(5), y, span(3), 0.55, [(item, 11.5, False, MUTED, 0)])
            y += 0.62

    def cards(self, kicker, headline, cards, footer=None) -> None:
        s = self.slide()
        self.kicker(s, kicker)
        self.text(s, col(0), 1.3, span(5.5), 0.9, [(headline, 26, True, INK, 0)])
        n = len(cards)
        width = span(6.9) / n
        for i, (label, body) in enumerate(cards):
            x = col(0) + i * (width + span(0.12))
            self.rule(s, x, 2.7, width - 0.12, colour=ACCENT, thickness=0.022)
            self.text(s, x, 2.95, width - 0.2, 0.5, [(label, 12, True, INK, 0)])
            self.text(s, x, 3.6, width - 0.25, 2.4, [(body, 11, False, MUTED, 0)])
        if footer:
            self.text(s, col(0), H - 1.2, span(6.8), 0.5, [(footer, 10, False, MUTED, 0)])

    def bullets(self, kicker, headline, items, footer=None) -> None:
        s = self.slide()
        self.kicker(s, kicker)
        self.text(s, col(0), 1.3, span(4.6), 1.3, [(headline, 26, True, INK, 0)])
        # Tighter rhythm once the list runs long, so six items still clear the footer.
        crowded = len(items) > 5
        y = 2.72 if crowded else 2.85
        step = 0.67 if crowded else 0.78
        size = 11.5 if crowded else 12
        for item in items:
            self.rule(s, col(0), y - 0.13, span(6.6))
            self.text(s, col(0), y, span(6.4), 0.55, [(item, size, False, MUTED, 0)])
            y += step
        if footer:
            self.text(s, col(0), H - 1.1, span(6.6), 0.4, [(footer, 10, False, MUTED, 0)])

    def steps(self, kicker, headline, items) -> None:
        s = self.slide()
        self.kicker(s, kicker)
        self.text(s, col(0), 1.3, span(5), 0.8, [(headline, 26, True, INK, 0)])
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
        self.text(s, col(0), 1.3, span(5), 0.8, [(headline, 26, True, INK, 0)])
        for i, (title, flow, tag, colour) in enumerate((left, right)):
            x = col(0) + i * span(3.6)
            self.rule(
                s, x, 2.5, span(3.2), colour=RULE if i == 0 else ACCENT, thickness=0.022
            )
            self.text(s, x, 2.72, span(3), 0.35, [(title.upper(), 9.5, True, INK, 0)])
            y = 3.2
            for step in flow:
                self.text(s, x, y, span(3.1), 0.6, [(step, 11.5, False, MUTED, 0)])
                y += 0.68
            self.text(s, x, y + 0.1, span(3), 0.4, [(tag, 11, True, colour, 0)])
        self.text(s, col(0), H - 1.15, span(6.8), 0.5, [(note, 10, False, MUTED, 0)])

    def columns(self, kicker, headline, left, right) -> None:
        """Two titled lists, side by side."""
        s = self.slide()
        self.kicker(s, kicker)
        self.text(s, col(0), 1.3, span(5), 0.8, [(headline, 26, True, INK, 0)])
        for i, (title, items, colour) in enumerate(
            ((left[0], left[1], ACCENT), (right[0], right[1], MUTED))
        ):
            x = col(0) + i * span(3.6)
            self.rule(s, x, 2.35, span(3.2), colour=colour, thickness=0.022)
            self.text(s, x, 2.57, span(3), 0.35, [(title.upper(), 9.5, True, INK, 0)])
            y = 3.0
            for item in items:
                self.text(s, x, y, span(3.1), 0.68, [(item, 11, False, MUTED, 0)])
                y += 0.82

    def table(self, kicker, headline, headers, rows) -> None:
        s = self.slide()
        self.kicker(s, kicker)
        self.text(s, col(0), 1.3, span(5), 0.7, [(headline, 26, True, INK, 0)])
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
            self.rule(s, col(0), y + 0.4, span(7.7))
            y += 0.54

    def stats(self, kicker, items, caption) -> None:
        s = self.slide()
        self.kicker(s, kicker)
        width = span(7.7) / len(items)
        for i, (value, label) in enumerate(items):
            x = col(0) + i * width
            self.text(s, x, 2.6, width - 0.2, 1.0, [(value, 38, True, INK, 0)])
            self.rule(s, x, 3.75, width - 0.5)
            self.text(s, x, 3.95, width - 0.35, 0.9, [(label, 11, False, MUTED, 0)])
        self.text(s, col(0), H - 1.15, span(6.8), 0.5, [(caption, 10, False, MUTED, 0)])

    def roadmap(self, kicker, headline, phases) -> None:
        s = self.slide()
        self.kicker(s, kicker)
        self.text(s, col(0), 1.3, span(5), 0.8, [(headline, 26, True, INK, 0)])
        width = span(7.7) / len(phases)
        self.rule(s, col(0), 2.65, span(7.7), colour=INK, thickness=0.014)
        for i, (phase, title, body) in enumerate(phases):
            x = col(0) + i * width
            self.text(s, x, 2.85, width - 0.25, 0.35, [(phase.upper(), 9, True, ACCENT, 0)])
            self.text(s, x, 3.25, width - 0.25, 0.5, [(title, 14, True, INK, 0)])
            self.text(s, x, 3.9, width - 0.35, 2.2, [(body, 10.5, False, MUTED, 0)])

    def close(self, big, line) -> None:
        s = self.slide(dark=True, numbered=False)
        self.text(s, col(0), 2.7, span(6), 1.4, [(big, 58, True, PAPER_ON_INK, 0)])
        self.rule(s, col(0), 4.35, span(1.2), colour=ACCENT, thickness=0.03)
        self.text(
            s, col(0), 4.7, span(6), 0.8,
            [(line, 12.5, False, RGBColor(0xA9, 0xA5, 0x9C), 0)],
        )

    def save(self) -> None:
        self.prs.save(OUT)


d = Deck()

d.cover(
    "Acon x Dell Pro Max GB10",
    "Buildings, generated automatically \u2014 inside your own office.",
    "Acon turns a description, or a set of drawings, into a working 3D building. "
    "With Dell Pro Max GB10 it does that on our own hardware, and nothing ever "
    "leaves the building.",
    "Integration proposal",
    "August 2026",
)

d.statement(
    "Nothing on the market does this without sending your drawings to someone "
    "else's cloud.",
    body="Some tools produce a shape you cannot build from. Others wait for a "
    "person to model everything by hand. None of them will read the drawings you "
    "were actually issued. And every one of them runs on somebody else's "
    "servers. Acon reads the drawings, produces a building you can measure and "
    "change, and does it on a machine that sits in the office.",
    footer="Acon \u00b7 automatic building generation \u00b7 Dell Pro Max with GB10",
)

d.contents(
    "Agenda",
    [
        ("01", "The product", "What Acon does"),
        ("02", "The difference", "Why nothing else does this"),
        ("03", "The reason", "Why it has to stay in-house"),
        ("04", "The machine", "Dell Pro Max with GB10"),
        ("05", "The models", "Reading drawings, locally"),
        ("06", "The plan", "What we need, and what happens next"),
    ],
)

d.divider("01", "The product")

d.two_col(
    "01 \u2014 The product",
    "Describe a building, or hand it a drawing set.",
    "Acon is an assistant that actually produces the model. Tell it what you "
    "want in plain words, or give it the drawings for a project, and it builds "
    "a complete 3D building: floors, rooms, walls, doors and windows, and the "
    "services running through them. Everything is dimensioned, so it can be "
    "measured and used \u2014 and anything can be changed afterwards just by "
    "asking.",
    "What you can ask it for",
    [
        "Describe a building and get one",
        "Hand over drawings and get a model",
        "Change anything by asking",
        "Ask questions about what's on screen",
        "Look up a real address and get its outline",
    ],
)

d.statement(
    "Automated means automated.",
    body="No modelling session. No template to choose from. No one working "
    "through the sheets by hand. One pass from the documents we already have to "
    "a building we can walk through \u2014 and it stays editable afterwards.",
)

d.divider("02", "The difference")

d.cards(
    "02 \u2014 The difference",
    "Why nothing else does this.",
    [
        (
            "Design software",
            "Powerful, but somebody still has to draw the entire building. The "
            "AI features that exist run as online services.",
        ),
        (
            "Early-stage layout tools",
            "Useful for quick studies of what fits on a site. They won't read "
            "an issued drawing set, and they run in the cloud.",
        ),
        (
            "AI chat products",
            "They will happily describe a building. They can't hand you one you "
            "can measure, cost, or edit.",
        ),
        (
            "Drawing-to-model services",
            "Accurate, but the files are sent away to another company and the "
            "result comes back days later.",
        ),
    ],
    footer="The gap: a building produced automatically, from our own documents, "
    "on our own equipment.",
)

d.two_col(
    "02 \u2014 The difference",
    "It doesn't draw the building. It decides what the building is.",
    "This is the part that makes everything else work. Other tools try to "
    "generate the shape itself, and what comes back is a picture or a lump of "
    "geometry \u2014 nothing anyone can build from. Acon splits the job in two. "
    "The model decides what the building should be: how big, how many floors, "
    "which rooms sit where. The software then constructs it precisely from those "
    "decisions. That is why the result behaves like a building instead of a "
    "render.",
    "Why that matters",
    [
        "Every dimension is a real dimension",
        "Nothing is guessed into place",
        "Same result from words, drawings, or an address",
        "The model can be swapped without breaking it",
        "The building stays editable afterwards",
    ],
)

d.bullets(
    "02 \u2014 The difference",
    "What comes out that no other tool produces.",
    [
        "Services that are properly coordinated \u2014 pipes, ducts, power and "
        "data each keep their own space in the ceiling and their own line down "
        "through the building, the way a real set of drawings resolves them.",
        "Drawings, not just a picture \u2014 floor levels, roof heights, "
        "dimensions and a title block, in the language a construction set "
        "already uses.",
        "Buildings that behave like buildings \u2014 upper floors step back "
        "correctly, towers taper, and a spire is added when only its tip height "
        "is known.",
        "Measured facts kept apart from generated ones \u2014 when a building is "
        "looked up by address, the real outline is labelled as measured, so "
        "nobody mistakes it for a suggestion.",
        "Changes by conversation \u2014 resize a room, take the roof off, change "
        "a finish. The building updates; nothing is rebuilt from scratch.",
        "The build, played back \u2014 site, slab, structure, walls, roof and "
        "services appear in order, so you can watch how it goes together.",
    ],
    footer="All of it produced automatically, and all of it able to run in-house.",
)

d.divider("03", "The reason")

d.cards(
    "03 \u2014 The reason",
    "Three reasons this cannot live in the cloud.",
    [
        (
            "The drawings are confidential",
            "Blueprints, structural drawings and tender documents belong to "
            "clients. Many agreements simply do not allow them to be handed to "
            "another company for processing.",
        ),
        (
            "Today the thinking happens elsewhere",
            "The part of Acon that interprets a project currently runs on an "
            "outside service, so every request sends project information out of "
            "the office.",
        ),
        (
            "Modelling by hand is the bottleneck",
            "Turning a received drawing set into a usable 3D model takes days of "
            "skilled time \u2014 and it starts again with every revision.",
        ),
    ],
)

d.bullets(
    "03 \u2014 The reason",
    "The software has to live inside the firm.",
    [
        "Nothing leaves the office. The drawings stay exactly where they already "
        "are.",
        "Nothing to declare to a client, because no outside company ever handles "
        "their documents.",
        "No question of what happens to the files afterwards. They are never "
        "sent anywhere, so there is no policy to take on trust.",
        "It keeps working without an internet connection \u2014 on site, on "
        "secure floors, anywhere.",
        "No subscription per person and no charge per revision. The cost is the "
        "machine, once.",
    ],
)

d.divider("04", "The approach")

d.two_col(
    "04 \u2014 The approach",
    "One machine in the office, doing all the thinking.",
    "Everything already built stays exactly as it is. The only thing that "
    "changes is where the intelligence runs. Instead of sending each request out "
    "to an online service, Acon asks a model running on a Dell Pro Max with "
    "GB10 \u2014 a compact machine that sits in the office and is built for "
    "precisely this kind of work.",
    "The whole change",
    [
        "Same software.",
        "Different machine.",
        "Nothing leaves the building.",
    ],
)

d.cards(
    "04 \u2014 The machine",
    "A supercomputer that fits on a desk.",
    [
        (
            "Purpose-built",
            "Designed by Dell and NVIDIA for running AI models on your own "
            "premises, rather than an ordinary workstation pressed into service.",
        ),
        (
            "Room for large models",
            "128 GB of memory, shared between processor and graphics. That is "
            "what lets a genuinely capable model sit on the machine at once.",
        ),
        (
            "Serious speed",
            "Up to a thousand trillion calculations a second, so a request comes "
            "back while someone waits, not minutes later.",
        ),
        (
            "Room to grow",
            "Handles models far larger than we need today. Two machines side by "
            "side handle twice as much again.",
        ),
    ],
    footer="It sits under a desk, runs on ordinary office power, and the same "
    "setup moves to larger hardware later if it is ever needed.",
)

d.cards(
    "05 \u2014 The models",
    "The model has to be able to read a drawing.",
    [
        (
            "It reads the sheets",
            "Qwen-VL is a model that sees as well as reads. It looks at a "
            "drawing the way a person does \u2014 finding the dimensions, the "
            "room names, the levels, and where each of them sits on the page.",
        ),
        (
            "It plans the building",
            "The same model then decides what the building is, and hands those "
            "decisions to the software to construct. One model covers both jobs, "
            "so there is less to look after.",
        ),
        (
            "Sized to the machine",
            "These models are openly available and free to run, in sizes made "
            "for hardware like this. We start with a smaller one to prove it "
            "works and move up only if accuracy asks for it.",
        ),
    ],
    footer="Everything runs on the machine in the office. The outside service in "
    "use today is switched off.",
)

d.steps(
    "05 \u2014 How it works",
    "From documents to a building, in five steps.",
    [
        ("01", "Hand it over", "Drawings, a scan, or a photograph of a marked-up sheet."),
        ("02", "Read", "The model on the office machine reads the sheet: sizes, levels, room names."),
        ("03", "Decide", "It works out what the building is \u2014 outline, floors, rooms, heights."),
        ("04", "Build", "The software constructs the model precisely from those decisions."),
        ("05", "Use it", "Walk through it, measure it, and change it by asking."),
    ],
)

d.compare(
    "04 \u2014 What changes",
    "Only one thing changes.",
    (
        "Now",
        [
            "A request leaves the office.",
            "An outside service interprets the project.",
            "The answer comes back over the internet.",
        ],
        "The drawings leave the office.",
        MUTED,
    ),
    (
        "Target",
        [
            "The same request goes to the machine in the office.",
            "The model on that machine interprets the project.",
            "The answer never touches the internet.",
        ],
        "The drawings never leave.",
        ACCENT,
    ),
    "Everything else \u2014 the app, the editing, the address lookup \u2014 "
    "works exactly as it does today.",
)

d.columns(
    "04 \u2014 What changes",
    "What changes, and what doesn't.",
    (
        "What changes",
        [
            "The thinking moves to the machine in the office.",
            "Uploaded drawings are shown to the model, so it can actually read "
            "them.",
            "The outside service is switched off.",
        ],
    ),
    (
        "What stays the same",
        [
            "The app, the 3D model, and the way editing works.",
            "The way buildings are constructed from decisions.",
            "Address lookups and their measured outlines.",
        ],
    ),
)

d.table(
    "05 \u2014 Side by side",
    "Cloud today. Our own office instead.",
    ["", "Outside service (today)", "Our own machine (target)"],
    [
        ("Where the thinking happens", "Someone else's servers", "A machine in our office"),
        ("Drawings leave the firm", "Yes", "No"),
        ("Works without internet", "No", "Yes"),
        ("Can read a drawing set", "Not properly", "Yes, it sees the page"),
        ("Cost per revision", "Charged per request", "Nothing"),
        ("Outside company involved", "Yes", "No"),
        ("What clients must be told", "Their documents go elsewhere", "Nothing"),
    ],
)

d.stats(
    "In short",
    [
        ("128 GB", "Memory for large models"),
        ("1", "Machine, in our office"),
        ("0", "Drawings leaving the firm"),
        ("0", "Cost per revision"),
    ],
    "Machine figures as published by Dell and NVIDIA.",
)

d.cards(
    "06 \u2014 Being realistic",
    "What to be realistic about.",
    [
        (
            "Fast, not infinite",
            "One machine comfortably serves a team, not the whole firm at once. "
            "If use grows, we add a second.",
        ),
        (
            "A specialist machine",
            "It is set up for AI work rather than everyday office software, so "
            "installing it properly takes a little time.",
        ),
        (
            "Reading drawings needs checking",
            "Messy scans and handwritten dimensions are where these models make "
            "mistakes. We test against drawings with known answers before anyone "
            "relies on it.",
        ),
    ],
)

d.bullets(
    "06 \u2014 How we'll know",
    "How we'll know it works.",
    [
        "The same requests, side by side: what the office machine produces "
        "against what the outside service produces today.",
        "Real drawing sets with known dimensions, marked for accuracy by the "
        "people who model them now.",
        "How long a request takes, measured honestly rather than demonstrated.",
        "How often it gets something wrong \u2014 and whether the mistake is "
        "caught before anyone sees it.",
    ],
)

d.roadmap(
    "06 \u2014 The plan",
    "Prove it, then rely on it.",
    [
        (
            "Now",
            "Set up",
            "The machine in the office, the model running on it, and one "
            "complete building produced with the outside service switched off.",
        ),
        (
            "Next",
            "Switch over",
            "The office machine becomes the normal way Acon works. The outside "
            "service becomes optional.",
        ),
        (
            "Then",
            "Sharpen",
            "A larger model if the drawing tests call for it, with accuracy "
            "signed off by the modelling team.",
        ),
        (
            "Later",
            "Grow",
            "A second machine, or the same setup on a firm server, if demand "
            "grows. Nothing needs rewriting.",
        ),
    ],
)

d.cards(
    "06 \u2014 The ask",
    "What we need.",
    [
        (
            "The machine",
            "One Dell Pro Max with GB10, connected to the office network.",
        ),
        (
            "Setup time",
            "A couple of days to install it and get the model running properly.",
        ),
        (
            "Drawings to test with",
            "Around ten real sets, already checked by hand, cleared for internal "
            "use.",
        ),
        (
            "A decision",
            "Approval to make the office machine the normal way this runs, and "
            "retire the outside service.",
        ),
    ],
)

d.close(
    "In-house.",
    "Acon \u2014 automatic building generation on our own hardware. Nothing "
    "leaves the office.",
)

d.save()
print(f"wrote {OUT} ({len(d.prs.slides._sldIdLst)} slides)")
