import { SectionShell, ShowcaseVideo } from "@/components/ui/section-shell";
import { R2_VIDEOS, POSTERS } from "@/lib/videos";

export const metadata = {
  title: "Cinema — Pavel Zverev",
  description: "AI cinema & cinematic product film",
};

export default function CinemaPage() {
  return (
    <SectionShell
      index="03"
      title="Cinema"
      accent="rgba(139,34,34,0.9)"
      tagline="AI cinema & cinematic film"
    >
      <div className="mx-auto grid max-w-4xl gap-8 md:gap-12">
        <ShowcaseVideo
          src={R2_VIDEOS.cosmicBattle}
          poster={POSTERS.cosmicBattle}
          aspect="4/5"
          caption="Cosmic battle — IMAX 15/65 look, 60p"
        />
        <ShowcaseVideo
          src={R2_VIDEOS.halloween}
          poster={POSTERS.halloween}
          aspect="16/9"
          caption="Halloween — My Room, 60p"
        />
        <ShowcaseVideo
          src={R2_VIDEOS.samuraiS3}
          poster={POSTERS.samuraiS3}
          aspect="16/9"
          caption="Samurai — episode 3"
        />
        <ShowcaseVideo
          src={R2_VIDEOS.samuraiS2}
          poster={POSTERS.samuraiS2}
          aspect="16/9"
          caption="Samurai — episode 2"
        />
        <ShowcaseVideo
          src={R2_VIDEOS.bedroomFight}
          poster={POSTERS.bedroomFight}
          aspect="9/16"
          caption="Bedroom fight — Seedance 2.5, 60p"
        />
        <ShowcaseVideo
          src={R2_VIDEOS.angel}
          poster={POSTERS.angel}
          aspect="9/16"
          caption="Angel"
        />
        <ShowcaseVideo
          src={R2_VIDEOS.crowd}
          poster={POSTERS.crowd}
          aspect="16/9"
          caption="The crowd — period drama"
        />
        <ShowcaseVideo
          src={R2_VIDEOS.hedjSiroi}
          poster={POSTERS.hedjSiroi}
          aspect="4/3"
          caption="HEDJITSH — Siroi"
        />
        <ShowcaseVideo
          src={R2_VIDEOS.hedjSkali}
          poster={POSTERS.hedjSkali}
          aspect="4/3"
          caption="HEDJITSH — Skali (split screen)"
        />
        <ShowcaseVideo
          src={R2_VIDEOS.starmoyHorror}
          poster={POSTERS.starmoyHorror}
          aspect="9/16"
          caption="Horror — St. Petersburg, dry Fontanka"
        />
        <ShowcaseVideo
          src={R2_VIDEOS.soskuchilsya}
          poster={POSTERS.soskuchilsya}
          aspect="9/16"
          caption="«Мне бы только» — centurion, angel and Christ"
        />
        <ShowcaseVideo
          src={R2_VIDEOS.chas}
          poster={POSTERS.chas}
          aspect="9/16"
          caption="«Час, которого нет» — birthday film"
        />
        <ShowcaseVideo
          src={R2_VIDEOS.lumiere}
          poster={POSTERS.lumiere}
          aspect="9/16"
          caption="From the Lumières to AI — AI short film (Seedance 2.5, 60p)"
        />
        <ShowcaseVideo
          src={R2_VIDEOS.battle}
          poster={POSTERS.battle}
          aspect="9/16"
          caption="Battle — cinematic scene"
        />
        <ShowcaseVideo
          src={R2_VIDEOS.reign}
          poster={POSTERS.reign}
          aspect="16/9"
          caption="Reign — cinematic epic"
        />
        <ShowcaseVideo
          src={R2_VIDEOS.masterDynamic}
          poster={POSTERS.masterDynamic}
          aspect="16/9"
          caption="Master Dynamic — cinematic product film"
        />
        <ShowcaseVideo
          src={R2_VIDEOS.mishanyaMaster}
          poster={POSTERS.mishanyaMaster}
          aspect="16/9"
          caption="Мишаня — cinematic short"
        />
        <ShowcaseVideo
          src={R2_VIDEOS.veneto}
          poster={POSTERS.veneto}
          aspect="9/16"
          caption="Venice — cinematic travel"
        />
      </div>
    </SectionShell>
  );
}
