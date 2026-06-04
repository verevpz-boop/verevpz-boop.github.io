"use client";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

const BRIDGE_URL = "http://localhost:5680/bearbrick";

type Message = { role: "user" | "bear"; text: string };

interface Props {
  open: boolean;
  onClose: () => void;
}

export function BearBrickChat({ open, onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "bear",
      text: "Привет, дружище! Я BearBrick — расскажу про сайт. Что интересно? FASHION, TECH, CINEMA, GAMING или AI-BOTS?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 200);
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text }]);
    setLoading(true);
    try {
      const res = await fetch(BRIDGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      setMessages((m) => [
        ...m,
        { role: "bear", text: data.reply || "Хмм, не нашёл ответа. Спроси ещё раз?" },
      ]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: "bear", text: "Не могу до сервера дотянуться. Попробуй позже или напиши @Pavel4417." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="fixed bottom-32 right-8 z-40 w-[340px] md:w-[400px] h-[480px] flex flex-col rounded-xl overflow-hidden"
          style={{
            background: "rgba(10, 10, 14, 0.92)",
            border: "1px solid rgba(201, 169, 97, 0.4)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 0 24px rgba(201, 169, 97, 0.15)",
            backdropFilter: "blur(12px)",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{
              borderBottom: "1px solid rgba(201, 169, 97, 0.25)",
              background: "linear-gradient(180deg, rgba(201,169,97,0.08) 0%, transparent 100%)",
            }}
          >
            <div>
              <div style={{ color: "#C9A961", fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: "13px", letterSpacing: "0.15em" }}>
                BEARBRICK
              </div>
              <div style={{ color: "rgba(255,255,255,0.55)", fontSize: "10px", marginTop: "2px" }}>
                AI-маскот Pavel Zverev
              </div>
            </div>
            <button
              onClick={onClose}
              className="active:scale-[0.93] transition-transform"
              style={{
                color: "rgba(255,255,255,0.6)",
                background: "transparent",
                border: "none",
                fontSize: "18px",
                cursor: "pointer",
                padding: "4px 8px",
              }}
              aria-label="Закрыть"
            >
              ×
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
              >
                <div
                  style={{
                    maxWidth: "85%",
                    padding: "8px 12px",
                    borderRadius: m.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                    background: m.role === "user" ? "rgba(201, 169, 97, 0.18)" : "rgba(255,255,255,0.05)",
                    border: m.role === "user" ? "1px solid rgba(201, 169, 97, 0.3)" : "1px solid rgba(255,255,255,0.08)",
                    color: m.role === "user" ? "#f5e6c0" : "rgba(255,255,255,0.92)",
                    fontFamily: "Inter, sans-serif",
                    fontSize: "13px",
                    lineHeight: "1.45",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div
                  style={{
                    padding: "8px 14px",
                    borderRadius: "12px 12px 12px 2px",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "rgba(255,255,255,0.5)",
                    fontFamily: "Inter, sans-serif",
                    fontSize: "13px",
                  }}
                >
                  думаю…
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div
            className="px-3 py-3 flex gap-2"
            style={{
              borderTop: "1px solid rgba(255,255,255,0.07)",
              background: "rgba(0,0,0,0.35)",
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Спроси про сайт…"
              disabled={loading}
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "8px",
                padding: "8px 12px",
                color: "white",
                fontFamily: "Inter, sans-serif",
                fontSize: "13px",
                outline: "none",
              }}
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              className="active:scale-[0.95] transition-transform"
              style={{
                background: input.trim() && !loading ? "rgba(201, 169, 97, 0.85)" : "rgba(201, 169, 97, 0.25)",
                color: "#0a0a0e",
                border: "none",
                borderRadius: "8px",
                padding: "0 16px",
                fontFamily: "Inter, sans-serif",
                fontWeight: 700,
                fontSize: "12px",
                letterSpacing: "0.1em",
                cursor: input.trim() && !loading ? "pointer" : "not-allowed",
                transition: "background 0.2s",
              }}
            >
              →
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
