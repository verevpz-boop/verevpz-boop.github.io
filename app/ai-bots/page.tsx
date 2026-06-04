import { SectionShell } from "@/components/ui/section-shell";

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
        {/* TODO: Pavel — add R2 video / demo for AI-bots (n8n workflow / assistant). */}
        <div className="flex aspect-video w-full items-center justify-center rounded-sm border border-dashed border-[#C9A961]/20 bg-black/30">
          <p className="text-xs uppercase tracking-[0.3em] text-[#F5F1E8]/30">
            AI-bots demo — coming soon
          </p>
        </div>
      </div>
    </SectionShell>
  );
}
