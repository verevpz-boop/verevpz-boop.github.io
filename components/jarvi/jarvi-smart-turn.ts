// ── Smart Turn v3 — семантический детектор конца реплики (украдено у Pipecat) ──
// Определяет по ЗВУКУ (просодия/интонация), договорил ли гость, а не по фикс-паузе.
// Вход: Float32 PCM @16кГц (аудио текущей реплики). Выход: вероятность «договорил» 0..1, порог 0.5.
// Рецепт 1:1 с pipecat-ai/smart-turn inference.py: последние 8с → zero-mean-unit-var →
// Whisper log-mel [80,800] → ONNX (smart-turn-v3.2, int8). Порог/трактовка выхода — как в их inference.py.
// ✅ СВЕРЕНО в Node против Python-эталона (transformers.WhisperFeatureExtractor + onnxruntime):
//    max mel diff 2.8e-6, выход ONNX совпал до 0.0. См. docs/COMPARE_JARVI_VS_PIPECAT_2026-07-08.md.

const N_FFT = 400, HOP = 160, N_MEL = 80, N_FREQ = 201, SR = 16000, N_SAMPLES = 8 * SR, N_FRAMES = 800;
const MODEL_URL = "/models/smart-turn-v3.2-cpu.onnx";
const ORT_WASM = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0/dist/";

// slaney mel (как librosa/HF)
const hzToMel = (f: number) => f < 1000 ? 3 * f / 200 : 15 + Math.log(f / 1000) * (27 / Math.log(6.4));
const melToHz = (m: number) => m < 15 ? 200 * m / 3 : 1000 * Math.exp((m - 15) * Math.log(6.4) / 27);

// ── таблицы (константны, строим один раз при загрузке модуля) ──
const FB: Float64Array[] = (() => {
  const melMin = hzToMel(0), melMax = hzToMel(8000);
  const melPts = Array.from({ length: N_MEL + 2 }, (_, i) => melMin + (melMax - melMin) * i / (N_MEL + 1));
  const ff = melPts.map(melToHz);
  const fftFreqs = Array.from({ length: N_FREQ }, (_, i) => 8000 * i / (N_FREQ - 1));
  const fdiff = ff.slice(1).map((v, i) => v - ff[i]);
  const fb = Array.from({ length: N_MEL }, () => new Float64Array(N_FREQ));
  for (let k = 0; k < N_FREQ; k++) for (let m = 0; m < N_MEL; m++) {
    const down = -(ff[m] - fftFreqs[k]) / fdiff[m];
    const up = (ff[m + 2] - fftFreqs[k]) / fdiff[m + 1];
    fb[m][k] = Math.max(0, Math.min(down, up));
  }
  for (let m = 0; m < N_MEL; m++) {
    const enorm = 2.0 / (ff[m + 2] - ff[m]);
    for (let k = 0; k < N_FREQ; k++) fb[m][k] *= enorm;
  }
  return fb;
})();
const HANN = Float64Array.from({ length: N_FFT }, (_, n) => 0.5 - 0.5 * Math.cos(2 * Math.PI * n / N_FFT));
const COS: Float64Array[] = [], SIN: Float64Array[] = [];
for (let k = 0; k < N_FREQ; k++) {
  COS[k] = new Float64Array(N_FFT); SIN[k] = new Float64Array(N_FFT);
  for (let n = 0; n < N_FFT; n++) { const a = 2 * Math.PI * k * n / N_FFT; COS[k][n] = Math.cos(a); SIN[k][n] = Math.sin(a); }
}

function truncPadNorm(audio: Float32Array): Float64Array {
  const full = new Float64Array(N_SAMPLES);
  if (audio.length >= N_SAMPLES) full.set(audio.subarray(audio.length - N_SAMPLES));
  else full.set(audio, N_SAMPLES - audio.length);       // пад нулями в НАЧАЛО
  let mean = 0; for (let i = 0; i < N_SAMPLES; i++) mean += full[i]; mean /= N_SAMPLES;
  let v = 0; for (let i = 0; i < N_SAMPLES; i++) { const d = full[i] - mean; v += d * d; } v /= N_SAMPLES;
  const inv = 1 / Math.sqrt(v + 1e-7);
  for (let i = 0; i < N_SAMPLES; i++) full[i] = (full[i] - mean) * inv;
  return full;
}

function logMel(full: Float64Array): Float32Array {
  const pad = N_FFT / 2;
  const padded = new Float64Array(N_SAMPLES + N_FFT);
  for (let i = 0; i < pad; i++) padded[i] = full[pad - i];                        // reflect слева
  padded.set(full, pad);
  for (let i = 0; i < pad; i++) padded[pad + N_SAMPLES + i] = full[N_SAMPLES - 2 - i]; // reflect справа
  const out = new Float32Array(N_MEL * N_FRAMES);   // row-major [mel, frame]
  const frame = new Float64Array(N_FFT);
  let gMax = -Infinity;
  for (let t = 0; t < N_FRAMES; t++) {
    const off = t * HOP;
    for (let n = 0; n < N_FFT; n++) frame[n] = padded[off + n] * HANN[n];
    // power spectrum (бины 0..200)
    const power = new Float64Array(N_FREQ);
    for (let k = 0; k < N_FREQ; k++) {
      let re = 0, im = 0; const ck = COS[k], sk = SIN[k];
      for (let n = 0; n < N_FFT; n++) { const f = frame[n]; re += f * ck[n]; im -= f * sk[n]; }
      power[k] = re * re + im * im;
    }
    for (let m = 0; m < N_MEL; m++) {
      let e = 0; const fm = FB[m];
      for (let k = 0; k < N_FREQ; k++) e += fm[k] * power[k];
      const l = Math.log10(Math.max(e, 1e-10));
      out[m * N_FRAMES + t] = l;
      if (l > gMax) gMax = l;
    }
  }
  const floor = gMax - 8.0;
  for (let i = 0; i < out.length; i++) out[i] = (Math.max(out[i], floor) + 4.0) / 4.0;
  return out;
}

type OrtModule = typeof import("onnxruntime-web");

export class SmartTurn {
  private ort: OrtModule | null = null;
  private session: import("onnxruntime-web").InferenceSession | null = null;
  ready = false;
  private failed = false;

  /** Ленивая инициализация: тянет onnxruntime-web + ONNX (8.7МБ, кэшируется браузером). Идемпотентна. */
  async init(): Promise<boolean> {
    if (this.ready) return true;
    if (this.failed) return false;
    try {
      const ort = await import("onnxruntime-web");
      ort.env.wasm.wasmPaths = ORT_WASM;
      this.ort = ort;
      this.session = await ort.InferenceSession.create(MODEL_URL, {
        executionProviders: ["wasm"],
        graphOptimizationLevel: "all",
      });
      this.ready = true;
      return true;
    } catch (e) {
      this.failed = true;
      console.warn("[jarvi] SmartTurn init FAIL (фоллбэк на фикс-паузу):", e);
      return false;
    }
  }

  /** Вероятность «гость договорил» (0..1). Кидает при сбое — вызывающий трактует как «договорил». */
  async predict(audio16k: Float32Array): Promise<number> {
    if (!this.ready || !this.session || !this.ort) throw new Error("smart-turn not ready");
    const feats = logMel(truncPadNorm(audio16k));
    const tensor = new this.ort.Tensor("float32", feats, [1, N_MEL, N_FRAMES]);
    const res = await this.session.run({ input_features: tensor });
    const out = res[Object.keys(res)[0]];              // единственный выход ("logits")
    return Number((out.data as Float32Array)[0]);       // как в inference.py: трактуем как вероятность
  }
}
