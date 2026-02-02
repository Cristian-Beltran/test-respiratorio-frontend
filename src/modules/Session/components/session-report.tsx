import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { Session, SessionData } from "@/modules/Session/session.interface";

type MetricStats = { avg: number; min: number; max: number };

function arrNums(
  records: SessionData[],
  pick: (r: SessionData) => number | null | undefined,
) {
  return records
    .map(pick)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
}

function computeStats(
  records: SessionData[],
  pick: (r: SessionData) => number | null | undefined,
): MetricStats {
  const vals = arrNums(records, pick);
  const sum = vals.reduce((a, b) => a + b, 0);
  const avg = vals.length ? sum / vals.length : 0;
  const min = vals.length ? Math.min(...vals) : 0;
  const max = vals.length ? Math.max(...vals) : 0;
  return {
    avg: +avg.toFixed(2),
    min: +min.toFixed(2),
    max: +max.toFixed(2),
  };
}

function fmtDate(d: string | Date) {
  const dt = new Date(d);
  return dt.toLocaleDateString("es-ES", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}
function fmtDateTime(d: string | Date) {
  const dt = new Date(d);
  return dt.toLocaleString("es-ES", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function fmtTime(d: string | Date) {
  return new Date(d).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function SignalChart({
  title,
  data,
  dataKey,
}: {
  title: string;
  data: any[];
  dataKey: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      {/* Para PDF: altura fija */}
      <CardContent className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="index" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey={dataKey} name={title} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function SessionReport({ session }: { session: Session }) {
  const records = session.records ?? [];

  const patientName = session.patient?.user?.fullname ?? "Paciente";
  const deviceLabel = [
    session.device?.model ?? "",
    session.device?.serialNumber ? `(${session.device.serialNumber})` : "",
  ]
    .join(" ")
    .trim();

  const meta = `${fmtDateTime(session.startedAt)}${
    session.endedAt ? ` — ${fmtDateTime(session.endedAt)}` : ""
  }`;

  const stats = React.useMemo(
    () => ({
      bpm: computeStats(records, (r) => r.bpm ?? null),
      spo2: computeStats(records, (r) => r.spo2 ?? null),
      resp: computeStats(records, (r) => r.respRate ?? null),
      air: computeStats(records, (r) => r.airflowValue ?? null),
    }),
    [records],
  );

  const series = React.useMemo(() => {
    return records.map((r, idx) => ({
      index: idx + 1,
      time: r.recordedAt ? fmtTime(r.recordedAt) : "",
      bpm: typeof r.bpm === "number" ? r.bpm : null,
      spo2: typeof r.spo2 === "number" ? r.spo2 : null,
      respRate: typeof r.respRate === "number" ? r.respRate : null,
      airflowValue: typeof r.airflowValue === "number" ? r.airflowValue : null,
    }));
  }, [records]);

  return (
    <div className="space-y-4">
      {/* Header del reporte */}
      <Card>
        <CardHeader className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base">Reporte de sesión</CardTitle>
              <div className="text-xs text-muted-foreground">{meta}</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono text-[11px]">
                {session.id.slice(0, 8)}…
              </Badge>
              <Badge variant="secondary">{deviceLabel || "—"}</Badge>
              <Badge variant="outline">{records.length} lecturas</Badge>
            </div>
          </div>
          <div className="text-sm font-medium">{patientName}</div>
        </CardHeader>
      </Card>

      {/* KPIs */}
      <div className="grid gap-3 md:grid-cols-4">
        <Kpi title="Pulso (BPM)" s={stats.bpm} />
        <Kpi title="SpO₂ (%)" s={stats.spo2} />
        <Kpi title="Resp/min" s={stats.resp} />
        <Kpi title="Flujo Aire" s={stats.air} />
      </div>

      <Separator />

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SignalChart title="Pulso (BPM)" data={series} dataKey="bpm" />
        <SignalChart title="SpO₂ (%)" data={series} dataKey="spo2" />
        <SignalChart title="Resp/min" data={series} dataKey="respRate" />
        <SignalChart title="Flujo Aire" data={series} dataKey="airflowValue" />
      </div>

      <Separator />

      {/* Tabla completa */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Lecturas (tabla completa)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto rounded-md border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b">
                  <th className="p-2 text-left">#</th>
                  <th className="p-2 text-left">Hora</th>
                  <th className="p-2 text-right">BPM</th>
                  <th className="p-2 text-right">SpO₂</th>
                  <th className="p-2 text-right">Resp/min</th>
                  <th className="p-2 text-right">Air</th>
                  <th className="p-2 text-right">Base</th>
                  <th className="p-2 text-right">|Δ|</th>
                  <th className="p-2 text-right">Mic</th>
                  <th className="p-2 text-right">cmH2O</th>
                  <th className="p-2 text-left">R2 Dir</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, idx) => (
                  <tr key={r.id ?? idx} className="border-b last:border-b-0">
                    <td className="p-2">{idx + 1}</td>
                    <td className="p-2 font-mono">
                      {r.recordedAt ? fmtTime(r.recordedAt) : "—"}
                    </td>
                    <td className="p-2 text-right font-mono">{num(r.bpm)}</td>
                    <td className="p-2 text-right font-mono">{num(r.spo2)}</td>
                    <td className="p-2 text-right font-mono">
                      {num(r.respRate)}
                    </td>
                    <td className="p-2 text-right font-mono">
                      {num(r.airflowValue)}
                    </td>
                    <td className="p-2 text-right font-mono">
                      {num(r.respBaseline)}
                    </td>
                    <td className="p-2 text-right font-mono">
                      {num(r.respDiffAbs)}
                    </td>
                    <td className="p-2 text-right font-mono">
                      {num(r.micAirValue)}
                    </td>
                    <td className="p-2 text-right font-mono">
                      {num(r.resp2Adc)}
                    </td>
                    <td className="p-2">{boolText(r.resp2Positive)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Nota: si la tabla es gigante, el PDF saldrá multipágina por el helper */}
          <div className="mt-2 text-[11px] text-muted-foreground">
            Fecha: {fmtDate(new Date())}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ title, s }: { title: string; s: MetricStats }) {
  return (
    <Card className="border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Avg</span>
          <span className="font-mono">{s.avg.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Min</span>
          <span className="font-mono">{s.min.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Max</span>
          <span className="font-mono">{s.max.toFixed(2)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function num(v: unknown) {
  return typeof v === "number" && Number.isFinite(v) ? v.toFixed(2) : "—";
}
function boolText(v: unknown) {
  if (v === true) return "Positiva";
  if (v === false) return "Negativa";
  return "—";
}
