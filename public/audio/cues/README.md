# Custom voice cues (STA Trainer)

Drop your own recorded voice clips here and the guided STA trainer will play
them at each phase transition and hold milestone. Recording your own (or a
professional voiceover) sounds far more "alive" than synthetic speech.

## Where files go

```
public/audio/cues/<lang>/<key>.mp3
```

`<lang>` is `el` (Greek) or `en` (English). Files are optional — any cue
without a file simply stays silent, so you can add them gradually.

## Filenames (per language)

Phase transitions:

| key            | plays when…                    | suggested line (EN)               |
|----------------|--------------------------------|-----------------------------------|
| `breathe.mp3`  | breathe-up starts              | "Relax. Breathe slowly and deeply." |
| `hold.mp3`     | hold starts                    | "Final breath. Hold."             |
| `recovery.mp3` | recovery starts                | "Recovery. Take your breaths."    |

Hold milestones (played once when the hold crosses that time):

| key         | at    |
|-------------|-------|
| `m30.mp3`   | 0:30  |
| `m60.mp3`   | 1:00  |
| `m90.mp3`   | 1:30  |
| `m120.mp3`  | 2:00  |
| `m150.mp3`  | 2:30  |
| `m180.mp3`  | 3:00  |
| `m210.mp3`  | 3:30  |
| `m240.mp3`  | 4:00  |
| `m300.mp3`  | 5:00  |

## Tips

- Keep clips short (1–3s) and calm. They play over the soundscape.
- Any web-friendly format works if you rename the extension in `cueSrc()`
  (`src/lib/trainer-fx.ts`) — mp3 is the safe default across browsers.
- The "Voice" toggle in the trainer turns these on/off; the preference is
  remembered per device.
