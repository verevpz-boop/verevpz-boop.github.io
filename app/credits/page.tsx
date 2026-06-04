export const metadata = {
  title: "Credits — Pavel Zverev",
};

export default function CreditsPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-24 bg-background text-foreground">
      <div className="max-w-xl w-full">
        <h1
          className="text-4xl mb-10"
          style={{ fontFamily: "var(--font-cormorant), serif", color: "#C9A961" }}
        >
          Credits
        </h1>
        <ul className="space-y-4 text-sm leading-relaxed opacity-80">
          <li>
            <strong>"Sci-Fi Camera Drone"</strong> by 3dsofsan — CC BY 4.0, via Sketchfab
          </li>
          <li>
            <strong>"Bearbrick"</strong> by Pavard — via Sketchfab
          </li>
        </ul>
      </div>
    </main>
  );
}
