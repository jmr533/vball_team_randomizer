# Beach Volleyball Team Randomizer

A React web application that helps organize fair and balanced 2v2 beach volleyball games across multiple courts with intelligent rotation management.

## Features

### Core Functionality
- **Player Management**: Add and remove players with an intuitive input system
- **Multi-Court Support**: Configure 1-N courts based on available players (minimum 4 players per court)
- **Fair Rotation System**: Intelligent algorithm that prioritizes players who sat out previous games
- **Random Team Generation**: Creates balanced 2v2 teams with randomized partnerships
- **Game History**: Tracks all games and sitting rotations for transparency

### User Experience
- **PWA Support**: Works offline with service worker and manifest
- **Responsive Design**: Works on desktop and mobile devices
- **Keyboard Navigation**: Press Enter to quickly add players
- **Visual Feedback**: Clear indicators for waiting queues and game status
- **Real-time Updates**: Live player count and court availability

## How It Works

### Fair Rotation Algorithm
1. **Priority 1**: Players who sat out the last game are guaranteed to play next
2. **Priority 2**: Players who sat out in previous games get secondary priority
3. **Priority 3**: All other players are randomly selected
4. **Team Assignment**: Selected players are randomly divided into 2v2 teams

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

2. **Set Courts**: Use the +/- buttons to configure the number of courts based on your available playing area.

3. **Generate Teams**: Click "Generate Random Teams" to create the first game, or "Generate Game X" for subsequent rounds.

4. **Track Progress**: View sitting players and game history to ensure fair rotation.

5. **Reset**: Use "Reset All" to start fresh with new players or configuration.

## Technical Details

### Tech Stack
- **Frontend**: React 18 with functional components and hooks
- **Styling**: Tailwind CSS for responsive design
- **Icons**: Lucide React icon library
- **PWA**: Service worker and manifest for offline functionality
- **Deployment**: Vercel-ready configuration

### Key Components
- **State Management**: React hooks (useState, useRef, useEffect)
- **Player Input**: Dynamic array management with focus handling
- **Team Generation**: Fisher-Yates shuffle algorithm
- **History Tracking**: Game state persistence for fairness

### File Structure
```
src/
├── App.js          # Main application component
├── index.js        # React entry point
└── index.css       # Tailwind CSS imports

public/
├── index.html      # HTML template
├── manifefst.json  # PWA manifest
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