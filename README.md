# Beach Volleyball Team Randomizer

React and Capacitor app for fair beach volleyball team rotation across 1-4 courts. It runs as both a website and a native Android app, with the Android session stored locally on the device.

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

- Players, courts, modes, current teams, sitting-out players, and round history survive an app restart.
- Appearance can be set to **Light**, **Dark**, or **System** and is restored on restart.
- **Reset All** clears matchups and round history while keeping the roster and court setup.
- **Start Over** asks for confirmation, then clears all saved session data and returns the theme to **System**.
- The application assets and fonts are bundled, so team generation works offline.

## Test

```bash
npm test
```

## Files

- `src/App.js` - main UI and team generation
- `src/gameHelpers.js` - game constants and fairness helpers
- `src/Toast.js` / `src/useToast.js` - toast notifications
- `src/sessionPersistence.js` - versioned, queued on-device session storage
- `capacitor.config.json` - native app identity and web asset configuration
- `android/` - generated and configured native Android project
