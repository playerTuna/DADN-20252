import { useEffect, useMemo, useState } from 'react';
import { getDashboard, getTelemetryHistory, type TelemetryPoint } from '../services/api';

type AnalyticsTab = 'temp' | 'air_humidity' | 'soil_humidity' | 'light';

const TAB_LABELS: Record<AnalyticsTab, string> = {
  temp: 'Temperature',
  air_humidity: 'Air Humidity',
  soil_humidity: 'Soil Humidity',
  light: 'Light Intensity',
};

const TAB_ICONS: Record<AnalyticsTab, string> = {
  temp: '°C',
  air_humidity: '%',
  soil_humidity: '🌱',
  light: '☀',
};

function formatTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('temp');
  const [series, setSeries] = useState<TelemetryPoint[]>([]);
  const [pageTitle, setPageTitle] = useState('Environment Analytics');
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      try {
        const dashboard = await getDashboard();

        if (cancelled) {
          return;
        }

        const title = dashboard.analytics?.title;

        setPageTitle(
          !title || title === 'Analytics - Dashboards' ? 'Environment Analytics' : title
        );
      } catch (error) {
        console.error('Failed to load analytics dashboard', error);

        if (!cancelled) {
          setErrorMessage('Unable to load analytics dashboard.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadTelemetry() {
      setChartLoading(true);

      try {
        const data = await getTelemetryHistory(activeTab);

        if (!cancelled) {
          setSeries(data);
          setErrorMessage('');
        }
      } catch (error) {
        console.error('Failed to load telemetry history', error);

        if (!cancelled) {
          setErrorMessage('Unable to load telemetry history.');
          setSeries([]);
        }
      } finally {
        if (!cancelled) {
          setChartLoading(false);
        }
      }
    }

    void loadTelemetry();

    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  const values = useMemo(() => series.map((item) => item.numericValue), [series]);

  const latest = values.length > 0 ? values[0] : undefined;
  const min = values.length > 0 ? Math.min(...values) : undefined;
  const max = values.length > 0 ? Math.max(...values) : undefined;
  const average =
    values.length > 0
      ? values.reduce((total, value) => total + value, 0) / values.length
      : undefined;

  const recentRows = useMemo(() => series.slice(0, 6), [series]);

  const chartRows = useMemo(() => series.slice(0, 12).reverse(), [series]);

  const chartMax = useMemo(() => {
    if (chartRows.length === 0) {
      return 100;
    }

    const localMax = Math.max(...chartRows.map((item) => item.numericValue));

    return Math.max(10, Math.ceil(localMax / 10) * 10);
  }, [chartRows]);

  const chartPoints = useMemo(() => {
    if (chartRows.length === 0) {
      return '';
    }

    return chartRows
      .map((item, index) => {
        const x = chartRows.length === 1 ? 50 : (index / (chartRows.length - 1)) * 100;

        const y = 100 - (item.numericValue / chartMax) * 100;

        return `${x},${y}`;
      })
      .join(' ');
  }, [chartRows, chartMax]);

  return (
    <div className="page-stack">
      <header className="page-header panel">
        <div>
          <p className="eyebrow">Analytics</p>
          <h1>{pageTitle}</h1>
          <p>
            Monitor temperature, humidity, soil moisture and light intensity from your smart home
            sensors.
          </p>
        </div>

        <div className="device-icon">{TAB_ICONS[activeTab]}</div>
      </header>

      {errorMessage ? <div className="status-message error">{errorMessage}</div> : null}

      <section className="stat-grid">
        <article className="stat-card">
          <span className="stat-icon">{TAB_ICONS[activeTab]}</span>
          <span>Latest</span>
          <strong>{latest === undefined ? '-' : formatNumber(latest)}</strong>
        </article>

        <article className="stat-card">
          <span className="stat-icon">Min</span>
          <span>Minimum</span>
          <strong>{min === undefined ? '-' : formatNumber(min)}</strong>
        </article>

        <article className="stat-card">
          <span className="stat-icon">Max</span>
          <span>Maximum</span>
          <strong>{max === undefined ? '-' : formatNumber(max)}</strong>
        </article>

        <article className="stat-card">
          <span className="stat-icon">Avg</span>
          <span>Average</span>
          <strong>{average === undefined ? '-' : formatNumber(Number(average))}</strong>
        </article>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>{TAB_LABELS[activeTab]}</h2>
            <p>Recent telemetry history</p>
          </div>

          {chartLoading ? <span className="mini-spinner" /> : null}
        </div>

        <div className="chip-row">
          {(Object.keys(TAB_LABELS) as AnalyticsTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              className={`chip ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        <div className="analytics-chart-panel">
          {loading || chartLoading ? (
            <div className="empty-panel">
              <span className="spinner" />
            </div>
          ) : chartRows.length === 0 ? (
            <div className="empty-panel">
              <p className="empty-text">No telemetry history available.</p>
            </div>
          ) : (
            <>
              <div className="analytics-chart">
                <svg
                  className="analytics-chart-svg"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                >
                  <polyline
                    points={chartPoints}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                  />

                  {chartRows.map((item, index) => {
                    const x = chartRows.length === 1 ? 50 : (index / (chartRows.length - 1)) * 100;

                    const y = 100 - (item.numericValue / chartMax) * 100;

                    return <circle key={item.id} cx={x} cy={y} r="2" fill="currentColor" />;
                  })}
                </svg>
              </div>

              <div className="analytics-chart-labels">
                {chartRows.map((item) => (
                  <span key={item.id}>{formatTime(item.receivedAt)}</span>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      <section className="device-grid">
        {recentRows.length === 0 ? (
          <div className="panel empty-panel">
            <p className="empty-text">No recent readings.</p>
          </div>
        ) : (
          recentRows.map((item) => (
            <article key={item.id} className="device-card">
              <div className="device-card-head">
                <div className="device-summary">
                  <span className="device-icon">{TAB_ICONS[activeTab]}</span>

                  <div>
                    <h2>{formatNumber(item.numericValue)}</h2>
                    <p>{TAB_LABELS[activeTab]}</p>
                  </div>
                </div>

                <span className="status-pill online">{formatTime(item.receivedAt)}</span>
              </div>

              <dl className="device-meta-grid">
                <div>
                  <dt>Sensor</dt>
                  <dd>{TAB_LABELS[activeTab]}</dd>
                </div>

                <div>
                  <dt>Received</dt>
                  <dd>{formatTime(item.receivedAt)}</dd>
                </div>
              </dl>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
