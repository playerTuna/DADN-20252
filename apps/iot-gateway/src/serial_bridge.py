from __future__ import annotations

import json
import logging
import queue
import threading
import time
from dataclasses import dataclass
from typing import Any

import serial  # type: ignore[import-untyped]

logger = logging.getLogger(__name__)

@dataclass(frozen=True)
class SerialTelemetry:
    key: str
    value: str
    received_at: float
    raw: str


class SerialBridge:
    """
    Simple serial bridge:
    - reads newline-delimited lines from microbit
    - parses either JSON or 'k=v,k=v' format
    - emits (key,value) items through a thread-safe queue
    - can write command lines back to microbit
    """

    def __init__(self, port: str, baud: int) -> None:
        self._port = port
        self._baud = baud
        self._ser: serial.Serial | None = None
        self._rx_thread: threading.Thread | None = None
        self._stop = threading.Event()
        self._out = queue.Queue[SerialTelemetry](maxsize=1000)

    def start(self) -> None:
        self._ser = serial.Serial(self._port, self._baud, timeout=1)
        logger.info(f"Opened serial port {self._port} at {self._baud} baud.")
        self._rx_thread = threading.Thread(target=self._rx_loop, name="serial-rx", daemon=True)
        self._rx_thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._rx_thread:
            self._rx_thread.join(timeout=2)
        if self._ser:
            try:
                self._ser.close()
                logger.info(f"Closed serial port {self._port}.")
            except Exception:
                pass

    def read_queue(self) -> "queue.Queue[SerialTelemetry]":
        return self._out

    def write_line(self, line: str) -> None:
        if not self._ser:
            return
        data = (line.rstrip("\n") + "\n").encode("utf-8")
        self._ser.write(data)
        logger.info(f"Sent serial command: {line.split(':', 1)[0]}")

    def _rx_loop(self) -> None:
        assert self._ser is not None
        while not self._stop.is_set():
            try:
                raw = self._ser.readline().decode("utf-8", errors="replace").strip()
                if not raw:
                    continue
                ts = time.time()
                for k, v in self._parse_line(raw):
                    item = SerialTelemetry(key=k, value=v, received_at=ts, raw=raw)
                    try:
                        self._out.put_nowait(item)
                    except queue.Full:
                        # drop oldest by clearing a bit
                        try:
                            _ = self._out.get_nowait()
                        except queue.Empty:
                            # Should not happen if queue was full, but good to be safe
                            continue
                        logger.warning("Serial queue was full, dropped oldest item.")
            except Exception as e:
                logger.error(f"Error in serial RX loop: {e}", exc_info=True)
                time.sleep(0.25)

    def _parse_line(self, raw: str) -> list[tuple[str, str]]:
        # JSON: {"temp":25.1,"humi":60,"light":123}
        if raw.startswith("{") and raw.endswith("}"):
            try:
                obj = json.loads(raw)
                if isinstance(obj, dict):
                    return [(str(k), str(obj[k])) for k in obj.keys()]
            except Exception:
                return []

        # CSV k=v,k=v
        parts = [p.strip() for p in raw.split(",") if p.strip()]
        out: list[tuple[str, str]] = []
        for part in parts:
            if "=" in part:
                k, v = part.split("=", 1)
                out.append((k.strip(), v.strip()))
        return out

