"use client";
import { useRef, useMemo, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { DeepStarField } from "./deep-star-field";

/**
 * MOCKUP of the "signature head" satellite (docs/SIGNATURE_HEAD.md).
 * Visual-only prototype for Pavel to pick a direction — NO voice yet.
 * Demonstrates: stylized head on the site's starfield, an animated mouth
 * (lip-sync proxy), and the four conversation states cycling on a demo loop.
 *
 * Deliberately keeps ALL animation state in component refs (no module-level
 * mutable singletons) so React StrictMode's dev double-mount can't freeze it.
 */

type HeadStyle = "wire" | "points" | "solid";
type ConvState = "idle" | "listening" | "thinking" | "speaking";

const STATE_COLOR: Record<ConvState, string> = {
  idle: "#7a6a3a",       // dim gold
  listening: "#3fb6c9",  // cyan — hearing you
  thinking: "#c98a3f",   // amber — processing
  speaking: "#C9A961",   // bright gold — talking
};

const STATE_LABEL: Record<ConvState, string> = {
  idle: "ОЖИДАНИЕ",
  listening: "СЛУШАЮ",
  thinking: "ДУМАЮ",
  speaking: "ГОВОРЮ",
};

/** Demo loop timing (seconds) — cycles the states so all are visible. */
const CYCLE: { s: ConvState; dur: number }[] = [
  { s: "idle", dur: 3 },
  { s: "listening", dur: 2.5 },
  { s: "thinking", dur: 1.5 },
  { s: "speaking", dur: 4.5 },
];

function Head({ style, onState }: { style: HeadStyle; onState: (s: ConvState) => void }) {
  const group = useRef<THREE.Group>(null!);
  const mouth = useRef<THREE.Mesh>(null!);
  const haloRef = useRef<THREE.Mesh>(null!);
  const baseMat = useRef<THREE.MeshStandardMaterial>(null!);
  const wireMat = useRef<THREE.LineBasicMaterial>(null!);
  const pointMat = useRef<THREE.PointsMaterial>(null!);

  // Low-poly head base (icosahedron reads as a faceted "signature" skull).
  const geo = useMemo(() => new THREE.IcosahedronGeometry(2, 2), []);
  const wireGeo = useMemo(() => new THREE.WireframeGeometry(geo), [geo]);

  // Demo state derived from ABSOLUTE clock time — deterministic, can't get stuck.
  const lastState = useRef<ConvState>("idle");
  const curColor = useMemo(() => new THREE.Color(STATE_COLOR.idle), []);
  const CYCLE_TOTAL = useMemo(() => CYCLE.reduce((a, c) => a + c.dur, 0), []);

  useFrame(({ clock }) => {
    const time = clock.elapsedTime;
    const tt = time % CYCLE_TOTAL;
    let acc = 0;
    let state: ConvState = "idle";
    for (const c of CYCLE) { if (tt < acc + c.dur) { state = c.s; break; } acc += c.dur; }
    if (state !== lastState.current) { lastState.current = state; onState(state); }

    // gentle bob + breathe
    if (group.current) {
      group.current.rotation.y = Math.sin(time * 0.5) * 0.18;
      group.current.rotation.x = Math.sin(time * 0.33) * 0.06;
      group.current.scale.setScalar(1 + Math.sin(time * 1.6) * 0.012);
    }

    // colour easing toward the active state
    curColor.lerp(new THREE.Color(STATE_COLOR[state]), 0.07);
    const glow =
      state === "speaking" ? 1.4 :
      state === "listening" ? 1.0 :
      state === "thinking" ? 0.8 : 0.5;
    if (baseMat.current) { baseMat.current.emissive.copy(curColor); baseMat.current.emissiveIntensity = glow * 0.6; baseMat.current.color.copy(curColor); }
    if (wireMat.current) wireMat.current.color.copy(curColor);
    if (pointMat.current) pointMat.current.color.copy(curColor);

    // mouth: lip-sync proxy while speaking (jittery like speech), else ~closed
    let open = 0.04;
    if (state === "speaking") {
      const a = Math.abs(Math.sin(time * 13.0));
      const b = 0.5 + 0.5 * Math.sin(time * 6.3 + 1.0);
      open = 0.06 + a * b * 0.55;
    } else if (state === "listening") {
      open = 0.04 + Math.max(0, Math.sin(time * 2.0)) * 0.02;
    }
    if (mouth.current) mouth.current.scale.y = open;

    // halo pulse (stronger when active)
    if (haloRef.current) {
      const pulse = 1 + Math.sin(time * 3.0) * (state === "idle" ? 0.02 : 0.06);
      haloRef.current.scale.setScalar(pulse);
      (haloRef.current.material as THREE.MeshBasicMaterial).opacity =
        (state === "idle" ? 0.06 : 0.13) + Math.sin(time * 3.0) * 0.03;
    }
  });

  return (
    <group ref={group}>
      {/* ── Head base — switchable style ── */}
      {style === "solid" && (
        <mesh geometry={geo}>
          <meshStandardMaterial ref={baseMat} flatShading metalness={0.3} roughness={0.5} color={STATE_COLOR.idle} emissive={STATE_COLOR.idle} emissiveIntensity={0.3} />
        </mesh>
      )}
      {style === "wire" && (
        <>
          {/* faint solid core for depth */}
          <mesh geometry={geo}>
            <meshBasicMaterial color="#0a0a0a" transparent opacity={0.55} />
          </mesh>
          <lineSegments geometry={wireGeo}>
            <lineBasicMaterial ref={wireMat} color={STATE_COLOR.idle} transparent opacity={0.9} />
          </lineSegments>
        </>
      )}
      {style === "points" && (
        <points geometry={geo}>
          <pointsMaterial ref={pointMat} color={STATE_COLOR.idle} size={0.08} sizeAttenuation transparent opacity={0.95} />
        </points>
      )}

      {/* ── Eyes ── */}
      {[-0.65, 0.65].map((x) => (
        <mesh key={x} position={[x, 0.35, 1.75]}>
          <sphereGeometry args={[0.13, 16, 16]} />
          <meshBasicMaterial color="#fff4d8" />
        </mesh>
      ))}

      {/* ── Mouth — scales in Y for lip-sync ── */}
      <mesh ref={mouth} position={[0, -0.55, 1.78]}>
        <boxGeometry args={[0.9, 1.0, 0.12]} />
        <meshBasicMaterial color="#ffdf9e" />
      </mesh>

      {/* ── Halo ring — tilted & pushed back so it orbits behind, not across the face ── */}
      <mesh ref={haloRef} position={[0, -0.2, -0.6]} rotation={[1.28, 0, 0.22]}>
        <torusGeometry args={[2.9, 0.018, 8, 90]} />
        <meshBasicMaterial color="#C9A961" transparent opacity={0.1} />
      </mesh>
    </group>
  );
}

export function SignatureHead() {
  const [style, setStyle] = useState<HeadStyle>("wire");
  const [state, setState] = useState<ConvState>("idle");

  return (
    <main className="relative h-screen w-full overflow-hidden bg-black">
      <Canvas camera={{ position: [0, 0, 7], fov: 45 }} gl={{ antialias: true }} dpr={[1, 1.5]}>
        <ambientLight intensity={0.4} />
        <pointLight position={[5, 5, 8]} intensity={1.2} color="#fff5dc" />
        <pointLight position={[-5, -2, 6]} intensity={0.6} color="#C9A961" />
        <DeepStarField />
        <Head style={style} onState={setState} />
      </Canvas>

      {/* ── HUD ── */}
      <div className="pointer-events-none absolute top-0 left-0 right-0 px-6 pt-8 text-center">
        <p style={{ fontFamily: "var(--font-cormorant), serif", fontStyle: "italic", fontSize: 26, letterSpacing: "0.25em", color: "#C9A961" }}>
          SIGNATURE HEAD
        </p>
        <p style={{ marginTop: 6, fontSize: 11, letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(245,241,232,0.4)" }}>
          макет · демо-цикл состояний · голоса пока нет
        </p>
      </div>

      {/* State chip — below the head so it never overlaps the mouth */}
      <div className="absolute left-1/2 bottom-28 -translate-x-1/2 pointer-events-none">
        <span style={{
          fontFamily: "var(--font-geist-sans, Inter, sans-serif)", fontSize: 12, letterSpacing: "0.35em",
          color: STATE_COLOR[state], border: `1px solid ${STATE_COLOR[state]}`, borderRadius: 999,
          padding: "5px 16px", background: "rgba(0,0,0,0.4)",
        }}>
          ● {STATE_LABEL[state]}
        </span>
      </div>

      {/* Style switcher — for Pavel to pick a direction */}
      <div className="absolute bottom-10 left-0 right-0 flex items-center justify-center gap-3">
        {([["wire", "Каркас"], ["points", "Точки"], ["solid", "Грани"]] as [HeadStyle, string][]).map(([s, label]) => (
          <button
            key={s}
            onClick={() => setStyle(s)}
            className="active:scale-[0.96] transition-all"
            style={{
              fontFamily: "var(--font-geist-sans, Inter, sans-serif)", fontSize: 11, letterSpacing: "0.2em",
              textTransform: "uppercase", padding: "8px 18px", borderRadius: 6, cursor: "pointer",
              color: style === s ? "#0a0a0a" : "rgba(245,241,232,0.7)",
              background: style === s ? "#C9A961" : "rgba(255,255,255,0.05)",
              border: `1px solid ${style === s ? "#C9A961" : "rgba(201,169,97,0.3)"}`,
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </main>
  );
}
