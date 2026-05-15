import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
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
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MobileHeaderMenu } from '@/components/MobileHeaderMenu';
import { BottomNav } from '../components/BottomNav';
import { Toggle } from '../components/Toggle';
import { UserMenu } from '../components/UserMenu';
import { sidebarItems } from '../constants/navigation';
import type { NavKey } from '../types/dashboard';
import {
  getAutomationRules,
  getUser,
  updateAutomationRule,
  type AutomationRule,
  type AutomationSchedule,
  type AutomationSensorKey,
} from '../services/api';
import { clearTokens, getTokens } from '../services/auth';

const PAGE_BG = '#e5e5e5';
const PANEL_BG = '#ffffff';
const PANEL_BORDER = '#e5e7eb';
const TEXT_PRIMARY = '#111111';
const TEXT_SECONDARY = '#6b7280';
const SUCCESS = '#166534';
const ERROR = '#b91c1c';
const ERROR_BG = '#ffe4e6';
const ERROR_TEXT = '#be123c';
const ACCENT = '#2f37ff';
const ACCENT_GREEN = '#28f464';

type RuleForm = {
  deviceId: string;
  target: 'pump' | 'fan' | 'rgb';
  sensorKey: AutomationSensorKey;
  enabled: boolean;
  turnOnConditions: { sensorKey: AutomationSensorKey; operator: '<' | '>'; value: number }[];
  turnOffConditions: { sensorKey: AutomationSensorKey; operator: '<' | '>'; value: number }[];
  schedules: AutomationSchedule[];
  onPayload: string;
  offPayload: string;
};

const DEFAULT_RULES: Record<'pump' | 'fan' | 'light', RuleForm> = {
  pump: {
    deviceId: 'pump',
    target: 'pump',
    sensorKey: 'soilMoisture',
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
    sensorKey: 'temperature',
    enabled: true,
    turnOnConditions: [{ sensorKey: 'temperature', operator: '>', value: 32 }],
    turnOffConditions: [{ sensorKey: 'temperature', operator: '<', value: 28 }],
    schedules: [],
    onPayload: 'ON',
    offPayload: 'OFF',
  },
  light: {
    deviceId: 'rgb',
    target: 'rgb',
    sensorKey: 'light',
    enabled: false,
    turnOnConditions: [{ sensorKey: 'light', operator: '<', value: 35 }],
    turnOffConditions: [{ sensorKey: 'light', operator: '>', value: 65 }],
    schedules: [],
    onPayload: '255,255,255',
    offPayload: '0,0,0',
  },
};

const OPERATOR_OPTIONS: ('<' | '>')[] = ['<', '>'];

function normalizeRule(incoming: AutomationRule | undefined, fallback: RuleForm): RuleForm {
  if (!incoming) return fallback;
  const firstTurnOn = incoming.turnOnConditions?.[0];
  const firstTurnOff = incoming.turnOffConditions?.[0];
  const sensorKey = firstTurnOn?.sensorKey ?? firstTurnOff?.sensorKey ?? fallback.sensorKey;

  return {
    deviceId: incoming.deviceId,
    target: incoming.target,
    sensorKey,
    enabled: incoming.enabled,
    turnOnConditions:
      incoming.turnOnConditions?.length > 0
        ? incoming.turnOnConditions.map((condition) => ({
          sensorKey: condition.sensorKey,
          operator: condition.operator,
          value: Number(condition.value),
        }))
        : [{ sensorKey, operator: fallback.turnOnConditions[0].operator, value: fallback.turnOnConditions[0].value }],
    turnOffConditions:
      incoming.turnOffConditions?.length > 0
        ? incoming.turnOffConditions.map((condition) => ({
          sensorKey: condition.sensorKey,
          operator: condition.operator,
          value: Number(condition.value),
        }))
        : [{ sensorKey, operator: fallback.turnOffConditions[0].operator, value: fallback.turnOffConditions[0].value }],
    schedules: incoming.schedules ?? [],
    onPayload: incoming.onPayload ?? 'ON',
    offPayload: incoming.offPayload ?? 'OFF',
  };
}

function ruleValidationError(rule: RuleForm): string | null {
  const turnOnCondition = rule.turnOnConditions[0];
  const turnOffCondition = rule.turnOffConditions[0];

  if (
    !turnOnCondition ||
    !Number.isFinite(turnOnCondition.value) ||
    !turnOffCondition ||
    !Number.isFinite(turnOffCondition.value)
  ) {
    return 'Giá trị ngưỡng phải là số hợp lệ.';
  }
  if (rule.onPayload.trim().length === 0 || rule.offPayload.trim().length === 0) {
    return 'Giá trị payload không được để trống.';
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
    key: 'turnOnConditions' | 'turnOffConditions',
    field: 'operator' | 'value',
    value: '<' | '>' | number
  ) => void;
  onPayloadChange: (field: 'onPayload' | 'offPayload', value: string) => void;
  onAddSchedule: () => void;
  onRemoveSchedule: (index: number) => void;
  onScheduleChange: (index: number, patch: Partial<AutomationSchedule>) => void;
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
  onAddSchedule,
  onRemoveSchedule,
  onScheduleChange,
  onSave,
}: ThresholdEditorProps) {
  const turnOnCondition = rule.turnOnConditions[0];
  const turnOffCondition = rule.turnOffConditions[0];
  const deviceLabel =
    rule.target === 'pump' ? 'máy bơm' : rule.target === 'fan' ? 'quạt' : 'đèn grow';
  const startVerb =
    rule.target === 'pump' ? 'Bắt đầu tưới' : rule.target === 'fan' ? 'Bật quạt' : 'Bật đèn';
  const stopVerb =
    rule.target === 'pump' ? 'Dừng tưới' : rule.target === 'fan' ? 'Tắt quạt' : 'Tắt đèn';

  return (
    <View style={styles.panel}>
      {/* Header */}
      <View style={styles.panelHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{description}</Text>
        </View>
        <Toggle checked={rule.enabled} disabled={saving} onChange={onEnabledChange} />
      </View>

      {/* ── START block ── */}
      <View style={styles.group}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <View style={{ backgroundColor: 'rgba(34,197,94,0.15)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, justifyContent: 'center' }}>
            <Text style={{ color: '#16a34a', fontSize: 12, fontWeight: '700', lineHeight: 16 }}>BẬT</Text>
          </View>
          <Text style={[styles.groupLabel, { lineHeight: 16 }]}>{startVerb} khi…</Text>
        </View>
        <View style={styles.operatorRow}>
          {OPERATOR_OPTIONS.map((operator) => {
            const active = turnOnCondition.operator === operator;
            return (
              <Pressable
                key={`on-${operator}`}
                onPress={() => onThresholdChange('turnOnConditions', 'operator', operator)}
                disabled={saving}
                style={[styles.operatorChip, active && styles.operatorChipActive, { borderRadius: 999, paddingHorizontal: 14 }]}
              >
                <Text style={[styles.operatorChipText, active && styles.operatorChipTextActive]}>
                  {active ? '✓ ' : ''}
                  {operator === '<' ? 'Khi xuống dưới' : 'Khi vượt quá'}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 }}>
          <TextInput
            value={String(turnOnCondition.value)}
            editable={!saving}
            keyboardType="numeric"
            onChangeText={(text) =>
              onThresholdChange('turnOnConditions', 'value', Number.isNaN(Number(text)) ? 0 : Number(text))
            }
            style={[styles.input, { flex: 1, borderRadius: 999, paddingHorizontal: 16 }]}
            placeholder="Giá trị"
            placeholderTextColor="#9ca3af"
          />
          <Text style={{ color: TEXT_SECONDARY, fontSize: 15, fontWeight: '500' }}>
            {rule.sensorKey === 'temperature' ? '°C' : rule.sensorKey === 'soilMoisture' ? '%' : ''}
          </Text>
        </View>
      </View>

      {/* ── STOP block ── */}
      <View style={styles.group}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <View style={{ backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, justifyContent: 'center' }}>
            <Text style={{ color: '#dc2626', fontSize: 12, fontWeight: '700', lineHeight: 16 }}>TẮT</Text>
          </View>
          <Text style={[styles.groupLabel, { lineHeight: 16 }]}>{stopVerb} khi…</Text>
        </View>

        {/* Warning if no stop condition */}
        {!turnOffCondition && (
          <View style={{ backgroundColor: 'rgba(239,68,68,0.07)', borderColor: 'rgba(239,68,68,0.3)', borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 10, flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
            <Text style={{ fontSize: 16 }}>⚠️</Text>
            <Text style={{ color: '#b91c1c', fontSize: 13, flex: 1 }}>
              Chưa đặt điều kiện tắt. Nếu tự bật, <Text style={{ fontWeight: '700' }}>{deviceLabel} sẽ chạy liên tục cho đến khi bạn tắt thủ công.</Text>
            </Text>
          </View>
        )}

        {turnOffCondition && (
          <>
            <View style={styles.operatorRow}>
              {OPERATOR_OPTIONS.map((operator) => {
                const active = turnOffCondition.operator === operator;
                return (
                  <Pressable
                    key={`off-${operator}`}
                    onPress={() => onThresholdChange('turnOffConditions', 'operator', operator)}
                    disabled={saving}
                    style={[styles.operatorChip, active && styles.operatorChipActive, { borderRadius: 999, paddingHorizontal: 14 }]}
                  >
                    <Text style={[styles.operatorChipText, active && styles.operatorChipTextActive]}>
                      {active ? '✓ ' : ''}
                      {operator === '<' ? 'Khi xuống dưới' : 'Khi vượt quá'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 }}>
              <TextInput
                value={String(turnOffCondition.value)}
                editable={!saving}
                keyboardType="numeric"
                onChangeText={(text) =>
                  onThresholdChange('turnOffConditions', 'value', Number.isNaN(Number(text)) ? 0 : Number(text))
                }
                style={[styles.input, { flex: 1, borderRadius: 999, paddingHorizontal: 16 }]}
                placeholder="Giá trị"
                placeholderTextColor="#9ca3af"
              />
              <Text style={{ color: TEXT_SECONDARY, fontSize: 15, fontWeight: '500' }}>
                {rule.sensorKey === 'temperature' ? '°C' : rule.sensorKey === 'soilMoisture' ? '%' : ''}
              </Text>
            </View>
          </>
        )}
      </View>

      {/* ── Schedules ── */}
      <View style={styles.group}>
        <Text style={styles.groupLabel}>⏰ Lịch hàng ngày</Text>
        {rule.schedules.map((schedule, index) => {
          const activeOn = schedule.action === 'ON';
          return (
            <View key={index} style={[styles.scheduleRow, { borderRadius: 10, borderWidth: 1, borderColor: PANEL_BORDER, padding: 10, marginBottom: 6 }]}>
              <View style={styles.scheduleActionRow}>
                <Pressable
                  onPress={() => onScheduleChange(index, { action: 'ON' })}
                  disabled={saving}
                  style={[styles.operatorChip, activeOn && styles.operatorChipActive, { borderRadius: 999, paddingHorizontal: 12 }]}
                >
                  <Text style={[styles.operatorChipText, activeOn && styles.operatorChipTextActive]}>{startVerb}</Text>
                </Pressable>
                <Pressable
                  onPress={() => onScheduleChange(index, { action: 'OFF' })}
                  disabled={saving}
                  style={[styles.operatorChip, !activeOn && styles.operatorChipActive, { borderRadius: 999, paddingHorizontal: 12 }]}
                >
                  <Text style={[styles.operatorChipText, !activeOn && styles.operatorChipTextActive]}>{stopVerb}</Text>
                </Pressable>
              </View>
              <Text style={{ color: TEXT_SECONDARY, fontSize: 13, marginTop: 6, marginBottom: 4 }}>vào mỗi ngày lúc</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TextInput
                  value={schedule.time}
                  editable={!saving}
                  onChangeText={(text) => onScheduleChange(index, { time: text })}
                  style={[styles.input, styles.scheduleTimeInput, { borderRadius: 999 }]}
                  placeholder="HH:mm"
                  placeholderTextColor="#9ca3af"
                />
                <Toggle checked={schedule.enabled} disabled={saving}
                  onChange={(next) => onScheduleChange(index, { enabled: next })} />
                <Pressable disabled={saving} onPress={() => onRemoveSchedule(index)} style={styles.deleteButton}>
                  <Text style={styles.deleteButtonText}>×</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
        <Pressable onPress={onAddSchedule} disabled={saving} style={[styles.addScheduleButton, { borderRadius: 999 }]}>
          <Text style={styles.addScheduleButtonText}>+ Thêm lịch</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {success ? <Text style={styles.successText}>{success}</Text> : null}
    </View>
  );
}









export default function AutomationScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 960;
  const [userName, setUserName] = useState('Người dùng');
  const [userEmail, setUserEmail] = useState<string | undefined>();
  const [pumpRule, setPumpRule] = useState<RuleForm>(DEFAULT_RULES.pump);
  const [fanRule, setFanRule] = useState<RuleForm>(DEFAULT_RULES.fan);
  const [lightRule, setLightRule] = useState<RuleForm>(DEFAULT_RULES.light);

  const [loading, setLoading] = useState(true);
  const [ruleSaving, setRuleSaving] = useState<'pump' | 'fan' | 'light' | null>(null);

  const [error, setError] = useState<string | null>(null);
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
        const [rules, profile] = await Promise.all([
          getAutomationRules(),
          getUser().catch(() => null),
        ]);

        if (cancelled) return;

        const pump = rules.find((rule) => rule.deviceId === 'pump');
        const fan = rules.find((rule) => rule.deviceId === 'fan');
        const light = rules.find((rule) => rule.deviceId === 'rgb');

        setPumpRule(normalizeRule(pump, DEFAULT_RULES.pump));
        setFanRule(normalizeRule(fan, DEFAULT_RULES.fan));
        setLightRule(normalizeRule(light, DEFAULT_RULES.light));

        if (profile?.displayName) {
          setUserName(profile.displayName);
        }
        if (profile?.email) {
          setUserEmail(profile.email);
        }
      } catch {
        if (!cancelled) setError('Không thể tải tự động hóa.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleNavPress = (key: NavKey) => {
    if (key !== 'automation') {
      router.push(`/${key}`);
    }
  };

  const renderSidebar = () => (
    <View style={styles.sidebar}>
      <View>
        <View style={styles.brandRow}>
          <Image
            source={require('../assets/images/logo.png')}
            style={styles.brandLogo}
            contentFit="contain"
          />
          <Text style={styles.brandText}>Smart Farm</Text>
        </View>

        <View style={styles.sidebarDivider} />

        <View style={styles.navList}>
          {sidebarItems.map((item) => {
            const isActive = item.key === 'automation';
            return (
              <Pressable
                key={item.key}
                onPress={() => handleNavPress(item.key)}
                style={[styles.navItem, isActive && styles.navItemActive]}
              >
                <Feather name={item.icon} size={26} color={TEXT_PRIMARY} />
                <Text style={[styles.navText, isActive && styles.navTextActive]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <UserMenu userName={userName} userEmail={userEmail} />
    </View>
  );

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
        turnOnConditions: rule.turnOnConditions,
        turnOffConditions: rule.turnOffConditions,
        schedules: rule.schedules,
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
          setPumpSuccess('Đã cập nhật tự động hóa bơm.');
        } else if (device === 'fan') {
          setFanRule(normalized);
          setFanSuccess('Đã cập nhật tự động hóa quạt.');
        } else {
          setLightRule(normalized);
          setLightSuccess('Đã cập nhật tự động hóa đèn.');
        }
      }
    } catch {
      if (device === 'pump') setPumpError('Không thể lưu tự động hóa bơm.');
      else if (device === 'fan') setFanError('Không thể lưu tự động hóa quạt.');
      else setLightError('Không thể lưu tự động hóa đèn.');
    } finally {
      setRuleSaving(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.page}>
        {isDesktop ? renderSidebar() : null}

        <View style={styles.mainArea}>
          <View style={[styles.topBar, !isDesktop && styles.mobileTopBar]}>
            <View style={[styles.topBarTitleBlock, !isDesktop && styles.mobileTitleWrap]}>
              <Text style={[styles.screenTitle, !isDesktop && styles.mobilePageTitle]}>Tự động hóa</Text>
              <Text style={styles.headerSubText}>Ngưỡng & lịch hàng ngày</Text>
            </View>
            <View style={styles.topBarRight}>
              <MobileHeaderMenu
                userName={userName}
                userEmail={userEmail}
                onLogout={async () => {
                  await clearTokens();
                  router.replace('/');
                }}
              />
            </View>
          </View>

          <ScrollView style={styles.mainScroll} contentContainerStyle={styles.content}>
            {loading ? <ActivityIndicator size="large" color={ACCENT} style={{ marginTop: 24 }} /> : null}
            {error ? <Text style={styles.errorBanner}>{error}</Text> : null}
            {!loading ? (
              <>
                <ThresholdEditor
                  title="Tự động hóa bơm"
                  description="Tự động điều khiển bơm theo độ ẩm đất."
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
                      [key]: current[key].map((item, index) =>
                        index === 0 ? { ...item, [field]: value } : item
                      ),
                    }))
                  }
                  onPayloadChange={(field, value) =>
                    updateRuleState('pump', (current) => ({ ...current, [field]: value }))
                  }
                  onAddSchedule={() =>
                    updateRuleState('pump', (current) => ({
                      ...current,
                      schedules: [
                        ...current.schedules,
                        { time: '08:00', action: 'ON', enabled: true },
                      ],
                    }))
                  }
                  onRemoveSchedule={(index) =>
                    updateRuleState('pump', (current) => ({
                      ...current,
                      schedules: current.schedules.filter((_, i) => i !== index),
                    }))
                  }
                  onScheduleChange={(index, patch) =>
                    updateRuleState('pump', (current) => {
                      const next = [...current.schedules];
                      next[index] = { ...next[index], ...patch };
                      return { ...current, schedules: next };
                    })
                  }
                  onSave={() => {
                    void saveRule('pump');
                  }}
                />

                <ThresholdEditor
                  title="Tự động hóa quạt"
                  description="Tự động điều khiển quạt theo nhiệt độ."
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
                      [key]: current[key].map((item, index) =>
                        index === 0 ? { ...item, [field]: value } : item
                      ),
                    }))
                  }
                  onPayloadChange={(field, value) =>
                    updateRuleState('fan', (current) => ({ ...current, [field]: value }))
                  }
                  onAddSchedule={() =>
                    updateRuleState('fan', (current) => ({
                      ...current,
                      schedules: [
                        ...current.schedules,
                        { time: '08:00', action: 'ON', enabled: true },
                      ],
                    }))
                  }
                  onRemoveSchedule={(index) =>
                    updateRuleState('fan', (current) => ({
                      ...current,
                      schedules: current.schedules.filter((_, i) => i !== index),
                    }))
                  }
                  onScheduleChange={(index, patch) =>
                    updateRuleState('fan', (current) => {
                      const next = [...current.schedules];
                      next[index] = { ...next[index], ...patch };
                      return { ...current, schedules: next };
                    })
                  }
                  onSave={() => {
                    void saveRule('fan');
                  }}
                />

                <ThresholdEditor
                  title="Tự động hóa đèn"
                  description="Tự động điều khiển đèn grow theo cường độ ánh sáng."
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
                      [key]: current[key].map((item, index) =>
                        index === 0 ? { ...item, [field]: value } : item
                      ),
                    }))
                  }
                  onPayloadChange={(field, value) =>
                    updateRuleState('light', (current) => ({ ...current, [field]: value }))
                  }
                  onAddSchedule={() =>
                    updateRuleState('light', (current) => ({
                      ...current,
                      schedules: [
                        ...current.schedules,
                        { time: '08:00', action: 'ON', enabled: true },
                      ],
                    }))
                  }
                  onRemoveSchedule={(index) =>
                    updateRuleState('light', (current) => ({
                      ...current,
                      schedules: current.schedules.filter((_, i) => i !== index),
                    }))
                  }
                  onScheduleChange={(index, patch) =>
                    updateRuleState('light', (current) => {
                      const next = [...current.schedules];
                      next[index] = { ...next[index], ...patch };
                      return { ...current, schedules: next };
                    })
                  }
                  onSave={() => {
                    void saveRule('light');
                  }}
                />
                <View style={{ marginTop: 8 }}>
                  <Pressable
                    onPress={() => {
                      void saveRule('pump');
                      void saveRule('fan');
                      void saveRule('light');
                    }}
                    disabled={ruleSaving !== null}
                    style={[
                      styles.saveButton,
                      ruleSaving !== null && styles.saveButtonDisabled,
                      { borderRadius: 999, height: 50, backgroundColor: ACCENT },
                    ]}
                  >
                    {ruleSaving !== null ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={[styles.saveButtonText, { fontSize: 16 }]}>Lưu tất cả tự động hóa</Text>
                    )}
                  </Pressable>
                </View>
              </>
            ) : null}
          </ScrollView>
        </View>
      </View>
      {!isDesktop ? <BottomNav activeKey="automation" /> : null}
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
    flexDirection: 'row',
    backgroundColor: PAGE_BG,
  },
  sidebar: {
    width: 240,
    backgroundColor: PANEL_BG,
    borderRightWidth: 1,
    borderRightColor: PANEL_BORDER,
    paddingVertical: 0,
    justifyContent: 'space-between',
  },
  brandRow: {
    height: 94,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
  },
  brandLogo: {
    width: 48,
    height: 48,
  },
  brandText: {
    fontSize: 26,
    fontWeight: '800',
    color: TEXT_PRIMARY,
  },
  sidebarDivider: {
    height: 1,
    backgroundColor: PANEL_BORDER,
  },
  navList: {
    marginTop: 66,
  },
  navItem: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    paddingHorizontal: 16,
  },
  navItemActive: {
    backgroundColor: ACCENT_GREEN,
  },
  navText: {
    fontSize: 20,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  navTextActive: {
    color: TEXT_PRIMARY,
  },
  mainArea: {
    flex: 1,
  },
  topBar: {
    minHeight: 64,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: PANEL_BG,
    borderBottomWidth: 1,
    borderBottomColor: PANEL_BORDER,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mobileTopBar: {
    paddingHorizontal: 18,
    alignItems: 'flex-start',
  },
  topBarTitleBlock: {
    flex: 1,
    minWidth: 0,
    marginRight: 12,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mobileTitleWrap: {
    gap: 2,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  mobilePageTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  headerSubText: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    marginTop: 2,
  },
  mainScroll: {
    flex: 1,
  },
  errorBanner: {
    borderRadius: 16,
    backgroundColor: ERROR_BG,
    color: ERROR_TEXT,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '700',
    marginHorizontal: 16,
    marginTop: 12,
  },
  content: {
    padding: 16,
    paddingBottom: 100,
    gap: 16,
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
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PANEL_BORDER,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
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
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  scheduleActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  scheduleTimeInput: {
    width: 110,
  },
  addScheduleButton: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PANEL_BORDER,
    backgroundColor: '#ffffff',
    alignItems: 'center',
  },
  addScheduleButtonText: {
    color: TEXT_PRIMARY,
    fontWeight: '700',
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    color: ERROR,
    fontSize: 18,
    lineHeight: 18,
    fontWeight: '700',
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
