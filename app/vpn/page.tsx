import { SectionShell } from "@/components/ui/section-shell";

export const metadata = {
  title: "VPN — Pavel Zverev",
  description: "Свой приватный VPN-тоннель, не подписочный сервис",
};

export default function VpnPage() {
  return (
    <SectionShell
      index="B·02"
      title="VPN"
      accent="rgba(201,169,97,0.8)"
      tagline="Свой приватный тоннель"
    >
      <div className="mx-auto max-w-3xl space-y-12 text-[#F5F1E8]/80">
        <p className="text-center text-lg leading-relaxed">
          Не подписка на чужой сервис, а <span className="text-[#C9A961]">твой собственный</span> VPN —
          поднимаю личный зашифрованный тоннель, который не делят тысячи людей и который
          не отключат за неуплату.
        </p>

        <ul className="grid gap-4 sm:grid-cols-2">
          {[
            ["VLESS + WS", "Современный протокол поверх WebSocket — стабильно проходит блокировки."],
            ["Обход геоблоков", "Доступ к сервисам, которые закрыты в регионе, без падений скорости."],
            ["Портативный комплект", "Установщик Win/Mac + настройки на флешку — переносится на любой ПК за минуту."],
            ["На своей инфраструктуре", "База — связка Hiddify + Aeza. Ключи и сервер только твои."],
          ].map(([h, t]) => (
            <li key={h} className="rounded-sm border border-[#C9A961]/15 bg-black/30 p-5">
              <p className="mb-1 text-sm uppercase tracking-[0.2em] text-[#C9A961]">{h}</p>
              <p className="text-sm leading-relaxed text-[#F5F1E8]/60">{t}</p>
            </li>
          ))}
        </ul>

        {/* Pavel: сюда можно бросить схему/скрин конфигурации, если захочешь показать. */}
        <div className="flex aspect-video w-full items-center justify-center rounded-sm border border-dashed border-[#C9A961]/20 bg-black/30">
          <p className="text-xs uppercase tracking-[0.3em] text-[#F5F1E8]/30">
            Схема / демо — coming soon
          </p>
        </div>
      </div>
    </SectionShell>
  );
}
