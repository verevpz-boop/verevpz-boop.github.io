/**
 * Джарви — разговорный движок (без React): слух → мозг → голос → перебивание.
 *
 * Конструкция по docs/TZ_JARVI.md §4-5 и docs/JARVI_BUILD_ROADMAP.md:
 *  - СЛУХ: VAD в браузере (Silero, @ricky0123/vad-web) ловит реплику гостя,
 *    кусок аудио уходит на Whisper (Cloudflare Workers AI) → текст. Web Speech
 *    ВЫКИНУТ (нет на iPhone/Firefox + облако Google недоступно под VPN). Работает
 *    у любого зрителя с телефона: ПК и туннели не участвуют.
 *  - Перебивание: VAD onSpeechStart срабатывает локально и МГНОВЕННО → cancel+abort.
 *    Защита от самоперебивания — эхоподавление Chrome (живой голос играет через
 *    WebAudio → AEC вычитает его из микрофона) + ТЕКСТОВЫЙ бэкап-фильтр.
 *  - Мозг: SSE-стрим прокси (ключ на сервере), delta.reasoning игнорируется.
 *  - Голос: живой нейро-TTS (/tts) через AudioContext ИЛИ браузерный фоллбэк,
 *    по предложениям (история = только произнесённое).
 */

export type JarviState = "off" | "idle" | "listening" | "thinking" | "speaking" | "sleeping" | "denied";

export interface JarviEvents {
  onState: (s: JarviState) => void;
  onSubtitle: (text: string) => void;      // что Джарви говорит (последняя реплика)
  onUserText: (text: string) => void;      // что слышим от гостя (распознанная реплика)
  onLatency?: (ms: number) => void;        // «замолчал → первый звук» (замер ≤1с)
  onMouth?: (open: number) => void;        // 0..1 открытие рта (живой липсинк, этаж Б)
  onInputLevel?: (level: number) => void;  // 0..1 громкость МИКА гостя (значок «слушаю»)
}

type VoiceMode = "browser" | "live";

// ── СЛУХ (VAD): пути к ассетам модели на CDN (под версии в package.json) ──
const VAD_VER = "0.0.30";
const ORT_VER = "1.26.0";
const VAD_ASSETS = `https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@${VAD_VER}/dist/`;
const ORT_WASM = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VER}/dist/`;

const ECHO_OVERLAP = 0.6;       // доля слов из своей реплики → это эхо
const ECHO_TAIL_MS = 1800;      // после речи Джарви ещё столько держим эхо-щит (звук из колонок доходит с задержкой)

type Msg = { role: "user" | "assistant"; content: string };

// минимальный тип инстанса VAD (типы либы подтягиваются динамическим импортом)
type VadInstance = { start: () => void; pause: () => void; destroy?: () => void };

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

/** Словарь ручных ударений для Silero (+ перед ударной гласной). Модель сама
 *  расставляет ударения и на именах/фамилиях ошибается — правим точечно.
 *  Применяется ТОЛЬКО к тексту для Silero (не к субтитрам/браузерному голосу). */
const ACCENT_FIXES: [RegExp, string][] = [
  [/Зверев/gi, "Зв+ерев"],            // фамилия Pavel'а: ударение на первое «е» (Зв+ерев/Зв+ерева/…)
  [/verevpz/gi, "вер+ев пэ зэ"],      // телеграм-ник: «верЕв пэ зэ» — через Е (не Ё), ударение на последнее «е»
  [/вер[её]впз/gi, "вер+ев пэ зэ"],   // тот же ник, если мозг отдал кириллицей (в т.ч. с Ё)
];
function accentRu(s: string): string {
  let out = s;
  for (const [re, rep] of ACCENT_FIXES) out = out.replace(re, rep);
  return out;
}

/** Справка о студии — досылается мозгу как assistant-контекст (Worker фильтрует
 *  клиентский system, а assistant пропускает). Только в запрос, НЕ в историю/субтитры.
 *  Так знания обновляются без передеплоя Worker'а и уезжают на прод с сайтом. */
const STUDIO_CONTEXT =
  "(Контекст о студии — учитывай в ответах, но НЕ зачитывай списком и не цитируй дословно. " +
  "Pavel Zverev — AI-креатор. Делает: AI-видео для кино, фэшн, рекламы и гейминга; " +
  "авторскую анимацию и мультфильмы — серия «Шифу Учит» про кунг-фу и дракона (школа боевых искусств); " +
  "Telegram- и n8n-ботов, автоматизацию; 3D-сайты уровня Awwwards, как этот; " +
  "говорящих AI-аватаров; настройку VPN и векторной памяти. " +
  "Разделы сайта: Кино, Фэшн, Гейминг, Тех, Анимация, AI-боты, TikTok, Студия.)";

/** Режем накопленный стрим на завершённые предложения.
 *  allowSoftFirst — если ещё НИЧЕГО не произнесено в этом ходу и целого предложения
 *  пока нет, разрешаем ранний флаш ПЕРВОЙ клаузы (по запятой/тире/двоеточию), но только
 *  если она достаточно длинная (SOFT_MIN). Так первый звук выходит раньше, а коротыши
 *  («Да,», «Конечно,») не рубятся — один шов на ответ, интонация почти не страдает. */
const SOFT_MIN_CHARS = 32;
function splitSentences(buf: string, allowSoftFirst = false): { ready: string[]; rest: string } {
  const ready: string[] = [];
  let rest = buf;
  for (;;) {
    const m = rest.match(/^[\s\S]*?[.!?…]+[\s"»)\]]*\s/);
    if (m) {
      const sent = m[0].trim();
      if (sent) ready.push(sent);
      rest = rest.slice(m[0].length);
      continue;
    }
    // целого предложения нет — пробуем ранний флаш первой длинной клаузы
    if (allowSoftFirst && ready.length === 0) {
      const sm = rest.match(new RegExp(`^[\\s\\S]{${SOFT_MIN_CHARS},}?[,;:—–][\\s"»)\\]]*\\s`));
      if (sm) {
        const clause = sm[0].trim();
        if (clause) { ready.push(clause); rest = rest.slice(sm[0].length); }
      }
    }
    break;
  }
  return { ready, rest };
}

/** Float32 @16кГц (от VAD) → WAV PCM16 → base64 (вход Whisper). */
function floatToWavBase64(samples: Float32Array, sampleRate = 16000): string {
  const len = samples.length;
  const buf = new ArrayBuffer(44 + len * 2);
  const dv = new DataView(buf);
  const wstr = (off: number, s: string) => { for (let i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i)); };
  wstr(0, "RIFF"); dv.setUint32(4, 36 + len * 2, true); wstr(8, "WAVE");
  wstr(12, "fmt "); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, sampleRate, true); dv.setUint32(28, sampleRate * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  wstr(36, "data"); dv.setUint32(40, len * 2, true);
  let off = 44;
  for (let i = 0; i < len; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    dv.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  // base64 без раздувания стека: по кускам
  const bytes = new Uint8Array(buf);
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
  }
  return btoa(bin);
}

/** Float32 (от VAD @16к) → PCM16 (для стриминга в Cartesia Ink). */
function floatToPcm16(f: Float32Array): Int16Array {
  const out = new Int16Array(f.length);
  for (let i = 0; i < f.length; i++) {
    const s = Math.max(-1, Math.min(1, f[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

// ── СЛУХ-СТРИМИНГ (Cartesia Ink) ──
const INK_PRE_FRAMES = 6;        // ~32мс×6 ≈ 190мс пред-речи в кольце (чтоб не срезать первый слог)
const INK_FINALIZE_TIMEOUT = 900; // не пришёл финал за столько после "finalize" → фоллбэк на Whisper-batch

export class JarviEngine {
  private ev: JarviEvents;
  private state: JarviState = "off";
  private chatBase = "";
  private sttBase = "";

  private vad: VadInstance | null = null;
  private hearWanted = false;          // желаемое состояние слуха
  private sttInFlight = false;         // транскрипция уже летит (не плодим параллель)
  private micStream: MediaStream | null = null;  // постоянный эхоочищенный поток

  // конвейер озвучки: "sentence" (по предложениям, дефолт) | "ws" (мозг→Cartesia WS, input-streaming)
  private pipeline: "sentence" | "ws" = "sentence";

  // ── стриминг-STT (Cartesia Ink): слух пока гость говорит ──
  private sttMode: "ink" | "whisper" = "whisper"; // из config; default ink, фоллбэк всегда Whisper-batch
  private inkWs: WebSocket | null = null;          // WS текущей реплики (мост к Cartesia Ink)
  private inkStreaming = false;        // сейчас стримим фреймы текущей реплики
  private inkOpen = false;             // WS открыт (можно слать)
  private inkPending: Int16Array[] = [];   // фреймы до открытия WS (флашим на open)
  private inkPreRing: Int16Array[] = [];   // кольцо пред-речевых фреймов
  private inkFinals: string[] = [];        // накопленные is_final сегменты реплики
  private inkResolve: ((t: string) => void) | null = null;  // резолвер finalize
  private inkTimer: ReturnType<typeof setTimeout> | null = null;
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

  // ── живой голос (этаж Б): /tts → AudioContext + анализатор ──
  private voiceMode: VoiceMode = "browser";
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private liveJobs: string[] = [];     // очередь текстов предложений на озвучку (стрим)
  private liveSource: AudioBufferSourceNode | null = null;
  private liveResolve: (() => void) | null = null;  // резолвер текущего playBuffer (разблокировать при барж-ине)
  private livePlaying = false;
  private liveStreamSources: AudioBufferSourceNode[] = []; // источники потоковых PCM-чанков (для барж-ина)
  private streamCancelled = false;                          // флаг остановки потока (барж-ин/новый ход)
  private mouthTimer: ReturnType<typeof setInterval> | null = null;

  // ── метр громкости МИКА гостя (отвод от echoCancellation-потока) → значок «слушаю» ──
  private inputCtx: AudioContext | null = null;
  private inputAnalyser: AnalyserNode | null = null;
  private inputTimer: ReturnType<typeof setInterval> | null = null;
  private inputCtxOwn = false;        // создали свой контекст (закрыть в stop) или переиспользуем audioCtx
  private inputLevel = 0;

  private turnT0 = 0;                 // момент «гость замолчал» (commit)
  private firstAudioReported = false;

  constructor(ev: JarviEvents) { this.ev = ev; }

  getState() { return this.state; }

  private setState(s: JarviState) {
    if (this.state === s) return;
    this.trace("state " + this.state + "→" + s);
    this.state = s;
    this.ev.onState(s);
  }

  /** Диагностическая трасса в window.__jtrace (кольцо на 300). Снять при проде. */
  private trace(msg: string) {
    if (typeof window === "undefined") return;
    const w = window as unknown as { __jtrace?: string[] };
    const arr = (w.__jtrace = w.__jtrace || []);
    arr.push(Math.round(performance.now()) + "  " + msg);
    if (arr.length > 300) arr.shift();
  }

  static supported(): boolean {
    if (typeof window === "undefined") return false;
    const hasMic = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    const hasAudio = !!(window.AudioContext || (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext);
    return hasMic && hasAudio; // VAD+Whisper работают везде, где есть мик и WebAudio (вкл. iOS Safari)
  }

  private cfgVoice: VoiceMode = "browser";

  /** Перечитать config (URL мозга мог смениться) и проверить мозг. */
  private async resolveBrain(): Promise<boolean> {
    try {
      const cfg = await fetch("/jarvi-config.json?t=" + Date.now(), { cache: "no-store" }).then((r) => r.json());
      const base = String(cfg.chatBase || "").replace(/\/$/, "");
      if (!base) return false;
      // слух всегда на Cloudflare-Whisper; sttBase из config, иначе — тот же base
      this.sttBase = String(cfg.sttBase || base).replace(/\/$/, "");
      const h = await fetch(base + "/health", { signal: AbortSignal.timeout(6000) }).then((r) => r.json());
      if (!h.ok) return false;
      this.chatBase = base;
      // живой голос — только если config просит И сайдкар на сервере жив
      this.cfgVoice = cfg.voice === "live" && h.tts ? "live" : "browser";
      // слух: стриминг Cartesia Ink по умолчанию (флип config.stt="whisper" → старый batch-Whisper).
      // При ЛЮБОМ сбое Ink клиент сам деградирует на Whisper-batch — голый фоллбэк безопасен.
      this.sttMode = cfg.stt === "whisper" ? "whisper" : "ink";
      // конвейер озвучки: "ws" = input-streaming (мозг→Cartesia WS). По умолчанию sentence (текущий, проверенный).
      // Сбой /chat-voice → клиент сам деградирует на sentence-конвейер.
      this.pipeline = cfg.pipeline === "ws" ? "ws" : "sentence";
      return true;
    } catch { return false; }
  }

  /** Спим, но раз в 15с сами проверяем — не вернулся ли мозг. */
  private sleepTimer: ReturnType<typeof setTimeout> | null = null;
  private goSleep() {
    this.setState("sleeping");
    if (this.sleepTimer) return;
    const tick = async () => {
      this.sleepTimer = null;
      if (this.state !== "sleeping" || !this.hearWanted) return;
      if (await this.resolveBrain()) { this.setState("listening"); return; }
      this.sleepTimer = setTimeout(tick, 15_000);
    };
    this.sleepTimer = setTimeout(tick, 15_000);
  }

  /** Запуск ИЗ КЛИКА (user activation: мик + разблокировка TTS). */
  async start(): Promise<void> {
    if (this.state !== "off" && this.state !== "sleeping" && this.state !== "denied") return;

    // конфиг → база прокси + проверка мозга (и прогрев TLS)
    if (!(await this.resolveBrain())) { this.hearWanted = true; this.goSleep(); return; }

    // голосовой режим из config; AudioContext создаём ВНУТРИ жеста (иначе suspended)
    this.voiceMode = this.cfgVoice;
    if (this.voiceMode === "live") {
      try {
        const Ctor = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
        this.audioCtx = new Ctor();
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 512;
        this.analyser.connect(this.audioCtx.destination);
        await this.audioCtx.resume();
      } catch { this.voiceMode = "browser"; this.audioCtx = null; this.analyser = null; }
    }

    // разблокировка speechSynthesis внутри жеста (нужна и как фоллбэк живого режима)
    try { speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance("")); } catch {}
    this.pickVoice();
    if (typeof speechSynthesis !== "undefined" && speechSynthesis.onvoiceschanged === null)
      speechSynthesis.onvoiceschanged = () => this.pickVoice();

    // эхоочищенный микрофон: ДЕРЖИМ поток открытым, его же кормим VAD'у.
    // echoCancellation вычитает голос Джарви (он играет через WebAudio) → петля
    // «сам с собой» умирает, а живой голос гостя проходит → перебивание живёт.
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch { this.setState("denied"); return; }

    this.hearWanted = true;
    const ok = await this.startHearing();
    if (!ok) { this.setState("denied"); return; }
    this.startInputMeter();   // громкость мика гостя → пульсация значка «слушаю»

    // тёплый пинг: без него туннель/TLS остывает и первый ответ дорожает на сотни мс
    this.warmTimer = setInterval(() => {
      if (this.state === "listening" || this.state === "idle")
        fetch(this.chatBase + "/health", { cache: "no-store" }).catch(() => {});
    }, 25_000);
    this.setState("listening");
    this.greet();  // Джарви здоровается голосом ПОСЛЕ старта (не по касанию — не обрывается)
  }

  /** Стартовое приветствие голосом Джарви. */
  private async greet() {
    const text = "Здравствуйте. Я Джарви. Спрашивайте — и помните, меня можно перебивать.";
    this.turnId++;
    const myTurn = this.turnId;
    this.replyAllText = text;     // эхо-фильтр: STT не примет приветствие за речь гостя
    this.spokenSentences = [];
    this.turnT0 = 0;              // приветствие в замер латентности не входит
    this.setState("speaking");
    this.ev.onSubtitle(text);
    if (this.voiceMode === "live" && this.audioCtx) {
      this.startMouth();
      const streamed = await this.playSentenceStream(text, myTurn);
      if (!streamed && myTurn === this.turnId && this.state === "speaking") {
        const buf = await this.fetchTts(text);
        if (buf) await this.playBuffer(buf); else await this.playBrowserSentence(text);
      }
      this.stopMouth();
    } else if (myTurn === this.turnId && this.state === "speaking") {
      await this.playBrowserSentence(text);
    }
    if (myTurn === this.turnId && this.state === "speaking") {
      this.armEchoGuard(text);  // приветствие — самый частый источник само-эха
      this.replyAllText = "";
      this.setState("listening");
    }
  }

  stop(): void {
    this.hearWanted = false;
    if (this.warmTimer) { clearInterval(this.warmTimer); this.warmTimer = null; }
    if (this.sleepTimer) { clearTimeout(this.sleepTimer); this.sleepTimer = null; }
    this.echoGuardText = ""; this.echoGuardUntil = 0;
    try { this.vad?.pause(); this.vad?.destroy?.(); } catch {}
    this.vad = null;
    this.inkCloseWs(); this.inkPreRing = []; this.inkFinals = [];
    this.stopInputMeter();
    try { this.micStream?.getTracks().forEach((t) => t.stop()); } catch {}
    this.micStream = null;
    this.stopSpeech();
    this.llmAbort?.abort();
    this.history = [];
    this.setState("off");
  }

  // ── СЛУХ: VAD (Silero) → Whisper ──────────────────────────────────
  /** Поднять VAD на нашем эхоочищенном потоке. true — успех. */
  private async startHearing(): Promise<boolean> {
    try {
      const mod = await import("@ricky0123/vad-web");
      this.vad = await mod.MicVAD.new({
        model: "v5",
        baseAssetPath: VAD_ASSETS,
        onnxWASMBasePath: ORT_WASM,
        // кормим VAD НАШ echoCancellation-поток (а не дефолтный мик)
        getStream: async () => this.micStream as MediaStream,
        // не глушим наш поток при паузе — мы сами им управляем в stop()
        pauseStream: async () => {},
        positiveSpeechThreshold: 0.7,   // строже: фоновый ТВ/шум не должен будить
        negativeSpeechThreshold: 0.45,
        minSpeechMs: 400,         // короче — мусор/щелчок/фон
        redemptionMs: 300,        // столько тишины = конец фразы (короче = Джарви отвечает раньше)
        preSpeechPadMs: 300,
        onSpeechStart: () => this.onSpeechStart(),
        onSpeechEnd: (audio: Float32Array) => this.onSpeechEnd(audio),
        onVADMisfire: () => { /* слишком коротко — игнор */ },
        // каждый кадр (16к Float32) — для стриминга в Ink ВО ВРЕМЯ речи; иначе копим пред-кольцо
        onFrameProcessed: (_p: unknown, frame: Float32Array) => this.onVadFrame(frame),
      });
      this.vad.start();
      this.trace("VAD up (v5, getStream=micStream)");
      return true;
    } catch (e) {
      this.trace("VAD FAIL: " + String((e as Error)?.message || e));
      console.error("[jarvi] VAD не поднялся:", e);
      return false;
    }
  }

  /** Гость заговорил. Если Джарви в этот момент говорит/думает — это перебивание. */
  private onSpeechStart() {
    this.trace("vad:speechStart state=" + this.state);
    if (this.state === "speaking" || this.state === "thinking") {
      this.bargeIn();   // мгновенно: cancel голоса + abort мозга, уходим в listening
    }
    // начинаем стримить реплику в Ink ВО ВРЕМЯ речи (и после барж-ина — состояние уже listening).
    // в "listening" дальше просто ждём конца фразы — закоммитит onSpeechEnd.
    if (this.sttMode === "ink" && this.hearWanted) this.inkStartUtterance();
  }

  /** Гость замолчал: кусок аудио → Whisper → текст → мозг. */
  private async onSpeechEnd(audio: Float32Array) {
    this.trace("vad:speechEnd samples=" + audio.length + " state=" + this.state + " inFlight=" + this.sttInFlight);
    if (!this.hearWanted) return;
    if (this.sttInFlight) { this.trace("  ↳ DROP (sttInFlight)"); return; }
    this.sttInFlight = true;
    try {
      // 1) быстрый путь: Ink уже расшифровал во время речи → finalize отдаёт текст за ~?180мс
      let text = "";
      if (this.sttMode === "ink" && this.inkStreaming) text = await this.inkFinalizeAndGet();
      // 2) фоллбэк/основной: Whisper-batch на буфере VAD (Ink пуст/сбой/выключен)
      if (!text) { this.trace("  ↳ stt fallback→whisper"); text = await this.fetchStt(audio); }
      const echo = text ? this.isEchoNow(text) : false;
      this.trace('  ↳ stt="' + text + '" echo=' + echo + " state=" + this.state);
      if (!text) return;
      if (echo) return;                     // бэкап: вдруг AEC пропустил голос Джарви
      if (normalize(text).length < 2) return;
      this.ev.onUserText(text);
      this.commitUserUtterance(text);
    } finally {
      this.sttInFlight = false;
      this.inkCloseWs();   // подчистить WS реплики в любом исходе
    }
  }

  // ── СЛУХ-СТРИМИНГ Cartesia Ink: мост /stt-stream, фоллбэк всегда Whisper-batch ──
  private inkUrl(): string {
    return this.chatBase.replace(/^http/i, "ws") + "/stt-stream?language=ru&sample_rate=16000&model=ink-whisper";
  }

  /** Каждый кадр VAD: во время реплики — в Ink; иначе копим пред-речевое кольцо. */
  private onVadFrame(frame: Float32Array) {
    if (this.sttMode !== "ink") return;
    const pcm = floatToPcm16(frame);
    if (this.inkStreaming) {
      if (this.inkOpen && this.inkWs && this.inkWs.readyState === 1) {
        try { this.inkWs.send(pcm.buffer); } catch {}
      } else {
        this.inkPending.push(pcm);            // WS ещё открывается — флашим на onopen
      }
    } else {
      this.inkPreRing.push(pcm);
      if (this.inkPreRing.length > INK_PRE_FRAMES) this.inkPreRing.shift();
    }
  }

  /** Гость начал реплику — открываем WS к Ink и шлём пред-речь из кольца. */
  private inkStartUtterance() {
    if (this.inkStreaming) return;
    this.inkCloseWs();                          // подчистить хвост прошлой реплики
    this.inkStreaming = true;
    this.inkOpen = false;
    this.inkFinals = [];
    this.inkPending = this.inkPreRing.slice();  // пред-речь идёт первой (не срезаем первый слог)
    this.inkPreRing = [];
    let ws: WebSocket;
    try { ws = new WebSocket(this.inkUrl()); }
    catch { this.trace("ink ws ctor FAIL"); this.inkStreaming = false; this.inkPending = []; return; }
    ws.binaryType = "arraybuffer";
    this.inkWs = ws;
    ws.onopen = () => {
      if (this.inkWs !== ws) { try { ws.close(); } catch {} return; }
      this.inkOpen = true;
      for (const f of this.inkPending) { try { ws.send(f.buffer); } catch {} }
      this.inkPending = [];
    };
    ws.onmessage = (ev) => {
      let j: { type?: string; is_final?: boolean; text?: string; message?: string };
      try { j = JSON.parse(typeof ev.data === "string" ? ev.data : ""); } catch { return; }
      if (j.type === "transcript") { if (j.is_final && j.text) this.inkFinals.push(j.text); }
      else if (j.type === "flush_done" || j.type === "done") this.inkSettle();
      else if (j.type === "error") { this.trace("ink ERR " + (j.message || "")); this.inkSettle(); }
    };
    ws.onerror = () => { this.trace("ink ws error"); this.inkSettle(); };
    ws.onclose = () => { this.inkSettle(); };
    this.trace("ink utterance start");
  }

  /** Гость замолчал — просим расшифровку буфера и ждём финал (с таймаутом → ""). */
  private inkFinalizeAndGet(): Promise<string> {
    return new Promise((resolve) => {
      // WS не готов/не стримим — сразу пусто, пусть отработает Whisper-batch
      if (!this.inkWs || !this.inkStreaming || !this.inkOpen || this.inkWs.readyState !== 1) {
        this.inkCloseWs(); resolve(""); return;
      }
      this.inkResolve = resolve;
      this.inkStreaming = false;                // больше не шлём фреймы этой реплики
      try {
        for (const f of this.inkPending) { try { this.inkWs.send(f.buffer); } catch {} }
        this.inkPending = [];
        this.inkWs.send("finalize");
      } catch {}
      this.inkTimer = setTimeout(() => { this.trace("ink finalize TIMEOUT"); this.inkSettle(); }, INK_FINALIZE_TIMEOUT);
    });
  }

  /** Завершить ожидание finalize: отдать накопленный текст и закрыть WS (идемпотентно). */
  private inkSettle() {
    if (!this.inkResolve) return;               // finalize ещё не запрашивали — закроется в inkCloseWs
    const text = this.inkFinals.join(" ").replace(/\s+/g, " ").trim();
    const r = this.inkResolve; this.inkResolve = null;
    if (this.inkTimer) { clearTimeout(this.inkTimer); this.inkTimer = null; }
    this.inkCloseWs();
    this.trace('ink settle "' + text + '"');
    r(text);
  }

  /** Закрыть/сбросить WS текущей реплики (безопасно звать многократно).
   *  КРИТИЧНО: если есть висящий finalize-await — РЕЗОЛВИМ его, иначе onSpeechEnd
   *  зависнет навсегда и sttInFlight застрянет true → Джарви перестанет СЛЫШАТЬ
   *  (баг «через время замолкает»: новая реплика началась, пока прошлая финализировалась). */
  private inkCloseWs() {
    if (this.inkTimer) { clearTimeout(this.inkTimer); this.inkTimer = null; }
    if (this.inkResolve) {
      const r = this.inkResolve; this.inkResolve = null;
      r(this.inkFinals.join(" ").replace(/\s+/g, " ").trim());  // отдать что есть → onSpeechEnd добьёт фоллбэком
    }
    const ws = this.inkWs; this.inkWs = null;
    this.inkOpen = false; this.inkStreaming = false; this.inkPending = [];
    if (ws) { try { ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null; ws.close(); } catch {} }
  }

  /** Аудио-кусок → Whisper (Cloudflare Workers AI) → текст. */
  private async fetchStt(audio: Float32Array): Promise<string> {
    try {
      const b64 = floatToWavBase64(audio, 16000);
      const r = await fetch(this.sttBase + "/stt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: b64 }),
        signal: AbortSignal.timeout(8000),   // без таймаута зависший Whisper повесил бы sttInFlight навсегда
      });
      if (!r.ok) return "";
      const j = await r.json();
      return typeof j.text === "string" ? j.text.trim() : "";
    } catch { return ""; }
  }

  private commitUserUtterance(text: string) {
    this.trace('COMMIT "' + text + '"');
    this.turnT0 = performance.now();
    this.firstAudioReported = false;
    this.history.push({ role: "user", content: text });
    // input-streaming (мозг→Cartesia WS) только в живом голосе с AudioContext; иначе обычный конвейер
    if (this.pipeline === "ws" && this.voiceMode === "live" && this.audioCtx && this.analyser) this.askBrainVoiceWS();
    else this.askBrain();
  }

  // ── МОЗГ: SSE-стрим ───────────────────────────────────────────────
  private turnId = 0;

  private async askBrain() {
    this.turnId++;
    this.trace("askBrain turn=" + this.turnId + " hist=" + this.history.length);
    this.setState("thinking");
    this.replyAllText = "";
    this.spokenSentences = [];
    this.ttsQueue = [];
    this.liveJobs = [];
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
        body: JSON.stringify({ messages: [{ role: "assistant", content: STUDIO_CONTEXT }, ...this.history.slice(-16)] }),
        signal: ac.signal,
      });
      if (!resp.ok || !resp.body) throw new Error("chat " + resp.status);
    } catch (e) {
      if (ac.signal.aborted) { this.trace("askBrain aborted (barge)"); return; } // барж-ин — норма
      this.trace("askBrain FETCH FAIL: " + String((e as Error)?.message || e));
      // мозг недоступен: перечитать config и повторить раз
      if (await this.resolveBrain()) { this.askBrain(); return; }
      this.goSleep();
      return;
    }

    const reader = resp.body.getReader();
    const dec = new TextDecoder();
    let sseBuf = "";
    let textBuf = "";
    let emitted = 0;   // сколько кусков уже отдано в озвучку (для раннего флаша первой клаузы)
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
          const { ready, rest } = splitSentences(textBuf, emitted === 0);
          textBuf = rest;
          for (const s of ready) this.enqueueSentence(s);
          emitted += ready.length;
        }
      }
    } catch (e) { this.trace("stream read err: " + String((e as Error)?.message || e)); /* abort при барж-ине */ }
    if (ac.signal.aborted) { this.trace("stream aborted (barge)"); return; }
    if (textBuf.trim()) this.enqueueSentence(textBuf.trim());
    this.streamDone = true;
    this.trace("stream DONE turn=" + this.turnId + " sentences=" + this.spokenSentences.length + " queued(live=" + this.liveJobs.length + ",br=" + this.ttsQueue.length + ")");
    this.maybeFinishTurn();
  }

  // ── РАЗГОВОР+ГОЛОС ОДНИМ ПОТОКОМ: /chat-voice (мозг→Cartesia WS, input-streaming) ──
  /** Джарви озвучивает, ПОКА мозг пишет. Мультиплекс SSE: {type:text,delta} + {type:chunk,data}.
   *  Сквозная просодия (continuations). Сбой → фоллбэк на обычный конвейер askBrain. */
  private async askBrainVoiceWS() {
    this.turnId++;
    const turn = this.turnId;
    this.trace("askBrainVoiceWS turn=" + turn);
    this.setState("thinking");
    this.replyAllText = "";
    this.spokenSentences = [];
    this.streamDone = false;
    this.cutMidSentence = false;
    this.ev.onSubtitle("");

    const ac = new AbortController();
    this.llmAbort = ac;
    let resp: Response;
    try {
      resp = await fetch(this.chatBase + "/chat-voice", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "assistant", content: STUDIO_CONTEXT }, ...this.history.slice(-16)] }),
        signal: ac.signal,
      });
      if (!resp.ok || !resp.body) throw new Error("chat-voice " + resp.status);
    } catch (e) {
      if (ac.signal.aborted) { this.trace("chat-voice aborted (barge)"); return; }
      this.trace("chat-voice FAIL → fallback sentence: " + String((e as Error)?.message || e));
      this.askBrain();   // мозг/мост лёг — обычный проверенный конвейер
      return;
    }
    if (!this.audioCtx || !this.analyser) { this.askBrain(); return; }

    const ctx = this.audioCtx;
    const SR = 24000;
    let cursor = ctx.currentTime + 0.06;
    this.streamCancelled = false;
    this.startMouth();

    let fullText = "";
    const schedule = (b64: string) => {
      if (this.streamCancelled || turn !== this.turnId || !this.analyser) return;
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const n = bytes.byteLength >> 1;
      if (!n) return;
      const i16 = new Int16Array(bytes.buffer, bytes.byteOffset, n);
      const buf = ctx.createBuffer(1, n, SR);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < n; i++) ch[i] = i16[i] / 32768;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.analyser);
      src.onended = () => { const k = this.liveStreamSources.indexOf(src); if (k >= 0) this.liveStreamSources.splice(k, 1); };
      const when = Math.max(ctx.currentTime, cursor);
      this.liveStreamSources.push(src);
      try { src.start(when); } catch {}
      cursor = when + buf.duration;
      if (this.state === "thinking") this.setState("speaking");
      this.reportFirstAudio();
    };

    const reader = resp.body.getReader();
    const dec = new TextDecoder();
    let sse = "";
    try {
      for (;;) {
        if (this.streamCancelled || turn !== this.turnId) break;
        const { done, value } = await reader.read();
        if (done) break;
        sse += dec.decode(value, { stream: true });
        let nl;
        while ((nl = sse.indexOf("\n")) >= 0) {
          const line = sse.slice(0, nl).trim();
          sse = sse.slice(nl + 1);
          if (!line.startsWith("data:")) continue;
          let j: { type?: string; delta?: string; data?: string };
          try { j = JSON.parse(line.slice(5).trim()); } catch { continue; }
          if (j.type === "text" && j.delta) {
            fullText += j.delta;
            this.replyAllText = fullText;                 // эхо-щит видит весь текущий текст
            this.ev.onSubtitle(cleanForSpeech(fullText));
          } else if (j.type === "chunk" && j.data) {
            schedule(j.data);
          }
        }
      }
    } catch { /* abort при барж-ине — норма */ }

    if (this.streamCancelled || turn !== this.turnId) { this.stopMouth(); return; }

    // дождаться доигрывания запланированного аудио (или барж-ин)
    await new Promise<void>((resolve) => {
      const tick = () => {
        if (this.streamCancelled || turn !== this.turnId || !this.audioCtx) return resolve();
        const remain = cursor - this.audioCtx.currentTime;
        if (remain <= 0.03) return resolve();
        setTimeout(tick, Math.min(120, Math.max(20, remain * 1000)));
      };
      tick();
    });
    this.stopMouth();
    if (turn !== this.turnId) return;

    // история (§5.2): в WS-режиме «произнесённое» ≈ весь полученный текст
    const said = cleanForSpeech(fullText).trim();
    if (said) { this.history.push({ role: "assistant", content: said }); this.armEchoGuard(said); }
    this.spokenSentences = [];
    this.replyAllText = "";
    this.setState("listening");
  }

  // ── ГОЛОС: очередь по предложениям ────────────────────────────────
  private pickVoice() {
    if (typeof speechSynthesis === "undefined") return;
    const all = speechSynthesis.getVoices();
    if (!all.length) return;
    const ru = all.filter((v) => v.lang?.toLowerCase().startsWith("ru"));
    // Джарви — МУЖСКОЙ голос (Silero eugene). Браузерный фоллбэк тоже держим мужским,
    // иначе при сбое/барж-ине дворецкий «меняет пол» (Google ru-voice — женский).
    const female = /female|женск|svetlana|светлана|tatyana|татьяна|elena|елена|alyona|ал[её]на|milena|милена|google/i;
    this.voice =
      ru.find((v) => /dmitry|дмитрий|pavel|павел|maxim|максим|artyom|арт[её]м|male|мужск/i.test(v.name)) ||
      ru.find((v) => !female.test(v.name)) ||
      ru[0] || null;
  }

  private enqueueSentence(raw: string) {
    const s = cleanForSpeech(raw);
    if (!s) return;
    this.trace('enqueue "' + s.slice(0, 40) + '" mode=' + this.voiceMode);
    this.replyAllText += " " + s;
    if (this.voiceMode === "live" && this.audioCtx) {
      this.liveJobs.push(s);
      this.runLiveLoop(this.turnId);
    } else {
      this.ttsQueue.push(s);
      if (this.state === "thinking" || (this.state === "speaking" && !speechSynthesis.speaking)) this.speakNext();
    }
  }

  private reportFirstAudio() {
    if (!this.firstAudioReported && this.turnT0) {
      this.firstAudioReported = true;
      this.ev.onLatency?.(Math.round(performance.now() - this.turnT0));
    }
  }

  // ── БРАУЗЕРНЫЙ голос (фоллбэк) ─────────────────────────────────────
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
      this.reportFirstAudio();
      this.ev.onSubtitle(this.spokenSentences.concat([s]).join(" "));
    };
    u.onend = () => { this.spokenSentences.push(s); this.speakingNow = ""; this.speakNext(); };
    u.onerror = () => { this.speakingNow = ""; this.speakNext(); };
    speechSynthesis.speak(u);
  }

  // ── ЖИВОЙ голос: /tts WAV/MP3 → AudioContext + амплитудный липсинк ──
  private async fetchTts(text: string): Promise<AudioBuffer | null> {
    try {
      const r = await fetch(this.chatBase + "/tts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: accentRu(text) }), signal: this.llmAbort?.signal,
      });
      if (!r.ok) return null;
      const buf = await r.arrayBuffer();
      return await this.audioCtx!.decodeAudioData(buf);
    } catch { return null; }
  }

  private async runLiveLoop(turn: number) {
    if (this.livePlaying || turn !== this.turnId) return;
    this.livePlaying = true;
    this.startMouth();
    while (this.liveJobs.length && turn === this.turnId) {
      const text = this.liveJobs.shift()!;
      if (turn !== this.turnId || (this.state !== "thinking" && this.state !== "speaking")) break; // барж-ин/новый ход
      this.setState("speaking");
      this.speakingNow = text;
      this.reportFirstAudio();
      this.ev.onSubtitle(this.spokenSentences.concat([text]).join(" "));
      // СТРИМИНГ: первый звук ~90мс. Не завёлся → фоллбэк на полный буфер, затем браузер.
      const streamed = await this.playSentenceStream(text, turn);
      if (!streamed && turn === this.turnId && (this.state === "speaking" || this.state === "thinking")) {
        const buf = await this.fetchTts(text);
        if (turn === this.turnId && (this.state === "speaking" || this.state === "thinking")) {
          if (buf) await this.playBuffer(buf); else await this.playBrowserSentence(text);
        }
      }
      if (this.speakingNow) this.spokenSentences.push(text);
      this.speakingNow = "";
    }
    this.livePlaying = false;
    this.stopMouth();
    this.maybeFinishTurn();
  }

  /** Потоковое воспроизведение одного предложения через Cartesia SSE (/tts-stream).
   *  Играет PCM-чанки (моно 16бит 24кГц) по мере прихода — первый звук ~90мс.
   *  Чанки идут в this.analyser → липсинк работает; в this.liveStreamSources → барж-ин их гасит.
   *  return true — отыграл/прервали; false — поток не завёлся, нужен фоллбэк (полный буфер). */
  private async playSentenceStream(text: string, turn: number): Promise<boolean> {
    if (!this.audioCtx || !this.analyser) return false;
    let r: Response;
    try {
      r = await fetch(this.chatBase + "/tts-stream", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: accentRu(text) }), signal: this.llmAbort?.signal,
      });
    } catch { return false; }
    if (!r.ok || !r.body) return false;

    this.streamCancelled = false;
    const ctx = this.audioCtx;
    const SR = 24000;
    let cursor = ctx.currentTime + 0.05; // запас на джиттер первого чанка
    let played = false;

    const schedule = (b64: string) => {
      if (this.streamCancelled || turn !== this.turnId || !this.analyser) return;
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const n = bytes.byteLength >> 1;
      if (!n) return;
      const i16 = new Int16Array(bytes.buffer, bytes.byteOffset, n);
      const buf = ctx.createBuffer(1, n, SR);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < n; i++) ch[i] = i16[i] / 32768;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.analyser);
      src.onended = () => { const k = this.liveStreamSources.indexOf(src); if (k >= 0) this.liveStreamSources.splice(k, 1); };
      const when = Math.max(ctx.currentTime, cursor);
      this.liveStreamSources.push(src);
      try { src.start(when); } catch {}
      cursor = when + buf.duration;
      played = true;
    };

    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let sseBuf = "";
    try {
      for (;;) {
        if (this.streamCancelled || turn !== this.turnId) break;
        const { done, value } = await reader.read();
        if (done) break;
        sseBuf += dec.decode(value, { stream: true });
        let nl;
        while ((nl = sseBuf.indexOf("\n")) >= 0) {
          const line = sseBuf.slice(0, nl).trim();
          sseBuf = sseBuf.slice(nl + 1);
          if (!line.startsWith("data:")) continue;
          let j: { data?: string; done?: boolean; type?: string };
          try { j = JSON.parse(line.slice(5).trim()); } catch { continue; }
          if (typeof j.data === "string" && j.data) schedule(j.data);
          if (j.done || j.type === "done") { try { reader.cancel(); } catch {} break; }
        }
      }
    } catch { /* abort при барж-ине — норма */ }

    if (!played) return false; // ни одного чанка → пусть фоллбэк попробует

    // ждём, пока отыграют запланированные чанки (или барж-ин)
    await new Promise<void>((resolve) => {
      const tick = () => {
        if (this.streamCancelled || turn !== this.turnId || !this.audioCtx) return resolve();
        const remain = cursor - this.audioCtx.currentTime;
        if (remain <= 0.03) return resolve();
        setTimeout(tick, Math.min(120, Math.max(20, remain * 1000)));
      };
      tick();
    });
    return true;
  }

  private playBuffer(buf: AudioBuffer): Promise<void> {
    return new Promise((resolve) => {
      if (!this.audioCtx || !this.analyser) return resolve();
      const src = this.audioCtx.createBufferSource();
      src.buffer = buf;
      src.connect(this.analyser);
      this.liveSource = src;
      // ВАЖНО: один резолвер, который зовут И onended, И stopSpeech (барж-ин).
      // Без этого при перебивании промис не резолвился → runLiveLoop висел → livePlaying
      // застревал true → все следующие ходы стояли в "думает" насмерть.
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        if (this.liveResolve === done) this.liveResolve = null;
        if (this.liveSource === src) this.liveSource = null;
        resolve();
      };
      this.liveResolve = done;
      src.onended = done;
      try { src.start(); } catch { done(); }
    });
  }

  private playBrowserSentence(s: string): Promise<void> {
    return new Promise((resolve) => {
      try {
        const u = new SpeechSynthesisUtterance(s);
        if (this.voice) u.voice = this.voice;
        u.lang = "ru-RU"; u.rate = 0.97; u.pitch = 0.85;
        u.onend = () => resolve();
        u.onerror = () => resolve();
        speechSynthesis.speak(u);
      } catch { resolve(); }
    });
  }

  // амплитуда реального аудио → открытие рта (липсинк со сглаживанием)
  private mouthVal = 0;
  private startMouth() {
    if (this.mouthTimer || !this.analyser) return;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.mouthTimer = setInterval(() => {
      if (!this.analyser) return;
      this.analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
      const rms = Math.sqrt(sum / data.length);
      // нелинейность: гласные шире, тихие согласные не «жуют» рот вхолостую
      const target = Math.min(1, Math.pow(rms * 3.0, 0.8) * 1.15);
      // огибающая: открывается быстро (attack), закрывается плавно (release) → нет дёрганья
      const k = target > this.mouthVal ? 0.55 : 0.2;
      this.mouthVal += (target - this.mouthVal) * k;
      this.ev.onMouth?.(this.mouthVal);
    }, 33); // ~30 кадров/с
  }

  private stopMouth() {
    if (this.mouthTimer) { clearInterval(this.mouthTimer); this.mouthTimer = null; }
    this.mouthVal = 0;
    this.ev.onMouth?.(0);
  }

  // ── метр входа: RMS микрофона гостя ТОЛЬКО в "listening" → onInputLevel (0..1) ──
  private startInputMeter() {
    if (this.inputTimer || !this.micStream) return;
    try {
      if (this.audioCtx) { this.inputCtx = this.audioCtx; this.inputCtxOwn = false; }
      else {
        const Ctor = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
        this.inputCtx = new Ctor(); this.inputCtxOwn = true;
      }
      const src = this.inputCtx.createMediaStreamSource(this.micStream);
      this.inputAnalyser = this.inputCtx.createAnalyser();
      this.inputAnalyser.fftSize = 256;
      src.connect(this.inputAnalyser);   // к destination НЕ подключаем — без петли/эха
      const data = new Uint8Array(this.inputAnalyser.frequencyBinCount);
      this.inputTimer = setInterval(() => {
        if (!this.inputAnalyser) return;
        let target = 0;
        if (this.state === "listening") {
          this.inputAnalyser.getByteTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
          const rms = Math.sqrt(sum / data.length);
          target = Math.min(1, Math.pow(rms * 3.0, 0.8) * 1.3);
        }
        this.inputLevel += (target - this.inputLevel) * 0.35;
        this.ev.onInputLevel?.(this.inputLevel);
      }, 50);
    } catch { /* метр не критичен для разговора */ }
  }

  private stopInputMeter() {
    if (this.inputTimer) { clearInterval(this.inputTimer); this.inputTimer = null; }
    this.inputAnalyser = null;
    if (this.inputCtx && this.inputCtxOwn) { try { this.inputCtx.close(); } catch {} }
    this.inputCtx = null; this.inputCtxOwn = false;
    this.inputLevel = 0;
    this.ev.onInputLevel?.(0);
  }

  private maybeFinishTurn() {
    if (this.voiceMode === "live") {
      if (!this.streamDone || this.liveJobs.length || this.livePlaying) return;
    } else {
      if (!this.streamDone || this.ttsQueue.length || speechSynthesis.speaking) return;
    }
    this.finalizeAssistantHistory(false);
    this.setState("listening");
  }

  private lastCutSentence = "";

  private stopSpeech() {
    this.lastCutSentence = this.speakingNow; // что оборвали на полуслове
    this.cutMidSentence = !!this.speakingNow;
    this.speakingNow = "";
    // живой
    this.liveJobs = [];
    this.streamCancelled = true;                       // стоп потоковому воспроизведению
    for (const s of this.liveStreamSources) { try { s.onended = null; s.stop(); } catch {} }
    this.liveStreamSources = [];
    if (this.liveSource) { try { this.liveSource.onended = null; this.liveSource.stop(); } catch {} this.liveSource = null; }
    this.liveResolve?.(); // разблокируем зависший await playBuffer (резолвер сам себя гасит флагом settled)
    this.stopMouth();
    // браузерный
    this.ttsQueue = [];
    try { speechSynthesis.cancel(); } catch {}
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
    // эхо-щит на хвост: при барж-ине НЕ ставим (пользователь уже говорит — заглушим его же)
    if (!interrupted && said) this.armEchoGuard(said);
    this.spokenSentences = [];
    this.replyAllText = "";
  }

  // ── ПЕРЕБИВАНИЕ / ЭХО-ЩИТ ─────────────────────────────────────────
  private echoGuardText = "";   // последняя произнесённая реплика (для хвоста эха)
  private echoGuardUntil = 0;   // до этого момента хвост ещё активен

  /** Взвести эхо-щит после того, как Джарви договорил (не при барж-ине). */
  private armEchoGuard(text: string) {
    const t = (text || "").trim();
    if (!t) return;
    this.echoGuardText = t;
    this.echoGuardUntil = performance.now() + ECHO_TAIL_MS;
  }

  /** Это голос самого Джарви из колонок? Сравниваем с тем, что он говорит СЕЙЧАС
   *  (replyAllText) И с тем, что говорил только что (echoGuardText, пока активен хвост). */
  private isEchoNow(heard: string): boolean {
    const now = performance.now();
    let guard = (this.state === "speaking" || this.state === "thinking") ? this.replyAllText : "";
    if (now < this.echoGuardUntil) guard += " " + this.echoGuardText;
    const own = normalize(guard);
    if (!own.trim()) return false;
    const h = normalize(heard);
    if (!h) return true;
    if (own.includes(h)) return true;
    const ownSet = new Set(own.split(" ").filter(Boolean));
    const words = h.split(" ").filter(Boolean);
    if (!words.length) return true;
    const hit = words.filter((w) => ownSet.has(w)).length;
    return hit / words.length >= ECHO_OVERLAP;
  }

  private bargeIn() {
    this.trace("BARGE-IN (cut) at state=" + this.state);
    this.llmAbort?.abort();
    this.stopSpeech();
    this.finalizeAssistantHistory(true);
    this.setState("listening");
  }
}
