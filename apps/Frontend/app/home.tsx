import { MobileHeaderMenu } from '../components/MobileHeaderMenu';
import { BottomNav } from '../components/BottomNav';
import { Feather, FontAwesome6, Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { useTelemetryRealtime } from '../hooks/useTelemetryRealtime';
import {
  getAlertsLive,
  getDashboard,
  getManagedDevices,
  getQuickStatsLive,
  getUser,
  mergeStatItemsFromTelemetry,
  toggleManagedDeviceAutoMode,
  updateManagedDevicePower,
  type ManagedDevice,
  type TelemetryRealtimeEvent,
} from '../services/api';
import { clearTokens, getTokens } from '../services/auth';
import type { AlertItem, DashboardData, DashboardNavKey, NavKey } from '../types/dashboard';
import { setHomeAlertCount } from '../utils/homeAlertBadge';
import {
  ALERT_SEVERITY_COLORS,
  formatAlertLevelLabel,
  formatStatPlaceholder,
  formatStatValueParts,
  isStatValueEmpty,
  resolveAlertSeverity,
  translateDeviceMode,
  translateStatLabel,
  translateConnectionStatus,
} from '../utils/presentation';

const PAGE_BG = '#e5e5e5';
const PANEL_BG = '#ffffff';
const PANEL_BORDER = '#d2d2d2';
const ACCENT = '#160f9b';
const ACCENT_GREEN = '#28f464';
const TEXT_PRIMARY = '#050505';
const TEXT_SECONDARY = '#555555';
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

function alertIcon(severity: ReturnType<typeof resolveAlertSeverity>) {
  if (severity === 'high') return '⚠';
  if (severity === 'low') return '↓';
  return '✓';
}

function displayHomeTitle(title?: string) {
  if (!title || title === 'Home - Dashboards') {
    return 'Trang chủ';
  }
  return title;
}

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  const isDesktop = width >= 960;
  const isTablet = width >= 640;
  const statsPerRow = isDesktop ? 4 : 2;
  const statWidth = isDesktop
    ? 172
    : (`${100 / statsPerRow - (statsPerRow > 1 ? 2 : 0)}%` as const);

  const [dashboard, setDashboard] = useState<Record<DashboardNavKey, DashboardData> | null>(null);
  const [managedDevices, setManagedDevices] = useState<ManagedDevice[]>([]);
  const [userName, setUserName] = useState('Người dùng');
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

  const refreshAlerts = useCallback(async () => {
    const alerts = await getAlertsLive(40);
    setHomeAlertCount(alerts.length);
    setDashboard((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        home: {
          ...prev.home,
          alerts,
        },
      };
    });
  }, []);

  const refreshLiveHome = useCallback(async () => {
    const [stats, alerts] = await Promise.all([getQuickStatsLive(), getAlertsLive(40)]);
    setHomeAlertCount(alerts.length);

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

  const alertRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const scheduleAlertsRefresh = useCallback(() => {
    if (alertRefreshTimerRef.current) {
      clearTimeout(alertRefreshTimerRef.current);
    }
    alertRefreshTimerRef.current = setTimeout(() => {
      void refreshAlerts();
    }, 800);
  }, [refreshAlerts]);

  const handleTelemetryEvent = useCallback(
    (event: TelemetryRealtimeEvent) => {
      setDashboard((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          home: {
            ...prev.home,
            stats: mergeStatItemsFromTelemetry(prev.home.stats, event),
          },
        };
      });

      if (event.thresholdLevel === 'low' || event.thresholdLevel === 'high') {
        scheduleAlertsRefresh();
      }
    },
    [scheduleAlertsRefresh]
  );

  useTelemetryRealtime(!bootstrapPending && dashboard !== null, handleTelemetryEvent);

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
        setUserName(profile.displayName || 'Người dùng');
        setUserEmail(profile.email);

        await Promise.allSettled([refreshLiveHome(), refreshManagedDevices()]);
        if (!cancelled) {
          setErrorMessage(null);
        }
      } catch (error) {
        console.log('Initial home load failed', error);
        if (!cancelled) {
          setErrorMessage('Một số dữ liệu bảng điều khiển không khả dụng.');
        }
      } finally {
        if (!cancelled) {
          setBootstrapPending(false);
        }
      }

      if (!cancelled) {
        pollTimer = setInterval(() => {
          void refreshManagedDevices();
        }, 10_000);
      }
    })();

    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
      if (alertRefreshTimerRef.current) {
        clearTimeout(alertRefreshTimerRef.current);
      }
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
        setErrorMessage('Không thể gửi lệnh thiết bị ngay lúc này.');
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
        setErrorMessage('Không thể cập nhật chế độ tự động ngay lúc này.');
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
          <Text style={styles.errorBanner}>Không thể tải bảng điều khiển.</Text>
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
    if (key === 'home') return;
    router.push(`/${key}`);
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
                <Feather name={item.icon} size={22} color={TEXT_PRIMARY} />
                <Text style={[styles.navText, isActive && styles.navTextActive]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <UserMenu userName={userName} userEmail={userEmail} />
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.page}>
        {isDesktop ? renderSidebar() : null}

        <View style={styles.mainArea}>
          <View style={[styles.topBar, !isDesktop && styles.mobileTopBar]}>
            <View style={[styles.topBarTitleRow, !isDesktop && styles.mobileTitleWrap]}>
              <Text style={[styles.pageTitle, !isDesktop && styles.mobilePageTitle]}>
                {displayHomeTitle(activeData.title)}
              </Text>
              {!isDesktop ? <Text style={styles.headerGreeting}>Xin chào, {userName}</Text> : null}
              {bootstrapPending ? <ActivityIndicator size="small" color={ACCENT} /> : null}
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

          <ScrollView
            style={styles.container}
            contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]}
          >
            {errorMessage ? <Text style={styles.errorBanner}>{errorMessage}</Text> : null}

            <Text style={styles.sectionTitle}>Thống kê nhanh</Text>
            <View style={[styles.statsGrid, !isDesktop && styles.mobileStatsGrid]}>
              {activeData.stats.map((item) => {
                const empty = isStatValueEmpty(item.value);
                const valueParts = empty ? null : formatStatValueParts(item.label, item.value);
                return (
                  <View
                    key={item.label}
                    style={[
                      styles.statCard,
                      !isDesktop && styles.mobileStatCard,
                      { width: statWidth },
                    ]}
                  >
                    <Text
                      style={[styles.statLabel, !isDesktop && styles.mobileStatLabel]}
                      numberOfLines={1}
                    >
                      {translateStatLabel(item.label)}
                    </Text>
                    <Ionicons
                      name={item.icon as never}
                      size={isDesktop ? 46 : 32}
                      color={TEXT_PRIMARY}
                    />
                    <View style={[styles.statValueSlot, !isDesktop && styles.mobileStatValueSlot]}>
                      {empty ? (
                        <Text
                          style={[
                            styles.statPlaceholder,
                            !isDesktop && styles.mobileStatPlaceholder,
                          ]}
                        >
                          {formatStatPlaceholder(item.label)}
                        </Text>
                      ) : (
                        <View style={styles.statValueRow}>
                          <Text style={[styles.statValue, !isDesktop && styles.mobileStatValue]}>
                            {valueParts?.main ?? item.value}
                          </Text>
                          {valueParts?.unit ? (
                            <Text style={[styles.statValueUnit, !isDesktop && styles.mobileStatValueUnit]}>
                              {valueParts.unit}
                            </Text>
                          ) : null}
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>

            <View style={[styles.sectionRow, !isTablet && styles.sectionRowStack]}>
              <View style={[styles.leftColumn, !isTablet && styles.columnFull]}>
                <Text style={styles.sectionTitle}>Điều khiển nhanh</Text>

                <View style={[styles.panel, !isDesktop && styles.mobilePanel]}>
                  {pagedControls.length === 0 ? (
                    <Text style={styles.emptyText}>Không có thiết bị được quản lý.</Text>
                  ) : null}

                  {pagedControls.map((item, index) => (
                    <View
                      key={item.id}
                      style={[
                        styles.controlRow,
                        !isDesktop && styles.mobileControlRow,
                        isDesktop && index !== pagedControls.length - 1 && styles.rowDivider,
                      ]}
                    >
                      <View style={styles.controlLeft}>
                        <View style={[styles.deviceIcon, !isDesktop && styles.mobileDeviceIcon]}>
                          <DeviceIcon type={item.type} />
                        </View>

                        <View style={styles.controlTextWrap}>
                          <Text style={styles.controlName}>{item.name}</Text>
                          <Text style={styles.controlStateInline}>{translateConnectionStatus(item.state)}</Text>
                        </View>
                      </View>

                      <Pressable
                        onPress={() => void handleDeviceMode(item.id)}
                        disabled={bootstrapPending || pendingModeId === item.id}
                        style={[styles.modeButton, !isDesktop && styles.mobileModeButton]}
                      >
                        <Text style={styles.controlMode}>
                          {pendingModeId === item.id ? 'Đang cập nhật...' : translateDeviceMode(item.mode)}
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

              <View style={[styles.rightColumn, !isTablet && styles.columnFull]}>
                <Text style={styles.sectionTitle}>Nhật ký cảnh báo</Text>

                <View style={[styles.panel, !isDesktop && styles.mobilePanel]}>
                  {pagedAlerts.length === 0 ? (
                    <Text style={styles.emptyText}>Chưa có cảnh báo.</Text>
                  ) : null}

                  {pagedAlerts.map((item: AlertItem, index) => {
                    const severity = resolveAlertSeverity(item.level);
                    const colors = ALERT_SEVERITY_COLORS[severity];
                    const label = item.sensorLabel ?? item.text.split(' ')[0] ?? 'Cảm biến';
                    return (
                      <View
                        key={item.id}
                        style={[
                          styles.alertCard,
                          isDesktop ? styles.desktopAlertCard : styles.mobileAlertCard,
                          { backgroundColor: colors.bg, borderLeftColor: colors.accent },
                          isDesktop && index !== pagedAlerts.length - 1 && styles.rowDivider,
                        ]}
                      >
                        <View style={[styles.alertIconWrap, { backgroundColor: '#ffffff' }]}>
                          <Text style={[styles.alertIcon, { color: colors.accent }]}>
                            {alertIcon(severity)}
                          </Text>
                        </View>
                        <View style={styles.alertBody}>
                          <View style={styles.alertTitleRow}>
                            <Text style={styles.alertSensor} numberOfLines={1}>
                              {label}
                            </Text>
                            <Text style={styles.alertTime}>{item.time}</Text>
                          </View>
                          <View style={[styles.alertLevelBadge, { backgroundColor: colors.accent }]}>
                            <Text style={styles.alertLevelText}>{formatAlertLevelLabel(item.level)}</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}

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
      {!isDesktop ? <BottomNav activeKey="home" /> : null}
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
    width: 240,
    backgroundColor: PANEL_BG,
    borderRightWidth: 1,
    borderRightColor: PANEL_BORDER,
    paddingHorizontal: 0,
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
    borderRadius: 0,
    paddingHorizontal: 16,
  },
  navItemActive: {
    backgroundColor: ACCENT_GREEN,
  },
  navText: {
    fontSize: 18,
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
    height: 64,
    paddingHorizontal: 40,
    backgroundColor: PANEL_BG,
    borderBottomWidth: 1,
    borderBottomColor: PANEL_BORDER,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mobileTopBar: {
    height: 'auto',
    minHeight: 84,
    paddingHorizontal: 18,
    paddingVertical: 14,
    alignItems: 'flex-start',
  },
  topBarTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mobileTitleWrap: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 2,
    flex: 1,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  mobilePageTitle: {
    fontSize: 28,
    fontWeight: '800',
  },
  headerGreeting: {
    fontSize: 14,
    color: TEXT_SECONDARY,
  },
  timeWrap: {
    alignItems: 'flex-end',
  },
  mobileTimeWrap: {
    paddingTop: 3,
  },
  timeText: {
    fontSize: 16,
    fontWeight: '800',
    color: TEXT_PRIMARY,
  },
  dateText: {
    marginTop: 2,
    fontSize: 14,
    color: TEXT_SECONDARY,
  },
  mobileNav: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
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
    minHeight: 42,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  mobileNavItemActive: {
    backgroundColor: ACCENT_GREEN,
    borderColor: ACCENT_GREEN,
  },
  mobileNavText: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  mobileNavTextActive: {
    color: TEXT_PRIMARY,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 96,
    gap: 18,
  },
  contentDesktop: {
    paddingHorizontal: 48,
    paddingTop: 40,
  },
  errorBanner: {
    borderRadius: 4,
    backgroundColor: ERROR_BG,
    color: ERROR_TEXT,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '700',
  },
  sectionTitle: {
    paddingTop: 12,
    fontSize: 18,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 36,
  },
  mobileStatsGrid: {
    justifyContent: 'space-between',
    gap: 12,
  },
  statCard: {
    width: 172,
    height: 150,
    minWidth: 172,
    maxHeight: 150,
    borderRadius: 4,
    backgroundColor: PANEL_BG,
    borderWidth: 0,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'flex-start',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 2,
    elevation: 2,
  },
  mobileStatCard: {
    minWidth: 0,
    width: undefined,
    minHeight: 120,
    height: 120,
    maxHeight: 120,
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'flex-start',
    overflow: 'hidden',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 1,
  },
  statValueSlot: {
    flex: 1,
    width: '100%',
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileStatValueSlot: {
    minHeight: 44,
  },
  mobileStatLabel: {
    textAlign: 'center',
    fontSize: 11,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    textAlign: 'center',
    width: '100%',
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 2,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: TEXT_PRIMARY,
  },
  mobileStatValue: {
    fontSize: 26,
    lineHeight: 28,
  },
  statValueUnit: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 2,
  },
  mobileStatValueUnit: {
    fontSize: 14,
    marginBottom: 3,
  },
  statPlaceholder: {
    fontSize: 24,
    fontWeight: '800',
    color: '#9ca3af',
    textAlign: 'center',
  },
  mobileStatPlaceholder: {
    fontSize: 17,
    fontWeight: '700',
  },
  sectionRow: {
    flexDirection: 'row',
    gap: 122,
    flexWrap: 'wrap',
  },
  sectionRowStack: {
    flexDirection: 'column',
    gap: 18,
  },
  leftColumn: {
    width: 336,
  },
  rightColumn: {
    width: 336,
  },
  columnFull: {
    width: '100%',
  },
  panel: {
    borderRadius: 4,
    backgroundColor: PANEL_BG,
    borderWidth: 0,
    paddingHorizontal: 3,
    paddingVertical: 0,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  mobilePanel: {
    borderRadius: 20,
    paddingHorizontal: 0,
    paddingVertical: 0,
    backgroundColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
    gap: 10,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#d8d8d8',
  },
  controlRow: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  mobileControlRow: {
    minHeight: 86,
    borderRadius: 18,
    backgroundColor: PANEL_BG,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 1,
  },
  controlLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deviceIcon: {
    width: 54,
    height: 48,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  mobileDeviceIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#f4f7f4',
  },
  controlTextWrap: {
    flex: 1,
    gap: 2,
  },
  controlName: {
    fontSize: 16,
    fontWeight: '800',
    color: TEXT_PRIMARY,
  },
  controlStateInline: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    textTransform: 'capitalize',
  },
  modeButton: {
    minWidth: 68,
    alignItems: 'center',
  },
  mobileModeButton: {
    minHeight: 38,
    borderRadius: 999,
    backgroundColor: '#eef7ef',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  controlMode: {
    fontSize: 12,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    textTransform: 'capitalize',
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderLeftWidth: 4,
  },
  desktopAlertCard: {
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  mobileAlertCard: {
    minHeight: 64,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 1,
  },
  alertIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  alertIcon: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 18,
  },
  alertBody: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  alertTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  alertSensor: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  alertLevelBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  alertLevelText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ffffff',
  },
  alertTime: {
    flexShrink: 0,
    fontSize: 12,
    color: TEXT_SECONDARY,
  },
  panelPagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingTop: 12,
    paddingBottom: 8,
  },
  pageDot: {
    minWidth: 34,
    height: 34,
    borderRadius: 12,
    borderWidth: 0,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  pageDotActive: {
    backgroundColor: ACCENT_GREEN,
  },
  pageDotText: {
    fontSize: 13,
    fontWeight: '400',
    color: TEXT_PRIMARY,
  },
  pageDotTextActive: {
    color: TEXT_PRIMARY,
  },
  pageEllipsis: {
    fontSize: 16,
    color: TEXT_SECONDARY,
    paddingHorizontal: 4,
  },
  emptyText: {
    paddingVertical: 16,
    fontSize: 14,
    color: TEXT_SECONDARY,
  },
  topBarRight: {
    paddingTop: 12,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
});
