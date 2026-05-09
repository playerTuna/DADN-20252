import { useEffect, useState } from 'react';
import { StatusMessage } from '../components/StatusMessage';
import { Toggle } from '../components/Toggle';
import {
  getAutomationRules,
  getSettings,
  updateAutomationRule,
  updateUserSettings,
  type AutomationRule,
  type AutomationSensorKey,
  type EditableSettings,
} from '../services/api';

const SETTING_LABELS: Record<string, string> = {
  'pump-1': 'Pump 1 default state',
  'pump-2': 'Pump 2 default state',
  'led-1': 'LED 1 default state',
  'led-2': 'LED 2 default state',
  'led-3': 'LED 3 default state',
  'schedule-1': 'Morning cycle default state',
  'schedule-2': 'Cooling fan default state',
  'schedule-3': 'Night lamp default state',
  'dev-1': 'Pump A default state',
  'dev-2': 'Pump B default state',
  'dev-3': 'Grow Light 1 default state',
  'dev-4': 'Grow Light 2 default state',
};

type RuleForm = {
  deviceId: string;
  target: 'pump' | 'fan' | 'rgb';
  sensorKey: AutomationSensorKey;
  enabled: boolean;
  turnOnWhen: { operator: '<' | '>'; value: number };
  turnOffWhen: { operator: '<' | '>'; value: number };
  onPayload: string;
  offPayload: string;
};

const DEFAULT_RULES: Record<'pump' | 'fan', RuleForm> = {
  pump: {
    deviceId: 'pump',
    target: 'pump',
    sensorKey: 'soilMoisture',
    enabled: true,
    turnOnWhen: { operator: '<', value: 40 },
    turnOffWhen: { operator: '>', value: 70 },
    onPayload: 'ON',
    offPayload: 'OFF',
  },
  fan: {
    deviceId: 'fan',
    target: 'fan',
    sensorKey: 'temperature',
    enabled: true,
    turnOnWhen: { operator: '>', value: 32 },
    turnOffWhen: { operator: '<', value: 28 },
    onPayload: 'ON',
    offPayload: 'OFF',
  },
};

const SENSOR_OPTIONS: { value: AutomationSensorKey; label: string }[] = [
  { value: 'soilMoisture', label: 'Soil moisture' },
  { value: 'temperature', label: 'Temperature' },
  { value: 'light', label: 'Light' },
];

const OPERATOR_OPTIONS: ('<' | '>')[] = ['<', '>'];

function normalizeRule(incoming: AutomationRule | undefined, fallback: RuleForm): RuleForm {
  if (!incoming) return fallback;
  return {
    deviceId: incoming.deviceId,
    target: incoming.target,
    sensorKey: incoming.sensorKey,
    enabled: incoming.enabled,
    turnOnWhen: {
      operator: incoming.turnOnWhen.operator,
      value: Number(incoming.turnOnWhen.value),
    },
    turnOffWhen: {
      operator: incoming.turnOffWhen.operator,
      value: Number(incoming.turnOffWhen.value),
    },
    onPayload: incoming.onPayload ?? 'ON',
    offPayload: incoming.offPayload ?? 'OFF',
  };
}

function ruleValidationError(rule: RuleForm): string | null {
  if (!Number.isFinite(rule.turnOnWhen.value) || !Number.isFinite(rule.turnOffWhen.value)) {
    return 'Threshold values must be valid numbers.';
  }
  if (rule.onPayload.trim().length === 0 || rule.offPayload.trim().length === 0) {
    return 'Payload values cannot be empty.';
  }
  return null;
}

type RuleEditorProps = {
  title: string;
  description: string;
  rule: RuleForm;
  saving: boolean;
  success: string | null;
  error: string | null;
  onEnabledChange: (next: boolean) => void;
  onSensorChange: (next: AutomationSensorKey) => void;
  onThresholdChange: (
    key: 'turnOnWhen' | 'turnOffWhen',
    field: 'operator' | 'value',
    value: '<' | '>' | number
  ) => void;
  onPayloadChange: (field: 'onPayload' | 'offPayload', value: string) => void;
  onSave: () => void;
};

function RuleEditor({
  title,
  description,
  rule,
  saving,
  success,
  error,
  onEnabledChange,
  onSensorChange,
  onThresholdChange,
  onPayloadChange,
  onSave,
}: RuleEditorProps) {
  return (
    <section className="panel settings-panel">
      <div className="section-heading">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <Toggle checked={rule.enabled} disabled={saving} onChange={onEnabledChange} />
      </div>

      <div className="field-group">
        <span className="field-label">Sensor source</span>
        <div className="chip-row">
          {SENSOR_OPTIONS.map((option) => {
            const active = rule.sensorKey === option.value;
            return (
              <button
                key={option.value}
                type="button"
                className={`chip ${active ? 'active' : ''}`}
                disabled={saving}
                onClick={() => onSensorChange(option.value)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="settings-grid">
        {(['turnOnWhen', 'turnOffWhen'] as const).map((key) => (
          <div key={key} className="threshold-card">
            <span className="field-label">{key === 'turnOnWhen' ? 'Turn ON when' : 'Turn OFF when'}</span>
            <div className="operator-row">
              {OPERATOR_OPTIONS.map((operator) => (
                <button
                  key={`${key}-${operator}`}
                  type="button"
                  className={`operator-button ${rule[key].operator === operator ? 'active' : ''}`}
                  disabled={saving}
                  onClick={() => onThresholdChange(key, 'operator', operator)}
                >
                  {operator}
                </button>
              ))}
            </div>
            <input
              type="number"
              value={rule[key].value}
              disabled={saving}
              onChange={(event) =>
                onThresholdChange(key, 'value', Number(event.target.value || 0))
              }
            />
          </div>
        ))}

        <label className="form-field compact">
          <span>ON payload</span>
          <input
            value={rule.onPayload}
            disabled={saving}
            onChange={(event) => onPayloadChange('onPayload', event.target.value)}
          />
        </label>

        <label className="form-field compact">
          <span>OFF payload</span>
          <input
            value={rule.offPayload}
            disabled={saving}
            onChange={(event) => onPayloadChange('offPayload', event.target.value)}
          />
        </label>
      </div>

      {error ? <StatusMessage>{error}</StatusMessage> : null}
      {success ? <StatusMessage tone="success">{success}</StatusMessage> : null}

      <button type="button" className="secondary-button" disabled={saving} onClick={onSave}>
        {saving ? 'Saving...' : 'Save rule'}
      </button>
    </section>
  );
}

export function SettingsPage() {
  const [settings, setSettings] = useState<EditableSettings | null>(null);
  const [pumpRule, setPumpRule] = useState<RuleForm>(DEFAULT_RULES.pump);
  const [fanRule, setFanRule] = useState<RuleForm>(DEFAULT_RULES.fan);

  const [loading, setLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [ruleSaving, setRuleSaving] = useState<'pump' | 'fan' | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);
  const [pumpSuccess, setPumpSuccess] = useState<string | null>(null);
  const [fanSuccess, setFanSuccess] = useState<string | null>(null);
  const [pumpError, setPumpError] = useState<string | null>(null);
  const [fanError, setFanError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const [nextSettings, rules] = await Promise.all([getSettings(), getAutomationRules()]);
        if (cancelled) return;

        setSettings(nextSettings);
        setPumpRule(normalizeRule(rules.find((rule) => rule.deviceId === 'pump'), DEFAULT_RULES.pump));
        setFanRule(normalizeRule(rules.find((rule) => rule.deviceId === 'fan'), DEFAULT_RULES.fan));
        setError(null);
      } catch (err) {
        console.log('Settings load failed', err);
        if (!cancelled) setError('Unable to load settings.');
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
      setSettingsSuccess('Settings updated.');
    } catch (err) {
      console.log('Settings save failed', err);
      setError('Unable to save settings.');
    } finally {
      setSettingsSaving(false);
    }
  };

  const updateRuleState = (device: 'pump' | 'fan', updater: (current: RuleForm) => RuleForm) => {
    if (device === 'pump') {
      setPumpRule((current) => updater(current));
      setPumpSuccess(null);
      setPumpError(null);
      return;
    }
    setFanRule((current) => updater(current));
    setFanSuccess(null);
    setFanError(null);
  };

  const saveRule = async (device: 'pump' | 'fan') => {
    const rule = device === 'pump' ? pumpRule : fanRule;
    const validation = ruleValidationError(rule);

    if (validation) {
      if (device === 'pump') setPumpError(validation);
      else setFanError(validation);
      return;
    }

    setRuleSaving(device);
    if (device === 'pump') {
      setPumpError(null);
      setPumpSuccess(null);
    } else {
      setFanError(null);
      setFanSuccess(null);
    }

    try {
      const updatedRules = await updateAutomationRule(device, {
        enabled: rule.enabled,
        sensorKey: rule.sensorKey,
        turnOnWhen: rule.turnOnWhen,
        turnOffWhen: rule.turnOffWhen,
        onPayload: rule.onPayload,
        offPayload: rule.offPayload,
      });

      const updated = updatedRules.find((item) => item.deviceId === device);
      if (updated) {
        const normalized = normalizeRule(
          updated,
          device === 'pump' ? DEFAULT_RULES.pump : DEFAULT_RULES.fan
        );
        if (device === 'pump') {
          setPumpRule(normalized);
          setPumpSuccess('Pump automation updated.');
        } else {
          setFanRule(normalized);
          setFanSuccess('Fan automation updated.');
        }
      }
    } catch (err) {
      console.log('Rule save failed', err);
      if (device === 'pump') setPumpError('Unable to save pump automation.');
      else setFanError('Unable to save fan automation.');
    } finally {
      setRuleSaving(null);
    }
  };

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Configuration</p>
          <h1>Settings</h1>
          <p>Manage default controls and automation thresholds.</p>
        </div>
        {loading ? <span className="spinner" /> : null}
      </header>

      {error ? <StatusMessage>{error}</StatusMessage> : null}

      <section className="panel settings-panel">
        <div className="section-heading">
          <div>
            <h2>Control defaults</h2>
            <p>Saved default states for dashboard controls.</p>
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
                <Toggle
                  checked={value}
                  disabled={settingsSaving}
                  onChange={(next) => handleToggleSetting(key, next)}
                />
              </div>
            ))}
          </div>
        ) : null}

        {settingsSuccess ? <StatusMessage tone="success">{settingsSuccess}</StatusMessage> : null}

        <button
          type="button"
          className="secondary-button"
          disabled={settingsSaving || !settings}
          onClick={() => {
            void handleSaveSettings();
          }}
        >
          {settingsSaving ? 'Saving...' : 'Save settings'}
        </button>
      </section>

      {!loading ? (
        <>
          <RuleEditor
            title="Pump automation"
            description="Automatically control pump based on soil moisture."
            rule={pumpRule}
            saving={ruleSaving === 'pump'}
            success={pumpSuccess}
            error={pumpError}
            onEnabledChange={(next) =>
              updateRuleState('pump', (current) => ({ ...current, enabled: next }))
            }
            onSensorChange={(next) =>
              updateRuleState('pump', (current) => ({ ...current, sensorKey: next }))
            }
            onThresholdChange={(key, field, value) =>
              updateRuleState('pump', (current) => ({
                ...current,
                [key]: {
                  ...current[key],
                  [field]: value,
                },
              }))
            }
            onPayloadChange={(field, value) =>
              updateRuleState('pump', (current) => ({ ...current, [field]: value }))
            }
            onSave={() => {
              void saveRule('pump');
            }}
          />

          <RuleEditor
            title="Fan automation"
            description="Automatically control fan based on temperature."
            rule={fanRule}
            saving={ruleSaving === 'fan'}
            success={fanSuccess}
            error={fanError}
            onEnabledChange={(next) =>
              updateRuleState('fan', (current) => ({ ...current, enabled: next }))
            }
            onSensorChange={(next) =>
              updateRuleState('fan', (current) => ({ ...current, sensorKey: next }))
            }
            onThresholdChange={(key, field, value) =>
              updateRuleState('fan', (current) => ({
                ...current,
                [key]: {
                  ...current[key],
                  [field]: value,
                },
              }))
            }
            onPayloadChange={(field, value) =>
              updateRuleState('fan', (current) => ({ ...current, [field]: value }))
            }
            onSave={() => {
              void saveRule('fan');
            }}
          />
        </>
      ) : null}
    </div>
  );
}
