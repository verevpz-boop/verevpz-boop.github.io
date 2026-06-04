"use client";
import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

function EarthTextured({ radius }: { radius: number }) {
  const groupRef = useRef<THREE.Group>(null!);
  const texture = useTexture("/textures/earth-night.jpg");

  useFrame((_, delta) => {
    groupRef.current.rotation.y += delta * ((2 * Math.PI) / 30);
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <sphereGeometry args={[radius, 64, 64]} />
        <meshStandardMaterial
          map={texture}
          emissiveMap={texture}
          emissive="#ffffff"
          emissiveIntensity={0.6}
          roughness={0.88}
          metalness={0.05}
        />
      </mesh>
      {/* Inner atmosphere glow */}
      <mesh>
        <sphereGeometry args={[radius * 1.025, 64, 64]} />
        <meshBasicMaterial
          color="#4488ff"
          transparent
          opacity={0.12}
          side={THREE.BackSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {/* Outer atmosphere haze */}
      <mesh>
        <sphereGeometry args={[radius * 1.055, 48, 48]} />
        <meshBasicMaterial
          color="#3366cc"
          transparent
          opacity={0.06}
          side={THREE.BackSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

function EarthPlain({ radius }: { radius: number }) {
  const groupRef = useRef<THREE.Group>(null!);

  useFrame((_, delta) => {
    groupRef.current.rotation.y += delta * ((2 * Math.PI) / 30);
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <sphereGeometry args={[radius, 64, 64]} />
        <meshStandardMaterial
          color="#030c20"
          emissive="#0d2050"
          emissiveIntensity={0.35}
          roughness={0.88}
          metalness={0.05}
        />
      </mesh>
      {/* Inner atmosphere glow */}
      <mesh>
        <sphereGeometry args={[radius * 1.025, 64, 64]} />
        <meshBasicMaterial
          color="#4488ff"
          transparent
          opacity={0.12}
          side={THREE.BackSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {/* Outer atmosphere haze */}
      <mesh>
        <sphereGeometry args={[radius * 1.055, 48, 48]} />
        <meshBasicMaterial
          color="#3366cc"
          transparent
          opacity={0.06}
          side={THREE.BackSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

class EarthErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

export function Earth({ radius = 3 }: { radius?: number }) {
  return (
    <EarthErrorBoundary fallback={<EarthPlain radius={radius} />}>
      <React.Suspense fallback={<EarthPlain radius={radius} />}>
        <EarthTextured radius={radius} />
      </React.Suspense>
    </EarthErrorBoundary>
  );
}
