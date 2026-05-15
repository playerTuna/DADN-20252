import { useEffect, useMemo, useState } from 'react';
import { StatusMessage } from '../components/StatusMessage';
import { Toggle } from '../components/Toggle';
import {
  getManagedDevices,
  toggleManagedDeviceAutoMode,
  updateManagedDevicePower,
  type ManagedDevice,
} from '../services/api';

const rowsPerPage = 8;

function formatDateTime(iso?: string | null) {
  if (!iso) return '-';

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) return '-';

  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

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

function getDeviceType(id: string) {
  if (id === 'pump') return 'pump';
  if (id === 'fan') return 'fan';
  if (id === 'speaker') return 'speaker';
  if (id === 'rgb') return 'light';
  return 'light';
}

function DeviceIcon({ id }: { id: string }) {
  const type = getDeviceType(id);

  if (type === 'pump') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2.5s5.5 5.8 5.5 10.4a5.5 5.5 0 0 1-11 0C6.5 8.3 12 2.5 12 2.5z" />
        <path d="M9.5 14.5a2.5 2.5 0 0 0 5 0" />
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

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function DevicesIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="4" width="7" height="7" rx="2" />
      <rect x="13" y="4" width="7" height="7" rx="2" />
      <rect x="4" y="13" width="7" height="7" rx="2" />
      <rect x="13" y="13" width="7" height="7" rx="2" />
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
    <div className="devices-pagination">
      {items.map((entry, index) =>
        entry === 'ellipsis' ? (
          <span key={`ellipsis-${index}`} className="devices-page-ellipsis">
            ...
          </span>
        ) : (
          <button
            key={entry}
            type="button"
            className={`devices-page-button ${entry === current ? 'active' : ''}`}
            onClick={() => onChange(entry)}
          >
            {entry}
          </button>
        )
      )}
    </div>
  );
}

export function DevicesPage() {
  const [devices, setDevices] = useState<ManagedDevice[]>([]);
  const [search, setSearch] = useState('');
  const [devicePage, setDevicePage] = useState(1);

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

        if (!cancelled) {
          setError('Unable to load device data.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    timer = setInterval(() => {
      void load();
    }, 8000);

    return () => {
      cancelled = true;

      if (timer) {
        clearInterval(timer);
      }
    };
  }, []);

  const filteredDevices = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) return devices;

    return devices.filter(
      (device) =>
        device.name.toLowerCase().includes(keyword) || device.id.toLowerCase().includes(keyword)
    );
  }, [devices, search]);

  useEffect(() => {
    setDevicePage(1);
  }, [search]);

  const totalPages = Math.max(1, Math.ceil(filteredDevices.length / rowsPerPage));
  const safePage = Math.min(devicePage, totalPages);
  const pageItems = paginationItems(safePage, totalPages);

  const pagedDevices = filteredDevices.slice(
    (safePage - 1) * rowsPerPage,
    (safePage - 1) * rowsPerPage + rowsPerPage
  );

  const onlineCount = devices.filter((device) => device.connectionStatus === 'online').length;
  const autoCount = devices.filter((device) => device.autoMode).length;
  const powerCount = devices.filter((device) => device.power).length;

  const handlePower = async (deviceId: string, next: boolean) => {
    const snapshot = [...devices];

    setPendingPowerId(deviceId);

    setDevices((current) =>
      current.map((device) => (device.id === deviceId ? { ...device, power: next } : device))
    );

    try {
      await updateManagedDevicePower(deviceId, next ? 'ON' : 'OFF');

      const refreshed = await getManagedDevices();
      setDevices(refreshed);
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
      const updated = await toggleManagedDeviceAutoMode(deviceId);

      setDevices(updated);
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
    <div className="page-stack devices-page-web">
      <header className="devices-hero-card">
        <div className="devices-hero-icon">
          <DevicesIcon />
        </div>

        <div>
          <p className="eyebrow">Device manager</p>
          <h1>Devices</h1>
          <p>Control and monitor all connected smart farming devices.</p>
        </div>

        {loading ? <span className="spinner" /> : null}
      </header>

      {error ? <StatusMessage>{error}</StatusMessage> : null}

      <section className="devices-summary-grid">
        <article className="devices-summary-card">
          <span>Total devices</span>
          <strong>{devices.length}</strong>
        </article>

        <article className="devices-summary-card">
          <span>Online</span>
          <strong>{onlineCount}</strong>
        </article>

        <article className="devices-summary-card">
          <span>Power on</span>
          <strong>{powerCount}</strong>
        </article>

        <article className="devices-summary-card">
          <span>Auto mode</span>
          <strong>{autoCount}</strong>
        </article>
      </section>

      <section className="devices-toolbar-card">
        <label className="devices-search-field">
          <span>Search</span>

          <div className="devices-search-input">
            <SearchIcon />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name or ID"
            />
          </div>
        </label>

        <div className="devices-toolbar-info">
          <strong>{filteredDevices.length}</strong>
          <span>{filteredDevices.length === 1 ? 'device found' : 'devices found'}</span>
        </div>
      </section>

      <section className="devices-grid">
        {!loading && filteredDevices.length === 0 ? (
          <div className="devices-empty-panel">No devices found.</div>
        ) : null}

        {pagedDevices.map((device) => {
          const deviceType = getDeviceType(device.id);

          return (
            <article key={device.id} className="devices-device-card">
              <div className="devices-device-head">
                <div className="devices-device-summary">
                  <span className={`devices-device-icon devices-device-icon-${deviceType}`}>
                    <DeviceIcon id={device.id} />
                  </span>

                  <div>
                    <h2>{device.name}</h2>
                    <p>ID {device.id}</p>
                  </div>
                </div>

                {device.connectionStatus === 'online' || device.connectionStatus === 'offline' ? (
                  <span className={`devices-status-pill ${device.connectionStatus}`}>
                    <span className="devices-status-dot" />
                    {device.connectionStatus}
                  </span>
                ) : null}
              </div>

              <dl className="devices-meta-grid">
                <div>
                  <dt>Command</dt>
                  <dd>{device.lastCommandStatus}</dd>
                </div>

                <div>
                  <dt>Last seen</dt>
                  <dd>{formatDateTime(device.lastSeenAt)}</dd>
                </div>
              </dl>

              <div className="devices-control-list">
                <div className="devices-control-line">
                  <div>
                    <strong>Auto mode</strong>
                    <span>
                      {pendingModeId === device.id ? 'Updating...' : device.autoMode ? 'On' : 'Off'}
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

                <div className="devices-control-line">
                  <div>
                    <strong>Power</strong>
                    <span>
                      {pendingPowerId === device.id ? 'Sending...' : device.power ? 'On' : 'Off'}
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
          );
        })}
      </section>

      {totalPages > 1 ? (
        <Pagination items={pageItems} current={safePage} onChange={setDevicePage} />
      ) : null}
    </div>
  );
}
