import mqtt from "mqtt";
// Importa SOLO EL TIPO (no se emite en runtime)
import type { IClientOptions, MqttClient } from "mqtt";

/**
 * Construye el URL del broker MQTT WS a partir de env y/o defaults locales.
 * Ej: VITE_MQTT_URL=ws://192.168.1.50:9001
 */
const DEFAULT_URL = "ws://localhost:9001";

/**
 * Opciones sensatas para LAN. Ajusta clientId para evitar colisiones.
 */
const opts: IClientOptions = {
  keepalive: 30,
  reconnectPeriod: 2000,
  connectTimeout: 5000,
  clean: true,
  clientId: `web-${crypto?.randomUUID?.() ?? Math.random().toString(16).slice(2)}`,
};

/**
 * Singleton de cliente MQTT.
 */
let _client: MqttClient | null = null;

export function getMqttClient(url = DEFAULT_URL): MqttClient {
  if (_client) return _client;
  _client = mqtt.connect(url, opts);
  return _client;
}

/**
 * Cierra y limpia el singleton (opcional).
 */
export function closeMqttClient() {
  try {
    _client?.end(true);
  } catch {
    console.error("error");
  }
  _client = null;
}
