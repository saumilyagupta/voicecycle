# Building VoiceCycle

This guide covers a local build on Windows. macOS and Linux work the same way with `./gradlew` instead of `gradlew.bat`.

## Requirements

| Tool | Version | Notes |
|---|---|---|
| Node.js | 20 LTS or newer | Runs Expo and the tests |
| JDK | 17 | Android Studio ships one in `C:\Program Files\Android\Android Studio\jbr` |
| Android SDK | Platform 36, Build-Tools 36.0.0, Platform-Tools, NDK 27.1.12297006 | Install with Android Studio's SDK Manager or `sdkmanager` |

Android Studio is the easiest way to get the JDK and SDK, but it is not required. A portable JDK 17 (for example Eclipse Temurin) plus the Android command-line tools also work.

### Environment variables

Set these once for your user account in PowerShell, then open a new terminal. Adjust the JDK path to your install.

```powershell
$jdk = "C:\Program Files\Android\Android Studio\jbr"
$sdk = "$env:LOCALAPPDATA\Android\Sdk"
[Environment]::SetEnvironmentVariable('JAVA_HOME', $jdk, 'User')
[Environment]::SetEnvironmentVariable('ANDROID_HOME', $sdk, 'User')
$path = [Environment]::GetEnvironmentVariable('Path', 'User')
[Environment]::SetEnvironmentVariable('Path', "$jdk\bin;$sdk\platform-tools;$path", 'User')
```

Check them:

```powershell
java -version      # must report 17
adb --version
```

### Install dependencies

```powershell
npm install
```

## Run on your phone (development build)

VoiceCycle contains native code, so it does **not** run in Expo Go.

1. On the phone, enable **Developer options** (tap **Build number** 7 times) and turn on **USB debugging**.
2. Connect it by USB and accept the debugging prompt.
3. Check it is listed:

   ```powershell
   adb devices
   ```

4. Build, install and launch the development build. This also starts the Metro bundler:

   ```powershell
   npm run android
   ```

After the first install, `npm start` is enough for JavaScript changes. Changes under `modules/voicecycle-player/android` or in `app.json` need `npm run android` again.

The `android/` folder is generated from `app.json` and the config plugins, and it is not committed. Do not edit it by hand. Regenerate it with:

```powershell
npx expo prebuild --platform android --clean
```

## Release APK

```powershell
npx expo prebuild --platform android   # only if android/ is missing
npm run build:apk
```

The APK is written to `android\app\build\outputs\apk\release\app-release.apk`. Install it on the connected phone:

```powershell
adb install -r android\app\build\outputs\apk\release\app-release.apk
```

You can also copy the APK to the phone and open it there, after allowing installs from that source.

The default APK is about 70 MB because it contains native code for all four CPU types. For a smaller file that installs on any modern 64-bit phone, build only `arm64-v8a`:

```powershell
cd android
.\gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a
```

## Signing

Without extra setup the release APK is signed with the Android debug key. That is fine for installing on your own phone. Android refuses to update an app signed with a different key, so pick one approach and keep it.

To sign with your own key, create a keystore once and keep it outside the project:

```powershell
keytool -genkeypair -v -storetype PKCS12 -keystore "$env:USERPROFILE\.android-keys\voicecycle.jks" -alias voicecycle -keyalg RSA -keysize 2048 -validity 10000
```

Add these lines to `%USERPROFILE%\.gradle\gradle.properties`. That file lives in your user folder, never in the repository:

```properties
VOICECYCLE_UPLOAD_STORE_FILE=C:/Users/YOUR_NAME/.android-keys/voicecycle.jks
VOICECYCLE_UPLOAD_STORE_PASSWORD=your-store-password
VOICECYCLE_UPLOAD_KEY_ALIAS=voicecycle
VOICECYCLE_UPLOAD_KEY_PASSWORD=your-key-password
```

The config plugin `plugins/withReleaseSigning.js` picks them up automatically when present. Back up the keystore: losing it means you cannot update the installed app without uninstalling it first.

## Cloud build with EAS

If the local build fails, Expo can build the APK in the cloud. It needs a free Expo account.

```powershell
npx eas-cli@latest login
npx eas-cli@latest build:configure
```

In the generated `eas.json`, give the `preview` profile `"android": { "buildType": "apk" }`, then run:

```powershell
npx eas-cli@latest build --platform android --profile preview
```

## Publishing a release on GitHub

The workflow in `.github/workflows/release.yml` builds the APK when you push a version tag and attaches it to a GitHub Release:

```powershell
git tag v1.0.0
git push origin v1.0.0
```

That APK is signed with the debug key of the build machine, so each release build has a different key. Users who install a newer release must uninstall the old one first. For seamless updates, build and sign releases locally with your own key as described above, and upload that APK to the release instead.

## Diagnostics

Every state change of the playback service is logged. With the phone connected:

```powershell
adb logcat -s VoiceCycle:I
```

Example from an emulator run with a random 6–24 s wait and random 1–3 plays per round, screen off and Doze forced on:

```
IDLE -> PLAYING on Start effects=[START_FROM_BEGINNING] reps=0 round=0/1 waitMs=0 sessionLeftMs=180000
PLAYING -> WAITING on PlaybackCompleted effects=[ENTER_WAIT] reps=1 round=0/2 waitMs=17000 sessionLeftMs=164316
WAITING -> PLAYING on Tick effects=[START_FROM_BEGINNING] reps=1 round=0/2 waitMs=17000 sessionLeftMs=147298
PLAYING -> PLAYING on PlaybackCompleted effects=[START_FROM_BEGINNING] reps=2 round=1/2 waitMs=17000 sessionLeftMs=132074
PLAYING -> WAITING on PlaybackCompleted effects=[ENTER_WAIT] reps=3 round=0/1 waitMs=9000 sessionLeftMs=116936
...
PLAYING -> STOPPED on Tick effects=[FADE_AND_STOP] reps=7 round=2/3 waitMs=18000 sessionLeftMs=0 reason=SESSION_COMPLETE
```
