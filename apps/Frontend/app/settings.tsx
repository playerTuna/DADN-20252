import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getSettings, type EditableSettings, updateUserSettings } from "../services/api";
import { getTokens } from "../services/auth";

const PAGE_BG = "#e5e5e5";
const SETTING_LABELS: Record<string, string> = {
  "pump-1": "Pump 1 default state",
  "pump-2": "Pump 2 default state",
  "led-1": "LED 1 default state",
  "led-2": "LED 2 default state",
  "led-3": "LED 3 default state",
  "schedule-1": "Morning cycle default state",
  "schedule-2": "Cooling fan default state",
  "schedule-3": "Night lamp default state",
  "dev-1": "Pump A default state",
  "dev-2": "Pump B default state",
  "dev-3": "Grow Light 1 default state",
  "dev-4": "Grow Light 2 default state",
};

export default function SettingsScreen() {
  const router = useRouter();
  const [settings, setSettings] = useState<EditableSettings | null>(null);
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
        const nextSettings = await getSettings();
        if (!cancelled) setSettings(nextSettings);
      } catch {
        if (!cancelled) setError("Unable to load settings.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggle = (key: string, value: boolean) => {
    setSettings((current) => (current ? { ...current, [key]: value } : current));
    if (success) setSuccess(null);
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const nextSettings = await updateUserSettings(settings);
      setSettings(nextSettings);
      setSuccess("Settings updated.");
    } catch {
      setError("Unable to save settings.");
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
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.panel}>
            <Text style={styles.title}>Settings</Text>
            <Text style={styles.subtitle}>Manage your saved dashboard control defaults.</Text>
            {loading ? <ActivityIndicator size="large" color="#22c55e" /> : null}
            {!loading && error ? <Text style={styles.errorText}>{error}</Text> : null}
            {!loading && success ? <Text style={styles.successText}>{success}</Text> : null}
            {!loading && !error && settings ? (
              <View style={styles.infoWrap}>
                {Object.entries(settings).map(([key, value]) => (
                  <View key={key} style={styles.row}>
                    <View style={styles.rowTextWrap}>
                      <Text style={styles.value}>{SETTING_LABELS[key] ?? key}</Text>
                      <Text style={styles.helperText}>{key}</Text>
                    </View>
                    <Switch
                      value={value}
                      disabled={saving}
                      onValueChange={(nextValue) => handleToggle(key, nextValue)}
                    />
                  </View>
                ))}
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
                    <Text style={styles.saveButtonText}>Save settings</Text>
                  )}
                </Pressable>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: PAGE_BG },
  page: { flex: 1, padding: 20, gap: 16 },
  content: { paddingBottom: 24 },
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
  subtitle: { fontSize: 14, color: "#4b5563" },
  infoWrap: { gap: 10 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowTextWrap: { flex: 1, paddingRight: 12 },
  value: { fontSize: 15, color: "#111111" },
  helperText: {
    marginTop: 2,
    fontSize: 12,
    color: "#6b7280",
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
