import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { sidebarItems } from '../constants/navigation';
import type { NavKey } from '../types/dashboard';

type Props = {
  activeKey: NavKey;
};

export function BottomNav({ activeKey }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {sidebarItems.map((item) => {
        const active = item.key === activeKey;

        return (
          <Pressable key={item.key} onPress={() => router.push(`/${item.key}`)} style={styles.item}>
            <Feather name={item.icon} size={20} color={active ? '#2f37ff' : '#6b7280'} />
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
    minWidth: 72,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  labelActive: {
    color: '#2f37ff',
  },
});
