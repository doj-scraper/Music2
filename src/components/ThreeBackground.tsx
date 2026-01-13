
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { ThreeBackgroundProps } from '../types/types';

export default function ThreeBackground({ audioRef, isPlaying }: ThreeBackgroundProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const rafRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  // --- Soft phosphor silhouette texture ---
  const createSpriteTexture = (
    shape: 'man' | 'woman',
    coreColor: string
  ): THREE.Texture => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'lighter';

    const gradient = ctx.createRadialGradient(128, 180, 20, 128, 180, 220);
    gradient.addColorStop(0, coreColor);
    gradient.addColorStop(1, 'transparent');

    ctx.fillStyle = gradient;
    ctx.beginPath();

    if (shape === 'man') {
      ctx.arc(128, 90, 26, 0, Math.PI * 2);
      ctx.rect(92, 120, 72, 240);
    } else {
      ctx.arc(128, 90, 24, 0, Math.PI * 2);
      ctx.moveTo(128, 120);
      ctx.bezierCurveTo(60, 200, 90, 360, 128, 430);
      ctx.bezierCurveTo(166, 360, 196, 200, 128, 120);
    }

    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  };

  useEffect(() => {
    if (!mountRef.current) return;

    // --- Scene ---
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    camera.position.z = 6;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'low-power',
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mountRef.current.appendChild(renderer.domElement);

    // --- Resize handling ---
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    // --- Audio ---
    const initAudio = () => {
      if (!audioRef.current) return;

      // Reuse existing AudioContext if available, or create new one
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext ||
          (window as any).webkitAudioContext)();
      }

      const audioCtx = audioContextRef.current;

      // Resume context if suspended (browser autoplay policy)
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      if (!analyserRef.current) {
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;
        dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);

        // Connect existing source or create new one only if not already connected
        if (!sourceRef.current) {
             // Create MediaElementSource only once to avoid InvalidStateError
             try {
                // Check if the media element is already connected to another context?
                // No, we just need to ensure we don't call createMediaElementSource on it again
                // if we are re-mounting. But createMediaElementSource can be called only once per element.
                // However, since we are in useEffect, strict mode will unmount and remount.
                // We should store the source in a ref.

                // Note: In strict mode, if we unmount, we should disconnect but the source node remains valid for the element?
                // Actually, once createMediaElementSource is called, the element is "tainted".
                // But we can keep the AudioContext and Source alive across re-mounts using a global or context,
                // or just handle the error.
                // Better: Check if we can just re-connect.

                // If this is the *same* audio element reference, we might run into issues.
                // Ideally, we should lift the AudioContext up to App.tsx, but refactoring that much is risky.
                // Instead, we can try-catch or use a WeakMap to store the source associated with the element?
                // For now, let's just try to create it. If it fails, maybe it's already there?
                // But we don't have access to the old source object if we lost the ref.

                // Wait, if audioRef.current is the same DOM element, we cannot call createMediaElementSource again.
                // We need to store the source node on the element itself or a weakmap globally?
                // Or we can rely on React Strict Mode behavior being development only.
                // But to be safe, we can attach the source to the audio element as a custom property (hacky but works).

                const element = audioRef.current as any;
                if (element._audioSource) {
                    sourceRef.current = element._audioSource;
                } else {
                    const source = audioCtx.createMediaElementSource(audioRef.current);
                    sourceRef.current = source;
                    element._audioSource = source;
                }
             } catch (e) {
                 console.warn("MediaElementSource creation error:", e);
             }
        }

        if (sourceRef.current) {
            sourceRef.current.connect(analyser);
            analyser.connect(audioCtx.destination);
        }
      }
    };

    // Initialize audio only if playing or to be ready
    initAudio();

    // --- Sprites ---
    const man = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: createSpriteTexture('man', '#ff7a45'),
        transparent: true,
        blending: THREE.AdditiveBlending,
        opacity: 0.5,
      })
    );

    const woman = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: createSpriteTexture('woman', '#22d3ee'),
        transparent: true,
        blending: THREE.AdditiveBlending,
        opacity: 0.5,
      })
    );

    man.scale.set(1.4, 3, 1);
    woman.scale.set(1.4, 3, 1);
    man.position.set(-2.6, 0, -1);
    woman.position.set(2.6, 0, -1);

    scene.add(man, woman);

    // --- Sedation fog ---
    const fog = new THREE.Mesh(
      new THREE.PlaneGeometry(7, 5),
      new THREE.MeshBasicMaterial({
        color: 0x8899ff,
        transparent: true,
        opacity: 0.03,
        blending: THREE.AdditiveBlending,
      })
    );
    fog.position.z = -2.5;
    scene.add(fog);

    // --- Background particles ---
    const particleCount = 3000;
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < positions.length; i++) {
      positions[i] = (Math.random() - 0.5) * 20;
    }

    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const particles = new THREE.Points(
      particleGeo,
      new THREE.PointsMaterial({
        color: 0x445566,
        size: 0.015,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
      })
    );

    scene.add(particles);

    // --- Animation state ---
    let t = 0;
    let bassMemory = 0;
    let trebleMemory = 0;

    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      t += 0.002;

      // Resume context if needed
      if (isPlaying && audioContextRef.current?.state === 'suspended') {
          audioContextRef.current.resume();
      }

      if (isPlaying && analyserRef.current && dataArrayRef.current) {
        analyserRef.current.getByteFrequencyData(dataArrayRef.current);

        const bass =
          dataArrayRef.current.slice(0, 10).reduce((a, b) => a + b, 0) / 10;
        const treble =
          dataArrayRef.current
            .slice(-10)
            .reduce((a, b) => a + b, 0) / 10;

        bassMemory += (bass - bassMemory) * 0.05;
        trebleMemory += (treble - trebleMemory) * 0.08;

        const bassScale = 1 + (bassMemory / 255) * 0.4;
        const trebleScale = 1 + (trebleMemory / 255) * 0.4;

        man.scale.set(1.4 * bassScale, 3 * bassScale, 1);
        woman.scale.set(1.4 * trebleScale, 3 * trebleScale, 1);

        (man.material as THREE.SpriteMaterial).opacity =
          0.35 + (bassMemory / 255) * 0.35;
        (woman.material as THREE.SpriteMaterial).opacity =
          0.35 + (trebleMemory / 255) * 0.35;

        fog.material.opacity =
          0.02 + ((bassMemory + trebleMemory) / 510) * 0.08;
      }

      man.position.x = -2.6 + Math.sin(t) * 0.15;
      woman.position.x = 2.6 + Math.sin(t + Math.PI) * 0.15;

      man.rotation.z = Math.sin(t) * 0.02;
      woman.rotation.z = Math.sin(t + 1.5) * 0.03;

      particles.rotation.y += 0.0003;

      renderer.render(scene, camera);
    };

    animate();

    // --- Cleanup ---
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      mountRef.current?.removeChild(renderer.domElement);
      // We do NOT close the AudioContext here to avoid breaking the audio element for future mounts?
      // Actually, if we close it, the media element source is disconnected?
      // But for memory leaks we should close it.
      // However, if we re-mount, we want to reuse it?
      // If we close it, we can't reuse the source node if it's bound to that context.
      // So let's keep it open, or handle complete cleanup carefully.
      // Given the scope, let's rely on the browser GC or the fact that App is long lived.
      // But to prevent multiple contexts, we check audioContextRef.current.
    };
  }, [audioRef, isPlaying]);

  return <div ref={mountRef} className="absolute inset-0 -z-10" />;
}
