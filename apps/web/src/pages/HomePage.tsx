import { useCallback, useEffect, useMemo, useState } from 'react';
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

const alertsPerPage = 6;
const controlsPerPage = 5;

type DeviceType = 'fan' | 'pump' | 'speaker' | 'rgb' | 'light' | string;
type DeviceState = 'online' | 'offline';

type HomeControlItem = {
  id: string;
  name: string;
  type: DeviceType;
  enabled: boolean;
  mode: 'auto' | 'manually';
  state: DeviceState;
};

function paginationItems(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, 2, 3, total - 1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b);

  const output: (number | 'ellipsis')[] = [];

  for (let index = 0; index < sorted.length; index += 1) {
    if (index > 0 && sorted[index] - sorted[index - 1] > 1) {
      output.push('ellipsis');
    }

    output.push(sorted[index]);
  }

  return output;
}

function mapDevicesToControls(devices: ManagedDevice[]): HomeControlItem[] {
  return devices.map((device) => ({
    id: device.id,
    name: device.name,
    type: device.id === 'rgb' ? 'light' : device.id,
    enabled: Boolean(device.power),
    mode: device.autoMode ? 'auto' : 'manually',
    state: device.connectionStatus === 'online' ? 'online' : device.power ? 'online' : 'offline',
  }));
}

function displayHomeTitle(title?: string) {
  if (!title || title === 'Home - Dashboards') {
    return 'Home';
  }

  return title;
}

function getStatIconType(label: string) {
  const normalized = label.toLowerCase();

  if (normalized.includes('temperature')) return 'temperature';
  if (normalized.includes('air')) return 'air';
  if (normalized.includes('soil')) return 'soil';
  if (normalized.includes('light')) return 'light';
  if (normalized.includes('humidity')) return 'humidity';

  return 'default';
}

function StatIcon({ label }: { label: string }) {
  const type = getStatIconType(label);

  if (type === 'temperature') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M14 14.76V5a4 4 0 1 0-8 0v9.76A5 5 0 1 0 14 14.76z" />
        <path d="M10 9v7" />
      </svg>
    );
  }

  if (type === 'humidity' || type === 'air') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2.5s6 6.2 6 11.2a6 6 0 0 1-12 0c0-5 6-11.2 6-11.2z" />
        <path d="M9.5 14.5a2.5 2.5 0 0 0 5 0" />
      </svg>
    );
  }

  if (type === 'soil') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 18h16" />
        <path d="M6 14h12" />
        <path d="M8 10h8" />
        <path d="M12 10V4" />
        <path d="M12 4c-2.8 0-5 1.8-5 4 2.6 0 4.1-.9 5-4z" />
        <path d="M12 4c2.8 0 5 1.8 5 4-2.6 0-4.1-.9-5-4z" />
      </svg>
    );
  }

  if (type === 'light') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2" />
        <path d="M12 20v2" />
        <path d="M2 12h2" />
        <path d="M20 12h2" />
        <path d="m4.93 4.93 1.41 1.41" />
        <path d="m17.66 17.66 1.41 1.41" />
        <path d="m6.34 17.66-1.41 1.41" />
        <path d="m19.07 4.93-1.41 1.41" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <path d="M8 16v-5" />
      <path d="M12 16V8" />
      <path d="M16 16v-3" />
    </svg>
  );
}

function DeviceIcon({ type }: { type: DeviceType }) {
  if (type === 'pump') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 10h10" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        <path d="M6 10h12v9a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z" />
        <path d="M9 14h6" />
        <path d="M9 17h6" />
      </svg>
    );
  }

  if (type === 'fan') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 12h10" />
        <path d="M4 6h16" />
        <path d="M4 18h13" />
        <path d="M17 12c1.7 0 3 1.3 3 3s-1.3 3-3 3" />
      </svg>
    );
  }

  if (type === 'speaker') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M11 5 6 9H3v6h3l5 4z" />
        <path d="M16 9a5 5 0 0 1 0 6" />
        <path d="M19 6a9 9 0 0 1 0 12" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  );
}

function Pagination({
  items,
  current,
  onChange,
}: {
  items: (number | 'ellipsis')[];
  current: number;
  onChange: (page: number) => void;
}) {
  return (
    <div className="home-pagination">
      {items.map((entry, index) =>
        entry === 'ellipsis' ? (
          <span key={`el-${index}`} className="home-page-ellipsis">
            ...
          </span>
        ) : (
          <button
            key={entry}
            type="button"
            className={`home-page-button ${entry === current ? 'active' : ''}`}
            onClick={() => onChange(entry)}
          >
            {entry}
          </button>
        )
      )}
    </div>
  );
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

  const [alertPage, setAlertPage] = useState(1);
  const [controlPage, setControlPage] = useState(1);

  const refreshLiveData = useCallback(async () => {
    const [nextStats, nextAlerts, nextDevices] = await Promise.all([
      getQuickStatsLive(),
      getAlertsLive(40),
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

        if (!cancelled) {
          setError(null);
        }
      } catch (err) {
        console.log('Home load failed', err);

        if (!cancelled) {
          setError('Some dashboard data is unavailable.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }

      if (!cancelled) {
        timer = setInterval(() => {
          void refreshLiveData().catch(() => undefined);
        }, 10_000);
      }
    })();

    return () => {
      cancelled = true;

      if (timer) {
        clearInterval(timer);
      }
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

  const homeData = dashboard?.home;
  const visibleStats = stats.length ? stats : (homeData?.stats ?? []);
  const visibleAlerts = alerts.length ? alerts : (homeData?.alerts.slice(0, 40) ?? []);

  const controlItems = useMemo(() => mapDevicesToControls(devices), [devices]);

  const totalAlertPages = Math.max(1, Math.ceil(visibleAlerts.length / alertsPerPage));
  const totalControlPages = Math.max(1, Math.ceil(controlItems.length / controlsPerPage));

  const safeAlertPage = Math.min(alertPage, totalAlertPages);
  const safeControlPage = Math.min(controlPage, totalControlPages);

  const pagedAlerts = visibleAlerts.slice(
    (safeAlertPage - 1) * alertsPerPage,
    (safeAlertPage - 1) * alertsPerPage + alertsPerPage
  );

  const pagedControls = controlItems.slice(
    (safeControlPage - 1) * controlsPerPage,
    (safeControlPage - 1) * controlsPerPage + controlsPerPage
  );

  const alertPageItems = paginationItems(safeAlertPage, totalAlertPages);
  const controlPageItems = paginationItems(safeControlPage, totalControlPages);

  return (
    <div className="page-stack home-page-web">
      <header className="home-hero-card">
        <div className="home-hero-icon">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 19V8" />
            <path d="M4 19h16" />
            <path d="M8 19v-7" />
            <path d="M12 19V5" />
            <path d="M16 19v-4" />
            <path d="M20 19v-9" />
          </svg>
        </div>

        <div>
          <p className="eyebrow">Dashboard</p>
          <h1>{displayHomeTitle(homeData?.title)}</h1>
          <p>Hi {user?.displayName || 'there'}, your farm overview is ready.</p>
        </div>

        {loading ? <span className="spinner" /> : null}
      </header>

      {error ? <StatusMessage>{error}</StatusMessage> : null}

      <section className="home-section">
        <div className="home-section-heading">
          <div>
            <h2>Quick Stats</h2>
            <p>Live sensor summary from your farm.</p>
          </div>
          <span>{visibleStats.length} metrics</span>
        </div>

        <div className="home-stat-grid" aria-label="Quick stats">
          {visibleStats.map((item) => (
            <article key={item.label} className="home-stat-card">
              <div className="home-stat-top">
                <span className="home-stat-icon">
                  <StatIcon label={item.label} />
                </span>
                <span className="home-stat-label">{item.label}</span>
              </div>

              <strong>{item.value}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="home-main-grid">
        <div className="home-panel">
          <div className="home-section-heading compact">
            <div>
              <h2>Quick Control</h2>
              <p>Manual power and device mode.</p>
            </div>
            <span>{controlItems.length} devices</span>
          </div>

          <div className="home-control-list">
            {pagedControls.length === 0 ? (
              <p className="home-empty-text">No managed devices available.</p>
            ) : null}

            {pagedControls.map((item) => (
              <article key={item.id} className="home-control-row">
                <div className="home-control-left">
                  <span className={`home-device-icon home-device-${item.type}`}>
                    <DeviceIcon type={item.type} />
                  </span>

                  <div>
                    <h3>{item.name}</h3>
                    <p>
                      <span className={item.state === 'online' ? 'home-dot online' : 'home-dot'} />
                      {item.state}
                    </p>
                  </div>
                </div>

                <div className="home-control-actions">
                  <button
                    type="button"
                    className="home-mode-button"
                    disabled={pendingModeId === item.id}
                    onClick={() => void handleMode(item.id)}
                  >
                    {pendingModeId === item.id ? 'updating...' : item.mode}
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

            {totalControlPages > 1 ? (
              <Pagination
                items={controlPageItems}
                current={safeControlPage}
                onChange={setControlPage}
              />
            ) : null}
          </div>
        </div>

        <div className="home-panel">
          <div className="home-section-heading compact">
            <div>
              <h2>Alert log</h2>
              <p>Latest alerts from your system.</p>
            </div>
            <span>Latest</span>
          </div>

          <div className="home-alert-list">
            {pagedAlerts.length === 0 ? <p className="home-empty-text">No alerts yet.</p> : null}

            {pagedAlerts.map((item) => (
              <article key={item.id} className="home-alert-row">
                <span className="home-alert-icon">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 9v4" />
                    <path d="M12 17h.01" />
                    <path d="M10.3 3.9 2.5 17.3A2 2 0 0 0 4.2 20h15.6a2 2 0 0 0 1.7-2.7L13.7 3.9a2 2 0 0 0-3.4 0z" />
                  </svg>
                </span>

                <div>
                  <p>{item.text}</p>
                  <time>{item.time}</time>
                </div>
              </article>
            ))}

            {totalAlertPages > 1 ? (
              <Pagination items={alertPageItems} current={safeAlertPage} onChange={setAlertPage} />
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
