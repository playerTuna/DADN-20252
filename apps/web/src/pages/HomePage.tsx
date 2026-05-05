import { useCallback, useEffect, useState } from 'react';
import { StatusMessage } from '../components/StatusMessage';
import { Toggle } from '../components/Toggle';
import {
  getAlertsLive,
  getDashboard,
  getManagedDevices,
  getQuickStatsLive,
  getUser,
  toggleManagedDeviceAutoMode,
  updateManagedDevicePower,
  type ManagedDevice,
  type UserProfile,
} from '../services/api';
import type { AlertItem, DashboardData, NavKey, StatItem } from '../types/dashboard';

type ControlItem = {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  mode: 'auto' | 'manually';
  state: 'online' | 'offline';
};

function mapDevicesToControls(devices: ManagedDevice[]): ControlItem[] {
  return devices.map((device) => ({
    id: device.id,
    name: device.name,
    type: device.id === 'rgb' ? 'light' : device.id,
    enabled: Boolean(device.power),
    mode: device.autoMode ? 'auto' : 'manually',
    state: device.connectionStatus === 'online' ? 'online' : device.power ? 'online' : 'offline',
  }));
}

function sensorInitial(label: string) {
  const normalized = label.toLowerCase();
  if (normalized.includes('temperature')) return 'T';
  if (normalized.includes('air')) return 'A';
  if (normalized.includes('soil')) return 'S';
  if (normalized.includes('light')) return 'L';
  return label.charAt(0).toUpperCase();
}

export function HomePage() {
  const [dashboard, setDashboard] = useState<Record<NavKey, DashboardData> | null>(null);
  const [stats, setStats] = useState<StatItem[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [devices, setDevices] = useState<ManagedDevice[]>([]);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingPowerId, setPendingPowerId] = useState<string | null>(null);
  const [pendingModeId, setPendingModeId] = useState<string | null>(null);

  const refreshLiveData = useCallback(async () => {
    const [nextStats, nextAlerts, nextDevices] = await Promise.all([
      getQuickStatsLive(),
      getAlertsLive(12),
      getManagedDevices(),
    ]);
    setStats(nextStats);
    setAlerts(nextAlerts);
    setDevices(nextDevices);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    void (async () => {
      try {
        const [nextDashboard, nextUser] = await Promise.all([getDashboard(), getUser()]);
        if (cancelled) return;
        setDashboard(nextDashboard);
        setUser(nextUser);
        await refreshLiveData();
        if (!cancelled) setError(null);
      } catch (err) {
        console.log('Home load failed', err);
        if (!cancelled) setError('Some dashboard data is unavailable.');
      } finally {
        if (!cancelled) setLoading(false);
      }

      if (!cancelled) {
        timer = setInterval(() => {
          void refreshLiveData().catch(() => undefined);
        }, 10000);
      }
    })();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [refreshLiveData]);

  const handlePower = async (id: string, next: boolean) => {
    const snapshot = [...devices];
    setDevices((current) =>
      current.map((device) => (device.id === id ? { ...device, power: next } : device))
    );
    setPendingPowerId(id);

    try {
      await updateManagedDevicePower(id, next ? 'ON' : 'OFF');
      setDevices(await getManagedDevices());
      setError(null);
    } catch (err) {
      console.log('Power command failed', err);
      setDevices(snapshot);
      setError('Unable to send device command.');
    } finally {
      setPendingPowerId(null);
    }
  };

  const handleMode = async (id: string) => {
    const snapshot = [...devices];
    setDevices((current) =>
      current.map((device) =>
        device.id === id ? { ...device, autoMode: !device.autoMode } : device
      )
    );
    setPendingModeId(id);

    try {
      setDevices(await toggleManagedDeviceAutoMode(id));
      setError(null);
    } catch (err) {
      console.log('Mode command failed', err);
      setDevices(snapshot);
      setError('Unable to update automation mode.');
    } finally {
      setPendingModeId(null);
    }
  };

  const controlItems = mapDevicesToControls(devices).slice(0, 5);
  const visibleStats = stats.length ? stats : dashboard?.home.stats ?? [];
  const visibleAlerts = alerts.length ? alerts : dashboard?.home.alerts.slice(0, 6) ?? [];

  return (
    <div className="page-stack">
      <header className="page-header hero-card">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1>Home</h1>
          <p>Hi {user?.displayName || 'there'}, your farm overview is ready.</p>
        </div>
        {loading ? <span className="spinner" /> : null}
      </header>

      {error ? <StatusMessage>{error}</StatusMessage> : null}

      <section className="stat-grid" aria-label="Quick stats">
        {visibleStats.map((item) => (
          <article key={item.label} className="stat-card">
            <span className="stat-icon">{sensorInitial(item.label)}</span>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </article>
        ))}
      </section>

      <section className="content-grid">
        <div className="panel">
          <div className="section-heading">
            <h2>Quick controls</h2>
            <span>{controlItems.length} devices</span>
          </div>

          <div className="control-list">
            {controlItems.length === 0 ? <p className="empty-text">No managed devices.</p> : null}
            {controlItems.map((item) => (
              <article key={item.id} className="control-card">
                <div className="device-summary">
                  <span className="device-icon">{item.type.charAt(0).toUpperCase()}</span>
                  <div>
                    <h3>{item.name}</h3>
                    <p>{item.state}</p>
                  </div>
                </div>

                <div className="control-actions">
                  <button
                    type="button"
                    className="mode-chip"
                    disabled={pendingModeId === item.id}
                    onClick={() => void handleMode(item.id)}
                  >
                    {pendingModeId === item.id ? 'Updating' : item.mode}
                  </button>
                  <Toggle
                    checked={item.enabled}
                    loading={pendingPowerId === item.id}
                    onChange={(next) => {
                      void handlePower(item.id, next);
                    }}
                  />
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="section-heading">
            <h2>Alerts</h2>
            <span>Latest</span>
          </div>

          <div className="alert-list">
            {visibleAlerts.length === 0 ? <p className="empty-text">No alerts yet.</p> : null}
            {visibleAlerts.map((item) => (
              <article key={item.id} className="alert-item">
                <span>{item.text}</span>
                <time>{item.time}</time>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
