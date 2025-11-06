// src/app/dashboard/DashboardPage.tsx
import { useEffect, useMemo, useState } from "react";
import {
  Heart,
  Activity,
  Droplets,
  Users,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import { VitalSignsCard } from "./components/vital-signs-card";
import { MonitoringSessionCard } from "./components/monitoring-session-card";
import { StatsOverview } from "./components/stats-overview";
import type { MonitoringSession } from "@/types/monitoring-session";
import type { Session, SessionData } from "@/modules/Session/session.interface";
import { sessionService } from "@/modules/Session/data/session.service";
import { useAuthStore } from "@/auth/useAuth";
import { Navigate } from "react-router-dom";

// --- helpers ---
function formatRelative(dateISO?: string) {
  if (!dateISO) return "Sin lecturas";
  const diffMs = Date.now() - new Date(dateISO).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Hace segundos";
  if (mins < 60) return `Hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs} h`;
  const days = Math.floor(hrs / 24);
  return `Hace ${days} d`;
}

function getLatestRecordOfSession(s: Session): SessionData | undefined {
  return (s.records ?? []).reduce<SessionData | undefined>((acc, r) => {
    if (!acc) return r;
    return new Date(r.recordedAt) > new Date(acc.recordedAt) ? r : acc;
  }, undefined);
}

function getLatestRecordGlobal(sessions: Session[]): {
  record?: SessionData;
  session?: Session;
} {
  let latestRec: SessionData | undefined;
  let latestSession: Session | undefined;
  for (const s of sessions) {
    for (const r of s.records ?? []) {
      if (
        !latestRec ||
        new Date(r.recordedAt) > new Date(latestRec.recordedAt)
      ) {
        latestRec = r;
        latestSession = s;
      }
    }
  }
  return { record: latestRec, session: latestSession };
}

function countTodaySessions(sessions: Session[]): number {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return sessions.filter((s) => {
    const d = new Date(s.startedAt);
    return d >= start && d <= end;
  }).length;
}

function distinctPatientCount(sessions: Session[]): number {
  const set = new Set<string>();
  sessions.forEach((s) => s.patient?.id && set.add(s.patient.id));
  return set.size;
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const redirectTo =
    user?.type === "patient"
      ? "/me"
      : user?.type === "family"
        ? "/family/patients"
        : null;

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await sessionService.listAll();
        if (!mounted) return;
        setSessions(data ?? []);
      } catch (e) {
        if (!mounted) return;
        console.error(e);
        setError("No se pudieron cargar las sesiones.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // --- Derivados globales ---
  const { record: latestRecord, session: latestSession } = useMemo(
    () => getLatestRecordGlobal(sessions),
    [sessions],
  );

  const lastUpdate = useMemo(
    () => formatRelative(latestRecord?.recordedAt),
    [latestRecord],
  );

  const latestPatientName = latestSession?.patient
    ? `${latestSession.patient.user.fullname}`.trim() ||
      latestSession.patient.id
    : "Paciente";

  const doctorStats = useMemo(() => {
    const patients = distinctPatientCount(sessions);
    const today = countTodaySessions(sessions);
    const critical = 0; // placeholder hasta definir reglas de alerta
    return [
      {
        title: "Pacientes Activos",
        value: patients,
        description: "Bajo monitoreo",
        icon: Users,
        trend: { value: patients, isPositive: true },
      },
      {
        title: "Sesiones Hoy",
        value: today,
        description: "Registros de hoy",
        icon: Activity,
      },
      {
        title: "Alertas Críticas",
        value: critical,
        description: "Requieren atención inmediata",
        icon: AlertTriangle,
      },
      {
        title: "Pacientes Estables",
        value: Math.max(patients - critical, 0),
        description: "Sin alertas activas",
        icon: CheckCircle,
      },
    ];
  }, [sessions]);

  // Vitales del último registro global — alineado al nuevo esquema
  const vitals = useMemo(
    () => [
      {
        label: "Frecuencia Cardíaca",
        value: latestRecord?.bpm ?? null,
        unit: "bpm",
        status: "normal" as const,
        icon: Heart,
        trend: "stable" as const,
      },
      {
        label: "SpO₂",
        value: latestRecord?.spo2 ?? null,
        unit: "%",
        status: "normal" as const,
        icon: Droplets,
        trend: "stable" as const,
      },
      {
        label: "Respiraciones",
        value: latestRecord?.respRate ?? null,
        unit: "rpm",
        status: "normal" as const,
        icon: Activity,
        trend: "stable" as const,
      },
    ],
    [latestRecord],
  );

  // Adaptador temporal para MonitoringSessionCard
  const monitoringSession: MonitoringSession | null = latestSession
    ? {
        id: latestSession.id,
        patientId: latestSession.patient.id,
        sessionDate: latestSession.startedAt.split("T")[0],
        notes: `Última lectura de ${latestPatientName}: ${lastUpdate}`,
        createdAt: latestSession.startedAt,
      }
    : null;

  // Pacientes recientes (top 5 por última lectura)
  const recentPatients = useMemo(() => {
    const map = new Map<string, { name: string; lastReadingISO: string }>();
    sessions.forEach((s) => {
      const lr = getLatestRecordOfSession(s);
      if (!lr) return;
      const name = s.patient
        ? `${s.patient.user.fullname}`.trim() || s.patient.id
        : "Paciente";
      const cur = map.get(s.patient.id);
      if (!cur || new Date(lr.recordedAt) > new Date(cur.lastReadingISO)) {
        map.set(s.patient.id, { name, lastReadingISO: lr.recordedAt });
      }
    });
    return Array.from(map.values())
      .sort(
        (a, b) =>
          new Date(b.lastReadingISO).getTime() -
          new Date(a.lastReadingISO).getTime(),
      )
      .slice(0, 5)
      .map((p) => ({
        name: p.name,
        status: "Estable",
        lastReading: formatRelative(p.lastReadingISO),
      }));
  }, [sessions]);

  if (redirectTo) return <Navigate to={redirectTo} replace />;
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Bienvenido, {user?.fullname}
        </h2>
        <p className="text-muted-foreground">
          Monitoreo consolidado de todos los pacientes
        </p>
      </div>

      {/* Estados */}
      {loading && (
        <div className="rounded-md border p-4 text-sm">Cargando sesiones…</div>
      )}
      {error && (
        <div className="rounded-md border p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* KPIs */}
      <StatsOverview stats={doctorStats} />

      {/* Contenido principal */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Signos vitales (último evento global) */}
        <VitalSignsCard
          patientName={latestPatientName}
          lastUpdate={lastUpdate}
          vitals={vitals.map((v) => ({
            ...v,
            value:
              v.value === null || v.value === undefined
                ? "—"
                : (v.value as number),
          }))}
        />

        {/* Sesión más reciente */}
        <MonitoringSessionCard
          session={
            monitoringSession ?? {
              id: "—",
              patientId: "—",
              sessionDate: new Date().toISOString().split("T")[0],
              notes:
                sessions.length === 0
                  ? "Sin sesiones registradas."
                  : "Cargando sesión…",
              createdAt: new Date().toISOString(),
            }
          }
        />
      </div>

      {/* Pacientes recientes */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4">Pacientes Recientes</h3>
        <div className="space-y-3">
          {recentPatients.length > 0 ? (
            recentPatients.map((patient, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 rounded-lg bg-muted"
              >
                <div>
                  <p className="font-medium">{patient.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {patient.lastReading}
                  </p>
                </div>
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  Estable
                </span>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              Aún no hay lecturas para mostrar.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
