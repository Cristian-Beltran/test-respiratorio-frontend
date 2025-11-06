import { useEffect, useMemo, useState } from "react";
import { DashboardHeader } from "@/components/headerPage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Loader2,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Info,
} from "lucide-react";
import { useAuthStore } from "@/auth/useAuth";
import { sessionService } from "@/modules/Session/data/session.service";
import type { Session, SessionData } from "@/modules/Session/session.interface";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { patientService } from "../Patient/data/patient.service";
import { useParams } from "react-router-dom";
import type { Patient } from "../Patient/patient.interface";

const fmt = new Intl.DateTimeFormat("es-BO", {
  dateStyle: "medium",
  timeStyle: "short",
});

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    return fmt.format(new Date(iso));
  } catch {
    return iso;
  }
}

function pickLatestRecord(records: SessionData[] = []) {
  return [...records].sort(
    (a, b) =>
      new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
  )[0];
}

function flattenRecords(sessions: Session[]): SessionData[] {
  return sessions.flatMap((s) => s.records?.map((r) => r) ?? []);
}

function classifyVitals(v: { bpm?: number; spo2?: number; respRate?: number }) {
  const flags: {
    key: keyof typeof v;
    level: "ok" | "warn" | "alert";
    text: string;
  }[] = [];
  if (v.spo2 !== undefined) {
    if (v.spo2 < 90)
      flags.push({ key: "spo2", level: "alert", text: "SpO₂ < 90%" });
    else if (v.spo2 < 94)
      flags.push({ key: "spo2", level: "warn", text: "SpO₂ baja (90–93%)" });
  }
  if (v.bpm !== undefined) {
    if (v.bpm < 50 || v.bpm > 120)
      flags.push({ key: "bpm", level: "alert", text: "FC fuera de rango" });
    else if (v.bpm < 60 || v.bpm > 100)
      flags.push({ key: "bpm", level: "warn", text: "FC borderline" });
  }
  if (v.respRate !== undefined) {
    if (v.respRate < 8 || v.respRate > 28)
      flags.push({
        key: "respRate",
        level: "alert",
        text: "FR fuera de rango",
      });
    else if (v.respRate < 12 || v.respRate > 20)
      flags.push({ key: "respRate", level: "warn", text: "FR borderline" });
  }
  const worst = flags.find((f) => f.level === "alert")
    ? ("alert" as const)
    : flags.find((f) => f.level === "warn")
      ? ("warn" as const)
      : ("ok" as const);
  return { flags, worst };
}

function VitalCard({
  title,
  value,
  unit,
  status,
  hint,
  series,
}: {
  title: string;
  value?: number;
  unit?: string;
  status: "ok" | "warn" | "alert";
  hint?: string;
  series?: { t: string; v?: number }[];
}) {
  const color =
    status === "ok"
      ? "text-emerald-600"
      : status === "warn"
        ? "text-amber-600"
        : "text-red-600";
  const Icon = status === "ok" ? CheckCircle2 : AlertTriangle;
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          {title}
          <Icon className={`h-4 w-4 ${color}`} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-3xl font-semibold">
          {value !== undefined ? (
            <>
              {value}
              {unit ? (
                <span className="ml-1 text-base text-muted-foreground">
                  {unit}
                </span>
              ) : null}
            </>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </div>
        {hint ? (
          <div className="text-sm text-muted-foreground">{hint}</div>
        ) : null}
        {series && series.length > 2 ? (
          <div className="h-24">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={series}
                margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
              >
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="t" hide tickMargin={4} />
                <YAxis hide domain={["dataMin", "dataMax"]} />
                <Tooltip
                  formatter={(v) => [v, title]}
                  labelFormatter={(l) => l}
                />
                <Line type="monotone" dataKey="v" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function MePage() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);

  const { id } = useParams<{ id: string }>();

  let patient: Patient;
  const reload = async () => {
    if (!user?.id) return;
    if (!id) patient = await patientService.findOne(user.id);
    setLoading(true);
    setError(null);
    try {
      const data = await sessionService.listByPatient(id ?? patient?.id);
      setSessions(Array.isArray(data) ? data : []);
    } catch (e) {
      if (e instanceof Error) setError(e.message);
      else setError("No se pudieron cargar los datos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, [user?.id, id]);

  const { latestRecord, lastSession, trends, summary } = useMemo(() => {
    const all = flattenRecords(sessions).sort(
      (a, b) =>
        new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime(),
    );

    const latest = pickLatestRecord(all);

    const lastSess = [...sessions].sort(
      (a, b) =>
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    )[0];

    const maxPoints = 150;
    const slice = all.slice(Math.max(0, all.length - maxPoints));

    const toSeries = (key: keyof SessionData) =>
      slice.map((r) => ({
        t: new Date(r.recordedAt).toLocaleTimeString(),
        v:
          typeof r[key] === "number" && !Number.isNaN(r[key])
            ? (r[key] as number)
            : undefined,
      }));

    const rr = toSeries("respRate");
    const bpm = toSeries("bpm");
    const spo2 = toSeries("spo2");

    const latestVitals = {
      respRate:
        typeof latest?.respRate === "number" ? latest.respRate : undefined,
      bpm: typeof latest?.bpm === "number" ? latest.bpm : undefined,
      spo2: typeof latest?.spo2 === "number" ? latest.spo2 : undefined,
    };

    const klass = classifyVitals(latestVitals);

    const adviceText =
      klass.worst === "alert"
        ? "Valores fuera de rango. Si se mantiene, contacta a tu médico o acude a emergencias."
        : klass.worst === "warn"
          ? "Valores ligeramente fuera de lo normal. Revisa tu respiración y descansa; si persiste, consulta."
          : "Todo en rango esperado. Continúa con tus indicaciones habituales.";

    return {
      latestRecord: latest,
      lastSession: lastSess,
      trends: { rr, bpm, spo2 },
      summary: { status: klass.worst, flags: klass.flags, adviceText },
    };
  }, [sessions]);

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Mi salud"
        description="Resumen simple de tus mediciones"
        actions={
          <Button
            size="icon"
            variant="outline"
            onClick={reload}
            title="Recargar"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        }
      />

      {error ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando datos…
        </div>
      ) : null}

      {!loading && !error && (
        <>
          <Alert className="border-emerald-200">
            <Info className="h-4 w-4" />
            <AlertTitle>
              {summary.status === "alert"
                ? "Atención"
                : summary.status === "warn"
                  ? "Precaución"
                  : "En buen estado"}
            </AlertTitle>
            <AlertDescription>
              {summary.adviceText}
              {latestRecord ? (
                <span className="block text-xs mt-1 text-muted-foreground">
                  Última medición: {fmtDate(latestRecord.recordedAt)}
                </span>
              ) : null}
            </AlertDescription>
          </Alert>

          <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
            <VitalCard
              title="Frecuencia respiratoria"
              value={latestRecord?.respRate ?? undefined}
              unit="rpm"
              status={summary.status}
              hint="Esperado: 12–20 rpm"
              series={trends.rr}
            />
            <VitalCard
              title="Frecuencia cardíaca"
              value={latestRecord?.bpm ?? undefined}
              unit="lpm"
              status={summary.status}
              hint="Esperado: 60–100 lpm"
              series={trends.bpm}
            />
            <VitalCard
              title="Oxigenación (SpO₂)"
              value={latestRecord?.spo2 ?? undefined}
              unit="%"
              status={summary.status}
              hint="Esperado: ≥ 94%"
              series={trends.spo2}
            />
          </div>

          <Tabs defaultValue="historial" className="w-full">
            <TabsList>
              <TabsTrigger value="historial">Historial</TabsTrigger>
              <TabsTrigger value="detalle">
                Detalle de la última sesión
              </TabsTrigger>
            </TabsList>

            <TabsContent value="historial">
              <Card>
                <CardHeader>
                  <CardTitle>Sesiones recientes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {sessions.length === 0 && (
                      <div className="text-sm text-muted-foreground">
                        No hay sesiones para mostrar.
                      </div>
                    )}
                    {sessions
                      .slice()
                      .sort(
                        (a, b) =>
                          new Date(b.startedAt).getTime() -
                          new Date(a.startedAt).getTime(),
                      )
                      .slice(0, 8)
                      .map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between border rounded-xl p-3"
                        >
                          <div>
                            <div className="font-medium">
                              {fmtDate(s.startedAt)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {s.records?.length ?? 0} mediciones • Dispositivo:{" "}
                              {s.device?.serialNumber ?? "—"}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="detalle">
              <Card>
                <CardHeader>
                  <CardTitle>Última sesión</CardTitle>
                </CardHeader>
                <CardContent>
                  {lastSession ? (
                    <div className="grid gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Inicio: </span>
                        {fmtDate(lastSession.startedAt)}
                      </div>

                      <div>
                        <span className="text-muted-foreground">
                          Registros:{" "}
                        </span>
                        {lastSession.records?.length ?? 0}
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          Dispositivo:{" "}
                        </span>
                        {lastSession.device?.serialNumber ?? "—"}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      Aún no hay sesiones registradas.
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
