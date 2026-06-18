import { Input } from "@/components/ui/input";
import { fromSeconds, toSeconds } from "@/lib/diving";
import { useI18n } from "@/lib/i18n";

interface TimeInputProps {
  /** total seconds */
  value: number;
  onChange: (totalSeconds: number) => void;
}

/** MM:SS input for time-based disciplines (e.g. STA). */
export function TimeInput({ value, onChange }: TimeInputProps) {
  const { t } = useI18n();
  const { minutes, seconds } = fromSeconds(value || 0);

  const setMinutes = (m: number) => onChange(toSeconds(Math.max(0, m || 0), seconds));
  const setSeconds = (s: number) => {
    const clamped = Math.min(59, Math.max(0, s || 0));
    onChange(toSeconds(minutes, clamped));
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        <Input
          type="number"
          inputMode="numeric"
          min="0"
          max="20"
          value={minutes === 0 && value === 0 ? "" : minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
          placeholder="0"
          aria-label={t("common.minutes")}
          className="text-center text-lg tabular-nums"
        />
        <p className="mt-1 text-center text-[0.65rem] text-muted-foreground">{t("common.minutes")}</p>
      </div>
      <span className="pb-5 text-xl font-bold text-muted-foreground">:</span>
      <div className="flex-1">
        <Input
          type="number"
          inputMode="numeric"
          min="0"
          max="59"
          value={seconds === 0 && value === 0 ? "" : seconds}
          onChange={(e) => setSeconds(Number(e.target.value))}
          placeholder="00"
          aria-label={t("common.seconds")}
          className="text-center text-lg tabular-nums"
        />
        <p className="mt-1 text-center text-[0.65rem] text-muted-foreground">{t("common.seconds")}</p>
      </div>
    </div>
  );
}
