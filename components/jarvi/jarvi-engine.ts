/**
 * Джарви — разговорный движок (без React): слух → мозг → голос → перебивание.
 *
 * Конструкция по docs/TZ_JARVI.md §4-5:
 *  - STT: Web Speech API, continuous, СУПЕРВИЗОР с авторестартом (сессии мрут сами).
 *  - Endpointing СВОЙ: interim не меняется ~320мс → фраза готова (ждать isFinal = +500-900мс).
 *  - Мозг: SSE-стрим прокси (ключ на сервере), delta.reasoning игнорируется.
 *  - Голос: speechSynthesis ПО ПРЕДЛОЖЕНИЯМ (история = только произнесённое;
 *    обходит баг ~15с и не-стреляющий onboundary сетевых голосов).
 *  - Барж-ин: <50мс cancel + abort. Защита от самоперебивания — ТЕКСТОВЫЙ фильтр
 *    (AEC не вычитает SAPI-голоса): услышанное сравнивается со своей текущей репликой.
 */

export type JarviState = "off" | "idle" | "listening" | "thinking" | "speaking" | "sleeping" | "denied";

export interface JarviEvents {
  onState: (s: JarviState) => void;
  onSubtitle: (text: string) => void;      // что Джарви говорит (последняя реплика)
  onUserText: (text: string) => void;      // что слышим от гостя (interim)
  onLatency?: (ms: number) => void;        // «замолчал → первый звук» (замер ≤1с)
}

const ENDPOINT_MS = 320;        // тишина interim → фраза готова
const ENDPOINT_TICK = 90;
const RESTART_DELAY_MS = 180;   // пауза перед рестартом распознавалки
const BARGE_MIN_WORDS = 2;      // короче — не считаем перебиванием
const ECHO_OVERLAP = 0.6;       // доля слов из своей реплики → это эхо

type Msg = { role: "user" | "assistant"; content: string };

// ── минимальные типы Web Speech (в TS их нет) ──
type SR = {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean; length: number }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start(): void; stop(): void; abort(): void;
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9\s]/gi, " ").replace(/\s+/g, " ").trim();
}

/** Чистка текста LLM под озвучку: markdown/спецсимволы вон. */
function cleanForSpeech(s: string): string {
  return s
    .replace(/[*_#`>|]/g, " ")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/[‑‒–—]/g, "-") // ne-breaking дефисы ломают некоторые голоса
    .replace(/\s+/g, " ")
    .trim();
}

/** Режем накопленный стрим на завершённые предложения. */
function splitSentences(buf: string): { ready: string[]; rest: string } {
  const ready: string[] = [];
  let rest = buf;
  for (;;) {
    const m = rest.match(/^[\s\S]*?[.!?…]+[\s"»)\]]*\s/);
    if (!m) break;
    const sent = m[0].trim();
    if (sent) ready.push(sent);
    rest = rest.slice(m[0].length);
  }
  return { ready, rest };
}

export class JarviEngine {
  private ev: JarviEvents;
  private state: JarviState = "off";
  private chatBase = "";

  private rec: SR | null = null;
  private recActive = false;          // желаемое состояние распознавалки
  private recRunning = false;         // фактическое
  private interim = "";
  private interimChangedAt = 0;
  private endpointTimer: ReturnType<typeof setInterval> | null = null;
  private warmTimer: ReturnType<typeof setInterval> | null = null; // держим TLS-коннект тёплым

  private history: Msg[] = [];
  private llmAbort: AbortController | null = null;

  private voice: SpeechSynthesisVoice | null = null;
  private ttsQueue: string[] = [];
  private speakingNow = "";           // текст текущего предложения в динамиках
  private replyAllText = "";          // вся текущая реплика (для эхо-фильтра)
  private spokenSentences: string[] = [];
  private streamDone = false;
  private cutMidSentence = false;

  private turnT0 = 0;                 // момент «гость замолчал» (commit)
  private firstAudioReported = false;

  constructor(ev: JarviEvents) { this.ev = ev; }

  getState() { return this.state; }

  private setState(s: JarviState) {
    if (this.state === s) return;
    this.state = s;
    this.ev.onState(s);
  }

  static supported(): boolean {
    if (typeof window === "undefined") return false;
    const w = window as unknown as Record<string, unknown>;
    return !!(w.webkitSpeechRecognition || w.SpeechRecognition) && "speechSynthesis" in window;
  }

  /** Запуск ИЗ КЛИКА (user activation: мик + разблокировка TTS). */
  async start(): Promise<void> {
    if (this.state !== "off" && this.state !== "sleeping" && this.state !== "denied") return;

    // конфиг → база прокси
    try {
      const cfg = await fetch("/jarvi-config.json", { cache: "no-store" }).then((r) => r.json());
      this.chatBase = String(cfg.chatBase || "").replace(/\/$/, "");
    } catch { this.setState("sleeping"); return; }

    // health = и проверка мозга, и прогрев TLS-соединения
    try {
      const h = await fetch(this.chatBase + "/health", { signal: AbortSignal.timeout(6000) });
      if (!h.ok) throw new Error("health " + h.status);
    } catch { this.setState("sleeping"); return; }

    // разблокировка speechSynthesis внутри жеста
    try { speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance("")); } catch {}
    this.pickVoice();
    if (speechSynthesis.onvoiceschanged === null) speechSynthesis.onvoiceschanged = () => this.pickVoice();

    // микрофон: явный запрос с echoCancellation (сам поток не используем —
    // распознавалке он не передаётся, но разрешение получаем в жесте)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      stream.getTracks().forEach((t) => t.stop());
    } catch { this.setState("denied"); return; }

    this.recActive = true;
    this.startRecognition();
    this.endpointTimer = setInterval(() => this.checkEndpoint(), ENDPOINT_TICK);
    // тёплый пинг: без него туннель/TLS остывает и первый ответ дорожает на сотни мс
    this.warmTimer = setInterval(() => {
      if (this.state === "listening" || this.state === "idle")
        fetch(this.chatBase + "/health", { cache: "no-store" }).catch(() => {});
    }, 25_000);
    this.setState("listening");
  }

  stop(): void {
    this.recActive = false;
    if (this.endpointTimer) { clearInterval(this.endpointTimer); this.endpointTimer = null; }
    if (this.warmTimer) { clearInterval(this.warmTimer); this.warmTimer = null; }
    try { this.rec?.abort(); } catch {}
    this.rec = null;
    this.stopSpeech();
    this.llmAbort?.abort();
    this.history = [];
    this.setState("off");
  }

  // ── СЛУХ: супервизор ──────────────────────────────────────────────
  private startRecognition() {
    if (!this.recActive || this.recRunning) return;
    const w = window as unknown as Record<string, new () => SR>;
    const Ctor = (w.webkitSpeechRecognition || w.SpeechRecognition) as new () => SR;
    const rec = new Ctor();
    this.rec = rec;
    rec.lang = "ru-RU";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      text = text.trim();
      if (!text || text === this.interim) return;

      if (this.state === "speaking" || this.state === "thinking") {
        // голос поверх речи Джарви: эхо или перебивание?
        if (this.isOwnEcho(text)) { this.interim = text; return; }
        const words = normalize(text).split(" ").filter(Boolean);
        if (words.length >= BARGE_MIN_WORDS) {
          this.bargeIn();
          this.interim = text;
          this.interimChangedAt = performance.now();
          this.ev.onUserText(text);
        }
        return;
      }
      this.interim = text;
      this.interimChangedAt = performance.now();
      this.ev.onUserText(text);
    };

    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        this.recActive = false;
        this.setState("denied");
      }
      // no-speech / network / aborted → onend сам перезапустит
    };

    rec.onend = () => {
      this.recRunning = false;
      if (!this.recActive) return;
      setTimeout(() => {
        if (!this.recActive || this.recRunning) return;
        try { this.startRecognition(); } catch { setTimeout(() => this.startRecognition(), 600); }
      }, RESTART_DELAY_MS);
    };

    try { rec.start(); this.recRunning = true; } catch { /* InvalidState → onend цикл подберёт */ }
  }

  /** Перезапуск слуха с чистым транскриптом (после commit'а фразы). */
  private resetRecognition() {
    this.interim = "";
    try { this.rec?.abort(); } catch {}
    // onend → startRecognition() через RESTART_DELAY_MS; глухое окно ~200мс — приемлемо (мозг думает)
  }

  // ── ENDPOINTING: не ждём isFinal ──────────────────────────────────
  private checkEndpoint() {
    if (this.state !== "listening") return;
    if (!this.interim) return;
    if (performance.now() - this.interimChangedAt < ENDPOINT_MS) return;
    const text = this.interim.trim();
    this.interim = "";
    if (normalize(text).length < 2) return;
    this.commitUserUtterance(text);
  }

  private commitUserUtterance(text: string) {
    this.turnT0 = performance.now();
    this.firstAudioReported = false;
    this.history.push({ role: "user", content: text });
    this.resetRecognition();
    this.askBrain();
  }

  // ── МОЗГ: SSE-стрим ───────────────────────────────────────────────
  private async askBrain() {
    this.setState("thinking");
    this.replyAllText = "";
    this.spokenSentences = [];
    this.ttsQueue = [];
    this.streamDone = false;
    this.cutMidSentence = false;
    this.ev.onSubtitle("");

    const ac = new AbortController();
    this.llmAbort = ac;
    let resp: Response;
    try {
      resp = await fetch(this.chatBase + "/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: this.history.slice(-16) }),
        signal: ac.signal,
      });
      if (!resp.ok || !resp.body) throw new Error("chat " + resp.status);
    } catch {
      if (ac.signal.aborted) return; // барж-ин — норма
      this.setState("sleeping");
      return;
    }

    const reader = resp.body.getReader();
    const dec = new TextDecoder();
    let sseBuf = "";
    let textBuf = "";
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        sseBuf += dec.decode(value, { stream: true });
        let nl;
        while ((nl = sseBuf.indexOf("\n")) >= 0) {
          const line = sseBuf.slice(0, nl).trim();
          sseBuf = sseBuf.slice(nl + 1);
          if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
          let j: { choices?: { delta?: { content?: string } }[] };
          try { j = JSON.parse(line.slice(6)); } catch { continue; }
          const delta = j.choices?.[0]?.delta?.content; // reasoning игнорируем сознательно
          if (!delta) continue;
          textBuf += delta;
          const { ready, rest } = splitSentences(textBuf);
          textBuf = rest;
          for (const s of ready) this.enqueueSentence(s);
        }
      }
    } catch { /* abort при барж-ине */ }
    if (ac.signal.aborted) return;
    if (textBuf.trim()) this.enqueueSentence(textBuf.trim());
    this.streamDone = true;
    this.maybeFinishTurn();
  }

  // ── ГОЛОС: очередь по предложениям ────────────────────────────────
  private pickVoice() {
    const all = speechSynthesis.getVoices();
    if (!all.length) return;
    const ru = all.filter((v) => v.lang?.toLowerCase().startsWith("ru"));
    // приоритет: Google (сетевой, живее) → Microsoft Dmitry/Pavel → любой ru
    this.voice =
      ru.find((v) => /google/i.test(v.name)) ||
      ru.find((v) => /dmitry|дмитрий|pavel|павел/i.test(v.name)) ||
      ru[0] || null;
  }

  private enqueueSentence(raw: string) {
    const s = cleanForSpeech(raw);
    if (!s) return;
    this.ttsQueue.push(s);
    this.replyAllText += " " + s;
    if (this.state === "thinking" || (this.state === "speaking" && !speechSynthesis.speaking)) this.speakNext();
  }

  private speakNext() {
    const s = this.ttsQueue.shift();
    if (!s) { this.maybeFinishTurn(); return; }
    this.setState("speaking");
    const u = new SpeechSynthesisUtterance(s);
    if (this.voice) u.voice = this.voice;
    u.lang = "ru-RU";
    u.rate = 0.97;   // чуть ниже среднего — бархат дворецкого
    u.pitch = 0.85;
    u.onstart = () => {
      this.speakingNow = s;
      if (!this.firstAudioReported && this.turnT0) {
        this.firstAudioReported = true;
        this.ev.onLatency?.(Math.round(performance.now() - this.turnT0));
      }
      this.ev.onSubtitle(this.spokenSentences.concat([s]).join(" "));
    };
    u.onend = () => {
      this.spokenSentences.push(s);
      this.speakingNow = "";
      this.speakNext();
    };
    u.onerror = () => { this.speakingNow = ""; this.speakNext(); };
    speechSynthesis.speak(u);
  }

  private maybeFinishTurn() {
    if (!this.streamDone || this.ttsQueue.length || speechSynthesis.speaking) return;
    this.finalizeAssistantHistory(false);
    this.setState("listening");
  }

  private lastCutSentence = "";

  private stopSpeech() {
    this.ttsQueue = [];
    this.lastCutSentence = this.speakingNow; // что оборвали на полуслове
    this.cutMidSentence = !!this.speakingNow;
    try { speechSynthesis.cancel(); } catch {}
    this.speakingNow = "";
  }

  /** В историю — ТОЛЬКО произнесённое (§5.2). */
  private finalizeAssistantHistory(interrupted: boolean) {
    let said = this.spokenSentences.join(" ");
    if (interrupted && this.cutMidSentence && this.lastCutSentence) said += " " + this.lastCutSentence;
    said = said.trim();
    if (said) {
      this.history.push({ role: "assistant", content: interrupted ? said + "… [меня перебили]" : said });
    } else if (interrupted) {
      this.history.push({ role: "assistant", content: "[не успел ответить — перебили]" });
    }
    this.spokenSentences = [];
    this.replyAllText = "";
  }

  // ── ПЕРЕБИВАНИЕ ───────────────────────────────────────────────────
  private isOwnEcho(heard: string): boolean {
    const own = normalize(this.replyAllText);
    if (!own) return false;
    const h = normalize(heard);
    if (!h) return true;
    if (own.includes(h)) return true;
    const ownSet = new Set(own.split(" "));
    const words = h.split(" ").filter(Boolean);
    const hit = words.filter((w) => ownSet.has(w)).length;
    return hit / words.length >= ECHO_OVERLAP;
  }

  private bargeIn() {
    this.llmAbort?.abort();
    this.stopSpeech();
    this.finalizeAssistantHistory(true);
    this.setState("listening");
  }
}
