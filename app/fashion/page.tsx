import { SectionShell, ShowcaseVideo } from "@/components/ui/section-shell";
import { R2_VIDEOS } from "@/lib/videos";

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
          src={R2_VIDEOS.lime}
          aspect="16/9"
          caption="LIME — campaign film"
        />
        <ShowcaseVideo
          src={R2_VIDEOS.calvinKlein}
          aspect="16/9"
          caption="Calvin Klein — fashion commercial"
        />
        <ShowcaseVideo
          src={R2_VIDEOS.demonessaMaster}
          aspect="16/9"
          caption="Demonessa — fashion film"
        />
        <ShowcaseVideo
          src={R2_VIDEOS.incanto0404}
          aspect="16/9"
          caption="Incanto — swimwear campaign"
        />
        <ShowcaseVideo
          src={R2_VIDEOS.incantoCentr}
          aspect="16/9"
          caption="Incanto — studio showcase"
        />
        <ShowcaseVideo
          src={R2_VIDEOS.creationPolic4}
          aspect="16/9"
          caption="Creation — fashion lookbook"
        />
      </div>
    </SectionShell>
  );
}
