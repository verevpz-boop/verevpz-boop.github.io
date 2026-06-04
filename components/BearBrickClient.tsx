"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import { BearBrickChat } from "@/components/BearBrickChat";

const BearBrickCanvas = dynamic(
  () => import("@/components/BearBrick").then((m) => m.BearBrick),
  {
    ssr: false,
    loading: () => (
      <div className="flex w-[130px] h-[160px] md:w-[200px] md:h-[230px] items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
      </div>
    ),
  },
);

export function BearBrickClient() {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <>
      <div
        className="fixed bottom-8 right-8 z-30"
        onClick={() => setChatOpen((s) => !s)}
      >
        <BearBrickCanvas />
      </div>
      <BearBrickChat open={chatOpen} onClose={() => setChatOpen(false)} />
    </>
  );
}
