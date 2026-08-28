"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Loader2, Search } from "lucide-react";
import { post } from "@/lib/client";
import type { ChatMessage } from "@/lib/shape";

/**
 * Macro AI — the coach, as a conversation.
 *
 * Every reply is grounded in the person's own diary, and the model is not
 * allowed to state a nutrition figure from memory — when it needs one it
 * looks it up in the same databases the rest of the app uses. Those lookups
 * are shown under the answer, so you can see where "about 240 kcal" came
 * from rather than having to trust it.
 *
 * No streaming. It costs a second or two of waiting, and it buys a tool loop
 * that can resolve three foods before answering, which is what makes "two
 * rotis and a katori of dal" a question it can actually get right.
 */

const OPENERS = [
  "What should I eat tonight?",
  "How many calories in 2 rotis and dal?",
  "Am I on track this week?",
  "Why has my weight not moved?",
];

interface Turn extends ChatMessage {
  lookups?: string[];
  failed?: boolean;
}

export function Chat() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, busy]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;

    const next: Turn[] = [...turns, { role: "user", content: question }];
    setTurns(next);
    setDraft("");
    setBusy(true);

    try {
      const res = await post<{ text: string; lookups: string[] }>("/api/chat", {
        // Only the plain thread goes up; the coach rebuilds your data itself.
        messages: next.map(({ role, content }) => ({ role, content })),
      });
      setTurns([...next, { role: "assistant", content: res.text, lookups: res.lookups }]);
    } catch (e) {
      setTurns([...next, {
        role: "assistant",
        content: e instanceof Error ? e.message : "Could not reach Macro AI.",
        failed: true,
      }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[60svh] flex-col">
      <div className="flex-1 space-y-4">
        {turns.length === 0 && (
          <div className="space-y-3 pt-2">
            <p className="text-sm leading-relaxed text-[var(--color-mute)]">
              Ask about your day, your food or your training. Macro AI can see
              what you have logged, and looks nutrition up rather than guessing
              it — every figure it quotes came from a database, not its memory.
            </p>
            <div className="flex flex-wrap gap-2">
              {OPENERS.map((q) => (
                <button key={q} onClick={() => send(q)} className="chip text-left">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((t, i) => (
          <div key={i} className={t.role === "user" ? "flex justify-end" : ""}>
            <div
              className={
                t.role === "user"
                  ? "max-w-[85%] rounded-2xl rounded-br-md bg-[var(--color-slab-2)] px-3.5 py-2.5 text-[15px]"
                  : "max-w-[92%] space-y-2"
              }
            >
              <p
                className="whitespace-pre-wrap text-[15px] leading-relaxed"
                style={{ color: t.failed ? "var(--color-bad)" : undefined }}
              >
                {t.content}
              </p>

              {/* Provenance, the same as everywhere else in the app. */}
              {t.lookups && t.lookups.length > 0 && (
                <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--color-mute)]">
                  <Search size={11} />
                  looked up {[...new Set(t.lookups)].join(", ")}
                </p>
              )}
            </div>
          </div>
        ))}

        {busy && (
          <p className="flex items-center gap-2 text-sm text-[var(--color-mute)]">
            <Loader2 className="animate-spin" size={14} /> thinking
          </p>
        )}
        <div ref={endRef} />
      </div>

      <form
        className="sticky bottom-[84px] mt-4 flex gap-2 pb-2"
        onSubmit={(e) => { e.preventDefault(); send(draft); }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="field flex-1"
          placeholder="Ask Macro AI"
          aria-label="Ask Macro AI a question"
          enterKeyHint="send"
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          aria-label="Send"
          className="btn btn-primary w-12 px-0"
        >
          <ArrowUp size={18} />
        </button>
      </form>
    </div>
  );
}
