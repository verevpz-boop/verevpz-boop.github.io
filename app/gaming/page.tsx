import { SectionShell, ShowcaseVideo } from "@/components/ui/section-shell";
import { R2_VIDEOS, POSTERS } from "@/lib/videos";

export const metadata = {
  title: "Gaming — Pavel Zverev",
  description: "3D characters, sci-fi & fantasy worlds",
};

export default function GamingPage() {
  return (
    <SectionShell
      index="04"
      title="Gaming"
      accent="rgba(68,136,255,0.8)"
      tagline="3D characters · sci-fi & fantasy"
    >
      <div className="mx-auto grid max-w-4xl gap-8 md:gap-12">
        <ShowcaseVideo
          src={R2_VIDEOS.orki01}
          poster={POSTERS.orki01}
          aspect="4/3"
          caption="Orcs, part 1 — battle in Mordor (1.3M views)"
        />
        <ShowcaseVideo
          src={R2_VIDEOS.orki02}
          poster={POSTERS.orki02}
          aspect="4/3"
          caption="Orcs, part 2 — fantasy fight"
        />
        <ShowcaseVideo
          src={R2_VIDEOS.orki03}
          poster={POSTERS.orki03}
          aspect="4/3"
          caption="Orcs, part 3 — the brawl"
        />
        <ShowcaseVideo
          src={R2_VIDEOS.orki04}
          poster={POSTERS.orki04}
          aspect="4/3"
          caption="Orcs, part 4"
        />
        <ShowcaseVideo
          src={R2_VIDEOS.raidWaterfall}
          poster={POSTERS.raidWaterfall}
          aspect="16/9"
          caption="RAID — waterfall, 60p"
        />
        <ShowcaseVideo
          src={R2_VIDEOS.raidDuel}
          poster={POSTERS.raidDuel}
          aspect="4/3"
          caption="RAID — canyon duel"
        />
        <ShowcaseVideo
          src={R2_VIDEOS.reign}
          poster={POSTERS.reign}
          aspect="16/9"
          caption="Reign — cinematic epic"
        />
        <ShowcaseVideo
          src={R2_VIDEOS.jimengWarriorsGaming}
          poster={POSTERS.jimengWarriorsGaming}
          aspect="16/9"
          caption="Fantasy warriors — cinematic scene"
        />
        <ShowcaseVideo
          src={R2_VIDEOS.raidMasterfinal}
          poster={POSTERS.raidMasterfinal}
          aspect="9/16"
          caption="RAID — cinematic master film"
        />
        <ShowcaseVideo
          src={R2_VIDEOS.smeh0424gaming}
          poster={POSTERS.smeh0424gaming}
          aspect="9/16"
          caption="Gaming — action sequence"
        />
      </div>
    </SectionShell>
  );
}
