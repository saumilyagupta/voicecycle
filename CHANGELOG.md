# Changelog

All notable changes to VoiceCycle are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- **Start delay**: press Start and let the first play begin after Off, 10, 20, 30 minutes or a custom delay up to 240 minutes. The session timer starts when the first play begins. Pause and Stop work during the countdown, and the notification shows "Starting soon".

## [1.0.1] - 2026-10-13

### Changed

- Neutral product wording across the README, docs and release notes.
- Refreshed screenshots and social preview image.
- Android version code raised to 2, so this APK installs as an update over 1.0.0 from the same signing key.

## [1.0.0] - 2026-10-13

First public release.

### Added

- Play a local recording, wait, and replay it from the beginning until you stop or the session timer ends.
- **Wait between plays**: presets of 0 to 30 minutes, a custom value up to 240 minutes, or a **random** wait between a minimum and maximum, drawn again for every round.
- **Plays in a row**: play the recording 1, 2, 3 or a custom number of times back to back before each wait, or a **random** count between a minimum and maximum for every round.
- **Session length**: presets of 1 to 8 hours or a custom length up to 24 hours. The session fades out when time is up.
- Native Android foreground media service that keeps the cycle running with the screen locked, verified under forced Doze.
- Pause and resume that freeze the recording, the wait countdown and the session timer.
- Lock-screen and notification controls, with a live countdown during the wait.
- Automatic pause for calls, other audio apps and unplugged headphones. Calls resume by themselves.
- Report of the last session: finished, stopped, failed, or cut off by Android.
- Three dark themes: Dusk, Black (OLED) and Ember.
- Settings and the selected recording are remembered. Recordings are copied into private app storage.
- Optional release signing from user-level Gradle properties.
- CI for tests and builds, and a tag-triggered workflow that publishes the APK.
