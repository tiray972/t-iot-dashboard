"use client";

import { Activity, Battery, Radio, RefreshCw, Signal, Thermometer, Waves } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { DashboardResponse, LoraReading } from "@/types/lora";

const refreshMs = Number(process.env.NEXT_PUBLIC_DASHBOARD_REFRESH_MS || 15000);

type MetricKey = "temperature" | "humidity" | "battery" | "rssi" | "snr";

const metrics: Array<{
  key: MetricKey;
  label: string;
  suffix: string;
  stroke: string;
}> = [
  { key: "temperature", label: "Temperature", suffix: "degC", stroke: "#ef4444" },
  { key: "humidity", label: "Humidite", suffix: "%", stroke: "#0ea5e9" },
  { key: "battery", label: "Batterie", suffix: "%", stroke: "#22c55e" },
  { key: "rssi", label: "RSSI", suffix: "dBm", stroke: "#f59e0b" },
  { key: "snr", label: "SNR", suffix: "dB", stroke: "#8b5cf6" }
];

export default function DashboardClient() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    try {
      setError(null);
      const response = await fetch("/api/firebase-data", { cache: "no-store" });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Impossible de charger Firebase");
      }

      setData(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    const timer = window.setInterval(loadData, refreshMs);
    return () => window.clearInterval(timer);
  }, []);

  const items = data?.items || [];
  const latest = data?.summary.latest;
  const lastSeen = latest ? new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(latest.timestamp)) : "--";

  const signalHealth = useMemo(() => {
    const rssi = latest?.rssi;
    if (rssi === undefined) return "En attente";
    if (rssi > -75) return "Bon signal";
    if (rssi > -95) return "Signal moyen";
    return "Signal faible";
  }, [latest]);

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">T-IOT-77 / M5Stack LoRa</p>
          <h1>Dashboard Firebase</h1>
        </div>
        <button className="refresh-button" type="button" onClick={loadData} disabled={loading}>
          <RefreshCw size={18} aria-hidden="true" />
          <span>{loading ? "Chargement" : "Actualiser"}</span>
        </button>
      </header>

      {error ? <div className="alert">{error}</div> : null}

      <section className="status-grid" aria-label="Indicateurs">
        <StatCard icon={<Activity size={22} />} label="Paquets" value={String(data?.summary.total ?? 0)} detail={data?.source || "demo"} />
        <StatCard icon={<Thermometer size={22} />} label="Temp. moyenne" value={formatValue(data?.summary.averageTemperature, "degC")} detail={formatValue(latest?.temperature, "degC", "Derniere")} />
        <StatCard icon={<Waves size={22} />} label="Humidite moyenne" value={formatValue(data?.summary.averageHumidity, "%")} detail={formatValue(latest?.humidity, "%", "Derniere")} />
        <StatCard icon={<Battery size={22} />} label="Batterie moyenne" value={formatValue(data?.summary.averageBattery, "%")} detail={formatValue(latest?.battery, "%", "Derniere")} />
        <StatCard icon={<Signal size={22} />} label="Signal" value={formatValue(latest?.rssi, "dBm")} detail={signalHealth} />
        <StatCard icon={<Radio size={22} />} label="Derniere reception" value={lastSeen} detail={latest?.gatewayId || "Gateway inconnue"} />
      </section>

      <section className="charts-grid" aria-label="Graphiques">
        {metrics.map((metric) => (
          <ChartPanel
            key={metric.key}
            title={metric.label}
            suffix={metric.suffix}
            stroke={metric.stroke}
            items={items}
            metricKey={metric.key}
          />
        ))}
      </section>

      <section className="table-section" aria-label="Dernieres donnees">
        <div className="section-heading">
          <h2>Dernieres donnees</h2>
          <p>{items.length} points charges</p>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Heure</th>
                <th>Device</th>
                <th>Temp.</th>
                <th>Hum.</th>
                <th>Bat.</th>
                <th>RSSI</th>
                <th>SNR</th>
                <th>Payload</th>
              </tr>
            </thead>
            <tbody>
              {items.slice(-12).reverse().map((item) => (
                <tr key={item.id}>
                  <td>{formatTime(item.timestamp)}</td>
                  <td>{item.deviceId || "--"}</td>
                  <td>{formatValue(item.temperature, "degC")}</td>
                  <td>{formatValue(item.humidity, "%")}</td>
                  <td>{formatValue(item.battery, "%")}</td>
                  <td>{formatValue(item.rssi, "dBm")}</td>
                  <td>{formatValue(item.snr, "dB")}</td>
                  <td className="payload-cell">{item.payload || "--"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function StatCard({
  icon,
  label,
  value,
  detail
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <article className="stat-card">
      <div className="stat-icon">{icon}</div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{detail || "--"}</span>
      </div>
    </article>
  );
}

function ChartPanel({
  title,
  suffix,
  stroke,
  items,
  metricKey
}: {
  title: string;
  suffix: string;
  stroke: string;
  items: LoraReading[];
  metricKey: MetricKey;
}) {
  const points = items
    .map((item) => ({ timestamp: item.timestamp, value: item[metricKey] }))
    .filter((point): point is { timestamp: string; value: number } => Number.isFinite(point.value));
  const latest = points.at(-1)?.value;

  return (
    <article className="chart-panel">
      <div className="chart-heading">
        <div>
          <h2>{title}</h2>
          <p>{points.length} mesures</p>
        </div>
        <strong>{formatValue(latest, suffix)}</strong>
      </div>
      <LineChart points={points} stroke={stroke} suffix={suffix} />
    </article>
  );
}

function LineChart({
  points,
  stroke,
  suffix
}: {
  points: Array<{ timestamp: string; value: number }>;
  stroke: string;
  suffix: string;
}) {
  const width = 640;
  const height = 210;
  const padding = 24;

  if (points.length < 2) {
    return <div className="empty-chart">Pas assez de donnees</div>;
  }

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const path = points
    .map((point, index) => {
      const x = padding + (index / (points.length - 1)) * (width - padding * 2);
      const y = height - padding - ((point.value - min) / range) * (height - padding * 2);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className="chart-frame">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Evolution ${suffix}`}>
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} />
        <path d={path} stroke={stroke} />
        {points.map((point, index) => {
          if (index % Math.max(1, Math.floor(points.length / 12)) !== 0 && index !== points.length - 1) {
            return null;
          }

          const x = padding + (index / (points.length - 1)) * (width - padding * 2);
          const y = height - padding - ((point.value - min) / range) * (height - padding * 2);
          return <circle key={`${point.timestamp}-${index}`} cx={x} cy={y} r="3.5" fill={stroke} />;
        })}
        <text x={padding + 4} y={padding + 4}>{formatValue(max, suffix)}</text>
        <text x={padding + 4} y={height - padding - 6}>{formatValue(min, suffix)}</text>
      </svg>
    </div>
  );
}

function formatValue(value?: number, suffix?: string, prefix?: string): string {
  if (!Number.isFinite(value)) {
    return prefix ? `${prefix}: --` : "--";
  }

  const text = `${Number(value).toFixed(1)}${suffix ? ` ${suffix}` : ""}`;
  return prefix ? `${prefix}: ${text}` : text;
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(value));
}
