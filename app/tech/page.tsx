import { SectionShell, ShowcaseVideo } from "@/components/ui/section-shell";
import { R2_VIDEOS, POSTERS } from "@/lib/videos";

export const metadata = {
  title: "Tech — Pavel Zverev",
  description: "Advertising for technology products",
};

export default function TechPage() {
  return (
    <SectionShell
      index="02"
      title="Tech"
      accent="rgba(224,224,224,0.7)"
      tagline="Advertising for technology products"
    >
      <div className="mx-auto grid max-w-4xl gap-8 md:gap-12">
        <ShowcaseVideo
          src={R2_VIDEOS.driver4k}
          poster={POSTERS.driver4k}
          aspect="16/9"
          caption="Off-road in the desert — 4K, 60p"
        />
        <ShowcaseVideo
          src={R2_VIDEOS.ferrari}
          poster={POSTERS.ferrari}
          aspect="9/16"
          caption="Ferrari — commercial"
        />
        <ShowcaseVideo
          src={R2_VIDEOS.girlRobot}
          poster={POSTERS.girlRobot}
          aspect="9/16"
          caption="Girl & robot"
        />
        <ShowcaseVideo
          src={R2_VIDEOS.skoraya60p}
          poster={POSTERS.skoraya60p}
          aspect="9/16"
          caption="Ambulance — 60p motion"
        />
      </div>
    </SectionShell>
  );
}
