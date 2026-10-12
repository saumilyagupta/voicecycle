# VoiceCycle

VoiceCycle plays one of your own audio recordings, waits a set number of minutes after it ends, and plays it again from the beginning. It repeats until you stop it or the session timer runs out. It is built for overnight use with the screen locked.

Example: a 12-minute recording, a 10-minute wait and an 8-hour session give about 22 plays.

Everything runs offline. There are no accounts, ads, analytics or network calls.

## How it works

The whole cycle runs inside a native Android **foreground media service**, not in JavaScript.

| Piece | Where | Job |
|---|---|---|
| `CycleStateMachine.kt` | `modules/voicecycle-player/android/...` | Pure, unit-tested transition logic for IDLE, PLAYING, WAITING, PAUSED, STOPPED |
| `PlaybackService.kt` | same | Foreground service of type `mediaPlayback`. Owns `MediaPlayer`, the media session, audio focus, a partial wake lock and the timers |
| `PlaybackNotification.kt` | same | Ongoing notification with Pause/Resume and Stop, plus lock-screen media controls. During the wait it shows a live countdown |
| `VoiceCyclePlayerModule.kt` | same | Expo module bridge. Forwards commands and streams state snapshots to JS |
| `src/` | TypeScript | UI, settings, file import. It only renders what the service reports |

Why not `expo-audio` with a JavaScript timer? Android suspends the JavaScript thread when the app is in the background. A `setTimeout` that should fire after a 10-minute silent wait may fire hours late or not at all. The service keeps its own clock (`SystemClock.elapsedRealtime`) and holds a partial wake lock only while a session is playing or waiting, so the next play starts on time with the screen off. Media3's built-in session service was also rejected: it leaves the foreground state when playback pauses, and Android 12+ then refuses to restart playback from the background after the silent wait.

The service is the single source of truth. The UI never runs its own playback timers, so reopening the app cannot start a duplicate loop. A second Start while a session is active is ignored by the state machine.

### State machine

```
IDLE/STOPPED --Start--> PLAYING --recording ends--> WAITING --wait elapses--> PLAYING ...
PLAYING/WAITING --Pause--> PAUSED --Resume--> (back to where it was)
any active state --Stop / session time up / error--> STOPPED
```

Rules:

- The wait starts when the recording **ends**, never when it starts.
- A wait of 0 replays immediately.
- **Pause freezes everything**: the recording position, the wait countdown and the session timer. A session paused for an hour still has the same time left when resumed.
- **Pause during the wait** keeps the remaining countdown. Resume continues it, then the recording plays from the beginning.
- When the session timer reaches zero during a play, the recording fades out over 3 seconds and stops.
- When a recording ends and the session time left is not longer than the wait, the session ends right away instead of waiting in silence for nothing.
- Stop cancels playback, the pending wait and the session timer.

### Interruptions

| Event | Behaviour |
|---|---|
| Phone call or alarm during a play | Pauses. Resumes automatically when the call ends (Android 8+) |
| Next play is due during a call | Waits for the call to end, then plays |
| Another app starts playing music | Pauses and stays paused until you press Resume |
| Headphones unplugged | Pauses |
| Silent wait | Audio focus is released, so other apps may play during the wait |
| App swiped away from Recents | The session keeps running. Stop it from the notification |

### What survives and what does not

| Situation | Result |
|---|---|
| Screen locked, app in background, other apps in use | Session continues. This is the supported case |
| Android kills the app (aggressive battery saver, low memory) | The session ends. It is **not** restarted automatically. Next time you open the app it tells you the last session was cut off and after how many plays |
| Phone restarts | The session ends and is not resumed |
| Recording file deleted (app data cleared) | The app asks you to select the recording again |

Automatic recovery after a kill or reboot is deliberately not implemented. Restarting audio in the middle of the night without user action would be surprising, and it could not be tested reliably.

### Battery settings for overnight use

The app does not ask for a battery-optimisation exemption. A foreground media service with a wake lock is normally enough. Some phone brands still kill background apps. If the app reports in the morning that a session was cut off:

1. Open **Settings > Apps > VoiceCycle > Battery** and choose **Unrestricted** (wording varies: "Don't optimise", "No restrictions").
2. On Samsung, remove VoiceCycle from **Sleeping apps** and **Deep sleeping apps** under Battery > Background usage limits.
3. On Xiaomi, Oppo, Vivo, Huawei or OnePlus, also allow **Autostart** and lock the app in Recents. See https://dontkillmyapp.com for your model.
4. Keep the phone charging overnight if possible. Battery Saver modes may restrict background work.

## Settings

- **Wait between plays**: 0, 5, 10, 15, 20, 30 minutes, or a custom value from 0 to 240 minutes. Decimals are allowed, so `0.5` means 30 seconds, which is handy for testing.
- **Session length**: 1, 2, 4, 6, 8 hours, or a custom value from 1 to 1440 minutes.
- **Theme**: Dusk, Black (for OLED screens) or Ember (warm, low blue light).

The selected recording, wait, session length and theme are saved. Picked recordings are copied into the app's private storage, so they stay playable even if the original file is moved. Settings are locked while a session runs and apply to the next one.

## Windows setup

You need Node.js LTS, a JDK 17 and the Android SDK. Android Studio is optional.

This machine already has:

| Tool | Location |
|---|---|
| JDK 17 (Temurin, portable) | `%LOCALAPPDATA%\vc-tools\jdk-17.0.20.1+1` |
| Android SDK (platform 36, build-tools 36.0.0, platform-tools, NDK 27.1) | `%LOCALAPPDATA%\Android\Sdk` |

Make them permanent for your user account. Run once in PowerShell, then open a new terminal:

```powershell
$jdk = "$env:LOCALAPPDATA\vc-tools\jdk-17.0.20.1+1"
$sdk = "$env:LOCALAPPDATA\Android\Sdk"
[Environment]::SetEnvironmentVariable('JAVA_HOME', $jdk, 'User')
[Environment]::SetEnvironmentVariable('ANDROID_HOME', $sdk, 'User')
$path = [Environment]::GetEnvironmentVariable('Path', 'User')
[Environment]::SetEnvironmentVariable('Path', "$jdk\bin;$sdk\platform-tools;$path", 'User')
```

Check:

```powershell
java -version      # must say 17
adb --version
```

If you install Android Studio instead, point `JAVA_HOME` at its bundled JDK (`C:\Program Files\Android\Android Studio\jbr`) and keep `ANDROID_HOME` as above.

Install JavaScript dependencies:

```powershell
npm install
```

## Run on your phone (development build)

VoiceCycle contains native code, so it does **not** run in Expo Go.

1. On the phone, enable Developer options and USB debugging.
2. Connect it by USB and accept the debugging prompt.
3. Check it is listed:

```powershell
adb devices
```

4. Build, install and start the development build. This also starts the Metro bundler:

```powershell
npm run android
```

After the first install you only need the bundler for JavaScript changes:

```powershell
npm start
```

Changes in `modules/voicecycle-player/android` or `app.json` need `npm run android` again.

The `android/` folder is generated from `app.json` and the config plugins. Do not edit it by hand. Regenerate it with:

```powershell
npx expo prebuild --platform android --clean
```

## Checks

```powershell
npm test              # Jest: formatting, settings validation, display logic, signing plugin
npm run test:native   # JUnit: playback state machine (needs JAVA_HOME and ANDROID_HOME)
npm run typecheck
npm run lint
```

## Release APK

```powershell
npx expo prebuild --platform android   # only if android/ is missing
npm run build:apk
```

The APK is written to:

```
android\app\build\outputs\apk\release\app-release.apk
```

Install it on the connected phone:

```powershell
adb install -r android\app\build\outputs\apk\release\app-release.apk
```

You can also copy the APK to the phone and open it there, after allowing installs from that source.

The APK is about 70 MB because it contains native code for all four CPU types. For a smaller file that installs on any modern 64-bit phone, build only `arm64-v8a`:

```powershell
cd android
.\gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a
```

### Diagnostics

Every state change of the playback service is logged. With the phone connected:

```powershell
adb logcat -s VoiceCycle:I
```

Example output from an emulator test with the screen off and Doze forced on:

```
IDLE -> PLAYING on Start effects=[START_FROM_BEGINNING] reps=0 sessionLeftMs=90000
PLAYING -> WAITING on PlaybackCompleted effects=[ENTER_WAIT] reps=1 sessionLeftMs=74602
WAITING -> PLAYING on Tick effects=[START_FROM_BEGINNING] reps=1 sessionLeftMs=59546
...
PLAYING -> STOPPED on PlaybackCompleted effects=[STOP_PLAYER] reps=3 sessionLeftMs=14176 reason=SESSION_COMPLETE
```

### Signing

Without extra setup, the release APK is signed with the debug key. That is fine for installing on your own phone. Note that Android refuses to update an app signed with a different key, so pick one approach and stick to it.

To sign with your own key, create a keystore once and keep it outside the project:

```powershell
keytool -genkeypair -v -storetype PKCS12 -keystore "$env:USERPROFILE\.android-keys\voicecycle.jks" -alias voicecycle -keyalg RSA -keysize 2048 -validity 10000
```

Then add these lines to `%USERPROFILE%\.gradle\gradle.properties`. That file is in your user folder, never in the repository:

```properties
VOICECYCLE_UPLOAD_STORE_FILE=C:/Users/YOUR_NAME/.android-keys/voicecycle.jks
VOICECYCLE_UPLOAD_STORE_PASSWORD=your-store-password
VOICECYCLE_UPLOAD_KEY_ALIAS=voicecycle
VOICECYCLE_UPLOAD_KEY_PASSWORD=your-key-password
```

The config plugin `plugins/withReleaseSigning.js` uses them automatically when present. Back up the keystore. Losing it means you cannot update the installed app without uninstalling it first.

### Cloud build alternative (EAS)

If the local build fails, Expo can build the APK in the cloud. It needs a free Expo account.

```powershell
npx eas-cli@latest login
npx eas-cli@latest build:configure
```

In the generated `eas.json`, give the `preview` profile `"android": { "buildType": "apk" }`, then run:

```powershell
npx eas-cli@latest build --platform android --profile preview
```

## Test procedure

Use a short recording (20 to 60 seconds) and short settings so each test takes minutes. A custom wait of `0.5` gives 30 seconds. A custom session of `3` gives 3 minutes. Watch the status, countdown and "Plays completed" in the app or the notification.

| # | Test | Steps | Expected |
|---|---|---|---|
| 1 | Short recording with short wait | Wait 0.5, session 10, Start | Recording plays to the end, status shows Waiting with a 0:30 countdown, then it plays again from 0:00 |
| 2 | Multiple repetitions | Same as 1 for 5 minutes | Plays completed increases by one after each play. No overlap or skipped waits |
| 3 | Zero wait | Wait 0, Start | The recording restarts right after it ends. Count increases each time |
| 4 | Pause during playback | Pause at 0:10 | Audio stops. Status Paused. Session time left stops decreasing |
| 5 | Pause during the wait | Pause with 0:20 left in the wait | Countdown freezes at about 0:20 and the next play does not start |
| 6 | Resume after pause | Resume after tests 4 and 5 | 4 continues from 0:10. 5 continues the countdown, then plays from the beginning |
| 7 | Stop during playback | Stop mid-recording | Audio stops at once. Notification disappears. Status Stopped |
| 8 | Stop during the wait | Stop while waiting, then wait longer than the wait time | Nothing plays again |
| 9 | Session expiry | Wait 0.5, session 2 | Within 2 minutes of active time the audio fades out or the session ends at a recording end. Status Stopped, "Session time is up" |
| 10 | Screen locked during playback | Start, lock the phone | Audio continues. The next play after the wait is heard with the screen off |
| 11 | Screen locked during the wait | Lock the phone while Waiting | The next play starts on time. Lock-screen controls show Pause and Stop |
| 12 | Switch apps | Open other apps during play and wait | The cycle continues. Starting music in another app pauses VoiceCycle |
| 13 | Inaccessible file | Settings > Apps > VoiceCycle > Storage > Clear storage, reopen the app | The app asks you to select a recording again. Start is disabled until you do |
| 14 | No duplicate playback | During a session, leave the app and reopen it several times, also from the notification | One audio stream only. The app shows the same state as the notification |
| 15 | Interruptions | Call the phone during a play | Pauses during the call and resumes afterwards |
| 16 | Notification controls | Use Pause, Resume and Stop from the notification and lock screen | Same effect as the in-app buttons |

### Overnight checklist (physical device only)

An emulator run does not prove overnight reliability. Before relying on the app:

- [ ] Install the **release** APK, not the development build. Debug builds are slower and depend on the bundler.
- [ ] Allow notifications when asked.
- [ ] Apply the battery settings above for your phone brand.
- [ ] First night: a 2-hour session with your real recording and wait, phone locked and unplugged.
- [ ] In the morning, open the app. The note under the status says whether the last session finished, and after how many plays. Compare with the plays estimate shown under Session length.
- [ ] Repeat with the phone charging, and with Battery Saver on if you use it at night.
- [ ] Only then rely on a full 8-hour session.

## Project layout

```
App.tsx                         Root component
src/screens/HomeScreen.tsx      The single screen
src/components/                 Presentational UI pieces
src/hooks/                      usePlayer (native state), useSettings (persistence)
src/domain/                     Pure logic: time formatting, settings validation, display text
src/services/                   AsyncStorage settings, recording import
src/theme/                      Night colour themes
modules/voicecycle-player/      Local Expo module with the native Android player
plugins/withReleaseSigning.js   Optional release signing from Gradle properties
```

The app has a single screen, so Expo Router is not used.

iOS is not supported. The native player is Android-only.
