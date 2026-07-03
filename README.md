# T-IOT-77 — M5Stack LoRa 868MHz

Projet IoT M5Stack Core (M5GO) avec module LoRa 868 MHz.

## Matériel
- M5Stack Core (M5GO)
- Module LoRa 868 MHz (SX1276)

## Pinout LoRa
| Signal | GPIO |
|--------|------|
| SCK    | 18   |
| MISO   | 19   |
| MOSI   | 23   |
| CS/NSS | 5    |
| RESET  | 36   |
| DIO0   | 26   |

## Upload
```bash
# Depuis VS Code : Ctrl+Shift+P → PlatformIO: Upload
# Ou via terminal :
~/.platformio/penv/bin/pio run --target upload
```

## Monitor Série
```bash
~/.platformio/penv/bin/pio device monitor --port /dev/tty.usbserial-0213F99E --baud 115200
```

## Utilisation
| Bouton | Action |
|--------|--------|
| **A** (gauche) | Envoyer un paquet LoRa |
| **B** (milieu) | Écouter les paquets (5 sec) |
| **C** (droite) | Reset compteur |


# Compiler + flasher
~/.platformio/penv/bin/pio run --target upload

# Juste voir les logs série
~/.platformio/penv/bin/pio device monitor