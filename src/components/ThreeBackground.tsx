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
  MathUtils,
  MeshBasicMaterial,
  SRGBColorSpace,
  ShaderMaterial,
  Clock,
  Group,
  CapsuleGeometry,
  IcosahedronGeometry,
  TorusGeometry,
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

interface AudioData {
  bass: number;
  mid: number;
  treble: number;
  raw: Uint8Array | null;
}

// ─────────────────────────────────────────────────────────────
// SHADERS
// ─────────────────────────────────────────────────────────────

// Obsession Particles Shader - Swirling between two figures
const obsessionVertexShader = `
uniform float uTime;
uniform float uAudioBass;
uniform float uAudioMid;
uniform float uAudioTreble;
uniform float uIntensity;
uniform vec3 uSourcePosition;
uniform vec3 uTargetPosition;
attribute float aPhase;
attribute float aRadius;
attribute float aSpeed;
attribute vec3 aOffset;
varying float vDistToTarget;
varying float vPhase;
varying float vIntensity;

// Noise-like function for organic movement
float noise(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);
    
    // Calculate base position along curve between source and target
    float t = mod(aPhase + uTime * aSpeed * 0.5, 1.0);
    
    // Bezier-like curve from source to target
    vec3 curvePos = mix(
        uSourcePosition,
        uTargetPosition,
        t
    );
    
    // Add spiral/elliptical motion around the curve
    float angle = t * 10.0 + uTime * aSpeed * 2.0;
    float spiralRadius = aRadius * (1.0 + uAudioBass * 2.0);
    
    // Sedation effect: particles slow down and drift when bass is low
    float sedationFactor = 1.0 - uAudioMid * 0.5;
    float spiralX = cos(angle * sedationFactor) * spiralRadius;
    float spiralY = sin(angle * sedationFactor) * spiralRadius * 0.5;
    float spiralZ = sin(angle * 2.0) * spiralRadius * 0.3;
    
    // Obsession: tighten orbit around target when treble is high
    float obsessionFactor = 1.0 - uAudioTreble * 0.3 * t;
    modelPosition.x = curvePos.x + spiralX * obsessionFactor + aOffset.x;
    modelPosition.y = curvePos.y + spiralY * obsessionFactor + aOffset.y;
    modelPosition.z = curvePos.z + spiralZ * obsessionFactor + aOffset.z;
    
    // Breathing motion
    float breath = sin(uTime * 0.5 + aPhase * 6.28) * (2.0 + uAudioBass * 3.0);
    modelPosition.y += breath;
    
    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectedPosition = projectionMatrix * viewPosition;
    
    gl_Position = projectedPosition;
    
    // Size varies by audio and position
    float distToSource = distance(modelPosition.xyz, uSourcePosition);
    float distToTarget = distance(modelPosition.xyz, uTargetPosition);
    vDistToTarget = distToTarget;
    vPhase = aPhase;
    vIntensity = uIntensity;
    
    float audioSize = uAudioBass * 2.0 + uAudioTreble * 1.5;
    gl_PointSize = (2.0 + audioSize) * (1.0 + sin(uTime * 2.0 + aPhase) * 0.3);
    gl_PointSize *= (200.0 / -viewPosition.z);
}
`;

const obsessionFragmentShader = `
uniform float uTime;
uniform float uAudioBass;
uniform float uAudioTreble;
uniform vec3 uObsessedColor;
uniform vec3 uTargetColor;
varying float vDistToTarget;
varying float vPhase;
varying float vIntensity;

void main() {
    // Circular particle with soft edges
    float strength = distance(gl_PointCoord, vec2(0.5));
    strength = 1.0 - strength;
    strength = pow(strength, 2.0);
    
    // Color blend from obsessed (pink) to target (cyan) based on position
    float blendFactor = smoothstep(30.0, 0.0, vDistToTarget);
    blendFactor += uAudioBass * 0.3; // Bass pushes toward obsessed color
    blendFactor = clamp(blendFactor, 0.0, 1.0);
    
    vec3 color = mix(uTargetColor, uObsessedColor, blendFactor);
    
    // Sedation: desaturate and dim when audio is low
    float sedation = 0.5 + uAudioTreble * 0.5;
    color *= sedation;
    
    // Obsession pulse
    float pulse = 0.7 + sin(uTime * 3.0 + vPhase * 6.28) * 0.3 * uAudioBass;
    color *= pulse;
    
    // Distance fade for depth
    float distanceFade = smoothstep(100.0, 20.0, vDistToTarget);
    distanceFade = clamp(distanceFade, 0.3, 1.0);
    
    gl_FragColor = vec4(color, strength * distanceFade * 0.8);
}
`;

// Figure Glow Shader - Wireframe with pulse
const figureVertexShader = `
uniform float uTime;
uniform float uAudioBass;
uniform float uAudioMid;
uniform float uBreathIntensity;
attribute float aPulseOffset;
varying float vPulse;
varying vec3 vPosition;
varying vec3 vNormal;

void main() {
    vPosition = position;
    vNormal = normalize(normalMatrix * normal);
    
    // Pulse effect
    float pulse = sin(uTime * 2.0 + aPulseOffset) * uBreathIntensity;
    vPulse = pulse;
    
    // Audio-reactive scale pulse
    float audioPulse = uAudioBass * 0.1;
    vec3 newPosition = position * (1.0 + pulse * 0.05 + audioPulse);
    
    vec4 modelPosition = modelMatrix * vec4(newPosition, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    gl_Position = projectionMatrix * viewPosition;
}
`;

const figureFragmentShader = `
uniform float uTime;
uniform float uAudioBass;
uniform float uAudioMid;
uniform float uAudioTreble;
uniform vec3 uColor;
uniform float uOpacity;
uniform bool uIsObsessed;
varying float vPulse;
varying vec3 vPosition;
varying vec3 vNormal;

void main() {
    // Wireframe grid effect
    float gridIntensity = 0.5;
    
    // Fresnel effect for glow
    vec3 viewDirection = normalize(cameraPosition - vPosition);
    float fresnel = pow(1.0 - abs(dot(viewDirection, vNormal)), 2.0);
    
    // Pulse glow
    float pulseGlow = 0.5 + sin(uTime * 3.0) * 0.3 + uAudioBass * 0.5;
    
    // Obsessed figure: more erratic, pink
    // Target figure: calmer, cyan
    float baseBrightness = uIsObsessed ? 
        0.4 + uAudioTreble * 0.6 :  // Obsessed: reactive to treble (anxious)
        0.3 + uAudioMid * 0.4;      // Target: reactive to mid (calm)
    
    vec3 finalColor = uColor * (baseBrightness + fresnel * pulseGlow);
    
    // Sedation: obsessions fades when quiet
    float sedation = uIsObsessed ? (0.3 + uAudioBass * 0.7) : 1.0;
    finalColor *= sedation;
    
    gl_FragColor = vec4(finalColor, uOpacity * (0.3 + fresnel * 0.7));
}
`;

// Ambient floating particles shader
const ambientVertexShader = `
uniform float uTime;
uniform float uAudioMid;
attribute float aSpeed;
attribute float aOffset;
varying float vY;

void main() {
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);
    
    // Gentle floating
    modelPosition.y += sin(uTime * aSpeed + aOffset) * 5.0;
    modelPosition.x += cos(uTime * aSpeed * 0.7 + aOffset) * 2.0;
    
    // Audio reactive drift
    modelPosition.x += uAudioMid * 3.0 * sin(uTime + aOffset);
    
    vY = modelPosition.y;
    
    vec4 viewPosition = viewMatrix * modelPosition;
    gl_Position = projectionMatrix * viewPosition;
    
    gl_PointSize = 1.5;
    gl_PointSize *= (150.0 / -viewPosition.z);
}
`;

const ambientFragmentShader = `
uniform vec3 uColor;
varying float vY;

void main() {
    float strength = distance(gl_PointCoord, vec2(0.5));
    strength = 1.0 - strength;
    strength = pow(strength, 3.0);
    
    // Fade based on height
    float heightFade = smoothstep(-50.0, 0.0, vY) * smoothstep(50.0, 20.0, vY);
    
    gl_FragColor = vec4(uColor, strength * heightFade * 0.3);
}
`;

// ─────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────

const analyzeAudio = (analyser: AnalyserNode, dataArray: Uint8Array): AudioData => {
  analyser.getByteFrequencyData(dataArray);
  
  const bass = dataArray.slice(0, 8).reduce((a, b) => a + b, 0) / (8 * 255);
  const mid = dataArray.slice(8, 40).reduce((a, b) => a + b, 0) / (32 * 255);
  const treble = dataArray.slice(40, 100).reduce((a, b) => a + b, 0) / (60 * 255);
  
  return { bass, mid, treble, raw: dataArray };
};

// Create obsession particle system that flows between two figures
const createObsessionParticles = (
  count: number,
  sourcePos: [number, number, number],
  targetPos: [number, number, number]
): { geometry: BufferGeometry; material: ShaderMaterial; points: Points } => {
  const positions = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const radii = new Float32Array(count);
  const speeds = new Float32Array(count);
  const offsets = new Float32Array(count * 3);
  
  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    
    // Initial positions along the path (will be animated)
    const t = i / count;
    positions[i3] = MathUtils.lerp(sourcePos[0], targetPos[0], t);
    positions[i3 + 1] = MathUtils.lerp(sourcePos[1], targetPos[1], t);
    positions[i3 + 2] = MathUtils.lerp(sourcePos[2], targetPos[2], t) + (Math.random() - 0.5) * 10;
    
    phases[i] = Math.random();
    radii[i] = 5 + Math.random() * 15;
    speeds[i] = 0.3 + Math.random() * 0.7;
    
    offsets[i3] = (Math.random() - 0.5) * 10;
    offsets[i3 + 1] = (Math.random() - 0.5) * 10;
    offsets[i3 + 2] = (Math.random() - 0.5) * 10;
  }
  
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('aPhase', new BufferAttribute(phases, 1));
  geometry.setAttribute('aRadius', new BufferAttribute(radii, 1));
  geometry.setAttribute('aSpeed', new BufferAttribute(speeds, 1));
  geometry.setAttribute('aOffset', new BufferAttribute(offsets, 3));
  
  const material = new ShaderMaterial({
    vertexShader: obsessionVertexShader,
    fragmentShader: obsessionFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uAudioBass: { value: 0 },
      uAudioMid: { value: 0 },
      uAudioTreble: { value: 0 },
      uIntensity: { value: 1 },
      uSourcePosition: { value: new Vector3(...sourcePos) },
      uTargetPosition: { value: new Vector3(...targetPos) },
      uObsessedColor: { value: new Color(0xff1493) }, // Hot pink
      uTargetColor: { value: new Color(0x22d3ee) },    // Cyan
    },
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  
  const points = new Points(geometry, material);
  
  return { geometry, material, points };
};

// Create ambient floating particles
const createAmbientParticles = (count: number, color: number): { geometry: BufferGeometry; material: ShaderMaterial; points: Points } => {
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);
  const offsets = new Float32Array(count);
  
  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    positions[i3] = (Math.random() - 0.5) * 200;
    positions[i3 + 1] = (Math.random() - 0.5) * 100;
    positions[i3 + 2] = (Math.random() - 0.5) * 150;
    
    speeds[i] = 0.2 + Math.random() * 0.5;
    offsets[i] = Math.random() * Math.PI * 2;
  }
  
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('aSpeed', new BufferAttribute(speeds, 1));
  geometry.setAttribute('aOffset', new BufferAttribute(offsets, 1));
  
  const material = new ShaderMaterial({
    vertexShader: ambientVertexShader,
    fragmentShader: ambientFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uAudioMid: { value: 0 },
      uColor: { value: new Color(color) },
    },
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  
  const points = new Points(geometry, material);
  
  return { geometry, material, points };
};

// Create abstract humanoid figure
const createFigure = (
  position: [number, number, number],
  color: number,
  isObsessed: boolean
): { geometry: any; material: ShaderMaterial; mesh: Mesh; torus?: Mesh } => {
  // Main body - capsule-like
  const geometry = new CapsuleGeometry(4, 12, 8, 16);
  
  const pulseOffsets = new Float32Array(geometry.attributes.position.count);
  for (let i = 0; i < pulseOffsets.length; i++) {
    pulseOffsets[i] = Math.random() * Math.PI * 2;
  }
  geometry.setAttribute('aPulseOffset', new BufferAttribute(pulseOffsets, 1));
  
  const material = new ShaderMaterial({
    vertexShader: figureVertexShader,
    fragmentShader: figureFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uAudioBass: { value: 0 },
      uAudioMid: { value: 0 },
      uAudioTreble: { value: 0 },
      uColor: { value: new Color(color) },
      uOpacity: { value: 0.4 },
      uIsObsessed: { value: isObsessed },
      uBreathIntensity: { value: isObsessed ? 0.3 : 0.15 },
    },
    transparent: true,
    wireframe: true,
    blending: AdditiveBlending,
  });
  
  const mesh = new Mesh(geometry, material);
  mesh.position.set(...position);
  
  // Add orbiting ring around the figure
  const torusGeometry = new TorusGeometry(10, 0.15, 8, 64);
  const torusMaterial = new MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: 0.3,
    blending: AdditiveBlending,
  });
  const torus = new Mesh(torusGeometry, torusMaterial);
  torus.rotation.x = Math.PI / 2;
  mesh.add(torus);
  
  return { geometry, material, mesh, torus };
};

// ─────────────────────────────────────────────────────────────
// MAIN HOOK
// ─────────────────────────────────────────────────────────────

const useObsessionScene = ({
  audioRef,
  isPlaying,
  containerRef,
  intensity = 1,
}: Props) => {
  // Refs
  const isPlayingRef = useRef(isPlaying);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  const sceneRef = useRef<Scene | null>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const cameraRef = useRef<PerspectiveCamera | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const clockRef = useRef<Clock>(new Clock());

  // Audio refs
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);

  // Animation refs
  const rafRef = useRef<number | null>(null);
  const pausedRef = useRef(false);

  // Smooth audio values
  const smoothAudioRef = useRef({ bass: 0, mid: 0, treble: 0 });

  // Object refs
  const obsessionParticlesRef = useRef<Points | null>(null);
  const obsessionMaterialRef = useRef<ShaderMaterial | null>(null);
  const ambientParticlesRef = useRef<Points | null>(null);
  const ambientMaterialRef = useRef<ShaderMaterial | null>(null);
  const obsessedFigureRef = useRef<Mesh | null>(null);
  const obsessedMaterialRef = useRef<ShaderMaterial | null>(null);
  const targetFigureRef = useRef<Mesh | null>(null);
  const targetMaterialRef = useRef<ShaderMaterial | null>(null);
  const obsessedTorusRef = useRef<Mesh | null>(null);
  const targetTorusRef = useRef<Mesh | null>(null);
  const lightRef = useRef<PointLight | null>(null);

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
      analyser.smoothingTimeConstant = 0.85;

      src.connect(analyser);
      analyser.connect(ctx.destination);

      analyserRef.current = analyser;
      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
    } catch (err) {
      console.error('Failed to initialize audio context:', err);
    }
  }, [audioRef]);

  // ─────────────────────────────────────────────────────────────
  // SCENE INIT
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    // WebGL Support Check
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
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

    // ── 1. SCENE SETUP ──
    const scene = new Scene();
    scene.fog = new FogExp2(0x050508, 0.008);
    sceneRef.current = scene;

    const camera = new PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(0, 0, 70);
    cameraRef.current = camera;

    // ── 2. RENDERER SETUP ──
    const renderer = new WebGLRenderer({
      alpha: true,
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
      preserveDrawingBuffer: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x050508, 0);
    renderer.setClearAlpha(0);
    renderer.outputColorSpace = SRGBColorSpace;

    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.inset = '0';
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // ── 3. POST PROCESSING ──
    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(
      new Vector2(width, height),
      2.0,        // Strength - slightly higher for obsession theme
      0.5,        // Radius
      0.1         // Threshold
    );
    
    const composer = new EffectComposer(renderer);
    composer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    composer.addPass(renderScene);
    composer.addPass(bloomPass);
    composerRef.current = composer;

    // ── 4. FIGURES ──
    // The Obsessed One (left, pink)
    const { mesh: obsessedFigure, material: obsessedMaterial, torus: obsessedTorus } = 
      createFigure([-20, -10, 0], 0xff1493, true);
    scene.add(obsessedFigure);
    obsessedFigureRef.current = obsessedFigure;
    obsessedMaterialRef.current = obsessedMaterial;
    obsessedTorusRef.current = obsessedTorus!;

    // The Object of Obsession (right, cyan)
    const { mesh: targetFigure, material: targetMaterial, torus: targetTorus } = 
      createFigure([20, -10, 0], 0x22d3ee, false);
    scene.add(targetFigure);
    targetFigureRef.current = targetFigure;
    targetMaterialRef.current = targetMaterial;
    targetTorusRef.current = targetTorus!;

    // ── 5. OBSESSION PARTICLES ──
    // Flow from obsessed to target
    const { points: obsessionParticles, material: obsessionMaterial } = 
      createObsessionParticles(
        400,
        [-20, -10, 0], // Source: obsessed figure
        [20, -10, 0]   // Target: object of obsession
      );
    scene.add(obsessionParticles);
    obsessionParticlesRef.current = obsessionParticles;
    obsessionMaterialRef.current = obsessionMaterial;

    // Secondary obsession particles (reverse flow, representing desire returned)
    const { points: reverseParticles, material: reverseMaterial } = 
      createObsessionParticles(
        200,
        [20, -10, 0],   // Source: target
        [-20, -10, 0]   // Target: obsessed
      );
    reverseMaterial.uniforms.uObsessedColor.value = new Color(0x22d3ee);
    reverseMaterial.uniforms.uTargetColor.value = new Color(0xff1493);
    scene.add(reverseParticles);

    // ── 6. AMBIENT PARTICLES ──
    // Pink ambient particles (obsession background)
    const { points: ambientPink, material: ambientPinkMaterial } = 
      createAmbientParticles(800, 0xff1493);
    ambientPink.position.x = -30;
    scene.add(ambientPink);
    ambientParticlesRef.current = ambientPink;
    ambientMaterialRef.current = ambientPinkMaterial;

    // Cyan ambient particles (calm background)
    const { points: ambientCyan, material: ambientCyanMaterial } = 
      createAmbientParticles(600, 0x22d3ee);
    ambientCyan.position.x = 30;
    scene.add(ambientCyan);

    // ── 7. LIGHTING ──
    // Key light (obsessed side) - pink
    const keyLight = new PointLight(0xff1493, 1.5, 200);
    keyLight.position.set(-40, 10, 30);
    scene.add(keyLight);
    lightRef.current = keyLight;

    // Fill light (target side) - cyan
    const fillLight = new PointLight(0x22d3ee, 1.2, 200);
    fillLight.position.set(40, 10, 30);
    scene.add(fillLight);

    // Rim light for depth
    const rimLight = new PointLight(0x8b5cf6, 0.8, 200);
    rimLight.position.set(0, -30, -50);
    scene.add(rimLight);

    // ── 8. RESIZE HANDLER ──
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      
      const { width, height } = containerRef.current.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      composer.setSize(width, height);
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);

    // ── 9. ANIMATION LOOP ──
    const animate = () => {
      if (pausedRef.current) return;
      rafRef.current = requestAnimationFrame(animate);

      const elapsedTime = clockRef.current.getElapsedTime();
      
      // Audio Analysis
      let audioData: AudioData = { bass: 0, mid: 0, treble: 0, raw: null };
      
      if (isPlayingRef.current && analyserRef.current && dataArrayRef.current) {
        audioData = analyzeAudio(analyserRef.current, dataArrayRef.current);
      }
      
      // Smooth interpolation
      smoothAudioRef.current.bass = MathUtils.lerp(
        smoothAudioRef.current.bass, 
        audioData.bass, 
        0.1
      );
      smoothAudioRef.current.mid = MathUtils.lerp(
        smoothAudioRef.current.mid, 
        audioData.mid, 
        0.08
      );
      smoothAudioRef.current.treble = MathUtils.lerp(
        smoothAudioRef.current.treble, 
        audioData.treble, 
        0.05
      );

      const { bass, mid, treble } = smoothAudioRef.current;

      // Update Obsessed Figure
      if (obsessedMaterialRef.current) {
        obsessedMaterialRef.current.uniforms.uTime.value = elapsedTime;
        obsessedMaterialRef.current.uniforms.uAudioBass.value = bass;
        obsessedMaterialRef.current.uniforms.uAudioMid.value = mid;
        obsessedMaterialRef.current.uniforms.uAudioTreble.value = treble;
        // Sedation: fade out when quiet
        obsessedMaterialRef.current.uniforms.uOpacity.value = 0.3 + bass * 0.5;
      }
      
      if (obsessedFigureRef.current) {
        // Obsessed figure twitches erratically with treble
        obsessedFigureRef.current.rotation.y = Math.sin(elapsedTime * 0.5) * 0.1 + treble * 0.2;
        obsessedFigureRef.current.rotation.z = Math.sin(elapsedTime * 0.7) * 0.05;
        // Moves slightly toward target when bass hits
        const approach = bass * 5;
        obsessedFigureRef.current.position.x = -20 + approach;
      }

      if (obsessedTorusRef.current) {
        obsessedTorusRef.current.rotation.z = elapsedTime * 0.5 + bass;
        obsessedTorusRef.current.rotation.x = (Math.PI / 2) + Math.sin(elapsedTime * 0.3) * 0.2;
        // Pulse radius
        const torusScale = 1 + bass * 0.3;
        obsessedTorusRef.current.scale.setScalar(torusScale);
      }

      // Update Target Figure
      if (targetMaterialRef.current) {
        targetMaterialRef.current.uniforms.uTime.value = elapsedTime;
        targetMaterialRef.current.uniforms.uAudioBass.value = bass;
        targetMaterialRef.current.uniforms.uAudioMid.value = mid;
        targetMaterialRef.current.uniforms.uAudioTreble.value = treble;
        targetMaterialRef.current.uniforms.uOpacity.value = 0.35 + mid * 0.4;
      }
      
      if (targetFigureRef.current) {
        // Target figure is calmer, more stable
        targetFigureRef.current.rotation.y = Math.sin(elapsedTime * 0.2) * 0.05;
        // Slight recoil when bass hits (being "pulled" toward)
        const recoil = bass * 3;
        targetFigureRef.current.position.x = 20 - recoil;
      }

      if (targetTorusRef.current) {
        targetTorusRef.current.rotation.z = -elapsedTime * 0.3 + mid;
        targetTorusRef.current.rotation.x = (Math.PI / 2) + Math.cos(elapsedTime * 0.2) * 0.15;
        const torusScale = 1 + mid * 0.2;
        targetTorusRef.current.scale.setScalar(torusScale);
      }

      // Update Obsession Particles
      if (obsessionMaterialRef.current) {
        obsessionMaterialRef.current.uniforms.uTime.value = elapsedTime;
        obsessionMaterialRef.current.uniforms.uAudioBass.value = bass;
        obsessionMaterialRef.current.uniforms.uAudioMid.value = mid;
        obsessionMaterialRef.current.uniforms.uAudioTreble.value = treble;
        obsessionMaterialRef.current.uniforms.uIntensity.value = 1 + bass * 2;
      }

      if (reverseMaterial) {
        reverseMaterial.uniforms.uTime.value = elapsedTime;
        reverseMaterial.uniforms.uAudioBass.value = bass;
        reverseMaterial.uniforms.uAudioMid.value = mid;
        reverseMaterial.uniforms.uAudioTreble.value = treble;
      }

      // Update Ambient Particles
      if (ambientPinkMaterial) {
        ambientPinkMaterial.uniforms.uTime.value = elapsedTime;
        ambientPinkMaterial.uniforms.uAudioMid.value = mid;
      }
      if (ambientCyanMaterial) {
        ambientCyanMaterial.uniforms.uTime.value = elapsedTime;
        ambientCyanMaterial.uniforms.uAudioMid.value = mid;
      }

      // Rotate ambient particle groups
      if (ambientPink) {
        ambientPink.rotation.y = elapsedTime * 0.02;
      }
      if (ambientCyan) {
        ambientCyan.rotation.y = -elapsedTime * 0.015;
      }

      // Animate Lights
      if (lightRef.current) {
        lightRef.current.intensity = 1.5 + bass * 2.0;
        lightRef.current.position.x = -40 + Math.sin(elapsedTime * 0.3) * 10;
      }
      if (fillLight) {
        fillLight.intensity = 1.2 + mid * 1.5;
        fillLight.position.x = 40 + Math.cos(elapsedTime * 0.3) * 10;
      }
      if (rimLight) {
        rimLight.intensity = 0.8 + treble * 1.0;
      }

      // Camera subtle movement
      if (cameraRef.current) {
        cameraRef.current.position.x = Math.sin(elapsedTime * 0.1) * 3;
        cameraRef.current.position.y = Math.cos(elapsedTime * 0.15) * 2;
      }

      composer.render();
    };

    animate();
    setReady(true);

    // ── CLEANUP ──
    return () => {
      pausedRef.current = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', handleResize);

      // Dispose
      obsessionParticlesRef.current?.geometry.dispose();
      obsessionMaterialRef.current?.dispose();
      obsessedFigureRef.current?.geometry.dispose();
      obsessedMaterialRef.current?.dispose();
      targetFigureRef.current?.geometry.dispose();
      targetMaterialRef.current?.dispose();
      ambientParticlesRef.current?.geometry.dispose();
      ambientMaterialRef.current?.dispose();
      composer.dispose();
      renderer.dispose();

      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, [containerRef, intensity]);

  // ── AUDIO EVENT LISTENERS ──
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.addEventListener('play', connectAudio);
    return () => audio.removeEventListener('play', connectAudio);
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
  const { ready, isWebGLSupported } = useObsessionScene({
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
        opacity: ready && isWebGLSupported ? 1 : 0,
        transition: 'opacity 1000ms ease',
        zIndex: 0,
      }}
    >
      {!isWebGLSupported && (
        <div className="absolute inset-0 flex items-center justify-center bg-black text-white text-sm">
          Your browser does not support WebGL. Try Chrome, Firefox, or Safari.
        </div>
      )}
    </div>
  );
};

export default ThreeBackground;
