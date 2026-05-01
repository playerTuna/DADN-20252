from __future__ import annotations

import os
import signal
import sys
import logging
import time

from pathlib import Path

from dotenv import load_dotenv

from command_protocol import (
    ack_to_status_payload,
    format_serial_command,
    parse_gateway_command,
    parse_serial_status,
)
from mqtt_client import MqttClient, load_mqtt_config
from serial_bridge import SerialBridge
from topics import (
    ALL_LOGICAL_KEYS,
    LogicalFeedKey,
    get_feed_key,
    normalize_serial_key,
    parse_keys_csv,
)

logger = logging.getLogger(__name__)


def resolve_logical_from_feed(
    topic: str, reverse_feed_key_mapping: dict[str, LogicalFeedKey]
) -> LogicalFeedKey | None:
    username = os.getenv("ADAFRUIT_IO_USERNAME", "").strip()
    prefix = f"{username}/feeds/"
    if not topic.startswith(prefix):
        return None
    feed_key_from_topic = topic[len(prefix) :]
    return reverse_feed_key_mapping.get(feed_key_from_topic)


def main() -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    )

    env_candidates = [
        Path(__file__).resolve().parents[3] / ".env",
        Path(__file__).resolve().parents[2] / "backend" / ".env",
    ]
    env_source = next((candidate for candidate in env_candidates if candidate.exists()), None)
    if env_source:
        load_dotenv(dotenv_path=env_source)
        logger.info(f"Gateway runtime env source: {env_source}")
    else:
        logger.warning("Gateway runtime env source: no .env file found.")

    reverse_feed_key_mapping = {get_feed_key(lk): lk for lk in ALL_LOGICAL_KEYS}

    serial_port = os.getenv("SERIAL_PORT", "").strip()
    serial_baud = int(os.getenv("SERIAL_BAUD", "115200"))
    if not serial_port:
        print("Missing SERIAL_PORT in .env", file=sys.stderr)
        return 2

    publish_keys = parse_keys_csv(
        os.getenv("GATEWAY_PUBLISH_FEEDS", "temp,air_humidity,soil_humidity,light,status,stream"),
        ALL_LOGICAL_KEYS,
    )
    logger.info(f"Gateway publish logical keys: {', '.join(publish_keys)}")
    serial_command_format = os.getenv("GATEWAY_SERIAL_COMMAND_FORMAT", "raw").strip().lower()
    pending_command_ids: dict[str, tuple[str, float]] = {}

    bridge = SerialBridge(port=serial_port, baud=serial_baud)

    def on_mqtt_message(topic: str, payload: str) -> None:
        logical = resolve_logical_from_feed(topic, reverse_feed_key_mapping)
        if logical is None:
            logger.warning(f"Ignoring MQTT topic without logical mapping: {topic}")
            return

        if logical in {"fan", "pump", "speaker", "rgb"}:
            command = parse_gateway_command(logical, payload)
            if command is None:
                logger.warning(f"Ignoring invalid command payload for {logical}: {payload}")
                return
            if command.command_id:
                pending_command_ids[command.device_id] = (command.command_id, time.time())
            bridge.write_line(format_serial_command(command, serial_command_format))
        elif logical == "status":
            bridge.write_line(f"STATUS:{payload}")

    mqtt_cfg = load_mqtt_config()
    client = MqttClient(mqtt_cfg, on_message=on_mqtt_message)

    stop = False

    def _handle_stop(_sig, _frame) -> None:  # noqa: ANN001
        nonlocal stop
        stop = True

    signal.signal(signal.SIGINT, _handle_stop)
    signal.signal(signal.SIGTERM, _handle_stop)

    try:
        bridge.start()
        client.connect()
    except Exception as exc:
        logger.error(f"Gateway startup failed: {exc}")
        bridge.stop()
        return 1

    q = bridge.read_queue()
    try:
        while not stop:
            try:
                item = q.get(timeout=0.5)
            except Exception:
                continue

            status_ack = parse_serial_status(item.raw)
            if status_ack is not None:
                if status_ack.command_id is None:
                    pending_entry = pending_command_ids.get(status_ack.device_id)
                    if pending_entry is not None:
                        status_ack = status_ack.__class__(
                            device_id=status_ack.device_id,
                            power=status_ack.power,
                            status=status_ack.status,
                            timestamp=status_ack.timestamp,
                            command_id=pending_entry[0],
                        )
                if status_ack.command_id:
                    pending_command_ids.pop(status_ack.device_id, None)
                client.publish("status", ack_to_status_payload(status_ack))
                continue

            expired_devices = [
                device_id
                for device_id, (_, created_at) in pending_command_ids.items()
                if time.time() - created_at > 120
            ]
            for device_id in expired_devices:
                pending_command_ids.pop(device_id, None)

            key = normalize_serial_key(item.key)
            if key is None:
                logger.warning(f"Ignoring unmapped serial telemetry key: {item.key}")
                continue

            if key not in publish_keys:
                logger.info(f"Ignoring serial telemetry outside publish set: {key}")
                continue

            logger.info(f"Forwarding serial telemetry: {key}")
            client.publish(key, item.value)
    finally:
        client.disconnect()
        bridge.stop()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
