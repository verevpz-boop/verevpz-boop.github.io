import { SectionShell, ShowcaseVideo } from "@/components/ui/section-shell";
import { R2_VIDEOS, POSTERS } from "@/lib/videos";

export const metadata = {
  title: "Animation — Pavel Zverev",
  description: "AI-мультсериал «Шифу Учит»: вертикальная анимация для соцсетей.",
};

export default function AnimationPage() {
  return (
    <SectionShell
      index="06"
      title="Animation"
      accent="rgba(201,127,224,0.9)"
      tagline="AI-мультсериал «Шифу Учит»"
    >
      <div className="mx-auto grid max-w-4xl gap-8 md:gap-12">
        <ShowcaseVideo
          src={R2_VIDEOS.animMuha}
          poster={POSTERS.animMuha}
          aspect="9/16"
          caption="Шифу Учит — серия 1: Муха + Класс"
        />
        <ShowcaseVideo
          src={R2_VIDEOS.animKungfu}
          poster={POSTERS.animKungfu}
          aspect="9/16"
          caption="Шифу Учит — серия 2: Кунг-фу"
        />
        <ShowcaseVideo
          src={R2_VIDEOS.animTianxia}
          poster={POSTERS.animTianxia}
          aspect="9/16"
          caption="Шифу Учит — 天下 «Всё под небом»"
        />
        <ShowcaseVideo
          src={R2_VIDEOS.animDrakon}
          poster={POSTERS.animDrakon}
          aspect="9/16"
          caption="Шифу Учит — серия 4: Дракон 龙"
        />
        <ShowcaseVideo
          src={R2_VIDEOS.animBaoen}
          poster={POSTERS.animBaoen}
          aspect="9/16"
          caption="Шифу Учит — серия 5: 报恩 «Отплатить за добро»"
        />
        <ShowcaseVideo
          src={R2_VIDEOS.animHeng}
          poster={POSTERS.animHeng}
          aspect="9/16"
          caption="Шифу Учит — серия 6: 恒 «Капля точит камень»"
        />
        <ShowcaseVideo
          src={R2_VIDEOS.animMing}
          poster={POSTERS.animMing}
          aspect="9/16"
          caption="Шифу Учит — серия 7: 明 «Ходит вокруг»"
        />
      </div>
    </SectionShell>
  );
}
