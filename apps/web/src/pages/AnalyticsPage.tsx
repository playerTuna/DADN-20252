import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getDashboard, getTelemetryHistory, type TelemetryPoint } from '../services/api';

type AnalyticsTab = 'temp' | 'air_humidity' | 'soil_humidity' | 'light';

const TAB_LABELS: Record<AnalyticsTab, string> = {
  temp: 'Nhiệt độ',
  air_humidity: 'Độ ẩm không khí',
  soil_humidity: 'Độ ẩm đất',
  light: 'Cường độ ánh sáng',
};

const TAB_ICONS: Record<AnalyticsTab, string> = {
  temp: '°C',
  air_humidity: '%',
  soil_humidity: '🌱',
  light: '☀',
};

const TAB_UNITS: Record<AnalyticsTab, string> = {
  temp: '°C',
  air_humidity: '%',
  soil_humidity: '%',
  light: 'lx',
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

function formatStatWithUnit(tab: AnalyticsTab, value?: number) {
  if (value === undefined) return '—';
  const formatted = formatNumber(value);
  const unit = TAB_UNITS[tab];
  return unit === '°C' ? `${formatted}°C` : `${formatted} ${unit}`;
}

export function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('temp');
  const [series, setSeries] = useState<TelemetryPoint[]>([]);
  const [pageTitle, setPageTitle] = useState('Phân tích môi trường');
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
          !title || title === 'Analytics - Dashboards' ? 'Phân tích môi trường' : title
        );
      } catch (error) {
        console.error('Failed to load analytics dashboard', error);

        if (!cancelled) {
          setErrorMessage('Không thể tải bảng phân tích.');
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
          setErrorMessage('Không thể tải lịch sử telemetry.');
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
          <p className="eyebrow">Phân tích</p>
          <h1>{pageTitle}</h1>
          <p>
            Theo dõi nhiệt độ, độ ẩm, độ ẩm đất và cường độ ánh sáng từ cảm biến Smart Farm.
          </p>
        </div>

        <div className="device-icon">{TAB_ICONS[activeTab]}</div>
      </header>

      {errorMessage ? <div className="status-message error">{errorMessage}</div> : null}

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>{TAB_LABELS[activeTab]}</h2>
            <p>Lịch sử telemetry gần đây</p>
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

        <Link to="/weekly-report" className="weekly-report-banner">
          <span>📋 Xem báo cáo tổng kết tuần này</span>
          <span aria-hidden="true">→</span>
        </Link>

        <div className="analytics-mini-stats" aria-label="Tóm tắt biểu đồ">
          <article className="analytics-mini-stat">
            <span>TB</span>
            <strong>{formatStatWithUnit(activeTab, average)}</strong>
          </article>
          <article className="analytics-mini-stat">
            <span>Thấp nhất</span>
            <strong>{formatStatWithUnit(activeTab, min)}</strong>
          </article>
          <article className="analytics-mini-stat">
            <span>Cao nhất</span>
            <strong>{formatStatWithUnit(activeTab, max)}</strong>
          </article>
        </div>

        <div className="analytics-chart-panel">
          {loading || chartLoading ? (
            <div className="empty-panel">
              <span className="spinner" />
            </div>
          ) : chartRows.length === 0 ? (
            <div className="empty-panel">
              <p className="empty-text">Chưa có lịch sử telemetry.</p>
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
            <p className="empty-text">Chưa có số liệu gần đây.</p>
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
                  <dt>Cảm biến</dt>
                  <dd>{TAB_LABELS[activeTab]}</dd>
                </div>

                <div>
                  <dt>Nhận lúc</dt>
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
