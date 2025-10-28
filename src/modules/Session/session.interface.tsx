// modules/Session/session.interface.ts
import type { Patient } from "@/modules/Patient/patient.interface";
import type { Device } from "@/modules/Device/device.interface";

export interface SessionData {
  id: string;

  // === Respiración primaria ===
  airflowValue?: number | null; // señal filtrada
  respBaseline?: number | null;
  respDiffAbs?: number | null;
  respRate?: number | null; // respiraciones/min

  // === Cardiaco / SpO2 ===
  bpm?: number | null;
  spo2?: number | null;

  // === Respiración secundaria ===
  resp2Adc?: number | null;
  resp2Positive?: boolean | null;

  // === Legado (si el backend aún lo rellena para compat) ===
  micAirValue?: number | null;

  recordedAt: string; // ISO
}

export interface Session {
  id: string;
  patient: Patient;
  device: Device;
  startedAt: string; // ISO
  endedAt?: string | null;
  records: SessionData[];
}
