import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  Legend,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import type { SessionData } from "@/modules/Session/session.interface";

import type { TooltipProps } from "recharts";
import type { Payload } from "recharts/types/component/DefaultTooltipContent";

type BreathingPhase = "inhale" | "hold" | "exhale" | "rest";

type Point = {
  timestamp: string;
  pressure: number;
  baseline?: number;
  phase: BreathingPhase;
};

interface BreathingPatternChartProps {
  /** Registros crudos del backend (nueva interfaz) */
  data: SessionData[];
  title?: string;
  description?: string;
  showBaseline?: boolean;
  showPhaseBands?: boolean;
}

// Colores directos para el gráfico
const BREATHING_CHART_COLORS = {
  pressureStroke: "#2563eb", // azul
  pressureFill: "rgba(37, 99, 235, 0.25)",
  baseline: "#6b7280", // gris
};

/** Heurística simple para derivar fase a partir de los nuevos campos */
function derivePhase(r: SessionData): BreathingPhase {
  const baseline = r.respBaseline ?? 0;
  const v = (r.airflowValue ?? 0) - baseline;
  const diff = Math.abs(r.respDiffAbs ?? v);

  // Si tenemos canal digital del secundario
  if (r.resp2Positive === true) return "exhale";
  if (r.resp2Positive === false) return "inhale";

  // Sin canal digital: usar diffs
  if (diff < 0.05) return "rest"; // zona muerta
  if (diff >= 0.05 && diff < 0.15) return "hold"; // transición/retención
  return v >= 0 ? "inhale" : "exhale";
}

export function BreathingPatternChart({
  data,
  title = "Patrón Respiratorio",
  description = "Análisis del patrón respiratorio basado en presión y fases",
  showBaseline = true,
  showPhaseBands = true,
}: BreathingPatternChartProps) {
  const chartConfig = {
    airflowValue: { label: "Presión (V)" },
    baseline: { label: "Línea Base" },
  };

  const points: Point[] = (data ?? []).map((r) => ({
    timestamp: r.recordedAt,
    pressure: r.airflowValue ?? 0,
    baseline: r.respBaseline ?? undefined,
    phase: derivePhase(r),
  }));

  const formatTime = (timestamp: string) =>
    new Date(timestamp).toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

  const getPhaseColor = (phase: BreathingPhase) => {
    switch (phase) {
      case "inhale":
        return {
          bg: "rgba(37,99,235,0.10)",
          badge: "bg-blue-100 text-blue-800",
        };
      case "hold":
        return {
          bg: "rgba(234,179,8,0.12)",
          badge: "bg-yellow-100 text-yellow-800",
        };
      case "exhale":
        return {
          bg: "rgba(22,163,74,0.12)",
          badge: "bg-green-100 text-green-800",
        };
      case "rest":
      default:
        return {
          bg: "rgba(107,114,128,0.10)",
          badge: "bg-gray-100 text-gray-800",
        };
    }
  };

  const getPhaseLabel = (phase: BreathingPhase) => {
    switch (phase) {
      case "inhale":
        return "Inspiración";
      case "hold":
        return "Retención";
      case "exhale":
        return "Expiración";
      case "rest":
        return "Reposo";
      default:
        return phase;
    }
  };

  const CustomTooltip: React.FC<TooltipProps<number, string>> = ({
    active,
    payload,
    label,
  }) => {
    if (!active || !payload || payload.length === 0) return null;

    const p0 = payload[0] as Payload<number, string>;
    const d = p0.payload as Point;

    const colors = getPhaseColor(d.phase);
    const labelStr = typeof label === "string" ? label : String(label);
    const pressure =
      typeof p0.value === "number"
        ? p0.value
        : Array.isArray(p0.value)
          ? Number(p0.value[0])
          : Number(p0.value);

    return (
      <div className="rounded-lg border bg-background p-3 shadow-md">
        <p className="text-sm font-medium">{formatTime(labelStr)}</p>
        <p className="text-sm">
          <span className="font-medium">Presión:</span> {pressure} V
        </p>
        {typeof d.baseline === "number" && (
          <p className="text-sm">
            <span className="font-medium">Base:</span> {d.baseline} V
          </p>
        )}
        <div className="mt-1">
          <Badge className={colors.badge} variant="secondary">
            {getPhaseLabel(d.phase)}
          </Badge>
        </div>
      </div>
    );
  };

  // Estadísticas simples
  const avgPressure =
    points.length > 0
      ? (
          points.reduce((sum, d) => sum + (d.pressure ?? 0), 0) / points.length
        ).toFixed(2)
      : "0";
  const maxPressure =
    points.length > 0
      ? Math.max(...points.map((d) => d.pressure ?? 0)).toFixed(2)
      : "0";
  const minPressure =
    points.length > 0
      ? Math.min(...points.map((d) => d.pressure ?? 0)).toFixed(2)
      : "0";

  // Bandas de fase continuas (en X)
  type Band = { x1: string; x2: string; phase: BreathingPhase };
  const bands: Band[] = [];
  if (showPhaseBands && points.length > 1) {
    let startIdx = 0;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const cur = points[i];
      if (prev.phase !== cur.phase) {
        bands.push({
          x1: points[startIdx].timestamp,
          x2: prev.timestamp,
          phase: prev.phase,
        });
        startIdx = i;
      }
    }
    bands.push({
      x1: points[startIdx].timestamp,
      x2: points[points.length - 1].timestamp,
      phase: points[startIdx].phase,
    });
  }

  // baseline media para ReferenceLine
  const avgBaseline = (() => {
    const vals = points
      .map((p) => p.baseline)
      .filter((v): v is number => typeof v === "number");
    if (!vals.length) return undefined;
    return +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(3);
  })();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {title}
          <div className="flex gap-2">
            <Badge variant="outline">Promedio: {avgPressure}V</Badge>
            <Badge variant="outline">Máx: {maxPressure}V</Badge>
            <Badge variant="outline">Mín: {minPressure}V</Badge>
          </div>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent>
        <ChartContainer config={{ pressure: { label: "Presión (V)" } }}>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart
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
              <YAxis
                domain={["dataMin - 0.1", "dataMax + 0.1"]}
                className="text-xs fill-muted-foreground"
                label={{
                  value: "Presión (V)",
                  angle: -90,
                  position: "insideLeft",
                }}
              />

              {/* Bandas por fase */}
              {showPhaseBands &&
                bands.map((b, idx) => {
                  const c = getPhaseColor(b.phase);
                  return (
                    <ReferenceArea
                      key={`${b.x1}-${b.x2}-${idx}`}
                      x1={b.x1}
                      x2={b.x2}
                      strokeOpacity={0}
                      fill={c.bg}
                    />
                  );
                })}

              {/* Línea Base promedio */}
              {showBaseline && typeof avgBaseline === "number" && (
                <ReferenceLine
                  y={avgBaseline}
                  stroke={BREATHING_CHART_COLORS.baseline}
                  strokeDasharray="4 4"
                  label={{
                    value: chartConfig.baseline.label,
                    position: "insideTopRight",
                  }}
                />
              )}

              <Legend />
              <ChartTooltip content={<CustomTooltip />} />

              <Area
                type="monotone"
                dataKey="pressure"
                name={chartConfig.airflowValue.label}
                stroke={BREATHING_CHART_COLORS.pressureStroke}
                fill={BREATHING_CHART_COLORS.pressureFill}
                fillOpacity={0.28}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>

        {/* Leyenda de fases respiratorias */}
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge className="bg-blue-100 text-blue-800" variant="secondary">
            Inspiración
          </Badge>
          <Badge className="bg-yellow-100 text-yellow-800" variant="secondary">
            Retención
          </Badge>
          <Badge className="bg-green-100 text-green-800" variant="secondary">
            Expiración
          </Badge>
          <Badge className="bg-gray-100 text-gray-800" variant="secondary">
            Reposo
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
