VoiceCycle is an offline Android app built with Expo SDK 57, React Native 0.86 and TypeScript. It plays a recording, waits a fixed or random time, and repeats with the screen locked. Read `docs/ARCHITECTURE.md` before changing playback behaviour.

## Architecture rules

- **The native service owns playback.** `modules/voicecycle-player/android` contains a foreground media service that runs the whole cycle. JavaScript only renders snapshots and sends commands. Never add JavaScript timers that drive playback: Android suspends JavaScript in the background.
- **`CycleStateMachine` is a pure reducer.** No Android imports. Time and random draws arrive inside events. Every new transition needs a JUnit test in `modules/voicecycle-player/android/src/test`.
- **Single screen, no Expo Router.** Keep UI in `src/components`, pure logic in `src/domain`, side effects in `src/services` and `src/hooks`.
- **`android/` is generated** by `expo prebuild` and not committed. Configure native behaviour in `app.json`, `plugins/`, or the local module.
- **Offline by design.** No network calls, analytics or accounts.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. Before writing code that touches an Expo or React Native API, read the matching versioned docs at `https://docs.expo.dev/versions/v57.0.0/`, or start from https://docs.expo.dev/llms.txt.

## Commands

```bash
npx expo install <package>   # always use instead of npm add, so versions match the SDK
npm run android              # build and install the development build
npm start                    # Metro bundler
npm run typecheck
npm run lint
npm test                     # Jest
npm run test:native          # JUnit state machine tests (Windows script; use ./gradlew elsewhere)
npm run build:apk            # release APK (Windows script)
```

Run typecheck, lint and both test suites before declaring a task done. Update `README.md`, `docs/` and `CHANGELOG.md` when behaviour changes.
