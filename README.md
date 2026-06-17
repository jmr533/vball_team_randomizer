# Beach Volleyball Team Randomizer
Website: https://vball-team-randomizer.vercel.app/

A React web application that helps organize fair and balanced beach volleyball games across up to four courts with intelligent rotation management.

## Features

### Core Functionality
- **Player Management**: Add and remove players with an intuitive input system
- **Player Mode Preferences**: Mark each player as eligible for Any, 2v2, 3v3, and/or 4v4 games
- **Multi-Court Support**: Configure 1-4 courts for each round
- **Per-Court Game Modes**: Choose 2v2, 3v3, or 4v4 independently for each court
- **Fair Rotation System**: Intelligent algorithm that prioritizes players who sat out previous games
- **Random Team Generation**: Creates randomized teams for every selected court while respecting hard player mode preferences
- **Game History**: Tracks all games and sitting rotations for transparency

### User Experience
- **PWA Support**: Works offline with service worker and manifest
- **Responsive Design**: Works on desktop and mobile devices
- **Keyboard Navigation**: Press Enter to quickly add players
- **Visual Feedback**: Clear indicators for waiting queues and game status
- **Real-time Updates**: Live player count and court availability

## How It Works

### Fair Rotation Algorithm
1. **Eligibility**: Players can only be assigned to courts matching their selected game-mode preferences.
2. **Priority 1**: Eligible players who sat out the last game are prioritized to play next.
3. **Priority 2**: Eligible players who sat out in previous games get secondary priority.
4. **Priority 3**: All other eligible players are randomly selected.
5. **Team Assignment**: Selected players are randomly divided into teams based on each court's game mode.

This system ensures minimal sitting time and maximum fairness across all players.

## Getting Started

### Prerequisites
- Node.js (version 14 or higher)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/vball_team_randomizer.git
   cd vball_team_randomizer
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### Building for Production

```bash
npm run build
```

This creates a `build` folder with optimized production files.

## Usage

1. **Add Players**: Enter player names in the input fields. Press Enter to quickly add the next player.

2. **Set Player Preferences**: Use Any, 2v2, 3v3, and 4v4 toggles to choose each player's eligible game modes.

3. **Set Courts**: Use the +/- buttons to configure 1-4 courts based on your available playing area.

4. **Pick Game Modes**: Select 2v2, 3v3, or 4v4 for each active court.

5. **Generate Teams**: Click "Generate Random Teams" to create the first game, or "Generate Game X" for subsequent rounds.

6. **Track Progress**: View sitting players and game history to ensure fair rotation.

7. **Reset**: Use "Reset All" to start fresh with new players or configuration.

## Technical Details

### Tech Stack
- **Frontend**: React 18 with functional components and hooks
- **Styling**: Tailwind CSS for responsive design
- **Icons**: Lucide React icon library
- **PWA**: Service worker and manifest for offline functionality
- **Deployment**: Vercel-ready static configuration

### Key Components
- **State Management**: React hooks (useState, useRef, useEffect)
- **Player Input**: Dynamic array management with focus handling
- **Team Generation**: Fisher-Yates shuffle algorithm
- **History Tracking**: In-session game history for fairness

### File Structure
```
src/
├── App.js          # Main application component
├── gameHelpers.js  # Game logic and fairness helpers
├── Toast.js        # Toast notifications
├── useToast.js     # Toast hook
├── index.js        # React entry point
└── index.css       # Tailwind CSS imports

public/
├── index.html      # HTML template
├── manifest.json   # PWA manifest
├── icon.svg        # App icon
└── sw.js           # Service worker
```

## Deployment

The app is configured for deployment on Vercel. Simply connect your GitHub repository to Vercel for automatic deployments.

For other platforms:
1. Run `npm run build`
2. Deploy the `build` folder to your hosting service

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is open source and available under the [MIT License](LICENSE).

## Acknowledgments

- Built with React and Tailwind CSS
- Icons provided by Lucide React
- Inspired by the need for fair team rotation in recreational volleyball
