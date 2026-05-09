# IoT Gateway (Python)

Gateway bridge between the device over serial and Adafruit IO over MQTT.

## Runtime env

The gateway loads runtime env from:

1. repo root `.env`
2. fallback `apps/backend/.env`

Use the root `.env` as the primary runtime source.

Required values:

- `ADAFRUIT_IO_USERNAME`
- `ADAFRUIT_IO_KEY`
- `SERIAL_PORT` such as `COM3`
- `SERIAL_BAUD`
- `FEED_*_KEY`
- `COMMAND_PAYLOAD_FORMAT=raw|json` on backend
- `GATEWAY_SERIAL_COMMAND_FORMAT=raw|json` on gateway

## Run

```powershell
cd apps/iot-gateway
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
python src/main.py
```

## Microcontroller protocol

Telemetry from the device should prefer canonical keys:

- JSON: `{"temp":25.1,"air_humidity":60,"soil_humidity":45,"light":123}`
- CSV: `temp=25.1,air_humidity=60,soil_humidity=45,light=123`

The gateway also accepts compatibility aliases:

- `humi` -> `air_humidity`
- `soil`, `soil_humi` -> `soil_humidity`
- `water-pump` -> `pump`

Commands sent down to the device:

- `FAN:<payload>`
- `PUMP:<payload>`
- `SPEAKER:<payload>`
- `RGB:<payload>`
- `STATUS:<payload>`

MQTT commands received by the gateway now support both formats:

Raw legacy payload:

```text
ON
```

JSON envelope:

```json
{
  "commandId": "cmd_xxx",
  "deviceId": "pump",
  "value": "ON",
  "issuedAt": "2026-04-28T10:00:00Z"
}
```

Behavior:

- backend `COMMAND_PAYLOAD_FORMAT=raw` keeps legacy MQTT payloads
- backend `COMMAND_PAYLOAD_FORMAT=json` sends the JSON envelope above
- gateway still accepts both
- gateway `GATEWAY_SERIAL_COMMAND_FORMAT=raw` keeps serial output like `PUMP:ON`
- gateway `GATEWAY_SERIAL_COMMAND_FORMAT=json` sends serial like:

```text
PUMP:{"deviceId":"pump","value":"ON","commandId":"cmd_xxx","issuedAt":"2026-04-28T10:00:00Z"}
```

## ACK / status payload

The backend now expects hardware ACK or readback on the existing `status` feed as JSON.

Recommended payload:

```json
{
  "deviceId": "pump",
  "commandId": "cmd_xxx",
  "power": true,
  "status": "ok",
  "timestamp": "2026-04-28T10:00:03Z"
}
```

Notes:

- `deviceId` should match one of `fan`, `pump`, `speaker`, `rgb`
- `commandId` should be echoed from the command correlation id when the gateway/device supports it
- `power` is the actual hardware state after applying the command
- `status` should be `ok` for a real hardware confirmation
- `timestamp` should be UTC ISO-8601 if available

If the gateway cannot correlate `commandId` yet, it should still publish:

```json
{
  "deviceId": "pump",
  "power": true,
  "timestamp": "2026-04-28T10:00:03Z"
}
```

That fallback updates hardware readback / last seen, but it will not confirm a specific command log.

## Manual MQTT test

Send a legacy raw command:

```powershell
mosquitto_pub -h io.adafruit.com `
  -u "$env:ADAFRUIT_IO_USERNAME" `
  -P "$env:ADAFRUIT_IO_KEY" `
  -t "$env:ADAFRUIT_IO_USERNAME/feeds/$env:FEED_PUMP_KEY" `
  -m "ON"
```

Send a JSON command envelope:

```powershell
mosquitto_pub -h io.adafruit.com `
  -u "$env:ADAFRUIT_IO_USERNAME" `
  -P "$env:ADAFRUIT_IO_KEY" `
  -t "$env:ADAFRUIT_IO_USERNAME/feeds/$env:FEED_PUMP_KEY" `
  -m "{\"commandId\":\"cmd_demo_1\",\"deviceId\":\"pump\",\"value\":\"ON\",\"issuedAt\":\"2026-04-28T10:00:00Z\"}"
```

Send a mock ACK/status back:

```powershell
mosquitto_pub -h io.adafruit.com `
  -u "$env:ADAFRUIT_IO_USERNAME" `
  -P "$env:ADAFRUIT_IO_KEY" `
  -t "$env:ADAFRUIT_IO_USERNAME/feeds/$env:FEED_STATUS_KEY" `
  -m "{\"deviceId\":\"pump\",\"commandId\":\"cmd_demo_1\",\"power\":true,\"status\":\"ok\",\"timestamp\":\"2026-04-28T10:00:03Z\"}"
```
