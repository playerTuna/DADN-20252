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
  updateAutomationRule,
  type AutomationRule,
  type AutomationSensorKey,
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

    // Payload không hiện trên UI, nhưng vẫn giữ để backend/device dùng.
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

function getRuleErrorMessage(device: AutomationDevice, err: unknown): string {
  if (err instanceof Error && err.message.includes('Threshold')) {
    return err.message;
  }

  return RULE_META[device].errorMessage;
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
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <View style={styles.panelTitleWrap}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{description}</Text>
        </View>

        <Toggle checked={rule.enabled} disabled={saving} onChange={onEnabledChange} />
      </View>

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
            onChangeText={(text) => {
              const nextValue = Number(text);
              onThresholdChange('turnOnWhen', 'value', Number.isNaN(nextValue) ? 0 : nextValue);
            }}
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
            onChangeText={(text) => {
              const nextValue = Number(text);
              onThresholdChange('turnOffWhen', 'value', Number.isNaN(nextValue) ? 0 : nextValue);
            }}
            style={styles.input}
            placeholder="Value"
            placeholderTextColor="#9ca3af"
          />
        </View>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {success ? <Text style={styles.successText}>{success}</Text> : null}

      <Pressable
        onPress={onSave}
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
    let mounted = true;

    void (async () => {
      const tokens = await getTokens();

      if (mounted && !tokens) {
        router.replace('/');
      }
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

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
      } catch {
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

  const updateRuleDraft = (device: AutomationDevice, updater: (current: RuleForm) => RuleForm) => {
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

  const persistRule = async (device: AutomationDevice, rule: RuleForm): Promise<RuleForm> => {
    const validation = ruleValidationError(rule);

    if (validation) {
      throw new Error(validation);
    }

    const meta = RULE_META[device];

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

    return normalizeRule(updated, DEFAULT_RULES[device]);
  };

  const saveRule = async (device: AutomationDevice) => {
    const meta = RULE_META[device];
    const rule = rules[device];

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
      const normalized = await persistRule(device, rule);

      setRules((current) => ({
        ...current,
        [device]: normalized,
      }));

      setSuccess((current) => ({
        ...current,
        [device]: meta.successMessage,
      }));
    } catch (err) {
      setRuleErrors((current) => ({
        ...current,
        [device]: getRuleErrorMessage(device, err),
      }));
    } finally {
      setRuleSaving(null);
    }
  };

  const toggleRuleEnabled = async (device: AutomationDevice, enabled: boolean) => {
    const meta = RULE_META[device];
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

    setRuleSaving(device);

    try {
      const normalized = await persistRule(device, nextRule);

      setRules((current) => ({
        ...current,
        [device]: normalized,
      }));

      setSuccess((current) => ({
        ...current,
        [device]: enabled ? `${meta.title} enabled.` : `${meta.title} disabled.`,
      }));
    } catch (err) {
      // Nếu API lỗi thì rollback về trạng thái cũ.
      setRules((current) => ({
        ...current,
        [device]: previousRule,
      }));

      setRuleErrors((current) => ({
        ...current,
        [device]: getRuleErrorMessage(device, err),
      }));
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

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.eyebrow}>Configuration</Text>
            <Text style={styles.pageTitle}>Settings</Text>
            <Text style={styles.pageSubtitle}>
              Manage automation thresholds for your smart farming devices.
            </Text>
          </View>

          {loading ? (
            <View style={styles.loadingPanel}>
              <ActivityIndicator size="small" color={ACCENT} />
              <Text style={styles.loadingText}>Loading automation settings...</Text>
            </View>
          ) : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {!loading ? (
            <>
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
                      updateRuleDraft(device, (current) => ({
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
  header: {
    gap: 4,
    marginBottom: 2,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: TEXT_SECONDARY,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: TEXT_PRIMARY,
  },
  pageSubtitle: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    lineHeight: 20,
  },
  loadingPanel: {
    backgroundColor: PANEL_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PANEL_BORDER,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    color: TEXT_SECONDARY,
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
  panelTitleWrap: {
    flex: 1,
    paddingRight: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 19,
  },
  groupLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_PRIMARY,
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
