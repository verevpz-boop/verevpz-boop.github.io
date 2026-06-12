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
          src={R2_VIDEOS.maldivesHotel}
          poster={POSTERS.maldivesHotel}
          aspect="16/9"
          caption="Maldives resort — brand film"
        />
      </div>
    </SectionShell>
  );
}
