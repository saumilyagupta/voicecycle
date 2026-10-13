---
name: Bug report
about: Playback stopped, timing was wrong, or something else misbehaved
labels: bug
---

**What happened**

**What you expected**

**Settings**
- Wait between plays (fixed or random range):
- Plays in a row (fixed or random range):
- Session length:
- Recording format and length:

**Phone**
- Model:
- Android version:
- VoiceCycle version:
- Battery setting for VoiceCycle (Optimised / Unrestricted / Restricted):
- Battery Saver on? Phone charging?
- Was the screen locked?

**What the app said the next morning** (the note under the status, if any)

**Log** (optional, very helpful)

Connect the phone by USB and run this right after the problem:

```
adb logcat -d -s VoiceCycle:I
```

Paste the output here.
