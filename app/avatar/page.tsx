import Link from "next/link";
import { SectionShell } from "@/components/ui/section-shell";

export const metadata = {
  title: "AI-аватар — Pavel Zverev",
  description: "Живой говорящий аватар-консультант на твой сайт",
};

export default function AvatarPage() {
  return (
    <SectionShell
      index="B·06"
      title="AI Avatar"
      accent="rgba(201,169,97,0.8)"
      tagline="Говорящая голова на твой сайт"
    >
      <div className="mx-auto max-w-3xl space-y-12 text-[#F5F1E8]/80">
        <p className="text-center text-lg leading-relaxed">
          Живое <span className="text-[#C9A961]">лицо</span> для сайта: слушает голос, отвечает голосом,
          шевелит губами в реальном времени. Можно перебить на полуслове — как живого человека.
        </p>

        <ul className="grid gap-4 sm:grid-cols-2">
          {[
            ["Real-time голос", "Слушает и отвечает на лету, ответ начинается меньше чем за секунду."],
            ["Перебивание", "Заговорил поверх — голова мгновенно умолкает и слушает тебя."],
            ["Липсинк", "Губы двигаются синхронно с речью — не картинка, а живая мимика."],
            ["Бесплатный стек", "Браузерный слух + быстрый мозг + локальный голос. 0₽ на инфраструктуру."],
          ].map(([h, t]) => (
            <li key={h} className="rounded-sm border border-[#C9A961]/15 bg-black/30 p-5">
              <p className="mb-1 text-sm uppercase tracking-[0.2em] text-[#C9A961]">{h}</p>
              <p className="text-sm leading-relaxed text-[#F5F1E8]/60">{t}</p>
            </li>
          ))}
        </ul>

        <div className="text-center">
          <Link
            href="/ai-bots"
            className="inline-block rounded-sm border border-[#C9A961]/40 px-7 py-3 text-xs uppercase tracking-[0.3em] text-[#C9A961] transition-colors hover:bg-[#C9A961]/10 active:scale-[0.98]"
          >
            Поговорить с головой →
          </Link>
        </div>
      </div>
    </SectionShell>
  );
}
