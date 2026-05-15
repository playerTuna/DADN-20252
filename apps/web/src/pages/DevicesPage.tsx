import { useEffect, useMemo, useState } from 'react';
import { StatusMessage } from '../components/StatusMessage';
import { Toggle } from '../components/Toggle';
import {
  getManagedDevices,
  toggleManagedDeviceAutoMode,
  updateManagedDevicePower,
  type ManagedDevice,
} from '../services/api';
import { formatRelativeTime, translateConnectionStatus, translatePowerState } from '../utils/presentation';

export function DevicesPage() {
  const [devices, setDevices] = useState<ManagedDevice[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [pendingPowerId, setPendingPowerId] = useState<string | null>(null);
  const [pendingModeId, setPendingModeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    async function load() {
      try {
        const nextDevices = await getManagedDevices();
        if (!cancelled) {
          setDevices(nextDevices);
          setError(null);
        }
      } catch (err) {
        console.log('Devices load failed', err);
        if (!cancelled) setError('Không thể tải dữ liệu thiết bị.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    timer = setInterval(() => {
      void load();
    }, 8000);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, []);

  const filteredDevices = useMemo(
    () =>
      devices.filter(
        (device) =>
          device.name.toLowerCase().includes(search.toLowerCase()) ||
          device.id.toLowerCase().includes(search.toLowerCase())
      ),
    [devices, search]
  );

  const showSearchToolbar = devices.length > 5;

  const handlePower = async (deviceId: string, next: boolean) => {
    const snapshot = [...devices];
    setPendingPowerId(deviceId);
    setDevices((current) =>
      current.map((device) => (device.id === deviceId ? { ...device, power: next } : device))
    );

    try {
      await updateManagedDevicePower(deviceId, next ? 'ON' : 'OFF');
      setDevices(await getManagedDevices());
      setError(null);
    } catch (err) {
      console.log('Power command failed', err);
      setDevices(snapshot);
      setError('Không thể gửi lệnh nguồn.');
    } finally {
      setPendingPowerId(null);
    }
  };

  const handleAutoMode = async (deviceId: string) => {
    const snapshot = [...devices];
    setPendingModeId(deviceId);
    setDevices((current) =>
      current.map((device) =>
        device.id === deviceId ? { ...device, autoMode: !device.autoMode } : device
      )
    );

    try {
      setDevices(await toggleManagedDeviceAutoMode(deviceId));
      setError(null);
    } catch (err) {
      console.log('Auto mode command failed', err);
      setDevices(snapshot);
      setError('Không thể cập nhật chế độ tự động.');
    } finally {
      setPendingModeId(null);
    }
  };

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Quản lý thiết bị</p>
          <h1>Thiết bị</h1>
          <p>{filteredDevices.length} thiết bị khả dụng</p>
        </div>
        {loading ? <span className="spinner" /> : null}
      </header>

      {error ? <StatusMessage>{error}</StatusMessage> : null}

      {showSearchToolbar ? (
        <div className="toolbar">
          <label className="search-field">
            <span>Tìm kiếm</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm theo tên hoặc ID"
            />
          </label>
        </div>
      ) : null}

      <section className="device-grid">
        {!loading && filteredDevices.length === 0 ? (
          <div className="panel empty-panel">Không tìm thấy thiết bị.</div>
        ) : null}

        {filteredDevices.map((device) => (
          <article key={device.id} className="device-card">
            <div className="device-card-head">
              <div className="device-summary">
                <span className="device-icon">{device.id.charAt(0).toUpperCase()}</span>
                <div>
                  <h2>{device.name}</h2>
                  <p>ID {device.id}</p>
                  <div className="device-status-row">
                    <span
                      className={`status-dot ${device.connectionStatus === 'online' ? 'online' : 'offline'}`}
                      aria-hidden="true"
                    />
                    <span>{translateConnectionStatus(device.connectionStatus)}</span>
                    <span>· {formatRelativeTime(device.lastSeenAt)}</span>
                  </div>
                </div>
              </div>
              <span className={`status-pill ${device.connectionStatus}`}>
                {translateConnectionStatus(device.connectionStatus)}
              </span>
            </div>

            <dl className="device-meta-grid">
              <div>
                <dt>Trạng thái</dt>
                <dd>{translateConnectionStatus(device.connectionStatus)}</dd>
              </div>
              <div>
                <dt>Hoạt động gần nhất</dt>
                <dd>{formatRelativeTime(device.lastSeenAt)}</dd>
              </div>
              <div>
                <dt>Lệnh</dt>
                <dd>{device.lastCommandStatus}</dd>
              </div>
              <div>
                <dt>Lần cuối thấy</dt>
                <dd>{device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString() : '-'}</dd>
              </div>
            </dl>

            <div className="device-controls">
              <div className="device-control-line">
                <div>
                  <strong>Chế độ tự động</strong>
                  <span>
                    {pendingModeId === device.id
                      ? 'Đang cập nhật'
                      : translatePowerState(device.autoMode)}
                  </span>
                </div>
                <Toggle
                  checked={device.autoMode}
                  loading={pendingModeId === device.id}
                  onChange={() => {
                    void handleAutoMode(device.id);
                  }}
                />
              </div>
              <div className="device-control-line">
                <div>
                  <strong>Nguồn</strong>
                  <span>
                    {pendingPowerId === device.id
                      ? 'Đang gửi'
                      : translatePowerState(device.power)}
                  </span>
                </div>
                <Toggle
                  checked={device.power}
                  loading={pendingPowerId === device.id}
                  onChange={(next) => {
                    void handlePower(device.id, next);
                  }}
                />
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
