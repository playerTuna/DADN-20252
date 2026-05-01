import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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
import { sidebarItems } from '../constants/navigation';
import { UserMenu } from '../components/UserMenu';
import { getDashboard, getTelemetryHistory, getUser, type TelemetryPoint } from '../services/api';
import { getTokens } from '../services/auth';
import type { NavKey } from '../types/dashboard';

const ACCENT_GREEN = '#22ff66';
const PAGE_BG = '#e5e5e5';
const CARD_BG = '#ffffff';
const BORDER = '#d9d9d9';
const ACTIVE = ACCENT_GREEN;

const TABS = [
  { label: 'Temperature', value: 'temp' },
  { label: 'Air Humidity', value: 'air_humidity' },
  { label: 'Soil Humidity', value: 'soil_humidity' },
  { label: 'Light Intensity', value: 'light' },
] as const;

type TabValue = (typeof TABS)[number]['value'];

const activeNav: NavKey = 'analytics';

function formatTimeLabel(iso: string) {
  const date = new Date(iso);
  return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
}

export default function AnalyticsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 960;
  const chartWidth = Math.min(Math.max(width - (isDesktop ? 176 + 72 : 72), 280), 980);

  const [userName, setUserName] = useState('User');
  const [userEmail, setUserEmail] = useState<string | undefined>();
  const [activeTab, setActiveTab] = useState<TabValue>('temp');
  const [points, setPoints] = useState<TelemetryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pageTitle, setPageTitle] = useState('Analytics - Dashboards');
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
          setPageTitle(dashboard.analytics.title);
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
      setLoading(true);
      try {
        const data = await getTelemetryHistory(activeTab);
        if (mounted) {
          setPoints(data);
          setErrorMessage(null);
        }
      } catch (error) {
        console.log('Failed to load telemetry', error);
        if (mounted) {
          setPoints([]);
          setErrorMessage('Unable to load telemetry right now.');
        }
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
  }, [activeTab]);

  const chartMeta = useMemo(() => {
    if (!points.length) {
      return {
        min: 0,
        max: 1,
        range: 1,
        values: [0],
      };
    }
    const values = points.map((item) => item.numericValue);
    const min = Math.min(...values);
    const max = Math.max(...values);
    return {
      min,
      max,
      range: Math.max(max - min, 1),
      values,
    };
  }, [points]);

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
            <Text style={styles.introText}>Live telemetry overview for your smart farm.</Text>

            <View style={styles.panel}>
              <View style={styles.tabsContainer}>
                {TABS.map((tab, index) => {
                  const isActive = activeTab === tab.value;
                  return (
                    <Pressable
                      key={tab.value}
                      onPress={() => setActiveTab(tab.value)}
                      style={[
                        styles.tab,
                        index === 0 && styles.firstTab,
                        index === TABS.length - 1 && styles.lastTab,
                        isActive && styles.activeTab,
                      ]}
                    >
                      <Text style={[styles.tabText, isActive && styles.activeTabText]}>
                        {tab.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {loading && points.length === 0 ? (
                <View style={styles.loadingWrap}>
                  <ActivityIndicator size="large" color="#22c55e" />
                </View>
              ) : !loading && points.length === 0 ? (
                <View style={styles.loadingWrap}>
                  <Text style={styles.emptyText}>
                    No telemetry samples available for this sensor yet.
                  </Text>
                </View>
              ) : (
                <View style={styles.chartSection}>
                  <View style={[styles.gridFrame, { width: chartWidth }]}>
                    <View style={styles.gridLines}>
                      {[0, 1, 2, 3, 4].map((line) => (
                        <View key={line} style={styles.gridLine} />
                      ))}
                    </View>
                    <View style={styles.columnsRow}>
                      {(points.length
                        ? points
                        : [
                            {
                              id: 'empty',
                              numericValue: 0,
                              receivedAt: new Date().toISOString(),
                            },
                          ]
                      ).map((point) => {
                        const height =
                          ((point.numericValue - chartMeta.min) / chartMeta.range) * 180 + 22;
                        return (
                          <View key={point.id} style={styles.columnWrap}>
                            <View style={[styles.column, { height }]} />
                            <Text style={styles.valueLabel}>{point.numericValue}</Text>
                            <Text style={styles.timeLabel}>
                              {formatTimeLabel(point.receivedAt)}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>

                  <View style={styles.summaryRow}>
                    <View style={styles.summaryCard}>
                      <Text style={styles.summaryLabel}>Min</Text>
                      <Text style={styles.summaryValue}>{chartMeta.min}</Text>
                    </View>
                    <View style={styles.summaryCard}>
                      <Text style={styles.summaryLabel}>Max</Text>
                      <Text style={styles.summaryValue}>{chartMeta.max}</Text>
                    </View>
                    <View style={styles.summaryCard}>
                      <Text style={styles.summaryLabel}>Samples</Text>
                      <Text style={styles.summaryValue}>{points.length || 1}</Text>
                    </View>
                  </View>
                </View>
              )}
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
    marginBottom: 18,
  },
  panel: {
    backgroundColor: CARD_BG,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  tabsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 24,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#f1f3f4',
    borderRightWidth: 0,
  },
  firstTab: {
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
  },
  lastTab: {
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    borderRightWidth: 1,
  },
  activeTab: {
    backgroundColor: ACTIVE,
    borderColor: ACTIVE,
    borderRightWidth: 1,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  activeTabText: {
    color: '#093814',
  },
  loadingWrap: {
    minHeight: 320,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  chartSection: {
    gap: 24,
  },
  gridFrame: {
    alignSelf: 'center',
    minHeight: 280,
    borderWidth: 1,
    borderColor: '#eef1f2',
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12,
    backgroundColor: '#fbfcfc',
    overflow: 'hidden',
  },
  gridLines: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    paddingVertical: 22,
    paddingHorizontal: 18,
  },
  gridLine: {
    height: 1,
    backgroundColor: '#ebeff0',
  },
  columnsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 10,
    minHeight: 220,
  },
  columnWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  column: {
    width: '100%',
    maxWidth: 40,
    borderRadius: 999,
    backgroundColor: '#c8b464',
    minHeight: 22,
  },
  valueLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2e403c',
  },
  timeLabel: {
    fontSize: 11,
    color: '#738789',
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  summaryCard: {
    flex: 1,
    minWidth: 120,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#edf1ef',
    backgroundColor: '#f8fbf8',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#6c8182',
  },
  summaryValue: {
    marginTop: 6,
    fontSize: 22,
    fontWeight: '800',
    color: '#11261f',
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
