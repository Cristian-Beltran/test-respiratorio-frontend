import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { SessionData } from "@/modules/Session/session.interface";

interface VitalSignsChartProps {
  /** Registros crudos del backend (nueva interfaz) */
  data: SessionData[];
  title?: string;
  description?: string;
  showBpm?: boolean;
  showSpo2?: boolean;
  showRespRate?: boolean;
}

// Colores directos para las series
const LINE_COLORS = {
  bpm: "#2563eb", // azul
  spo2: "#16a34a", // verde
  respRate: "#f97316", // naranja
};

export function VitalSignsChart({
  data,
  title = "Signos Vitales",
  description = "Evolución de frecuencia cardíaca, saturación de oxígeno y frecuencia respiratoria",
  showBpm = true,
  showSpo2 = true,
  showRespRate = true,
}: VitalSignsChartProps) {
  const chartConfig = {
    bpm: { label: "Frecuencia Cardíaca (bpm)" },
    spo2: { label: "Saturación O₂ (%)" },
    respRate: { label: "Respiración (rpm)" },
  };

  // Adaptar SessionData -> puntos del chart
  const points = (data ?? []).map((r) => ({
    timestamp: r.recordedAt,
    bpm: r.bpm ?? null,
    spo2: r.spo2 ?? null,
    respRate: r.respRate ?? null,
  }));

  const formatTime = (timestamp: string) =>
    new Date(timestamp).toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={{
            bpm: { label: chartConfig.bpm.label },
            spo2: { label: chartConfig.spo2.label },
            respRate: { label: chartConfig.respRate.label },
          }}
        >
          <ResponsiveContainer width="100%" height={320}>
            <LineChart
              data={points}
              margin={{ top: 8, right: 28, left: 12, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="timestamp"
                tickFormatter={formatTime}
                className="text-xs fill-muted-foreground"
                interval="preserveStartEnd"
              />
              {/* Eje izquierdo: BPM / SpO2 */}
              <YAxis yAxisId="left" className="text-xs fill-muted-foreground" />
              {/* Eje derecho: RespRate */}
              {showRespRate && (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  className="text-xs fill-muted-foreground"
                  domain={[0, 60]}
                />
              )}

              <ChartTooltip
                content={<ChartTooltipContent labelFormatter={formatTime} />}
              />
              <Legend />

              {showBpm && (
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="bpm"
                  name={chartConfig.bpm.label}
                  stroke={LINE_COLORS.bpm}
                  strokeWidth={2}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              )}

              {showSpo2 && (
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="spo2"
                  name={chartConfig.spo2.label}
                  stroke={LINE_COLORS.spo2}
                  strokeWidth={2}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              )}

              {showRespRate && (
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="respRate"
                  name={chartConfig.respRate.label}
                  stroke={LINE_COLORS.respRate}
                  strokeDasharray="5 3"
                  strokeWidth={2}
                  dot={{ strokeWidth: 2, r: 3, stroke: LINE_COLORS.respRate }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
