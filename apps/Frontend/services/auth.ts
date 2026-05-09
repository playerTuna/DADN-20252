import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { getApiBaseUrl } from "./runtimeConfig";

type Tokens = {
  accessToken: string;
  refreshToken: string;
};

type AuthUser = {
  id: string;
  email: string;
};

type AuthResponse = Tokens & { user: AuthUser };
type ApiErrorBody = {
  message?: string | string[];
  error?: string;
  statusCode?: number;
};

const ACCESS_KEY = "auth.accessToken";
const REFRESH_KEY = "auth.refreshToken";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STRONG_PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,64}$/;

async function setItem(key: string, value: string) {
  // SecureStore on web can be flaky depending on environment; use localStorage fallback.
  if (Platform.OS === "web") {
    try {
      localStorage.setItem(key, value);
      return;
    } catch {
      // fall through
    }
  }
  await SecureStore.setItemAsync(key, value);
}

async function getItem(key: string) {
  if (Platform.OS === "web") {
    try {
      const v = localStorage.getItem(key);
      if (v != null) return v;
    } catch {
      // fall through
    }
  }
  return SecureStore.getItemAsync(key);
}

async function deleteItem(key: string) {
  if (Platform.OS === "web") {
    try {
      localStorage.removeItem(key);
      return;
    } catch {
      // fall through
    }
  }
  await SecureStore.deleteItemAsync(key);
}

function tryParseApiError(text: string): ApiErrorBody | null {
  if (!text) return null;
  try {
    return JSON.parse(text) as ApiErrorBody;
  } catch {
    return null;
  }
}

function normalizeMessage(body: ApiErrorBody | null): string {
  if (!body?.message) return "";
  if (Array.isArray(body.message)) return body.message.join(", ");
  return body.message;
}

function buildFriendlyAuthError(path: string, status: number, text: string): string {
  const parsed = tryParseApiError(text);
  const backendMessage = normalizeMessage(parsed).toLowerCase();

  if (path === "/auth/login") {
    if (status === 401 || backendMessage.includes("invalid credentials")) {
      return "Email hoặc mật khẩu không đúng.";
    }
    if (status === 400) return "Thông tin đăng nhập chưa hợp lệ.";
    return "Đăng nhập thất bại. Vui lòng thử lại.";
  }

  if (path === "/auth/register") {
    if (backendMessage.includes("already registered")) {
      return "Email đã tồn tại. Vui lòng dùng email khác.";
    }
    if (status === 400) return "Thông tin đăng ký chưa hợp lệ.";
    return "Đăng ký thất bại. Vui lòng thử lại.";
  }

  if (path === "/auth/refresh") return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  if (path === "/auth/logout") return "Đăng xuất thất bại. Vui lòng thử lại.";
  return "Có lỗi xác thực xảy ra. Vui lòng thử lại.";
}

export function validateEmailInput(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return "Vui lòng nhập email.";
  if (!EMAIL_REGEX.test(trimmed)) return "Email không hợp lệ.";
  return null;
}

export function validatePasswordInput(password: string): string | null {
  if (!password) return "Vui lòng nhập mật khẩu.";
  if (!STRONG_PASSWORD_REGEX.test(password)) {
    return "Mật khẩu phải từ 8 ký tự, có chữ và số.";
  }
  return null;
}

export async function getTokens(): Promise<Tokens | null> {
  const [accessToken, refreshToken] = await Promise.all([getItem(ACCESS_KEY), getItem(REFRESH_KEY)]);
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export async function setTokens(tokens: Tokens) {
  await Promise.all([setItem(ACCESS_KEY, tokens.accessToken), setItem(REFRESH_KEY, tokens.refreshToken)]);
}

export async function clearTokens() {
  await Promise.all([deleteItem(ACCESS_KEY), deleteItem(REFRESH_KEY)]);
}

async function authPost<T>(path: string, body: unknown, accessToken?: string): Promise<T> {
  const url = `${getApiBaseUrl().replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(buildFriendlyAuthError(path, res.status, text));
  }
  return (text ? (JSON.parse(text) as T) : ({} as T));
}

export async function register(email: string, password: string): Promise<AuthResponse> {
  const data = await authPost<AuthResponse>("/auth/register", { email, password });
  await setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
  return data;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const data = await authPost<AuthResponse>("/auth/login", { email, password });
  await setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
  return data;
}

export async function refresh(): Promise<Tokens> {
  const tokens = await getTokens();
  if (!tokens) throw new Error("No refresh token");
  const data = await authPost<Tokens>("/auth/refresh", { refreshToken: tokens.refreshToken });
  await setTokens(data);
  return data;
}

export async function logout(): Promise<void> {
  const tokens = await getTokens();
  if (tokens) {
    await authPost("/auth/logout", { refreshToken: tokens.refreshToken }).catch(() => undefined);
  }
  await clearTokens();
}

export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const tokens = await getTokens();
  const url = input.startsWith("http") ? input : `${getApiBaseUrl().replace(/\/$/, "")}/${input.replace(/^\//, "")}`;

  const withAuth = async (accessToken?: string) => {
    const headers = new Headers(init?.headers ?? {});
    if (!headers.has("Accept")) headers.set("Accept", "application/json");
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
    return fetch(url, { ...init, headers });
  };

  const first = await withAuth(tokens?.accessToken);
  if (first.status !== 401) return first;

  // Retry once after refresh.
  try {
    const nextTokens = await refresh();
    return await withAuth(nextTokens.accessToken);
  } catch {
    await clearTokens();
    return first;
  }
}

