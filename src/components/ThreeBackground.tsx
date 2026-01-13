import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  Fog,
  ExtrudeGeometry,
  MeshStandardMaterial,
  Mesh,
  Group,
  Float32Array,
  BufferGeometry,
  BufferAttribute,
  PointsMaterial,
  Points,
  PointLight,
  AmbientLight,
  AdditiveBlending,
  Color,
} from 'three';

// ─────────────────────────────────────────────────────────────
// AUDIO VISUALIZER HOOK
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
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataRef = useRef<Uint8Array | null>(null);
  const rafRef = useRef<number | null>(null);
  const pausedRef = useRef(false);

  const heartRef = useRef<Mesh | null>(null);
  const particlesRef = useRef<Points | null>(null);
  const lightRef = useRef<PointLight | null>(null);

  const [ready, setReady] = useState(false);

  // ── AUDIO ──
  const connectAudio = useCallback(async () => {
    if (!audioRef.current || analyserRef.current) return;

    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === 'suspended') await ctx.resume();

    const src = ctx.createMediaElementSource(audioRef.current);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;

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

    const scene = new Scene();
    scene.fog = new Fog(0x050507, 60, 180);
    sceneRef.current = scene;

    const camera = new PerspectiveCamera(65, 1, 1, 500);
    camera.position.z = 90;
    cameraRef.current = camera;

    const renderer = new WebGLRenderer({
      alpha: true,
      antialias: false,
      powerPreference: 'low-power',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);

    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.inset = '0';

    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // ───────────────── HEART ─────────────────
    const shape = new (require('three').Shape)();
    shape.moveTo(5, 5);
    shape.bezierCurveTo(5, 5, 4, 0, 0, 0);
    shape.bezierCurveTo(-6, 0, -6, 7, -6, 7);
    shape.bezierCurveTo(-6, 11, -3, 15.4, 5, 19);
    shape.bezierCurveTo(12, 15.4, 16, 11, 16, 7);
    shape.bezierCurveTo(16, 7, 16, 0, 10, 0);
    shape.bezierCurveTo(7, 0, 5, 5, 5, 5);

    const geo = new ExtrudeGeometry(shape, {
      depth: 4,
      bevelEnabled: true,
      bevelThickness: 0.6,
      bevelSize: 0.5,
      bevelSegments: 4,
    });
    geo.center();

    const mat = new MeshStandardMaterial({
      color: new Color(0x7a0f1b),
      emissive: new Color(0x3a0509),
      emissiveIntensity: 1.2,
      metalness: 0.15,
      roughness: 0.65,
      transparent: true,
      opacity: 0.85,
    });

    const heart = new Mesh(geo, mat);
    heart.rotation.z = Math.PI;
    heart.position.y = -10;

    scene.add(heart);
    heartRef.current = heart;

    // ───────────────── PARTICLES (STATIC HAZE) ─────────────────
    const count = Math.floor(900 * intensity);
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 220;
      positions[i3 + 1] = (Math.random() - 0.5) * 160;
      positions[i3 + 2] = (Math.random() - 0.5) * 140;
    }

    const pGeo = new BufferGeometry();
    pGeo.setAttribute('position', new BufferAttribute(positions, 3));

    const pMat = new PointsMaterial({
      color: 0xff2b6a,
      size: 1.1,
      transparent: true,
      opacity: 0.35,
      blending: AdditiveBlending,
      depthWrite: false,
    });

    const particles = new Points(pGeo, pMat);
    scene.add(particles);
    particlesRef.current = particles;

    // ───────────────── LIGHTING ─────────────────
    const key = new PointLight(0xff3b6f, 2.2, 200);
    key.position.set(40, 30, 60);
    scene.add(key);
    lightRef.current = key;

    scene.add(new AmbientLight(0x22080f, 0.6));

    // ───────────────── RESIZE ─────────────────
    const resize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const { width, height } = containerRef.current.getBoundingClientRect();
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    resize();
    window.addEventListener('resize', resize);

    // ───────────────── ANIMATE ─────────────────
    const animate = () => {
      if (pausedRef.current) return;
      rafRef.current = requestAnimationFrame(animate);

      const t = performance.now() * 0.0004;
      let bass = 0, treble = 0;

      if (isPlaying && analyserRef.current && dataRef.current) {
        analyserRef.current.getByteFrequencyData(dataRef.current);
        bass =
          dataRef.current.slice(0, 12).reduce((a, b) => a + b, 0) / (12 * 255);
        treble =
          dataRef.current.slice(90, 128).reduce((a, b) => a + b, 0) / (38 * 255);
      }

      // Heart: pulse, glow, slow rotation
      if (heartRef.current) {
        const s = 1.4 + bass * 0.35;
        heartRef.current.scale.setScalar(s);
        heartRef.current.rotation.y = Math.sin(t * 0.6) * 0.25;
        (heartRef.current.material as MeshStandardMaterial).emissiveIntensity =
          1.1 + bass * 1.8;
      }

      // Particles: static shimmer
      if (particlesRef.current) {
        particlesRef.current.rotation.y = t * 0.06;
        (particlesRef.current.material as PointsMaterial).opacity =
          0.25 + treble * 0.45;
      }

      // Light orbit
      if (lightRef.current) {
        lightRef.current.position.x = Math.sin(t) * 50;
        lightRef.current.position.z = Math.cos(t) * 50;
      }

      renderer.render(scene, camera);
    };

    animate();
    setReady(true);

    return () => {
      pausedRef.current = true;
      cancelAnimationFrame(rafRef.current!);
      window.removeEventListener('resize', resize);
      renderer.dispose();
      geo.dispose();
      pGeo.dispose();
      mat.dispose();
      pMat.dispose();
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
        transition: 'opacity 600ms ease',
      }}
    />
  );
};

export default ThreeBackground;
