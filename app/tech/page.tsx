import { SectionShell } from "@/components/ui/section-shell";

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
      <div className="mx-auto max-w-4xl">
        {/* TODO: Pavel — add R2 video for tech (product / device ad). */}
        <div className="flex aspect-video w-full items-center justify-center rounded-sm border border-dashed border-[#C9A961]/20 bg-black/30">
          <p className="text-xs uppercase tracking-[0.3em] text-[#F5F1E8]/30">
            Tech reel — coming soon
          </p>
        </div>
      </div>
    </SectionShell>
  );
}
