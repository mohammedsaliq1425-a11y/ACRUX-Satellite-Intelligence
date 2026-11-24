import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceArea, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";

export const COLORS = { signal: "#22D3EE", electric: "#3B82F6", accent: "#8B5CF6", warn: "#FBBF24", bad: "#F87171", ok: "#34D399", mute: "#94A3B8" };
export interface Series { key: string; label: string; color?: string }
const axis = { stroke: "#94A3B8", fontSize: 11 };
const tip = { contentStyle: { background: "#101A30", border: "1px solid #1E2A45", borderRadius: 8, fontSize: 12 }, labelStyle: { color: "#E8EEF8" } };

function Empty({ text }: { text: string }) { return <p className="grid h-40 place-items-center text-sm text-mute">{text}</p>; }

export function SeriesChart({ data, xKey, series, xLabel, yLabel, height = 220, emptyText = "No data to chart.", areas = [], title }: {
  data: Record<string, number | string | null>[]; xKey: string; series: Series[]; xLabel?: string; yLabel?: string; height?: number; emptyText?: string;
  areas?: { x1: number; x2: number; color: string }[]; title: string;
}) {
  if (data.length === 0) return <Empty text={emptyText} />;
  return (
    <div role="img" aria-label={title} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 18, left: 0 }}>
          <CartesianGrid stroke="#1E2A45" strokeDasharray="3 3" />
          <XAxis dataKey={xKey} {...axis} label={xLabel ? { value: xLabel, position: "insideBottom", offset: -10, fill: "#94A3B8", fontSize: 11 } : undefined} />
          <YAxis {...axis} width={52} label={yLabel ? { value: yLabel, angle: -90, position: "insideLeft", fill: "#94A3B8", fontSize: 11 } : undefined} />
          <Tooltip {...tip} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {areas.map((a, i) => <ReferenceArea key={i} x1={a.x1} x2={a.x2} fill={a.color} fillOpacity={0.15} />)}
          {series.map((s) => <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color ?? COLORS.signal} dot={false} strokeWidth={2} connectNulls={false} isAnimationActive={false} />)}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BarsChart({ data, xKey, series, xLabel, yLabel, height = 220, emptyText = "No data to chart.", title }: {
  data: Record<string, number | string | null>[]; xKey: string; series: Series[]; xLabel?: string; yLabel?: string; height?: number; emptyText?: string; title: string;
}) {
  if (data.length === 0) return <Empty text={emptyText} />;
  return (
    <div role="img" aria-label={title} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 18, left: 0 }}>
          <CartesianGrid stroke="#1E2A45" strokeDasharray="3 3" />
          <XAxis dataKey={xKey} {...axis} label={xLabel ? { value: xLabel, position: "insideBottom", offset: -10, fill: "#94A3B8", fontSize: 11 } : undefined} />
          <YAxis {...axis} width={52} label={yLabel ? { value: yLabel, angle: -90, position: "insideLeft", fill: "#94A3B8", fontSize: 11 } : undefined} />
          <Tooltip {...tip} cursor={{ fill: "rgba(59,130,246,0.1)" }} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {series.map((s) => <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color ?? COLORS.electric} isAnimationActive={false} />)}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ScatterPlot({ points, xLabel, yLabel, color = COLORS.signal, height = 260, logX = false, logY = false, emptyText = "No data to chart.", title }: {
  points: { x: number; y: number; label?: string }[]; xLabel: string; yLabel: string; color?: string; height?: number; logX?: boolean; logY?: boolean; emptyText?: string; title: string;
}) {
  if (points.length === 0) return <Empty text={emptyText} />;
  return (
    <div role="img" aria-label={title} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 12, bottom: 22, left: 4 }}>
          <CartesianGrid stroke="#1E2A45" strokeDasharray="3 3" />
          <XAxis type="number" dataKey="x" name={xLabel} scale={logX ? "log" : "auto"} domain={logX ? ["auto", "auto"] : undefined} {...axis} label={{ value: xLabel, position: "insideBottom", offset: -12, fill: "#94A3B8", fontSize: 11 }} />
          <YAxis type="number" dataKey="y" name={yLabel} scale={logY ? "log" : "auto"} domain={logY ? ["auto", "auto"] : undefined} {...axis} width={56} label={{ value: yLabel, angle: -90, position: "insideLeft", fill: "#94A3B8", fontSize: 11 }} />
          <ZAxis range={[28, 28]} />
          <Tooltip {...tip} cursor={{ strokeDasharray: "3 3" }} />
          <Scatter data={points} fill={color} isAnimationActive={false} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
