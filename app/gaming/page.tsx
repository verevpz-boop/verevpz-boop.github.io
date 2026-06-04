import { SectionShell, ShowcaseVideo } from "@/components/ui/section-shell";
import { R2_VIDEOS } from "@/lib/videos";

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
          src={R2_VIDEOS.raidMasterfinal}
          aspect="16/9"
          caption="RAID — cinematic master film"
        />
        <ShowcaseVideo
          src={R2_VIDEOS.jimengWarriorsGaming}
          aspect="16/9"
          caption="Fantasy warriors — cinematic scene"
        />
        <ShowcaseVideo
          src={R2_VIDEOS.smeh0424gaming}
          aspect="16/9"
          caption="Gaming — action sequence"
        />
      </div>
    </SectionShell>
  );
}
