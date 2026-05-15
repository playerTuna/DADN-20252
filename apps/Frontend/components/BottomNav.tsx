import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { sidebarItems } from '../constants/navigation';
import type { NavKey } from '../types/dashboard';
import { formatAlertBadge, getHomeAlertCount } from '../utils/homeAlertBadge';

type Props = {
  activeKey: NavKey;
};

export function BottomNav({ activeKey }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [alertCount, setAlertCount] = useState(() => getHomeAlertCount());

  useEffect(() => {
    const syncBadge = () => setAlertCount(getHomeAlertCount());
    syncBadge();
    const timer = setInterval(syncBadge, 2000);
    return () => clearInterval(timer);
  }, [activeKey]);

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {sidebarItems.map((item) => {
        const active = item.key === activeKey;
        const badge =
          item.key === 'home' && alertCount > 0 ? formatAlertBadge(alertCount) : null;

        return (
          <Pressable key={item.key} onPress={() => router.push(`/${item.key}`)} style={styles.item}>
            <View style={styles.iconWrap}>
              <Feather name={item.icon} size={20} color={active ? '#2f37ff' : '#6b7280'} />
              {badge ? (
                <View style={styles.badge} accessibilityLabel={`${alertCount} cảnh báo`}>
                  <Text style={styles.badgeText}>{badge}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.label, active && styles.labelActive]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  item: {
    minWidth: 64,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
    textAlign: 'center',
  },
  labelActive: {
    color: '#2f37ff',
  },
  iconWrap: {
    position: 'relative',
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 999,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
});
