"use client";
import dynamic from "next/dynamic";

const SignatureHead = dynamic(
  () => import("./signature-head").then((m) => m.SignatureHead),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen w-full items-center justify-center bg-black">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
      </div>
    ),
  },
);

export function SignatureHeadClient() {
  return <SignatureHead />;
}
