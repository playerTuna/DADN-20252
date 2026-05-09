import { BottomNav } from '../components/BottomNav';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { MobileHeaderMenu } from '@/components/MobileHeaderMenu';
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
import { Circle, Defs, LinearGradient, Path, Stop, Svg } from 'react-native-svg';

import { UserMenu } from '../components/UserMenu';
import { sidebarItems } from '../constants/navigation';
import { getDashboard, getTelemetryHistory, getUser, type TelemetryPoint } from '../services/api';
import { clearTokens, getTokens } from '../services/auth';
import type { NavKey, StatItem } from '../types/dashboard';

const PAGE_BG = '#e5e5e5';
const PANEL_BG = '#ffffff';
const PANEL_BORDER = '#d2d2d2';
const ACCENT = '#160f9b';
const ACCENT_GREEN = '#28f464';
const TEXT_PRIMARY = '#050505';
const TEXT_SECONDARY = '#555555';
const ERROR_BG = '#ffe4e6';
const ERROR_TEXT = '#be123c';
const CHART_LINE = '#b59b42';
const CHART_INSET = 10;

type AnalyticsTab = 'temp' | 'air_humidity' | 'soil_humidity' | 'light';

type ChartPoint = {
  id: string;
  x: number;
  y: number;
  value: number;
  label: string;
};

const TAB_LABELS: Record<AnalyticsTab, string> = {
  temp: 'Temperature',
  air_humidity: 'Air Humidity',
  soil_humidity: 'Soil Humidity',
  light: 'Light Intensity',
};

function displayAnalyticsTitle(title?: string) {
  if (!title || title === 'Analytics - Dashboards') {
    return 'Environment Analytics';
  }
  return title;
}

function formatTick(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatReadingTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function makeSmoothPath(points: ChartPoint[]) {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  return points.reduce((path, point, index) => {
    if (index === 0) {
      return `M ${point.x} ${point.y}`;
    }

    const previous = points[index - 1];
    const controlX = (previous.x + point.x) / 2;
    return `${path} C ${controlX} ${previous.y}, ${controlX} ${point.y}, ${point.x} ${point.y}`;
  }, '');
}

export default function AnalyticsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 960;

  const [pageTitle, setPageTitle] = useState('Environment Analytics');
  const [userName, setUserName] = useState('User');
  const [userEmail, setUserEmail] = useState<string | undefined>();
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('temp');
  const [series, setSeries] = useState<TelemetryPoint[]>([]);
  const [stats, setStats] = useState<StatItem[]>([]);
  const [plotSize, setPlotSize] = useState({ width: 0, height: 0 });
  const [clock, setClock] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
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

    void (async () => {
      try {
        const [dashboard, profile] = await Promise.all([getDashboard(), getUser()]);
        if (cancelled) return;

        setPageTitle(displayAnalyticsTitle(dashboard.analytics?.title));
        setStats(dashboard.analytics?.stats || []);
        setUserName(profile.displayName || 'User');
        setUserEmail(profile.email);
        setErrorMessage(null);
      } catch (error) {
        console.log('Analytics bootstrap failed', error);
        if (!cancelled) {
          setErrorMessage('Unable to load analytics dashboard.');
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

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setChartLoading(true);
      try {
        const data = await getTelemetryHistory(activeTab);
        if (!cancelled) {
          setSeries(data);
        }
      } catch (error) {
        console.log('Telemetry history load failed', error);
        if (!cancelled) {
          setErrorMessage('Unable to load telemetry history.');
        }
      } finally {
        if (!cancelled) {
          setChartLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  const visiblePointCount = isDesktop ? 12 : 8;

  const chartRows = useMemo(
    () => series.slice(0, visiblePointCount).reverse(),
    [series, visiblePointCount]
  );

  const chartBounds = useMemo(() => {
    if (!chartRows.length) {
      return { min: 0, max: activeTab === 'light' ? 100 : 36 };
    }

    const values = chartRows.map((item) => item.numericValue);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const baseStep = activeTab === 'temp' ? 5 : activeTab === 'light' ? 100 : 10;

    if (rawMin === rawMax) {
      const padding = Math.max(baseStep, Math.abs(rawMax) * 0.08);
      return {
        min: Math.max(0, Math.floor((rawMin - padding) / baseStep) * baseStep),
        max: Math.ceil((rawMax + padding) / baseStep) * baseStep,
      };
    }

    const padding = Math.max((rawMax - rawMin) * 0.22, baseStep);
    const min = Math.max(0, Math.floor((rawMin - padding) / baseStep) * baseStep);
    const max = Math.ceil((rawMax + padding) / baseStep) * baseStep;

    return { min, max: max > min ? max : min + baseStep };
  }, [activeTab, chartRows]);

  const yTicks = useMemo(() => {
    const range = chartBounds.max - chartBounds.min || 1;
    return Array.from({ length: 5 }, (_, index) => chartBounds.max - (range / 4) * index);
  }, [chartBounds]);

  const xLabels = useMemo(
    () => chartRows.map((item) => formatReadingTime(item.receivedAt)),
    [chartRows]
  );

  const verticalGridLines = useMemo(
    () => Array.from({ length: Math.max(chartRows.length, 2) }, (_, index) => index),
    [chartRows.length]
  );

  const chartPoints = useMemo<ChartPoint[]>(() => {
    if (plotSize.width <= 0 || plotSize.height <= 0 || chartRows.length === 0) return [];

    const drawableWidth = Math.max(plotSize.width - CHART_INSET * 2, 1);
    const drawableHeight = Math.max(plotSize.height - CHART_INSET * 2, 1);
    const range = chartBounds.max - chartBounds.min || 1;
    const stepX = chartRows.length > 1 ? drawableWidth / (chartRows.length - 1) : 0;

    return chartRows.map((item, index) => {
      const normalized = (item.numericValue - chartBounds.min) / range;
      return {
        id: item.id,
        x: chartRows.length === 1 ? plotSize.width / 2 : CHART_INSET + index * stepX,
        y: CHART_INSET + (1 - normalized) * drawableHeight,
        value: item.numericValue,
        label: formatReadingTime(item.receivedAt),
      };
    });
  }, [chartBounds, chartRows, plotSize]);

  const chartPath = useMemo(() => makeSmoothPath(chartPoints), [chartPoints]);

  const chartAreaPath = useMemo(() => {
    if (!chartPath || chartPoints.length < 2) return '';
    const first = chartPoints[0];
    const last = chartPoints[chartPoints.length - 1];
    const baseline = plotSize.height - CHART_INSET;
    return `${chartPath} L ${last.x} ${baseline} L ${first.x} ${baseline} Z`;
  }, [chartPath, chartPoints, plotSize.height]);

  const summaryItems = useMemo(() => {
    if (!series.length) {
      return [
        { label: 'Latest', value: '-' },
        { label: 'Min', value: '-' },
        { label: 'Max', value: '-' },
        { label: 'Average', value: '-' },
      ];
    }

    const values = series.map((item) => item.numericValue);
    const latest = series[0].numericValue;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const average = values.reduce((total, value) => total + value, 0) / values.length;

    return [
      { label: 'Latest', value: String(latest) },
      { label: 'Min', value: String(min) },
      { label: 'Max', value: String(max) },
      { label: 'Average', value: average.toFixed(1) },
    ];
  }, [series]);

  const recentRows = useMemo(() => series.slice(0, 5), [series]);

  const handleNavPress = (key: NavKey) => {
    if (key !== 'analytics') {
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
            const isActive = item.key === 'analytics';
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
                {isDesktop ? pageTitle : 'Analytics'}
              </Text>
              {!isDesktop ? (
                <Text style={styles.headerSubText}>{TAB_LABELS[activeTab]}</Text>
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
            {loading ? <ActivityIndicator size="large" color={ACCENT} /> : null}
            {errorMessage ? <Text style={styles.errorBanner}>{errorMessage}</Text> : null}

            {!isDesktop ? (
              <View style={styles.mobileSummaryGrid}>
                {summaryItems.map((item) => (
                  <View key={item.label} style={styles.mobileSummaryCard}>
                    <Text style={styles.summaryLabel}>{item.label}</Text>
                    <Text style={styles.summaryValue}>{item.value}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View
              style={[styles.panel, !isDesktop && styles.panelCompact]}
              accessibilityLabel={`Telemetry chart with ${stats.length} dashboard stats loaded`}
            >
              <ScrollView
                horizontal={!isDesktop}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={[styles.tabWrap, !isDesktop && styles.mobileTabWrap]}
              >
                {(Object.keys(TAB_LABELS) as AnalyticsTab[]).map((tab) => {
                  const active = activeTab === tab;
                  return (
                    <Pressable
                      key={tab}
                      onPress={() => setActiveTab(tab)}
                      style={[
                        styles.tab,
                        !isDesktop && styles.mobileTab,
                        active && styles.tabActive,
                      ]}
                    >
                      <Text style={[styles.tabText, active && styles.tabTextActive]}>
                        {TAB_LABELS[tab]}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <View style={[styles.chartArea, !isDesktop && styles.mobileChartArea]}>
                <View style={[styles.yAxis, !isDesktop && styles.mobileYAxis]}>
                  {yTicks.map((tick) => (
                    <Text key={tick} style={[styles.axisText, !isDesktop && styles.mobileAxisText]}>
                      {formatTick(tick)}
                    </Text>
                  ))}
                </View>

                <View style={styles.chartColumn}>
                  <View
                    style={[styles.plotArea, !isDesktop && styles.mobilePlotArea]}
                    onLayout={(event) => {
                      const { width: nextWidth, height: nextHeight } = event.nativeEvent.layout;
                      setPlotSize((current) =>
                        current.width === nextWidth && current.height === nextHeight
                          ? current
                          : { width: nextWidth, height: nextHeight }
                      );
                    }}
                  >
                    {yTicks.map((tick, index) => (
                      <View
                        key={`h-${tick}`}
                        style={[styles.horizontalGrid, { top: `${(index / 4) * 100}%` }]}
                      />
                    ))}

                    {verticalGridLines.map((label, index) => (
                      <View
                        key={`v-${label}`}
                        style={[
                          styles.verticalGrid,
                          {
                            left: `${
                              verticalGridLines.length === 1
                                ? 0
                                : (index / (verticalGridLines.length - 1)) * 100
                            }%`,
                          },
                        ]}
                      />
                    ))}

                    {chartPoints.length > 0 ? (
                      <Svg
                        style={StyleSheet.absoluteFill}
                        width="100%"
                        height="100%"
                        pointerEvents="none"
                      >
                        <Defs>
                          <LinearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                            <Stop offset="0" stopColor={CHART_LINE} stopOpacity={0.24} />
                            <Stop offset="1" stopColor={CHART_LINE} stopOpacity={0.02} />
                          </LinearGradient>
                        </Defs>

                        {chartAreaPath ? <Path d={chartAreaPath} fill="url(#chartFill)" /> : null}

                        {chartPath ? (
                          <Path
                            d={chartPath}
                            fill="none"
                            stroke={CHART_LINE}
                            strokeWidth={!isDesktop ? 3.5 : 3}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        ) : null}

                        {chartPoints.map((point) => (
                          <Circle
                            key={point.id}
                            cx={point.x}
                            cy={point.y}
                            r={!isDesktop ? 4 : 3.5}
                            fill={PANEL_BG}
                            stroke={CHART_LINE}
                            strokeWidth={2.5}
                          />
                        ))}
                      </Svg>
                    ) : null}

                    {chartLoading ? (
                      <View style={styles.chartOverlay}>
                        <ActivityIndicator size="small" color={ACCENT} />
                      </View>
                    ) : null}

                    {!chartLoading && chartRows.length === 0 ? (
                      <View style={styles.chartOverlay}>
                        <Text style={styles.emptyText}>No telemetry history available.</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.xAxis}>
                    {xLabels.map((label, index) => {
                      const shouldShowLabel =
                        isDesktop || index === 0 || index === xLabels.length - 1 || index % 2 === 0;

                      return (
                        <Text
                          key={`x-${label}-${index}`}
                          style={[styles.axisText, !isDesktop && styles.mobileAxisText]}
                        >
                          {shouldShowLabel ? label : ''}
                        </Text>
                      );
                    })}
                  </View>
                </View>
              </View>
            </View>

            {!isDesktop ? (
              <View style={styles.recentPanel}>
                <Text style={styles.sectionTitle}>Recent readings</Text>
                {recentRows.length === 0 ? (
                  <Text style={styles.emptyText}>No telemetry history available.</Text>
                ) : (
                  recentRows.map((item) => (
                    <View key={item.id} style={styles.readingRow}>
                      <View>
                        <Text style={styles.readingValue}>{item.numericValue}</Text>
                        <Text style={styles.readingLabel}>{TAB_LABELS[activeTab]}</Text>
                      </View>
                      <Text style={styles.readingTime}>{formatReadingTime(item.receivedAt)}</Text>
                    </View>
                  ))
                )}
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
      {!isDesktop ? <BottomNav activeKey="analytics" /> : null}
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
    paddingBottom: 36,
    gap: 18,
  },
  contentDesktop: {
    paddingHorizontal: 32,
    paddingTop: 150,
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
  mobileSummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  mobileSummaryCard: {
    width: '48%',
    minHeight: 94,
    borderRadius: 18,
    backgroundColor: PANEL_BG,
    padding: 14,
    justifyContent: 'space-between',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 1,
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_SECONDARY,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '800',
    color: TEXT_PRIMARY,
  },
  panel: {
    width: '100%',
    maxWidth: 1134,
    minHeight: 486,
    backgroundColor: PANEL_BG,
    borderWidth: 1,
    borderColor: '#d7d7d7',
    paddingTop: 28,
    paddingHorizontal: 52,
    paddingBottom: 28,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 2,
    elevation: 2,
  },
  panelCompact: {
    minHeight: 370,
    borderRadius: 24,
    borderWidth: 0,
    paddingTop: 16,
    paddingHorizontal: 14,
    paddingBottom: 18,
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 2,
  },
  tabWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  mobileTabWrap: {
    flexWrap: 'nowrap',
    gap: 8,
    paddingRight: 4,
  },
  tab: {
    width: 120,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#a8a8a8',
    backgroundColor: '#e6e6e6',
  },
  mobileTab: {
    width: 'auto',
    minWidth: 112,
    height: 44,
    borderRadius: 999,
    paddingHorizontal: 14,
    borderColor: '#d8d8d8',
    backgroundColor: '#f3f3f3',
  },
  tabActive: {
    backgroundColor: ACCENT_GREEN,
    borderColor: ACCENT_GREEN,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: TEXT_PRIMARY,
  },
  tabTextActive: {
    color: TEXT_PRIMARY,
  },
  chartArea: {
    marginTop: 56,
    flexDirection: 'row',
    minHeight: 316,
  },
  mobileChartArea: {
    marginTop: 22,
    minHeight: 252,
  },
  yAxis: {
    width: 44,
    height: 266,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingRight: 14,
  },
  mobileYAxis: {
    width: 34,
    height: 216,
    paddingRight: 8,
  },
  chartColumn: {
    flex: 1,
    minWidth: 0,
  },
  plotArea: {
    height: 266,
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#d7d7d7',
    borderRadius: 18,
    backgroundColor: '#fbfbfb',
    overflow: 'hidden',
  },
  mobilePlotArea: {
    height: 216,
    borderRadius: 20,
  },
  horizontalGrid: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#ececec',
  },
  verticalGrid: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: '#f0f0f0',
  },
  lineSegment: {
    position: 'absolute',
    height: 1,
    backgroundColor: CHART_LINE,
  },
  chartOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.62)',
  },
  xAxis: {
    height: 38,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
  },
  axisText: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  mobileAxisText: {
    fontSize: 11,
  },
  emptyText: {
    fontSize: 14,
    color: TEXT_SECONDARY,
  },
  recentPanel: {
    borderRadius: 22,
    backgroundColor: PANEL_BG,
    padding: 16,
    gap: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    marginBottom: 2,
  },
  readingRow: {
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
  readingValue: {
    fontSize: 17,
    fontWeight: '800',
    color: TEXT_PRIMARY,
  },
  readingLabel: {
    marginTop: 2,
    fontSize: 12,
    color: TEXT_SECONDARY,
  },
  readingTime: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_SECONDARY,
  },
  topBarRight: {
    paddingTop: 12,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
});
