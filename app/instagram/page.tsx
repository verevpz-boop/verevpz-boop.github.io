import { SectionShell } from "@/components/ui/section-shell";

export const metadata = {
  title: "Instagram-автоматизация — Pavel Zverev",
  description: "Авто-публикация и авто-монтаж контента на потоке",
};

export default function InstagramPage() {
  return (
    <SectionShell
      index="B·03"
      title="Instagram"
      accent="rgba(201,169,97,0.8)"
      tagline="Авто-публикация и авто-монтаж"
    >
      <div className="mx-auto max-w-3xl space-y-12 text-[#F5F1E8]/80">
        <p className="text-center text-lg leading-relaxed">
          Контент-завод на автопилоте: от идеи до опубликованного Reels —
          <span className="text-[#C9A961]"> без ручной рутины</span>. Так уже работает
          языковая школа «Шифу Учит».
        </p>

        <ol className="space-y-4">
          {[
            ["Идея → сценарий", "Тема прогоняется через LLM, собирается монтажный шот-лист."],
            ["AI-видео", "Кадры генерируются (Seedance), хук — «невозможный» кадр в первые секунды."],
            ["Авто-монтаж", "Склейки по смыслу, субтитры, брендинг, озвучка — FFmpeg-пайплайн."],
            ["Одобрение в Telegram", "Бот шлёт готовый ролик с кнопками одобрить / перегенерить."],
            ["Авто-постинг", "По ✅ — загрузка и публикация в аккаунт через Graph API."],
          ].map(([h, t], i) => (
            <li key={h} className="flex gap-4 rounded-sm border border-[#C9A961]/15 bg-black/30 p-5">
              <span className="text-2xl font-light text-[#C9A961]/60" style={{ fontFamily: "var(--font-cormorant)" }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <p className="mb-1 text-sm uppercase tracking-[0.2em] text-[#C9A961]">{h}</p>
                <p className="text-sm leading-relaxed text-[#F5F1E8]/60">{t}</p>
              </div>
            </li>
          ))}
        </ol>

        {/* Pavel: сюда сбросим n8n-схему привязки / архитектуру оркестрации. */}
        <div className="flex aspect-video w-full items-center justify-center rounded-sm border border-dashed border-[#C9A961]/20 bg-black/30">
          <p className="text-xs uppercase tracking-[0.3em] text-[#F5F1E8]/30">
            n8n-схема привязки — сюда
          </p>
        </div>
      </div>
    </SectionShell>
  );
}
