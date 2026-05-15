import { useEffect, useState } from 'react';
import { StatusMessage } from '../components/StatusMessage';
import { Toggle } from '../components/Toggle';
import {
  getAutomationRules,
  updateAutomationRule,
  type AutomationRule,
  type AutomationSensorKey,
} from '../services/api';

type AutomationDevice = 'pump' | 'fan' | 'light';

type AutomationTarget = 'pump' | 'fan' | 'rgb';

type RuleForm = {
  deviceId: string;
  target: AutomationTarget;
  sensorKey: AutomationSensorKey;
  enabled: boolean;
  turnOnWhen: { operator: '<' | '>'; value: number };
  turnOffWhen: { operator: '<' | '>'; value: number };
  onPayload: string;
  offPayload: string;
};

const DEFAULT_RULES: Record<AutomationDevice, RuleForm> = {
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
  light: {
    deviceId: 'rgb',
    target: 'rgb',
    sensorKey: 'light',
    enabled: false,
    turnOnWhen: { operator: '<', value: 35 },
    turnOffWhen: { operator: '>', value: 65 },
    onPayload: '255,255,255',
    offPayload: '0,0,0',
  },
};

const RULE_META: Record<
  AutomationDevice,
  {
    title: string;
    description: string;
    backendDeviceId: 'pump' | 'fan' | 'rgb';
    successMessage: string;
    errorMessage: string;
  }
> = {
  pump: {
    title: 'Pump automation',
    description: 'Automatically control pump based on soil moisture.',
    backendDeviceId: 'pump',
    successMessage: 'Pump automation updated.',
    errorMessage: 'Unable to save pump automation.',
  },
  fan: {
    title: 'Fan automation',
    description: 'Automatically control fan based on temperature.',
    backendDeviceId: 'fan',
    successMessage: 'Fan automation updated.',
    errorMessage: 'Unable to save fan automation.',
  },
  light: {
    title: 'Light automation',
    description: 'Automatically control grow light based on light intensity.',
    backendDeviceId: 'rgb',
    successMessage: 'Light automation updated.',
    errorMessage: 'Unable to save light automation.',
  },
};

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

    // Payload không hiện trên UI nữa, nhưng vẫn giữ để backend/device dùng.
    // Nếu backend trả thiếu hoặc rỗng thì dùng default theo từng device.
    onPayload: incoming.onPayload?.trim() ? incoming.onPayload : fallback.onPayload,
    offPayload: incoming.offPayload?.trim() ? incoming.offPayload : fallback.offPayload,
  };
}

function ruleValidationError(rule: RuleForm): string | null {
  if (!Number.isFinite(rule.turnOnWhen.value) || !Number.isFinite(rule.turnOffWhen.value)) {
    return 'Threshold values must be valid numbers.';
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
  onThresholdChange: (
    key: 'turnOnWhen' | 'turnOffWhen',
    field: 'operator' | 'value',
    value: '<' | '>' | number
  ) => void;
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
  onThresholdChange,
  onSave,
}: RuleEditorProps) {
  return (
    <section className="panel settings-panel automation-panel">
      <div className="section-heading automation-heading">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>

        <Toggle checked={rule.enabled} disabled={saving} onChange={onEnabledChange} />
      </div>

      <div className="automation-grid">
        <div className="threshold-card">
          <span className="field-label">Turn ON when</span>

          <div className="operator-row">
            {OPERATOR_OPTIONS.map((operator) => (
              <button
                key={`on-${operator}`}
                type="button"
                className={`operator-button ${
                  rule.turnOnWhen.operator === operator ? 'active' : ''
                }`}
                disabled={saving}
                onClick={() => onThresholdChange('turnOnWhen', 'operator', operator)}
              >
                {operator}
              </button>
            ))}
          </div>

          <input
            type="number"
            value={rule.turnOnWhen.value}
            disabled={saving}
            placeholder="Value"
            onChange={(event) => {
              const nextValue = Number(event.target.value);
              onThresholdChange('turnOnWhen', 'value', Number.isNaN(nextValue) ? 0 : nextValue);
            }}
          />
        </div>

        <div className="threshold-card">
          <span className="field-label">Turn OFF when</span>

          <div className="operator-row">
            {OPERATOR_OPTIONS.map((operator) => (
              <button
                key={`off-${operator}`}
                type="button"
                className={`operator-button ${
                  rule.turnOffWhen.operator === operator ? 'active' : ''
                }`}
                disabled={saving}
                onClick={() => onThresholdChange('turnOffWhen', 'operator', operator)}
              >
                {operator}
              </button>
            ))}
          </div>

          <input
            type="number"
            value={rule.turnOffWhen.value}
            disabled={saving}
            placeholder="Value"
            onChange={(event) => {
              const nextValue = Number(event.target.value);
              onThresholdChange('turnOffWhen', 'value', Number.isNaN(nextValue) ? 0 : nextValue);
            }}
          />
        </div>
      </div>

      {error ? <StatusMessage>{error}</StatusMessage> : null}
      {success ? <StatusMessage tone="success">{success}</StatusMessage> : null}

      <button
        type="button"
        className="secondary-button automation-save-button"
        disabled={saving}
        onClick={onSave}
      >
        {saving ? 'Saving...' : 'Save rule'}
      </button>
    </section>
  );
}
function SettingsHeroIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5z" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6V20a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-.6 1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1H4a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 .6-1 1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6V4a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 .6 1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.14.35.35.69.6 1H20a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-.51 1z" />
    </svg>
  );
}
export function SettingsPage() {
  const [rules, setRules] = useState<Record<AutomationDevice, RuleForm>>(DEFAULT_RULES);

  const [loading, setLoading] = useState(true);
  const [ruleSaving, setRuleSaving] = useState<AutomationDevice | null>(null);

  const [error, setError] = useState<string | null>(null);

  const [success, setSuccess] = useState<Record<AutomationDevice, string | null>>({
    pump: null,
    fan: null,
    light: null,
  });

  const [ruleErrors, setRuleErrors] = useState<Record<AutomationDevice, string | null>>({
    pump: null,
    fan: null,
    light: null,
  });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const automationRules = await getAutomationRules();

        if (cancelled) return;

        const pump = automationRules.find((rule) => rule.deviceId === 'pump');
        const fan = automationRules.find((rule) => rule.deviceId === 'fan');
        const light = automationRules.find((rule) => rule.deviceId === 'rgb');

        setRules({
          pump: normalizeRule(pump, DEFAULT_RULES.pump),
          fan: normalizeRule(fan, DEFAULT_RULES.fan),
          light: normalizeRule(light, DEFAULT_RULES.light),
        });

        setError(null);
      } catch (err) {
        console.log('Settings load failed', err);

        if (!cancelled) {
          setError('Unable to load automation settings.');
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

  const updateRuleState = (device: AutomationDevice, updater: (current: RuleForm) => RuleForm) => {
    setRules((current) => ({
      ...current,
      [device]: updater(current[device]),
    }));

    setSuccess((current) => ({
      ...current,
      [device]: null,
    }));

    setRuleErrors((current) => ({
      ...current,
      [device]: null,
    }));
  };

  const saveRuleToBackend = async (
    device: AutomationDevice,
    rule: RuleForm,
    customSuccessMessage?: string
  ) => {
    const validation = ruleValidationError(rule);

    if (validation) {
      setRuleErrors((current) => ({
        ...current,
        [device]: validation,
      }));
      return;
    }

    const meta = RULE_META[device];

    setRuleSaving(device);

    setSuccess((current) => ({
      ...current,
      [device]: null,
    }));

    setRuleErrors((current) => ({
      ...current,
      [device]: null,
    }));

    try {
      const updatedRules = await updateAutomationRule(meta.backendDeviceId, {
        enabled: rule.enabled,
        sensorKey: rule.sensorKey,
        turnOnWhen: rule.turnOnWhen,
        turnOffWhen: rule.turnOffWhen,

        // Payload ẩn khỏi UI nhưng vẫn gửi cho backend/device.
        onPayload: rule.onPayload,
        offPayload: rule.offPayload,
      });

      const updated = updatedRules.find((item) => item.deviceId === meta.backendDeviceId);

      if (updated) {
        setRules((current) => ({
          ...current,
          [device]: normalizeRule(updated, DEFAULT_RULES[device]),
        }));
      }

      setSuccess((current) => ({
        ...current,
        [device]: customSuccessMessage ?? meta.successMessage,
      }));
    } catch (err) {
      console.log('Rule save failed', err);

      setRuleErrors((current) => ({
        ...current,
        [device]: meta.errorMessage,
      }));
    } finally {
      setRuleSaving(null);
    }
  };

  const saveRule = async (device: AutomationDevice) => {
    await saveRuleToBackend(device, rules[device]);
  };

  const toggleRuleEnabled = async (device: AutomationDevice, enabled: boolean) => {
    const previousRule = rules[device];

    const nextRule: RuleForm = {
      ...previousRule,
      enabled,
    };

    // Optimistic update: gạt toggle là UI đổi ngay.
    setRules((current) => ({
      ...current,
      [device]: nextRule,
    }));

    setSuccess((current) => ({
      ...current,
      [device]: null,
    }));

    setRuleErrors((current) => ({
      ...current,
      [device]: null,
    }));

    const meta = RULE_META[device];

    try {
      await saveRuleToBackend(
        device,
        nextRule,
        enabled ? `${meta.title} enabled.` : `${meta.title} disabled.`
      );
    } catch {
      // Phòng trường hợp saveRuleToBackend bị throw ngoài dự kiến.
      setRules((current) => ({
        ...current,
        [device]: previousRule,
      }));
    }
  };

  return (
    <div className="page-stack settings-page-web">
      <header className="settings-hero-card">
        <div className="settings-hero-icon">
          <SettingsHeroIcon />
        </div>

        <div>
          <p className="eyebrow">Configuration</p>
          <h1>Settings</h1>
          <p>Manage automation thresholds for your smart farming devices.</p>
        </div>

        {loading ? <span className="spinner" /> : null}
      </header>
      {error ? <StatusMessage>{error}</StatusMessage> : null}

      {!loading ? (
        <div className="automation-list">
          {(['pump', 'fan', 'light'] as const).map((device) => {
            const meta = RULE_META[device];

            return (
              <RuleEditor
                key={device}
                title={meta.title}
                description={meta.description}
                rule={rules[device]}
                saving={ruleSaving === device}
                success={success[device]}
                error={ruleErrors[device]}
                onEnabledChange={(next) => {
                  void toggleRuleEnabled(device, next);
                }}
                onThresholdChange={(key, field, value) =>
                  updateRuleState(device, (current) => ({
                    ...current,
                    [key]: {
                      ...current[key],
                      [field]: value,
                    },
                  }))
                }
                onSave={() => {
                  void saveRule(device);
                }}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
