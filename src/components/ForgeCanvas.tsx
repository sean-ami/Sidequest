import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useStation } from "../lib/station";
import { GEM } from "./GemMark";

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

    vec3 navy = vec3(0.043, 0.055, 0.086);
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

// Brilliant cut matching the lockup's profile: table 0.6× the girdle, crown 0.31, pavilion 0.97 (of girdle width).
function gemGeometry(sides = 8) {
  const crown = 0.44, pavilion = 1.36, table = 0.6;
  const shades = [GEM.light, GEM.accent, GEM.mid, GEM.dark].map((c) => new THREE.Color(c));
  const [light, accent, mid, dark] = shades;
  const pos: number[] = [];
  const col: number[] = [];
  const ring = (r: number, y: number, i: number, off = 0) => {
    const a = ((i + off) / sides) * Math.PI * 2;
    return [Math.cos(a) * r, y, Math.sin(a) * r];
  };
  const tri = (a: number[], b: number[], c: number[], color: THREE.Color) => {
    pos.push(...a, ...b, ...c);
    for (let k = 0; k < 3; k++) col.push(color.r, color.g, color.b);
  };
  for (let i = 0; i < sides; i++) {
    const t0 = ring(table, crown, i), t1 = ring(table, crown, i + 1);
    const g0 = ring(1, 0, i), g1 = ring(1, 0, i + 1);
    tri([0, crown, 0], t1, t0, accent);
    const c = i % 2 ? light : accent;
    tri(t0, t1, g1, c);
    tri(t0, g1, g0, c);
    tri(g0, g1, [0, -pavilion, 0], i % 2 ? dark : mid);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  g.translate(0, 0.42, 0);
  return g;
}

function sparkleGeometry(r: number) {
  // the lockup sparkle: four points joined by curves pinched toward the centre
  const s = new THREE.Shape();
  const k = r * 0.09;
  s.moveTo(0, r);
  s.quadraticCurveTo(k, k, r, 0);
  s.quadraticCurveTo(k, -k, 0, -r);
  s.quadraticCurveTo(-k, -k, -r, 0);
  s.quadraticCurveTo(-k, k, 0, r);
  return new THREE.ShapeGeometry(s, 12);
}

function Diamond() {
  const gem = useRef<THREE.Group>(null);
  const sparkle = useRef<THREE.Mesh>(null);
  const small = useRef<THREE.Mesh>(null);
  const { viewport } = useThree();
  const wide = viewport.aspect > 1.1;
  const geo = useMemo(() => gemGeometry(), []);
  const edges = useMemo(() => new THREE.EdgesGeometry(geo, 1), [geo]);
  const star = useMemo(() => sparkleGeometry(0.3), []);
  const starSmall = useMemo(() => sparkleGeometry(0.11), []);

  useFrame((state, dt) => {
    const g = gem.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    g.rotation.y += dt * 0.4;
    g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, 0.28 - state.pointer.y * 0.25, 0.05);
    g.rotation.z = THREE.MathUtils.lerp(g.rotation.z, -state.pointer.x * 0.15, 0.05);
    g.position.y = Math.sin(t * 0.8) * 0.07;
    if (sparkle.current) sparkle.current.scale.setScalar(0.85 + Math.sin(t * 2.2) * 0.2);
    if (small.current) small.current.scale.setScalar(0.8 + Math.sin(t * 3.1 + 1.5) * 0.3);
  });

  return (
    <group position={wide ? [viewport.width * 0.24, 0.05, 0] : [0, viewport.height * 0.2, 0]} scale={wide ? 0.8 : 0.55}>
      <group ref={gem}>
        <mesh geometry={geo}>
          <meshStandardMaterial vertexColors flatShading metalness={0.15} roughness={0.32} emissive={GEM.accent} emissiveIntensity={0.12} />
        </mesh>
        <lineSegments geometry={edges} scale={1.004}>
          <lineBasicMaterial color="#ffffff" />
        </lineSegments>
      </group>
      <mesh ref={sparkle} geometry={star} position={[0.86, 0.98, 0.6]}>
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh ref={small} geometry={starSmall} position={[1.18, 0.4, 0.6]}>
        <meshBasicMaterial color={GEM.teal} />
      </mesh>
    </group>
  );
}

export default function ForgeCanvas() {
  return (
    <Canvas className="forge-canvas" dpr={[1, 1.75]} camera={{ position: [0, 0, 5], fov: 40 }} gl={{ antialias: true, powerPreference: "high-performance" }}>
      <ambientLight intensity={0.7} />
      <directionalLight position={[2, 4, 5]} intensity={1.6} />
      <pointLight position={[3, 3, 4]} intensity={40} color="#FF3E8A" />
      <pointLight position={[-3, -2, 3]} intensity={30} color="#3DD6C8" />
      <Backdrop />
      <Diamond />
    </Canvas>
  );
}
