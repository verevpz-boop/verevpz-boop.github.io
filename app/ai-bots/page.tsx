import { SectionShell } from "@/components/ui/section-shell";
import { JarviClient } from "@/components/jarvi/jarvi-client";

export const metadata = {
  title: "AI-Bots — Pavel Zverev",
  description: "n8n automation bots & AI assistants",
};

export default function AIBotsPage() {
  return (
    <SectionShell
      index="05"
      title="AI-Bots"
      accent="rgba(255,140,30,0.85)"
      tagline="n8n automation & AI assistants"
    >
      <div className="mx-auto max-w-4xl">
        {/* Джарви — живой голосовой аватар студии (docs/TZ_JARVI.md). Первое окошко раздела. */}
        <div className="aspect-video w-full overflow-hidden rounded-sm border border-[#C9A961]/20 bg-black/30">
          <JarviClient />
        </div>
      </div>
    </SectionShell>
  );
}
