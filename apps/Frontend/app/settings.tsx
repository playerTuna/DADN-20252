import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getTokens } from '../services/auth';

const PAGE_BG = '#e5e5e5';
const TEXT_PRIMARY = '#111111';
const TEXT_SECONDARY = '#6b7280';

export default function SettingsScreen() {
  const router = useRouter();

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

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.page}>
        <Pressable onPress={() => router.back()} style={styles.backRow}>
          <Feather name="arrow-left" size={20} color={TEXT_PRIMARY} />
          <Text style={styles.backText}>Quay lại</Text>
        </Pressable>

        <Text style={styles.title}>Cài đặt</Text>
        <Text style={styles.body}>
          Lịch và tự động hóa thiết bị nằm trong mục <Text style={styles.em}>Tự động hóa</Text> trên
          thanh bên (máy tính) hoặc thanh điều hướng dưới (điện thoại).
        </Text>
        <Text style={styles.body}>
          Dùng Hồ sơ trong menu tài khoản để cập nhật tên hiển thị.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: PAGE_BG },
  page: { flex: 1, padding: 24, gap: 16 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backText: { fontSize: 15, fontWeight: '600', color: TEXT_PRIMARY },
  title: { fontSize: 24, fontWeight: '800', color: TEXT_PRIMARY },
  body: { fontSize: 15, lineHeight: 22, color: TEXT_SECONDARY },
  em: { fontWeight: '800', color: TEXT_PRIMARY },
});
