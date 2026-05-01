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
        if (!cancelled) setError("Unable to load profile.");
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
      setError("Display name cannot be empty.");
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
      setSuccess("Profile updated.");
    } catch {
      setError("Unable to save profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.page}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={18} color="#111111" />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <View style={styles.panel}>
          <Text style={styles.title}>Profile</Text>
          {loading ? <ActivityIndicator size="large" color="#22c55e" /> : null}
          {!loading && error ? <Text style={styles.errorText}>{error}</Text> : null}
          {!loading && success ? <Text style={styles.successText}>{success}</Text> : null}
          {!loading && !error && profile ? (
            <View style={styles.infoWrap}>
              <Text style={styles.label}>Display name</Text>
              <TextInput
                value={displayName}
                onChangeText={(value) => {
                  setDisplayName(value);
                  if (success) setSuccess(null);
                }}
                editable={!saving}
                placeholder="Display name"
                style={styles.input}
              />
              <Text style={styles.label}>Email</Text>
              <Text style={styles.value}>{profile.email || "Unavailable"}</Text>
              <Text style={styles.label}>User ID</Text>
              <Text style={styles.value}>{profile.id || "Unavailable"}</Text>
              <Pressable
                onPress={() => {
                  void handleSave();
                }}
                disabled={saving}
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.saveButtonText}>Save profile</Text>
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
  page: { flex: 1, padding: 20, gap: 16 },
  backButton: { flexDirection: "row", alignItems: "center", gap: 8 },
  backText: { fontSize: 14, fontWeight: "600", color: "#111111" },
  panel: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 20,
    gap: 14,
  },
  title: { fontSize: 20, fontWeight: "700", color: "#111111" },
  infoWrap: { gap: 6 },
  label: { fontSize: 12, color: "#6b7280", textTransform: "uppercase" },
  value: { fontSize: 15, color: "#111111" },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    color: "#111111",
    backgroundColor: "#ffffff",
  },
  saveButton: {
    marginTop: 12,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  errorText: { color: "#b91c1c", fontSize: 14 },
  successText: { color: "#166534", fontSize: 14 },
});
