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
import { login, validateEmailInput, validatePasswordInput } from '../services/auth';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    const next: { email?: string; password?: string } = {};
    const emailError = validateEmailInput(email);
    const passwordError = validatePasswordInput(password);
    if (emailError) next.email = emailError;
    if (passwordError) next.password = passwordError;
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await login(email, password);
      router.replace('/home');
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Login failed');
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
          <View style={styles.logoBadge}>
            <Image
              source={require('../assets/images/logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.brand}>Smart Farm</Text>
          <Text style={styles.subtitle}>Monitor your farm status and control devices anytime.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign in</Text>
          <Text style={styles.cardDescription}>Welcome back to your Smart Farm dashboard.</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <View
              style={[
                styles.inputWrapper,
                focusedField === 'email' && styles.inputWrapperFocused,
                errors.email ? styles.inputWrapperError : null,
              ]}
            >
              <Ionicons name="mail-outline" size={18} color="#668085" />
              <TextInput
                placeholder="farmer@smartfarm.vn"
                placeholderTextColor="#93a8ab"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  if (errors.email) setErrors((e) => ({ ...e, email: undefined }));
                }}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField((f) => (f === 'email' ? null : f))}
                style={styles.input}
              />
            </View>
            {errors.email ? <Text style={styles.fieldError}>{errors.email}</Text> : null}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View
              style={[
                styles.inputWrapper,
                focusedField === 'password' && styles.inputWrapperFocused,
                errors.password ? styles.inputWrapperError : null,
              ]}
            >
              <Ionicons name="lock-closed-outline" size={18} color="#668085" />
              <TextInput
                placeholder="Enter your password"
                placeholderTextColor="#93a8ab"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  if (errors.password) setErrors((e) => ({ ...e, password: undefined }));
                }}
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
            {errors.password ? <Text style={styles.fieldError}>{errors.password}</Text> : null}
          </View>

          <Pressable
            onPress={() => {
              void handleSubmit();
            }}
            disabled={submitting}
            style={[styles.loginButton, submitting && styles.loginButtonDisabled]}
          >
            {submitting ? (
              <ActivityIndicator color="#093814" />
            ) : (
              <Text style={styles.loginButtonText}>Sign in</Text>
            )}
          </Pressable>

          {formError ? <Text style={styles.formError}>{formError}</Text> : null}

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Don&apos;t have an account?</Text>
            <Pressable
              onPress={() => {
                router.push('/register');
              }}
              hitSlop={10}
            >
              <Text style={styles.footerLink}> Create account</Text>
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
    marginBottom: 28,
    alignItems: 'center',
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#e8fff4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  },
  logoImage: {
    width: 44,
    height: 44,
  },
  brand: {
    fontSize: 32,
    fontWeight: '800',
    color: '#11261f',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
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
  cardTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#11261f',
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    lineHeight: 21,
    color: '#62787b',
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 18,
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
    borderWidth: 1,
    borderColor: '#d6e4df',
    borderRadius: 18,
    paddingHorizontal: 16,
    minHeight: 54,
    backgroundColor: '#f9fcfa',
  },
  inputWrapperFocused: {
    borderColor: '#23f056',
    backgroundColor: '#ffffff',
  },
  inputWrapperError: {
    borderColor: '#e05757',
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#11261f',
  },
  fieldError: {
    marginTop: 6,
    fontSize: 12,
    color: '#c43d3d',
    fontWeight: '600',
  },
  loginButton: {
    marginTop: 8,
    backgroundColor: '#23f056',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    minHeight: 52,
  },
  loginButtonDisabled: {
    opacity: 0.75,
  },
  loginButtonText: {
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
