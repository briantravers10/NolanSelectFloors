import { NextResponse } from "next/server";
import { getActingUser } from "@/lib/current-user";
import { getCurrentSession, isRealAuthConfigured } from "@/lib/auth";
import { ASSISTANT_GUIDE } from "@/lib/assistant-guide";

export const runtime = "nodejs";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * The AI Assistant: answers "how do I…" questions about this app. Sends
 * the conversation plus the app guide to Claude. Needs ANTHROPIC_API_KEY
 * in the environment; without it the panel explains that it isn't set
 * up yet rather than failing.
 */
export async function POST(request: Request) {
  if (isRealAuthConfigured()) {
    const session = await getCurrentSession();
    if (!session?.isRealAuth) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json({ reply: "The assistant isn't connected yet — an Anthropic API key needs to be added to the app's settings (ANTHROPIC_API_KEY). Ask Brian to set it up.", configured: false });
  }
  let body: { messages?: ChatMessage[]; page?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const messages = (body.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-16)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return NextResponse.json({ error: "Nothing to answer" }, { status: 400 });
  }
  const user = await getActingUser();
  const system = `${ASSISTANT_GUIDE}\n\nThe person asking is ${user.fullName}. They are currently on the page "${body.page ?? "unknown"}".`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: process.env.ASSISTANT_MODEL || "claude-sonnet-5", max_tokens: 700, system, messages }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("assistant: Anthropic API error", res.status, text.slice(0, 300));
      return NextResponse.json({ reply: "Sorry — the assistant couldn't answer just now. Try again in a moment." });
    }
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const reply = (data.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("\n").trim() || "Sorry — I didn't get an answer back.";
    return NextResponse.json({ reply, configured: true });
  } catch (err) {
    console.error("assistant: request failed", err);
    return NextResponse.json({ reply: "Sorry — the assistant couldn't answer just now. Try again in a moment." });
  }
}
