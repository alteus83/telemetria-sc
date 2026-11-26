# Telemetria SC — Telemetria di Star Citizen su schermo secondario

🇬🇧 **English guide: [README.md](README.md)**

Un'app per Windows che mostra in tempo reale, su un secondo monitor:

- **Server**: ping con grafico, pacchetti persi, regione, shard, IP, da quanto sei connesso, build del gioco
- **Nave**: modello, modalità SCM/NAV, carrello, luci
- **Volo**: velocità, velocità verticale, G, altitudine, prua
- **Sistemi**: scudi (anche per lato), scafo, idrogeno, quantum, boost
- **Spie**, **IFCS e potenza**, **armi e contromisure**
- **Personaggio**: salute, ossigeno, battito, aUEC
- **Eventi**: ingresso nell'universo, cambio shard, morti, ecc.

L'app resta come **icona vicino all'orologio**: quando avvii Star Citizen apre da sola la
schermata sul monitor scelto, quando chiudi il gioco la chiude.

Non modifica il gioco e non legge la sua memoria: usa solo la telemetria che il gioco
stesso offre e il file `Game.log` che il gioco scrive.

> ⚠️ La telemetria **non è documentata ufficialmente da CIG** e può cambiare o smettere di
> funzionare con una patch. Ping e dati del server (dal `Game.log`) funzionano comunque.

---

## 1. Installare l'app

1. Apri la pagina **Releases** del repository:
   <https://github.com/alteus83/telemetria-sc/releases/latest>
2. Scarica **`TelemetriaSC-Setup-x.y.z.exe`**.
3. Aprilo. Windows mostrerà **"PC protetto da Windows"** perché l'app non è firmata
   digitalmente: clicca **Ulteriori informazioni → Esegui comunque**.
4. Segui l'installazione. Alla fine si apre la finestra **Impostazioni**.

Non serve installare nient'altro (niente Node.js, niente comandi).

## 2. Impostazioni

| Voce | A cosa serve |
|---|---|
| **Avvia all'accensione del PC** | Se attiva, l'app parte da sola con Windows (nascosta nell'icona). Puoi attivarla o spegnerla quando vuoi |
| **Apri la schermata quando parte il gioco** | Apre e chiude la schermata insieme a Star Citizen |
| **AUTOMATICA / LIVE / PTU** | Con **AUTOMATICA** (predefinita) l'app capisce da sola se hai avviato la LIVE o la PTU guardando da quale cartella parte il gioco, e legge il `Game.log` giusto. LIVE o PTU servono solo per forzarne una |
| **Cartella del gioco** | Quella che contiene `LIVE` e `PTU` (es. `C:\Giochi\StarCitizen`). Con la scelta automatica viene aggiornata da sola all'avvio del gioco; altrimenti premi **Sfoglia…** |
| **Attiva telemetria nel gioco** | Fa da solo i passi del punto 3 (variabile di Windows e `user.cfg`, con copia di sicurezza) |
| **Monitor** | Su quale schermo aprire la schermata |
| **Schermo intero** | Nella schermata: **F11** attiva/disattiva, **Esc** esce dallo schermo intero |
| **Lingua** | AUTOMATICA (quella di Windows), ITALIANO o ENGLISH: vale per schermata, Impostazioni e menu |

Le impostazioni si salvano subito. Per riaprirle:
- sulla schermata, pulsante **⚙ F2** in alto a destra (oppure il tasto **F2**);
- tasto destro sull'icona vicino all'orologio → **Impostazioni…** (su Windows 11 l'icona può
  essere nascosta sotto la freccetta **^**);
- oppure riapri l'app dal menu Start.

La schermata si adatta da sola ai **monitor verticali** (più alti che larghi) con un cruscotto
disposto in verticale.

## 3. Attivare la telemetria nel gioco

Senza questo passo funzionano solo ping e dati del server; con questo passo anche nave,
volo, sistemi, armi e personaggio.

### LIVE (4.10.x)

1. Apri **PowerShell** (tasto Windows, scrivi `powershell`, Invio).
2. Incolla e premi Invio:
   ```
   setx GRPC_CLIENT_SERVER_ENABLED true
   ```
   Deve rispondere `OPERAZIONE RIUSCITA` (o `SUCCESS`).
3. **Chiudi completamente l'RSI Launcher**, anche dall'icona vicino all'orologio
   (tasto destro → Esci), poi riaprilo e avvia il gioco.

Sulla LIVE si possono solo **leggere** i dati.

### PTU / 5.0

Nella cartella `PTU` del gioco apri o crea `user.cfg` con il Blocco note e aggiungi:

```
server.game.telemetry.enabled = 1
grpc.client.server.port = 29420
grpc.client.server.external = 0
```

e nelle Impostazioni dell'app scegli **PTU**.

### Verifica

In `Game.log` deve comparire la riga:

```
Local services server is running on 127.0.0.1:XXXX
```

I dati arrivano **solo quando il personaggio è in gioco** (non nel menu).

L'app prova da sola anche **tutte le porte su cui il gioco è in ascolto**, nel caso una build
apra la telemetria su una porta diversa da quella richiesta. Nel registro (punto 6) trovi le
porte provate e il motivo per cui non hanno risposto.

## 4. Le spie in alto nella schermata

| Spia | Verde significa | Se è rossa |
|---|---|---|
| GIOCO | Star Citizen è aperto | il gioco è chiuso |
| LOG | `Game.log` trovato | cartella sbagliata: controlla le Impostazioni |
| TELEMETRIA | il gioco sta inviando dati | personaggio non in gioco o telemetria non attiva (punto 3) |

## 5. Note sul ping

I server di Star Citizen (su Google Cloud) di solito **non rispondono** a misure dall'esterno.
L'app prova questi metodi in ordine e si ferma sul primo che funziona (in alto a destra del
pannello SERVER compare quale):

1. **DIRETTO**: il normale `ping` di Windows.
2. **STIMA · TCP**: tempo di risposta a una richiesta di connessione.
3. **STIMA · DATACENTER**: dall'IP del server ricava il datacenter Google (elenco ufficiale di
   Google) e misura il punto di test pubblico "gcping" nello stesso datacenter.
4. **SERVER NON MISURABILE**: se nient'altro funziona, il ping resta `---` e viene mostrato solo
   il tempo **fino all'ingresso nella rete Google** ("RETE FINO A GOOGLE"): utile per vedere se la
   tua connessione è stabile, ma **non** è il ping verso il server.

Il registro dell'app (punto 6) dice perché un metodo non ha funzionato.
Il valore può differire da quello di `r_displayinfo` nel gioco, che non è accessibile dall'esterno.

## Aggiornamenti

Dalla versione 2.1.1 l'app si aggiorna da sola: controlla all'avvio e ogni 4 ore, scarica la
nuova versione in silenzio e la installa con un clic sull'avviso (o quando chiudi l'app).

## 6. Se qualcosa non va

L'app scrive un registro in `%APPDATA%\Telemetria SC\registro.txt` (il percorso esatto è in
fondo alla finestra Impostazioni). Mandalo insieme a uno screenshot.

---

## Per sviluppatori

| Comando | Cosa fa |
|---|---|
| `npm run app` | avvia l'app (Electron) dal codice |
| `npm run pacchetto` | crea l'installatore Windows in `release/` (meglio su Windows) |
| `npm run ponte` | solo il motore, da terminale, con la pagina su `http://localhost:8787` (impostazioni in `ponte/config.json`, vedi `ponte/config.esempio.json`) |
| `npm run demo` | come sopra, con dati simulati |
| `npm run dev` | pagina in modalità sviluppo (con il ponte avviato a parte) |
| `npm test` | test automatici |

A ogni modifica del codice su GitHub, l'automazione `.github/workflows/app-windows.yml`
costruisce l'installatore su una macchina Windows e lo pubblica nella pagina Releases.

Struttura:

```
app/              app Windows (Electron): icona, impostazioni, finestre
ponte/            motore della telemetria (Node.js)
  server.mjs      server web + flusso dati verso la schermata
  telemetria.mjs  collegamento alla telemetria del gioco
  gamelog.mjs     lettura del Game.log
  ping.mjs        misura del ping
  processo.mjs    controllo "il gioco è aperto?"
  demo.mjs        dati simulati
  index.mjs       avvio da terminale
  proto/          definizioni del protocollo di telemetria
  test/           test automatici
src/              schermata (React)
build/            icona per l'installatore
```

## Crediti e licenze

Le definizioni del protocollo in `ponte/proto/` provengono dal progetto open source
[Verse Data Gateway](https://github.com/zolij/verse-data-gateway) (licenza Apache-2.0,
copia in `ponte/proto/LICENSE-Apache-2.0.txt`). Sono ricostruite dalla community e non
sono un SDK ufficiale. Le espressioni per leggere il `Game.log` si ispirano a
[komandio-mobisync](https://github.com/komandio-labs/komandio-mobisync) (MIT).

Progetto amatoriale, non affiliato a Cloud Imperium Games. Star Citizen è un marchio dei
rispettivi proprietari.
