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
import { Play, Square, Wifi, WifiOff, UserRound } from "lucide-react";
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

  // Respiración primaria
  airflowValue?: number;
  respBaseline?: number;
  respDiffAbs?: number;
  respRate?: number;

  // Cardíaco / SpO2
  bpm?: number;
  spo2?: number;

  // Respiración secundaria
  resp2Adc?: number;
  resp2Positive?: boolean;

  // Legado
  micAirValue?: number;
};

// === Estructura interna en frontend para RT ===
type RTReading = {
  id: string;
  serialNumber: string;
  timestamp: string; // ISO
  patientId?: string;

  // Respiración primaria
  airflowValue?: number;
  respBaseline?: number;
  respDiffAbs?: number;
  respRate?: number;

  // Cardíaco / SpO2
  bpm?: number;
  spo2?: number;

  // Respiración secundaria
  resp2Adc?: number;
  resp2Positive?: boolean;

  // Legado
  micAirValue?: number;
};

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
          bpm: data.bpm,
          spo2: data.spo2,
          resp2Adc: data.resp2Adc,
          resp2Positive: data.resp2Positive,
          micAirValue: data.micAirValue,
        };

        setRealtimeData((prev) => [...prev.slice(-299), reading]); // buffer 300
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

  const startMonitoring = () => {
    setRealtimeData([]);
    setIsMonitoring(true);
  };

  const stopMonitoring = () => {
    setIsMonitoring(false);
    setRealtimeData([]);
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

  // ===== Adaptadores -> los charts esperan SessionData[] y hacen su propio mapping =====
  const rtAsSessionData: SessionData[] = useMemo(
    () =>
      realtimeData.map<SessionData>((r) => ({
        id: r.id, // puede ser UUID local
        recordedAt: r.timestamp,
        // respiración primaria
        airflowValue: r.airflowValue ?? null,
        respBaseline: r.respBaseline ?? null,
        respDiffAbs: r.respDiffAbs ?? null,
        respRate: r.respRate ?? null,
        // cardio / SpO2
        bpm: r.bpm ?? null,
        spo2: r.spo2 ?? null,
        // respiración secundaria
        resp2Adc: r.resp2Adc ?? null,
        resp2Positive:
          typeof r.resp2Positive === "boolean" ? r.resp2Positive : null,
        // legado
        micAirValue: r.micAirValue ?? null,
      })),
    [realtimeData],
  );

  return (
    <div className="space-y-6">
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
                  const id = String(p.id); // blindaje por si viene numérico
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
                  Flujo Respiratorio
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
            description="Fase derivada del sensor secundario y mic"
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
