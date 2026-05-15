import { getApiBaseUrl } from './runtimeConfig';
import { getTokens, refresh } from './auth';

export type TelemetryRealtimeEvent = {
  type: string;
  feedKey: string;
  topic: string;
  raw: string;
  numericValue?: number;
  thresholdLevel?: 'low' | 'normal' | 'high' | 'unknown';
  receivedAt: string;
};

type StreamHandlers = {
  onEvent: (event: TelemetryRealtimeEvent) => void;
  onError?: (error: Error) => void;
};

const SENSOR_TYPES = new Set(['temp', 'air_humidity', 'soil_humidity', 'light']);
const RECONNECT_MS = 3000;

export function isSensorTelemetryType(type: string): type is 'temp' | 'air_humidity' | 'soil_humidity' | 'light' {
  return SENSOR_TYPES.has(type);
}

function parseSseBlock(block: string): TelemetryRealtimeEvent | null {
  const dataLines = block
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim());
  if (dataLines.length === 0) return null;

  const payload = dataLines.join('\n');
  try {
    const parsed = JSON.parse(payload) as TelemetryRealtimeEvent | { type?: string; data?: TelemetryRealtimeEvent };
    if (parsed && typeof parsed === 'object' && 'data' in parsed && parsed.data) {
      return parsed.data;
    }
    return parsed as TelemetryRealtimeEvent;
  } catch {
    return null;
  }
}

async function openTelemetryStream(
  signal: AbortSignal,
  onEvent: (event: TelemetryRealtimeEvent) => void
): Promise<void> {
  const tokens = await getTokens();
  if (!tokens) {
    throw new Error('Chưa đăng nhập');
  }

  const url = `${getApiBaseUrl().replace(/\/$/, '')}/realtime/telemetry`;

  const request = (accessToken: string) =>
    fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
        Authorization: `Bearer ${accessToken}`,
      },
      signal,
    });

  let response = await request(tokens.accessToken);
  if (response.status === 401) {
    const next = await refresh();
    response = await request(next.accessToken);
  }

  if (!response.ok) {
    throw new Error(`SSE telemetry failed (${response.status})`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('SSE body không đọc được');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (!signal.aborted) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split('\n\n');
    buffer = chunks.pop() ?? '';

    for (const chunk of chunks) {
      const event = parseSseBlock(chunk);
      if (event) onEvent(event);
    }
  }
}

export function subscribeTelemetryStream(handlers: StreamHandlers): () => void {
  const abort = new AbortController();
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

  const connect = async () => {
    while (!abort.signal.aborted) {
      try {
        await openTelemetryStream(abort.signal, handlers.onEvent);
      } catch (error) {
        if (abort.signal.aborted) return;
        const err = error instanceof Error ? error : new Error(String(error));
        handlers.onError?.(err);
      }

      if (abort.signal.aborted) return;
      await new Promise<void>((resolve) => {
        reconnectTimer = setTimeout(resolve, RECONNECT_MS);
      });
    }
  };

  void connect();

  return () => {
    abort.abort();
    if (reconnectTimer) clearTimeout(reconnectTimer);
  };
}
