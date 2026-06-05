import { SectionShell, ShowcaseVideo } from "@/components/ui/section-shell";
import { R2_VIDEOS, POSTERS } from "@/lib/videos";

export const metadata = {
  title: "Fashion — Pavel Zverev",
  description: "AI-driven fashion & beauty visuals",
};

export default function FashionPage() {
  return (
    <SectionShell
      index="01"
      title="Fashion"
      accent="rgba(201,169,97,0.7)"
      tagline="AI visuals for fashion & beauty"
    >
      <div className="mx-auto grid max-w-4xl gap-8 md:gap-12">
        <ShowcaseVideo
          src={R2_VIDEOS.calvinKlein}
          poster={POSTERS.calvinKlein}
          aspect="16/9"
          caption="Calvin Klein — fashion commercial"
        />
        <ShowcaseVideo
          src={R2_VIDEOS.lime}
          poster={POSTERS.lime}
          aspect="9/16"
          caption="LIME — campaign film"
        />
        <ShowcaseVideo
          src={R2_VIDEOS.demonessaMaster}
          poster={POSTERS.demonessaMaster}
          aspect="9/16"
          caption="Demonessa — fashion film"
        />
        <ShowcaseVideo
          src={R2_VIDEOS.incanto0404}
          poster={POSTERS.incanto0404}
          aspect="9/16"
          caption="Incanto — swimwear campaign"
        />
        <ShowcaseVideo
          src={R2_VIDEOS.incantoCentr}
          poster={POSTERS.incantoCentr}
          aspect="9/16"
          caption="Incanto — studio showcase"
        />
        <ShowcaseVideo
          src={R2_VIDEOS.creationPolic4}
          poster={POSTERS.creationPolic4}
          aspect="9/16"
          caption="Creation — fashion lookbook"
        />
        <ShowcaseVideo
          src={R2_VIDEOS.materialWoman}
          poster={POSTERS.materialWoman}
          aspect="16/9"
          caption="Material Woman — fashion film"
        />
        <ShowcaseVideo
          src={R2_VIDEOS.smeh0403}
          poster={POSTERS.smeh0403}
          aspect="9/16"
          caption="Editorial — fashion motion"
        />
      </div>
    </SectionShell>
  );
}
