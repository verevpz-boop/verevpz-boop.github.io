import { SectionShell } from "@/components/ui/section-shell";

export const metadata = {
  title: "3D-сайты — Pavel Zverev",
  description: "Премиальные 3D-сайты и портфолио уровня Awwwards",
};

export default function Web3dPage() {
  return (
    <SectionShell
      index="B·05"
      title="3D Sites"
      accent="rgba(201,169,97,0.8)"
      tagline="Портфолио уровня Awwwards"
    >
      <div className="mx-auto max-w-3xl space-y-12 text-[#F5F1E8]/80">
        <p className="text-center text-lg leading-relaxed">
          Сайты, которые <span className="text-[#C9A961]">помнят</span> — кинематографичный 3D,
          сдержанная дорогая анимация, живые сцены. Этот сайт — пример.
        </p>

        <ul className="grid gap-4 sm:grid-cols-2">
          {[
            ["React Three Fiber", "Настоящий WebGL прямо в браузере — глобусы, модели, частицы."],
            ["Кино-анимация", "Сдержанные переходы, никакого «ночного клуба» — Vogue, не дискотека."],
            ["Видео-витрины", "Ролики с R2 как живые текстуры и галереи разделов."],
            ["Деплой под ключ", "Сборка, хостинг, авто-деплой — сайт просто живёт и обновляется."],
          ].map(([h, t]) => (
            <li key={h} className="rounded-sm border border-[#C9A961]/15 bg-black/30 p-5">
              <p className="mb-1 text-sm uppercase tracking-[0.2em] text-[#C9A961]">{h}</p>
              <p className="text-sm leading-relaxed text-[#F5F1E8]/60">{t}</p>
            </li>
          ))}
        </ul>

        <p className="text-center text-sm tracking-[0.2em] text-[#F5F1E8]/40 uppercase">
          Ты сейчас внутри одного из них.
        </p>
      </div>
    </SectionShell>
  );
}
