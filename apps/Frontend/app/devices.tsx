import { sidebarItems } from '../constants/navigation';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { UserMenu } from '../components/UserMenu';
import {
  getAutomationLogs,
  getAutomationRules,
  getManagedDevices,
  getDashboard,
  getUser,
  toggleManagedDeviceAutoMode,
  type AutomationLog,
  type AutomationRule,
  type ManagedDevice,
  updateManagedDevicePower,
} from '../services/api';
import { getTokens } from '../services/auth';
import type { NavKey } from '../types/dashboard';

const ACCENT_GREEN = '#22ff66';
const PAGE_BG = '#e5e5e5';

const activeNav: NavKey = 'devices';

function CustomSwitch({
  value,
  onValueChange,
  disabled,
}: {
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Switch
      trackColor={{ false: '#767577', true: '#bfdbfe' }}
      thumbColor={value ? '#1d4ed8' : '#f4f3f4'}
      ios_backgroundColor="#3e3e3e"
      onValueChange={onValueChange}
      value={value}
      disabled={disabled}
      style={{ transform: [{ scaleX: 1.1 }, { scaleY: 1.1 }] }}
    />
  );
}

export default function DevicesScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 960;

  const [userName, setUserName] = useState('User');
  const [userEmail, setUserEmail] = useState<string | undefined>();
  const [devices, setDevices] = useState<ManagedDevice[]>([]);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pageTitle, setPageTitle] = useState('Devices - Dashboards');
  const [clock, setClock] = useState(() => new Date());

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
    (async () => {
      try {
        const profile = await getUser();
        const dashboard = await getDashboard();
        if (!cancelled) {
          setUserName(profile.displayName);
          setUserEmail(profile.email);
          setPageTitle(dashboard.devices.title);
        }
      } catch {
        if (!cancelled) setErrorMessage('Profile or page metadata is temporarily unavailable.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const tick = setInterval(() => setClock(new Date()), 30_000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [data, nextRules, nextLogs] = await Promise.all([
          getManagedDevices(),
          getAutomationRules().catch(() => []),
          getAutomationLogs().catch(() => []),
        ]);
        if (mounted) {
          setDevices(data);
          setRules(nextRules);
          setLogs(nextLogs);
          setErrorMessage(null);
        }
      } catch (error) {
        console.log('Failed to load devices', error);
        if (mounted) setErrorMessage('Unable to load devices right now.');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void load();
    const interval = setInterval(() => {
      void load();
    }, 10000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const filteredDevices = useMemo(
    () =>
      devices.filter(
        (device) =>
          device.name.toLowerCase().includes(search.toLowerCase()) ||
          device.id.toLowerCase().includes(search.toLowerCase())
      ),
    [devices, search]
  );

  const ruleByDeviceId = useMemo(
    () => new Map(rules.map((rule) => [rule.deviceId, rule])),
    [rules]
  );
  const latestLogByDeviceId = useMemo(
    () =>
      new Map(
        [...logs]
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .map((log) => [log.deviceId, log])
      ),
    [logs]
  );

  const formatSensorLabel = (sensorKey: AutomationRule['sensorKey']) => {
    if (sensorKey === 'soilMoisture') return 'soil moisture';
    if (sensorKey === 'temperature') return 'temperature';
    return 'light';
  };

  const formatRule = (rule?: AutomationRule) => {
    if (!rule) return 'No automation rule configured yet.';
    return `${formatSensorLabel(rule.sensorKey)}: ON when value ${rule.turnOnWhen.operator} ${rule.turnOnWhen.value}, OFF when value ${rule.turnOffWhen.operator} ${rule.turnOffWhen.value}`;
  };

  const formatAutoLog = (log?: AutomationLog) => {
    if (!log) return 'No auto action yet.';
    const time = new Date(log.createdAt).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
    return `${time}: auto sent ${log.action} (${log.status}) because ${log.reason}`;
  };

  const formatPowerState = (value: boolean | null) => {
    if (value === null) return 'Unknown';
    return value ? 'ON' : 'OFF';
  };

  const formatRelativeTime = (value: string | null) => {
    if (!value) return '—';
    return new Date(value).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatCommandStatus = (device: ManagedDevice) => {
    if (device.lastCommandStatus === 'acked') {
      return 'Hardware confirmed';
    }
    if (device.lastCommandStatus === 'timeout') {
      return 'Command timeout';
    }
    if (device.lastCommandStatus === 'failed') {
      return 'Backend rejected';
    }
    if (device.lastCommandStatus === 'sent') {
      return 'Backend accepted • Waiting for hardware';
    }
    if (device.lastCommandAt) {
      return 'Backend accepted';
    }
    return 'No recent command';
  };

  const handleToggleAutoMode = async (id: string) => {
    const snapshot = devices.map((device) => ({ ...device }));
    setDevices((current) =>
      current.map((device) =>
        device.id === id ? { ...device, autoMode: !device.autoMode } : device
      )
    );
    try {
      await toggleManagedDeviceAutoMode(id);
      const [next, nextRules, nextLogs] = await Promise.all([
        getManagedDevices(),
        getAutomationRules().catch(() => rules),
        getAutomationLogs().catch(() => logs),
      ]);
      setDevices(next);
      setRules(nextRules);
      setLogs(nextLogs);
      setErrorMessage(null);
    } catch (error) {
      console.log('Failed to update auto mode', error);
      setDevices(snapshot);
      setErrorMessage('Unable to update auto mode right now.');
    }
  };

  const handleTogglePower = async (id: string, currentValue: boolean) => {
    const nextValue = !currentValue;
    setPendingId(id);
    setDevices((current) =>
      current.map((device) =>
        device.id === id
          ? {
              ...device,
              power: nextValue,
              desiredPower: nextValue,
              lastCommandStatus: 'sent',
              lastCommandAt: new Date().toISOString(),
            }
          : device
      )
    );

    try {
      await updateManagedDevicePower(id, nextValue ? 'ON' : 'OFF');
      const [nextDevices, nextLogs] = await Promise.all([
        getManagedDevices(),
        getAutomationLogs().catch(() => logs),
      ]);
      setDevices(nextDevices);
      setLogs(nextLogs);
      setErrorMessage(null);
    } catch (error) {
      console.log('Failed to update power', error);
      setDevices((current) =>
        current.map((device) => (device.id === id ? { ...device, power: currentValue } : device))
      );
      setErrorMessage('Unable to update power right now.');
    } finally {
      setPendingId(null);
    }
  };

  const handleNavPress = (key: NavKey) => {
    if (key === 'home') {
      router.push('/home');
      return;
    }
    if (key === 'analytics') {
      router.push('/analytics');
      return;
    }
    router.push('/devices');
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
            const isActive = item.key === activeNav;
            return (
              <Pressable
                key={item.key}
                onPress={() => handleNavPress(item.key)}
                style={[styles.navItem, isActive && styles.navItemActive]}
              >
                <Feather name={item.icon} size={20} color={isActive ? '#ffffff' : '#111111'} />
                <Text style={[styles.navText, isActive && styles.navTextActive]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <UserMenu userName={userName} userEmail={userEmail} />
    </View>
  );

  const renderMobileNav = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.mobileNav}
    >
      {sidebarItems.map((item) => {
        const isActive = item.key === activeNav;
        return (
          <Pressable
            key={item.key}
            onPress={() => handleNavPress(item.key)}
            style={[styles.mobileNavItem, isActive && styles.mobileNavItemActive]}
          >
            <Feather name={item.icon} size={16} color={isActive ? '#ffffff' : '#111111'} />
            <Text style={[styles.mobileNavText, isActive && styles.mobileNavTextActive]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.page}>
        {isDesktop ? renderSidebar() : null}

        <View style={styles.mainArea}>
          <View style={styles.topBar}>
            <Text style={styles.pageTitle}>{pageTitle}</Text>
            <View style={styles.timeWrap}>
              <Text style={styles.timeText}>
                {clock.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
              </Text>
              <Text style={styles.dateText}>
                {clock.toLocaleDateString(undefined, {
                  day: '2-digit',
                  month: '2-digit',
                  year: '2-digit',
                })}
              </Text>
            </View>
          </View>

          {!isDesktop ? renderMobileNav() : null}

          <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {errorMessage ? <Text style={styles.errorBanner}>{errorMessage}</Text> : null}
            <Text style={styles.introText}>Search and control connected farm devices.</Text>
            <Text style={styles.helperNote}>
              Switches follow backend desired state. Hardware confirmation is shown separately below
              each device.
            </Text>

            <View style={styles.topBarRow}>
              <View style={styles.dropdown}>
                <Text style={styles.dropdownText}>All</Text>
                <Ionicons name="chevron-down" size={16} color="#000000" />
              </View>

              <View style={styles.searchContainer}>
                <Ionicons
                  name="options-outline"
                  size={20}
                  color="#9ca3af"
                  style={styles.filterIcon}
                />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search"
                  value={search}
                  onChangeText={setSearch}
                  placeholderTextColor="#93a0a7"
                />
                <View style={styles.searchButton}>
                  <Ionicons name="search" size={20} color="#000000" />
                </View>
              </View>
            </View>

            <View style={styles.panel}>
              <View style={styles.tableHeader}>
                <Text style={[styles.headerCell, { flex: 0.8 }]}>ID</Text>
                <Text style={[styles.headerCell, { flex: 2 }]}>Device name</Text>
                <Text style={[styles.headerCell, styles.headerCellCentered]}>Auto mode</Text>
                <Text style={[styles.headerCell, styles.headerCellCentered]}>Power</Text>
              </View>

              {loading ? (
                <View style={styles.loadingWrap}>
                  <ActivityIndicator size="large" color="#22c55e" />
                </View>
              ) : (
                filteredDevices.map((item, index) => (
                  <View
                    key={item.id}
                    style={[
                      styles.tableRow,
                      index !== filteredDevices.length - 1 && styles.separator,
                    ]}
                  >
                    <Text style={[styles.cell, { flex: 0.8 }]}>{item.id}</Text>
                    <View style={{ flex: 2, paddingRight: 12 }}>
                      <Text style={styles.cell}>{item.name}</Text>
                      <Text style={styles.metaText}>
                        Auto mode will control this device based on sensor thresholds.
                      </Text>
                      <Text style={styles.metaText}>{formatRule(ruleByDeviceId.get(item.id))}</Text>
                      <Text style={styles.metaText}>
                        {formatAutoLog(latestLogByDeviceId.get(item.id))}
                      </Text>
                      <Text style={styles.metaText}>
                        Desired power: {formatPowerState(item.desiredPower)} | Actual power:{' '}
                        {formatPowerState(item.actualPower)}
                      </Text>
                      <Text style={styles.metaText}>
                        Command state: {formatCommandStatus(item)}
                      </Text>
                      <Text style={styles.metaText}>
                        Last command: {formatRelativeTime(item.lastCommandAt)} | Last ACK:{' '}
                        {formatRelativeTime(item.lastAckAt)}
                      </Text>
                      <Text style={styles.metaText}>
                        Connection: {item.connectionStatus} | Last seen:{' '}
                        {formatRelativeTime(item.lastSeenAt)}
                      </Text>
                    </View>
                    <View style={[styles.cellWrap, { flex: 1 }]}>
                      <CustomSwitch
                        value={item.autoMode}
                        disabled={!ruleByDeviceId.has(item.id)}
                        onValueChange={() => {
                          void handleToggleAutoMode(item.id);
                        }}
                      />
                    </View>
                    <View style={[styles.cellWrap, { flex: 1 }]}>
                      <View style={styles.powerWrap}>
                        <CustomSwitch
                          value={item.desiredPower}
                          onValueChange={() => {
                            void handleTogglePower(item.id, item.desiredPower);
                          }}
                        />
                        {pendingId === item.id ? (
                          <ActivityIndicator size="small" color="#1d4ed8" />
                        ) : null}
                      </View>
                    </View>
                  </View>
                ))
              )}

              {!loading && filteredDevices.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyText}>No devices match your search.</Text>
                </View>
              ) : null}
            </View>
          </ScrollView>
        </View>
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
    flexDirection: 'row',
    backgroundColor: PAGE_BG,
  },
  sidebar: {
    width: 176,
    backgroundColor: '#ffffff',
    borderRightWidth: 1,
    borderRightColor: '#d5d5d5',
    justifyContent: 'space-between',
  },
  brandRow: {
    height: 70,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 10,
  },
  brandLogo: {
    width: 38,
    height: 38,
  },
  brandText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111111',
  },
  sidebarDivider: {
    height: 1,
    backgroundColor: '#d5d5d5',
  },
  navList: {
    paddingTop: 54,
  },
  navItem: {
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 10,
  },
  navItemActive: {
    backgroundColor: ACCENT_GREEN,
  },
  navText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111111',
  },
  navTextActive: {
    fontWeight: '700',
    color: '#ffffff',
  },
  mainArea: {
    flex: 1,
  },
  topBar: {
    minHeight: 52,
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#d5d5d5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  pageTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111111',
  },
  timeWrap: {
    alignItems: 'flex-end',
  },
  timeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111111',
  },
  dateText: {
    marginTop: 2,
    fontSize: 11,
    color: '#505050',
  },
  mobileNav: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    backgroundColor: PAGE_BG,
    borderBottomWidth: 1,
    borderBottomColor: '#d5d5d5',
  },
  mobileNavItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d9d9d9',
  },
  mobileNavItemActive: {
    backgroundColor: ACCENT_GREEN,
  },
  mobileNavText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111111',
  },
  mobileNavTextActive: {
    color: '#ffffff',
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 28,
  },
  introText: {
    fontSize: 14,
    color: '#505050',
    marginBottom: 6,
  },
  helperNote: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 18,
  },
  topBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 18,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
  },
  dropdownText: {
    marginRight: 8,
    fontSize: 14,
    color: '#111827',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 260,
    maxWidth: 460,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  filterIcon: {
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 14,
    color: '#111827',
  },
  searchButton: {
    backgroundColor: ACCENT_GREEN,
    paddingHorizontal: 16,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  panel: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: ACCENT_GREEN,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  headerCell: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111111',
  },
  headerCellCentered: {
    flex: 1,
    textAlign: 'center',
  },
  loadingWrap: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  cell: {
    fontSize: 14,
    color: '#111827',
  },
  metaText: {
    marginTop: 2,
    fontSize: 11,
    color: '#6b7280',
  },
  cellWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  powerWrap: {
    minHeight: 32,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  separator: {
    borderBottomWidth: 1,
    borderBottomColor: '#d9d9d9',
  },
  emptyWrap: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
  },
  errorBanner: {
    marginBottom: 16,
    borderRadius: 10,
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
  },
});
