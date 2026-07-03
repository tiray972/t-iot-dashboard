export type LoraReading = {
  id: string;
  timestamp: string;
  gatewayId?: string;
  deviceId?: string;
  payload?: string;
  temperature?: number;
  humidity?: number;
  battery?: number;
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
    averageRssi?: number;
    averageBattery?: number;
  };
};
