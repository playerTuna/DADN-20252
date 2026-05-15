import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { StatusMessage } from '../components/StatusMessage';
import { Toggle } from '../components/Toggle';
import { getSettings, updateUserSettings, type EditableSettings } from '../services/api';

const SETTING_LABELS: Record<string, string> = {
  'pump-1': 'Trạng thái mặc định bơm 1',
  'pump-2': 'Trạng thái mặc định bơm 2',
  'led-1': 'Trạng thái mặc định LED 1',
  'led-2': 'Trạng thái mặc định LED 2',
  'led-3': 'Trạng thái mặc định LED 3',
  'schedule-1': 'Trạng thái mặc định chu kỳ sáng',
  'schedule-2': 'Trạng thái mặc định quạt làm mát',
  'schedule-3': 'Trạng thái mặc định đèn đêm',
  'dev-1': 'Trạng thái mặc định bơm A',
  'dev-2': 'Trạng thái mặc định bơm B',
  'dev-3': 'Trạng thái mặc định đèn grow 1',
  'dev-4': 'Trạng thái mặc định đèn grow 2',
};

export function SettingsPage() {
  const [settings, setSettings] = useState<EditableSettings | null>(null);

  const [loading, setLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const nextSettings = await getSettings();
        if (cancelled) return;
        setSettings(nextSettings);
        setError(null);
      } catch (err) {
        console.log('Settings load failed', err);
        if (!cancelled) setError('Không thể tải cài đặt.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggleSetting = (key: string, value: boolean) => {
    setSettings((current) => (current ? { ...current, [key]: value } : current));
    setSettingsSuccess(null);
  };

  const handleSaveSettings = async () => {
    if (!settings) return;
    setSettingsSaving(true);
    setError(null);
    setSettingsSuccess(null);
    try {
      setSettings(await updateUserSettings(settings));
      setSettingsSuccess('Đã cập nhật cài đặt.');
    } catch (err) {
      console.log('Settings save failed', err);
      setError('Không thể lưu cài đặt.');
    } finally {
      setSettingsSaving(false);
    }
  };

  return (
    <div className="page-stack">
      <header className="page-header panel">
        <div>
          <p className="eyebrow">Cấu hình</p>
          <h1>Cài đặt</h1>
          <p>Trạng thái mặc định cho các điều khiển trên bảng điều khiển.</p>
          <p style={{ marginTop: '0.75rem' }}>
            <Link to="/automation" className="chip">
              Tự động hóa &amp; lịch
            </Link>
          </p>
        </div>
        {loading ? <span className="spinner" /> : null}
      </header>

      {error ? <StatusMessage>{error}</StatusMessage> : null}

      <section className="panel settings-panel">
        <div className="section-heading">
          <div>
            <h2>Mặc định điều khiển</h2>
            <p>Bật/tắt trạng thái mặc định của các điều khiển trên trang chủ.</p>
          </div>
        </div>
        {!loading && settings ? (
          <div className="settings-list">
            {Object.entries(settings).map(([key, value]) => (
              <div key={key} className="settings-row">
                <div>
                  <strong>{SETTING_LABELS[key] ?? key}</strong>
                  <span>{key}</span>
                </div>
                <Toggle checked={value} disabled={settingsSaving} onChange={(next) => handleToggleSetting(key, next)} />
              </div>
            ))}
          </div>
        ) : null}
        {settingsSuccess ? <StatusMessage tone="success">{settingsSuccess}</StatusMessage> : null}
        <button type="button" className="secondary-button" disabled={settingsSaving || !settings}
          onClick={() => { void handleSaveSettings(); }}>
          {settingsSaving ? 'Đang lưu...' : 'Lưu cài đặt'}
        </button>
      </section>
    </div>
  );
}
