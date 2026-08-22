import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { BuildingSpec } from "../agent/buildingSpec";
import { compileSpec } from "../agent/compileSpec";
import type { AgentStatus, ModelSettings } from "../agent/modelSettings";
import {
  PROVIDER_DEFAULTS,
  loadModelSettings,
  preferredProvider,
  providerHasServerKey,
} from "../agent/modelSettings";
import { describeAction } from "../agent/applyAction";
import type { EditNotice } from "../agent/editReview";
import { reviewEdits } from "../agent/editReview";
import { actionLabels, runConstructionAgent } from "../agent/runAgent";
import type { SpecOption } from "../agent/specOptions";
import { applySpecChoice, buildSpecQuestions } from "../agent/specOptions";
import type { ChatAttachment, ChatMessage, FollowUp, FollowUpOption } from "../agent/types";
import { useConstruction } from "../editor/ConstructionContext";
import { useEditor } from "../editor/EditorContext";
import { SWEEP } from "./motionTokens";
import { NemoclawNotice } from "./NemoclawNotice";
import { CollapseButton, PanelLauncher } from "./PanelCollapse";
import { rememberDrawings } from "./referenceDrawings";

interface PendingBuild {
  spec: BuildingSpec;
  index: number;
}

export function ChatPanel() {
  const { floorPlan, applyAgentActions } = useEditor();
  const { startPlayback } = useConstruction();
  const [settings, setSettings] = useState<ModelSettings>(defaultModelSettingsSafe);
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(true);
  const [pending, setPending] = useState<PendingBuild | null>(null);
  const [followUp, setFollowUp] = useState<FollowUp | null>(null);
  const [review, setReview] = useState<EditNotice | null>(null);
  const [locked, setLocked] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const messageSeq = useRef(0);
  const questions = useMemo(
    () => (pending ? buildSpecQuestions(pending.spec) : []),
    [pending],
  );
  const question = pending ? questions[pending.index] : undefined;
  const apiReady =
    settings.provider === "local"
      ? Boolean(status?.local?.up)
      : settings.provider === "ollama"
        ? Boolean(status?.ollama.up)
        : Boolean(settings.apiKey) || providerHasServerKey(status, settings.provider);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch("/api/agent");
        if (!response.ok) {
          return;
        }
        const next = (await response.json()) as AgentStatus;
        if (cancelled) {
          return;
        }
        setStatus(next);
        // The provider is not user-selectable, so always follow whatever the
        // server can actually serve.
        const preferred = preferredProvider(next);
        if (preferred) {
          setSettings((current) =>
            current.provider === preferred
              ? current
              : { ...current, provider: preferred, model: PROVIDER_DEFAULTS[preferred].model },
          );
        }
      } catch {
        /* status stays unknown */
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const nextId = (prefix: string) => {
    messageSeq.current += 1;
    return `${prefix}-${messageSeq.current}`;
  };

  const scrollToEnd = () => {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({
        top: listRef.current.scrollHeight,
        behavior: "smooth",
      });
    });
  };

  const say = (message: Omit<ChatMessage, "id">) => {
    setMessages((current) => [...current, { ...message, id: nextId(message.role) }]);
    scrollToEnd();
  };

  const commitBuild = (spec: BuildingSpec) => {
    const plan = compileSpec(spec);
    const applied = applyAgentActions([
      {
        type: "replace_plan",
        plan,
        note: `Built ${spec.width}×${spec.depth} m ${spec.typology}`,
      },
    ]);
    if (applied.length > 0) {
      startPlayback(12000);
    }
    setPending(null);
    say({
      role: "assistant",
      agent: "construct",
      text: `Building ${plan.name} — ${spec.width} × ${spec.depth} m, ${spec.stories} ${spec.stories === 1 ? "storey" : "storeys"}, ${round(spec.stories * spec.storyHeight)} m tall.`,
    });
  };

  const choose = (option: SpecOption) => {
    if (!pending) {
      return;
    }
    const spec = applySpecChoice(pending.spec, option.patch);
    say({ role: "user", text: option.label });
    if (pending.index + 1 >= questions.length) {
      commitBuild(spec);
      return;
    }
    setPending({ spec, index: pending.index + 1 });
    scrollToEnd();
  };

  /** Accepts the model's proposal for this question and every one after it. */
  const acceptSuggested = () => {
    if (!pending) {
      return;
    }
    let spec = pending.spec;
    for (const remaining of questions.slice(pending.index)) {
      const suggested =
        remaining.options.find((option) => option.recommended) ?? remaining.options[1];
      spec = applySpecChoice(spec, suggested.patch);
    }
    commitBuild(spec);
  };

  const answerReview = (choice: "accept" | "fit" | "cancel") => {
    if (!review || (choice === "fit" && !review.fitLabel)) {
      return;
    }
    const label =
      choice === "accept" ? "Accept" : choice === "fit" ? review.fitLabel! : "Decline";
    say({ role: "user", text: label });
    setReview(null);
    if (choice === "cancel") {
      say({ role: "assistant", agent: "edit", text: "Left the plan as it was." });
      return;
    }
    const actions = choice === "accept" ? review.asked : review.trimmed;
    const applied = applyAgentActions(actions);
    say({
      role: "assistant",
      agent: "edit",
      text:
        choice === "accept"
          ? "Done — the building has changed shape, so check the storeys above."
          : `Done — kept inside the shell at ${review.fitLabel?.replace(/^(Keep|Use)\s+/, "")}.`,
      actions: applied.length > 0 ? actions.map(describeAction) : undefined,
    });
  };

  const chooseFollowUp = (option: FollowUpOption) => {
    if (option.prompt) {
      void send(option.prompt);
      return;
    }
    say({ role: "user", text: option.label });
    setFollowUp(null);
    say({ role: "assistant", agent: "edit", text: "Okay — leaving it." });
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
    const chip = followUp?.options.find(
      (option) => option.label.toLowerCase() === trimmed.toLowerCase(),
    );
    if (chip) {
      chooseFollowUp(chip);
      return;
    }
    if (followUp && /^(yes|yeah|yep|sure|ok|okay|do it|please)\.?$/i.test(trimmed)) {
      const suggested =
        followUp.options.find((option) => option.recommended && option.prompt) ??
        followUp.options.find((option) => option.prompt);
      if (suggested?.prompt) {
        await send(suggested.prompt);
        return;
      }
    }
    if (followUp && /^(no|nah|nope|leave it|not now|skip|keep it)\.?$/i.test(trimmed)) {
      say({ role: "user", text: trimmed });
      setFollowUp(null);
      say({ role: "assistant", agent: "edit", text: "Okay — leaving it." });
      return;
    }
    if ((!trimmed && files.length === 0) || busy) {
      return;
    }
    const attachments = await readChatAttachments(files);
    // Held before the base64 is stripped below, so the sheet can be compared
    // against whatever the model builds from it.
    rememberDrawings(attachments);
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: trimmed || `Read ${attachments.length} drawing${attachments.length === 1 ? "" : "s"}`,
      attachments: attachments.map(({ dataUrl: _data, ...file }) => file),
    };
    setMessages((current) => [...current, userMessage]);
    setDraft("");
    setFiles([]);
    setBusy(true);
    // A new prompt supersedes any half-answered proposal.
    setPending(null);
    setFollowUp(null);
    setReview(null);
    try {
      const turn = await runConstructionAgent({
        text: userMessage.text,
        plan: floorPlan,
        attachments,
        settings,
        requireApi: apiReady,
        locked,
      });
      // A change that would deform the building waits for an answer instead of
      // landing quietly in the model.
      const notice = reviewEdits(floorPlan, turn.actions);
      if (notice) {
        say({
          role: "assistant",
          agent: turn.agent,
          planner: turn.planner,
          model: turn.model,
          text: turn.reply,
        });
        setReview(notice);
        return;
      }
      const applied = applyAgentActions(turn.actions);
      if (!locked && turn.actions.some((action) => action.type === "replace_plan")) {
        startPlayback(12000);
      }
      say({
        role: "assistant",
        agent: turn.agent,
        planner: turn.planner,
        model: turn.model,
        text: turn.reply,
        actions: applied.length > 0 ? actionLabels(turn) : undefined,
      });
      if (turn.followUp) {
        setFollowUp(turn.followUp);
      }
      if (!locked && turn.draftSpec) {
        // A surveyed building has no questions to ask, so it goes up as-is.
        if (buildSpecQuestions(turn.draftSpec).length === 0) {
          commitBuild(turn.draftSpec);
        } else {
          setPending({ spec: turn.draftSpec, index: 0 });
        }
      }
    } catch (error) {
      say({
        role: "assistant",
        text:
          error instanceof Error
            ? error.message
            : "The agent API could not complete that turn.",
      });
    } finally {
      setBusy(false);
      scrollToEnd();
    }
  };

  // The panel and its handle cross over rather than queue — see LeftRail for why
  // waiting on the outgoing animation is a trap.
  return (
    <AnimatePresence initial={false}>
      {!open ? (
        <PanelLauncher
          key="handle"
          side="right"
          label="Show construction chat"
          busy={busy}
          onClick={() => setOpen(true)}
        />
      ) : (
        <motion.aside
          key="chat"
          className="chat-panel"
          aria-label="Construction chat"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={SWEEP}
        >
          <CollapseButton
            side="right"
            label="Hide construction chat"
            onClick={() => setOpen(false)}
          />
          <header className="view-panel-header">
            <p className="view-kicker">Agent</p>
            <h1>Construction chat</h1>
            <p className={`chat-status ${apiReady ? "is-live" : ""}`}>
              {locked
                ? "Locked · edits only"
                : apiReady
                  ? settings.provider === "local"
                    ? "Local VL · GB10"
                    : "Live"
                  : "Local rules · no model configured"}
            </p>
          </header>

          <div className="chat-log" ref={listRef}>
            {messages.map((message) => (
              <article
                key={message.id}
                className={
                  message.role === "user" ? "chat-bubble is-user" : "chat-bubble"
                }
              >
                {message.agent ? (
                  <span className="chat-agent">
                    {message.agent}
                    {message.planner ? ` · ${message.planner}` : ""}
                    {message.model ? ` · ${message.model}` : ""}
                  </span>
                ) : null}
                <p>{message.text}</p>
                {message.attachments?.length ? (
                  <ul className="chat-files">
                    {message.attachments.map((file) => (
                      <li key={file.name}>{file.name}</li>
                    ))}
                  </ul>
                ) : null}
                {message.actions?.length ? (
                  <ul className="chat-actions">
                    {message.actions.map((action) => (
                      <li key={action}>{action}</li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
            {followUp && !question ? (
              <section className="chat-options" aria-label={followUp.prompt}>
                <header className="chat-options-head">
                  <p className="chat-options-prompt">{followUp.prompt}</p>
                </header>
                <div className="chat-options-grid">
                  {followUp.options.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={
                        option.recommended
                          ? "chat-option is-suggested"
                          : "chat-option"
                      }
                      onClick={() => chooseFollowUp(option)}
                      disabled={busy}
                    >
                      <span className="chat-option-label">{option.label}</span>
                      <span className="chat-option-detail">{option.detail}</span>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}
            {question && pending ? (
              <section className="chat-options" aria-label={question.prompt}>
                <header className="chat-options-head">
                  <p className="chat-options-prompt">{question.prompt}</p>
                  <span className="chat-options-step">
                    {pending.index + 1} / {questions.length}
                  </span>
                </header>
                <div className="chat-options-grid">
                  {question.options.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={
                        option.recommended
                          ? "chat-option is-suggested"
                          : "chat-option"
                      }
                      onClick={() => choose(option)}
                      disabled={busy}
                    >
                      <span className="chat-option-label">{option.label}</span>
                      <span className="chat-option-detail">{option.detail}</span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="chat-options-skip"
                  onClick={acceptSuggested}
                  disabled={busy}
                >
                  Use suggested for the rest
                </button>
              </section>
            ) : null}
            {review ? (
              <NemoclawNotice
                notice={review}
                busy={busy}
                onAccept={() => answerReview("accept")}
                onFit={() => answerReview("fit")}
                onCancel={() => answerReview("cancel")}
              />
            ) : null}
            {busy ? <p className="chat-pending">Agent working…</p> : null}
          </div>

          {files.length > 0 ? (
            <p className="chat-attached">
              {files.length} drawing{files.length === 1 ? "" : "s"} attached
            </p>
          ) : null}

          <form
            className="chat-form"
            onSubmit={(event) => {
              event.preventDefault();
              void send(draft);
            }}
          >
            <textarea
              value={draft}
              rows={3}
              placeholder={
                locked
                  ? "Attach an elevation or describe an edit…"
                  : "Build, edit, or extract…"
              }
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send(draft);
                }
              }}
            />
            <div className="chat-form-actions">
              <div className="chat-form-tools">
                <button
                  type="button"
                  className={locked ? "chat-lock is-on" : "chat-lock"}
                  aria-pressed={locked}
                  title={
                    locked
                      ? "Unlock — allow constructing a new model"
                      : "Lock — edit the current workspace without rebuilding"
                  }
                  onClick={() => {
                    setLocked((current) => {
                      const next = !current;
                      if (next) {
                        setPending(null);
                      }
                      return next;
                    });
                  }}
                >
                  <LockIcon locked={locked} />
                  {locked ? "Locked" : "Lock"}
                </button>
                <label className="chat-attach" title="Attach drawings">
                  <input
                    type="file"
                    accept="image/*,.pdf,.dwg"
                    multiple
                    onChange={(event) =>
                      setFiles(Array.from(event.target.files ?? []))
                    }
                  />
                  <PaperclipIcon />
                  Drawings
                </label>
              </div>
              <button
                type="submit"
                className="chat-send"
                disabled={busy || (!draft.trim() && files.length === 0)}
                aria-label="Send"
                title="Send · Enter"
              >
                <ArrowUpIcon />
              </button>
            </div>
          </form>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function LockIcon({ locked }: { locked: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      {locked ? (
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      ) : (
        <path d="M8 11V8a4 4 0 0 1 7.5-2" />
      )}
    </svg>
  );
}

function PaperclipIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M20.5 11.5 12 20a5 5 0 0 1-7-7l8-8a3.5 3.5 0 0 1 5 5l-8 8a2 2 0 0 1-3-3l7-7" />
    </svg>
  );
}

function ArrowUpIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 19V5" />
      <path d="m5 12 7-7 7 7" />
    </svg>
  );
}

async function readChatAttachments(files: File[]): Promise<ChatAttachment[]> {
  return Promise.all(
    files.map(async (file) => {
      const attachment: ChatAttachment = {
        name: file.name,
        type: file.type,
        size: file.size,
      };
      if (file.type.startsWith("image/")) {
        attachment.dataUrl = await fileToDataUrl(file);
      }
      return attachment;
    }),
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function defaultModelSettingsSafe(): ModelSettings {
  if (typeof sessionStorage === "undefined") {
    return {
      provider: "replicate",
      apiKey: "",
      model: PROVIDER_DEFAULTS.replicate.model,
    };
  }
  return loadModelSettings();
}
