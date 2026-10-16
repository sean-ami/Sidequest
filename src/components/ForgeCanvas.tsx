import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useStation } from "../lib/station";

const vert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// Navy ground, drifting nebula tinted by the tuned station, and embers rising from the forge below.
const frag = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec2 uRes;
  uniform vec2 uPointer;
  uniform vec3 uA;
  uniform vec3 uB;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 11.7; a *= 0.5; }
    return v;
  }

  void main() {
    vec2 uv = vUv;
    vec2 p = (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
    p += uPointer * 0.04;
    float t = uTime * 0.04;

    vec2 q = vec2(fbm(p * 1.6 + t), fbm(p * 1.6 - t + 4.0));
    float n = fbm(p * 2.2 + q * 1.8 + vec2(0.0, -t * 2.0));

    vec3 navy = vec3(0.027, 0.047, 0.13);
    vec3 col = navy;
    col = mix(col, uA * 0.55, smoothstep(0.45, 0.95, n) * 0.85);
    col = mix(col, uB * 0.5, smoothstep(0.55, 1.0, q.x) * 0.55);

    // forge glow from below
    col += uA * 0.35 * pow(1.0 - uv.y, 3.0) * (0.7 + 0.3 * sin(uTime * 0.8));

    // embers: cells of rising sparks
    vec2 eg = vec2(p.x * 14.0, p.y * 14.0 - uTime * 0.9);
    vec2 cell = floor(eg);
    vec2 f = fract(eg) - 0.5;
    float h = hash(cell);
    vec2 off = vec2(hash(cell + 3.1) - 0.5, hash(cell + 7.3) - 0.5) * 0.6;
    float d = length(f - off + vec2(sin(uTime + h * 30.0) * 0.12, 0.0));
    float ember = step(0.86, h) * smoothstep(0.08, 0.0, d) * (1.0 - uv.y);
    col += mix(uA, vec3(1.0, 0.8, 0.6), 0.4) * ember * 1.6;

    // vignette
    col *= 1.0 - 0.55 * dot(uv - 0.5, uv - 0.5) * 2.2;
    gl_FragColor = vec4(col, 1.0);
  }
`;

function Backdrop() {
  const { current } = useStation();
  const target = useMemo(() => ({ a: new THREE.Color(), b: new THREE.Color() }), []);
  target.a.set(current.color);
  target.b.set(current.color2);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uRes: { value: new THREE.Vector2(1, 1) },
      uPointer: { value: new THREE.Vector2() },
      uA: { value: new THREE.Color(current.color) },
      uB: { value: new THREE.Color(current.color2) },
    }),
    [],
  );

  useFrame((state, dt) => {
    uniforms.uTime.value += dt;
    uniforms.uRes.value.set(state.size.width, state.size.height);
    uniforms.uPointer.value.lerp(state.pointer, 0.05);
    uniforms.uA.value.lerp(target.a, Math.min(1, dt * 2.5));
    uniforms.uB.value.lerp(target.b, Math.min(1, dt * 2.5));
  });

  return (
    <mesh frustumCulled={false} renderOrder={-1}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial vertexShader={vert} fragmentShader={frag} uniforms={uniforms} depthWrite={false} depthTest={false} />
    </mesh>
  );
}

function Diamond() {
  const group = useRef<THREE.Group>(null);
  const sparkle = useRef<THREE.Mesh>(null);
  const { viewport } = useThree();
  const wide = viewport.aspect > 1.1;
  const geo = useMemo(() => {
    const g = new THREE.OctahedronGeometry(1, 0);
    g.scale(0.78, 1.1, 0.78);
    return g;
  }, []);
  const edges = useMemo(() => new THREE.EdgesGeometry(geo), [geo]);
  const star = useMemo(() => {
    const s = new THREE.Shape();
    const pts = 4;
    for (let i = 0; i < pts * 2; i++) {
      const r = i % 2 === 0 ? 0.22 : 0.05;
      const a = (i / (pts * 2)) * Math.PI * 2;
      const fn = i === 0 ? "moveTo" : "lineTo";
      s[fn](Math.sin(a) * r, Math.cos(a) * r);
    }
    return new THREE.ShapeGeometry(s);
  }, []);

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    g.rotation.y += dt * 0.35;
    g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, -state.pointer.y * 0.35, 0.05);
    g.rotation.z = THREE.MathUtils.lerp(g.rotation.z, -state.pointer.x * 0.2, 0.05);
    g.position.y = Math.sin(state.clock.elapsedTime * 0.8) * 0.08;
    if (sparkle.current) {
      const s = 0.85 + Math.sin(state.clock.elapsedTime * 2.4) * 0.25;
      sparkle.current.scale.setScalar(s);
      sparkle.current.rotation.z += dt * 0.6;
    }
  });

  return (
    <group position={wide ? [viewport.width * 0.24, 0.05, 0] : [0, viewport.height * 0.2, 0]} scale={wide ? 1 : 0.55}>
      <group ref={group}>
        <mesh geometry={geo}>
          <meshStandardMaterial color="#14204F" emissive="#3DD6C8" emissiveIntensity={0.12} metalness={0.7} roughness={0.2} flatShading transparent opacity={0.8} />
        </mesh>
        <lineSegments geometry={edges}>
          <lineBasicMaterial color="#3DD6C8" />
        </lineSegments>
      </group>
      <mesh ref={sparkle} geometry={star} position={[0.7, 0.95, 0.4]}>
        <meshBasicMaterial color="#FF3E8A" />
      </mesh>
    </group>
  );
}

export default function ForgeCanvas() {
  return (
    <Canvas className="forge-canvas" dpr={[1, 1.75]} camera={{ position: [0, 0, 5], fov: 40 }} gl={{ antialias: true, powerPreference: "high-performance" }}>
      <ambientLight intensity={0.4} />
      <pointLight position={[3, 3, 4]} intensity={40} color="#FF3E8A" />
      <pointLight position={[-3, -2, 3]} intensity={30} color="#3DD6C8" />
      <Backdrop />
      <Diamond />
    </Canvas>
  );
}
