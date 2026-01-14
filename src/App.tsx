import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play,
  Square,
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
  title: "sedate/seduct",
  artist: "MAKENA",
  format: "PCM / WAVE",
  bitrate: "1411 KBPS",
  url: "/my-way.mp3"
};

// Custom Heart Icon Component with animation
const HeartIcon: React.FC = () => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 15 15" 
    width="24" 
    height="24"
    className="w-4 h-4 animate-pulse drop-shadow-[0_0_8px_rgba(255,20,147,0.8)]"
  >
    <path 
      d="M10.106 1.352a3.547 3.547 0 0 1 3.541 3.553c0 1.835-1.046 3.6-2.247 5.065c-1.21 1.476-2.653 2.735-3.567 3.55a.5.5 0 0 1-.59.056l-.076-.056c-.914-.815-2.357-2.073-3.567-3.55c-1.201-1.465-2.248-3.23-2.248-5.065a3.547 3.547 0 0 1 3.541-3.553c1.115 0 1.842.408 2.316.943c.112.126.208.259.29.39c.084-.131.18-.264.292-.39c.474-.535 1.2-.942 2.315-.943m0 1c-.835 0-1.287.29-1.566.606c-.306.346-.436.745-.578 1.088a.5.5 0 0 1-.924 0c-.142-.343-.272-.742-.578-1.088c-.28-.315-.731-.606-1.567-.606a2.547 2.547 0 0 0-2.54 2.553c0 1.477.857 3.011 2.02 4.43c1.02 1.245 2.222 2.333 3.127 3.14c.905-.807 2.107-1.895 3.128-3.14c1.163-1.418 2.02-2.954 2.02-4.43a2.547 2.547 0 0 0-2.542-2.553" 
      fill="#FF1493"
    />
  </svg>
);

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
  const timeColor = `hsl(${Math.floor(currentTime * 20) % 360}, 100%, 70%)`;

  return (
    <div
      ref={containerRef}
      className="h-[100dvh] w-full bg-black text-cyan-400 font-mono overflow-hidden relative selection:bg-orange-500 selection:text-black flex flex-col"
    >
      {/* ===== 3D BACKGROUND LAYER ===== */}
      <div className="absolute inset-0 z-0">
        <ThreeBackground audioRef={audioRef} isPlaying={isPlaying} />
      </div>

      {/* ===== ATMOSPHERIC OVERLAYS ===== */}
      <div 
        className="absolute inset-0 pointer-events-none z-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]"
        aria-hidden="true"
      />
      <div 
        className="absolute inset-0 pointer-events-none z-0 opacity-[0.06]"
        style={{
          backgroundImage: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))',
          backgroundSize: '100% 4px, 3px 100%'
        }}
        aria-hidden="true"
      />

      {/* ===== MAIN UI CONTAINER ===== */}
      <div className="relative z-10 w-full flex-grow flex flex-col justify-between px-3 sm:px-4 md:px-6 py-3 sm:py-4 max-w-[1920px] mx-auto h-full">

        {/* ===== HEADER ===== */}
        <header className="flex justify-between items-start border-b border-cyan-700/40 pb-2 shrink-0">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <HeartIcon />
              <span className="text-[10px] sm:text-[11px] font-bold tracking-[0.2em] text-white animate-[pulse_3s_ease-in-out_infinite] drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
                MAK.PROJECT // CORE_V3
              </span>
            </div>
            <p className="text-[9px] sm:text-[10px] text-cyan-300/90 tracking-widest pl-7">
              SEC_LEVEL: 7
            </p>
          </div>

          <div className="flex gap-3 sm:gap-4 text-[9px] sm:text-[10px] text-cyan-300/80">
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-1.5">
                <Wifi className="w-3 h-3 text-cyan-400 animate-[pulse_2s_ease-in-out_infinite]" />
                <span className="tracking-tighter text-white/90">NET: 0x82A1</span>
              </div>
            </div>
            <div className="hidden sm:flex flex-col items-end border-l border-cyan-700/50 pl-4">
              <span className="text-orange-400/90 uppercase tracking-wider">Integrity</span>
              <span className={audioError ? 'text-red-400' : 'text-white/80 font-bold'}>
                {audioError ? 'ERR' : '98%'}
              </span>
            </div>
          </div>
        </header>

        {/* ===== ERROR POPUP ===== */}
        {audioError && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 p-2 px-4 bg-red-950/95 border border-red-500/70 rounded flex items-center gap-3 backdrop-blur-md shadow-[0_0_20px_rgba(239,68,68,0.5)]">
            <AlertCircle className="w-4 h-4 text-red-400 animate-pulse" />
            <span className="text-xs text-red-200 font-medium">{audioError}</span>
            <button onClick={() => setAudioError(null)} className="text-red-400 text-xs font-bold hover:text-white transition-colors">✕</button>
          </div>
        )}

        {/* ===== CENTER CONTENT - RESPONSIVE GRID ===== */}
        <main className="flex-grow grid grid-cols-1 md:grid-cols-[auto_1fr_auto] gap-2 sm:gap-3 md:gap-4 items-center justify-center h-full overflow-hidden px-1">

          {/* LEFT: INFO - Now visible on all screens */}
          <div className="flex flex-row md:flex-col items-start justify-center space-y-2 md:space-y-4 h-auto md:h-full w-full md:w-auto">
            <div className="group border-l-2 border-orange-500/60 hover:border-orange-400 pl-3 py-1 transition-all w-auto md:w-full">
              <h3 className="text-[8px] sm:text-[9px] font-bold text-orange-400 mb-1 uppercase tracking-widest flex items-center gap-2">
                <Zap className="w-3 h-3 animate-pulse" /> Artist
              </h3>
              <p className="text-lg sm:text-xl text-white font-black tracking-tight group-hover:text-orange-300 transition-colors drop-shadow-[0_0_10px_rgba(255,165,0,0.5)]">
                {TRACK.artist}
              </p>
            </div>
            <div className="border-l-2 border-cyan-500/50 pl-3 py-1 w-auto md:w-full">
              <h3 className="text-[8px] sm:text-[9px] font-bold text-cyan-400 mb-1 uppercase tracking-widest flex items-center gap-2">
                <Info className="w-3 h-3" /> Data
              </h3>
              <div className="space-y-0.5">
                <p className="text-[9px] sm:text-[10px] text-cyan-200/90 tracking-widest font-bold drop-shadow-[0_0_5px_rgba(34,211,238,0.3)]">{TRACK.format}</p>
                <p className="text-[8px] sm:text-[9px] text-cyan-200/70 tracking-widest">{TRACK.bitrate}</p>
              </div>
            </div>
          </div>

          {/* CENTER: PLAYER */}
          <div className="flex flex-col items-center justify-center text-center space-y-3 sm:space-y-4 md:space-y-6 w-full max-w-lg mx-auto">
            
            {/* Title */}
            <div className="relative group w-full">
              <h1 className="relative text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-cyan-100 to-cyan-300 select-none drop-shadow-[0_0_20px_rgba(255,255,255,0.4)] animate-[pulse_4s_ease-in-out_infinite]">
                {TRACK.title}
              </h1>
              <div className="h-[1px] w-1/2 mx-auto bg-gradient-to-r from-transparent via-cyan-400 to-transparent mt-2 opacity-70 shadow-[0_0_10px_rgba(34,211,238,0.5)]"></div>
            </div>

            {/* Timer */}
            <div className="flex flex-col items-center w-full max-w-md px-2">
              <div className="relative flex items-center justify-center mb-2">
                <span 
                  className="text-5xl sm:text-6xl md:text-7xl font-black tabular-nums tracking-tighter drop-shadow-[0_0_15px_rgba(34,211,238,0.6)] transition-all duration-300"
                  style={{ 
                    color: isPlaying ? timeColor : '#22d3ee',
                    textShadow: isPlaying ? `0 0 20px ${timeColor}, 0 0 40px ${timeColor}` : '0 0 15px rgba(34,211,238,0.6)'
                  }}
                >
                  {formatTime(currentTime)}
                </span>
              </div>

              {/* Progress */}
              <div
                onClick={handleProgressBarClick}
                className="w-full h-1.5 sm:h-2 bg-cyan-950/70 rounded-full overflow-hidden border border-cyan-500/30 backdrop-blur-sm relative cursor-pointer hover:h-3 transition-all shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]"
              >
                <div 
                  className="h-full bg-gradient-to-r from-cyan-400 to-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.8)] relative"
                  style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                >
                  <div className="absolute right-0 top-0 bottom-0 w-3 bg-white shadow-[0_0_15px_#fff,0_0_30px_rgba(34,211,238,0.8)]"></div>
                </div>
              </div>
              
              <div className="flex justify-between w-full mt-1.5 px-1 text-[8px] sm:text-[9px] text-cyan-300 font-bold">
                <span className="drop-shadow-[0_0_3px_rgba(34,211,238,0.5)]">00:00:00</span>
                <span className="drop-shadow-[0_0_3px_rgba(34,211,238,0.5)]">{formatTime(duration)}</span>
              </div>
            </div>

            {/* Controls */}
            <button
              onClick={togglePlay}
              disabled={audioError !== null || isLoading}
              className="group relative w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center focus:outline-none transition-transform hover:scale-105 active:scale-95"
            >
              <div className={`absolute inset-0 rounded-full border border-cyan-500/50 transition-transform duration-1000 ${isPlaying ? 'rotate-180 scale-110' : ''} shadow-[0_0_15px_rgba(34,211,238,0.4)]`}></div>
              <div className={`absolute inset-2 rounded-full border-2 border-dashed border-cyan-400/40 ${isPlaying ? 'animate-[spin_12s_linear_infinite]' : ''}`}></div>
              <div className={`absolute inset-3 sm:inset-4 rounded-full bg-black/60 border border-cyan-400/30 backdrop-blur-md group-hover:bg-cyan-500/20 flex items-center justify-center transition-all ${isPlaying ? 'shadow-[0_0_30px_rgba(34,211,238,0.5)]' : 'shadow-[0_0_15px_rgba(34,211,238,0.3)]'}`}>
                {isLoading ? (
                  <div className="w-6 h-6 border-2 border-cyan-500/40 border-t-cyan-300 rounded-full animate-spin shadow-[0_0_10px_rgba(34,211,238,0.5)]"></div>
                ) : isPlaying ? (
                  <Square className="w-5 h-5 sm:w-6 sm:h-6 fill-orange-400 text-orange-400 drop-shadow-[0_0_15px_rgba(251,146,60,0.8)]" />
                ) : (
                  <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-cyan-300 text-cyan-300 ml-0.5 sm:ml-1 drop-shadow-[0_0_15px_rgba(34,211,238,0.8)]" />
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

          {/* RIGHT: CONTROLS - Now visible on all screens */}
          <div className="flex flex-row md:flex-col items-end justify-center space-x-3 md:space-x-0 md:space-y-6 h-auto md:h-full w-full md:w-auto">
            
            {/* Radar disc - smaller on mobile */}
            <div className={`w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 border border-cyan-500/60 rounded-full flex items-center justify-center relative flex-shrink-0 ${isPlaying ? 'animate-[spin_4s_linear_infinite]' : ''} shadow-[0_0_20px_rgba(34,211,238,0.3)]`}>
              <Disc className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-cyan-400/60" />
              <div className="absolute w-1.5 h-1.5 bg-orange-400 rounded-full top-2 sm:top-2.5 left-1/2 -translate-x-1/2 shadow-[0_0_10px_rgba(251,146,60,0.8)]"></div>
            </div>

            {/* OSC bars */}
            <div className="w-full md:max-w-[150px] text-right flex-shrink-0">
              <div className="flex items-center justify-end gap-2 mb-1">
                <span className="text-[8px] sm:text-[9px] text-orange-400 font-bold tracking-widest">OSC</span>
                <Activity className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-orange-400 animate-pulse" />
              </div>
              <div className="flex gap-1 justify-end h-8 sm:h-10 md:h-12 items-end">
                {[...Array(12)].map((_, i) => (
                  <div 
                    key={i}
                    className="w-1 sm:w-1.5 bg-gradient-to-t from-cyan-900 to-cyan-400 rounded-t-sm transition-all duration-100"
                    style={{
                      height: isPlaying ? `${15 + Math.random() * 85}%` : '15%',
                      opacity: (12 - i) / 12 + 0.3,
                      boxShadow: isPlaying ? '0 0 5px rgba(34,211,238,0.5)' : 'none'
                    }}
                  ></div>
                ))}
              </div>
            </div>

            {/* Volume & fullscreen - stacked on mobile */}
            <div className="flex flex-row md:flex-col items-center md:items-end gap-2 md:gap-3 w-full md:max-w-[150px] flex-shrink-0">
              <div className="flex items-center gap-2 justify-end w-full">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={handleVolumeChange}
                  className="w-12 sm:w-14 md:w-16 h-1.5 bg-cyan-950/70 rounded-full appearance-none cursor-pointer accent-cyan-400 shadow-[inset_0_0_5px_rgba(0,0,0,0.5)]"
                />
                <Volume2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-cyan-400" />
              </div>
              <button onClick={toggleFullscreen} className="flex items-center gap-1.5 sm:gap-2 text-cyan-400 hover:text-cyan-200 group transition-colors">
                <span className="text-[8px] sm:text-[9px] font-bold tracking-widest whitespace-nowrap">MAXIMIZE</span>
                <Maximize2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 group-hover:scale-110 transition-transform" />
              </button>
            </div>
          </div>
        </main>

        {/* ===== FOOTER ===== */}
        <footer className="pt-2 border-t border-cyan-700/40 flex justify-between items-center text-[8px] sm:text-[9px] font-bold tracking-widest text-cyan-300/90 shrink-0">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-green-400 animate-pulse shadow-[0_0_10px_rgba(74,222,128,0.8)]' : 'bg-red-900'}`}></div>
              <span className="text-white/90">SYS_ACTIVE</span>
            </div>
            <span className="hidden sm:inline text-cyan-200/80">IMMERSIVE_VX</span>
          </div>
          <div className="flex items-center gap-2">
             <span className="text-cyan-200/80 font-medium">MAK.PROJ</span>
          </div>
        </footer>

      </div>
    </div>
  );
}
