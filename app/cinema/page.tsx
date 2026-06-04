import { SectionShell, ShowcaseVideo } from "@/components/ui/section-shell";
import { R2_VIDEOS } from "@/lib/videos";

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
          src={R2_VIDEOS.masterDynamic}
          aspect="16/9"
          caption="Master Dynamic — cinematic product film"
        />
        <ShowcaseVideo
          src={R2_VIDEOS.veneto}
          aspect="16/9"
          caption="Venice — cinematic travel"
        />
        <ShowcaseVideo
          src={R2_VIDEOS.mishanyaMaster}
          aspect="16/9"
          caption="Мишаня — cinematic short"
        />
        <ShowcaseVideo
          src={R2_VIDEOS.openartCinema}
          aspect="9/16"
          caption="Cinematic — AI scene"
        />
        <ShowcaseVideo
          src={R2_VIDEOS.jimengTokusatsu}
          aspect="9/16"
          caption="Tokusatsu — mecha hero transformation"
        />
      </div>
    </SectionShell>
  );
}
