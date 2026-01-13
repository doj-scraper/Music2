import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface ThreeBackgroundProps {
  audioRef: React.RefObject<HTMLAudioElement>;
  isPlaying: boolean;
}

const ThreeBackground: React.FC<ThreeBackgroundProps> = ({ audioRef, isPlaying }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  
  // Refs for Animation State
  const isPlayingRef = useRef(isPlaying);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);

  // Refs for Scene Objects
  const heartGroupRef = useRef<THREE.Group | null>(null);
  const particlesRef = useRef<THREE.Points | null>(null);
  const light1Ref = useRef<THREE.PointLight | null>(null);
  const light2Ref = useRef<THREE.PointLight | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  // 1. SYNC PLAY STATE
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // 2. BUILD SCENE
  useEffect(() => {
    if (!mountRef.current) return;

    // --- SETUP ---
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x000000, 50, 200);

    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 1, 1000);
    camera.position.z = 100;
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true, 
      powerPreference: 'high-performance' 
    });
    
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    
    // CSS Force
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    
    mountRef.current.appendChild(renderer.domElement);

    // --- LIGHTS ---
    // Warm Gold Light
    const pointLight1 = new THREE.PointLight(0xFFD700, 2, 150); 
    pointLight1.position.set(50, 50, 50);
    scene.add(pointLight1);
    light1Ref.current = pointLight1;

    // Cyan/Red contrast light
    const pointLight2 = new THREE.PointLight(0x00ffff, 1.5, 150);
    pointLight2.position.set(-50, -50, 50);
    scene.add(pointLight2);
    light2Ref.current = pointLight2;

    scene.add(new THREE.AmbientLight(0x442222, 0.5));

    // --- GEOMETRY: SINGLE HEART ---
    const createHeartShape = () => {
      const shape = new THREE.Shape();
      const x = 0, y = 0;
      shape.moveTo(x + 5, y + 5);
      shape.bezierCurveTo(x + 5, y + 5, x + 4, y, x, y);
      shape.bezierCurveTo(x - 6, y, x - 6, y + 7, x - 6, y + 7);
      shape.bezierCurveTo(x - 6, y + 11, x - 3, y + 15.4, x + 5, y + 19);
      shape.bezierCurveTo(x + 12, y + 15.4, x + 16, y + 11, x + 16, y + 7);
      shape.bezierCurveTo(x + 16, y + 7, x + 16, y, x + 10, y);
      shape.bezierCurveTo(x + 7, y, x + 5, y + 5, x + 5, y + 5);
      return shape;
    };

    const heartShape = createHeartShape();
    const extrudeSettings = { 
      depth: 4, 
      bevelEnabled: true, 
      bevelThickness: 0.6, 
      bevelSize: 0.5, 
      bevelSegments: 4 
    };
    
    const heartGeo = new THREE.ExtrudeGeometry(heartShape, extrudeSettings);
    
    // Center geometry
    heartGeo.computeBoundingBox();
    const xMid = -0.5 * (heartGeo.boundingBox!.max.x - heartGeo.boundingBox!.min.x);
    heartGeo.translate(xMid, 0, 0);

    // MATERIALS (Red & Gold)
    const wireGeo = new THREE.WireframeGeometry(heartGeo);
    const wireMat = new THREE.LineBasicMaterial({
      color: 0xFFD700, // Bright Gold
      transparent: true,
      opacity: 0.9,
      linewidth: 2
    });
    const wireMesh = new THREE.LineSegments(wireGeo, wireMat);

    const fillMat = new THREE.MeshPhongMaterial({
      color: 0x880000,       // Deep Red
      emissive: 0x330000,    // Red Glow
      specular: 0xFFD700,    // Gold Highlights
      shininess: 60,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide
    });
    const fillMesh = new THREE.Mesh(heartGeo, fillMat);

    // GROUP
    const heartGroup = new THREE.Group();
    heartGroup.add(fillMesh);
    heartGroup.add(wireMesh);

    // TRANSFORMATIONS
    heartGroup.rotation.z = Math.PI; // Flip upright
    heartGroup.position.y = -15;     // Lower position
    
    scene.add(heartGroup);
    heartGroupRef.current = heartGroup;

    // --- PARTICLES (RESTORED: Blue & Red) ---
    const pCount = 1500;
    const pPos = new Float32Array(pCount * 3);
    const pCol = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
      const i3 = i * 3;
      // Position
      pPos[i3] = (Math.random() - 0.5) * 250;
      pPos[i3 + 1] = (Math.random() - 0.5) * 250;
      pPos[i3 + 2] = (Math.random() - 0.5) * 150;
      
      // COLOR SELECTION (Reverted to Blue/Red mix)
      const colorChoice = Math.random();
      if (colorChoice < 0.5) {
        // Cyan/Blue-ish
        pCol[i3] = 0.0; // R
        pCol[i3 + 1] = 0.8 + Math.random() * 0.2; // G (varies slightly)
        pCol[i3 + 2] = 1.0; // B (Blue)
      } else {
        // Red/Magenta-ish
        pCol[i3] = 1.0; // R (Red)
        pCol[i3 + 1] = 0.2 + Math.random() * 0.3; // G (varies slightly)
        pCol[i3 + 2] = 0.2; // B
      }
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
    const pMat = new THREE.PointsMaterial({ size: 1.0, vertexColors: true, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending });
    const particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);
    particlesRef.current = particles;

    // --- GRIDS ---
    const gridHelper = new THREE.GridHelper(200, 40, 0xFFD700, 0x221111);
    gridHelper.position.y = -60;
    (gridHelper.material as THREE.Material).transparent = true;
    (gridHelper.material as THREE.Material).opacity = 0.1;
    scene.add(gridHelper);

    // --- AUDIO ---
    const connectAudio = () => {
      if (audioRef.current && !analyserRef.current) {
        try {
          const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
          const ctx = new AudioContext();
          const src = ctx.createMediaElementSource(audioRef.current);
          const anl = ctx.createAnalyser();
          anl.fftSize = 256;
          src.connect(anl);
          anl.connect(ctx.destination);
          analyserRef.current = anl;
          dataArrayRef.current = new Uint8Array(anl.frequencyBinCount);
        } catch (e) { /* Ignore if connected */ }
      }
    };
    connectAudio();

    // --- ANIMATION LOOP ---
    let frameId: number;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const time = performance.now() * 0.0005;

      let bass = 0;
      if (isPlayingRef.current && analyserRef.current && dataArrayRef.current) {
        analyserRef.current.getByteFrequencyData(dataArrayRef.current);
        let bassSum = 0;
        for (let i = 0; i < 15; i++) {
          bassSum += dataArrayRef.current[i];
        }
        bass = bassSum / 15 / 255;
      }

      // HEART ANIMATION
      if (heartGroupRef.current) {
        heartGroupRef.current.rotation.y = Math.sin(time * 0.5) * 0.2; 
        const targetScale = 1.5 + (bass * 0.4); 
        heartGroupRef.current.scale.set(targetScale, targetScale, targetScale);
        heartGroupRef.current.rotation.z = Math.PI + (Math.sin(time * 0.2) * 0.05);
      }

      // PARTICLES
      if (particlesRef.current) {
        particlesRef.current.rotation.y = time * 0.1;
      }

      // LIGHTS
      if (light1Ref.current) {
        light1Ref.current.position.x = Math.sin(time) * 60;
        light1Ref.current.position.z = Math.cos(time) * 60;
      }

      renderer.render(scene, camera);
    };
    animate();

    // --- RESIZE ---
    const handleResize = () => {
      if (!cameraRef.current || !renderer) return;
      cameraRef.current.aspect = window.innerWidth / window.innerHeight;
      cameraRef.current.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // --- CLEANUP ---
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(frameId);
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
      heartGeo.dispose();
      wireGeo.dispose();
      fillMat.dispose();
      wireMat.dispose();
      pGeo.dispose();
      pMat.dispose();
    };
  }, []);

  return (
    <div 
      ref={mountRef} 
      className="absolute inset-0 w-full h-full"
      style={{ pointerEvents: 'none' }} 
    />
  );
};

export default ThreeBackground;
