"use client";
import { useRef, useState, useMemo, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html, Line, useGLTF } from "@react-three/drei";
import * as THREE from "three";

interface SatelliteProps {
  name: string;
  color: string;
  orbitRadius: number;
  orbitRotation: [number, number, number]; // degrees [x, y, z]
  speed: number;           // rad/s
  initialAngle: number;    // rad
  href: string;
  description: string;
  videoSrc?: string;
  modelSrc?: string;
  modelInside?: string;
  navigate: (href: string) => void;
  onFlyTo: (pos: THREE.Vector3, href: string) => void;
}

function OrbitRing({ radius }: { radius: number }) {
  const points = useMemo(() => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= 80; i++) {
      const a = (i / 80) * Math.PI * 2;
      pts.push([Math.cos(a) * radius, 0, Math.sin(a) * radius]);
    }
    return pts;
  }, [radius]);

  return (
    <Line
      points={points}
      color="#ffffff"
      transparent
      opacity={0.08}
      lineWidth={0.6}
      dashed
      dashSize={0.18}
      gapSize={0.09}
    />
  );
}

function DroneModel({
  modelSrc,
  satRadius,
  hovered,
}: {
  modelSrc: string;
  satRadius: number;
  hovered: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null!);
  const { scene } = useGLTF(modelSrc);
  const cloned = useMemo(() => scene.clone(true), [scene]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const targetScale = hovered ? 1.15 : 1.0;
    groupRef.current.scale.setScalar(
      THREE.MathUtils.lerp(groupRef.current.scale.x, targetScale, 0.12),
    );
    if (!hovered) {
      groupRef.current.rotation.y += 0.005;
    }
  });

  // Normalize model size to roughly satRadius
  const fitScale = useMemo(() => {
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    return (satRadius * 2.4) / maxDim;
  }, [cloned, satRadius]);

  return (
    <group ref={groupRef}>
      <primitive object={cloned} scale={fitScale} dispose={null} />
    </group>
  );
}

function BrainInside({ src, satRadius, hovered }: { src: string; satRadius: number; hovered: boolean }) {
  const groupRef = useRef<THREE.Group>(null!);
  const { scene } = useGLTF(src);
  const cloned = useMemo(() => {
    const c = scene.clone(true);
    // Hyper3D-Rodin model ships with bright emissive PBR (the "glowing orange
    // circuit nodes") — that's what creates the halo / atmosphere. Kill it.
    c.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const m = child.material as THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[];
      const mats = Array.isArray(m) ? m : [m];
      mats.forEach((mat) => {
        // Kill emission (no glowing circuit-traces)
        if ("emissive" in mat) mat.emissive = new THREE.Color("#000000");
        if ("emissiveIntensity" in mat) mat.emissiveIntensity = 0;
        if ("emissiveMap" in mat) mat.emissiveMap = null;
        if ("toneMapped" in mat) mat.toneMapped = true;
        // Steel look — high metalness, low roughness, neutral cool color
        if ("color" in mat) mat.color = new THREE.Color("#b8bcc4");
        if ("map" in mat) mat.map = null; // drop the bronze albedo map from Hyper3D
        if ("metalness" in mat) mat.metalness = 0.95;
        if ("roughness" in mat) mat.roughness = 0.32;
        if ("metalnessMap" in mat) mat.metalnessMap = null;
        if ("roughnessMap" in mat) mat.roughnessMap = null;
        mat.needsUpdate = true;
      });
    });
    return c;
  }, [scene]);

  // Normalize size to fit inside sphere
  const fitScale = useMemo(() => {
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    return (satRadius * 1.55) / maxDim; // brain fills ~80% of sphere
  }, [cloned, satRadius]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y += delta * 0.6; // slow self-spin
  });

  return (
    <group ref={groupRef}>
      <primitive object={cloned} scale={fitScale} dispose={null} />
    </group>
  );
}

export function Satellite({
  name, color, orbitRadius, orbitRotation, speed, initialAngle,
  href, description, videoSrc, modelSrc, modelInside, navigate, onFlyTo,
}: SatelliteProps) {
  const satGroupRef = useRef<THREE.Group>(null!);
  const meshRef = useRef<THREE.Group>(null!);
  const htmlRef = useRef<HTMLDivElement>(null);
  const angle = useRef(initialAngle);
  const [hovered, setHovered] = useState(false);
  const { camera } = useThree();

  // Pre-allocated vectors — reused each frame, no GC pressure
  const worldPos = useRef(new THREE.Vector3());
  const camDir = useRef(new THREE.Vector3());
  const toEarth = useRef(new THREE.Vector3());
  const closest = useRef(new THREE.Vector3());
  const lastBehind = useRef(false); // cache to avoid redundant DOM writes

  const EARTH_RADIUS = 4.5;
  const rotRad = orbitRotation.map((d) => (d * Math.PI) / 180) as [number, number, number];

  // Video texture (optional — only for satellites with videoSrc)
  const videoEl = useMemo(() => {
    if (!videoSrc) return null;
    const v = document.createElement("video");
    v.src = videoSrc;
    v.crossOrigin = "anonymous";
    v.loop = true;
    v.muted = true;
    v.playsInline = true;
    v.autoplay = true;
    v.preload = "auto";
    v.load();
    v.play().catch(() => {});
    return v;
  }, [videoSrc, name]);

  const videoTexture = useMemo(() => {
    if (!videoEl) return null;
    const tex = new THREE.VideoTexture(videoEl);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }, [videoEl, name]);

  useEffect(() => {
    return () => {
      if (videoEl) videoEl.pause();
      if (videoTexture) videoTexture.dispose();
    };
  }, [videoEl, videoTexture]);

  useFrame((_, delta) => {
    // VideoTexture has built-in auto-update via requestVideoFrameCallback — no manual needsUpdate needed

    if (!hovered) angle.current += delta * speed;

    if (satGroupRef.current) {
      satGroupRef.current.position.set(
        Math.cos(angle.current) * orbitRadius,
        0,
        Math.sin(angle.current) * orbitRadius,
      );

      // Behind-Earth occlusion check — pure ref math, no setState
      satGroupRef.current.getWorldPosition(worldPos.current);
      camDir.current.copy(worldPos.current).sub(camera.position).normalize();
      toEarth.current.set(0, 0, 0).sub(camera.position);
      const proj = toEarth.current.dot(camDir.current);
      let behind = false;
      if (proj > 0) {
        closest.current.copy(camera.position).add(camDir.current.multiplyScalar(proj));
        const dist = closest.current.length();
        behind = dist < EARTH_RADIUS && worldPos.current.distanceTo(camera.position) > toEarth.current.length();
      }
      // Only mutate DOM when state actually changes (skip 60 redundant writes per second)
      if (behind !== lastBehind.current && htmlRef.current) {
        htmlRef.current.style.opacity = behind ? "0" : "1";
        htmlRef.current.style.pointerEvents = behind ? "none" : "auto";
        lastBehind.current = behind;
      }
    }

    if (meshRef.current) {
      const targetScale = hovered ? 1.3 : 1.0;
      meshRef.current.scale.setScalar(
        THREE.MathUtils.lerp(meshRef.current.scale.x, targetScale, 0.12),
      );
      // Self-rotation only if no inner model (otherwise inner model handles it)
      if (!modelInside) {
        meshRef.current.rotation.y += delta * 0.4;
      }
    }
  });

  const handleClick = (e: any) => {
    e.stopPropagation();
    if (satGroupRef.current) {
      const worldPos = new THREE.Vector3();
      satGroupRef.current.getWorldPosition(worldPos);
      onFlyTo(worldPos, href);
    } else {
      navigate(href);
    }
  };

  const satRadius = (orbitRadius / 20) * 1.35;

  return (
    <group rotation={rotRad}>
      <OrbitRing radius={orbitRadius} />

      {/* Satellite group — repositioned each frame */}
      <group ref={satGroupRef} position={[orbitRadius, 0, 0]}>
        {/* Core mesh — video texture, 3D model, or emissive sphere */}
        <group
          onPointerOver={(e) => {
            e.stopPropagation();
            setHovered(true);
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={(e) => {
            e.stopPropagation();
            setHovered(false);
            document.body.style.cursor = "default";
          }}
          onClick={handleClick}
        >
          {modelSrc ? (
            <DroneModel modelSrc={modelSrc} satRadius={satRadius} hovered={hovered} />
          ) : (
            <group ref={meshRef}>
              {modelInside ? (
                /* 3D brain model — pure, no shell, no halo */
                <BrainInside src={modelInside} satRadius={satRadius} hovered={hovered} />
              ) : (
                /* Solid sphere with video / emissive */
                <mesh>
                  <sphereGeometry args={[satRadius * 0.95, 24, 18]} />
                  {videoTexture ? (
                    <meshBasicMaterial map={videoTexture} toneMapped={false} />
                  ) : (
                    <meshStandardMaterial
                      color={color}
                      emissive={color}
                      emissiveIntensity={hovered ? 3.0 : 1.8}
                      roughness={0.4}
                      metalness={0.3}
                    />
                  )}
                </mesh>
              )}

              {/* Chrome rim — orbits the sphere on the equator */}
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[satRadius * 1.05, satRadius * 0.08, 8, 24]} />
                <meshStandardMaterial color="#d4d4dc" metalness={1} roughness={0.18} />
              </mesh>

              {/* Second perpendicular chrome rim — gives a 3D "gimbal" feel */}
              <mesh>
                <torusGeometry args={[satRadius * 1.05, satRadius * 0.05, 6, 20]} />
                <meshStandardMaterial color="#9a9aa3" metalness={1} roughness={0.25} />
              </mesh>
            </group>
          )}
        </group>

        {/* Golden glow halo for the drone on hover */}
        {modelSrc && hovered && (
          <mesh>
            <sphereGeometry args={[satRadius * 1.6, 24, 24]} />
            <meshBasicMaterial color={color} transparent opacity={0.12} />
          </mesh>
        )}

        {/* Glow halo — only for non-video, non-model satellites */}
        {!videoTexture && !modelSrc && (
          <mesh>
            <sphereGeometry args={[satRadius * 1.4, 16, 16]} />
            <meshStandardMaterial
              color={color}
              transparent
              opacity={hovered ? 0.18 : 0.07}
              roughness={1}
              metalness={0}
            />
          </mesh>
        )}

        {/* Name label — opacity flipped via ref in useFrame, no re-renders */}
        <Html
          center
          position={[0, satRadius * 2.8, 0]}
          zIndexRange={[100, 0]}
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          <div
            ref={htmlRef}
            style={{
                background: hovered ? "rgba(0,0,0,0.78)" : "rgba(0,0,0,0.45)",
                border: "1px solid transparent",
                borderImage: hovered
                  ? "linear-gradient(135deg, #f5f5f7 0%, #b8b8c0 35%, #6e6e76 55%, #d4d4dc 100%) 1"
                  : "linear-gradient(135deg, #d4d4dc 0%, #6e6e76 50%, #d4d4dc 100%) 1",
                borderRadius: "5px",
                padding: "2px 5px",
                fontFamily: "Inter, sans-serif",
                fontWeight: 700,
                fontSize: "8px",
                transform: hovered ? "scale(1.1)" : "scale(1)",
                whiteSpace: "nowrap",
                userSelect: "none",
                letterSpacing: hovered ? "0.25em" : "0.2em",
                boxShadow: hovered
                  ? `0 0 24px ${color}80, inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -1px 0 rgba(0,0,0,0.4)`
                  : "inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.3)",
                backdropFilter: "blur(4px)",
                textAlign: "center",
                transition: "opacity 0.3s cubic-bezier(0.32, 0.72, 0, 1), transform 0.3s cubic-bezier(0.32, 0.72, 0, 1), box-shadow 0.3s cubic-bezier(0.32, 0.72, 0, 1), backdrop-filter 0.3s",
              }}
            >
              <div
                style={{
                  background: "linear-gradient(180deg, #ffffff 0%, #d4d4dc 35%, #8a8a92 52%, #6e6e76 60%, #c8c8d0 80%, #f5f5f7 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  filter: hovered
                    ? `drop-shadow(0 0 6px ${color}cc) drop-shadow(0 1px 0 rgba(0,0,0,0.8))`
                    : "drop-shadow(0 1px 1px rgba(0,0,0,0.8))",
                }}
              >
                {name}
              </div>
              {hovered && (
                <div
                  style={{
                    fontSize: "5px",
                    color: "rgba(255,255,255,0.7)",
                    marginTop: "3px",
                    letterSpacing: "0.05em",
                    fontWeight: 400,
                    maxWidth: "95px",
                    textAlign: "center",
                  }}
                >
                  {description}
                </div>
              )}
            </div>
          </Html>
      </group>
    </group>
  );
}

useGLTF.preload("/models/ai-bot.glb");
useGLTF.preload("/models/brain.glb");
