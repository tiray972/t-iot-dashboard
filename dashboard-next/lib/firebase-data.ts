import type { DashboardResponse, LoraReading } from "@/types/lora";

type FirestoreValue =
  | { stringValue?: string }
  | { integerValue?: string }
  | { doubleValue?: number }
  | { timestampValue?: string }
  | { booleanValue?: boolean }
  | { mapValue?: { fields?: Record<string, FirestoreValue> } };

type FirestoreDocument = {
  name: string;
  createTime?: string;
  updateTime?: string;
  fields?: Record<string, FirestoreValue>;
};

const DEFAULT_LIMIT = 100;

export async function loadDashboardData(): Promise<DashboardResponse> {
  const limit = readLimit();

  try {
    if (process.env.FIREBASE_RTDB_URL) {
      const items = await fetchRealtimeDatabase(limit);
      return buildResponse("firebase-rtdb", items);
    }

    if (process.env.FIREBASE_FIRESTORE_PROJECT_ID) {
      const items = await fetchFirestore(limit);
      return buildResponse("firestore", items);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Firebase unavailable";
    return buildResponse("demo", [], `Firebase configure mais aucune donnee reelle chargee: ${message}`);
  }

  return buildResponse("demo", buildDemoReadings());
}

async function fetchRealtimeDatabase(limit: number): Promise<LoraReading[]> {
  const baseUrl = process.env.FIREBASE_RTDB_URL?.replace(/\/$/, "");
  const path = (process.env.FIREBASE_RTDB_PATH || "lora-readings").replace(/^\/|\/$/g, "");

  if (!baseUrl) {
    return [];
  }

  const url = new URL(`${baseUrl}/${path}.json`);
  const auth = process.env.FIREBASE_ID_TOKEN || process.env.FIREBASE_DATABASE_SECRET;

  if (auth) {
    url.searchParams.set("auth", auth);
  }

  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Firebase RTDB error ${response.status}: ${await response.text()}`);
  }

  const raw = await response.json();

  if (!raw) {
    return [];
  }

  const entries = Array.isArray(raw)
    ? raw.map((value, index) => [String(index), value] as const)
    : Object.entries(raw);

  return entries
    .map(([id, value]) => normalizeReading(id, value))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .slice(-limit);
}

export async function saveDashboardReading(input: unknown): Promise<LoraReading> {
  const reading = normalizeReading(`ingest-${Date.now()}`, {
    ...normalizeObjectInput(input),
    timestamp: new Date().toISOString()
  });

  if (process.env.FIREBASE_RTDB_URL) {
    await writeRealtimeDatabase(reading);
    return reading;
  }

  if (process.env.FIREBASE_FIRESTORE_PROJECT_ID) {
    await writeFirestore(reading);
    return reading;
  }

  return reading;
}

async function writeRealtimeDatabase(reading: LoraReading): Promise<void> {
  const baseUrl = process.env.FIREBASE_RTDB_URL?.replace(/\/$/, "");
  const path = (process.env.FIREBASE_RTDB_PATH || "lora-readings").replace(/^\/|\/$/g, "");

  if (!baseUrl) {
    return;
  }

  const url = new URL(`${baseUrl}/${path}.json`);
  const auth = process.env.FIREBASE_ID_TOKEN || process.env.FIREBASE_DATABASE_SECRET;

  if (auth) {
    url.searchParams.set("auth", auth);
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reading)
  });

  if (!response.ok) {
    throw new Error(`Firebase RTDB write error ${response.status}: ${await response.text()}`);
  }
}

async function writeFirestore(reading: LoraReading): Promise<void> {
  const projectId = process.env.FIREBASE_FIRESTORE_PROJECT_ID;
  const collection = process.env.FIREBASE_FIRESTORE_COLLECTION || "lora-readings";

  if (!projectId) {
    return;
  }

  const url = new URL(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}`
  );

  if (process.env.FIREBASE_API_KEY) {
    url.searchParams.set("key", process.env.FIREBASE_API_KEY);
  }

  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (process.env.FIREBASE_BEARER_TOKEN) {
    headers.Authorization = `Bearer ${process.env.FIREBASE_BEARER_TOKEN}`;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ fields: encodeFirestoreFields(reading) })
  });

  if (!response.ok) {
    throw new Error(`Firestore write error ${response.status}: ${await response.text()}`);
  }
}

async function fetchFirestore(limit: number): Promise<LoraReading[]> {
  const projectId = process.env.FIREBASE_FIRESTORE_PROJECT_ID;
  const collection = process.env.FIREBASE_FIRESTORE_COLLECTION || "lora-readings";

  if (!projectId) {
    return [];
  }

  const url = new URL(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}`
  );
  url.searchParams.set("pageSize", String(limit));
  url.searchParams.set("orderBy", "timestamp desc");

  if (process.env.FIREBASE_API_KEY) {
    url.searchParams.set("key", process.env.FIREBASE_API_KEY);
  }

  const headers: HeadersInit = {};
  if (process.env.FIREBASE_BEARER_TOKEN) {
    headers.Authorization = `Bearer ${process.env.FIREBASE_BEARER_TOKEN}`;
  }

  const response = await fetch(url, { cache: "no-store", headers });

  if (!response.ok) {
    throw new Error(`Firestore error ${response.status}: ${await response.text()}`);
  }

  const data = (await response.json()) as { documents?: FirestoreDocument[] };

  return (data.documents || [])
    .map((document) => {
      const fields = decodeFirestoreFields(document.fields || {});
      const id = document.name.split("/").pop() || document.name;
      return normalizeReading(id, {
        ...fields,
        timestamp: fields.timestamp || document.createTime || document.updateTime
      });
    })
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

function normalizeReading(id: string, value: unknown): LoraReading {
  const record = isRecord(value) ? value : {};
  const payload = stringValue(record.payload);
  const parsedPayload = parsePayload(payload);
  const sensorValues = parseSensorDataValues(record.sensordatavalues);
  const timestampValue =
    stringValue(record.timestamp) ||
    stringValue(record.createdAt) ||
    stringValue(record.time) ||
    numberValue(record.timestampMs) ||
    numberValue(record.createdAtMs) ||
    Date.now();

  return {
    id,
    timestamp: toIsoDate(timestampValue),
    gatewayId: stringValue(record.gateway_id) || stringValue(record.gatewayId),
    deviceId: stringValue(record.device_id) || stringValue(record.deviceId) || parsedPayload.id,
    payload,
    temperature:
      numberValue(record.temperature) ??
      numberValue(record.temp) ??
      sensorValues.temperature ??
      parsedPayload.temperature,
    humidity:
      numberValue(record.humidity) ??
      numberValue(record.hum) ??
      sensorValues.humidity ??
      parsedPayload.humidity,
    heatIndex:
      numberValue(record.heatIndex) ??
      numberValue(record.hic) ??
      parsedPayload.heatIndex,
    battery: numberValue(record.battery) ?? numberValue(record.bat) ?? parsedPayload.battery,
    airRaw:
      numberValue(record.airRaw) ??
      numberValue(record.air) ??
      sensorValues.p1 ??
      parsedPayload.airRaw,
    airQuality:
      stringValue(record.airQuality) ||
      stringValue(record.qualite) ||
      parsedPayload.airQuality,
    p1: numberValue(record.p1) ?? numberValue(record.P1) ?? sensorValues.p1,
    p2: numberValue(record.p2) ?? numberValue(record.P2) ?? sensorValues.p2,
    rssi: numberValue(record.rssi),
    snr: numberValue(record.snr),
    uptimeMs: numberValue(record.uptime_ms) ?? numberValue(record.uptimeMs)
  };
}

function parsePayload(payload?: string): Partial<LoraReading> {
  if (!payload) {
    return {};
  }

  const result: Partial<LoraReading> = {};
  const parts = payload.split(";");

  for (const part of parts) {
    const separator = part.includes("=") ? "=" : ":";
    const [rawKey, ...rawValueParts] = part.split(separator);
    const key = rawKey?.trim();
    const value = rawValueParts.join(separator).trim();

    if (!key || !value) {
      continue;
    }

    if (key === "temp") result.temperature = Number(value);
    if (key === "hum") result.humidity = Number(value);
    if (key === "hic") result.heatIndex = Number(value);
    if (key === "bat") result.battery = Number(value);
    if (key === "air") result.airRaw = Number(value);
    if (key === "qualite") result.airQuality = value;
    if (key === "id") result.deviceId = value;
  }

  return result;
}

function parseSensorDataValues(value: unknown): Partial<LoraReading> {
  if (!Array.isArray(value)) {
    return {};
  }

  const result: Partial<LoraReading> = {};

  for (const entry of value) {
    if (!isRecord(entry)) {
      continue;
    }

    const type = stringValue(entry.value_type);
    const entryValue = numberValue(entry.value);

    if (!type || entryValue === undefined) {
      continue;
    }

    if (type === "temperature") result.temperature = entryValue;
    if (type === "humidity") result.humidity = entryValue;
    if (type === "P1") result.p1 = entryValue;
    if (type === "P2") result.p2 = entryValue;
  }

  return result;
}

function normalizeObjectInput(input: unknown): Record<string, unknown> {
  if (!isRecord(input)) {
    return {};
  }

  if (Array.isArray(input.sensordatavalues)) {
    return {
      ...input,
      gatewayId: stringValue(input.gatewayId) || stringValue(input.gateway_id) || "sensor-community-gateway"
    };
  }

  return input;
}

function decodeFirestoreFields(fields: Record<string, FirestoreValue>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, decodeFirestoreValue(value)])
  );
}

function decodeFirestoreValue(value: FirestoreValue): unknown {
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("mapValue" in value) return decodeFirestoreFields(value.mapValue?.fields || {});
  return undefined;
}

function encodeFirestoreFields(record: Record<string, unknown>): Record<string, FirestoreValue> {
  return Object.fromEntries(
    Object.entries(record)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, encodeFirestoreValue(value)])
  );
}

function encodeFirestoreValue(value: unknown): FirestoreValue {
  if (typeof value === "number") {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }

  if (typeof value === "boolean") {
    return { booleanValue: value };
  }

  return { stringValue: String(value) };
}

function buildResponse(
  source: DashboardResponse["source"],
  items: LoraReading[],
  warning?: string
): DashboardResponse {
  const latest = items.at(-1);

  return {
    source,
    generatedAt: new Date().toISOString(),
    warning,
    items,
    summary: {
      total: items.length,
      latest,
      averageTemperature: average(items.map((item) => item.temperature)),
      averageHumidity: average(items.map((item) => item.humidity)),
      averageHeatIndex: average(items.map((item) => item.heatIndex)),
      averageAirRaw: average(items.map((item) => item.airRaw)),
      averageP1: average(items.map((item) => item.p1)),
      averageP2: average(items.map((item) => item.p2)),
      averageRssi: average(items.map((item) => item.rssi)),
      averageBattery: average(items.map((item) => item.battery))
    }
  };
}

function buildDemoReadings(): LoraReading[] {
  const now = Date.now();

  return Array.from({ length: 36 }, (_, index) => {
    const angle = index / 4;
    const temperature = 22 + Math.sin(angle) * 3 + index * 0.03;
    const humidity = 52 + Math.cos(angle / 1.3) * 8;
    const battery = 96 - index * 0.45;
    const airRaw = 420 + Math.sin(angle / 1.5) * 120 + index * 2;
    const rssi = -72 - Math.sin(angle / 1.7) * 9;

    return {
      id: `demo-${index}`,
      timestamp: new Date(now - (35 - index) * 60_000).toISOString(),
      gatewayId: "M5Stack_Receiver_Gateway",
      deviceId: `node-${index % 3}`,
      payload: `id=${index}; temp=${temperature.toFixed(1)}; hum=${humidity.toFixed(1)}; hic=${(temperature + 1.4).toFixed(1)}; air=${airRaw.toFixed(1)}; qualite=Bonne`,
      temperature: round(temperature),
      humidity: round(humidity),
      heatIndex: round(temperature + 1.4),
      battery: round(battery),
      airRaw: round(airRaw),
      airQuality: airRaw > 620 ? "Moyenne" : "Bonne",
      p1: round(airRaw),
      rssi: round(rssi),
      snr: round(7 + Math.cos(angle) * 2),
      uptimeMs: index * 120_000
    };
  });
}

function readLimit(): number {
  const value = Number(process.env.FIREBASE_LIMIT);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_LIMIT;
}

function average(values: Array<number | undefined>): number | undefined {
  const valid = values.filter((value): value is number => Number.isFinite(value));
  if (!valid.length) {
    return undefined;
  }
  return round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function toIsoDate(value: string | number): string {
  const date = typeof value === "number" ? new Date(value) : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
