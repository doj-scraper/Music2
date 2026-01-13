import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play,
  Square,
  Cpu,
  Wifi,
  Disc,
  Volume2,
  Info,
  Zap,
  Activity,
  Maximize2,
  AlertCircle
} from 'lucide-react';
import ThreeBackground from './components/ThreeBackground';
import { TrackInfo } from './types/types';

const TRACK: TrackInfo = {
  title: "MY WAY",
  artist: "MAKENA",
  format: "PCM / WAVE",
  bitrate: "1411 KBPS",
  url: "/my-way.mp3" // Place in public folder
};

export default function App(): JSX.Element {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    const ms = Math.floor((time % 1) * 100);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${ms.toString().padStart(2, '0')}`;
  };

  const togglePlay = useCallback((): void => {
    if (!audioRef.current || audioError) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch((e: Error) => {
        setAudioError(`Playback failed: ${e.message}`);
        console.warn("Audio play failed:", e);
      });
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying, audioError]);

  const handleTimeUpdate = useCallback((): void => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  }, []);

  const handleLoadedMetadata = useCallback((): void => {
    if (audioRef.current && !Number.isNaN(audioRef.current.duration)) {
      setDuration(audioRef.current.duration);
      setIsLoading(false);
      setAudioError(null);
    }
  }, []);

  const handleEnded = useCallback((): void => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  }, []);

  const handleLoadStart = useCallback((): void => {
    setIsLoading(true);
  }, []);

  const handleError = useCallback((e: React.SyntheticEvent<HTMLAudioElement>): void => {
    const audio = e.currentTarget;
    let errorMsg = "Unknown error";

    if (audio.error) {
      switch (audio.error.code) {
        case audio.error.MEDIA_ERR_ABORTED:
          errorMsg = "Audio loading aborted";
          break;
        case audio.error.MEDIA_ERR_NETWORK:
          errorMsg = "Network error - check file path";
          break;
        case audio.error.MEDIA_ERR_DECODE:
          errorMsg = "Audio format not supported";
          break;
        case audio.error.MEDIA_ERR_SRC_NOT_SUPPORTED:
          errorMsg = "Audio source not supported";
          break;
      }
    }

    setAudioError(errorMsg);
    setIsLoading(false);
    console.error("Audio error:", errorMsg);
  }, []);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  const toggleFullscreen = (): void => {
    if (!containerRef.current) return;

    if (!isFullscreen) {
      containerRef.current.requestFullscreen().catch((err) => {
        console.warn("Fullscreen request failed:", err);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch((err) => {
        console.warn("Exit fullscreen failed:", err);
      });
      setIsFullscreen(false);
    }
  };

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (!audioRef.current || duration === 0) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = percent * duration;

    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const timeColor = `hsl(${Math.floor(currentTime * 20) % 360}, 80%, 60%)`;

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-black text-cyan-500 font-mono overflow-hidden relative selection:bg-orange-500 selection:text-black"
    >

      {/* 3D Background Layer */}
      <ThreeBackground audioRef={audioRef} isPlaying={isPlaying} />

      {/* Atmospheric Overlays */}
      <div className="absolute inset-0 pointer-events-none z-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.85)_100%)] shadow-[inset_0_0_150px_rgba(0,0,0,1)]"></div>

      {/* Scanline / CRT Effect */}
      <div className="absolute inset-0 pointer-events-none z-0 opacity-[0.03]"
           style={{
             backgroundImage: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))',
             backgroundSize: '100% 4px, 3px 100%'
           }}>
      </div>

      {/* Main UI */}
      <div className="relative z-10 container mx-auto px-6 py-10 h-screen flex flex-col justify-between">

        {/* Top Navigation / Status Bar */}
        <header className="flex justify-between items-start border-b border-cyan-900/40 pb-6 backdrop-blur-md">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Cpu className="w-6 h-6 text-orange-500 animate-pulse" />
                <div className="absolute inset-0 bg-orange-500 blur-md opacity-20 animate-pulse"></div>
              </div>
              <span className="text-sm font-bold tracking-[0.3em] text-white/90">MAK.PROJECT // CORE_AUDIO_V3</span>
            </div>
            <p className="text-[10px] text-cyan-800 tracking-widest pl-9">SECURITY CLEARANCE: LVL_7</p>
          </div>

          <div className="flex gap-8 text-[10px] text-cyan-700/80">
             <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-2">
                  <Wifi className="w-3 h-3 text-cyan-400" />
                  <span className="tracking-tighter">NODE_CONNECTED: 0x82A1</span>
                </div>
                <span className="opacity-50 tracking-tighter">THROUGHPUT: 12.8 GB/s</span>
             </div>
             <div className="hidden sm:flex flex-col items-end gap-1 border-l border-cyan-900/40 pl-8">
                <span className="text-orange-600/60 uppercase">System Integrity</span>
                <span className={`${audioError ? 'text-red-500' : 'text-white/40'}`}>
                  {audioError ? 'ERROR DETECTED' : '98.42% OPTIMAL'}
                </span>
             </div>
          </div>
        </header>

        {/* Error Banner */}
        {audioError && (
          <div className="mb-4 p-4 bg-red-950/40 border border-red-500/50 rounded flex items-center gap-3 backdrop-blur-sm">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <span className="text-sm text-red-300">{audioError}</span>
            <button
              onClick={() => setAudioError(null)}
              className="ml-auto text-red-400 hover:text-red-300 text-xs uppercase font-bold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Centerpiece Content */}
        <main className="flex-grow grid grid-cols-1 lg:grid-cols-12 gap-12 items-center py-12">

          {/* Metadata Sidebar (Left) */}
          <div className="lg:col-span-3 flex flex-col items-start space-y-8 order-2 lg:order-1">
             <div className="group border-l-2 border-orange-500/50 hover:border-orange-500 pl-5 py-3 transition-all duration-300">
                <h3 className="text-[10px] font-bold text-orange-500/70 mb-2 uppercase tracking-widest flex items-center gap-2">
                  <Zap className="w-3 h-3" /> Origin Artist
                </h3>
                <p className="text-2xl text-white font-black tracking-tight group-hover:text-orange-400 transition-colors">
                  {TRACK.artist}
                </p>
             </div>

             <div className="border-l-2 border-cyan-600/30 pl-5 py-3">
                <h3 className="text-[10px] font-bold text-cyan-600 mb-2 uppercase tracking-widest flex items-center gap-2">
                  <Info className="w-3 h-3" /> Data Signature
                </h3>
                <div className="space-y-1">
                  <p className="text-xs text-cyan-300/80 tracking-[0.2em] font-bold uppercase">{TRACK.format}</p>
                  <p className="text-xs text-cyan-300/60 tracking-[0.2em]">{TRACK.bitrate}</p>
                </div>
             </div>

             <div className="pt-4 flex flex-col gap-2">
               <div className="flex items-center gap-2 text-[10px] text-cyan-900">
                  <Activity className="w-3 h-3" />
                  <span>PHASE_SHIFT: {isLoading ? 'LOADING' : 'ACTIVE'}</span>
               </div>
               <div className="w-32 h-[1px] bg-gradient-to-r from-cyan-900 to-transparent"></div>
             </div>
          </div>

          {/* Core Player Module (Center) */}
          <div className="lg:col-span-6 flex flex-col items-center justify-center text-center space-y-12 order-1 lg:order-2">

            {/* Title Graphics */}
            <div className="relative group">
              <div className="absolute -inset-4 bg-orange-500/10 opacity-0 group-hover:opacity-100 transition-all duration-700 blur-2xl rounded-full"></div>
              <h1 className="relative text-7xl md:text-9xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-gray-700 select-none drop-shadow-2xl">
                {TRACK.title}
              </h1>
              <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-cyan-500 to-transparent mt-2 opacity-50"></div>
            </div>

            {/* Time Tracking HUD */}
            <div className="flex flex-col items-center w-full max-w-md">
               <div className="relative flex items-center justify-center mb-6">
                 <span className="text-7xl md:text-8xl font-black tabular-nums tracking-tighter drop-shadow-[0_0_20px_rgba(0,0,0,1)] transition-colors duration-300"
                       style={{ color: isPlaying ? timeColor : '#1e293b' }}>
                   {formatTime(currentTime)}
                 </span>
                 <span className="absolute text-7xl md:text-8xl font-black tabular-nums tracking-tighter opacity-10 blur-sm scale-105 pointer-events-none"
                       style={{ color: timeColor }}>
                   {formatTime(currentTime)}
                 </span>
               </div>

               {/* Progress Bar Container */}
               <div
                 onClick={handleProgressBarClick}
                 className="w-full h-1.5 bg-cyan-950/50 rounded-full overflow-hidden border border-white/5 backdrop-blur-sm relative cursor-pointer hover:h-2 transition-all"
               >
                  <div className="h-full bg-cyan-500 transition-all duration-300 ease-out relative shadow-[0_0_15px_rgba(6,182,212,0.5)]"
                       style={{ width: `${duration > 0 ? (currentTime/duration) * 100 : 0}%` }}>
                    <div className="absolute right-0 top-0 bottom-0 w-2 bg-white shadow-[0_0_10px_#fff]"></div>
                  </div>
               </div>

               <div className="flex justify-between w-full mt-3 px-1">
                 <span className="text-[10px] text-cyan-800 font-bold">START</span>
                 <span className="text-[10px] text-cyan-800 font-bold">{formatTime(duration)}</span>
               </div>
            </div>

            {/* Controller Hub */}
            <div className="flex items-center gap-8">
              <button
                  onClick={togglePlay}
                  disabled={audioError !== null || isLoading}
                  className="group relative w-28 h-28 flex items-center justify-center focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              >
                  {/* Outer Rings */}
                  <div className={`absolute inset-0 rounded-full border border-cyan-800/40 transition-transform duration-1000 ${isPlaying ? 'rotate-180 scale-110' : ''}`}></div>
                  <div className={`absolute inset-2 rounded-full border-2 border-dashed border-cyan-500/30 ${isPlaying ? 'animate-[spin_12s_linear_infinite]' : ''}`}></div>

                  {/* Button Body */}
                  <div className="absolute inset-4 rounded-full bg-black/40 border border-white/10 backdrop-blur-md group-hover:bg-cyan-500/10 transition-all duration-300 shadow-[0_0_30px_rgba(0,0,0,0.5)] flex items-center justify-center">
                    {isLoading ? (
                      <div className="w-10 h-10 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin"></div>
                    ) : isPlaying ? (
                      <Square className="w-10 h-10 fill-orange-500 text-orange-500 z-10 drop-shadow-[0_0_10px_rgba(249,115,22,0.5)]" />
                    ) : (
                      <Play className="w-10 h-10 fill-cyan-400 text-cyan-400 z-10 ml-1.5 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)] group-hover:text-white group-hover:fill-white transition-all" />
                    )}
                  </div>
              </button>
            </div>

            <audio
              ref={audioRef}
              src={TRACK.url}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={handleEnded}
              onLoadStart={handleLoadStart}
              onError={handleError}
              preload="metadata"
              crossOrigin="anonymous"
            />
          </div>

          {/* Technical Analytics (Right) */}
          <div className="lg:col-span-3 flex flex-col items-center lg:items-end justify-center space-y-10 order-3">
             <div className="relative">
               <div className={`w-24 h-24 border border-cyan-900/50 rounded-full flex items-center justify-center relative ${isPlaying ? 'animate-[spin_4s_linear_infinite]' : ''}`}>
                  <Disc className="w-14 h-14 text-cyan-600/50" />
                  <div className="absolute w-2 h-2 bg-orange-500 rounded-full top-2 left-1/2 -translate-x-1/2"></div>
               </div>
               <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap">
                 <span className="text-[10px] text-cyan-900 font-bold uppercase tracking-widest">DRIVE_STATUS: {isPlaying ? 'R/W' : 'IDLE'}</span>
               </div>
             </div>

             <div className="w-full max-w-[200px] text-right">
                <div className="flex items-center justify-end gap-2 mb-4">
                  <span className="text-[10px] text-orange-500 font-bold tracking-[0.2em]">SPECTRUM_OSC</span>
                  <Activity className="w-3 h-3 text-orange-500" />
                </div>
                <div className="flex gap-1.5 justify-end h-20 items-end">
                   {[...Array(12)].map((_: number, i: number) => (
                      <div key={i}
                           className="w-2.5 bg-gradient-to-t from-cyan-950/80 to-cyan-500/40 rounded-t-sm"
                           style={{
                             height: isPlaying ? `${15 + Math.random() * 85}%` : '10%',
                             transition: isPlaying ? 'height 0.1s ease' : 'height 0.8s ease',
                             opacity: (12-i) / 12
                           }}
                      ></div>
                   ))}
                </div>
             </div>

             <div className="flex flex-col items-end gap-4 w-full max-w-[200px]">
                <div className="flex items-center gap-3 w-full">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-cyan-800/60">Volume</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={handleVolumeChange}
                    className="w-20 h-1 bg-cyan-950/50 rounded-full appearance-none cursor-pointer accent-cyan-500"
                  />
                  <Volume2 className="w-4 h-4 text-cyan-800/60" />
                </div>
                <button
                  onClick={toggleFullscreen}
                  className="flex items-center gap-3 text-cyan-800/60 hover:text-cyan-400 transition-colors cursor-pointer group"
                >
                  <span className="text-[10px] uppercase font-bold tracking-widest">Full Interface</span>
                  <Maximize2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                </button>
             </div>
          </div>

        </main>

        {/* Footer Statistics */}
        <footer className="pt-8 border-t border-cyan-900/20 flex flex-col md:flex-row justify-between items-center text-[10px] font-bold tracking-[0.2em] text-cyan-900">
          <div className="flex items-center gap-8 mb-4 md:mb-0">
             <div className="flex items-center gap-2">
               <div className={`w-1.5 h-1.5 rounded-full ${isPlaying ? 'bg-green-500 animate-pulse' : audioError ? 'bg-red-500' : 'bg-red-900'}`}></div>
               <span>SYS_ACTIVE</span>
             </div>
             <span>PROTOCOL: IMMERSIVE_VX</span>
             <span className="hidden sm:inline">VERSION: 3.2.0_ENHANCED</span>
          </div>
          <div className="text-center md:text-right flex items-center gap-4">
             <p className="uppercase opacity-40">Unauthorized distribution prohibited</p>
             <div className="h-4 w-[1px] bg-cyan-900/40 hidden sm:block"></div>
             <p className="text-cyan-700/80">CORE DESIGN // <span className="text-white">MAK.PROJ</span></p>
          </div>
        </footer>

      </div>
    </div>
  );
}
