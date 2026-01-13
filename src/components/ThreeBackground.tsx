
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface ThreeBackgroundProps {
  audioRef: React.RefObject<HTMLAudioElement>;
  isPlaying: boolean;
}

const ThreeBackground: React.FC<ThreeBackgroundProps> = ({ audioRef, isPlaying }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  
  // Refs for Animation Loop Access
  const isPlayingRef = useRef(isPlaying);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);

  // Refs for 3D Objects
  const heartMesh1Ref = useRef<THREE.Mesh | null>(null);
  const heartMesh2Ref = useRef<THREE.Mesh | null>(null);
  const wireMesh1Ref = useRef<THREE.LineSegments | null>(null);
  const wireMesh2Ref = useRef<THREE.LineSegments | null>(null);
  const crackLineRef = useRef<THREE.Line | null>(null);
  const particlesRef = useRef<THREE.Points | null>(null);
  const light1Ref = useRef<THREE.PointLight | null>(null);
  const light2Ref = useRef<THREE.PointLight | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  // 1. SYNC PLAY STATE (Runs every update, no re-render)
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // 2. BUILD SCENE (Runs ONCE on mount)
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
    renderer.setClearColor(0x000000, 0); // Transparent
    
    // CSS Force
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    
    mountRef.current.appendChild(renderer.domElement);

    // --- LIGHTS ---
    const pointLight1 = new THREE.PointLight(0xff0033, 2, 150);
    pointLight1.position.set(50, 50, 50);
    scene.add(pointLight1);
    light1Ref.current = pointLight1;

    const pointLight2 = new THREE.PointLight(0x00ffff, 2, 150);
    pointLight2.position.set(-50, -50, 50);
    scene.add(pointLight2);
    light2Ref.current = pointLight2;

    scene.add(new THREE.AmbientLight(0x1a1a2e, 0.5));

    // --- GEOMETRY: HEART ---
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

    const extrudeSettings = { depth: 4, bevelEnabled: true, bevelThickness: 0.5, bevelSize: 0.5, bevelSegments: 3 };
    const heartShape = createHeartShape();
    
    const heartMat = new THREE.MeshPhongMaterial({
      color: 0xff1744,
      emissive: 0xff0033,
      emissiveIntensity: 0.3,
      shininess: 100,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide // Ensure visibility from all angles
    });
    
    const wireMat = new THREE.LineBasicMaterial({
      color: 0xff0066,
      transparent: true,
      opacity: 0.3
    });

    // Left Heart
    const heartGeo1 = new THREE.ExtrudeGeometry(heartShape, extrudeSettings);
    const heartMesh1 = new THREE.Mesh(heartGeo1, heartMat);
    heartMesh1.position.set(-8, 0, 0);
    heartMesh1.rotation.y = Math.PI * 0.05;
    scene.add(heartMesh1);
    heartMesh1Ref.current = heartMesh1;

    const wireGeo1 = new THREE.WireframeGeometry(heartGeo1);
    const wireMesh1 = new THREE.LineSegments(wireGeo1, wireMat);
    wireMesh1.position.copy(heartMesh1.position);
    wireMesh1.rotation.copy(heartMesh1.rotation);
    scene.add(wireMesh1);
    wireMesh1Ref.current = wireMesh1;

    // Right Heart
    const heartGeo2 = new THREE.ExtrudeGeometry(heartShape, extrudeSettings);
    const heartMesh2 = new THREE.Mesh(heartGeo2, heartMat);
    heartMesh2.position.set(8, 0, 0);
    heartMesh2.rotation.y = -Math.PI * 0.05;
    scene.add(heartMesh2);
    heartMesh2Ref.current = heartMesh2;

    const wireGeo2 = new THREE.WireframeGeometry(heartGeo2);
    const wireMesh2 = new THREE.LineSegments(wireGeo2, wireMat);
    wireMesh2.position.copy(heartMesh2.position);
    wireMesh2.rotation.copy(heartMesh2.rotation);
    scene.add(wireMesh2);
    wireMesh2Ref.current = wireMesh2;

    // Crack Line
    const crackPoints = [];
    for (let i = 0; i < 20; i++) {
      const y = (i / 19) * 30 - 15;
      const x = Math.sin(i * 0.8) * 2;
      const z = Math.cos(i * 1.2) * 1.5;
      crackPoints.push(new THREE.Vector3(x, y, z));
    }
    const crackGeo = new THREE.BufferGeometry().setFromPoints(crackPoints);
    const crackMat = new THREE.LineBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.8, linewidth: 2 });
    const crackLine = new THREE.Line(crackGeo, crackMat);
    scene.add(crackLine);
    crackLineRef.current = crackLine;

    // Particles
    const pCount = 2000;
    const pPos = new Float32Array(pCount * 3);
    const pCol = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
      const i3 = i * 3;
      pPos[i3] = (Math.random() - 0.5) * 200;
      pPos[i3 + 1] = (Math.random() - 0.5) * 200;
      pPos[i3 + 2] = (Math.random() - 0.5) * 200;
      
      const isRed = Math.random() < 0.5;
      if (isRed) { pCol[i3] = 1.0; pCol[i3+1] = 0.2; pCol[i3+2] = 0.2; }
      else { pCol[i3] = 0.0; pCol[i3+1] = 0.8; pCol[i3+2] = 1.0; }
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
    const pMat = new THREE.PointsMaterial({ size: 1.5, vertexColors: true, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending });
    const particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);
    particlesRef.current = particles;

    // Grids
    const gridHelper = new THREE.GridHelper(150, 30, 0x00ffff, 0x004444);
    gridHelper.position.y = -40;
    (gridHelper.material as THREE.Material).transparent = true;
    (gridHelper.material as THREE.Material).opacity = 0.2;
    scene.add(gridHelper);

    const polarGrid = new THREE.PolarGridHelper(80, 16, 8, 64, 0xff0033, 0x440011);
    polarGrid.position.y = -40;
    polarGrid.position.z = -20;
    (polarGrid.material as THREE.Material).transparent = true;
    (polarGrid.material as THREE.Material).opacity = 0.15;
    scene.add(polarGrid);

    scene.add(new THREE.BoxHelper(heartMesh1, 0xff0066));
    scene.add(new THREE.BoxHelper(heartMesh2, 0xff0066));

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
        } catch (e) {
          // Ignore warnings if already connected
        }
      }
    };
    connectAudio();

    // --- ANIMATION ---
    let frameId: number;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const time = performance.now() * 0.0003;

      let bassFrequency = 0;
      let avgFrequency = 0;

      // Only process audio if playing
      if (isPlayingRef.current && analyserRef.current && dataArrayRef.current) {
        analyserRef.current.getByteFrequencyData(dataArrayRef.current);
        let sum = 0;
        let bassSum = 0;
        for (let i = 0; i < dataArrayRef.current.length; i++) {
          sum += dataArrayRef.current[i];
          if (i < 10) bassSum += dataArrayRef.current[i];
        }
        avgFrequency = sum / dataArrayRef.current.length / 255;
        bassFrequency = bassSum / 10 / 255;
      }

      // Heart Animation
      const separation = 8 + Math.sin(time * 0.8) * 3 + bassFrequency * 8;
      const floatY = Math.sin(time * 0.6) * 5;
      const rotY = Math.sin(time * 0.5) * 0.2;

      if (heartMesh1Ref.current && heartMesh2Ref.current) {
        // Position
        heartMesh1Ref.current.position.set(-separation, floatY, 0);
        heartMesh2Ref.current.position.set(separation, floatY, 0);
        // Rotation
        heartMesh1Ref.current.rotation.y = rotY;
        heartMesh2Ref.current.rotation.y = -rotY;
        
        // Sync Wireframes
        if (wireMesh1Ref.current) {
          wireMesh1Ref.current.position.copy(heartMesh1Ref.current.position);
          wireMesh1Ref.current.rotation.copy(heartMesh1Ref.current.rotation);
        }
        if (wireMesh2Ref.current) {
          wireMesh2Ref.current.position.copy(heartMesh2Ref.current.position);
          wireMesh2Ref.current.rotation.copy(heartMesh2Ref.current.rotation);
        }
        // Crack Line
        if (crackLineRef.current) crackLineRef.current.position.y = floatY;
      }

      // Particles
      if (particlesRef.current) {
        particlesRef.current.rotation.y += 0.0002;
      }

      // Lights
      if (light1Ref.current) {
        light1Ref.current.position.set(
          Math.sin(time * 1.7) * 80,
          Math.cos(time * 1.5) * 80,
          Math.cos(time * 1.3) * 80
        );
        light1Ref.current.intensity = 2 + avgFrequency * 2;
      }
      if (light2Ref.current) {
        light2Ref.current.position.set(
          -Math.sin(time * 1.3) * 80,
          -Math.cos(time * 1.8) * 80,
          Math.sin(time * 1.6) * 80
        );
        light2Ref.current.intensity = 2 + avgFrequency * 2;
      }

      // Camera Orbit
      if (cameraRef.current) {
        cameraRef.current.position.x = Math.cos(time * 0.3) * 100;
        cameraRef.current.position.z = Math.sin(time * 0.3) * 100;
        cameraRef.current.position.y = 20 + Math.sin(time * 0.4) * 10;
        cameraRef.current.lookAt(0, 0, 0);
      }

      renderer.render(scene, camera);
    };
    animate();

    // --- RESIZE ---
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
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
      heartGeo1.dispose(); heartGeo2.dispose();
      heartMat.dispose(); wireMat.dispose();
      pGeo.dispose(); pMat.dispose();
      crackGeo.dispose(); crackMat.dispose();
    };
  }, []); // <--- THIS EMPTY ARRAY IS THE KEY FIX

  return (
    <div 
      ref={mountRef} 
      className="absolute inset-0 w-full h-full"
      style={{ pointerEvents: 'none' }} // Lets clicks pass through to buttons
    />
  );
};

export default ThreeBackground;

