export type LoraReading = {
  id: string;
  timestamp: string;
  gatewayId?: string;
  deviceId?: string;
  payload?: string;
  temperature?: number;
  humidity?: number;
  heatIndex?: number;
  battery?: number;
  airRaw?: number;
  airQuality?: string;
  p1?: number;
  p2?: number;
  rssi?: number;
  snr?: number;
  uptimeMs?: number;
};

export type DashboardResponse = {
  source: "firebase-rtdb" | "firestore" | "demo";
  generatedAt: string;
  warning?: string;
  items: LoraReading[];
  summary: {
    total: number;
    latest?: LoraReading;
    averageTemperature?: number;
    averageHumidity?: number;
    averageHeatIndex?: number;
    averageAirRaw?: number;
    averageP1?: number;
    averageP2?: number;
    averageRssi?: number;
    averageBattery?: number;
  };
};
