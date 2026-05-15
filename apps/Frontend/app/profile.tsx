import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getUser, type UserProfile, updateUserProfile } from "../services/api";
import { getTokens } from "../services/auth";

const PAGE_BG = "#e5e5e5";

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const tokens = await getTokens();
      if (mounted && !tokens) router.replace("/");
    })();
    return () => {
      mounted = false;
    };
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const nextProfile = await getUser();
        if (!cancelled) {
          setProfile(nextProfile);
          setDisplayName(nextProfile.displayName ?? "");
        }
      } catch {
        if (!cancelled) setError("Không thể tải hồ sơ.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    const trimmed = displayName.trim();
    if (!trimmed) {
      setError("Tên hiển thị không được để trống.");
      setSuccess(null);
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const nextProfile = await updateUserProfile({ displayName: trimmed });
      setProfile(nextProfile);
      setDisplayName(nextProfile.displayName ?? trimmed);
      setSuccess("Đã cập nhật hồ sơ.");
    } catch {
      setError("Không thể lưu hồ sơ.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.page}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={18} color="#111111" />
          <Text style={styles.backText}>Quay lại</Text>
        </Pressable>
        <View style={styles.panel}>
          <Text style={styles.title}>Hồ sơ</Text>
          {loading ? <ActivityIndicator size="large" color="#22c55e" /> : null}
          {!loading && error ? <Text style={styles.errorText}>{error}</Text> : null}
          {!loading && success ? <Text style={styles.successText}>{success}</Text> : null}
          {!loading && !error && profile ? (
            <View style={styles.infoWrap}>
              <Text style={styles.label}>Tên hiển thị</Text>
              <TextInput
                value={displayName}
                onChangeText={(value) => {
                  setDisplayName(value);
                  setSuccess(null);
                }}
                style={styles.input}
                placeholder="Tên của bạn"
                placeholderTextColor="#9ca3af"
              />
              <Text style={styles.label}>Email</Text>
              <Text style={styles.readonly}>{profile.email || "Không có"}</Text>
              <Text style={styles.label}>ID người dùng</Text>
              <Text style={styles.readonly}>{profile.id || "Không có"}</Text>
              <Pressable
                onPress={() => void handleSave()}
                disabled={saving}
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              >
                {saving ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.saveButtonText}>Lưu hồ sơ</Text>
                )}
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: PAGE_BG },
  page: { flex: 1, padding: 24, gap: 16 },
  backButton: { flexDirection: "row", alignItems: "center", gap: 8 },
  backText: { fontSize: 15, fontWeight: "600", color: "#111111" },
  panel: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  title: { fontSize: 24, fontWeight: "800", color: "#111111" },
  infoWrap: { gap: 10 },
  label: { fontSize: 13, fontWeight: "700", color: "#374151" },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#111111",
    marginBottom: 8,
  },
  readonly: { fontSize: 15, color: "#4b5563", marginBottom: 8 },
  saveButton: {
    marginTop: 8,
    backgroundColor: "#22c55e",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveButtonDisabled: { opacity: 0.7 },
  saveButtonText: { color: "#ffffff", fontWeight: "700", fontSize: 15 },
  errorText: { color: "#dc2626", fontWeight: "600" },
  successText: { color: "#16a34a", fontWeight: "600" },
});
