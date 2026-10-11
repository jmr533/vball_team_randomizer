# Beach Volleyball Team Randomizer

Fair beach-volleyball team rotation across 1-4 courts, built as a single-page React app with Vite.

Website: https://vball-team-randomizer.vercel.app/

## Run

```bash
npm install
npm start
```

Open http://localhost:3000.

## Build

```bash
npm run build
```

Outputs a static site to `dist/`. `npm run preview` serves that build locally.

## Validation

`npm run verify:web` runs the Vitest suite once, lints `src/` with ESLint, and creates a production build.

## Local session behavior

- One versioned session schema stores players, courts, modes, current teams, sitting-out players, round history, and the appearance setting in `localStorage`.
- Appearance can be set to **Light**, **Dark**, or **System** and is restored on restart.
- **Reset All** clears matchups and round history while keeping the roster and court setup.
- **Start Over** asks for confirmation, then clears all saved session data and returns the theme to **System**.

## Test

```bash
npm test
```

## Files

- `index.html` - Vite HTML entry; loads `src/main.jsx`
- `src/App.jsx` - main UI and team generation
- `src/gameHelpers.js` - game constants and fairness helpers
- `src/Toast.jsx` / `src/useToast.js` - toast notifications
- `src/session.js` - versioned session schema, serialization, and normalization
- `src/sessionStorage.js` - `localStorage`-backed session store
- `src/theme.js` - document theme helpers
