# Testing VoiceCycle

## Automated tests

```powershell
npm test              # Jest: settings validation, time formatting, display text, session reports, signing plugin
npm run test:native   # JUnit: playback state machine, rounds and random draws (needs JAVA_HOME and ANDROID_HOME)
npm run typecheck
npm run lint
```

| Suite | Tests | Covers |
|---|---|---|
| Jest | 57 | Settings parsing and migration, custom input parsing, start delay, plays estimate, status text, session reports, release signing plugin |
| JUnit `CycleStateMachineTest` | 20 | Start, wait timing, pause and resume in every state, stop, session expiry, interruptions, duplicate start |
| JUnit `RoundsAndRandomTest` | 11 | Back-to-back rounds, random waits, random round sizes, clamping, draw ranges and edge cases |
| JUnit `StartDelayTest` | 9 | Silent delay before the first play, frozen session clock, pause, resume and stop during the delay, duplicate start |

The same checks run on every push through `.github/workflows/ci.yml`.

## Emulator results

These were run on an Android 15 emulator with a 15-second test recording. Doze was forced with `adb shell dumpsys deviceidle force-idle` and the screen turned off.

| Scenario | Result |
|---|---|
| Fixed 15 s wait, 1.5 min session, screen off, deep Doze | Each wait took 15.0 s. 3 plays, then automatic stop |
| Random wait 6–24 s, random 1–3 plays per round, 3 min session, deep Doze | Rounds of 1, 2, 1, 1, 3 plays. Waits of 17, 9, 19, 18 s. Faded out when time was up |
| Pause mid-recording, resume | Continued from the paused position |
| Pause during the wait, resume | Countdown and session timer froze, then the replay came on time |
| Stop during the wait | Replay cancelled, notification removed |
| Leave and reopen the app during a session | One session only |
| Force-kill during a session | Next launch reports the session was cut off after 1 play |
| Cold restart | Recording and all settings restored |

An emulator does not prove long-session reliability on a real phone. Use the checklist at the end of this page.

## Manual test procedure

Use a short recording (20 to 60 seconds) and short settings so each test takes minutes. A custom wait of `0.5` gives 30 seconds. A custom session of `3` gives 3 minutes. Watch the status, countdown and "Plays completed" in the app or in the notification.

| # | Test | Steps | Expected |
|---|---|---|---|
| 1 | Short recording with short wait | Wait 0.5, session 10, Start | Recording plays to the end, status shows Waiting with a 0:30 countdown, then it plays again from 0:00 |
| 2 | Multiple repetitions | Same as 1 for 5 minutes | Plays completed increases by one after each play. No overlap or skipped waits |
| 3 | Zero wait | Wait 0, Start | The recording restarts right after it ends |
| 4 | Pause during playback | Pause at 0:10 | Audio stops. Status Paused. Session time left stops decreasing |
| 5 | Pause during the wait | Pause with 0:20 left in the wait | Countdown freezes at about 0:20 and the next play does not start |
| 6 | Resume after pause | Resume after tests 4 and 5 | 4 continues from 0:10. 5 continues the countdown, then plays from the beginning |
| 7 | Stop during playback | Stop mid-recording | Audio stops at once. Notification disappears. Status Stopped |
| 8 | Stop during the wait | Stop while waiting, then wait longer than the wait time | Nothing plays again |
| 9 | Session expiry | Wait 0.5, session 2 | The session ends on its own. Status Stopped, "Session time is up" |
| 10 | Screen locked during playback | Start, lock the phone | Audio continues. The next play after the wait is heard with the screen off |
| 11 | Screen locked during the wait | Lock the phone while Waiting | The next play starts on time. Lock-screen controls show Pause and Stop |
| 12 | Switch apps | Open other apps during play and wait | The cycle continues. Starting music in another app pauses VoiceCycle |
| 13 | Inaccessible file | Settings > Apps > VoiceCycle > Storage > Clear storage, reopen the app | The app asks you to select a recording again. Start is disabled until you do |
| 14 | No duplicate playback | During a session, leave and reopen the app several times, also from the notification | One audio stream only. The app shows the same state as the notification |
| 15 | Interruptions | Call the phone during a play | Pauses during the call and resumes afterwards |
| 16 | Notification controls | Use Pause, Resume and Stop from the notification and lock screen | Same effect as the in-app buttons |
| 17 | Random wait | Wait Random, min 0.1 and max 0.4, session 3 | Each wait is a different length between 6 and 24 seconds. Status shows "Random wait of 0:17 this time" |
| 18 | Plays in a row | Plays in a row 3, wait 0.25 | The recording plays 3 times back to back, then waits 15 seconds. Status shows "Play 2 of 3 in this round" |
| 19 | Random plays in a row | Plays in a row Random, 1 to 3 | Rounds of 1, 2 or 3 plays in varying order |
| 20 | Start delay | Start delay custom 0.25, wait 0.25, session 2, Start, lock the phone | Status "Starting soon" with a 0:15 "First play in" countdown and silence. Then the first play, and "Session left" only starts going down from there |
| 21 | Pause and Stop during the start delay | Start delay 10, Pause, Resume, then Stop | The countdown freezes while paused and continues on Resume. Stop ends the session with 0 plays and nothing is played |

## Long-session checklist (physical phone)

Before relying on VoiceCycle for long sessions:

- [ ] Install the **release** APK, not the development build.
- [ ] Allow notifications when asked.
- [ ] Apply the battery settings from the README for your phone brand.
- [ ] Run a 2-hour session with your real recording and settings, phone locked and unplugged.
- [ ] Afterwards, open the app. The note under the status says whether the last session finished, and after how many plays. Compare it with the estimate under Session length.
- [ ] Repeat with the phone charging, and with Battery Saver on if you normally use it.
- [ ] Only then rely on sessions of several hours.
