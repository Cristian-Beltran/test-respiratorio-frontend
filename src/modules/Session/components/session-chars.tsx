import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { sessionStore } from "../data/session.store";
import type { Session, SessionData } from "../session.interface";

type ChartRow = {
  session: string;
  date: string;
  avgAirflow: number;
  avgBpm: number;
  avgMic: number;
  avgRespRate: number;
  avgSpo2: number;
  avgRespDiffAbs: number;
  avgResp2Adc: number;
  resp2PositivePct: number; // 0..100
};

// === helpers ===
const toDateStr = (iso: string) =>
  new Date(iso).toLocaleDateString("es-ES", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

function avgOf(
  records: SessionData[],
  pick: (r: SessionData) => number | null | undefined,
) {
  const vals = records
    .map(pick)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (!vals.length) return 0;
  const sum = vals.reduce((a, b) => a + b, 0);
  return +(sum / vals.length).toFixed(2);
}

function pctTrue(
  records: SessionData[],
  pick: (r: SessionData) => boolean | null | undefined,
) {
  const vals = records
    .map(pick)
    .filter((v): v is boolean => typeof v === "boolean");
  if (!vals.length) return 0;
  const trues = vals.filter(Boolean).length;
  return +((trues / vals.length) * 100).toFixed(1);
}

export function SessionCharts() {
  const { sessions } = sessionStore();

  const chartData: ChartRow[] = useMemo(() => {
    return (sessions as Session[]).map((session, index) => {
      const records = session.records ?? [];
      return {
        session: `S${index + 1}`,
        date: toDateStr(session.startedAt),

        // Promedios robustos (ignoran null/NaN)
        avgAirflow: avgOf(records, (r) => r.airflowValue ?? null),
        avgBpm: avgOf(records, (r) => r.bpm ?? null),
        avgMic: avgOf(records, (r) => r.micAirValue ?? null), // legado
        avgRespRate: avgOf(records, (r) => r.respRate ?? null),
        avgSpo2: avgOf(records, (r) => r.spo2 ?? null),
        avgRespDiffAbs: avgOf(records, (r) => r.respDiffAbs ?? null),

        // Respiración secundaria
        avgResp2Adc: avgOf(records, (r) => r.resp2Adc ?? null),
        resp2PositivePct: pctTrue(records, (r) => r.resp2Positive ?? null),
      };
    });
  }, [sessions]);

  if (!sessions.length) {
    return (
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Resumen de Sesiones</CardTitle>
          <CardDescription>Sin datos disponibles</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Paleta por variable (usa CSS vars del tema)
  const sensorConfig = {
    avgAirflow: { label: "Flujo de Aire", color: "hsl(var(--primary))" },
    avgBpm: {
      label: "Pulso (BPM)",
      color: "hsl(var(--chart-2, var(--secondary)))",
    },
    avgMic: {
      label: "Soplido (Mic)",
      color: "hsl(var(--chart-3, var(--accent)))",
    },
    avgRespRate: {
      label: "Resp/min",
      color: "hsl(var(--chart-4, var(--muted-foreground)))",
    },
    avgSpo2: {
      label: "SpO₂ (%)",
      color: "hsl(var(--chart-5, var(--foreground)))",
    },
    avgRespDiffAbs: {
      label: "|Δ| Resp",
      color: "hsl(var(--chart-6, var(--ring)))",
    },
    avgResp2Adc: {
      label: "Resp2 ADC",
      color: "hsl(var(--chart-7, var(--destructive)))",
    },
    resp2PositivePct: {
      label: "% Positiva Resp2",
      color: "hsl(var(--chart-8, var(--border)))",
    },
  } as const;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* === Gráfica 1 — Promedio por sesión (4 señales clave) === */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Promedio por Sesión</CardTitle>
          <CardDescription>
            Comparativa de flujo, cardio y respiración: Airflow, BPM, SpO₂ y
            Resp/min.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={{
              avgAirflow: sensorConfig.avgAirflow,
              avgBpm: sensorConfig.avgBpm,
              avgSpo2: sensorConfig.avgSpo2,
              avgRespRate: sensorConfig.avgRespRate,
            }}
            className="h-[320px] w-full"
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="session" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />

                <Line
                  type="monotone"
                  dataKey="avgAirflow"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name={sensorConfig.avgAirflow.label}
                />
                <Line
                  type="monotone"
                  dataKey="avgBpm"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name={sensorConfig.avgBpm.label}
                />
                <Line
                  type="monotone"
                  dataKey="avgSpo2"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name={sensorConfig.avgSpo2.label}
                />
                <Line
                  type="monotone"
                  dataKey="avgRespRate"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name={sensorConfig.avgRespRate.label}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* === Gráfica 2 — Cardio (BPM) y Oxigenación (SpO2) por fecha === */}
      <Card>
        <CardHeader>
          <CardTitle>Cardio & Oxigenación</CardTitle>
          <CardDescription>Promedio de BPM y SpO₂ por sesión</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={{
              avgBpm: sensorConfig.avgBpm,
              avgSpo2: sensorConfig.avgSpo2,
            }}
            className="h-[280px] w-full"
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />

                <Line
                  type="monotone"
                  dataKey="avgBpm"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  name={sensorConfig.avgBpm.label}
                />
                <Line
                  type="monotone"
                  dataKey="avgSpo2"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  name={sensorConfig.avgSpo2.label}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* === Gráfica 3 — Respiración: señal, variación e input secundario === */}
      <Card>
        <CardHeader>
          <CardTitle>Respiración — Señal y Secundario</CardTitle>
          <CardDescription>
            Airflow vs |Δ| de respiración y ADC del sensor secundario.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={{
              avgAirflow: sensorConfig.avgAirflow,
              avgRespDiffAbs: sensorConfig.avgRespDiffAbs,
              avgResp2Adc: sensorConfig.avgResp2Adc,
            }}
            className="h-[280px] w-full"
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />

                <Line
                  type="monotone"
                  dataKey="avgAirflow"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name={sensorConfig.avgAirflow.label}
                />
                <Line
                  type="monotone"
                  dataKey="avgRespDiffAbs"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name={sensorConfig.avgRespDiffAbs.label}
                />
                <Line
                  type="monotone"
                  dataKey="avgResp2Adc"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name={sensorConfig.avgResp2Adc.label}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
