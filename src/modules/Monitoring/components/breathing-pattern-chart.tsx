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
type ActiveChannel = "pressure" | "mic" | "none";

type Point = {
  timestamp: string;
  pressure: number;
  baseline?: number;
  phase: BreathingPhase;
};

interface BreathingPatternChartProps {
  data: SessionData[];
  title?: string;
  description?: string;
  showBaseline?: boolean;
  showPhaseBands?: boolean;
}

const BREATHING_CHART_COLORS = {
  pressureStroke: "#2563eb",
  pressureFill: "rgba(37, 99, 235, 0.25)",
  baseline: "#6b7280",
};

function derivePhase(r: SessionData, active: ActiveChannel): BreathingPhase {
  const baseline = r.respBaseline ?? 0;

  // Canal presión
  if (active === "pressure") {
    const v = (r.resp2Adc ?? 0) - baseline;
    const diff = Math.abs(v);

    if (r.resp2Positive === true) return "exhale";
    if (r.resp2Positive === false) return "inhale";

    if (diff < 0.5) return "rest";
    if (diff >= 0.5 && diff < 2) return "hold";
    return v >= 0 ? "inhale" : "exhale";
  }

  // Canal mic
  if (active === "mic") {
    const v = (r.airflowValue ?? 0) - baseline;
    const diff = Math.abs(v);

    if (diff < 20) return "rest";
    if (diff >= 20 && diff < 60) return "hold";
    return v >= 0 ? "inhale" : "exhale";
  }

  return "rest";
}

export function BreathingPatternChart({
  data,
  title = "Patrón Respiratorio",
  description = "Análisis del patrón respiratorio (mic vs presión)",
  showBaseline = true,
  showPhaseBands = true,
}: BreathingPatternChartProps) {
  // === 1) Detectar canal activo según señal !== 0 ===
  const hasPressure = (data ?? []).some((r) => (r.resp2Adc ?? 0) !== 0);
  const hasMic = (data ?? []).some((r) => (r.airflowValue ?? 0) !== 0);

  const activeChannel: ActiveChannel = hasPressure
    ? "pressure"
    : hasMic
      ? "mic"
      : "none";

  const chartConfig = {
    pressure: {
      label:
        activeChannel === "pressure"
          ? "Presión respiratoria (mbar)"
          : activeChannel === "mic"
            ? "Flujo respiratorio (mic)"
            : "Señal respiratoria",
    },
    baseline: { label: "Línea Base" },
  };

  // === 2) Construir puntos usando respiración secundaria (resp2Adc + resp2Positive) ===
  const points: Point[] =
    activeChannel === "none"
      ? []
      : (data ?? []).map((r) => {
          if (activeChannel === "pressure") {
            const baseline = r.respBaseline ?? 0;

            // Diferencia respecto a la baseline, como ya hacías conceptualmente
            const raw = (r.resp2Adc ?? 0) - baseline;
            const mag = Math.abs(raw);

            let value: number;

            if (r.resp2Positive === true) {
              // Expiración → señal positiva
              value = mag;
            } else if (r.resp2Positive === false) {
              // Inspiración → señal negativa
              value = -mag;
            } else {
              // Sin info de dirección → usamos el signo real de la diferencia
              value = raw;
            }

            return {
              timestamp: r.recordedAt,
              pressure: value,
              baseline, // seguimos usando respBaseline
              phase: derivePhase(r, activeChannel),
            };
          }

          // Canal mic: se mantiene igual que antes
          const valueMic = r.airflowValue ?? 0;

          return {
            timestamp: r.recordedAt,
            pressure: valueMic,
            baseline: r.respBaseline ?? undefined,
            phase: derivePhase(r, activeChannel),
          };
        });

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
          <span className="font-medium">{chartConfig.pressure.label}:</span>{" "}
          {pressure}
        </p>
        {typeof d.baseline === "number" && (
          <p className="text-sm">
            <span className="font-medium">Base:</span> {d.baseline}
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

  // === 3) Stats simple sobre el canal activo ===
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

  // === 4) Bandas de fase continuas ===
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

  // === 5) baseline media para ReferenceLine ===
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
          <span>{title}</span>
          <div className="flex gap-2 items-center">
            {activeChannel !== "none" && (
              <Badge variant="outline">
                Canal: {activeChannel === "pressure" ? "Presión" : "Micrófono"}
              </Badge>
            )}
            <Badge variant="outline">Promedio: {avgPressure}</Badge>
            <Badge variant="outline">Máx: {maxPressure}</Badge>
            <Badge variant="outline">Mín: {minPressure}</Badge>
          </div>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent>
        {activeChannel === "none" || points.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Sin señal respiratoria disponible (micrófono y presión en 0).
          </div>
        ) : (
          <>
            <ChartContainer
              config={{ pressure: { label: chartConfig.pressure.label } }}
            >
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart
                  data={points}
                  margin={{ top: 8, right: 28, left: 12, bottom: 8 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-muted"
                  />
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
                      value: chartConfig.pressure.label,
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
                    name={chartConfig.pressure.label}
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
              <Badge
                className="bg-yellow-100 text-yellow-800"
                variant="secondary"
              >
                Retención
              </Badge>
              <Badge
                className="bg-green-100 text-green-800"
                variant="secondary"
              >
                Expiración
              </Badge>
              <Badge className="bg-gray-100 text-gray-800" variant="secondary">
                Reposo
              </Badge>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
