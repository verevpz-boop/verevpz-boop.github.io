"use client";
import dynamic from "next/dynamic";

// Джарви живёт только в браузере (Web Speech, WebGL) — ssr:false обязателен.
export const JarviClient = dynamic(
  () => import("./jarvi-window").then((m) => m.JarviWindow),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-black">
        <p className="text-[10px] uppercase tracking-[0.3em] text-[#C9A961]/40">Джарви просыпается…</p>
      </div>
    ),
  }
);
