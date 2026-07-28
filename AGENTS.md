# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Development Commands

### Core Development
- `npm start` - Start development server (runs on http://localhost:3000)
- `npm run build` - Build production bundle
- `npm test` - Run tests with React Testing Library
- `npm run eject` - Eject from Create React App (irreversible)

### Installation
- `npm install` - Install all dependencies

## Project Architecture

### High-Level Structure
This is a React app for organizing fair beach volleyball team rotation. The application runs entirely in the browser with no backend dependencies.

### Core Components and State Management
- **App Component**: `src/App.js` owns UI state and team generation orchestration
- **Game Helpers**: `src/gameHelpers.js` holds constants, player utilities, and fairness/stat helpers
- **State Management**: Uses React's `useState` for all state management:
  - `players`: Array of player objects with id, name, and preferredModes
  - `teams`: Generated team matchups per court
  - `gameHistory`: Complete history of all games for fairness tracking
  - `sittingOut`: Players sitting out current game
  - `waitingQueue`: Derived from the last game's `sittingOut` when between rounds (not separate state)

### Key Algorithms
- **Fair Rotation System**: Players who were eligible and sat out the previous game are prioritized for the next round. Other eligible players are then selected using sit-out, play-count, and preference-flexibility statistics, with a randomized tie-breaker.
- **Team Generation**: Fisher-Yates shuffle algorithm for randomizing team assignments
- **Multi-Court Support**: Configure 1-4 courts with independent 2v2/3v3/4v4 modes

### Technical Architecture
- **Styling**: Tailwind CSS for responsive design and component styling
- **Icons**: Lucide React for consistent iconography
- **Toasts**: `src/Toast.js` and `src/useToast.js` for user feedback
- **Focus Management**: Keyboard navigation with automatic focus handling for player input

### Key Files
- `src/App.js` - Main application component and team generation UI
- `src/gameHelpers.js` - Shared game logic, constants, and fairness helpers
- `src/index.js` - React entry point
- `src/index.css` - Tailwind CSS imports
- `src/Toast.js` - Toast notification component
- `src/useToast.js` - Toast state hook

### State Flow
1. Players are added to dynamic input array
2. Court count and per-court game modes are configured
3. Team generation uses fairness algorithm to select playing players
4. Game history tracks sitting patterns for future fairness
5. Between rounds, waiting queue is derived from the previous game's sitting-out list

### Development Notes
- Uses Create React App with standard ESLint configuration
- Designed for static deployment on Vercel (or any static host) via `vercel.json`
- All game state is in-memory for the current browser session; refresh clears history
