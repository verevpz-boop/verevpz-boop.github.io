"use client";
import { useEffect, useRef, useState } from "react";
import { JarviEngine, type JarviState } from "./jarvi-engine";
import { JarviHeadCanvas, type JarviDriver } from "./jarvi-head";

/**
 * Окно Джарви для AI-BOTS («первое окошко» по ТЗ §7).
 * Стартовая кнопка обязательна: без user activation Chrome не даст ни мик,
 * ни speechSynthesis. Внутри клика движок получает всё разом.
 */

const STATE_LABEL: Record<JarviState, string> = {
  off: "ОЖИДАНИЕ",
  idle: "ОЖИДАНИЕ",
  listening: "СЛУШАЮ",
  thinking: "ДУМАЮ",
  speaking: "ГОВОРЮ",
  sleeping: "МОЗГ СПИТ",
  denied: "НЕТ МИКРОФОНА",
};

const STATE_COLOR: Record<JarviState, string> = {
  off: "#7a6a3a",
  idle: "#7a6a3a",
  listening: "#3fb6c9",
  thinking: "#c98a3f",
  speaking: "#C9A961",
  sleeping: "#8a6a6a",
  denied: "#c96a5a",
};

export function JarviWindow() {
  const driver = useRef<JarviDriver>({ state: "off", mouth: -1 });
  const engineRef = useRef<JarviEngine | null>(null);
  const [state, setState] = useState<JarviState>("off");
  const [subtitle, setSubtitle] = useState("");
  const [userText, setUserText] = useState("");
  const [latency, setLatency] = useState<number | null>(null);
  const [supported, setSupported] = useState(true);
  const [debug, setDebug] = useState(false);

  useEffect(() => {
    setSupported(JarviEngine.supported());
    setDebug(new URLSearchParams(window.location.search).has("debug"));
    return () => engineRef.current?.stop();
  }, []);

  // Приветствие теперь проговаривает САМ движок после старта (engine.greet),
  // голосом Джарви и с защитой эхо-фильтра — не обрывается и не уходит себе в микрофон.

  const start = () => {
    if (!engineRef.current) {
      engineRef.current = new JarviEngine({
        onState: (s) => { driver.current.state = s; setState(s); },
        onSubtitle: setSubtitle,
        onUserText: setUserText,
        onLatency: (ms) => { setLatency(ms); console.log(`[jarvi] замолчал→первый звук: ${ms}мс`); },
        onMouth: (v) => { driver.current.mouth = v; }, // живой липсинк по амплитуде
      });
    }
    void engineRef.current.start();
  };

  const stop = () => engineRef.current?.stop();

  const running = state !== "off" && state !== "sleeping" && state !== "denied";

  return (
    <div className="relative h-full w-full overflow-hidden rounded-sm bg-black">
      <JarviHeadCanvas driver={driver} />

      {/* имя */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 px-4 pt-4 text-center">
        <p style={{ fontFamily: "var(--font-cormorant), serif", fontStyle: "italic", fontSize: 22, letterSpacing: "0.3em", color: "#C9A961" }}>
          ДЖАРВИ
        </p>
        <p style={{ marginTop: 2, fontSize: 9, letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(245,241,232,0.35)" }}>
          голосовой ассистент студии · можно перебивать
        </p>
      </div>

      {/* статус-чип */}
      {running && (
        <div className="pointer-events-none absolute left-1/2 top-16 -translate-x-1/2">
          <span style={{
            fontSize: 10, letterSpacing: "0.35em",
            color: STATE_COLOR[state], border: `1px solid ${STATE_COLOR[state]}`,
            borderRadius: 999, padding: "4px 14px", background: "rgba(0,0,0,0.45)",
          }}>
            ● {STATE_LABEL[state]}
          </span>
        </div>
      )}

      {/* субтитры: что слышит и что говорит */}
      <div className="pointer-events-none absolute bottom-16 left-0 right-0 px-6 text-center">
        {userText && running && (
          <p className="mb-1 text-[11px] leading-snug" style={{ color: "rgba(63,182,201,0.75)" }}>
            — {userText}
          </p>
        )}
        {subtitle && (
          <p className="mx-auto max-w-xl text-[13px] leading-snug" style={{ color: "rgba(245,241,232,0.85)" }}>
            {subtitle}
          </p>
        )}
      </div>

      {/* стартовая кнопка / управление */}
      <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-3">
        {!supported ? (
          <p className="px-4 text-center text-[11px]" style={{ color: "rgba(245,241,232,0.5)" }}>
            Для разговора с Джарви нужен Chrome или Edge на компьютере
          </p>
        ) : !running ? (
          <button
            onClick={start}
            className="cursor-pointer transition-all active:scale-[0.96]"
            style={{
              fontSize: 12, letterSpacing: "0.25em", textTransform: "uppercase",
              padding: "10px 26px", borderRadius: 6,
              color: "#0a0a0a", background: "#C9A961", border: "1px solid #C9A961",
            }}
          >
            {state === "sleeping" ? "Мозг спит — повторить" : state === "denied" ? "Разрешите микрофон" : "Поговорить с Джарви"}
          </button>
        ) : (
          <button
            onClick={stop}
            className="cursor-pointer transition-all active:scale-[0.96]"
            style={{
              fontSize: 10, letterSpacing: "0.25em", textTransform: "uppercase",
              padding: "7px 18px", borderRadius: 6,
              color: "rgba(245,241,232,0.7)", background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(201,169,97,0.3)",
            }}
          >
            Завершить
          </button>
        )}
      </div>

      {/* замер латентности (?debug) */}
      {debug && latency !== null && (
        <div className="absolute right-2 top-2 rounded bg-black/60 px-2 py-1 text-[10px]" style={{ color: latency <= 1000 ? "#7ac97a" : "#c96a5a" }}>
          {latency} мс
        </div>
      )}
    </div>
  );
}
