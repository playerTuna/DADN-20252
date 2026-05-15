import { useCallback, useEffect, useRef, useState } from 'react';
import { StatusMessage } from '../components/StatusMessage';
import { Toggle } from '../components/Toggle';
import { useTelemetryRealtime } from '../hooks/useTelemetryRealtime';
import {
  getAlertsLive,
  getDashboard,
  getManagedDevices,
  getQuickStatsLive,
  getUser,
  mergeStatItemsFromTelemetry,
  toggleManagedDeviceAutoMode,
  updateManagedDevicePower,
  type ManagedDevice,
  type TelemetryRealtimeEvent,
  type UserProfile,
} from '../services/api';
import type { AlertItem, DashboardData, NavKey, StatItem } from '../types/dashboard';
import { setHomeAlertCount } from '../utils/homeAlertBadge';
import {
  formatAlertLevelLabel,
  formatStatDisplayValue,
  isStatValueEmpty,
  resolveAlertSeverity,
  translateDeviceMode,
  translateStatLabel,
  translateConnectionStatus,
} from '../utils/presentation';

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

function alertIcon(severity: ReturnType<typeof resolveAlertSeverity>) {
  if (severity === 'high') return '⚠';
  if (severity === 'low') return '↓';
  return '✓';
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

  const refreshAlerts = useCallback(async () => {
    const nextAlerts = await getAlertsLive(12);
    setAlerts(nextAlerts);
    setHomeAlertCount(nextAlerts.length);
  }, []);

  const refreshLiveData = useCallback(async () => {
    const [nextStats, nextAlerts, nextDevices] = await Promise.all([
      getQuickStatsLive(),
      getAlertsLive(12),
      getManagedDevices(),
    ]);
    setStats(nextStats);
    setAlerts(nextAlerts);
    setDevices(nextDevices);
    setHomeAlertCount(nextAlerts.length);
  }, []);

  const alertRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const scheduleAlertsRefresh = useCallback(() => {
    if (alertRefreshTimerRef.current) {
      clearTimeout(alertRefreshTimerRef.current);
    }
    alertRefreshTimerRef.current = setTimeout(() => {
      void refreshAlerts().catch(() => undefined);
    }, 800);
  }, [refreshAlerts]);

  const handleTelemetryEvent = useCallback(
    (event: TelemetryRealtimeEvent) => {
      setStats((current) => mergeStatItemsFromTelemetry(current, event));

      if (event.thresholdLevel === 'low' || event.thresholdLevel === 'high') {
        scheduleAlertsRefresh();
      }
    },
    [scheduleAlertsRefresh]
  );

  useTelemetryRealtime(!loading && dashboard !== null, handleTelemetryEvent);

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
        if (!cancelled) setError('Một số dữ liệu bảng điều khiển không khả dụng.');
      } finally {
        if (!cancelled) setLoading(false);
      }

      if (!cancelled) {
        timer = setInterval(() => {
          void getManagedDevices()
            .then((nextDevices) => {
              if (!cancelled) setDevices(nextDevices);
            })
            .catch(() => undefined);
        }, 10000);
      }
    })();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      if (alertRefreshTimerRef.current) {
        clearTimeout(alertRefreshTimerRef.current);
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
      setError('Không thể gửi lệnh thiết bị.');
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
      setError('Không thể cập nhật chế độ tự động.');
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
          <p className="eyebrow">Bảng điều khiển</p>
          <h1>Trang chủ</h1>
          <p>Xin chào {user?.displayName || 'bạn'}, tổng quan nông trại đã sẵn sàng.</p>
        </div>
        {loading ? <span className="spinner" /> : null}
      </header>

      {error ? <StatusMessage>{error}</StatusMessage> : null}

      <section className="stat-grid" aria-label="Thống kê nhanh">
        {visibleStats.map((item) => {
          const empty = isStatValueEmpty(item.value);
          return (
            <article key={item.label} className="stat-card">
              <span className="stat-icon">{sensorInitial(item.label)}</span>
              <span>{translateStatLabel(item.label)}</span>
              {empty ? (
                <div className="stat-empty">
                  <p>Chưa có dữ liệu</p>
                  <small>Đang chờ cảm biến gửi số liệu</small>
                </div>
              ) : (
                <strong>{formatStatDisplayValue(item.label, item.value)}</strong>
              )}
            </article>
          );
        })}
      </section>

      <section className="content-grid">
        <div className="panel">
          <div className="section-heading">
            <h2>Điều khiển nhanh</h2>
            <span>{controlItems.length} thiết bị</span>
          </div>

          <div className="control-list">
            {controlItems.length === 0 ? <p className="empty-text">Không có thiết bị được quản lý.</p> : null}
            {controlItems.map((item) => (
              <article key={item.id} className="control-card">
                <div className="device-summary">
                  <span className="device-icon">{item.type.charAt(0).toUpperCase()}</span>
                  <div>
                    <h3>{item.name}</h3>
                    <p>{translateConnectionStatus(item.state)}</p>
                  </div>
                </div>

                <div className="control-actions">
                  <button
                    type="button"
                    className="mode-chip"
                    disabled={pendingModeId === item.id}
                    onClick={() => void handleMode(item.id)}
                  >
                    {pendingModeId === item.id ? 'Đang cập nhật' : translateDeviceMode(item.mode)}
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
            <h2>Cảnh báo</h2>
            <span>Mới nhất</span>
          </div>

          <div className="alert-list">
            {visibleAlerts.length === 0 ? <p className="empty-text">Chưa có cảnh báo.</p> : null}
            {visibleAlerts.map((item) => {
              const severity = resolveAlertSeverity(item.level);
              const label = item.sensorLabel ?? item.text.split(' ')[0] ?? 'Cảm biến';
              return (
                <article key={item.id} className={`alert-item alert-item--${severity}`}>
                  <div className="alert-item-main">
                    <span className="alert-icon" aria-hidden="true">
                      {alertIcon(severity)}
                    </span>
                    <div className="alert-copy">
                      <span className="alert-sensor">{label}</span>
                      <span className="alert-badge">{formatAlertLevelLabel(item.level)}</span>
                    </div>
                  </div>
                  <time>{item.time}</time>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
