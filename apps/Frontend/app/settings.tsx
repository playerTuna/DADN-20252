import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Toggle } from '../components/Toggle';
import {
  getAutomationRules,
  getSettings,
  getUser,
  updateAutomationRule,
  updateUserSettings,
  type AutomationRule,
  type AutomationSensorKey,
  type EditableSettings,
} from '../services/api';
import { getTokens } from '../services/auth';

const PAGE_BG = '#e5e5e5';
const PANEL_BG = '#ffffff';
const PANEL_BORDER = '#e5e7eb';
const TEXT_PRIMARY = '#111111';
const TEXT_SECONDARY = '#6b7280';
const SUCCESS = '#166534';
const ERROR = '#b91c1c';
const ACCENT = '#2f37ff';

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

const DEFAULT_RULES: Record<'pump' | 'fan' | 'light', RuleForm> = {
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

type ThresholdEditorProps = {
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
  onPayloadChange: (field: 'onPayload' | 'offPayload', value: string) => void;
  onSave: () => void;
};

function ThresholdEditor({
  title,
  description,
  rule,
  saving,
  success,
  error,
  onEnabledChange,
  onThresholdChange,
  onPayloadChange,
  onSave,
}: ThresholdEditorProps) {
  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{description}</Text>
        </View>
        <Toggle checked={rule.enabled} disabled={saving} onChange={onEnabledChange} />
      </View>

      {/* <View style={styles.group}>
        <Text style={styles.groupLabel}>Sensor source</Text>
        <View style={styles.chipWrap}>
          {SENSOR_OPTIONS.map((option) => {
            const active = rule.sensorKey === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => onSensorChange(option.value)}
                disabled={saving}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View> */}

      <View style={styles.thresholdRow}>
        <View style={styles.thresholdCard}>
          <Text style={styles.groupLabel}>Turn ON when</Text>
          <View style={styles.operatorRow}>
            {OPERATOR_OPTIONS.map((operator) => {
              const active = rule.turnOnWhen.operator === operator;
              return (
                <Pressable
                  key={`on-${operator}`}
                  onPress={() => onThresholdChange('turnOnWhen', 'operator', operator)}
                  disabled={saving}
                  style={[styles.operatorChip, active && styles.operatorChipActive]}
                >
                  <Text style={[styles.operatorChipText, active && styles.operatorChipTextActive]}>
                    {operator}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            value={String(rule.turnOnWhen.value)}
            editable={!saving}
            keyboardType="numeric"
            onChangeText={(text) =>
              onThresholdChange(
                'turnOnWhen',
                'value',
                Number.isNaN(Number(text)) ? 0 : Number(text)
              )
            }
            style={styles.input}
            placeholder="Value"
            placeholderTextColor="#9ca3af"
          />
        </View>

        <View style={styles.thresholdCard}>
          <Text style={styles.groupLabel}>Turn OFF when</Text>
          <View style={styles.operatorRow}>
            {OPERATOR_OPTIONS.map((operator) => {
              const active = rule.turnOffWhen.operator === operator;
              return (
                <Pressable
                  key={`off-${operator}`}
                  onPress={() => onThresholdChange('turnOffWhen', 'operator', operator)}
                  disabled={saving}
                  style={[styles.operatorChip, active && styles.operatorChipActive]}
                >
                  <Text style={[styles.operatorChipText, active && styles.operatorChipTextActive]}>
                    {operator}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            value={String(rule.turnOffWhen.value)}
            editable={!saving}
            keyboardType="numeric"
            onChangeText={(text) =>
              onThresholdChange(
                'turnOffWhen',
                'value',
                Number.isNaN(Number(text)) ? 0 : Number(text)
              )
            }
            style={styles.input}
            placeholder="Value"
            placeholderTextColor="#9ca3af"
          />
        </View>
      </View>

      <View style={styles.payloadRow}>
        <View style={styles.payloadCard}>
          <Text style={styles.groupLabel}>ON payload</Text>
          <TextInput
            value={rule.onPayload}
            editable={!saving}
            onChangeText={(text) => onPayloadChange('onPayload', text)}
            style={styles.input}
            placeholder="ON"
            placeholderTextColor="#9ca3af"
          />
        </View>

        <View style={styles.payloadCard}>
          <Text style={styles.groupLabel}>OFF payload</Text>
          <TextInput
            value={rule.offPayload}
            editable={!saving}
            onChangeText={(text) => onPayloadChange('offPayload', text)}
            style={styles.input}
            placeholder="OFF"
            placeholderTextColor="#9ca3af"
          />
        </View>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {success ? <Text style={styles.successText}>{success}</Text> : null}

      <Pressable
        onPress={() => {
          onSave();
        }}
        disabled={saving}
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
      >
        {saving ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <Text style={styles.saveButtonText}>Save rule</Text>
        )}
      </Pressable>
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();

  const [settings, setSettings] = useState<EditableSettings | null>(null);
  const [pumpRule, setPumpRule] = useState<RuleForm>(DEFAULT_RULES.pump);
  const [fanRule, setFanRule] = useState<RuleForm>(DEFAULT_RULES.fan);
  const [lightRule, setLightRule] = useState<RuleForm>(DEFAULT_RULES.light);

  const [loading, setLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [ruleSaving, setRuleSaving] = useState<'pump' | 'fan' | 'light' | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);
  const [pumpSuccess, setPumpSuccess] = useState<string | null>(null);
  const [fanSuccess, setFanSuccess] = useState<string | null>(null);
  const [lightSuccess, setLightSuccess] = useState<string | null>(null);
  const [pumpError, setPumpError] = useState<string | null>(null);
  const [fanError, setFanError] = useState<string | null>(null);
  const [lightError, setLightError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const tokens = await getTokens();
      if (mounted && !tokens) router.replace('/');
    })();
    return () => {
      mounted = false;
    };
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const [nextSettings, rules, profile] = await Promise.all([
          getSettings(),
          getAutomationRules(),
          getUser().catch(() => null),
        ]);

        if (cancelled) return;

        setSettings(nextSettings);
        const pump = rules.find((rule) => rule.deviceId === 'pump');
        const fan = rules.find((rule) => rule.deviceId === 'fan');
        const light = rules.find((rule) => rule.deviceId === 'rgb');

        setPumpRule(normalizeRule(pump, DEFAULT_RULES.pump));
        setFanRule(normalizeRule(fan, DEFAULT_RULES.fan));
        setLightRule(normalizeRule(light, DEFAULT_RULES.light));

        if (profile?.displayName) {
          // no-op; just proving auth/load path is healthy
        }
      } catch {
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
    if (settingsSuccess) setSettingsSuccess(null);
  };

  const handleSaveSettings = async () => {
    if (!settings) return;
    setSettingsSaving(true);
    setError(null);
    setSettingsSuccess(null);

    try {
      const nextSettings = await updateUserSettings(settings);
      setSettings(nextSettings);
      setSettingsSuccess('Settings updated.');
    } catch {
      setError('Unable to save settings.');
    } finally {
      setSettingsSaving(false);
    }
  };

  const updateRuleState = (
    device: 'pump' | 'fan' | 'light',
    updater: (current: RuleForm) => RuleForm
  ) => {
    if (device === 'pump') {
      setPumpRule((current) => updater(current));
      if (pumpSuccess) setPumpSuccess(null);
      if (pumpError) setPumpError(null);
      return;
    }

    if (device === 'fan') {
      setFanRule((current) => updater(current));
      if (fanSuccess) setFanSuccess(null);
      if (fanError) setFanError(null);
      return;
    }

    setLightRule((current) => updater(current));
    if (lightSuccess) setLightSuccess(null);
    if (lightError) setLightError(null);
  };

  const saveRule = async (device: 'pump' | 'fan' | 'light') => {
    const rule = device === 'pump' ? pumpRule : device === 'fan' ? fanRule : lightRule;

    const validation = ruleValidationError(rule);

    if (validation) {
      if (device === 'pump') setPumpError(validation);
      else if (device === 'fan') setFanError(validation);
      else setLightError(validation);
      return;
    }

    setRuleSaving(device);

    if (device === 'pump') {
      setPumpError(null);
      setPumpSuccess(null);
    } else if (device === 'fan') {
      setFanError(null);
      setFanSuccess(null);
    } else {
      setLightError(null);
      setLightSuccess(null);
    }

    try {
      const backendDeviceId = device === 'light' ? 'rgb' : device;

      const updatedRules = await updateAutomationRule(backendDeviceId, {
        enabled: rule.enabled,
        sensorKey: rule.sensorKey,
        turnOnWhen: rule.turnOnWhen,
        turnOffWhen: rule.turnOffWhen,
        onPayload: rule.onPayload,
        offPayload: rule.offPayload,
      });

      const updated = updatedRules.find((item) => item.deviceId === backendDeviceId);
      if (updated) {
        const normalized = normalizeRule(
          updated,
          device === 'pump'
            ? DEFAULT_RULES.pump
            : device === 'fan'
              ? DEFAULT_RULES.fan
              : DEFAULT_RULES.light
        );

        if (device === 'pump') {
          setPumpRule(normalized);
          setPumpSuccess('Pump automation updated.');
        } else if (device === 'fan') {
          setFanRule(normalized);
          setFanSuccess('Fan automation updated.');
        } else {
          setLightRule(normalized);
          setLightSuccess('Light automation updated.');
        }
      }
    } catch {
      if (device === 'pump') setPumpError('Unable to save pump automation.');
      else if (device === 'fan') setFanError('Unable to save fan automation.');
      else setLightError('Unable to save light automation.');
    } finally {
      setRuleSaving(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.page}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={18} color={TEXT_PRIMARY} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <ScrollView contentContainerStyle={styles.content}>
          {!loading ? (
            <>
              <ThresholdEditor
                title="Pump automation"
                description="Automatically control pump based on soil moisture."
                rule={pumpRule}
                saving={ruleSaving === 'pump'}
                success={pumpSuccess}
                error={pumpError}
                onEnabledChange={(next) =>
                  updateRuleState('pump', (current) => ({ ...current, enabled: next }))
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

              <ThresholdEditor
                title="Fan automation"
                description="Automatically control fan based on temperature."
                rule={fanRule}
                saving={ruleSaving === 'fan'}
                success={fanSuccess}
                error={fanError}
                onEnabledChange={(next) =>
                  updateRuleState('fan', (current) => ({ ...current, enabled: next }))
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
              <ThresholdEditor
                title="Light automation"
                description="Automatically control grow light based on light intensity."
                rule={lightRule}
                saving={ruleSaving === 'light'}
                success={lightSuccess}
                error={lightError}
                onEnabledChange={(next) =>
                  updateRuleState('light', (current) => ({ ...current, enabled: next }))
                }
                onThresholdChange={(key, field, value) =>
                  updateRuleState('light', (current) => ({
                    ...current,
                    [key]: {
                      ...current[key],
                      [field]: value,
                    },
                  }))
                }
                onPayloadChange={(field, value) =>
                  updateRuleState('light', (current) => ({ ...current, [field]: value }))
                }
                onSave={() => {
                  void saveRule('light');
                }}
              />
            </>
          ) : null}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },
  page: {
    flex: 1,
    padding: 20,
    gap: 16,
  },
  content: {
    paddingBottom: 32,
    gap: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backText: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  panel: {
    backgroundColor: PANEL_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PANEL_BORDER,
    padding: 20,
    gap: 14,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  subtitle: {
    fontSize: 14,
    color: '#4b5563',
  },
  infoWrap: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  value: {
    fontSize: 15,
    color: TEXT_PRIMARY,
  },
  helperText: {
    marginTop: 2,
    fontSize: 12,
    color: TEXT_SECONDARY,
  },
  group: {
    gap: 8,
  },
  groupLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: PANEL_BORDER,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  chipTextActive: {
    color: '#ffffff',
  },
  thresholdRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  thresholdCard: {
    flex: 1,
    minWidth: 220,
    gap: 8,
  },
  operatorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  operatorChip: {
    width: 44,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PANEL_BORDER,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  operatorChipActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  operatorChipText: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  operatorChipTextActive: {
    color: '#ffffff',
  },
  payloadRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  payloadCard: {
    flex: 1,
    minWidth: 220,
    gap: 8,
  },
  input: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PANEL_BORDER,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    color: TEXT_PRIMARY,
    fontSize: 14,
  },
  saveButton: {
    marginTop: 8,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  errorText: {
    color: ERROR,
    fontSize: 14,
  },
  successText: {
    color: SUCCESS,
    fontSize: 14,
  },
});
