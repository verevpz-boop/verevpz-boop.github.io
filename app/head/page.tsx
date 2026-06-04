import { SignatureHeadClient } from "@/components/three/signature-head-client";

export const metadata = {
  title: "Signature Head — Pavel Zverev",
  description: "Real-time talking signature head (mockup)",
};

// МАКЕТ спутника «сигнатурная голова» (docs/SIGNATURE_HEAD.md).
// Визуал-прототип для выбора направления — голоса пока нет.
export default function HeadPage() {
  return <SignatureHeadClient />;
}
