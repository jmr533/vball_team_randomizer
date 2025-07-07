# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
This is a React-based Progressive Web App (PWA) for organizing fair beach volleyball team rotation. The application runs entirely in the browser with no backend dependencies.

### Core Components and State Management
- **Single Component Architecture**: All logic is contained in `App.js` using React hooks
- **State Management**: Uses React's `useState` for all state management:
  - `players`: Array of player names
  - `teams`: Generated team matchups per court
  - `gameHistory`: Complete history of all games for fairness tracking
  - `waitingQueue`: Players guaranteed to play next game
  - `sittingOut`: Players sitting out current game

### Key Algorithms
- **Fair Rotation System**: Three-tier priority system ensuring minimal sitting time
  1. Players who sat out last game (guaranteed spots)
  2. Players who sat out in previous games (secondary priority)
  3. Random selection from remaining players
- **Team Generation**: Fisher-Yates shuffle algorithm for randomizing team assignments
- **Multi-Court Support**: Dynamically calculates courts based on player count (4 players per court)

### Technical Architecture
- **PWA Features**: Service worker (`public/sw.js`) with cache-first strategy for offline support
- **Styling**: Tailwind CSS for responsive design and component styling
- **Icons**: Lucide React for consistent iconography
- **Focus Management**: Keyboard navigation with automatic focus handling for player input

### Key Files
- `src/App.js` - Main application component containing all game logic
- `src/index.js` - React entry point with service worker registration
- `src/index.css` - Tailwind CSS imports
- `public/sw.js` - Service worker for offline caching
- `public/manifest.json` - PWA manifest configuration

### State Flow
1. Players are added to dynamic input array
2. Court count is calculated based on player count (minimum 4 per court)
3. Team generation uses fairness algorithm to select playing players
4. Game history tracks sitting patterns for future fairness
5. Waiting queue ensures players who sat out get priority next game

### Development Notes
- Uses Create React App with standard ESLint configuration
- No backend or database - all state is client-side only
- Designed for Vercel deployment with included `vercel.json`
- PWA manifest includes offline support and mobile app-like experience