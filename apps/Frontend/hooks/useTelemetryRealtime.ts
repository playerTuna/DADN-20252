import { useEffect, useRef } from 'react';
import {
  subscribeTelemetryStream,
  type TelemetryRealtimeEvent,
} from '../services/realtime';

export function useTelemetryRealtime(
  enabled: boolean,
  onEvent: (event: TelemetryRealtimeEvent) => void
) {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    if (!enabled) return undefined;

    return subscribeTelemetryStream({
      onEvent: (event) => handlerRef.current(event),
      onError: (error) => {
        console.log('telemetry sse reconnect', error.message);
      },
    });
  }, [enabled]);
}
