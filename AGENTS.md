# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Development Commands

### Core Development
- `npm start` - Start Vite dev server (runs on http://localhost:3000)
- `npm run build` - Build production bundle to `dist/`
- `npm run preview` - Serve the production build locally
- `npm test` - Run Vitest (watch mode) with React Testing Library
- `npm run lint` - Lint `src/` with ESLint
- `npm run verify:web` - Run tests once, lint, and build the web app

### Installation
- `npm install` - Install all dependencies

## Project Architecture

### High-Level Structure
A single-page React app built with Vite. `index.html` loads `src/main.jsx`; all UI and game logic live under `src/`. Deployed as a static site.

### Core Components and State Management
- **App Component**: `src/App.jsx` owns UI state and team generation orchestration
- **Game Helpers**: `src/gameHelpers.js` holds constants, player utilities, and fairness/stat helpers
- **State Management**: Uses React's `useState` for all state management:
  - `players`: Array of player objects with id, name, and preferredModes
  - `teams`: Generated team matchups per court
  - `gameHistory`: Complete history of all games for fairness tracking
  - `sittingOut`: Players sitting out current game
  - `waitingQueue`: Derived from the last game's `sittingOut` when between rounds (not separate state)

### Key Algorithms
- **Fair Rotation System**: Players who were eligible and sat out the previous game are prioritized for the next round. Other eligible players are then selected using sit-out, play-count, and preference-flexibility statistics, with a randomized tie-breaker.
- **Team Generation**: `splitCourtIntoTeams` scores every possible split of a court and picks the one repeating the fewest recent partnerships (never last game's partner when avoidable), with a random tie-breaker
- **Multi-Court Support**: Configure 1-4 courts with independent 2v2/3v3/4v4 modes

### Technical Architecture
- **Styling**: Tailwind CSS for responsive design and component styling
- **Icons**: Lucide React for consistent iconography
- **Toasts**: `src/Toast.jsx` and `src/useToast.js` for user feedback
- **Focus Management**: Keyboard navigation with automatic focus handling for player input
- **Persistence**: `src/session.js` defines the versioned session schema; `src/sessionStorage.js` reads/writes it synchronously in localStorage. `App.jsx` restores the session in its initial state, so there is no loading phase.
- **Theme**: `src/theme.js` applies Light/Dark/System in the document.

### Key Files
- `src/App.jsx` - Main application component and team generation UI
- `src/gameHelpers.js` - Shared game logic, constants, and fairness helpers
- `src/main.jsx` - React entry point
- `src/index.css` - Tailwind CSS imports
- `src/Toast.jsx` - Toast notification component
- `src/useToast.js` - Toast state hook

### State Flow
1. Players are added to dynamic input array
2. Court count and per-court game modes are configured
3. Team generation uses fairness algorithm to select playing players
4. Game history tracks sitting patterns for future fairness
5. Between rounds, waiting queue is derived from the previous game's sitting-out list

### Development Notes
- Vite + Vitest (`vite.config.js`, jsdom, test globals); ESLint flat config in `eslint.config.js`. Files containing JSX use the `.jsx` extension.
- Designed for static deployment on Vercel (or any static host) via `vercel.json`
- Sessions persist in localStorage.
