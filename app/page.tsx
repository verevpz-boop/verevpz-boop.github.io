import { GlobeSection } from "@/components/three/globe-section";

// BearBrick и навигация теперь в layout (SiteChrome) — на главной маскот есть,
// навигация скрыта (у главной свой глобус-навигатор).
export default function Home() {
  return <GlobeSection />;
}
