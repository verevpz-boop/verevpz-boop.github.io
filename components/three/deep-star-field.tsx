"use client";
import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/* ── tiny circle texture (radial gradient, not square) ── */
function makeCircleTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.3, "rgba(255,255,255,0.6)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/* ── vertex shader ── */
const vertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aOpacity;
  attribute float aPhase;
  uniform float uTime;
  varying float vOpacity;
  void main() {
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    /* twinkle: slow sin with per-star phase */
    float twinkle = 0.8 + 0.2 * sin(uTime * 0.4 + aPhase);
    vOpacity = aOpacity * twinkle;
    gl_PointSize = aSize * (200.0 / -mvPos.z);
    gl_Position = projectionMatrix * mvPos;
  }
`;

/* ── fragment shader ── */
const fragmentShader = /* glsl */ `
  uniform sampler2D uTex;
  uniform vec3 uColor;
  varying float vOpacity;
  void main() {
    vec4 t = texture2D(uTex, gl_PointCoord);
    if (t.a < 0.01) discard;
    gl_FragColor = vec4(uColor, t.a * vOpacity);
  }
`;

/* ── single star layer ── */
interface LayerProps {
  count: number;
  rMin: number;
  rMax: number;
  sizeMin: number;
  sizeMax: number;
  opacityMin: number;
  opacityMax: number;
  color: THREE.Color;
  texture: THREE.Texture;
}

function StarLayer({
  count, rMin, rMax, sizeMin, sizeMax, opacityMin, opacityMax, color, texture,
}: LayerProps) {
  const matRef = useRef<THREE.ShaderMaterial>(null!);

  const geo = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const opacities = new Float32Array(count);
    const phases = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // uniform sphere distribution
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = rMin + Math.random() * (rMax - rMin);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
      sizes[i] = sizeMin + Math.random() * (sizeMax - sizeMin);
      opacities[i] = opacityMin + Math.random() * (opacityMax - opacityMin);
      phases[i] = Math.random() * Math.PI * 2;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    g.setAttribute("aOpacity", new THREE.BufferAttribute(opacities, 1));
    g.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
    return g;
  }, [count, rMin, rMax, sizeMin, sizeMax, opacityMin, opacityMax]);

  useFrame((_, delta) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value += delta;
    }
  });

  return (
    <points geometry={geo}>
      <shaderMaterial
        ref={matRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={{
          uTime: { value: 0 },
          uTex: { value: texture },
          uColor: { value: color },
        }}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/* ── main component ── */
export function DeepStarField() {
  const texture = useMemo(() => makeCircleTexture(), []);
  // warm white / slight gold tint
  const warmWhite = useMemo(() => new THREE.Color("#fff8ee"), []);
  const gold = useMemo(() => new THREE.Color("#ffe8c0"), []);

  return (
    <group>
      {/* Far — cosmic dust */}
      <StarLayer
        count={6000} rMin={80} rMax={180}
        sizeMin={0.25} sizeMax={0.6}
        opacityMin={0.3} opacityMax={0.6}
        color={warmWhite} texture={texture}
      />
      {/* Mid */}
      <StarLayer
        count={2000} rMin={30} rMax={80}
        sizeMin={0.4} sizeMax={1.0}
        opacityMin={0.4} opacityMax={0.75}
        color={warmWhite} texture={texture}
      />
      {/* Near — bright individual stars */}
      <StarLayer
        count={200} rMin={15} rMax={35}
        sizeMin={0.7} sizeMax={1.5}
        opacityMin={0.7} opacityMax={1.0}
        color={gold} texture={texture}
      />
    </group>
  );
}
