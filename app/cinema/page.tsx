import { SectionShell, ShowcaseVideo } from "@/components/ui/section-shell";
import { R2_VIDEOS, POSTERS } from "@/lib/videos";

export const metadata = {
  title: "Cinema — Pavel Zverev",
  description: "AI cinema & cinematic product film",
};

export default function CinemaPage() {
  return (
    <SectionShell
      index="03"
      title="Cinema"
      accent="rgba(139,34,34,0.9)"
      tagline="AI cinema & cinematic film"
    >
      <div className="mx-auto grid max-w-4xl gap-8 md:gap-12">
        <ShowcaseVideo
          src={R2_VIDEOS.reign}
          poster={POSTERS.reign}
          aspect="16/9"
          caption="Reign — cinematic epic"
        />
        <ShowcaseVideo
          src={R2_VIDEOS.masterDynamic}
          poster={POSTERS.masterDynamic}
          aspect="16/9"
          caption="Master Dynamic — cinematic product film"
        />
        <ShowcaseVideo
          src={R2_VIDEOS.mishanyaMaster}
          poster={POSTERS.mishanyaMaster}
          aspect="16/9"
          caption="Мишаня — cinematic short"
        />
        <ShowcaseVideo
          src={R2_VIDEOS.jimengTokusatsu}
          poster={POSTERS.jimengTokusatsu}
          aspect="16/9"
          caption="Tokusatsu — mecha hero transformation"
        />
        <ShowcaseVideo
          src={R2_VIDEOS.openartCinema}
          poster={POSTERS.openartCinema}
          aspect="16/9"
          caption="Cinematic — AI scene"
        />
        <ShowcaseVideo
          src={R2_VIDEOS.veneto}
          poster={POSTERS.veneto}
          aspect="9/16"
          caption="Venice — cinematic travel"
        />
      </div>
    </SectionShell>
  );
}
