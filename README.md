# Beach Volleyball Team Randomizer

`main` is the shared product branch for fair beach-volleyball team rotation across 1-4 courts. The root React app supplies the complete user interface and game logic for both the website and the Capacitor Android wrapper; there is no maintained Android feature branch.

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

## Validation

- `npm run verify:web` runs the React tests once in CI mode and creates a production web build.
- `npm run android:sync` builds that same root web app, then copies it into the Android wrapper.
- `npm run verify:android` syncs Android and runs Gradle unit tests, lint, and a debug APK build.
- `npm run verify:platforms` runs shared React tests once, then validates web and Android from the same checkout.

Use `verify:web` for browser-only changes, `verify:android` for wrapper/native changes, and `verify:platforms` for shared UI, session, or theme changes.

## Android

### Requirements

- Node.js 22 or newer
- Android Studio 2025.2.1 or newer
- Android SDK Platform 36 and Build Tools 36
- An Android 7/API 24 or newer device or emulator

On macOS, use Android Studio's bundled JDK for command-line builds:

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
```

Generate the web build and copy it into the native project:

```bash
npm run android:sync
```

Open the native project in Android Studio:

```bash
npm run android:open
```

Build a debug APK:

```bash
npm run android:build:debug
```

The debug artifact is written to `android/app/build/outputs/apk/debug/app-debug.apk`. Install it on a connected device with:

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

### Release signing

Android updates must use the same signing key as the installed version. Create the key outside this repository and keep both the keystore and its credentials backed up securely:

```bash
mkdir -p "$HOME/.android/keystores"
keytool -genkeypair -v \
  -keystore "$HOME/.android/keystores/vball-team-randomizer.jks" \
  -alias vball-team-randomizer \
  -keyalg RSA \
  -keysize 4096 \
  -validity 10000
```

Provide signing values through environment variables, then build:

```bash
export VBALL_RELEASE_STORE_FILE="$HOME/.android/keystores/vball-team-randomizer.jks"
export VBALL_RELEASE_STORE_PASSWORD='<keystore password>'
export VBALL_RELEASE_KEY_ALIAS='vball-team-randomizer'
export VBALL_RELEASE_KEY_PASSWORD='<key password>'
npm run android:build:release
```

This workstation stores the generated key password in the macOS login Keychain under service `com.vballteamrandomizer.app.release`. Restore the signing environment without printing the password using:

```bash
export VBALL_RELEASE_STORE_FILE="$HOME/.android/keystores/vball-team-randomizer.jks"
export VBALL_RELEASE_STORE_PASSWORD="$(security find-generic-password -a "$USER" -s com.vballteamrandomizer.app.release -w)"
export VBALL_RELEASE_KEY_ALIAS='vball-team-randomizer'
export VBALL_RELEASE_KEY_PASSWORD="$VBALL_RELEASE_STORE_PASSWORD"
```

The signed artifact is written to `android/app/build/outputs/apk/release/app-release.apk`. Signing keys, credentials, APKs, and local SDK paths are ignored by Git. The release build fails instead of silently creating an unsigned APK when signing values are missing.

Regenerate launcher and splash assets after changing `assets/logo.svg`:

```bash
npm run android:assets
```

### Local session behavior

- One versioned session schema stores players, courts, modes, current teams, sitting-out players, round history, and the appearance setting. The browser stores it in `localStorage`; Android stores it with Capacitor Preferences.
- Appearance can be set to **Light**, **Dark**, or **System** and is restored on restart.
- **Reset All** clears matchups and round history while keeping the roster and court setup.
- **Start Over** asks for confirmation, then clears all saved session data and returns the theme to **System**.
- The application assets and fonts are bundled, so Android team generation works offline.

Release signing and release APK creation are explicit tasks, not part of normal synchronization or validation.

## Test

```bash
npm test
```

## Files

- `src/App.js` - main UI and team generation
- `src/gameHelpers.js` - game constants and fairness helpers
- `src/Toast.js` / `src/useToast.js` - toast notifications
- `src/session.js` - shared versioned session schema, serialization, and normalization
- `src/sessionStorage.js` - queued browser (`localStorage`) and Android (Capacitor Preferences) adapters
- `src/theme.js` / `src/nativeTheme.js` - shared document theme and Android-only system-bar bridge
- `capacitor.config.json` - native app identity and web asset configuration
- `android/` - generated and configured native Android project
