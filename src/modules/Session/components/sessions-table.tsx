import { useMemo, useState } from "react";
import { sessionStore } from "@/modules/Session/data/session.store";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Activity,
  Heart,
  Cpu,
  CalendarClock,
  Download,
  BarChart2,
} from "lucide-react";
import type { Session, SessionData } from "@/modules/Session/session.interface";
import { Button } from "@/components/ui/button";
import { SessionCompareModal } from "./session-compare";

type Stat = { label: string; value: number | string; hint?: string };

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
function safeNum(n: unknown) {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}
function pct(x: number, min: number, max: number) {
  if (max <= min) return 0;
  return Math.max(0, Math.min(100, ((x - min) / (max - min)) * 100));
}
function arrNums(
  records: SessionData[],
  pick: (r: SessionData) => number | null | undefined,
) {
  return records
    .map(pick)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
}
function stats(
  records: SessionData[],
  pick: (r: SessionData) => number | null | undefined,
) {
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

// ---------- CSV helpers ----------

function toCsvValue(
  value: string | number | boolean | null | undefined | Date,
): string {
  if (value === null || value === undefined) return "";
  const raw =
    value instanceof Date
      ? value.toISOString()
      : typeof value === "number" && Number.isFinite(value)
        ? String(value)
        : String(value);

  if (
    raw.includes('"') ||
    raw.includes(",") ||
    raw.includes("\n") ||
    raw.includes("\r")
  ) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function buildCsvRows(sessions: Session[]): string[] {
  const headers = [
    "sessionId",
    "patientId",
    "patientName",
    "deviceModel",
    "deviceSerial",
    "startedAt",
    "endedAt",
    "recordId",
    "recordedAt",
    "bpm",
    "spo2",
    "respRate",
    "airflowValue",
    "respBaseline",
    "respDiffAbs",
    "micAirValue",
    "resp2Adc",
    "resp2Positive",
  ];

  const rows: string[] = [];
  rows.push(headers.join(","));

  sessions.forEach((s) => {
    const patientId = s.patient?.id ?? "";
    const patientName = s.patient?.user?.fullname ?? "";
    const deviceModel = s.device?.model ?? "";
    const deviceSerial = s.device?.serialNumber ?? "";
    const startedAt = s.startedAt ? new Date(s.startedAt) : null;
    const endedAt = s.endedAt ? new Date(s.endedAt) : null;

    const records: SessionData[] = s.records ?? [];

    if (!records.length) return;

    records.forEach((rec) => {
      const rowValues: (string | number | boolean | null | undefined | Date)[] =
        [
          s.id,
          patientId,
          patientName,
          deviceModel,
          deviceSerial,
          startedAt,
          endedAt,
          rec.id,
          rec.recordedAt ? new Date(rec.recordedAt) : "",
          rec.bpm,
          rec.spo2,
          rec.respRate,
          rec.airflowValue,
          rec.respBaseline,
          rec.respDiffAbs,
          rec.micAirValue,
          rec.resp2Adc,
          rec.resp2Positive ?? "",
        ];

      rows.push(rowValues.map(toCsvValue).join(","));
    });
  });

  return rows;
}

function downloadSessionsCsv(sessions: Session[]) {
  const rows = buildCsvRows(sessions);
  const csvContent = rows.join("\n");
  const blob = new Blob([csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  const now = new Date();
  const ts = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(now.getDate()).padStart(
    2,
    "0",
  )}_${String(now.getHours()).padStart(2, "0")}${String(
    now.getMinutes(),
  ).padStart(2, "0")}`;

  link.href = url;
  link.setAttribute("download", `sesiones_${ts}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ---------- Componente principal ----------

export function SessionsTable() {
  const { sessions, isLoading } = sessionStore();
  const [openId, setOpenId] = useState<string | undefined>(undefined);

  const [compareOpen, setCompareOpen] = useState(false);
  const [compareBase, setCompareBase] = useState<Session | null>(null);

  const sorted = useMemo(() => {
    const s = [...sessions];
    s.sort(
      (a, b) =>
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    );
    return s;
  }, [sessions]);

  const globalStats = useMemo(() => {
    const patients = new Set(sorted.map((s) => s.patient?.id).filter(Boolean));
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const todaySessions = sorted.filter((s) => {
      const d = new Date(s.startedAt);
      return d >= todayStart && d <= todayEnd;
    }).length;

    return [
      { label: "Pacientes", value: patients.size },
      { label: "Sesiones hoy", value: todaySessions },
      {
        label: "Lecturas",
        value: sorted.reduce((acc, s) => acc + (s.records?.length ?? 0), 0),
      },
    ] as Stat[];
  }, [sorted]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sesiones</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Cargando sesiones…
        </CardContent>
      </Card>
    );
  }

  if (!sorted.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sesiones</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          No hay sesiones registradas.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Modal de comparación desacoplado */}
      <SessionCompareModal
        open={compareOpen}
        onOpenChange={(open) => {
          setCompareOpen(open);
          if (!open) setCompareBase(null);
        }}
        baseSession={compareBase}
        sessions={sorted}
      />

      <div className="space-y-6">
        {/* KPI header */}
        <Card className="border-dashed">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 gap-2">
            <CardTitle className="text-base">Overview</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1">
                <Cpu className="h-3.5 w-3.5" /> {globalStats[0].value} Pacientes
              </Badge>
              <Badge variant="outline" className="gap-1">
                <CalendarClock className="h-3.5 w-3.5" /> {globalStats[1].value}{" "}
                Hoy
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <Activity className="h-3.5 w-3.5" /> {globalStats[2].value}{" "}
                Lecturas
              </Badge>

              {/* Botón CSV global */}
              <Button
                size="sm"
                variant="outline"
                className="ml-2 gap-1"
                onClick={() => downloadSessionsCsv(sorted)}
              >
                <Download className="h-3.5 w-3.5" />
                CSV
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* Timeline de sesiones */}
        <div className="relative">
          <div className="absolute left-3 top-0 bottom-0 w-px bg-border" />
          <div className="space-y-5">
            {sorted.map((s: Session) => {
              const r = s.records ?? [];

              const last = r.reduce<SessionData | undefined>((acc, cur) => {
                if (!acc) return cur;
                return new Date(cur.recordedAt) > new Date(acc.recordedAt)
                  ? cur
                  : acc;
              }, undefined);

              const stAirflow = stats(r, (x) => x.airflowValue ?? null);
              const stRespRate = stats(r, (x) => x.respRate ?? null);
              const stBpm = stats(r, (x) => x.bpm ?? null);
              const stSpo2 = stats(r, (x) => x.spo2 ?? null);

              const patientName = s.patient?.user
                ? `${s.patient.user.fullname}`.trim() || s.patient.id
                : (s.patient?.id ?? "Paciente");
              const deviceLabel = [
                s.device?.model ?? "",
                s.device?.serialNumber ? `(${s.device.serialNumber})` : "",
              ]
                .join(" ")
                .trim();

              return (
                <div key={s.id} className="relative pl-8">
                  {/* Timeline dot */}
                  <div className="absolute left-2 top-3 h-2.5 w-2.5 rounded-full bg-primary" />

                  <Card className="shadow-sm">
                    <CardHeader className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className="font-mono text-[11px]"
                          >
                            {s.id.slice(0, 8)}…
                          </Badge>
                          <span className="text-sm font-semibold">
                            {patientName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">
                            {deviceLabel || "—"}
                          </Badge>
                          <Badge variant="outline">{r.length} lecturas</Badge>

                          {/* Botón comparar sesión */}
                          <Button
                            variant="outline"
                            className="gap-1"
                            onClick={() => {
                              setCompareBase(s);
                              setCompareOpen(true);
                            }}
                          >
                            <BarChart2 className="h-3.5 w-3.5" />
                            Comparar
                          </Button>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Inicio: {fmtDateTime(s.startedAt)}{" "}
                        {s.endedAt ? `• Fin: ${fmtDateTime(s.endedAt)}` : ""}
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      {/* KPIs */}
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                        <MetricBox
                          icon={<Heart className="h-4 w-4" />}
                          title="Pulso (BPM)"
                          avg={stBpm.avg}
                          min={stBpm.min}
                          max={stBpm.max}
                          valueNow={last?.bpm ?? null}
                        />
                        <MetricBox
                          icon={<Activity className="h-4 w-4" />}
                          title="SpO₂ (%)"
                          avg={stSpo2.avg}
                          min={stSpo2.min}
                          max={stSpo2.max}
                          valueNow={last?.spo2 ?? null}
                        />
                        <MetricBox
                          icon={<Activity className="h-4 w-4" />}
                          title="Resp/min"
                          avg={stRespRate.avg}
                          min={stRespRate.min}
                          max={stRespRate.max}
                          valueNow={last?.respRate ?? null}
                        />
                        <MetricBox
                          icon={<Activity className="h-4 w-4" />}
                          title="Flujo de Aire"
                          avg={stAirflow.avg}
                          min={stAirflow.min}
                          max={stAirflow.max}
                          valueNow={last?.airflowValue ?? null}
                        />
                      </div>

                      <Separator />

                      {/* Detalle expandible */}
                      <Accordion
                        type="single"
                        collapsible
                        value={openId === s.id ? s.id : undefined}
                        onValueChange={(val: string) =>
                          setOpenId(val as string | undefined)
                        }
                      >
                        <AccordionItem value={s.id} className="border-none">
                          <AccordionTrigger className="justify-between">
                            <span className="text-sm">Ver lecturas</span>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                              {r.map((rec) => (
                                <div
                                  key={rec.id}
                                  className="rounded-lg border bg-card/40 p-3"
                                >
                                  <div className="mb-2 font-mono text-[11px] text-muted-foreground">
                                    {fmtTime(rec.recordedAt)}
                                  </div>
                                  <div className="grid grid-cols-3 gap-2 text-xs">
                                    <ValuePill label="BPM" value={rec.bpm} />
                                    <ValuePill label="SpO₂" value={rec.spo2} />
                                    <ValuePill
                                      label="Resp/min"
                                      value={rec.respRate}
                                    />
                                    <ValuePill
                                      label="Air"
                                      value={rec.airflowValue}
                                    />
                                    <ValuePill
                                      label="Base"
                                      value={rec.respBaseline}
                                    />
                                    <ValuePill
                                      label="|Δ|"
                                      value={rec.respDiffAbs}
                                    />
                                    <ValuePill
                                      label="Mic"
                                      value={rec.micAirValue}
                                    />
                                    <ValuePill
                                      label="cmH2O"
                                      value={rec.resp2Adc}
                                    />
                                    <ValueBool
                                      label="R2 Dir"
                                      value={rec.resp2Positive}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

// ---------- helpers visuales ----------

function MetricBox({
  icon,
  title,
  avg,
  min,
  max,
  valueNow,
}: {
  icon: React.ReactNode;
  title: string;
  avg: number;
  min: number;
  max: number;
  valueNow: number | null;
}) {
  const now = safeNum(valueNow);
  const progress = pct(now, min, max);
  return (
    <div className="rounded-xl border p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium">{title}</span>
        </div>
        <Badge variant="outline" className="font-mono text-[11px]">
          {Number.isFinite(now) && now > 0 ? now.toFixed(0) : "—"}
        </Badge>
      </div>
      <div className="mb-2 text-[11px] text-muted-foreground">
        Avg {avg.toFixed(2)} • Min {min.toFixed(2)} • Max {max.toFixed(2)}
      </div>
      <Progress value={progress} className="h-2" />
    </div>
  );
}

function ValuePill({ label, value }: { label: string; value?: number | null }) {
  const v = typeof value === "number" && Number.isFinite(value) ? value : null;
  return (
    <div className="flex items-center justify-between rounded-md border px-2 py-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="font-mono text-[12px]">
        {v === null ? "—" : v.toFixed(2)}
      </span>
    </div>
  );
}

function ValueBool({
  label,
  value,
}: {
  label: string;
  value?: boolean | null;
}) {
  let text = "—";
  if (value === true) text = "Positiva";
  if (value === false) text = "Negativa";
  return (
    <div className="flex items-center justify-between rounded-md border px-2 py-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="font-mono text-[12px]">{text}</span>
    </div>
  );
}
