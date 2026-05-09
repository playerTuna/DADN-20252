from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from topics import LogicalFeedKey, normalize_logical_key

CONTROLLABLE_KEYS: tuple[LogicalFeedKey, ...] = ("fan", "pump", "speaker", "rgb")


@dataclass(frozen=True)
class GatewayCommand:
    logical_key: LogicalFeedKey
    device_id: str
    value: str
    command_id: str | None = None
    issued_at: str | None = None
    raw_payload: str | None = None


@dataclass(frozen=True)
class GatewayAck:
    device_id: str
    power: bool | None
    status: str
    timestamp: str
    command_id: str | None = None


def parse_gateway_command(logical_key: LogicalFeedKey, payload: str) -> GatewayCommand | None:
    cleaned = payload.strip()
    if logical_key not in CONTROLLABLE_KEYS:
        return None

    if cleaned.startswith("{") and cleaned.endswith("}"):
        try:
            parsed = json.loads(cleaned)
        except json.JSONDecodeError:
            return None
        if not isinstance(parsed, dict):
            return None

        device_id = str(parsed.get("deviceId", "")).strip().lower()
        value = parsed.get("value")
        command_id = parsed.get("commandId")
        issued_at = parsed.get("issuedAt")

        normalized_device = normalize_logical_key(device_id)
        if normalized_device is None or normalized_device != logical_key:
            return None
        if value is None:
            return None
        if not isinstance(value, str):
            value = json.dumps(value, separators=(",", ":"))

        return GatewayCommand(
            logical_key=logical_key,
            device_id=device_id,
            value=value.strip(),
            command_id=str(command_id).strip() if command_id else None,
            issued_at=str(issued_at).strip() if issued_at else None,
            raw_payload=cleaned,
        )

    if not cleaned:
        return None

    return GatewayCommand(
        logical_key=logical_key,
        device_id=logical_key,
        value=cleaned,
        raw_payload=cleaned,
    )


def format_serial_command(command: GatewayCommand, serial_format: str = "raw") -> str:
    normalized_format = serial_format.strip().lower()
    serial_key = command.logical_key.upper()

    if normalized_format == "json":
        payload: dict[str, Any] = {
            "deviceId": command.device_id,
            "value": command.value,
        }
        if command.command_id:
            payload["commandId"] = command.command_id
        if command.issued_at:
            payload["issuedAt"] = command.issued_at
        return f"{serial_key}:{json.dumps(payload, separators=(',', ':'))}"

    return f"{serial_key}:{command.value}"


def parse_serial_status(raw: str, pending_command_id: str | None = None) -> GatewayAck | None:
    cleaned = raw.strip()
    if not cleaned:
        return None

    parsed = _parse_status_object(cleaned)
    if parsed is None:
        return None

    device_id = str(parsed.get("deviceId", "")).strip().lower()
    normalized_device = normalize_logical_key(device_id)
    if normalized_device not in CONTROLLABLE_KEYS:
        return None

    power = _parse_power(parsed.get("power"))
    status = str(parsed.get("status", "ok")).strip().lower() or "ok"
    timestamp = _normalize_timestamp(parsed.get("timestamp"))
    command_id = parsed.get("commandId") or pending_command_id

    return GatewayAck(
        device_id=normalized_device,
        power=power,
        status=status,
        timestamp=timestamp,
        command_id=str(command_id).strip() if command_id else None,
    )


def ack_to_status_payload(ack: GatewayAck) -> str:
    payload: dict[str, Any] = {
        "deviceId": ack.device_id,
        "status": ack.status,
        "timestamp": ack.timestamp,
    }
    if ack.command_id:
        payload["commandId"] = ack.command_id
    if ack.power is not None:
        payload["power"] = ack.power
    return json.dumps(payload, separators=(",", ":"))


def _parse_status_object(raw: str) -> dict[str, Any] | None:
    if raw.startswith("{") and raw.endswith("}"):
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            return None
        return parsed if isinstance(parsed, dict) else None

    parts = [part.strip() for part in raw.split(",") if part.strip()]
    if not parts:
        return None

    obj: dict[str, Any] = {}
    for part in parts:
        if "=" not in part:
            return None
        key, value = part.split("=", 1)
        obj[key.strip()] = value.strip()
    return obj


def _parse_power(value: Any) -> bool | None:
    if isinstance(value, bool):
        return value
    if value is None:
        return None
    normalized = str(value).strip().lower()
    if normalized in {"1", "on", "true", "ok"}:
        return True
    if normalized in {"0", "off", "false"}:
        return False
    return None


def _normalize_timestamp(value: Any) -> str:
    if isinstance(value, str) and value.strip():
        return value.strip()
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
