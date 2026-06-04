"use client";
import dynamic from "next/dynamic";

const TikTokCanvas = dynamic(
  () => import("@/components/three/tiktok-canvas").then((m) => m.TikTokCanvas),
  { ssr: false },
);

export function TikTokCanvasClient() {
  return <TikTokCanvas />;
}
