import React from 'react';

export interface TrackInfo {
  title: string;
  artist: string;
  format: string;
  bitrate: string;
  url: string;
}

export interface ThreeBackgroundProps {
  audioRef: React.RefObject<HTMLAudioElement>;
  isPlaying: boolean;
}
