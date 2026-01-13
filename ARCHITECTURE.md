# Architecture Overview

## Design Philosophy
The application is designed to simulate a futuristic, high-fidelity audio interface ("MAK.PROJECT // CORE_AUDIO_V3"). It prioritizes visual immersion using WebGL (Three.js) and a responsive, grid-based UI (Tailwind CSS).

## Component Architecture

### `App.tsx`
The central orchestrator of the application. It manages:
*   **State:** `isPlaying`, `currentTime`, `duration`.
*   **Audio Handling:** Uses a standard HTML5 `<audio>` element with a React `ref` to control playback and sync UI state.
*   **UI Layout:** Defines the main grid structure (Metadata Sidebar, Core Player, Technical Analytics).
*   **Effects:** Manages the scanline and atmospheric overlay effects.

### `ThreeBackground.tsx` (`src/components/ThreeBackground.tsx`)
Handles the 3D visual layer.
*   **Libraries:** `three`
*   **Responsibility:** Renders a 3D scene (likely particles, waveforms, or abstract geometry) that reacts to or accompanies the audio playback. *Note: Currently accepts `audioRef` and `isPlaying` props to potentially drive visualizations.*

## Data Flow
1.  **User Interaction:** Play/Pause buttons trigger state updates in `App`.
2.  **Audio Events:** The `<audio>` element fires `timeupdate`, `loadedmetadata`, and `ended` events, which update the React state.
3.  **Rendering:**
    *   React updates the DOM elements (progress bar, time display, animations).
    *   Three.js (if integrated with the loop) renders the next frame of the background canvas.

## Styling System
*   **Tailwind CSS:** Used for layout, typography, colors (Cyan/Orange theme), and UI animations (pulse, spin).
*   **Custom Fonts:** `Inter` (UI) and `JetBrains Mono` (Technical data).
*   **Keyframes:** Custom animations for the "playing" state (e.g., rotating rings) are implemented using Tailwind utility classes or arbitrary values.

## Build Pipeline
*   **Vite:** handles the bundling. It compiles TypeScript, processes CSS (PostCSS/Tailwind), and optimizes assets.
*   **Assets:** Audio files are imported as modules to ensure they are hashed and included in the build output properly.
