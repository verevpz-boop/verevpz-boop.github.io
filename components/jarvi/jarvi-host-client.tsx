"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { JarviState, JarviEngine } from "./jarvi-engine";

/**
 * Угловой хост Джарви — живой полноразмерный аватар вместо мишки.
 * ТОЛЬКО десктоп (как было у мишки — на мобиле тяжело/мелко). 3D-чанк
 * монтируется на простое (requestIdleCallback), чтобы не толкаться с контентом.
 *
 * Клик по аватару → запуск голосового движка (jarvi-engine): слух → мозг →
 * голос Силеро → перебивание. Состояние и амплитуды идут в канвас рефами:
 *  • stateRef → значки над головой (микрофон «слушаю» / комета «думаю»)
 *  • mouthRef → липсинк губ (амплитуда голоса Джарви)
 *  • inputRef → пульсация ауры микрофона (громкость голоса гостя)
 * Текст — только на ошибках (нет мика / мозг спит) + субтитр реплики.
 */
const JarviHostCanvas = dynamic(
  () => import("./jarvi-host").then((m) => m.JarviHostCanvas),
  { ssr: false, loading: () => null },
);

export function JarviHostClient() {
  const [mount3d, setMount3d] = useState(false);
  const [state, setState] = useState<JarviState>("off");
  const [subtitle, setSubtitle] = useState("");

  const stateRef = useRef<JarviState>("off");
  const mouthRef = useRef(0);
  const inputRef = useRef(0);
  const engineRef = useRef<JarviEngine | null>(null);

  useEffect(() => {
    if (window.innerWidth < 1024) return; // мобила — без хоста
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const id = w.requestIdleCallback
      ? w.requestIdleCallback(() => setMount3d(true), { timeout: 6000 })
      : window.setTimeout(() => setMount3d(true), 3000);
    return () => {
      if (w.cancelIdleCallback) w.cancelIdleCallback(id as number);
      else clearTimeout(id as number);
      engineRef.current?.stop();
    };
  }, []);

  // клик по хосту = user-activation → создаём движок и запускаем (если ещё не идёт)
  const handlePointerDown = async () => {
    const mod = await import("./jarvi-engine");
    if (!mod.JarviEngine.supported()) { stateRef.current = "denied"; setState("denied"); return; }
    if (!engineRef.current) {
      engineRef.current = new mod.JarviEngine({
        onState: (s) => { stateRef.current = s; setState(s); },
        onSubtitle: setSubtitle,
        onUserText: () => {},
        onMouth: (v) => { mouthRef.current = v; },
        onInputLevel: (v) => { inputRef.current = v; },
      });
    }
    const st = engineRef.current.getState();
    if (st === "off" || st === "sleeping" || st === "denied") void engineRef.current.start();
  };

  const handleStop = () => engineRef.current?.stop();

  const running = state !== "off" && state !== "denied" && state !== "sleeping";
  const errorMsg = state === "denied" ? "Нужен микрофон" : state === "sleeping" ? "Джарви спит — нажмите ещё раз" : "";

  return (
    <>
      {/* СЛОЙ РЕНДЕРА: выше клик-зоны, чтобы над головой влез значок; кликов НЕ перехватывает */}
      <div className="pointer-events-none fixed bottom-0 right-0 z-30 hidden h-[56vh] w-[34vw] max-w-[460px] lg:block">
        {mount3d && <JarviHostCanvas stateRef={stateRef} mouthRef={mouthRef} inputRef={inputRef} />}
      </div>
      {/* КЛИК-ЗОНА: нижняя часть (тело аватара), запускает разговор */}
      <div
        id="jarvi-host-hit"
        onPointerDown={handlePointerDown}
        className="fixed bottom-0 right-0 z-30 hidden h-[38vh] w-[34vw] max-w-[460px] cursor-pointer lg:block"
        aria-label="Джарви — нажми, чтобы поговорить"
      />

      {/* оверлей: субтитр реплики + «Завершить» + текст ошибок (только десктоп) */}
      {(running || errorMsg) && (
        <div className="fixed bottom-3 right-4 z-40 hidden max-w-[380px] flex-col items-end gap-2 text-right lg:flex">
          {running && subtitle && (
            <p
              className="leading-snug"
              style={{ fontFamily: "var(--font-cormorant), serif", fontStyle: "italic", fontSize: 14, color: "rgba(245,241,232,0.85)" }}
            >
              {subtitle}
            </p>
          )}
          {errorMsg && (
            <p style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(201,150,120,0.85)" }}>
              {errorMsg}
            </p>
          )}
          {running && (
            <button
              onClick={handleStop}
              className="pointer-events-auto cursor-pointer transition-all active:scale-[0.96]"
              style={{
                fontSize: 9.5, letterSpacing: "0.25em", textTransform: "uppercase",
                padding: "5px 14px", borderRadius: 999,
                color: "rgba(245,241,232,0.6)", background: "rgba(20,16,11,0.55)",
                border: "1px solid rgba(201,169,97,0.3)",
              }}
            >
              Завершить
            </button>
          )}
        </div>
      )}
    </>
  );
}
