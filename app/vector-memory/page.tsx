import { SectionShell } from "@/components/ui/section-shell";

export const metadata = {
  title: "Векторная память — Pavel Zverev",
  description: "Надёжный личный бэкап-стек, повторяющий Claude в урезе",
};

export default function VectorMemoryPage() {
  return (
    <SectionShell
      index="B·04"
      title="Vector Memory"
      accent="rgba(201,169,97,0.8)"
      tagline="Свой стек на случай, если всё отвалится"
    >
      <div className="mx-auto max-w-3xl space-y-12 text-[#F5F1E8]/80">
        <p className="text-center text-lg leading-relaxed">
          Надёжный бэкап на твоём компьютере: <span className="text-[#C9A961]">урезанная копия Claude</span> со
          всем твоим архивом, который продолжит работать, даже когда облако недоступно.
        </p>

        <ul className="grid gap-4 sm:grid-cols-2">
          {[
            ["Локальные модели", "Ollama на твоей видеокарте — мозг работает офлайн, без подписок."],
            ["Векторная память", "Qdrant хранит весь архив диалогов и решений, ищет по смыслу."],
            ["Сменный мозг", "Упала одна модель — встаёт следующая теми же «руками». Деградация только по уму."],
            ["Твой архив", "Всё, что наработано, остаётся у тебя на диске. Ничего не теряется."],
          ].map(([h, t]) => (
            <li key={h} className="rounded-sm border border-[#C9A961]/15 bg-black/30 p-5">
              <p className="mb-1 text-sm uppercase tracking-[0.2em] text-[#C9A961]">{h}</p>
              <p className="text-sm leading-relaxed text-[#F5F1E8]/60">{t}</p>
            </li>
          ))}
        </ul>

        {/* Pavel: сюда — схема стека (LiteLLM-хаб, failover, Ollama, Qdrant). */}
        <div className="flex aspect-video w-full items-center justify-center rounded-sm border border-dashed border-[#C9A961]/20 bg-black/30">
          <p className="text-xs uppercase tracking-[0.3em] text-[#F5F1E8]/30">
            Схема стека — сюда
          </p>
        </div>
      </div>
    </SectionShell>
  );
}
