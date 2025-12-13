import { useState, useEffect, useMemo, useRef } from "react";
import { VitalSignsChart } from "./components/vital-signs-chart";
import { BreathingPatternChart } from "./components/breathing-pattern-chart";
import { v4 as uuidv4 } from "uuid";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Square, Wifi, WifiOff, UserRound, Pause } from "lucide-react";
import { useAuthStore } from "@/auth/useAuth";
import type { Patient } from "@/modules/Patient/patient.interface";
import { patientService } from "@/modules/Patient/data/patient.service";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getMqttClient, closeMqttClient } from "@/lib/mqtt";
import type { MqttClient } from "mqtt";
import type { SessionData } from "@/modules/Session/session.interface";

// === Tipos del payload que envía el ESP32 vía MQTT ===
type TelemetryPayload = {
  serialNumber: string;
  patientId?: string;
  recordedAt: string; // ISO
  airflowValue?: number;
  respBaseline?: number;
  respDiffAbs?: number;
  respRate?: number;
  bpm?: number;
  spo2?: number;
  resp2Adc?: number;
  resp2Positive?: boolean;
  micAirValue?: number;
};

type RTReading = {
  id: string;
  serialNumber: string;
  timestamp: string; // ISO
  patientId?: string;
  airflowValue?: number;
  respBaseline?: number;
  respDiffAbs?: number;
  respRate?: number;
  bpm?: number;
  spo2?: number;
  resp2Adc?: number;
  resp2Positive?: boolean;
  micAirValue?: number;
};

// ==============================
// Sticky 1: Countdown 4 minutos
// ==============================
const COUNTDOWN_SECONDS = 4 * 60;

function formatMMSS(totalSeconds: number) {
  const s = Math.max(0, totalSeconds);
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

// ==============================
// Sticky 2: Respiración 2-2-6
// ==============================
type BreathPhase = "INHALE" | "HOLD" | "EXHALE";
const PHASES: { phase: BreathPhase; seconds: number; label: string }[] = [
  { phase: "INHALE", seconds: 2, label: "Inhala" },
  { phase: "HOLD", seconds: 2, label: "Aguanta" },
  { phase: "EXHALE", seconds: 6, label: "Sopla" },
];

function phaseColorClasses(phase: BreathPhase) {
  switch (phase) {
    case "INHALE":
      return "bg-blue-50 text-blue-800 border-blue-200";
    case "HOLD":
      return "bg-amber-50 text-amber-800 border-amber-200";
    case "EXHALE":
      return "bg-emerald-50 text-emerald-800 border-emerald-200";
  }
}

export default function MonitoringPage() {
  const { user } = useAuthStore();

  // Paciente seleccionado
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [patientId, setPatientId] = useState<string>("");

  const ALL = "__ALL__";

  // Estado conexión/monitor
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  // Datos en tiempo real
  const [realtimeData, setRealtimeData] = useState<RTReading[]>([]);

  // MQTT client ref
  const clientRef = useRef<MqttClient | null>(null);

  // ==============================
  // Sticky 1: Countdown state
  // ==============================
  const [countdownActive, setCountdownActive] = useState(false);
  const [countdownLeft, setCountdownLeft] = useState(COUNTDOWN_SECONDS);
  const [countdownDone, setCountdownDone] = useState(false);

  // ==============================
  // Sticky 2: Breathing state
  // ==============================
  const [breathRunning, setBreathRunning] = useState(false);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [phaseLeft, setPhaseLeft] = useState(PHASES[0].seconds);

  // WebAudio beep
  const audioCtxRef = useRef<AudioContext | null>(null);
  const beep = (freq = 880, durationMs = 90, gainValue = 0.06) => {
    try {
      const AudioCtx =
        window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      if (!audioCtxRef.current) audioCtxRef.current = new AudioCtx();
      const ctx = audioCtxRef.current;

      // iOS/Safari: asegurar estado running tras interacción
      if (ctx.state === "suspended") ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.value = gainValue;

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      setTimeout(() => {
        osc.stop();
        osc.disconnect();
        gain.disconnect();
      }, durationMs);
    } catch {
      // no-op: si el navegador bloquea audio, no rompemos UX
    }
  };

  // Cargar pacientes
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingPatients(true);
      try {
        const data = await patientService.findAll();
        if (!mounted) return;
        setPatients(data ?? []);
      } finally {
        if (mounted) setLoadingPatients(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Conectar/Desconectar MQTT según estado de monitoreo
  useEffect(() => {
    if (!isMonitoring) {
      try {
        clientRef.current?.unsubscribe("devices/+/telemetry");
      } catch {
        // no-op
      }
      closeMqttClient();
      clientRef.current = null;
      setIsConnected(false);
      setRealtimeData([]);
      return;
    }

    const client = getMqttClient();
    clientRef.current = client;

    const onConnect = () => {
      setIsConnected(true);
      client.subscribe("devices/+/telemetry", { qos: 0 });
    };

    const onReconnect = () => setIsConnected(false);
    const onClose = () => setIsConnected(false);
    const onError = () => setIsConnected(false);

    const onMessage = (_topic: string, payload: Buffer) => {
      try {
        const data = JSON.parse(payload.toString()) as TelemetryPayload;

        // Filtro por paciente si viene en el payload
        if (patientId && data.patientId && data.patientId !== patientId) return;

        const reading: RTReading = {
          id: uuidv4(),
          serialNumber: data.serialNumber,
          timestamp: data.recordedAt || new Date().toISOString(),
          patientId: data.patientId,
          airflowValue: data.airflowValue,
          respBaseline: data.respBaseline,
          respDiffAbs: data.respDiffAbs,
          respRate: data.respRate,
          bpm: typeof data.bpm === "number" ? Math.round(data.bpm) : data.bpm,
          spo2: data.spo2,
          resp2Adc: data.resp2Adc,
          resp2Positive: data.resp2Positive,
          micAirValue: data.micAirValue,
        };

        // Buffer de 300 puntos
        setRealtimeData((prev) => [...prev.slice(-299), reading]);
      } catch (e) {
        console.error("MQTT payload inválido:", e);
      }
    };

    client.on("connect", onConnect);
    client.on("reconnect", onReconnect);
    client.on("close", onClose);
    client.on("error", onError);
    client.on("message", onMessage);

    return () => {
      try {
        client.off("connect", onConnect);
        client.off("reconnect", onReconnect);
        client.off("close", onClose);
        client.off("error", onError);
        client.off("message", onMessage);
        client.unsubscribe("devices/+/telemetry");
      } catch {
        // no-op
      }
    };
  }, [isMonitoring, patientId]);

  // ==============================
  // Countdown effect (Sticky 1)
  // ==============================
  useEffect(() => {
    if (!countdownActive) return;

    if (countdownLeft <= 0) {
      setCountdownActive(false);
      setCountdownDone(true);
      return;
    }

    const t = window.setInterval(() => {
      setCountdownLeft((prev) => prev - 1);
    }, 1000);

    return () => window.clearInterval(t);
  }, [countdownActive, countdownLeft]);

  // ==============================
  // Breathing loop effect (Sticky 2)
  // ==============================
  useEffect(() => {
    if (!breathRunning) return;

    const tick = window.setInterval(() => {
      setPhaseLeft((prev) => {
        if (prev > 1) return prev - 1;

        // Cambia de fase
        const nextIndex = (phaseIndex + 1) % PHASES.length;
        setPhaseIndex(nextIndex);
        const nextSeconds = PHASES[nextIndex].seconds;
        // beep en cada cambio de fase (incluye el inicio de nueva acción)
        beep(nextIndex === 2 ? 660 : 880, 90, 0.06);
        return nextSeconds;
      });
    }, 1000);

    return () => window.clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breathRunning, phaseIndex]);

  const startMonitoring = () => {
    setRealtimeData([]);
    setIsMonitoring(true);

    // Arranca el countdown al iniciar monitoreo (4 min)
    setCountdownDone(false);
    setCountdownLeft(COUNTDOWN_SECONDS);
    setCountdownActive(true);
  };

  const stopMonitoring = () => {
    setIsMonitoring(false);
    setRealtimeData([]);

    // Detiene y resetea countdown
    setCountdownActive(false);
    setCountdownLeft(COUNTDOWN_SECONDS);
    setCountdownDone(false);
  };

  const toggleBreathing = () => {
    setBreathRunning((prev) => {
      const next = !prev;

      if (next) {
        // reset limpio al iniciar
        setPhaseIndex(0);
        setPhaseLeft(PHASES[0].seconds);
        beep(880, 90, 0.06);
      }
      return next;
    });
  };

  // Nombre de paciente
  const patientLabel = useMemo(() => {
    const p = patients.find((x) => x.id === patientId);
    if (!p) return patientId ? patientId : "Todos los dispositivos";
    const fn = p.user?.fullname ?? "";
    return `${fn}`.trim() || p.id;
  }, [patientId, patients]);

  // Lectura más reciente
  const latestReading = realtimeData[realtimeData.length - 1];

  // Adaptador: RT -> SessionData (lo que esperan los charts)
  const rtAsSessionData: SessionData[] = useMemo(
    () =>
      realtimeData.map<SessionData>((r) => ({
        id: r.id,
        recordedAt: r.timestamp,
        airflowValue: r.airflowValue ?? null,
        respBaseline: r.respBaseline ?? null,
        respDiffAbs: r.respDiffAbs ?? null,
        respRate: r.respRate ?? null,
        bpm: r.bpm ?? null,
        spo2: r.spo2 ?? null,
        resp2Adc: r.resp2Adc ?? null,
        resp2Positive:
          typeof r.resp2Positive === "boolean" ? r.resp2Positive : null,
        micAirValue: r.micAirValue ?? null,
      })),
    [realtimeData],
  );

  const currentPhase = PHASES[phaseIndex];

  return (
    <div className="space-y-6 relative">
      {/* =========================
          Sticky HUD (siempre visible)
         ========================= */}
      <div className="sticky top-2 z-50">
        <div className="flex items-start justify-between gap-3">
          {/* Sticky 1: Countdown */}
          <Card className="w-full max-w-[360px] shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Cronómetro de Muestras
              </CardTitle>
              <CardDescription className="text-xs">
                Cuenta regresiva de 4 minutos
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold tabular-nums">
                    {formatMMSS(countdownLeft)}
                  </span>
                  {countdownDone ? (
                    <Badge className="bg-emerald-100 text-emerald-800">
                      Completado
                    </Badge>
                  ) : countdownActive ? (
                    <Badge className="bg-blue-100 text-blue-800">
                      En curso
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Listo</Badge>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={countdownActive ? "secondary" : "default"}
                    onClick={() => {
                      if (countdownDone) {
                        setCountdownDone(false);
                        setCountdownLeft(COUNTDOWN_SECONDS);
                      }
                      setCountdownActive((prev) => !prev);
                    }}
                    disabled={!isMonitoring}
                    title={!isMonitoring ? "Inicia el monitoreo primero" : ""}
                  >
                    {countdownActive ? (
                      <>
                        <Pause className="mr-2 h-4 w-4" />
                        Pausa
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        {countdownLeft === COUNTDOWN_SECONDS && !countdownDone
                          ? "Iniciar"
                          : "Reanudar"}
                      </>
                    )}
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setCountdownActive(false);
                      setCountdownDone(false);
                      setCountdownLeft(COUNTDOWN_SECONDS);
                    }}
                    disabled={!isMonitoring}
                  >
                    Reset
                  </Button>
                </div>
              </div>

              {countdownDone && (
                <div className="mt-3 rounded-md border bg-emerald-50 p-3 text-sm text-emerald-900">
                  ✅ Ya se tomaron las muestras necesarias.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sticky 2: Breathing loop */}
          <Card className="w-full max-w-[360px] shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Guía de Respiración (2-2-6)
              </CardTitle>
              <CardDescription className="text-xs">
                Inhala 2s · Aguanta 2s · Sopla 6s (bucle)
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-0">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-2">
                  <div
                    className={[
                      "inline-flex items-center gap-2 rounded-md border px-3 py-1.5",
                      phaseColorClasses(currentPhase.phase),
                    ].join(" ")}
                  >
                    <span className="text-sm font-semibold">
                      {currentPhase.label}
                    </span>
                    <span className="text-lg font-bold tabular-nums">
                      {phaseLeft}s
                    </span>
                  </div>

                  {/* “animación” simple: barra de progreso */}
                  <div className="h-2 w-[220px] rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-foreground/70 transition-all duration-300"
                      style={{
                        width: `${(phaseLeft / currentPhase.seconds) * 100}%`,
                      }}
                    />
                  </div>
                </div>

                <Button size="sm" onClick={toggleBreathing}>
                  {breathRunning ? (
                    <>
                      <Pause className="mr-2 h-4 w-4" />
                      Pausa
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Iniciar
                    </>
                  )}
                </Button>
              </div>

              <div className="mt-2 text-xs text-muted-foreground">
                Beep en cada cambio de fase.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Monitoreo en Tiempo Real
          </h2>
          <p className="text-muted-foreground">
            {user?.type?.includes?.("doctor")
              ? "Supervisa en vivo por paciente"
              : "Monitoreo continuo de tus signos vitales"}
          </p>
        </div>

        {/* Selector de Paciente + Estado Conexión + CTA */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Select
              value={patientId ? String(patientId) : ALL}
              onValueChange={(v) => setPatientId(v === ALL ? "" : v)}
              disabled={isMonitoring || loadingPatients}
            >
              <SelectTrigger className="min-w-[220px]">
                <SelectValue
                  placeholder={
                    loadingPatients
                      ? "Cargando pacientes..."
                      : "Selecciona paciente (opcional)"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos</SelectItem>
                {patients.map((p) => {
                  const id = String(p.id);
                  const name = (p.user?.fullname ?? "").trim() || id;
                  return (
                    <SelectItem key={id} value={id}>
                      <div className="flex items-center gap-2">
                        <UserRound className="h-3.5 w-3.5" />
                        <span>{name}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            {isConnected ? (
              <>
                <Wifi className="h-4 w-4 text-green-600" />
                <Badge className="bg-green-100 text-green-800">Conectado</Badge>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-gray-400" />
                <Badge variant="secondary">Desconectado</Badge>
              </>
            )}
          </div>

          {isMonitoring ? (
            <Button onClick={stopMonitoring} variant="destructive">
              <Square className="mr-2 h-4 w-4" />
              Detener
            </Button>
          ) : (
            <Button onClick={startMonitoring}>
              <Play className="mr-2 h-4 w-4" />
              Iniciar
            </Button>
          )}
        </div>
      </div>

      {/* Estado actual */}
      {latestReading && (
        <Card>
          <CardHeader>
            <CardTitle>{patientLabel}</CardTitle>
            <CardDescription>
              Última actualización:{" "}
              {new Date(latestReading.timestamp).toLocaleTimeString("es-ES")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="text-center p-4 rounded-lg border">
                <p className="text-sm font-medium text-muted-foreground">
                  Frecuencia Cardíaca
                </p>
                <p className="text-3xl font-bold text-red-600">
                  {latestReading.bpm ?? "—"} {latestReading.bpm ? "bpm" : ""}
                </p>
              </div>
              <div className="text-center p-4 rounded-lg border">
                <p className="text-sm font-medium text-muted-foreground">
                  Flujo Respiratorio (Mic)
                </p>
                <p className="text-3xl font-bold text-blue-600">
                  {latestReading.airflowValue ?? "—"}
                </p>
              </div>
              <div className="text-center p-4 rounded-lg border">
                <p className="text-sm font-medium text-muted-foreground">
                  SpO₂
                </p>
                <p className="text-3xl font-bold text-green-600">
                  {latestReading.spo2 ?? "—"}
                  {latestReading.spo2 ? "%" : ""}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gráficos RT */}
      {rtAsSessionData.length > 0 && (
        <div className="space-y-6">
          <VitalSignsChart
            data={rtAsSessionData}
            title={`Signos Vitales – ${patientLabel}`}
            description="Stream por MQTT (WS)"
            showBpm
            showSpo2
            showRespRate
          />
          <BreathingPatternChart
            data={rtAsSessionData}
            title="Patrón Respiratorio – Tiempo Real"
            description="Mic vs presión (auto-switch por canal disponible)"
            showBaseline
            showPhaseBands
          />
        </div>
      )}

      {/* Empty state */}
      {!isMonitoring && rtAsSessionData.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-center space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                <Play className="h-6 w-6 text-gray-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Monitoreo Detenido</h3>
                <p className="text-muted-foreground">
                  Selecciona paciente (opcional) y presiona “Iniciar” para
                  suscribirte al stream MQTT
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
