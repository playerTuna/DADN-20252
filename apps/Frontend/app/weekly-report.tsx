import { BottomNav } from '../components/BottomNav';
import { Feather, FontAwesome6 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { MobileHeaderMenu } from '@/components/MobileHeaderMenu';
import { useCallback, useEffect, useMemo, useState } from 'react';
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

import { UserMenu } from '../components/UserMenu';
import { sidebarItems } from '../constants/navigation';
import { getWeeklyReport, getUser, type WeeklyReportPayload, type WeeklyReportSensorKey } from '../services/api';
import { clearTokens } from '../services/auth';

const PAGE_BG = '#e5e5e5';
const PANEL_BG = '#ffffff';
const PANEL_BORDER = '#d2d2d2';
const ACCENT = '#160f9b';
const TEXT_PRIMARY = '#050505';
const TEXT_SECONDARY = '#555555';
const ERROR_TEXT = '#be123c';
const GOOD = '#15803d';
const BAD = '#b91c1c';

const SENSOR_ORDER: WeeklyReportSensorKey[] = ['temp', 'air_humidity', 'soil_humidity', 'light'];

const SENSOR_LABELS: Record<WeeklyReportSensorKey, string> = {
  temp: 'Nhiệt độ',
  air_humidity: 'Độ ẩm KK',
  soil_humidity: 'Độ ẩm đất',
  light: 'Ánh sáng',
};

const SENSOR_UNITS: Record<WeeklyReportSensorKey, string> = {
  temp: '°C',
  air_humidity: '%',
  soil_humidity: '%',
  light: 'lux',
};

function startOfUtcIsoWeek(reference = new Date()): Date {
  const d = new Date(
    Date.UTC(
      reference.getUTCFullYear(),
      reference.getUTCMonth(),
      reference.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );
  const day = d.getUTCDay();
  const daysFromMonday = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - daysFromMonday);
  return d;
}

function addUtcDaysIso(isoStart: string, days: number): string {
  const d = new Date(isoStart);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

function formatDayMonth(iso: string): string {
  const x = new Date(iso);
  if (Number.isNaN(x.getTime())) return '-';
  return x.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
}

function formatNum(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '-';
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function deltaPresentation(
  type: WeeklyReportSensorKey,
  delta: number | null,
): { label: string; color: string } {
  if (delta == null || delta === 0) {
    return { label: '—', color: TEXT_SECONDARY };
  }
  const up = delta > 0;
  const bad =
    type === 'temp'
      ? up
      : type === 'soil_humidity' || type === 'air_humidity'
        ? !up
        : type === 'light'
          ? !up
          : false;
  const arrow = up ? '↑' : '↓';
  return {
    label: `${arrow} ${Math.abs(delta).toFixed(1)}`,
    color: bad ? BAD : GOOD,
  };
}

export default function WeeklyReportScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 960;

  const [userName, setUserName] = useState('Người dùng');
  const [userEmail, setUserEmail] = useState<string | undefined>();
  const [report, setReport] = useState<WeeklyReportPayload | null>(null);
  const [weekFrom, setWeekFrom] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const thisWeekStartIso = useMemo(() => startOfUtcIsoWeek().toISOString(), []);

  const load = useCallback(async (from?: string) => {
    setLoading(true);
    setError('');
    try {
      const data = await getWeeklyReport(from);
      setReport(data);
      setWeekFrom(data.period.from);
    } catch {
      setError('Không tải được báo cáo tuần.');
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(undefined);
  }, [load]);

  useEffect(() => {
    void (async () => {
      try {
        const profile = await getUser();
        setUserName(profile.displayName || 'Người dùng');
        setUserEmail(profile.email);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const canGoNext = weekFrom != null && new Date(weekFrom).getTime() < new Date(thisWeekStartIso).getTime();
  const titleRange =
    report != null ? `${formatDayMonth(report.period.from)} – ${formatDayMonth(report.period.to)}` : '';

  const renderSidebar = () => (
    <View style={styles.sidebar}>
      <View style={styles.navList}>
        {sidebarItems.map((item) => (
          <Pressable
            key={item.key}
            onPress={() => router.push(`/${item.key}`)}
            style={[styles.navItem]}
          >
            <Feather name={item.icon} size={26} color={TEXT_PRIMARY} />
            <Text style={styles.navText}>{item.label}</Text>
          </Pressable>
        ))}
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
            <Text style={[styles.pageTitle, !isDesktop && styles.mobilePageTitle]}>Báo cáo tuần</Text>
            <MobileHeaderMenu
              userName={userName}
              userEmail={userEmail}
              onLogout={async () => {
                await clearTokens();
                router.replace('/');
              }}
            />
          </View>

          <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.weekNav}>
              <Pressable
                style={styles.chip}
                disabled={loading || !weekFrom}
                onPress={() => weekFrom && void load(addUtcDaysIso(weekFrom, -7))}
              >
                <Text style={styles.chipText}>&lt; Tuần trước</Text>
              </Pressable>
              <Pressable style={styles.chip} disabled={loading || !canGoNext} onPress={() => weekFrom && void load(addUtcDaysIso(weekFrom, 7))}>
                <Text style={styles.chipText}>Tuần sau &gt;</Text>
              </Pressable>
              <Pressable style={[styles.chip, styles.chipPrimary]} disabled={loading} onPress={() => void load(undefined)}>
                <Text style={[styles.chipText, styles.chipTextPrimary]}>Tuần này</Text>
              </Pressable>
              <Pressable style={styles.chip} onPress={() => router.push('/analytics')}>
                <Text style={styles.chipText}>← Phân tích</Text>
              </Pressable>
            </View>

            <Text style={styles.rangeTitle}>[{titleRange}]</Text>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            {loading && !report ? <ActivityIndicator size="large" color={ACCENT} /> : null}

            {report ? (
              <>
                {SENSOR_ORDER.map((key) => {
                  const s = report.sensors[key];
                  const d = deltaPresentation(key, s.deltaAvg);
                  return (
                    <View key={key} style={styles.sensorCard}>
                      <Text style={styles.sensorLabel}>
                        {SENSOR_LABELS[key]} ({SENSOR_UNITS[key]})
                      </Text>
                      <Text style={styles.sensorAvg}>{formatNum(s.avg)}</Text>
                      <Text style={[styles.deltaLine, { color: d.color }]}>{d.label} vs tuần trước</Text>
                      <Text style={styles.minmax}>
                        Thấp nhất {formatNum(s.min)} · Cao nhất {formatNum(s.max)}
                      </Text>
                    </View>
                  );
                })}

                <View style={styles.panel}>
                  <Text style={styles.sectionTitle}>Thiết bị (lệnh của bạn)</Text>
                  <View style={styles.deviceRow}>
                    <FontAwesome6 name="pump-soap" size={20} color={TEXT_PRIMARY} />
                    <Text style={styles.deviceLabel}>Máy bơm</Text>
                    <Text style={styles.deviceCount}>{report.deviceActivity.pump}</Text>
                  </View>
                  <View style={styles.deviceRow}>
                    <Feather name="wind" size={20} color={TEXT_PRIMARY} />
                    <Text style={styles.deviceLabel}>Quạt</Text>
                    <Text style={styles.deviceCount}>{report.deviceActivity.fan}</Text>
                  </View>
                  <View style={styles.deviceRow}>
                    <Feather name="volume-2" size={20} color={TEXT_PRIMARY} />
                    <Text style={styles.deviceLabel}>Loa</Text>
                    <Text style={styles.deviceCount}>{report.deviceActivity.speaker}</Text>
                  </View>
                </View>

                <View style={styles.panel}>
                  <Text style={styles.sectionTitle}>Cảnh báo (toàn hệ thống)</Text>
                  <View style={styles.badgeRow}>
                    {SENSOR_ORDER.map((key) => (
                      <View key={key} style={styles.badge}>
                        <Text style={styles.badgeText}>
                          {SENSOR_LABELS[key]}: {report.alerts[key]}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>

                <Text style={styles.footnote}>
                  Dữ liệu cảm biến và cảnh báo là chung toàn hệ thống; lịch sử lệnh theo tài khoản của bạn.
                </Text>
              </>
            ) : null}
          </ScrollView>
        </View>
      </View>
      {!isDesktop ? <BottomNav activeKey="analytics" /> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: PAGE_BG },
  page: { flex: 1, flexDirection: 'row' },
  sidebar: {
    width: 240,
    backgroundColor: PANEL_BG,
    borderRightWidth: 1,
    borderRightColor: PANEL_BORDER,
    paddingTop: 16,
    justifyContent: 'space-between',
  },
  navList: { gap: 4 },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 16 },
  navText: { fontSize: 15, color: TEXT_PRIMARY },
  mainArea: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: PANEL_BG,
    borderBottomWidth: 1,
    borderBottomColor: PANEL_BORDER,
  },
  mobileTopBar: { paddingHorizontal: 12 },
  pageTitle: { fontSize: 22, fontWeight: '700', color: TEXT_PRIMARY },
  mobilePageTitle: { fontSize: 18 },
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 100 },
  weekNav: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    borderWidth: 1,
    borderColor: PANEL_BORDER,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: PANEL_BG,
  },
  chipPrimary: { backgroundColor: ACCENT, borderColor: ACCENT },
  chipText: { fontSize: 13, color: TEXT_PRIMARY, fontWeight: '600' },
  chipTextPrimary: { color: '#fff' },
  rangeTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12, color: TEXT_PRIMARY },
  errorText: { color: ERROR_TEXT, marginBottom: 8 },
  sensorCard: {
    backgroundColor: PANEL_BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PANEL_BORDER,
    padding: 16,
    marginBottom: 10,
  },
  sensorLabel: { fontSize: 14, color: TEXT_SECONDARY },
  sensorAvg: { fontSize: 28, fontWeight: '800', color: TEXT_PRIMARY, marginTop: 4 },
  deltaLine: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  minmax: { fontSize: 12, color: TEXT_SECONDARY, marginTop: 4 },
  panel: {
    backgroundColor: PANEL_BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PANEL_BORDER,
    padding: 16,
    marginTop: 8,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12, color: TEXT_PRIMARY },
  deviceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  deviceLabel: { flex: 1, fontSize: 15, color: TEXT_PRIMARY },
  deviceCount: { fontSize: 18, fontWeight: '800', color: ACCENT },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: {
    backgroundColor: '#f3f4f6',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  badgeText: { fontSize: 12, color: TEXT_PRIMARY, fontWeight: '600' },
  footnote: { fontSize: 11, color: TEXT_SECONDARY, marginTop: 16, lineHeight: 16 },
});
