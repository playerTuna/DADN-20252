import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  userName?: string;
  userEmail?: string;
  onLogout?: () => void | Promise<void>;
};

function initialsFromName(name?: string) {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);

  if (!parts.length) return 'U';
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('');
}

export function MobileHeaderMenu({ userName, userEmail, onLogout }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const initials = useMemo(() => initialsFromName(userName), [userName]);

  const goTo = (path: '/profile' | '/settings') => {
    setOpen(false);
    router.push(path);
  };

  const handleLogout = async () => {
    setOpen(false);
    await onLogout?.();
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={styles.trigger}
        accessibilityRole="button"
        accessibilityLabel="Open account menu"
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <View style={styles.menuCard}>
            <View style={styles.header}>
              <View style={styles.avatarLarge}>
                <Text style={styles.avatarLargeText}>{initials}</Text>
              </View>

              <View style={styles.headerTextWrap}>
                <Text style={styles.nameText}>{userName || 'User'}</Text>
                {userEmail ? <Text style={styles.emailText}>{userEmail}</Text> : null}
              </View>
            </View>

            <Pressable style={styles.item} onPress={() => goTo('/profile')}>
              <Feather name="user" size={18} color="#111111" />
              <Text style={styles.itemText}>Profile</Text>
            </Pressable>

            <Pressable style={styles.item} onPress={() => goTo('/settings')}>
              <Feather name="settings" size={18} color="#111111" />
              <Text style={styles.itemText}>Settings</Text>
            </Pressable>

            <Pressable style={styles.item} onPress={handleLogout}>
              <Feather name="log-out" size={18} color="#b91c1c" />
              <Text style={styles.logoutText}>Log out</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    marginLeft: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(17,17,17,0.22)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 72,
    paddingRight: 16,
  },
  menuCard: {
    width: 250,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    padding: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 12,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ececec',
  },
  avatarLarge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLargeText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  headerTextWrap: {
    flex: 1,
  },
  nameText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111111',
  },
  emailText: {
    marginTop: 2,
    fontSize: 12,
    color: '#6b7280',
  },
  item: {
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  itemText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111111',
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#b91c1c',
  },
});
