import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { format } from "date-fns";
import type { Dive, DisciplineCode } from "@/lib/diving";
import { formatResult, isTimeDiscipline } from "@/lib/diving";

interface PBChartProps {
  dives: Dive[];
  discipline: DisciplineCode;
}

/** Running personal-best progression over time for a discipline. */
export function PBChart({ dives, discipline }: PBChartProps) {
  const sorted = [...dives]
    .filter((d) => d.discipline === discipline)
    .sort(
      (a, b) => a.dive_date.localeCompare(b.dive_date) || a.created_at.localeCompare(b.created_at),
    );

  let running = -Infinity;
  const data = sorted.map((d) => {
    running = Math.max(running, d.result);
    return {
      date: d.dive_date,
      result: d.result,
      best: running,
      label: format(new Date(`${d.dive_date}T00:00`), "d MMM"),
    };
  });

  const isTime = isTimeDiscipline(discipline);

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.4} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            width={42}
            tickFormatter={(v) => (isTime ? formatResult(discipline, v) : String(v))}
          />
          <Tooltip
            contentStyle={{
              background: "var(--color-popover)",
              border: "1px solid var(--color-border)",
              borderRadius: 12,
              fontSize: 12,
            }}
            labelStyle={{ color: "var(--color-foreground)" }}
            formatter={(value: number, name: string) => [
              formatResult(discipline, value),
              name === "best" ? "PB" : "Dive",
            ]}
          />
          <Line
            type="monotone"
            dataKey="result"
            stroke="var(--color-muted-foreground)"
            strokeWidth={1.5}
            dot={{ r: 2 }}
            strokeDasharray="4 4"
          />
          <Line
            type="monotone"
            dataKey="best"
            stroke="var(--color-primary)"
            strokeWidth={2.5}
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
