import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getWeeklyReport,
  type WeeklyReportPayload,
  type WeeklyReportSensorKey,
} from '../services/api';

const SENSOR_ORDER: WeeklyReportSensorKey[] = [
  'temp',
  'air_humidity',
  'soil_humidity',
  'light',
];

const SENSOR_LABELS: Record<WeeklyReportSensorKey, string> = {
  temp: 'Nhiệt độ',
  air_humidity: 'Độ ẩm không khí',
  soil_humidity: 'Độ ẩm đất',
  light: 'Ánh sáng',
};

const SENSOR_UNITS: Record<WeeklyReportSensorKey, string> = {
  temp: '°C',
  air_humidity: '%',
  soil_humidity: '%',
  light: 'lux',
};

function startOfUtcIsoWeek(reference = new Date()): Date {
  const d = new Date(
    Date.UTC(
      reference.getUTCFullYear(),
      reference.getUTCMonth(),
      reference.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );
  const day = d.getUTCDay();
  const daysFromMonday = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - daysFromMonday);
  return d;
}

function addUtcDaysIso(isoStart: string, days: number): string {
  const d = new Date(isoStart);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

function formatDayMonth(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
}

function formatNum(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '-';
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** Heuristic: temp up / soil & air humidity down / light down = "bad" for farm summary UI */
function deltaPresentation(
  type: WeeklyReportSensorKey,
  delta: number | null,
): { label: string; className: string } {
  if (delta == null || delta === 0) {
    return { label: '—', className: 'weekly-delta neutral' };
  }
  const up = delta > 0;
  const bad =
    type === 'temp'
      ? up
      : type === 'soil_humidity' || type === 'air_humidity'
        ? !up
        : type === 'light'
          ? !up
          : false;
  const arrow = up ? '↑' : '↓';
  const cls = bad ? 'weekly-delta bad' : 'weekly-delta good';
  return { label: `${arrow} ${Math.abs(delta).toFixed(1)}`, className: cls };
}

export function WeeklyReportPage() {
  const [report, setReport] = useState<WeeklyReportPayload | null>(null);
  const [weekFrom, setWeekFrom] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const thisWeekStartIso = useMemo(() => startOfUtcIsoWeek().toISOString(), []);

  const load = useCallback(async (from?: string) => {
    setLoading(true);
    setError('');
    try {
      const data = await getWeeklyReport(from);
      setReport(data);
      setWeekFrom(data.period.from);
    } catch (e) {
      console.error(e);
      setError('Không tải được báo cáo tuần.');
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(undefined);
  }, [load]);

  const canGoNext = weekFrom != null && new Date(weekFrom).getTime() < new Date(thisWeekStartIso).getTime();

  const titleRange =
    report != null ? `${formatDayMonth(report.period.from)} – ${formatDayMonth(report.period.to)}` : '';

  return (
    <div className="page-stack">
      <header className="page-header panel">
        <div>
          <p className="eyebrow">Phân tích</p>
          <h1>Báo cáo tuần [{titleRange}]</h1>
          <p>Tổng quan 7 ngày: cảm biến, lệnh thiết bị của bạn, và cảnh báo hệ thống.</p>
        </div>
        <div className="week-report-actions">
          <button
            type="button"
            className="chip"
            disabled={loading || !weekFrom}
            onClick={() => weekFrom && void load(addUtcDaysIso(weekFrom, -7))}
          >
            &lt; Tuần trước
          </button>
          <button
            type="button"
            className="chip"
            disabled={loading || !canGoNext}
            onClick={() => weekFrom && void load(addUtcDaysIso(weekFrom, 7))}
          >
            Tuần sau &gt;
          </button>
          <button type="button" className="chip active" disabled={loading} onClick={() => void load(undefined)}>
            Tuần này
          </button>
          <Link to="/analytics" className="chip">
            ← Phân tích
          </Link>
        </div>
      </header>

      {error ? <div className="status-message error">{error}</div> : null}

      {loading && !report ? (
        <div className="panel empty-panel">
          <span className="spinner" />
        </div>
      ) : null}

      {report ? (
        <>
          <section className="stat-grid">
            {SENSOR_ORDER.map((key) => {
              const s = report.sensors[key];
              const delta = deltaPresentation(key, s.deltaAvg);
              return (
                <article key={key} className="stat-card weekly-sensor-card">
                  <span className="stat-icon">{SENSOR_UNITS[key]}</span>
                  <span>{SENSOR_LABELS[key]}</span>
                  <strong>{formatNum(s.avg)}</strong>
                  <span className={delta.className}>{delta.label} vs tuần trước</span>
                  <p className="weekly-minmax">
                    Thấp nhất {formatNum(s.min)} · Cao nhất {formatNum(s.max)}
                  </p>
                </article>
              );
            })}
          </section>

          <section className="panel">
            <h2>Thiết bị (lệnh của bạn)</h2>
            <p className="muted">Số lần có lệnh ghi trong tuần — pump / fan / speaker.</p>
            <div className="week-device-row">
              <span>Máy bơm</span>
              <strong>{report.deviceActivity.pump}</strong>
              <span>Quạt</span>
              <strong>{report.deviceActivity.fan}</strong>
              <span>Loa</span>
              <strong>{report.deviceActivity.speaker}</strong>
            </div>
          </section>

          <section className="panel">
            <h2>Cảnh báo (toàn hệ thống)</h2>
            <div className="chip-row">
              {SENSOR_ORDER.map((key) => (
                <span key={key} className="chip">
                  {SENSOR_LABELS[key]}: {report.alerts[key]}
                </span>
              ))}
            </div>
          </section>

          <p className="weekly-footnote">
            Dữ liệu cảm biến và cảnh báo là chung toàn hệ thống; lịch sử lệnh thiết bị là theo tài khoản của bạn.
          </p>
        </>
      ) : null}
    </div>
  );
}
