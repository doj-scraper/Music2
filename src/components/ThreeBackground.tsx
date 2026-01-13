import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  FogExp2,
  ExtrudeGeometry,
  Mesh,
  BufferGeometry,
  BufferAttribute,
  PointsMaterial,
  Points,
  PointLight,
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
  // Ref to track playing state without re-rendering scene
  const isPlayingRef = useRef(isPlaying);
  
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const sceneRef = useRef<Scene | null>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const cameraRef = useRef<PerspectiveCamera | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);

  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataRef = useRef<Uint8Array | null>(null);
  const rafRef = useRef<number | null>(null);
  const pausedRef = useRef(false);

  // Objects
  // heartGroupRef will now point to the wireframe mesh for general rotation/scale
  const heartGroupRef = useRef<Mesh | null>(null);
  // innerHeartRef will also point to the wireframe mesh for specific opacity animation
  const innerHeartRef = useRef<Mesh | null>(null);
  const particlesRef = useRef<Points | null>(null);
  const lightRef = useRef<PointLight | null>(null);

  // Smooth Animation Values
  const currentBassRef = useRef(0);
  const currentTrebleRef = useRef(0);

  const [ready, setReady] = useState(false);
  const [isWebGLSupported, setIsWebGLSupported] = useState(true);

  // ── AUDIO SETUP ──
  const connectAudio = useCallback(async () => {
    if (!audioRef.current || analyserRef.current) return;

    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const src = ctx.createMediaElementSource(audioRef.current);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.8;

      src.connect(analyser);
      analyser.connect(ctx.destination);

      analyserRef.current = analyser;
      dataRef.current = new Uint8Array(analyser.frequencyBinCount);
    } catch (err) {
      console.error('Failed to initialize audio context:', err);
    }
  }, [audioRef]);

  // ─────────────────────────────────────────────────────────────
  // SCENE INIT
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) {
        setIsWebGLSupported(false);
        return;
      }
    } catch (err) {
      setIsWebGLSupported(false);
      return;
    }

    const { width, height } = containerRef.current.getBoundingClientRect();
    if (width === 0 || height === 0) return;

    // 1. Setup Scene
    const scene = new Scene();
    scene.fog = new FogExp2(0x020202, 0.002);
    sceneRef.current = scene;

    const camera = new PerspectiveCamera(60, width / height, 1, 1000);
    camera.position.z = 110;
    cameraRef.current = camera;

    // 2. Renderer Tuning
    const renderer = new WebGLRenderer({
      alpha: true,
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.setClearAlpha(0);
    renderer.outputColorSpace = SRGBColorSpace;

    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.inset = '0';
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // ───────────────── POST PROCESSING ─────────────────
    const renderScene = new RenderPass(scene, camera);
    // Increased bloom strength slightly since the main object is removed
    const bloomPass = new UnrealBloomPass(
      new Vector2(width, height),
      1.6, // Strength
      0.32,
      0.1
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

    // Removed outer geometry creation (geo)

    const innerGeo = new ExtrudeGeometry(shape, {
      depth: 3,
      bevelEnabled: true,
      bevelThickness: 0.5,
      bevelSize: 0.5,
      bevelSegments: 3,
    });
    innerGeo.center();

    // ───────────────── MATERIALS ─────────────────
    // Removed crystalMat (red material)

    const coreMat = new MeshBasicMaterial({
      color: 0xff88aa,
      wireframe: true,
      transparent: true,
      opacity: 0.5,
      blending: AdditiveBlending
    });

    // ───────────────── MESHES (WIREFRAME ONLY) ─────────────────
    // Removed the outer 'heart' mesh creation

    const innerHeart = new Mesh(innerGeo, coreMat);
    // Position it lower, similar to where the parent object was
    innerHeart.position.y = -35; 
    innerHeart.scale.setScalar(0.8); // Slightly larger scale for the standalone wireframe

    // Add directly to scene instead of attaching to parent
    scene.add(innerHeart);
    
    // Point refs to this single mesh so animations apply to it
    heartGroupRef.current = innerHeart; 
    innerHeartRef.current = innerHeart;

    // ───────────────── PARTICLES (Keep Pink/Blue) ─────────────────
    const count = 1000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3); 

    const colorA = new Color(0xff0077); // Hot Pink
    const colorB = new Color(0x0099ff); // Cyan Blue
    const tempColor = new Color();

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 300;
      positions[i3 + 1] = (Math.random() - 0.5) * 200;
      positions[i3 + 2] = (Math.random() - 0.5) * 200;

      const mixed = Math.random();
      tempColor.lerpColors(colorA, colorB, mixed);
      colors[i3] = tempColor.r;
      colors[i3 + 1] = tempColor.g;
      colors[i3 + 2] = tempColor.b;
    }
    
    const pGeo = new BufferGeometry();
    pGeo.setAttribute('position', new BufferAttribute(positions, 3));
    pGeo.setAttribute('color', new BufferAttribute(colors, 3)); 

    const pMat = new PointsMaterial({
      vertexColors: true, 
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
      if (width === 0 || height === 0) return;
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

      // Use Ref here instead of the raw prop
      if (isPlayingRef.current && analyserRef.current && dataRef.current) {
        analyserRef.current.getByteFrequencyData(dataRef.current);
        rawBass = dataRef.current.slice(0, 10).reduce((a, b) => a + b, 0) / (10 * 255);
        rawTreble = dataRef.current.slice(40, 100).reduce((a, b) => a + b, 0) / (60 * 255);
      }

      // Smooth Lerping
      currentBassRef.current = MathUtils.lerp(currentBassRef.current, rawBass, 0.1);
      currentTrebleRef.current = MathUtils.lerp(currentTrebleRef.current, rawTreble, 0.05);

      const smoothBass = currentBassRef.current;
      const smoothTreble = currentTrebleRef.current;

      // Animations
      // heartGroupRef now points to the wireframe mesh, applying general rotation/scale
      if (heartGroupRef.current) {
        heartGroupRef.current.rotation.y = Math.sin(t * 0.5) * 0.15;
        heartGroupRef.current.rotation.z = Math.sin(t * 0.2) * 0.05;
        // Adjust base scale since it's alone now
        const scale = 0.8 + smoothBass * 0.3;
        heartGroupRef.current.scale.setScalar(scale);
      }
      // innerHeartRef also points to the wireframe mesh, applying opacity pulse
      if (innerHeartRef.current) {
         // Optional: extra rotation on itself if desired, currently commented out as heartGroupRef handles rotation
         // innerHeartRef.current.rotation.y = t * 0.5;
        (innerHeartRef.current.material as MeshBasicMaterial).opacity = 0.3 + smoothBass * 0.7;
      }
      if (lightRef.current) {
        lightRef.current.position.x = Math.sin(t * 0.5) * 60;
        lightRef.current.position.z = Math.cos(t * 0.5) * 60 + 20;
      }
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
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      
      renderer.dispose();
      composer.dispose();
      // removed geo.dispose()
      innerGeo.dispose();
      // removed crystalMat.dispose()
      coreMat.dispose();
      pGeo.dispose();
      
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
    
  }, [containerRef, intensity]); 

  // Audio Event Listener
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.addEventListener('play', connectAudio);
    return () => a.removeEventListener('play', connectAudio);
  }, [audioRef, connectAudio]);

  return { ready, isWebGLSupported };
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
  const { ready, isWebGLSupported } = useThreeVisualizer({ audioRef, isPlaying, containerRef: ref, intensity });

  return (
    <div
      ref={ref}
      className="absolute inset-0"
      style={{
        pointerEvents: 'none',
        opacity: ready && isWebGLSupported ? 1 : 0,
        transition: 'opacity 1000ms ease',
        zIndex: 0,
      }}
    >
      {!isWebGLSupported && (
        <div className="absolute inset-0 flex items-center justify-center bg-black text-white">
          Your browser does not support WebGL. Try Chrome or Safari.
        </div>
      )}
    </div>
  );
};

export default ThreeBackground;
