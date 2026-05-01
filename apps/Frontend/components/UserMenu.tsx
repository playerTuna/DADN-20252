import { Feather, Ionicons } from '@expo/vector-icons';

import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type View as RNView,
} from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { logout } from '../services/auth';

const ANIM_MS = 180;
const MENU_GAP = 10;
const MENU_WIDTH = 220;

type Anchor = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type UserMenuProps = {
  userName: string;
  userEmail?: string;
};

function getInitial(name?: string, email?: string) {
  const source = (name || email || 'U').trim();
  return source.charAt(0).toUpperCase();
}

export function UserMenu({ userName, userEmail }: UserMenuProps) {
  const router = useRouter();
  const triggerRef = useRef<RNView>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [anchor, setAnchor] = useState<Anchor | null>(null);

  const progress = useSharedValue(0);

  const finishClose = useCallback(() => {
    setIsOpen(false);
    setAnchor(null);
  }, []);

  const closeMenu = useCallback(() => {
    progress.value = withTiming(0, { duration: ANIM_MS }, (finished) => {
      if (finished) runOnJS(finishClose)();
    });
  }, [finishClose, progress]);

  const openMenu = useCallback(() => {
    triggerRef.current?.measureInWindow((x, y, w, h) => {
      setAnchor({ x, y, w, h });
      setIsOpen(true);
    });
  }, []);

  const toggle = () => {
    if (isOpen) {
      closeMenu();
      return;
    }

    openMenu();
  };

  useEffect(() => {
    if (!isOpen || !anchor) return;

    progress.value = 0;
    progress.value = withTiming(1, { duration: ANIM_MS });
  }, [isOpen, anchor, progress]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !isOpen) return;

    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };

    globalThis.addEventListener?.('keydown', onKeyDown);
    return () => globalThis.removeEventListener?.('keydown', onKeyDown);
  }, [isOpen, closeMenu]);

  const menuAnimatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 8 }],
  }));

  const menuLeft = anchor ? Math.max(12, anchor.x) : 12;
  const menuTop = anchor ? Math.max(12, anchor.y - 176 - MENU_GAP) : 12;

  const goProfile = () => {
    router.push('/profile' as never);
    closeMenu();
  };

  const goSettings = () => {
    router.push('/settings' as never);
    closeMenu();
  };

  const goLogout = async () => {
    try {
      await logout();
    } catch {
      // Avoid trapping user if logout storage cleanup fails.
    } finally {
      router.replace('/');
      closeMenu();
    }
  };

  return (
    <>
      <Modal visible={isOpen} transparent animationType="none" onRequestClose={closeMenu}>
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityLabel="Close user menu"
            onPress={closeMenu}
            style={styles.backdrop}
          />

          {anchor ? (
            <Animated.View
              style={[
                styles.menu,
                menuAnimatedStyle,
                {
                  left: menuLeft,
                  top: menuTop,
                },
              ]}
            >
              <Pressable style={styles.menuItem} onPress={goProfile}>
                <View style={styles.menuIcon}>
                  <Feather name="user" size={17} color="#0f172a" />
                </View>

                <View style={styles.menuTextWrap}>
                  <Text style={styles.menuTitle} numberOfLines={1}>
                    Profile
                  </Text>
                  {userEmail ? (
                    <Text style={styles.menuSubtitle} numberOfLines={1}>
                      {userEmail}
                    </Text>
                  ) : null}
                </View>
              </Pressable>

              <Pressable style={styles.menuItem} onPress={goSettings}>
                <View style={styles.menuIcon}>
                  <Feather name="settings" size={17} color="#0f172a" />
                </View>

                <Text style={styles.menuTitle} numberOfLines={1}>
                  Settings
                </Text>
              </Pressable>

              <View style={styles.menuDivider} />

              <Pressable style={[styles.menuItem, styles.logoutItem]} onPress={goLogout}>
                <View style={[styles.menuIcon, styles.logoutIcon]}>
                  <Feather name="log-out" size={17} color="#dc2626" />
                </View>

                <Text style={styles.logoutText} numberOfLines={1}>
                  Logout
                </Text>
              </Pressable>
            </Animated.View>
          ) : null}
        </View>
      </Modal>

      <View ref={triggerRef} collapsable={false} style={styles.triggerWrap}>
        <Pressable
          onPress={toggle}
          accessibilityRole="button"
          accessibilityState={{ expanded: isOpen }}
          accessibilityLabel="User menu"
          style={({ pressed }) => [
            styles.trigger,
            isOpen && styles.triggerOpen,
            pressed && styles.triggerPressed,
          ]}
        >
          <View style={styles.avatar}>
            <Ionicons name="person-circle" size={34} color="#94a3b8" />
          </View>

          <View style={styles.identity}>
            <Text style={styles.userName} numberOfLines={1}>
              {userName || 'User'}
            </Text>
            {userEmail ? (
              <Text style={styles.userEmail} numberOfLines={1}>
                {userEmail}
              </Text>
            ) : (
              <Text style={styles.userEmail} numberOfLines={1}>
                Smart Farm account
              </Text>
            )}
          </View>

          <Feather name={isOpen ? 'chevron-down' : 'chevron-up'} size={17} color="#64748b" />
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },

  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.16)',
  },

  menu: {
    position: 'absolute',
    width: MENU_WIDTH,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 14,
  },

  menuItem: {
    minHeight: 44,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  menuIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    flexShrink: 0,
  },

  menuTextWrap: {
    flex: 1,
    minWidth: 0,
  },

  menuTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },

  menuSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: '#64748b',
  },

  menuDivider: {
    height: 1,
    marginVertical: 6,
    marginHorizontal: 8,
    backgroundColor: '#e5e7eb',
  },

  logoutItem: {
    backgroundColor: '#fff7f7',
  },

  logoutIcon: {
    backgroundColor: '#fee2e2',
  },

  logoutText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#dc2626',
  },

  triggerWrap: {
    width: '100%',
    paddingHorizontal: 10,
    paddingTop: 12,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },

  trigger: {
    width: '100%',
    minHeight: 58,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },

  triggerOpen: {
    borderColor: '#22c55e',
    backgroundColor: '#ecfdf5',
  },

  triggerPressed: {
    opacity: 0.86,
  },

  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    flexShrink: 0,
  },

  avatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },

  identity: {
    flex: 1,
    minWidth: 0,
  },

  userName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },

  userEmail: {
    marginTop: 2,
    fontSize: 11,
    color: '#64748b',
  },
});
