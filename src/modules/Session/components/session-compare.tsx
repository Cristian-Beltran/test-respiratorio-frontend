import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import type { Session, SessionData } from "@/modules/Session/session.interface";

type SessionCompareModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  baseSession: Session | null;
  sessions: Session[];
};

type MetricStats = { avg: number; min: number; max: number };

// Paleta de colores local para los gráficos
const CHART_COLORS = {
  base: "#2563eb", // azul
  compare: "#f97316", // naranja
  baseSpo2: "#16a34a", // verde
  compareSpo2: "#dc2626", // rojo
  baseResp: "#6b7280", // gris
  compareResp: "#a855f7", // violeta
};

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

function fmtDate(d: string | Date) {
  const dt = new Date(d);
  return dt.toLocaleDateString("es-ES", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export function SessionCompareModal({
  open,
  onOpenChange,
  baseSession,
  sessions,
}: SessionCompareModalProps) {
  const [compareId, setCompareId] = useState<string | undefined>(undefined);
  const baseRecords = baseSession?.records ?? [];
  const compareSession = sessions.find((s) => s.id === compareId) ?? null;
  const compareRecords = compareSession?.records ?? [];

  const baseStats = useMemo(
    () => ({
      bpm: computeStats(baseRecords, (r) => r.bpm ?? null),
      spo2: computeStats(baseRecords, (r) => r.spo2 ?? null),
      resp: computeStats(baseRecords, (r) => r.respRate ?? null),
      air: computeStats(baseRecords, (r) => r.airflowValue ?? null),
    }),
    [baseRecords],
  );

  const compStats = useMemo(
    () =>
      compareSession
        ? {
            bpm: computeStats(compareRecords, (r) => r.bpm ?? null),
            spo2: computeStats(compareRecords, (r) => r.spo2 ?? null),
            resp: computeStats(compareRecords, (r) => r.respRate ?? null),
            air: computeStats(compareRecords, (r) => r.airflowValue ?? null),
          }
        : null,
    [compareSession, compareRecords],
  );

  const radarData = useMemo(
    () =>
      compStats && compareSession
        ? [
            {
              metric: "BPM",
              base: baseStats.bpm.avg,
              comp: compStats.bpm.avg,
            },
            {
              metric: "SpO₂",
              base: baseStats.spo2.avg,
              comp: compStats.spo2.avg,
            },
            {
              metric: "Resp/min",
              base: baseStats.resp.avg,
              comp: compStats.resp.avg,
            },
            {
              metric: "Flujo Aire",
              base: baseStats.air.avg,
              comp: compStats.air.avg,
            },
          ]
        : [],
    [baseStats, compStats, compareSession],
  );

  // Serie temporal de varias métricas (por índice, no por timestamp)
  const timeSeriesData = useMemo(() => {
    const maxLen = Math.max(baseRecords.length, compareRecords.length);
    if (!maxLen) return [];
    const data: {
      index: number;
      baseBpm: number | null;
      compBpm: number | null;
      baseSpo2: number | null;
      compSpo2: number | null;
      baseResp: number | null;
      compResp: number | null;
    }[] = [];
    for (let i = 0; i < maxLen; i++) {
      const b = baseRecords[i];
      const c = compareRecords[i];
      data.push({
        index: i + 1,
        baseBpm:
          typeof b?.bpm === "number" && Number.isFinite(b.bpm) ? b.bpm : null,
        compBpm:
          typeof c?.bpm === "number" && Number.isFinite(c.bpm) ? c.bpm : null,
        baseSpo2:
          typeof b?.spo2 === "number" && Number.isFinite(b.spo2)
            ? b.spo2
            : null,
        compSpo2:
          typeof c?.spo2 === "number" && Number.isFinite(c.spo2)
            ? c.spo2
            : null,
        baseResp:
          typeof b?.respRate === "number" && Number.isFinite(b.respRate)
            ? b.respRate
            : null,
        compResp:
          typeof c?.respRate === "number" && Number.isFinite(c.respRate)
            ? c.respRate
            : null,
      });
    }
    return data;
  }, [baseRecords, compareRecords]);

  useEffect(() => {
    if (!baseSession) {
      setCompareId(undefined);
      return;
    }

    const candidates = sessions.filter((s) => s.id !== baseSession.id);
    if (!candidates.length) {
      setCompareId(undefined);
      return;
    }

    const stillValid =
      !!compareId && candidates.some((s) => s.id === compareId);
    if (!stillValid) {
      setCompareId(candidates[0]?.id);
    }
  }, [baseSession, sessions, compareId]);

  if (!baseSession) {
    return null;
  }
  const candidates = sessions.filter((s) => s.id !== baseSession.id);

  const baseLabel = `${fmtDate(baseSession.startedAt)} • ${
    baseSession.patient?.user?.fullname ?? "Paciente"
  }`;

  const baseMeta = `${fmtDateTime(baseSession.startedAt)}${
    baseSession.endedAt ? ` — ${fmtDateTime(baseSession.endedAt)}` : ""
  }`;

  const compareLabel =
    compareSession &&
    `${fmtDate(compareSession.startedAt)} • ${
      compareSession.patient?.user?.fullname ?? "Paciente"
    }`;

  const compareMeta =
    compareSession &&
    `${fmtDateTime(compareSession.startedAt)}${
      compareSession.endedAt ? ` — ${fmtDateTime(compareSession.endedAt)}` : ""
    }`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-[90vw] sm:max-w-[1240px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Comparar sesiones del paciente</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Encabezado: selección de sesión a comparar */}
          <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,2fr)]">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Sesión base</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-sm font-medium">{baseLabel}</div>
                <div className="text-xs text-muted-foreground">{baseMeta}</div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">
                    {baseSession.records?.length ?? 0} lecturas
                  </Badge>
                  {baseSession.device?.model && (
                    <Badge variant="outline">
                      {baseSession.device.model}{" "}
                      {baseSession.device.serialNumber &&
                        `(${baseSession.device.serialNumber})`}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Comparar con</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select
                  value={compareId}
                  onValueChange={(val) => setCompareId(val)}
                  disabled={!candidates.length}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona otra sesión" />
                  </SelectTrigger>
                  <SelectContent>
                    {candidates.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {fmtDate(s.startedAt)} •{" "}
                        {s.patient?.user?.fullname ?? "Paciente"} •{" "}
                        {s.records?.length ?? 0} lecturas
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {compareSession && (
                  <div className="space-y-1">
                    <div className="text-sm font-medium">{compareLabel}</div>
                    <div className="text-xs text-muted-foreground">
                      {compareMeta}
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline">
                        {compareSession.records?.length ?? 0} lecturas
                      </Badge>
                      {compareSession.device?.model && (
                        <Badge variant="outline">
                          {compareSession.device.model}{" "}
                          {compareSession.device.serialNumber &&
                            `(${compareSession.device.serialNumber})`}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {!candidates.length && (
                  <p className="text-xs text-muted-foreground">
                    No hay otras sesiones para comparar.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {!compareSession || !compStats ? (
            <p className="text-sm text-muted-foreground">
              Selecciona una sesión para ver la comparación.
            </p>
          ) : (
            <>
              {/* KPIs comparativos: promedio, min, max */}
              <div className="grid gap-4 md:grid-cols-4">
                <CompareMetricBox
                  title="Pulso (BPM)"
                  base={baseStats.bpm}
                  comp={compStats.bpm}
                />
                <CompareMetricBox
                  title="SpO₂ (%)"
                  base={baseStats.spo2}
                  comp={compStats.spo2}
                />
                <CompareMetricBox
                  title="Resp/min"
                  base={baseStats.resp}
                  comp={compStats.resp}
                />
                <CompareMetricBox
                  title="Flujo Aire"
                  base={baseStats.air}
                  comp={compStats.air}
                />
              </div>

              {/* Gráficos */}
              <div className="grid gap-4 md:grid-cols-2">
                {/* Radar de promedios */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">
                      Comparación de promedios (Radar)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarData}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="metric" />
                        <PolarRadiusAxis />
                        <Radar
                          name="Base"
                          dataKey="base"
                          stroke={CHART_COLORS.base}
                          fill={CHART_COLORS.base}
                          fillOpacity={0.25}
                        />
                        <Radar
                          name="Comparación"
                          dataKey="comp"
                          stroke={CHART_COLORS.compare}
                          fill={CHART_COLORS.compare}
                          fillOpacity={0.25}
                        />
                        <Legend />
                      </RadarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Serie temporal BPM / SpO2 / Resp */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">
                      Evolución de BPM, SpO₂ y Resp/min
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={timeSeriesData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="index"
                          tick={{ fontSize: 10 }}
                          label={{
                            value: "Muestra",
                            position: "insideBottomRight",
                            offset: -4,
                          }}
                        />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="baseBpm"
                          name="BPM Base"
                          stroke={CHART_COLORS.base}
                          dot={false}
                          strokeWidth={2}
                        />
                        <Line
                          type="monotone"
                          dataKey="compBpm"
                          name="BPM Comp."
                          stroke={CHART_COLORS.compare}
                          dot={false}
                          strokeWidth={2}
                        />
                        <Line
                          type="monotone"
                          dataKey="baseSpo2"
                          name="SpO₂ Base"
                          stroke={CHART_COLORS.baseSpo2}
                          dot={false}
                          strokeWidth={1.5}
                        />
                        <Line
                          type="monotone"
                          dataKey="compSpo2"
                          name="SpO₂ Comp."
                          stroke={CHART_COLORS.compareSpo2}
                          dot={false}
                          strokeWidth={1.5}
                        />
                        <Line
                          type="monotone"
                          dataKey="baseResp"
                          name="Resp/min Base"
                          stroke={CHART_COLORS.baseResp}
                          dot={false}
                          strokeWidth={1.5}
                        />
                        <Line
                          type="monotone"
                          dataKey="compResp"
                          name="Resp/min Comp."
                          stroke={CHART_COLORS.compareResp}
                          dot={false}
                          strokeWidth={1.5}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CompareMetricBox({
  title,
  base,
  comp,
}: {
  title: string;
  base: MetricStats;
  comp: MetricStats;
}) {
  const diffAvg = comp.avg - base.avg;
  const diffMin = comp.min - base.min;
  const diffMax = comp.max - base.max;

  const sign = (v: number) =>
    v === 0 ? "0.00" : `${v > 0 ? "+" : ""}${v.toFixed(2)}`;

  return (
    <Card className="border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Avg</span>
          <span className="font-mono">
            Base {base.avg.toFixed(2)} • Comp {comp.avg.toFixed(2)} (
            {sign(diffAvg)})
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Min</span>
          <span className="font-mono">
            Base {base.min.toFixed(2)} • Comp {comp.min.toFixed(2)} (
            {sign(diffMin)})
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Max</span>
          <span className="font-mono">
            Base {base.max.toFixed(2)} • Comp {comp.max.toFixed(2)} (
            {sign(diffMax)})
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
