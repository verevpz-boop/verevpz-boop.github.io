"use client";
import dynamic from "next/dynamic";

const BusinessCanvas = dynamic(
  () => import("./business-canvas").then((m) => m.BusinessCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: "#07070a" }}>
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
      </div>
    ),
  },
);

export function BusinessCanvasClient() {
  return <BusinessCanvas />;
}
