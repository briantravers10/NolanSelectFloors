"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const STORE_KEY = "nsf-assistant";
const SUGGESTIONS = ["How do I file an invoice from the inbox?", "How do I mark a job cancelled?", "How do I give someone access?", "What do the schedule colours mean?"];

/**
 * Floating AI Assistant. Opened from "AI Assistant" in the left menu (or
 * the mobile More menu). Stays on screen while you move around the app —
 * open state and the conversation are kept in this browser.
 */
export function AssistantPanel() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { open?: boolean; minimized?: boolean; messages?: Msg[] };
        // Restore in one batch so the panel doesn't flash closed → open.
        const t = setTimeout(() => {
          setOpen(Boolean(saved.open));
          setMinimized(Boolean(saved.minimized));
          setMessages(Array.isArray(saved.messages) ? saved.messages.slice(-30) : []);
        }, 0);
        return () => clearTimeout(t);
      }
    } catch {
      /* storage unavailable — fine */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ open, minimized, messages: messages.slice(-30) }));
    } catch {
      /* ignore */
    }
  }, [open, minimized, messages]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (detail === "open") {
        setOpen(true);
        setMinimized(false);
      } else {
        setOpen((o) => {
          if (!o) return true;
          setMinimized((m) => !m);
          return true;
        });
      }
    };
    window.addEventListener("nsf:assistant", handler);
    return () => window.removeEventListener("nsf:assistant", handler);
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, busy, minimized]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next.slice(-16), page: pathname }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      setMessages([...next, { role: "assistant", content: data.reply ?? data.error ?? "Sorry — no answer came back." }]);
    } catch {
      setMessages([...next, { role: "assistant", content: "Sorry — I couldn't reach the assistant. Check your connection and try again." }]);
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  if (minimized) {
    return (
      <button
        type="button"
        onClick={() => setMinimized(false)}
        className="fixed bottom-20 md:bottom-5 right-4 z-40 flex items-center gap-2 rounded-full bg-slate-900 text-white pl-3 pr-4 py-2 text-sm font-medium shadow-lg hover:bg-slate-800"
        aria-label="Open AI Assistant"
      >
        <Icon name="spark" className="w-4 h-4 text-sky-300" />
        AI Assistant
      </button>
    );
  }

  return (
    <div
      className="fixed z-40 bottom-20 md:bottom-5 right-2 md:right-5 w-[calc(100vw-1rem)] sm:w-[380px] max-h-[70vh] flex flex-col rounded-2xl border border-slate-300 bg-white shadow-2xl"
      role="dialog"
      aria-label="AI Assistant"
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-200 bg-slate-900 text-white rounded-t-2xl">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Icon name="spark" className="w-4 h-4 text-sky-300" />
          AI Assistant
          <span className="text-[10px] font-normal text-slate-300">how-to help for this app</span>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button type="button" onClick={() => setMessages([])} className="text-[11px] text-slate-300 hover:text-white px-1" title="Clear conversation">Clear</button>
          )}
          <button type="button" onClick={() => setMinimized(true)} className="p-1 text-slate-300 hover:text-white" aria-label="Minimise" title="Minimise — stays on screen">
            <span className="block w-3 border-b-2 border-current mb-1" />
          </button>
          <button type="button" onClick={() => setOpen(false)} className="p-1 text-slate-300 hover:text-white" aria-label="Close">
            <Icon name="close" className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2 text-sm min-h-[200px]">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-slate-600">Ask me how to do something in the app — filing emails, the schedule, payroll, access, anything.</p>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => send(s)} className="rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100">{s}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-3 py-2 whitespace-pre-wrap leading-snug ${m.role === "user" ? "bg-sky-600 text-white rounded-br-sm" : "bg-slate-100 text-slate-900 rounded-bl-sm"}`}>{m.content}</div>
          </div>
        ))}
        {busy && <div className="text-xs text-slate-500 animate-pulse">Thinking…</div>}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        className="flex items-end gap-2 border-t border-slate-200 p-2"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(input);
            }
          }}
          rows={2}
          placeholder="Type a question… (Enter to send)"
          className="flex-1 resize-none rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
        />
        <button type="submit" disabled={busy || !input.trim()} className="rounded-lg bg-slate-900 text-white px-3 py-2 text-sm font-medium disabled:opacity-50">Send</button>
      </form>
    </div>
  );
}
