import { Feather, FontAwesome6, Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Toggle } from '../components/Toggle';
import { UserMenu } from '../components/UserMenu';
import { sidebarItems } from '../constants/navigation';
import {
  getAlertsLive,
  getDashboard,
  getFeatures,
  getManagedDevices,
  getQuickStatsLive,
  getUser,
  toggleManagedDeviceAutoMode,
  type ManagedDevice,
  updateManagedDevicePower,
} from '../services/api';
import { getTokens } from '../services/auth';
import type { DashboardData, NavKey } from '../types/dashboard';

const PAGE_BG = '#e5e5e5';
const PANEL_BG = '#ffffff';
const PANEL_BORDER = '#d4d4d4';
const ACCENT = '#2f37ff';
const ACCENT_GREEN = '#22ff66';
const TEXT_PRIMARY = '#111111';
const TEXT_SECONDARY = '#5f5f5f';
const ERROR_BG = '#ffe4e6';
const ERROR_TEXT = '#be123c';

const alertsPerPage = 6;
const controlsPerPage = 5;

type DeviceType = 'fan' | 'pump' | 'speaker' | 'rgb' | 'light';
type DeviceState = 'online' | 'offline';

type HomeControlItem = {
  id: string;
  name: string;
  type: DeviceType;
  enabled: boolean;
  mode: 'auto' | 'manually';
  state: DeviceState;
};

function paginationItems(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages = new Set<number>([1, 2, 3, total - 1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);

  const output: (number | 'ellipsis')[] = [];
  for (let i = 0; i < sorted.length; i += 1) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
      output.push('ellipsis');
    }
    output.push(sorted[i]);
  }
  return output;
}

function DeviceIcon({ type }: { type: DeviceType }) {
  if (type === 'pump') {
    return <FontAwesome6 name="pump-soap" size={22} color={TEXT_PRIMARY} />;
  }
  if (type === 'fan') {
    return <Feather name="wind" size={22} color={TEXT_PRIMARY} />;
  }
  if (type === 'speaker') {
    return <Feather name="volume-2" size={22} color={TEXT_PRIMARY} />;
  }
  return <Feather name="sun" size={22} color={TEXT_PRIMARY} />;
}

function mapDevicesToControls(devices: ManagedDevice[]): HomeControlItem[] {
  return devices.map((device) => ({
    id: device.id,
    name: device.name,
    type: device.id === 'rgb' ? 'light' : (device.id as DeviceType),
    enabled: !!device.power,
    mode: device.autoMode ? 'auto' : 'manually',
    state: device.connectionStatus === 'online' ? 'online' : device.power ? 'online' : 'offline',
  }));
}

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  const isDesktop = width >= 960;
  const isTablet = width >= 640;
  const statsPerRow = isDesktop ? 4 : isTablet ? 2 : 1;
  const statWidth = `${100 / statsPerRow - (statsPerRow > 1 ? 2 : 0)}%` as const;

  const [dashboard, setDashboard] = useState<Record<NavKey, DashboardData> | null>(null);
  const [managedDevices, setManagedDevices] = useState<ManagedDevice[]>([]);
  const [userName, setUserName] = useState('User');
  const [userEmail, setUserEmail] = useState<string | undefined>();
  const [bootstrapPending, setBootstrapPending] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingPowerId, setPendingPowerId] = useState<string | null>(null);
  const [pendingModeId, setPendingModeId] = useState<string | null>(null);

  const [alertPage, setAlertPage] = useState(1);
  const [controlPage, setControlPage] = useState(1);
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
    const timer = setInterval(() => setClock(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const refreshLiveHome = useCallback(async () => {
    const [stats, alerts] = await Promise.all([getQuickStatsLive(), getAlertsLive(40)]);

    setDashboard((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        home: {
          ...prev.home,
          stats,
          alerts,
        },
      };
    });
  }, []);

  const refreshManagedDevices = useCallback(async () => {
    const devices = await getManagedDevices();
    setManagedDevices(devices);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | undefined;

    void (async () => {
      try {
        const [dash, profile] = await Promise.all([getDashboard(), getUser()]);

        if (cancelled) return;

        setDashboard(dash);
        setUserName(profile.displayName || 'User');
        setUserEmail(profile.email);

        await Promise.allSettled([refreshLiveHome(), refreshManagedDevices(), getFeatures()]);
      } catch (error) {
        console.log('Initial home load failed', error);
        if (!cancelled) {
          setErrorMessage('Some dashboard data is unavailable.');
        }
      } finally {
        if (!cancelled) {
          setBootstrapPending(false);
        }
      }

      if (!cancelled) {
        pollTimer = setInterval(() => {
          void Promise.allSettled([refreshLiveHome(), refreshManagedDevices()]);
        }, 10_000);
      }
    })();

    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [refreshLiveHome, refreshManagedDevices]);

  const handleDevicePower = useCallback(
    async (id: string, next: boolean) => {
      const snapshot = [...managedDevices];

      setManagedDevices((current) =>
        current.map((device) => (device.id === id ? { ...device, power: next } : device))
      );
      setPendingPowerId(id);

      try {
        await updateManagedDevicePower(id, next ? 'ON' : 'OFF');
        const refreshed = await getManagedDevices();
        setManagedDevices(refreshed);
        setErrorMessage(null);
      } catch (error) {
        console.log('updateManagedDevicePower failed', error);
        setManagedDevices(snapshot);
        setErrorMessage('Unable to send device command right now.');
      } finally {
        setPendingPowerId(null);
      }
    },
    [managedDevices]
  );

  const handleDeviceMode = useCallback(
    async (id: string) => {
      const snapshot = [...managedDevices];

      setManagedDevices((current) =>
        current.map((device) =>
          device.id === id ? { ...device, autoMode: !device.autoMode } : device
        )
      );
      setPendingModeId(id);

      try {
        const updated = await toggleManagedDeviceAutoMode(id);
        setManagedDevices(updated);
        setErrorMessage(null);
      } catch (error) {
        console.log('toggleManagedDeviceAutoMode failed', error);
        setManagedDevices(snapshot);
        setErrorMessage('Unable to update automation mode right now.');
      } finally {
        setPendingModeId(null);
      }
    },
    [managedDevices]
  );

  if (!dashboard && bootstrapPending) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.page, styles.centered]}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      </SafeAreaView>
    );
  }

  if (!dashboard) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.page, styles.centered, { padding: 24 }]}>
          <Text style={styles.errorBanner}>Unable to load dashboard.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const activeData = dashboard.home;
  const activeControls = mapDevicesToControls(managedDevices);

  const totalAlertPages = Math.max(1, Math.ceil(activeData.alerts.length / alertsPerPage));
  const totalControlPages = Math.max(1, Math.ceil(activeControls.length / controlsPerPage));

  const safeAlertPage = Math.min(alertPage, totalAlertPages);
  const safeControlPage = Math.min(controlPage, totalControlPages);

  const pagedAlerts = activeData.alerts.slice(
    (safeAlertPage - 1) * alertsPerPage,
    (safeAlertPage - 1) * alertsPerPage + alertsPerPage
  );

  const pagedControls = activeControls.slice(
    (safeControlPage - 1) * controlsPerPage,
    (safeControlPage - 1) * controlsPerPage + controlsPerPage
  );

  const alertPageItems = paginationItems(safeAlertPage, totalAlertPages);
  const controlPageItems = paginationItems(safeControlPage, totalControlPages);
  const handleNavPress = (key: NavKey) => {
    if (key === 'analytics' || key === 'devices') {
      router.push(`/${key}`);
      return;
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
            const isActive = item.key === 'home';
            return (
              <Pressable
                key={item.key}
                onPress={() => handleNavPress(item.key)}
                style={[styles.navItem, isActive && styles.navItemActive]}
              >
                <Feather name={item.icon} size={20} color={isActive ? '#ffffff' : TEXT_PRIMARY} />
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
        const isActive = item.key === 'home';
        return (
          <Pressable
            key={item.key}
            onPress={() => handleNavPress(item.key)}
            style={[styles.mobileNavItem, isActive && styles.mobileNavItemActive]}
          >
            <Feather name={item.icon} size={16} color={isActive ? '#ffffff' : TEXT_PRIMARY} />
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
            <View style={styles.topBarTitleRow}>
              <Text style={styles.pageTitle}>{activeData.title}</Text>
              {bootstrapPending ? <ActivityIndicator size="small" color={ACCENT} /> : null}
            </View>

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

          <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            {errorMessage ? <Text style={styles.errorBanner}>{errorMessage}</Text> : null}

            <Text style={styles.sectionTitle}>Quick Stats</Text>
            <View style={styles.statsGrid}>
              {activeData.stats.map((item) => (
                <View key={item.label} style={[styles.statCard, { width: statWidth }]}>
                  <Text style={styles.statLabel}>{item.label}</Text>
                  <Ionicons name={item.icon as never} size={46} color={TEXT_PRIMARY} />
                  <Text style={styles.statValue}>{item.value}</Text>
                </View>
              ))}
            </View>

            <View style={[styles.sectionRow, !isTablet && styles.sectionRowStack]}>
              <View style={styles.leftColumn}>
                <Text style={styles.sectionTitle}>Quick Control</Text>
                <Text style={styles.helperNote}>
                  Power toggle sends command API. Mode toggle updates device automation mode.
                </Text>

                <View style={styles.panel}>
                  {pagedControls.length === 0 ? (
                    <Text style={styles.emptyText}>No managed devices available.</Text>
                  ) : null}

                  {pagedControls.map((item, index) => (
                    <View
                      key={item.id}
                      style={[
                        styles.controlRow,
                        index !== pagedControls.length - 1 && styles.rowDivider,
                      ]}
                    >
                      <View style={styles.controlLeft}>
                        <View style={styles.deviceIcon}>
                          <DeviceIcon type={item.type} />
                        </View>

                        <View style={styles.controlTextWrap}>
                          <Text style={styles.controlNameLine}>
                            <Text style={styles.controlName}>{item.name}</Text>
                            <Text style={styles.controlStateInline}> {item.state}</Text>
                          </Text>
                        </View>
                      </View>

                      <Pressable
                        onPress={() => void handleDeviceMode(item.id)}
                        disabled={bootstrapPending || pendingModeId === item.id}
                        style={styles.modeButton}
                      >
                        <Text style={styles.controlMode}>
                          {pendingModeId === item.id ? 'updating...' : item.mode}
                        </Text>
                      </Pressable>

                      <Toggle
                        checked={item.enabled}
                        disabled={bootstrapPending}
                        loading={pendingPowerId === item.id}
                        onChange={(next) => {
                          void handleDevicePower(item.id, next);
                        }}
                      />
                    </View>
                  ))}

                  {totalControlPages > 1 ? (
                    <View style={styles.panelPagination}>
                      {controlPageItems.map((entry, idx) =>
                        entry === 'ellipsis' ? (
                          <Text key={`c-el-${idx}`} style={styles.pageEllipsis}>
                            ...
                          </Text>
                        ) : (
                          <Pressable
                            key={`c-${entry}`}
                            onPress={() => setControlPage(entry)}
                            style={[
                              styles.pageDot,
                              entry === safeControlPage && styles.pageDotActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.pageDotText,
                                entry === safeControlPage && styles.pageDotTextActive,
                              ]}
                            >
                              {entry}
                            </Text>
                          </Pressable>
                        )
                      )}
                    </View>
                  ) : null}
                </View>
              </View>

              <View style={styles.rightColumn}>
                <Text style={styles.sectionTitle}>Alert log</Text>

                <View style={styles.panel}>
                  {pagedAlerts.length === 0 ? (
                    <Text style={styles.emptyText}>No alerts yet.</Text>
                  ) : null}

                  {pagedAlerts.map((item, index) => (
                    <View
                      key={item.id}
                      style={[
                        styles.alertRow,
                        index !== pagedAlerts.length - 1 && styles.rowDivider,
                      ]}
                    >
                      <Text style={styles.alertText}>{item.text}</Text>
                      <Text style={styles.alertTime}>{item.time}</Text>
                    </View>
                  ))}

                  {totalAlertPages > 1 ? (
                    <View style={styles.panelPagination}>
                      {alertPageItems.map((entry, idx) =>
                        entry === 'ellipsis' ? (
                          <Text key={`a-el-${idx}`} style={styles.pageEllipsis}>
                            ...
                          </Text>
                        ) : (
                          <Pressable
                            key={`a-${entry}`}
                            onPress={() => setAlertPage(entry)}
                            style={[
                              styles.pageDot,
                              entry === safeAlertPage && styles.pageDotActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.pageDotText,
                                entry === safeAlertPage && styles.pageDotTextActive,
                              ]}
                            >
                              {entry}
                            </Text>
                          </Pressable>
                        )
                      )}
                    </View>
                  ) : null}
                </View>
              </View>
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
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidebar: {
    width: 270,
    backgroundColor: PANEL_BG,
    borderRightWidth: 1,
    borderRightColor: PANEL_BORDER,
    paddingHorizontal: 18,
    paddingVertical: 18,
    justifyContent: 'space-between',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandLogo: {
    width: 34,
    height: 34,
  },
  brandText: {
    fontSize: 22,
    fontWeight: '800',
    color: TEXT_PRIMARY,
  },
  sidebarDivider: {
    height: 1,
    backgroundColor: PANEL_BORDER,
    marginVertical: 18,
  },
  navList: {
    gap: 10,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  navItemActive: {
    backgroundColor: ACCENT,
  },
  navText: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  navTextActive: {
    color: '#ffffff',
  },
  mainArea: {
    flex: 1,
  },
  topBar: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topBarTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pageTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: TEXT_PRIMARY,
  },
  timeWrap: {
    alignItems: 'flex-end',
  },
  timeText: {
    fontSize: 18,
    fontWeight: '800',
    color: TEXT_PRIMARY,
  },
  dateText: {
    marginTop: 4,
    fontSize: 14,
    color: TEXT_SECONDARY,
  },
  mobileNav: {
    paddingHorizontal: 16,
    paddingBottom: 6,
    gap: 8,
  },
  mobileNavItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: PANEL_BORDER,
    backgroundColor: PANEL_BG,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  mobileNavItemActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  mobileNavText: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  mobileNavTextActive: {
    color: '#ffffff',
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 28,
    gap: 18,
  },
  errorBanner: {
    borderRadius: 14,
    backgroundColor: ERROR_BG,
    color: ERROR_TEXT,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    marginBottom: 8,
  },
  helperNote: {
    marginTop: -4,
    marginBottom: 10,
    fontSize: 13,
    color: TEXT_SECONDARY,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  statCard: {
    minWidth: 180,
    borderRadius: 22,
    backgroundColor: PANEL_BG,
    borderWidth: 1,
    borderColor: PANEL_BORDER,
    paddingHorizontal: 18,
    paddingVertical: 18,
    alignItems: 'center',
    gap: 10,
  },
  statLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_SECONDARY,
    textAlign: 'center',
  },
  statValue: {
    fontSize: 30,
    fontWeight: '800',
    color: ACCENT_GREEN,
  },
  sectionRow: {
    flexDirection: 'row',
    gap: 18,
  },
  sectionRowStack: {
    flexDirection: 'column',
  },
  leftColumn: {
    flex: 1.1,
  },
  rightColumn: {
    flex: 0.9,
  },
  panel: {
    borderRadius: 24,
    backgroundColor: PANEL_BG,
    borderWidth: 1,
    borderColor: PANEL_BORDER,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#ececec',
  },
  controlRow: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  controlLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deviceIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
  },
  controlTextWrap: {
    flex: 1,
  },
  controlNameLine: {
    flexWrap: 'wrap',
  },
  controlName: {
    fontSize: 16,
    fontWeight: '800',
    color: TEXT_PRIMARY,
  },
  controlStateInline: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    textTransform: 'capitalize',
  },
  modeButton: {
    minWidth: 84,
    alignItems: 'center',
  },
  controlMode: {
    fontSize: 14,
    fontWeight: '700',
    color: ACCENT,
    textTransform: 'capitalize',
  },
  alertRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    paddingVertical: 12,
  },
  alertText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  alertTime: {
    fontSize: 13,
    color: TEXT_SECONDARY,
  },
  panelPagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingTop: 14,
  },
  pageDot: {
    minWidth: 30,
    height: 30,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: PANEL_BORDER,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  pageDotActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  pageDotText: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  pageDotTextActive: {
    color: '#ffffff',
  },
  pageEllipsis: {
    fontSize: 16,
    color: TEXT_SECONDARY,
    paddingHorizontal: 4,
  },
  emptyText: {
    paddingVertical: 12,
    fontSize: 14,
    color: TEXT_SECONDARY,
  },
});
