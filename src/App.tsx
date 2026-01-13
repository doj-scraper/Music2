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
  url: "/my-way.mp3"
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

  // Format time as MM:SS:MS
  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    const ms = Math.floor((time % 1) * 100);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${ms.toString().padStart(2, '0')}`;
  };

  // Toggle play/pause
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

  // Update current time
  const handleTimeUpdate = useCallback((): void => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  }, []);

  // Handle metadata loaded
  const handleLoadedMetadata = useCallback((): void => {
    if (audioRef.current && !Number.isNaN(audioRef.current.duration)) {
      setDuration(audioRef.current.duration);
      setIsLoading(false);
      setAudioError(null);
    }
  }, []);

  // Handle track ended
  const handleEnded = useCallback((): void => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  }, []);

  // Handle load start
  const handleLoadStart = useCallback((): void => {
    setIsLoading(true);
  }, []);

  // Handle audio errors
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

  // Handle volume change
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  // Toggle fullscreen
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

  // Handle progress bar click
  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (!audioRef.current || duration === 0) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = percent * duration;

    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Dynamic time color based on playback progress
  const timeColor = `hsl(${Math.floor(currentTime * 20) % 360}, 80%, 60%)`;

  return (
    <div
      ref={containerRef}
      className="h-[100dvh] w-full bg-black text-cyan-500 font-mono overflow-hidden relative selection:bg-orange-500 selection:text-black flex flex-col"
    >
      {/* ===== 3D BACKGROUND LAYER ===== */}
      <div className="absolute inset-0 z-0">
        <ThreeBackground audioRef={audioRef} isPlaying={isPlaying} />
      </div>

      {/* ===== ATMOSPHERIC OVERLAYS ===== */}
      <div 
        className="absolute inset-0 pointer-events-none z-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.5)_100%)]"
        aria-hidden="true"
      />
      <div 
        className="absolute inset-0 pointer-events-none z-0 opacity-[0.04]"
        style={{
          backgroundImage: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))',
          backgroundSize: '100% 4px, 3px 100%'
        }}
        aria-hidden="true"
      />

      {/* ===== MAIN UI CONTAINER ===== */}
      <div className="relative z-10 w-full flex-grow flex flex-col justify-between px-6 py-4 max-w-[1920px] mx-auto h-full">

        {/* ===== HEADER ===== */}
        <header className="flex justify-between items-start border-b border-cyan-900/30 pb-2 shrink-0">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-orange-500 animate-pulse" />
              <span className="text-[10px] font-bold tracking-[0.2em] text-white/90">
                MAK.PROJECT // CORE_V3
              </span>
            </div>
            <p className="text-[9px] text-cyan-800 tracking-widest pl-6">
              SEC_LEVEL: 7
            </p>
          </div>

          <div className="flex gap-4 text-[9px] text-cyan-700/80">
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-1.5">
                <Wifi className="w-3 h-3 text-cyan-400" />
                <span className="tracking-tighter">NET: 0x82A1</span>
              </div>
            </div>
            <div className="hidden sm:flex flex-col items-end border-l border-cyan-900/40 pl-4">
              <span className="text-orange-600/60 uppercase">Integrity</span>
              <span className={audioError ? 'text-red-500' : 'text-white/40'}>
                {audioError ? 'ERR' : '98%'}
              </span>
            </div>
          </div>
        </header>

        {/* ===== ERROR POPUP ===== */}
        {audioError && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 p-2 px-4 bg-red-950/90 border border-red-500/50 rounded flex items-center gap-3 backdrop-blur-md">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <span className="text-xs text-red-300">{audioError}</span>
            <button onClick={() => setAudioError(null)} className="text-red-400 text-xs font-bold hover:text-white">✕</button>
          </div>
        )}

        {/* ===== CENTER CONTENT ===== */}
        <main className="flex-grow grid grid-cols-1 lg:grid-cols-12 gap-2 lg:gap-4 items-center justify-center h-full overflow-hidden">

          {/* LEFT: INFO */}
          <div className="hidden lg:flex lg:col-span-3 flex-col items-start justify-center space-y-4 h-full">
            <div className="group border-l-2 border-orange-500/50 hover:border-orange-500 pl-4 py-1 transition-all w-full">
              <h3 className="text-[9px] font-bold text-orange-500/70 mb-1 uppercase tracking-widest flex items-center gap-2">
                <Zap className="w-3 h-3" /> Artist
              </h3>
              <p className="text-xl text-white font-black tracking-tight group-hover:text-orange-400 transition-colors">
                {TRACK.artist}
              </p>
            </div>
            <div className="border-l-2 border-cyan-600/30 pl-4 py-1 w-full">
              <h3 className="text-[9px] font-bold text-cyan-600 mb-1 uppercase tracking-widest flex items-center gap-2">
                <Info className="w-3 h-3" /> Data
              </h3>
              <div className="space-y-0.5">
                <p className="text-[10px] text-cyan-300/80 tracking-widest font-bold">{TRACK.format}</p>
                <p className="text-[9px] text-cyan-300/60 tracking-widest">{TRACK.bitrate}</p>
              </div>
            </div>
          </div>

          {/* CENTER: PLAYER */}
          <div className="col-span-1 lg:col-span-6 flex flex-col items-center justify-center text-center space-y-4 lg:space-y-6 w-full">
            
            {/* Title */}
            <div className="relative group w-full">
              <h1 className="relative text-5xl md:text-6xl lg:text-7xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-gray-700 select-none drop-shadow-2xl">
                {TRACK.title}
              </h1>
              <div className="h-[1px] w-1/2 mx-auto bg-gradient-to-r from-transparent via-cyan-500 to-transparent mt-2 opacity-50"></div>
            </div>

            {/* Timer */}
            <div className="flex flex-col items-center w-full max-w-md">
              <div className="relative flex items-center justify-center mb-2">
                <span 
                  className="text-6xl md:text-7xl font-black tabular-nums tracking-tighter drop-shadow-2xl transition-colors duration-300"
                  style={{ color: isPlaying ? timeColor : '#1e293b' }}
                >
                  {formatTime(currentTime)}
                </span>
              </div>

              {/* Progress */}
              <div
                onClick={handleProgressBarClick}
                className="w-full h-1 bg-cyan-950/50 rounded-full overflow-hidden border border-white/5 backdrop-blur-sm relative cursor-pointer hover:h-2 transition-all"
              >
                <div 
                  className="h-full bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.5)] relative"
                  style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                >
                  <div className="absolute right-0 top-0 bottom-0 w-2 bg-white shadow-[0_0_10px_#fff]"></div>
                </div>
              </div>
              
              <div className="flex justify-between w-full mt-1 px-1 text-[8px] text-cyan-800 font-bold">
                <span>00:00:00</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Controls */}
            <button
              onClick={togglePlay}
              disabled={audioError !== null || isLoading}
              className="group relative w-20 h-20 flex items-center justify-center focus:outline-none transition-transform hover:scale-105"
            >
              <div className={`absolute inset-0 rounded-full border border-cyan-800/40 transition-transform duration-1000 ${isPlaying ? 'rotate-180 scale-105' : ''}`}></div>
              <div className={`absolute inset-2 rounded-full border-2 border-dashed border-cyan-500/30 ${isPlaying ? 'animate-[spin_12s_linear_infinite]' : ''}`}></div>
              <div className="absolute inset-4 rounded-full bg-black/40 border border-white/10 backdrop-blur-md group-hover:bg-cyan-500/10 flex items-center justify-center">
                {isLoading ? (
                  <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin"></div>
                ) : isPlaying ? (
                  <Square className="w-6 h-6 fill-orange-500 text-orange-500 drop-shadow-lg" />
                ) : (
                  <Play className="w-6 h-6 fill-cyan-400 text-cyan-400 ml-1 drop-shadow-lg" />
                )}
              </div>
            </button>

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

          {/* RIGHT: CONTROLS */}
          <div className="hidden lg:flex lg:col-span-3 flex-col items-end justify-center space-y-6 h-full">
            <div className={`w-20 h-20 border border-cyan-900/50 rounded-full flex items-center justify-center relative ${isPlaying ? 'animate-[spin_4s_linear_infinite]' : ''}`}>
              <Disc className="w-12 h-12 text-cyan-600/50" />
              <div className="absolute w-1.5 h-1.5 bg-orange-500 rounded-full top-2 left-1/2 -translate-x-1/2"></div>
            </div>

            <div className="w-full max-w-[150px] text-right">
              <div className="flex items-center justify-end gap-2 mb-1">
                <span className="text-[9px] text-orange-500 font-bold tracking-widest">OSC</span>
                <Activity className="w-3 h-3 text-orange-500" />
              </div>
              <div className="flex gap-1 justify-end h-12 items-end">
                {[...Array(12)].map((_, i) => (
                  <div 
                    key={i}
                    className="w-1.5 bg-gradient-to-t from-cyan-950/80 to-cyan-500/40 rounded-t-sm"
                    style={{
                      height: isPlaying ? `${15 + Math.random() * 85}%` : '10%',
                      transition: 'height 0.1s ease',
                      opacity: (12 - i) / 12
                    }}
                  ></div>
                ))}
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 w-full max-w-[150px]">
              <div className="flex items-center gap-2 justify-end w-full">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={handleVolumeChange}
                  className="w-16 h-1 bg-cyan-950/50 rounded-full appearance-none cursor-pointer accent-cyan-500"
                />
                <Volume2 className="w-3 h-3 text-cyan-800/60" />
              </div>
              <button onClick={toggleFullscreen} className="flex items-center gap-2 text-cyan-800/60 hover:text-cyan-400 group">
                <span className="text-[9px] font-bold tracking-widest">MAXIMIZE</span>
                <Maximize2 className="w-3 h-3 group-hover:scale-110 transition-transform" />
              </button>
            </div>
          </div>
        </main>

        {/* ===== FOOTER ===== */}
        <footer className="pt-2 border-t border-cyan-900/20 flex justify-between items-center text-[9px] font-bold tracking-widest text-cyan-900 shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${isPlaying ? 'bg-green-500 animate-pulse' : 'bg-red-900'}`}></div>
              <span>SYS_ACTIVE</span>
            </div>
            <span className="hidden sm:inline">IMMERSIVE_VX</span>
          </div>
          <div className="flex items-center gap-2">
             <span className="text-cyan-700/80">MAK.PROJ</span>
          </div>
        </footer>

      </div>
    </div>
  );
}
