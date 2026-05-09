import { useEffect, useMemo, useState } from 'react';
import { StatusMessage } from '../components/StatusMessage';
import { Toggle } from '../components/Toggle';
import {
  getManagedDevices,
  toggleManagedDeviceAutoMode,
  updateManagedDevicePower,
  type ManagedDevice,
} from '../services/api';

function formatDateTime(iso?: string | null) {
  if (!iso) return '-';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

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
        if (!cancelled) setError('Unable to load device data.');
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
      setError('Unable to send power command.');
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
      setError('Unable to update automation mode.');
    } finally {
      setPendingModeId(null);
    }
  };

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Device manager</p>
          <h1>Devices</h1>
          <p>{filteredDevices.length} devices available</p>
        </div>
        {loading ? <span className="spinner" /> : null}
      </header>

      {error ? <StatusMessage>{error}</StatusMessage> : null}

      <div className="toolbar">
        <label className="search-field">
          <span>Search</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name or ID"
          />
        </label>
      </div>

      <section className="device-grid">
        {!loading && filteredDevices.length === 0 ? (
          <div className="panel empty-panel">No devices found.</div>
        ) : null}

        {filteredDevices.map((device) => (
          <article key={device.id} className="device-card">
            <div className="device-card-head">
              <div className="device-summary">
                <span className="device-icon">{device.id.charAt(0).toUpperCase()}</span>
                <div>
                  <h2>{device.name}</h2>
                  <p>ID {device.id}</p>
                </div>
              </div>
              <span className={`status-pill ${device.connectionStatus}`}>
                {device.connectionStatus}
              </span>
            </div>

            <dl className="device-meta-grid">
              <div>
                <dt>Command</dt>
                <dd>{device.lastCommandStatus}</dd>
              </div>
              <div>
                <dt>Last seen</dt>
                <dd>{formatDateTime(device.lastSeenAt)}</dd>
              </div>
            </dl>

            <div className="device-controls">
              <div className="device-control-line">
                <div>
                  <strong>Auto mode</strong>
                  <span>{pendingModeId === device.id ? 'Updating' : device.autoMode ? 'On' : 'Off'}</span>
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
                  <strong>Power</strong>
                  <span>{pendingPowerId === device.id ? 'Sending' : device.power ? 'On' : 'Off'}</span>
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
