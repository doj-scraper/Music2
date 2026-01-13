# MAKena Audio Core

A futuristic audio player web application built with React, Three.js, and Tailwind CSS. This project features a high-tech, cyber-punk inspired interface with 3D background elements and audio visualization.

## Tech Stack

*   **Frontend Framework:** React 19
*   **3D Graphics:** Three.js (via `@react-three/fiber` if applicable, or raw Three.js)
*   **Styling:** Tailwind CSS v3
*   **Build Tool:** Vite
*   **Icons:** Lucide React
*   **Language:** TypeScript

## Setup & Development

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Start Development Server:**
    ```bash
    npm run dev
    ```
    The application will be available at `http://localhost:3000`.

3.  **Build for Production:**
    ```bash
    npm run build
    ```
    The output will be in the `dist` folder.

## Project Structure

*   `src/`: Source code
    *   `components/`: React components (e.g., `ThreeBackground.tsx`)
    *   `App.tsx`: Main application component
    *   `index.tsx`: Entry point
    *   `index.css`: Global styles and Tailwind directives
    *   `types.ts`: TypeScript interfaces
*   `public/`: Static assets (Note: The main audio file is currently in `src` to support import behaviors)
*   `tailwind.config.js`: Tailwind CSS configuration
*   `vite.config.js`: Vite configuration

## Deployment (Vercel)

This project is configured for easy deployment on Vercel.

1.  Push the code to a Git repository (GitHub, GitLab, Bitbucket).
2.  Import the project into Vercel.
3.  Vercel should automatically detect the Vite framework and set the build command to `npm run build` and output directory to `dist`.
4.  Deploy!
