import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { MobileHeaderMenu } from '@/components/MobileHeaderMenu';
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

import { Toggle } from '../components/Toggle';
import { UserMenu } from '../components/UserMenu';
import { sidebarItems } from '../constants/navigation';
import {
  getDashboard,
  getManagedDevices,
  getUser,
  toggleManagedDeviceAutoMode,
  updateManagedDevicePower,
  type ManagedDevice,
} from '../services/api';
import { clearTokens, getTokens } from '../services/auth';
import type { NavKey } from '../types/dashboard';
import { BottomNav } from '../components/BottomNav';

function deviceStatusLabel(status: ManagedDevice['connectionStatus']) {
  return status === 'online' ? 'Trực tuyến' : 'Ngoại tuyến';
}

function deviceIsOnline(status: ManagedDevice['connectionStatus']) {
  return status === 'online';
}
const PAGE_BG = '#e5e5e5';
const PANEL_BG = '#ffffff';
const PANEL_BORDER = '#d2d2d2';
const ACCENT = '#160f9b';
const ACCENT_GREEN = '#28f464';
const TEXT_PRIMARY = '#050505';
const TEXT_SECONDARY = '#555555';
const ERROR_BG = '#ffe4e6';
const ERROR_TEXT = '#be123c';

const rowsPerPage = 8;

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

function displayDevicesTitle(title?: string) {
  if (!title || title === 'Devices - Dashboards') {
    return 'Quản lý thiết bị';
  }
  return title;
}

function displayMobileDevicesTitle(title: string) {
  if (title === 'Quản lý thiết bị') {
    return 'Thiết bị';
  }
  return title;
}

function DeviceIcon({ id }: { id: string }) {
  if (id === 'pump') {
    return <Feather name="droplet" size={22} color={TEXT_PRIMARY} />;
  }
  if (id === 'fan') {
    return <Feather name="wind" size={22} color={TEXT_PRIMARY} />;
  }
  if (id === 'speaker') {
    return <Feather name="volume-2" size={22} color={TEXT_PRIMARY} />;
  }
  return <Feather name="sun" size={22} color={TEXT_PRIMARY} />;
}

export default function DevicesScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 960;

  const [devices, setDevices] = useState<ManagedDevice[]>([]);
  const [pageTitle, setPageTitle] = useState('Quản lý thiết bị');
  const [userName, setUserName] = useState('Người dùng');
  const [userEmail, setUserEmail] = useState<string | undefined>();
  const [search, setSearch] = useState('');
  const [devicePage, setDevicePage] = useState(1);
  const [clock, setClock] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [pendingPowerId, setPendingPowerId] = useState<string | null>(null);
  const [pendingModeId, setPendingModeId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | undefined;

    async function load() {
      try {
        const [dashboard, managedDevices, profile] = await Promise.all([
          getDashboard(),
          getManagedDevices(),
          getUser(),
        ]);

        if (cancelled) return;

        setPageTitle(displayDevicesTitle(dashboard.devices?.title));
        setDevices(managedDevices);
        setUserName(profile.displayName || 'Người dùng');
        setUserEmail(profile.email);
        setErrorMessage(null);
      } catch (error) {
        console.log('Devices screen load failed', error);
        if (!cancelled) {
          setErrorMessage('Không thể tải dữ liệu thiết bị.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    pollTimer = setInterval(() => {
      void (async () => {
        try {
          const managedDevices = await getManagedDevices();
          if (!cancelled) {
            setDevices(managedDevices);
          }
        } catch {}
      })();
    }, 8000);

    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
    };
  }, []);

  const showDeviceFilters = devices.length > 5;

  const filteredDevices = useMemo<ManagedDevice[]>(
    () =>
      devices.filter(
        (device: ManagedDevice) =>
          device.name.toLowerCase().includes(search.toLowerCase()) ||
          device.id.toLowerCase().includes(search.toLowerCase())
      ),
    [devices, search]
  );

  useEffect(() => {
    setDevicePage(1);
  }, [search]);

  async function handlePower(deviceId: string, next: boolean) {
    const snapshot = [...devices];
    setPendingPowerId(deviceId);

    setDevices((current) =>
      current.map((device) => (device.id === deviceId ? { ...device, power: next } : device))
    );

    try {
      await updateManagedDevicePower(deviceId, next ? 'ON' : 'OFF');
      const refreshed = await getManagedDevices();
      setDevices(refreshed);
      setErrorMessage(null);
    } catch (error) {
      console.log('updateManagedDevicePower failed', error);
      setDevices(snapshot);
      setErrorMessage('Không thể gửi lệnh nguồn.');
    } finally {
      setPendingPowerId(null);
    }
  }

  async function handleAutoMode(deviceId: string) {
    const snapshot = [...devices];
    setPendingModeId(deviceId);

    setDevices((current) =>
      current.map((device) =>
        device.id === deviceId ? { ...device, autoMode: !device.autoMode } : device
      )
    );

    try {
      const updated = await toggleManagedDeviceAutoMode(deviceId);
      setDevices(updated);
      setErrorMessage(null);
    } catch (error) {
      console.log('toggleManagedDeviceAutoMode failed', error);
      setDevices(snapshot);
      setErrorMessage('Không thể cập nhật chế độ tự động.');
    } finally {
      setPendingModeId(null);
    }
  }

  const handleNavPress = (key: NavKey) => {
    if (key !== 'devices') {
      router.push(`/${key}`);
    }
  };

  const totalPages = Math.max(1, Math.ceil(filteredDevices.length / rowsPerPage));
  const safePage = Math.min(devicePage, totalPages);
  const pagedDevices = filteredDevices.slice(
    (safePage - 1) * rowsPerPage,
    (safePage - 1) * rowsPerPage + rowsPerPage
  );
  const pageItems = paginationItems(safePage, totalPages);

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
            const isActive = item.key === 'devices';
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.page}>
        {isDesktop ? renderSidebar() : null}

        <View style={styles.mainArea}>
          <View style={[styles.topBar, !isDesktop && styles.mobileTopBar]}>
            <View style={!isDesktop ? styles.mobileTitleWrap : undefined}>
              <Text style={[styles.pageTitle, !isDesktop && styles.mobilePageTitle]}>
                {isDesktop ? pageTitle : displayMobileDevicesTitle(pageTitle)}
              </Text>
              {!isDesktop ? (
                <Text style={styles.headerSubText}>
                  {filteredDevices.length} thiết bị
                </Text>
              ) : null}
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

            <View style={[styles.toolbar, !isDesktop && styles.mobileToolbar]}>
              {showDeviceFilters ? (
                <View style={[styles.filterButton, !isDesktop && styles.mobileFilterButton]}>
                  <Text style={styles.filterText}>Tất cả</Text>
                  <Feather name="chevron-down" size={16} color={TEXT_PRIMARY} />
                </View>
              ) : null}

              <View style={[styles.searchWrap, !isDesktop && styles.mobileSearchWrap, !showDeviceFilters && styles.searchWrapFull]}>
                <Feather name="sliders" size={18} color="#8b8b8b" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Tìm kiếm"
                  placeholderTextColor="#9a9a9a"
                  value={search}
                  onChangeText={setSearch}
                />
                <View style={styles.searchButton}>
                  <Feather name="search" size={28} color={TEXT_PRIMARY} />
                </View>
              </View>
            </View>

            {isDesktop ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.tablePanel}>
                  <View style={styles.tableHeader}>
                    <Text style={[styles.headerText, styles.idColumn]}>ID</Text>
                    <Text style={[styles.headerText, styles.nameColumn]}>Tên thiết bị</Text>
                    <Text style={[styles.headerText, styles.switchColumn]}>Tự động</Text>
                    <Text style={[styles.headerText, styles.switchColumn]}>Nguồn</Text>
                  </View>

                  {loading ? (
                    <View style={styles.loadingRow}>
                      <ActivityIndicator size="large" color={ACCENT} />
                    </View>
                  ) : null}

                  {!loading && pagedDevices.length === 0 ? (
                    <View style={styles.loadingRow}>
                      <Text style={styles.emptyText}>Không tìm thấy thiết bị.</Text>
                    </View>
                  ) : null}

                  {!loading
                    ? pagedDevices.map((item: ManagedDevice, index: number) => (
                        <View key={item.id} style={styles.tableRow}>
                          <Text style={[styles.cellText, styles.idColumn]}>
                            {(safePage - 1) * rowsPerPage + index}
                          </Text>
                          <Text style={[styles.cellText, styles.nameColumn]} numberOfLines={1}>
                            {item.name}
                          </Text>

                          <View style={[styles.switchColumn, styles.switchCell]}>
                            <Toggle
                              checked={item.autoMode}
                              loading={pendingModeId === item.id}
                              onChange={() => {
                                void handleAutoMode(item.id);
                              }}
                            />
                          </View>

                          <View style={[styles.switchColumn, styles.switchCell]}>
                            <Toggle
                              checked={item.power}
                              loading={pendingPowerId === item.id}
                              onChange={(next) => {
                                void handlePower(item.id, next);
                              }}
                            />
                          </View>
                        </View>
                      ))
                    : null}
                </View>
              </ScrollView>
            ) : (
              <View style={styles.deviceList}>
                {loading ? (
                  <View style={styles.mobileLoadingCard}>
                    <ActivityIndicator size="large" color={ACCENT} />
                  </View>
                ) : null}

                {!loading && pagedDevices.length === 0 ? (
                  <View style={styles.mobileLoadingCard}>
                    <Text style={styles.emptyText}>Không tìm thấy thiết bị.</Text>
                  </View>
                ) : null}

                {!loading
                  ? pagedDevices.map((item: ManagedDevice) => {
                      const online = deviceIsOnline(item.connectionStatus);
                      return (
                        <View key={item.id} style={styles.deviceCard}>
                          <View style={styles.deviceCardCompact}>
                            <View style={styles.deviceIdentity}>
                              <View style={styles.deviceIcon}>
                                <DeviceIcon id={item.id} />
                              </View>
                              <View style={styles.deviceTextWrap}>
                                <Text style={styles.deviceName} numberOfLines={1}>
                                  {item.name}
                                </Text>
                                <View style={styles.statusRow}>
                                  <View
                                    style={[
                                      styles.statusDot,
                                      online ? styles.statusDotOnline : styles.statusDotOffline,
                                    ]}
                                  />
                                  <Text style={styles.statusLabel}>
                                    {deviceStatusLabel(item.connectionStatus)}
                                  </Text>
                                </View>
                              </View>
                            </View>

                            <View style={styles.deviceToggleColumn}>
                              <View style={styles.toggleStack}>
                                <Text style={styles.toggleLabel}>Tự động</Text>
                                <Toggle
                                  checked={item.autoMode}
                                  loading={pendingModeId === item.id}
                                  onChange={() => {
                                    void handleAutoMode(item.id);
                                  }}
                                />
                              </View>
                              <View style={styles.toggleStack}>
                                <Text style={styles.toggleLabel}>Nguồn</Text>
                                <Toggle
                                  checked={item.power}
                                  loading={pendingPowerId === item.id}
                                  onChange={(next) => {
                                    void handlePower(item.id, next);
                                  }}
                                />
                              </View>
                            </View>
                          </View>
                        </View>
                      );
                    })
                  : null}
              </View>
            )}

            {totalPages > 1 ? (
              <View style={[styles.pagination, !isDesktop && styles.mobilePagination]}>
                {pageItems.map((entry, idx) =>
                  entry === 'ellipsis' ? (
                    <Text key={`d-el-${idx}`} style={styles.pageEllipsis}>
                      ...
                    </Text>
                  ) : (
                    <Pressable
                      key={`d-${entry}`}
                      onPress={() => setDevicePage(entry)}
                      style={[styles.pageDot, entry === safePage && styles.pageDotActive]}
                    >
                      <Text
                        style={[styles.pageDotText, entry === safePage && styles.pageDotTextActive]}
                      >
                        {entry}
                      </Text>
                    </Pressable>
                  )
                )}
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
      {!isDesktop ? <BottomNav activeKey="devices" /> : null}
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
    height: 64,
    paddingHorizontal: 56,
    backgroundColor: PANEL_BG,
    borderBottomWidth: 1,
    borderBottomColor: PANEL_BORDER,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mobileTopBar: {
    height: 'auto',
    minHeight: 84,
    paddingHorizontal: 18,
    paddingVertical: 14,
    alignItems: 'flex-start',
  },
  mobileTitleWrap: {
    flex: 1,
    gap: 2,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  mobilePageTitle: {
    fontSize: 28,
    fontWeight: '800',
  },
  headerSubText: {
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
    fontSize: 18,
    fontWeight: '800',
    color: TEXT_PRIMARY,
  },
  dateText: {
    marginTop: 2,
    fontSize: 16,
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
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 96,
    gap: 18,
  },
  contentDesktop: {
    paddingHorizontal: 100,
    paddingTop: 40,
  },
  errorBanner: {
    borderRadius: 16,
    backgroundColor: ERROR_BG,
    color: ERROR_TEXT,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '700',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  mobileToolbar: {
    alignItems: 'stretch',
    gap: 10,
  },
  filterButton: {
    height: 41,
    minWidth: 75,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#9c9c9c',
    backgroundColor: '#f4f4f4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  mobileFilterButton: {
    minHeight: 44,
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
  },
  filterText: {
    fontSize: 16,
    color: TEXT_PRIMARY,
  },
  searchWrap: {
    width: 400,
    maxWidth: '100%',
    height: 40,
    borderWidth: 1,
    borderColor: '#a4a4a4',
    borderRadius: 10,
    backgroundColor: PANEL_BG,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
  },
  mobileSearchWrap: {
    width: '100%',
    height: 50,
    borderRadius: 16,
    borderColor: '#d8d8d8',
  },
  searchInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 14,
    fontSize: 18,
    color: TEXT_PRIMARY,
  },
  searchButton: {
    width: 50,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT_GREEN,
  },
  tablePanel: {
    width: 1000,
    minHeight: 700,
    backgroundColor: PANEL_BG,
    borderWidth: 1,
    borderColor: '#d7d7d7',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  tablePanelCompact: {
    width: 760,
    minHeight: 520,
  },
  tableHeader: {
    height: 80,
    backgroundColor: ACCENT_GREEN,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  tableRow: {
    minHeight: 74,
    borderBottomWidth: 1,
    borderBottomColor: '#d2d2d2',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  headerText: {
    fontSize: 20,
    fontWeight: '400',
    color: TEXT_PRIMARY,
  },
  cellText: {
    fontSize: 22,
    fontWeight: '400',
    color: TEXT_PRIMARY,
  },
  idColumn: {
    width: 116,
  },
  nameColumn: {
    flex: 1,
  },
  switchColumn: {
    width: 200,
  },
  switchCell: {
    alignItems: 'center',
  },
  loadingRow: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: TEXT_SECONDARY,
  },
  deviceList: {
    gap: 8,
  },
  mobileLoadingCard: {
    minHeight: 160,
    borderRadius: 20,
    backgroundColor: PANEL_BG,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  deviceCard: {
    borderRadius: 16,
    backgroundColor: PANEL_BG,
    padding: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 1,
  },
  deviceCardCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  deviceCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  deviceIdentity: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deviceIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f4f7f4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '800',
    color: TEXT_PRIMARY,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  statusDotOnline: {
    backgroundColor: '#22c55e',
  },
  statusDotOffline: {
    backgroundColor: '#9ca3af',
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  deviceToggleColumn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  toggleStack: {
    alignItems: 'center',
    gap: 4,
  },
  toggleLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: TEXT_SECONDARY,
    textTransform: 'uppercase',
  },
  deviceMeta: {
    marginTop: 3,
    fontSize: 12,
    color: TEXT_SECONDARY,
  },
  deviceStatusLine: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  searchWrapFull: {
    flex: 1,
  },
  statusPill: {
    minHeight: 32,
    borderRadius: 999,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusOnline: {
    backgroundColor: '#e6f8e9',
  },
  statusOffline: {
    backgroundColor: '#f3f3f3',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    textTransform: 'capitalize',
  },
  mobileControls: {
    gap: 10,
  },
  mobileControlLine: {
    minHeight: 58,
    borderRadius: 16,
    backgroundColor: '#f8f8f8',
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  mobileControlTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: TEXT_PRIMARY,
  },
  mobileControlMeta: {
    marginTop: 2,
    fontSize: 12,
    color: TEXT_SECONDARY,
  },
  pagination: {
    width: 1000,
    maxWidth: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 18,
    paddingTop: 18,
    paddingRight: 10,
  },
  mobilePagination: {
    width: '100%',
    justifyContent: 'center',
    paddingRight: 0,
  },
  pageDot: {
    minWidth: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  pageDotActive: {
    backgroundColor: ACCENT_GREEN,
  },
  pageDotText: {
    fontSize: 16,
    fontWeight: '400',
    color: TEXT_PRIMARY,
  },
  pageDotTextActive: {
    color: TEXT_PRIMARY,
  },
  pageEllipsis: {
    fontSize: 16,
    color: TEXT_PRIMARY,
  },
  topBarRight: {
    paddingTop: 12,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
});
