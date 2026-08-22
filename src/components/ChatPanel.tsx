import { useEffect, useRef, useState } from "react";
import type { AgentStatus, ModelSettings } from "../agent/modelSettings";
import {
  PROVIDER_DEFAULTS,
  loadModelSettings,
  preferredProvider,
  providerHasServerKey,
} from "../agent/modelSettings";
import { actionLabels, runConstructionAgent } from "../agent/runAgent";
import type { ChatAttachment, ChatMessage } from "../agent/types";
import { useConstruction } from "../editor/ConstructionContext";
import { useEditor } from "../editor/EditorContext";

export function ChatPanel() {
  const { floorPlan, applyAgentActions } = useEditor();
  const { startPlayback } = useConstruction();
  const [settings, setSettings] = useState<ModelSettings>(defaultModelSettingsSafe);
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const apiReady =
    settings.provider === "ollama"
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

  const send = async (text: string) => {
    const trimmed = text.trim();
    if ((!trimmed && files.length === 0) || busy) {
      return;
    }
    const attachments: ChatAttachment[] = files.map((file) => ({
      name: file.name,
      type: file.type,
      size: file.size,
    }));
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: trimmed || `Extract ${attachments.length} drawing(s)`,
      attachments,
    };
    setMessages((current) => [...current, userMessage]);
    setDraft("");
    setFiles([]);
    setBusy(true);
    try {
      const turn = await runConstructionAgent({
        text: userMessage.text,
        plan: floorPlan,
        attachments,
        settings,
        requireApi: apiReady,
      });
      const applied = applyAgentActions(turn.actions);
      if (turn.actions.some((action) => action.type === "replace_plan")) {
        startPlayback(12000);
      }
      setMessages((current) => [
        ...current,
        {
          id: `asst-${Date.now()}`,
          role: "assistant",
          agent: turn.agent,
          planner: turn.planner,
          model: turn.model,
          text: turn.reply,
          actions: applied.length > 0 ? actionLabels(turn) : undefined,
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          text:
            error instanceof Error
              ? error.message
              : "The agent API could not complete that turn.",
        },
      ]);
    } finally {
      setBusy(false);
      requestAnimationFrame(() => {
        listRef.current?.scrollTo({
          top: listRef.current.scrollHeight,
          behavior: "smooth",
        });
      });
    }
  };

  return (
    <aside className="chat-panel" aria-label="Construction chat">
      <header className="view-panel-header">
        <p className="view-kicker">Agent</p>
        <h1>Construction chat</h1>
        <p className={`chat-status ${apiReady ? "is-live" : ""}`}>
          {apiReady
            ? `Live · ${PROVIDER_DEFAULTS[settings.provider].label}`
            : "Local rules · add an API key to test a model"}
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
          placeholder="Build, edit, or extract…"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send(draft);
            }
          }}
        />
        <div className="chat-form-actions">
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
    </aside>
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
