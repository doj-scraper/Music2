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
  Group,
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
  const heartGroupRef = useRef<Mesh | null>(null);
  const innerHeartRef = useRef<Mesh | null>(null);
  const particlesRef = useRef<Points | null>(null);
  const lightRef = useRef<PointLight | null>(null);
  const orbitingParticlesRef = useRef<Group | null>(null);

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
    const bloomPass = new UnrealBloomPass(
      new Vector2(width, height),
      1.6,
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

    const innerGeo = new ExtrudeGeometry(shape, {
      depth: 3,
      bevelEnabled: true,
      bevelThickness: 0.5,
      bevelSize: 0.5,
      bevelSegments: 3,
    });
    innerGeo.center();

    // ───────────────── MATERIALS ─────────────────
    const coreMat = new MeshBasicMaterial({
      color: 0xff88aa,
      wireframe: true,
      transparent: true,
      opacity: 0.5,
      blending: AdditiveBlending
    });

    // ───────────────── MESHES (WIREFRAME HEART - FLIPPED) ─────────────────
    const innerHeart = new Mesh(innerGeo, coreMat);
    innerHeart.position.y = -35;
    innerHeart.scale.setScalar(0.8);
    // FLIP THE HEART: Rotate 180 degrees on X-axis
    innerHeart.rotation.x = Math.PI;

    scene.add(innerHeart);
    
    heartGroupRef.current = innerHeart; 
    innerHeartRef.current = innerHeart;

    // ───────────────── BACKGROUND PARTICLES (BRIGHTER CANDY COLORS) ─────────────────
    const count = 1000;
    const positions = new Float32Array(count * 3);
    const colors =​​​​​​​​​​​​​​​​
