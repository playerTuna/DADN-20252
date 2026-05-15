import { useEffect, useMemo, useState } from 'react';
import { StatusMessage } from '../components/StatusMessage';
import { getDashboard, getTelemetryHistory, type TelemetryPoint } from '../services/api';

type AnalyticsTab = 'temp' | 'air_humidity' | 'soil_humidity' | 'light';

type ChartPoint = {
  id: string;
  x: number;
  y: number;
  value: number;
  label: string;
};

const TAB_LABELS: Record<AnalyticsTab, string> = {
  temp: 'Temperature',
  air_humidity: 'Air Humidity',
  soil_humidity: 'Soil Humidity',
  light: 'Light Intensity',
};

const TAB_META: Record<
  AnalyticsTab,
  {
    label: string;
    unit: string;
    description: string;
  }
> = {
  temp: {
    label: 'Temperature',
    unit: '°C',
    description: 'Track the temperature trend inside your farming environment.',
  },
  air_humidity: {
    label: 'Air Humidity',
    unit: '%',
    description: 'Monitor air moisture level around your plants.',
  },
  soil_humidity: {
    label: 'Soil Humidity',
    unit: '%',
    description: 'Check soil moisture to understand watering conditions.',
  },
  light: {
    label: 'Light Intensity',
    unit: '',
    description: 'Observe the light level received by your farm area.',
  },
};

function displayAnalyticsTitle(title?: string) {
  if (!title || title === 'Analytics - Dashboards') {
    return 'Environment Analytics';
  }

  return title;
}

function formatTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '-';

  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function makeSmoothPath(points: ChartPoint[]) {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  return points.reduce((path, point, index) => {
    if (index === 0) {
      return `M ${point.x} ${point.y}`;
    }

    const previous = points[index - 1];
    const controlX = (previous.x + point.x) / 2;

    return `${path} C ${controlX} ${previous.y}, ${controlX} ${point.y}, ${point.x} ${point.y}`;
  }, '');
}

function AnalyticsIcon({ type }: { type: AnalyticsTab }) {
  if (type === 'temp') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M14 14.76V5a4 4 0 1 0-8 0v9.76A5 5 0 1 0 14 14.76z" />
        <path d="M10 9v7" />
      </svg>
    );
  }

  if (type === 'air_humidity') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2.5s6 6.2 6 11.2a6 6 0 0 1-12 0c0-5 6-11.2 6-11.2z" />
        <path d="M9.5 14.5a2.5 2.5 0 0 0 5 0" />
      </svg>
    );
  }

  if (type === 'soil_humidity') {
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

function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <path d="M7 15l3-3 3 2 5-7" />
      <path d="M18 7h-4" />
      <path d="M18 7v4" />
    </svg>
  );
}

export function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('temp');
  const [series, setSeries] = useState<TelemetryPoint[]>([]);
  const [pageTitle, setPageTitle] = useState('Environment Analytics');
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const dashboard = await getDashboard();

        if (cancelled) return;

        setPageTitle(displayAnalyticsTitle(dashboard.analytics?.title));
        setErrorMessage(null);
      } catch (error) {
        console.log('Failed to load analytics dashboard', error);

        if (!cancelled) {
          setErrorMessage('Unable to load analytics dashboard.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setChartLoading(true);

      try {
        const data = await getTelemetryHistory(activeTab);

        if (!cancelled) {
          setSeries(data);
          setErrorMessage(null);
        }
      } catch (error) {
        console.log('Failed to load telemetry history', error);

        if (!cancelled) {
          setSeries([]);
          setErrorMessage('Unable to load telemetry history.');
        }
      } finally {
        if (!cancelled) {
          setChartLoading(false);
        }
      }
    })();

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

  const visibleRows = useMemo(() => series.slice(0, 8), [series]);
  const chartRows = useMemo(() => series.slice(0, 12).reverse(), [series]);

  const chartBounds = useMemo(() => {
    if (chartRows.length === 0) {
      return { min: 0, max: activeTab === 'light' ? 100 : 36 };
    }

    const chartValues = chartRows.map((item) => item.numericValue);
    const rawMin = Math.min(...chartValues);
    const rawMax = Math.max(...chartValues);

    const baseStep = activeTab === 'temp' ? 5 : activeTab === 'light' ? 100 : 10;

    if (rawMin === rawMax) {
      const padding = Math.max(baseStep, Math.abs(rawMax) * 0.08);

      return {
        min: Math.max(0, Math.floor((rawMin - padding) / baseStep) * baseStep),
        max: Math.ceil((rawMax + padding) / baseStep) * baseStep,
      };
    }

    const padding = Math.max((rawMax - rawMin) * 0.22, baseStep);
    const minValue = Math.max(0, Math.floor((rawMin - padding) / baseStep) * baseStep);
    const maxValue = Math.ceil((rawMax + padding) / baseStep) * baseStep;

    return {
      min: minValue,
      max: maxValue > minValue ? maxValue : minValue + baseStep,
    };
  }, [activeTab, chartRows]);

  const yTicks = useMemo(() => {
    const range = chartBounds.max - chartBounds.min || 1;

    return Array.from({ length: 5 }, (_, index) => chartBounds.max - (range / 4) * index);
  }, [chartBounds]);

  const chartPoints = useMemo<ChartPoint[]>(() => {
    if (chartRows.length === 0) return [];

    const range = chartBounds.max - chartBounds.min || 1;
    const leftInset = 7;
    const rightInset = 4;
    const topInset = 8;
    const bottomInset = 10;
    const drawableWidth = 100 - leftInset - rightInset;
    const drawableHeight = 100 - topInset - bottomInset;

    return chartRows.map((item, index) => {
      const normalized = (item.numericValue - chartBounds.min) / range;
      const x =
        chartRows.length === 1 ? 50 : leftInset + (index / (chartRows.length - 1)) * drawableWidth;
      const y = topInset + (1 - normalized) * drawableHeight;

      return {
        id: item.id,
        x,
        y,
        value: item.numericValue,
        label: formatTime(item.receivedAt),
      };
    });
  }, [chartBounds, chartRows]);

  const chartPath = useMemo(() => makeSmoothPath(chartPoints), [chartPoints]);

  const chartAreaPath = useMemo(() => {
    if (!chartPath || chartPoints.length < 2) return '';

    const first = chartPoints[0];
    const last = chartPoints[chartPoints.length - 1];
    const baseline = 90;

    return `${chartPath} L ${last.x} ${baseline} L ${first.x} ${baseline} Z`;
  }, [chartPath, chartPoints]);

  const summaryItems = [
    {
      label: 'Latest',
      value: latest === undefined ? '-' : formatNumber(latest),
    },
    {
      label: 'Min',
      value: min === undefined ? '-' : formatNumber(min),
    },
    {
      label: 'Max',
      value: max === undefined ? '-' : formatNumber(max),
    },
    {
      label: 'Average',
      value: average === undefined ? '-' : formatNumber(average),
    },
  ];

  const activeMeta = TAB_META[activeTab];

  return (
    <div className="page-stack analytics-page-web">
      <header className="analytics-hero-card">
        <div className="analytics-hero-icon">
          <ChartIcon />
        </div>

        <div>
          <p className="eyebrow">Analytics</p>
          <h1>{pageTitle}</h1>
          <p>Monitor temperature, humidity, soil moisture and light intensity from your farm.</p>
        </div>

        {loading ? <span className="spinner" /> : null}
      </header>

      {errorMessage ? <StatusMessage>{errorMessage}</StatusMessage> : null}

      <section className="analytics-summary-grid">
        {summaryItems.map((item) => (
          <article key={item.label} className="analytics-summary-card">
            <div className="analytics-summary-top">
              <span className="analytics-summary-icon">
                <AnalyticsIcon type={activeTab} />
              </span>
              <span>{item.label}</span>
            </div>

            <strong>
              {item.value}
              {item.value !== '-' && activeMeta.unit ? <small>{activeMeta.unit}</small> : null}
            </strong>
          </article>
        ))}
      </section>

      <section className="analytics-tab-card">
        <div>
          <h2>Sensor source</h2>
          <p>Select a metric to inspect telemetry history.</p>
        </div>

        <div className="analytics-tab-list">
          {(Object.keys(TAB_LABELS) as AnalyticsTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              className={`analytics-tab-button ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              <span>
                <AnalyticsIcon type={tab} />
              </span>
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>
      </section>

      <section className="analytics-main-grid">
        <article className="analytics-chart-card">
          <div className="analytics-section-heading">
            <div>
              <h2>{activeMeta.label}</h2>
              <p>{activeMeta.description}</p>
            </div>

            {chartLoading ? <span className="mini-spinner" /> : null}
          </div>

          {loading || chartLoading ? (
            <div className="analytics-empty-panel">
              <span className="spinner" />
            </div>
          ) : chartRows.length === 0 ? (
            <div className="analytics-empty-panel">
              <p>No telemetry history available.</p>
            </div>
          ) : (
            <>
              <div className="analytics-chart-layout">
                <div className="analytics-y-axis">
                  {yTicks.map((tick) => (
                    <span key={tick}>{formatNumber(tick)}</span>
                  ))}
                </div>

                <div className="analytics-chart-area">
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <defs>
                      <linearGradient id="analyticsAreaGradient" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="rgba(34, 197, 94, 0.32)" />
                        <stop offset="100%" stopColor="rgba(34, 197, 94, 0)" />
                      </linearGradient>
                    </defs>

                    {chartAreaPath ? (
                      <path d={chartAreaPath} fill="url(#analyticsAreaGradient)" />
                    ) : null}

                    {chartPath ? (
                      <path
                        d={chartPath}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        vectorEffect="non-scaling-stroke"
                      />
                    ) : null}

                    {/* {chartPoints.map((point) => (
                      <circle
                        key={point.id}
                        cx={point.x}
                        cy={point.y}
                        r="1.8"
                        fill="currentColor"
                      />
                    ))} */}
                  </svg>
                </div>
              </div>

              <div className="analytics-x-labels">
                {chartRows.map((item) => (
                  <span key={item.id}>{formatTime(item.receivedAt)}</span>
                ))}
              </div>
            </>
          )}
        </article>

        <article className="analytics-log-card">
          <div className="analytics-section-heading">
            <div>
              <h2>Reading log</h2>
              <p>Latest telemetry records.</p>
            </div>

            <span className="analytics-log-count">{visibleRows.length} rows</span>
          </div>

          <div className="analytics-reading-list">
            {visibleRows.length === 0 ? (
              <p className="analytics-empty-text">No readings yet.</p>
            ) : null}

            {visibleRows.map((item) => (
              <div key={item.id} className="analytics-reading-row">
                <div>
                  <strong>
                    {formatNumber(item.numericValue)}
                    {activeMeta.unit ? <small>{activeMeta.unit}</small> : null}
                  </strong>
                  <span>{activeMeta.label}</span>
                </div>

                <time>{formatDateTime(item.receivedAt)}</time>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
