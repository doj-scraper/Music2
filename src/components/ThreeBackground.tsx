import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  FogExp2,
  Mesh,
  BufferGeometry,
  BufferAttribute,
  PointsMaterial,
  Points,
  PointLight,
  AdditiveBlending,
  Color,
  Vector2,
  Vector3, // ✅ ADDED THIS
  MathUtils,
  MeshBasicMaterial,
  SRGBColorSpace,
  ShaderMaterial,
  Clock,
  NoToneMapping,
} from 'three';

// POST PROCESSING IMPORTS
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

// ─────────────────────────────────────────────────────────────
// SHADERS
// ─────────────────────────────────────────────────────────────

const obsessionVertexShader = `
precision mediump float;
uniform float uTime;
uniform float uAudioBass;
uniform vec3 uSourcePosition;
uniform vec3 uTargetPosition;
attribute float aPhase;
attribute vec3 aOffset;
varying float vDistToTarget;

void main() {
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);
    float t = mod(aPhase + uTime * 0.5, 1.0);
    vec3 curvePos = mix(uSourcePosition, uTargetPosition, t);
    
    float angle = t * 10.0 + uTime * 2.0;
    float spiralX = cos(angle) * 10.0 * (1.0 + uAudioBass);
    float spiralY = sin(angle) * 5.0 * (1.0 + uAudioBass);
    
    modelPosition.xyz = curvePos + vec3(spiralX, spiralY, 0.0) + aOffset;
    modelPosition.y += sin(uTime * 0.5 + aPhase * 6.28) * 2.0;
    
    vec4 viewPosition = viewMatrix * modelPosition;
    gl_Position = projectionMatrix * viewPosition;
    vDistToTarget = distance(modelPosition.xyz, uTargetPosition);
    
    gl_PointSize = 3.0 * (200.0 / -viewPosition.z);
}
`;

const obsessionFragmentShader = `
precision mediump float;
uniform vec3 uColor;
varying float vDistToTarget;

void main() {
    float strength = 1.0 - distance(gl_PointCoord, vec2(0.5));
    strength = pow(strength, 3.0);
    gl_FragColor = vec4(uColor, strength * 0.8);
}
`;

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
interface Props {
  audioRef: React.RefObject<HTMLAudioElement>;
  isPlaying: boolean;
  containerRef: React.RefObject<HTMLDivElement>;
  intensity?: number;
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

const createObsessionParticles = (count: number, sourcePos: [number, number, number], targetPos: [number, number, number]) => {
  const positions = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const offsets = new Float32Array(count * 3);
  
  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const t = i / count;
    positions[i3] = sourcePos[0] + (targetPos[0] - sourcePos[0]) * t;
    positions[i3 + 1] = sourcePos[1] + (targetPos[1] - sourcePos[1]) * t;
    positions[i3 + 2] = sourcePos[2] + (targetPos[2] - sourcePos[2]) * t;
    
    phases[i] = Math.random();
    offsets[i3] = (Math.random() - 0.5) * 20;
    offsets[i3 + 1] = (Math.random() - 0.5) * 20;
    offsets[i3 + 2] = (Math.random() - 0.5) * 20;
  }
  
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('aPhase', new BufferAttribute(phases, 1));
  geometry.setAttribute('aOffset', new BufferAttribute(offsets, 3));
  
  const material = new ShaderMaterial({
    vertexShader: obsessionVertexShader,
    fragmentShader: obsessionFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uAudioBass: { value: 0 },
      uSourcePosition: { value: new Vector3(...sourcePos) }, // ✅ Now works
      uTargetPosition: { value: new Vector3(...targetPos) }, // ✅ Now works
      uColor: { value: new Color(0xff1493) },
    },
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    side: 2,
  });
  
  const points = new Points(geometry, material);
  return { geometry, material, points };
};

// ─────────────────────────────────────────────────────────────
// MAIN HOOK
// ─────────────────────────────────────────────────────────────
const useObsessionScene = ({ audioRef, isPlaying, containerRef, intensity = 1 }: Props) => {
  const sceneRef = useRef<Scene | null>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const cameraRef = useRef<PerspectiveCamera | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const clockRef = useRef(new Clock());
  const rafRef = useRef<number | null>(null);
  const pausedRef = useRef(false);
  
  const particlesRef = useRef<Points | null>(null);
  const particlesMatRef = useRef<ShaderMaterial | null>(null);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    
    try {
      const { width, height } = containerRef.current.getBoundingClientRect();
      if (width === 0 || height === 0) return;

      const scene = new Scene();
      scene.fog = new FogExp2(0x050508, 0.008);
      sceneRef.current = scene;

      const camera = new PerspectiveCamera(60, width / height, 0.1, 1000);
      camera.position.set(0, 0, 70);
      cameraRef.current = camera;

      const renderer = new WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.setSize(width, height, false);
      renderer.setClearColor(0x050508, 0);
      renderer.toneMapping = NoToneMapping;
      renderer.outputColorSpace = SRGBColorSpace;
      renderer.domElement.style.position = 'absolute';
      renderer.domElement.style.inset = '0';
      containerRef.current.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // Post-processing
      const renderScene = new RenderPass(scene, camera);
      const bloomPass = new UnrealBloomPass(new Vector2(width, height), 1.8, 0.4, 0.15);
      const composer = new EffectComposer(renderer);
      composer.setSize(width, height);
      composer.addPass(renderScene);
      composer.addPass(bloomPass);
      composerRef.current = composer;

      // Scene objects
      const { points, material } = createObsessionParticles(500, [-20, 0, 0], [20, 0, 0]);
      scene.add(points);
      particlesRef.current = points;
      particlesMatRef.current = material;

      const keyLight = new PointLight(0xff1493, 2, 200);
      keyLight.position.set(-30, 10, 30);
      scene.add(keyLight);

      // Resize
      const handleResize = () => {
        if (!containerRef.current || !rendererRef.current || !cameraRef.current || !composerRef.current) return;
        const { width, height } = containerRef.current.getBoundingClientRect();
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
        composer.setSize(width, height);
      };
      handleResize();
      window.addEventListener('resize', handleResize);

      // Animation
      const animate = () => {
        if (pausedRef.current) return;
        rafRef.current = requestAnimationFrame(animate);

        const elapsedTime = clockRef.current.getElapsedTime();
        
        if (particlesMatRef.current) {
          particlesMatRef.current.uniforms.uTime.value = elapsedTime;
          // Note: uAudioBass is 0 here as audio logic was stripped. 
          // If you want reactivity, you need to add the AnalyserNode logic back.
        }
        if (particlesRef.current) {
          particlesRef.current.rotation.y = elapsedTime * 0.02;
        }

        composer.render();
        setReady(true);
      };
      animate();

      return () => {
        pausedRef.current = true;
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        window.removeEventListener('resize', handleResize);
        particlesRef.current?.geometry.dispose();
        particlesMatRef.current?.dispose();
        composer.dispose();
        renderer.dispose();
        if (containerRef.current && renderer.domElement) {
          containerRef.current.removeChild(renderer.domElement);
        }
      };
    } catch (err) {
      console.error('Scene init failed:', err);
      setError('Initialization failed');
    }
  }, [containerRef, intensity]);

  return { ready, error };
};

const ThreeBackground = ({ audioRef, isPlaying, intensity = 1 }: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const { ready, error } = useObsessionScene({
    audioRef,
    isPlaying,
    containerRef: ref,
    intensity,
  });

  return (
    <div
      ref={ref}
      className="absolute inset-0"
      style={{
        pointerEvents: 'none',
        opacity: ready ? 1 : 0,
        transition: 'opacity 1000ms ease',
        zIndex: 0,
      }}
    >
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black text-red-400 text-sm p-4">
          {error}
        </div>
      )}
    </div>
  );
};

export default ThreeBackground;
