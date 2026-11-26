# Telemetria SC — Star Citizen telemetry on a second screen

🇮🇹 **Guida in italiano: [LEGGIMI.md](LEGGIMI.md)**

A Windows app that shows live Star Citizen data on a second monitor, as a holographic cockpit display:

- **Server**: ping (with graph and packet loss), region, shard, IP, connection time, game build
- **Ship**: model, SCM/NAV mode, gear, lights, shields per side around the ship, speed dial, altitude tape, G meter, heading tape
- **Systems**: hydrogen, quantum, boost, warning lights, IFCS and power
- **Weapons**: weapons ready, decoys, noise, preset
- **Pilot**: health, oxygen, heart rate, aUEC
- **Event log**

The app sits as an **icon next to the clock**: when you start Star Citizen it opens the display on the
monitor you chose, and closes it when you quit the game. It detects by itself whether you started
**LIVE or PTU**. It **updates itself**.

It does not modify the game and does not read its memory: it only uses the telemetry the game itself
exposes and the `Game.log` file the game writes.

> ⚠️ The game telemetry is **not officially documented by CIG** and may change or stop working with a
> patch. Ping and server info (from `Game.log`) work anyway.

## Install

1. Open the **Releases** page: <https://github.com/alteus83/telemetria-sc/releases/latest>
2. Download **`TelemetriaSC-Setup-x.y.z.exe`** and open it.
3. Windows will show **"Windows protected your PC"** because the app is not digitally signed:
   click **More info → Run anyway**.
4. Follow the setup. At the end the **Settings** window opens.

Windows 10/11 64-bit only. The app follows the Windows language (Italian or English); you can change
it in Settings → **Language**.

## Settings

| Option | What it does |
|---|---|
| **Start with Windows** | The app starts with Windows, hidden next to the clock (off by default) |
| **Open the display when the game starts** | Opens/closes the display together with Star Citizen |
| **AUTOMATIC / LIVE / PTU** | AUTOMATIC (default) detects which version you started; LIVE/PTU force one |
| **Game folder** | The one containing `LIVE` and `PTU`. Found automatically; otherwise **Browse…** |
| **Enable telemetry in game** | Sets the Windows variable and the `user.cfg` lines (with a backup copy) |
| **Monitor** / **Full screen** | Where to show the display. On the display: **F11** full screen, **Esc** exits |
| **Language** | AUTOMATIC / ITALIANO / ENGLISH |

After pressing **Enable telemetry in game**, fully close the RSI Launcher (also from the icon next to
the clock) and restart the game. Data arrives **only when your character is in the game**.

## About the ping

Star Citizen servers (on Google Cloud) usually **do not answer** measurements from outside. The app
tries, in order: **direct** ping, **TCP** estimate, **datacenter** estimate (Google's public "gcping"
test point in the same datacenter as the shard). If none works, the ping shows `---` and only the time
**to the Google network entry** is shown ("NETWORK TO GOOGLE") — useful to check your connection, but
**not** the ping to the server.

## Troubleshooting

The app writes a log to `%APPDATA%\Telemetria SC\registro.txt` (exact path at the bottom of the
Settings window).

## Credits

Telemetry protocol definitions in `ponte/proto/` come from the open-source project
[Verse Data Gateway](https://github.com/zolij/verse-data-gateway) (Apache-2.0). `Game.log` patterns
are inspired by [komandio-mobisync](https://github.com/komandio-labs/komandio-mobisync) (MIT).

Fan-made project, not affiliated with Cloud Imperium Games. Star Citizen is a trademark of its owners.
