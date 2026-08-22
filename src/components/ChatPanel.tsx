import { useEffect, useRef, useState } from "react";
import type { AgentStatus, ModelSettings } from "../agent/modelSettings";
import {
  PROVIDER_DEFAULTS,
  hasStoredModelSettings,
  loadModelSettings,
  preferredProvider,
  providerHasServerKey,
  saveModelSettings,
} from "../agent/modelSettings";
import { actionLabels, runConstructionAgent } from "../agent/runAgent";
import type { ChatAttachment, ChatMessage } from "../agent/types";
import { useConstruction } from "../editor/ConstructionContext";
import { useEditor } from "../editor/EditorContext";

const STARTERS = [
  "Build the Empire State Building",
  "Build 233 Broadway, Manhattan",
  "Build a commercial space just like Walmart",
  "Add a waste pipe to the grocery area",
];

export function ChatPanel() {
  const { floorPlan, applyAgentActions } = useEditor();
  const { startPlayback } = useConstruction();
  const [settings, setSettings] = useState<ModelSettings>(defaultModelSettingsSafe);
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      agent: "router",
      text: "Gemini 3.5 Flash on Replicate designs the layout from your prompt — a Walmart-style supercenter is not a house. After it compiles the FloorPlan, watch the live construction sequence.",
    },
  ]);
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
        // Open on whatever is actually configured, unless the user has already
        // picked a provider for this session.
        const preferred = preferredProvider(next);
        if (preferred && !hasStoredModelSettings()) {
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

  const updateSettings = (patch: Partial<ModelSettings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      if (patch.provider && !patch.model) {
        next.model = PROVIDER_DEFAULTS[patch.provider].model;
      }
      saveModelSettings(next);
      return next;
    });
  };

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

      <div className="chat-model">
        <select
          value={settings.provider}
          onChange={(event) =>
            updateSettings({
              provider: event.target.value as ModelSettings["provider"],
            })
          }
        >
          {Object.entries(PROVIDER_DEFAULTS).map(([id, meta]) => (
            <option key={id} value={id}>
              {meta.label}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={settings.model}
          onChange={(event) => updateSettings({ model: event.target.value })}
          aria-label="Model id"
        />
        {settings.provider === "ollama" ? (
          <p className="chat-hint">
            {status?.ollama.up
              ? `Ollama up · ${status.ollama.models.join(", ") || "no tags"}`
              : "Ollama is not running on :11434"}
          </p>
        ) : (
          <input
            type="password"
            value={settings.apiKey}
            placeholder={
              providerHasServerKey(status, settings.provider)
                ? "Using server env key"
                : PROVIDER_DEFAULTS[settings.provider].hint
            }
            onChange={(event) => updateSettings({ apiKey: event.target.value })}
            autoComplete="off"
          />
        )}
      </div>

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

      <div className="chat-starters">
        {STARTERS.map((starter) => (
          <button
            key={starter}
            type="button"
            className="chat-starter"
            onClick={() => send(starter)}
          >
            {starter}
          </button>
        ))}
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
        <label className="chat-attach">
          <input
            type="file"
            accept="image/*,.pdf,.dwg"
            multiple
            onChange={(event) =>
              setFiles(Array.from(event.target.files ?? []))
            }
          />
          Drawings
        </label>
        <textarea
          value={draft}
          rows={2}
          placeholder="Build, edit, or extract…"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send(draft);
            }
          }}
        />
        <button type="submit" className="btn-ghost" disabled={busy}>
          Send
        </button>
      </form>
    </aside>
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
