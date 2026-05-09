from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from command_protocol import (  # noqa: E402
    ack_to_status_payload,
    format_serial_command,
    parse_gateway_command,
    parse_serial_status,
)


class CommandProtocolTests(unittest.TestCase):
    def test_parse_json_pump_on(self) -> None:
        command = parse_gateway_command(
            "pump",
            '{"commandId":"cmd_1","deviceId":"pump","value":"ON","issuedAt":"2026-04-28T10:00:00Z"}',
        )
        self.assertIsNotNone(command)
        assert command is not None
        self.assertEqual(command.command_id, "cmd_1")
        self.assertEqual(command.device_id, "pump")
        self.assertEqual(command.value, "ON")

    def test_parse_raw_pump_on(self) -> None:
        command = parse_gateway_command("pump", "ON")
        self.assertIsNotNone(command)
        assert command is not None
        self.assertIsNone(command.command_id)
        self.assertEqual(format_serial_command(command), "PUMP:ON")

    def test_parse_rgb_command(self) -> None:
        command = parse_gateway_command(
            "rgb",
            '{"commandId":"cmd_rgb","deviceId":"rgb","value":"255,0,0"}',
        )
        self.assertIsNotNone(command)
        assert command is not None
        self.assertEqual(command.value, "255,0,0")
        self.assertEqual(format_serial_command(command, "json"), 'RGB:{"deviceId":"rgb","value":"255,0,0","commandId":"cmd_rgb"}')

    def test_reject_invalid_payload(self) -> None:
        self.assertIsNone(parse_gateway_command("pump", '{"deviceId":"fan","value":"ON"}'))
        self.assertIsNone(parse_gateway_command("pump", '{"deviceId":"pump"}'))

    def test_parse_serial_status_and_fill_pending_command(self) -> None:
        ack = parse_serial_status("deviceId=pump,power=ON,status=ok", "cmd_9")
        self.assertIsNotNone(ack)
        assert ack is not None
        self.assertEqual(ack.command_id, "cmd_9")
        self.assertTrue(ack.power)
        self.assertIn('"commandId":"cmd_9"', ack_to_status_payload(ack))


if __name__ == "__main__":
    unittest.main()
