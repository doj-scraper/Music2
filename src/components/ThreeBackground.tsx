import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  FogExp2,
  ExtrudeGeometry,
  MeshPhysicalMaterial,
  Mesh,
  // Float32Array removed (native JS global)
  BufferGeometry,
  BufferAttribute,
  PointsMaterial,
  Points,
  PointLight,
  AmbientLight,
  AdditiveBlending,
  Color,
  Shape,
  Vector2,
  MathUtils,
  MeshBasicMaterial,
  SRGBColorSpace,
} from 'three';

// POST PROCESSING IMPORTS
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
interface Props {
  audioRef: React.RefObject<HTMLAudioElement>;
  isPlaying: boolean;
  containerRef: React.RefObject<HTMLDivElement>;
  intensity?: number;
}

const useThreeVisualizer = ({
  audioRef,
  isPlaying,
  containerRef,
  intensity = 1,
}: Props) => {
  const sceneRef = useRef<Scene | null>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const cameraRef = useRef<PerspectiveCamera | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataRef = useRef<Uint8Array | null>(null);
  const rafRef = useRef<number | null>(null);
  const pausedRef = useRef(false);

  // Objects
  const heartGroupRef = useRef<Mesh | null>(null);
  const innerHeartRef = useRef<Mesh | null>(null);
  const particlesRef = useRef<Points | null>(null);
  const lightRef = useRef<PointLight | null>(null);

  // Smooth Animation Values
  const currentBassRef = useRef(0);
  const currentTrebleRef = useRef(0);

  const [ready, setReady] = useState(false);

  // ── AUDIO SETUP ──
  const connectAudio = useCallback(async () => {
    if (!audioRef.current || analyserRef.current) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === 'suspended') await ctx.resume();

    const src = ctx.createMediaElementSource(audioRef.current);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.8;

    src.connect(analyser);
    analyser.connect(ctx.destination);

    analyserRef.current = analyser;
    dataRef.current = new Uint8Array(analyser.frequencyBinCount);
  }, [audioRef]);

  // ─────────────────────────────────────────────────────────────
  // SCENE INIT
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    // 1. Setup Scene
    const scene = new Scene();
    scene.fog = new FogExp2(0x020202, 0.002);
    sceneRef.current = scene;

    const camera = new PerspectiveCamera(60, 1, 1, 1000);
    camera.position.z = 110;
    cameraRef.current = camera;

    // 2. Renderer Tuning
    const renderer = new WebGLRenderer({
      alpha: true,
      antialias: false, 
      powerPreference: 'high-performance',
      stencil: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.setClearAlpha(0);
    
    // Color Space
    renderer.outputColorSpace = SRGBColorSpace; 

    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.inset = '0';
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // ───────────────── POST PROCESSING (TUNED BLOOM) ─────────────────
    const renderScene = new RenderPass(scene, camera);
    
    const bloomPass = new UnrealBloomPass(
      new Vector2(window.innerWidth, window.innerHeight),
      1.4,   // Strength
      0.32,  // Radius
      0.12   // Threshold
    );

    const composer = new EffectComposer(renderer);
    composer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    composer.addPass(renderScene);
    composer.addPass(bloomPass);
    composerRef.current = composer;

    // ───────────────── GEOMETRY CREATION ─────────────────
    const shape = new Shape();
    const x = 0, y = 0;
    shape.moveTo(x + 5, y + 5);
    shape.bezierCurveTo(x + 5, y + 5, x + 4, y, x, y);
    shape.bezierCurveTo(x - 6, y, x - 6, y + 7, x - 6, y + 7);
    shape.bezierCurveTo(x - 6, y + 11, x - 3, y + 15.4, x + 5, y + 19);
    shape.bezierCurveTo(x + 12, y + 15.4, x + 16, y + 11, x + 16, y + 7);
    shape.bezierCurveTo(x + 16, y + 7, x + 16, y, x + 10, y);
    shape.bezierCurveTo(x + 7, y, x + 5, y + 5, x + 5, y + 5);

    // Outer Geometry (The Ruby) - OPTIMIZED
    const geo = new ExtrudeGeometry(shape, {
      depth: 6,
      bevelEnabled: true,
      bevelThickness: 1,
      bevelSize: 1,
      bevelSegments: 8,
    });
    geo.center();

    // Inner Geometry (The Core) - OPTIMIZED
    const innerGeo = new ExtrudeGeometry(shape, {
      depth: 3,
      bevelEnabled: true,
      bevelThickness: 0.5,
      bevelSize: 0.5,
      bevelSegments: 3,
    });
    innerGeo.center();

    // ───────────────── MATERIALS ─────────────────
    
    // MATERIAL 1: The "Ruby" Outer Shell
    const crystalMat = new MeshPhysicalMaterial({
      color: 0xff002b,
      emissive: 0x500000,
      roughness: 0.1,
      metalness: 0.1,
      transmission: 0.9,
      thickness: 8.0,
      ior: 1.76,
      clearcoat: 1.0,
      clearcoatRoughness: 0.0,
      attenuationColor: new Color(0x8a0b1f),
      attenuationDistance: 20,
    });

    // MATERIAL 2: The "Energy" Inner Core
    const coreMat = new MeshBasicMaterial({
      color: 0xff88aa,
      wireframe: true,
      transparent: true,
      opacity: 0.5,
      blending: AdditiveBlending
    });

    // ───────────────── MESHES ─────────────────
    const heart = new Mesh(geo, crystalMat);
    heart.rotation.z = Math.PI;
    heart.position.y = -35;
    scene.add(heart);
    heartGroupRef.current = heart;

    const innerHeart = new Mesh(innerGeo, coreMat);
    innerHeart.rotation.z = Math.PI;
    innerHeart.position.z = 0;
    innerHeart.scale.setScalar(0.7);
    heart.add(innerHeart);
    innerHeartRef.current = innerHeart;

    // ───────────────── PARTICLES (OPTIMIZED) ─────────────────
    const count = 1000;
    // Float32Array is used here natively
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 300;
      positions[i3 + 1] = (Math.random() - 0.5) * 200;
      positions[i3 + 2] = (Math.random() - 0.5) * 200;
    }
    const pGeo = new BufferGeometry();
    pGeo.setAttribute('position', new BufferAttribute(positions, 3));
    const pMat = new PointsMaterial({
      color: 0xff4d6d,
      size: 0.75,
      transparent: true,
      opacity: 0.6,
      blending: AdditiveBlending,
      sizeAttenuation: true,
    });
    const particles = new Points(pGeo, pMat);
    scene.add(particles);
    particlesRef.current = particles;

    // ───────────────── LIGHTING ─────────────────
    const key = new PointLight(0xff0f3b, 1.5, 300);
    key.position.set(30, 20, 50);
    scene.add(key);
    lightRef.current = key;

    const rim = new PointLight(0x4444ff, 2.0, 300);
    rim.position.set(-50, 50, -20);
    scene.add(rim);

    const fill = new PointLight(0xaa00ff, 0.5, 300);
    fill.position.set(0, -50, 20);
    scene.add(fill);

    // ───────────────── RESIZE ─────────────────
    const resize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const { width, height } = containerRef.current.getBoundingClientRect();
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      composer.setSize(width, height);
    };
    resize();
    window.addEventListener('resize', resize);

    // ───────────────── ANIMATE ─────────────────
    const animate = () => {
      if (pausedRef.current) return;
      rafRef.current = requestAnimationFrame(animate);

      const t = performance.now() * 0.001;
      
      let rawBass = 0;
      let rawTreble = 0;

      if (isPlaying && analyserRef.current && dataRef.current) {
        analyserRef.current.getByteFrequencyData(dataRef.current);
        rawBass = dataRef.current.slice(0, 10).reduce((a, b) => a + b, 0) / (10 * 255);
        rawTreble = dataRef.current.slice(40, 100).reduce((a, b) => a + b, 0) / (60 * 255);
      }

      // Smooth Lerping
      currentBassRef.current = MathUtils.lerp(currentBassRef.current, rawBass, 0.1);
      currentTrebleRef.current = MathUtils.lerp(currentTrebleRef.current, rawTreble, 0.05);

      const smoothBass = currentBassRef.current;
      const smoothTreble = currentTrebleRef.current;

      // 1. Heart Animation
      if (heartGroupRef.current) {
        heartGroupRef.current.rotation.y = Math.sin(t * 0.5) * 0.15;
        heartGroupRef.current.rotation.z = Math.PI + Math.sin(t * 0.2) * 0.05;

        // Pulse scale
        const scale = 1.0 + smoothBass * 0.3;
        heartGroupRef.current.scale.setScalar(scale);
      }

      // 2. Inner Heart Animation
      if (innerHeartRef.current) {
        innerHeartRef.current.rotation.y = t * 0.5;
        (innerHeartRef.current.material as MeshBasicMaterial).opacity = 0.3 + smoothBass * 0.7;
      }

      // 3. Light Animation
      if (lightRef.current) {
        lightRef.current.position.x = Math.sin(t * 0.5) * 60;
        lightRef.current.position.z = Math.cos(t * 0.5) * 60 + 20;
      }

      // 4. Particles
      if (particlesRef.current) {
        particlesRef.current.rotation.y = -t * 0.05;
        (particlesRef.current.material as PointsMaterial).opacity = 0.2 + smoothTreble * 0.5;
      }

      composer.render();
    };

    animate();
    setReady(true);

    return () => {
      pausedRef.current = true;
      cancelAnimationFrame(rafRef.current!);
      window.removeEventListener('resize', resize);
      renderer.dispose();
      composer.dispose();
      geo.dispose();
      innerGeo.dispose();
      crystalMat.dispose();
      coreMat.dispose();
      pGeo.dispose();
      containerRef.current?.removeChild(renderer.domElement);
    };
  }, [containerRef, intensity, isPlaying, connectAudio]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.addEventListener('play', connectAudio);
    return () => a.removeEventListener('play', connectAudio);
  }, [audioRef, connectAudio]);

  return ready;
};

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────
const ThreeBackground = ({
  audioRef,
  isPlaying,
  intensity = 1,
}: {
  audioRef: React.RefObject<HTMLAudioElement>;
  isPlaying: boolean;
  intensity?: number;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const ready = useThreeVisualizer({ audioRef, isPlaying, containerRef: ref, intensity });

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
    />
  );
};

export default ThreeBackground;
