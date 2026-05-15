import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { StatusMessage } from '../components/StatusMessage';
import { Toggle } from '../components/Toggle';
import {
  getAutomationRules,
  updateAutomationRule,
  type AutomationCondition,
  type AutomationRule,
  type AutomationSchedule,
  type AutomationSensorKey,
} from '../services/api';

type RuleForm = {
  deviceId: string;
  target: 'pump' | 'fan' | 'rgb';
  enabled: boolean;
  turnOnConditions: AutomationCondition[];
  turnOffConditions: AutomationCondition[];
  schedules: AutomationSchedule[];
  onPayload: string;
  offPayload: string;
};

const DEFAULT_RULES: Record<'pump' | 'fan' | 'rgb', RuleForm> = {
  pump: {
    deviceId: 'pump',
    target: 'pump',
    enabled: true,
    turnOnConditions: [{ sensorKey: 'soilMoisture', operator: '<', value: 40 }],
    turnOffConditions: [{ sensorKey: 'soilMoisture', operator: '>', value: 70 }],
    schedules: [],
    onPayload: 'ON',
    offPayload: 'OFF',
  },
  fan: {
    deviceId: 'fan',
    target: 'fan',
    enabled: true,
    turnOnConditions: [{ sensorKey: 'temperature', operator: '>', value: 32 }],
    turnOffConditions: [{ sensorKey: 'temperature', operator: '<', value: 28 }],
    schedules: [],
    onPayload: 'ON',
    offPayload: 'OFF',
  },
  rgb: {
    deviceId: 'rgb',
    target: 'rgb',
    enabled: false,
    turnOnConditions: [{ sensorKey: 'light', operator: '<', value: 35 }],
    turnOffConditions: [{ sensorKey: 'light', operator: '>', value: 65 }],
    schedules: [],
    onPayload: '255,255,255',
    offPayload: '0,0,0',
  },
};

const SENSOR_OPTIONS: { value: AutomationSensorKey; label: string }[] = [
  { value: 'soilMoisture', label: 'Độ ẩm đất' },
  { value: 'temperature', label: 'Nhiệt độ' },
  { value: 'light', label: 'Ánh sáng' },
];

const OPERATOR_OPTIONS: { value: '<' | '>'; label: string }[] = [
  { value: '<', label: 'Khi xuống dưới' },
  { value: '>', label: 'Khi vượt quá' },
];

function normalizeRule(incoming: AutomationRule | undefined, fallback: RuleForm): RuleForm {
  if (!incoming) return fallback;
  return {
    deviceId: incoming.deviceId,
    target: incoming.target,
    enabled: incoming.enabled,
    turnOnConditions: incoming.turnOnConditions || [],
    turnOffConditions: incoming.turnOffConditions || [],
    schedules: incoming.schedules || [],
    onPayload: incoming.onPayload ?? fallback.onPayload,
    offPayload: incoming.offPayload ?? fallback.offPayload,
  };
}

type RuleEditorProps = {
  title: string;
  description: string;
  rule: RuleForm;
  saving: boolean;
  success: string | null;
  error: string | null;
  onUpdate: (updater: (current: RuleForm) => RuleForm) => void;
  onSave: () => void;
};

function RuleEditor({ title, description, rule, saving, success, error, onUpdate, onSave }: RuleEditorProps) {
  const deviceLabel =
    rule.target === 'pump' ? 'máy bơm' : rule.target === 'fan' ? 'quạt' : 'đèn grow';
  const startVerb =
    rule.target === 'pump' ? 'Bắt đầu tưới' : rule.target === 'fan' ? 'Bật quạt' : 'Bật đèn';
  const stopVerb =
    rule.target === 'pump' ? 'Dừng tưới' : rule.target === 'fan' ? 'Tắt quạt' : 'Tắt đèn';

  const sensorUnit = (key: AutomationSensorKey) =>
    key === 'temperature' ? '°C' : key === 'soilMoisture' ? '%' : '';

  const addOnCondition = () =>
    onUpdate((curr) => ({
      ...curr,
      turnOnConditions: [...curr.turnOnConditions, { sensorKey: 'soilMoisture', operator: '<', value: 40 }],
    }));

  const addOffCondition = () =>
    onUpdate((curr) => ({
      ...curr,
      turnOffConditions: [...curr.turnOffConditions, { sensorKey: 'soilMoisture', operator: '>', value: 70 }],
    }));

  const updateOnCond = (i: number, patch: Partial<AutomationCondition>) =>
    onUpdate((curr) => {
      const next = [...curr.turnOnConditions];
      next[i] = { ...next[i], ...patch };
      return { ...curr, turnOnConditions: next };
    });

  const updateOffCond = (i: number, patch: Partial<AutomationCondition>) =>
    onUpdate((curr) => {
      const next = [...curr.turnOffConditions];
      next[i] = { ...next[i], ...patch };
      return { ...curr, turnOffConditions: next };
    });

  const removeOnCond = (i: number) =>
    onUpdate((curr) => ({ ...curr, turnOnConditions: curr.turnOnConditions.filter((_, j) => j !== i) }));

  const removeOffCond = (i: number) =>
    onUpdate((curr) => ({ ...curr, turnOffConditions: curr.turnOffConditions.filter((_, j) => j !== i) }));

  const addSchedule = () =>
    onUpdate((curr) => ({
      ...curr,
      schedules: [...curr.schedules, { time: '08:00', action: 'ON', enabled: true }],
    }));

  const updateSchedule = (i: number, patch: Partial<AutomationSchedule>) =>
    onUpdate((curr) => {
      const next = [...curr.schedules];
      next[i] = { ...next[i], ...patch };
      return { ...curr, schedules: next };
    });

  const removeSchedule = (i: number) =>
    onUpdate((curr) => ({ ...curr, schedules: curr.schedules.filter((_, j) => j !== i) }));

  const pillStyle: CSSProperties = {
    border: '1.5px solid var(--border-color)',
    borderRadius: '999px',
    padding: '4px 14px',
    background: 'var(--bg-panel)',
    color: 'var(--text-main)',
    cursor: 'pointer',
    fontSize: '0.9rem',
  };

  const numInputStyle: CSSProperties = {
    width: '72px',
    borderRadius: '999px',
    border: '1.5px solid var(--border-color)',
    padding: '4px 10px',
    background: 'var(--bg-panel)',
    color: 'var(--text-main)',
    textAlign: 'center',
  };

  const condRow = (
    cond: AutomationCondition,
    i: number,
    patchFn: (p: Partial<AutomationCondition>) => void,
    removeFn: () => void,
    prefix: string
  ) => (
    <div key={i} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
      {prefix && <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', minWidth: '70px' }}>{prefix}</span>}
      <select style={pillStyle} value={cond.sensorKey} disabled={saving}
        onChange={(e) => patchFn({ sensorKey: e.target.value as AutomationSensorKey })}>
        {SENSOR_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <div className="operator-chip-group" role="group" aria-label="Điều kiện so sánh">
        {OPERATOR_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`operator-chip ${cond.operator === option.value ? 'is-active' : ''}`}
            disabled={saving}
            onClick={() => patchFn({ operator: option.value })}
          >
            {cond.operator === option.value ? '✓ ' : ''}
            {option.label}
          </button>
        ))}
      </div>
      <input type="number" value={cond.value} disabled={saving} style={numInputStyle}
        onChange={(e) => patchFn({ value: Number(e.target.value) })} />
      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{sensorUnit(cond.sensorKey)}</span>
      <button type="button" className="icon-button delete" style={{ borderRadius: '999px' }} onClick={removeFn}>×</button>
    </div>
  );

  return (
    <section className="panel settings-panel">
      <div className="section-heading">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Điều khiển tự động</span>
          <Toggle checked={rule.enabled} disabled={saving}
            onChange={(next) => onUpdate((curr) => ({ ...curr, enabled: next }))} />
        </div>
      </div>

      <div className="settings-section">
        <div className="section-subtitle">
          <h3>
            {rule.target === 'pump' ? 'Tưới theo cảm biến'
              : rule.target === 'fan' ? 'Làm mát theo cảm biến'
                : 'Chiếu sáng theo cảm biến'}
          </h3>
          <p>Thiết bị sẽ bật hoặc tắt theo các điều kiện bạn đặt bên dưới.</p>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <p style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ background: 'rgba(34,197,94,0.15)', color: '#16a34a', borderRadius: '6px', padding: '1px 8px', fontSize: '0.8rem' }}>BẬT</span>
            {startVerb} khi…
          </p>
          {rule.turnOnConditions.length === 0 && (
            <p style={{ fontSize: '0.85rem', fontStyle: 'italic', color: 'var(--text-muted)', margin: '0 0 0.5rem 0' }}>
              Chưa đặt điều kiện bật — {deviceLabel} sẽ không tự bật.
            </p>
          )}
          {rule.turnOnConditions.map((c, i) =>
            condRow(c, i, (p) => updateOnCond(i, p), () => removeOnCond(i), i > 0 ? 'và khi' : '')
          )}
          <button type="button" className="text-button" onClick={addOnCondition}>+ Thêm điều kiện bật</button>
        </div>

        <hr style={{ border: 'none', borderTop: '1px dashed var(--border-color)', margin: '0.25rem 0 1rem 0' }} />

        <div>
          <p style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ background: 'rgba(239,68,68,0.12)', color: '#dc2626', borderRadius: '6px', padding: '1px 8px', fontSize: '0.8rem' }}>TẮT</span>
            {stopVerb} khi…
          </p>
          {rule.turnOffConditions.length === 0 && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '0.65rem 0.9rem', marginBottom: '0.6rem' }}>
              <span>⚠️</span>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#b91c1c' }}>
                Chưa đặt điều kiện tắt. Nếu tự bật, <strong>{deviceLabel} sẽ chạy liên tục cho đến khi bạn tắt thủ công.</strong>
              </p>
            </div>
          )}
          {rule.turnOffConditions.map((c, i) =>
            condRow(c, i, (p) => updateOffCond(i, p), () => removeOffCond(i), i > 0 ? 'và khi' : '')
          )}
          <button type="button" className="text-button" onClick={addOffCondition}>+ Thêm điều kiện tắt</button>
        </div>
      </div>

      <div className="settings-section">
        <div className="section-subtitle">
          <h3>⏰ Lịch hàng ngày</h3>
          <p>Các hành động này chạy mỗi ngày vào giờ bạn đặt.</p>
        </div>
        {rule.schedules.length === 0 && (
          <p style={{ fontSize: '0.85rem', fontStyle: 'italic', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Chưa thêm lịch nào.</p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
          {rule.schedules.map((sch, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem', padding: '0.6rem 0.9rem', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
              <select style={pillStyle} value={sch.action} disabled={saving}
                onChange={(e) => updateSchedule(i, { action: e.target.value as 'ON' | 'OFF' })}>
                <option value="ON">{startVerb}</option>
                <option value="OFF">{stopVerb}</option>
              </select>
              <span style={{ color: 'var(--text-muted)' }}>mỗi ngày lúc</span>
              <input type="time" value={sch.time} disabled={saving}
                onChange={(e) => updateSchedule(i, { time: e.target.value })}
                style={{ borderRadius: '999px', border: '1.5px solid var(--border-color)', padding: '4px 12px', background: 'var(--bg-panel)', color: 'var(--text-main)' }} />
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Toggle checked={sch.enabled} disabled={saving} onChange={(next) => updateSchedule(i, { enabled: next })} />
                <button type="button" className="icon-button delete" style={{ borderRadius: '999px' }} onClick={() => removeSchedule(i)}>×</button>
              </div>
            </div>
          ))}
        </div>
        <button type="button" className="secondary-button" onClick={addSchedule} style={{ width: '100%' }}>+ Thêm lịch</button>
      </div>

      {error ? <StatusMessage>{error}</StatusMessage> : null}
      {success ? <StatusMessage tone="success">{success}</StatusMessage> : null}

      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
        <button type="button" className="secondary-button" disabled={saving} onClick={onSave}>
          {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
        </button>
      </div>
    </section>
  );
}

const DEVICE_META: Record<'pump' | 'fan' | 'rgb', { title: string; description: string }> = {
  pump: { title: 'Máy bơm', description: 'Điều khiển thời điểm tưới nước cho cây trồng.' },
  fan: { title: 'Quạt', description: 'Giữ nông trại mát mẻ tự động.' },
  rgb: { title: 'Đèn grow', description: 'Điều chỉnh ánh sáng theo điều kiện môi trường.' },
};

export function AutomationPage() {
  const [pumpRule, setPumpRule] = useState<RuleForm>(DEFAULT_RULES.pump);
  const [fanRule, setFanRule] = useState<RuleForm>(DEFAULT_RULES.fan);
  const [rgbRule, setRgbRule] = useState<RuleForm>(DEFAULT_RULES.rgb);

  const [loading, setLoading] = useState(true);
  const [ruleSaving, setRuleSaving] = useState<'pump' | 'fan' | 'rgb' | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [ruleStatuses, setRuleStatuses] = useState<Record<string, { success: string | null; error: string | null }>>({
    pump: { success: null, error: null },
    fan: { success: null, error: null },
    rgb: { success: null, error: null },
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rules = await getAutomationRules();
        if (cancelled) return;
        setPumpRule(normalizeRule(rules.find((r) => r.deviceId === 'pump'), DEFAULT_RULES.pump));
        setFanRule(normalizeRule(rules.find((r) => r.deviceId === 'fan'), DEFAULT_RULES.fan));
        setRgbRule(normalizeRule(rules.find((r) => r.deviceId === 'rgb'), DEFAULT_RULES.rgb));
        setError(null);
      } catch (err) {
        console.log('Automation load failed', err);
        if (!cancelled) setError('Không thể tải quy tắc tự động hóa.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateRuleState = (device: 'pump' | 'fan' | 'rgb', updater: (current: RuleForm) => RuleForm) => {
    const setters = { pump: setPumpRule, fan: setFanRule, rgb: setRgbRule };
    setters[device]((curr) => updater(curr));
    setRuleStatuses((prev) => ({ ...prev, [device]: { success: null, error: null } }));
  };

  const saveRule = async (device: 'pump' | 'fan' | 'rgb') => {
    const rule = { pump: pumpRule, fan: fanRule, rgb: rgbRule }[device];
    setRuleSaving(device);
    setRuleStatuses((prev) => ({ ...prev, [device]: { success: null, error: null } }));
    try {
      const updatedRules = await updateAutomationRule(device, rule);
      const updated = updatedRules.find((item) => item.deviceId === device);
      if (updated) {
        const normalized = normalizeRule(updated, DEFAULT_RULES[device]);
        const setters = { pump: setPumpRule, fan: setFanRule, rgb: setRgbRule };
        setters[device](normalized);
        setRuleStatuses((prev) => ({
          ...prev,
          [device]: { success: `Đã cập nhật tự động hóa ${device.toUpperCase()}.`, error: null },
        }));
      }
    } catch (err) {
      console.log('Rule save failed', err);
      setRuleStatuses((prev) => ({
        ...prev,
        [device]: { success: null, error: `Không thể lưu tự động hóa ${device}.` },
      }));
    } finally {
      setRuleSaving(null);
    }
  };

  return (
    <div className="page-stack">
      <header className="page-header panel">
        <div>
          <p className="eyebrow">Tự động hóa</p>
          <h1>Lịch &amp; quy tắc</h1>
          <p>Điều khiển theo ngưỡng và lịch hàng ngày cho bơm, quạt và đèn grow.</p>
          <p style={{ marginTop: '0.75rem' }}>
            <Link to="/settings" className="chip">Mặc định điều khiển (Cài đặt)</Link>
          </p>
        </div>
        {loading ? <span className="spinner" /> : null}
      </header>

      {error ? <StatusMessage>{error}</StatusMessage> : null}

      {!loading ? (
        <div className="rules-stack">
          {(['pump', 'fan', 'rgb'] as const).map((device) => (
            <RuleEditor
              key={device}
              title={DEVICE_META[device].title}
              description={DEVICE_META[device].description}
              rule={{ pump: pumpRule, fan: fanRule, rgb: rgbRule }[device]}
              saving={ruleSaving === device}
              success={ruleStatuses[device].success}
              error={ruleStatuses[device].error}
              onUpdate={(updater) => updateRuleState(device, updater)}
              onSave={() => { void saveRule(device); }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
