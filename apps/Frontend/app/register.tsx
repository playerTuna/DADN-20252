import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { register, validateEmailInput, validatePasswordInput } from '../services/auth';

export default function RegisterScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<'email' | 'password' | 'confirm' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    const emailError = validateEmailInput(email);
    if (emailError) return emailError;
    const passwordError = validatePasswordInput(password);
    if (passwordError) return passwordError;
    if (confirmPassword !== password) return 'Passwords do not match.';
    return null;
  };

  const handleSubmit = async () => {
    const msg = validate();
    if (msg) {
      setError(msg);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await register(email, password);
      router.replace('/home');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Register failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <View style={styles.hero}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            style={styles.backButton}
            accessibilityLabel="Back"
          >
            <Ionicons name="arrow-back" size={20} color="#11261f" />
          </Pressable>

          <View style={styles.logoBadge}>
            <Image
              source={require('../assets/images/logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.brand}>Create account</Text>
          <Text style={styles.subtitle}>Register to access your Smart Farm dashboard.</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <View
              style={[styles.inputWrapper, focusedField === 'email' && styles.inputWrapperFocused]}
            >
              <Ionicons name="mail-outline" size={18} color="#668085" />
              <TextInput
                placeholder="farmer@smartfarm.vn"
                placeholderTextColor="#93a8ab"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField((f) => (f === 'email' ? null : f))}
                style={styles.input}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View
              style={[
                styles.inputWrapper,
                focusedField === 'password' && styles.inputWrapperFocused,
              ]}
            >
              <Ionicons name="lock-closed-outline" size={18} color="#668085" />
              <TextInput
                placeholder="Enter your password"
                placeholderTextColor="#93a8ab"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField((f) => (f === 'password' ? null : f))}
                style={styles.input}
              />
              <Pressable
                onPress={() => setShowPassword((s) => !s)}
                hitSlop={10}
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#668085"
                />
              </Pressable>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirm password</Text>
            <View
              style={[
                styles.inputWrapper,
                focusedField === 'confirm' && styles.inputWrapperFocused,
              ]}
            >
              <Ionicons name="lock-closed-outline" size={18} color="#668085" />
              <TextInput
                placeholder="Repeat your password"
                placeholderTextColor="#93a8ab"
                secureTextEntry={!showPassword}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                onFocus={() => setFocusedField('confirm')}
                onBlur={() => setFocusedField((f) => (f === 'confirm' ? null : f))}
                style={styles.input}
              />
            </View>
          </View>

          <Pressable
            onPress={() => void handleSubmit()}
            disabled={submitting}
            style={[styles.primaryButton, submitting && styles.primaryButtonDisabled]}
          >
            {submitting ? (
              <ActivityIndicator color="#093814" />
            ) : (
              <Text style={styles.primaryButtonText}>Register</Text>
            )}
          </Pressable>

          {error ? <Text style={styles.formError}>{error}</Text> : null}

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <Pressable
              onPress={() => router.replace('/')}
              hitSlop={10}
              accessibilityLabel="Go to login"
            >
              <Text style={styles.footerLink}> Sign in</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f4f7f2',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    backgroundColor: '#f4f7f2',
  },
  hero: {
    marginBottom: 22,
    alignItems: 'center',
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 6,
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1,
    borderColor: '#d6e4df',
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#e8fff4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    overflow: 'hidden',
  },
  logoImage: {
    width: 44,
    height: 44,
  },
  brand: {
    fontSize: 28,
    fontWeight: '800',
    color: '#11261f',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#5f7477',
    maxWidth: 320,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    padding: 22,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    shadowColor: '#0a2218',
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#28433c',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#d6e4df',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#f9fcfa',
  },
  inputWrapperFocused: {
    borderColor: '#23f056',
    backgroundColor: '#ffffff',
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#11261f',
  },
  primaryButton: {
    marginTop: 6,
    backgroundColor: '#23f056',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    minHeight: 52,
  },
  primaryButtonDisabled: {
    opacity: 0.75,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#093814',
  },
  formError: {
    marginTop: 10,
    fontSize: 12,
    color: '#c43d3d',
    fontWeight: '600',
    textAlign: 'center',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 18,
  },
  footerText: {
    fontSize: 13,
    color: '#698084',
  },
  footerLink: {
    fontSize: 13,
    color: '#00a86b',
    fontWeight: '700',
  },
});
