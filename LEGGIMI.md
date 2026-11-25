# Telemetria SC — Telemetria di Star Citizen su schermo secondario

Mostra in tempo reale, su un secondo monitor (o telefono/tablet):

- **Server**: ping con grafico, pacchetti persi, regione, shard, IP, da quanto sei connesso, build del gioco
- **Nave**: modello, modalità SCM/NAV, carrello, luci
- **Volo**: velocità, velocità verticale, G, altitudine, prua
- **Sistemi**: scudi (anche per lato), scafo, idrogeno, quantum, boost
- **Spie**, **IFCS e potenza**, **armi e contromisure**
- **Personaggio**: salute, ossigeno, battito, aUEC
- **Eventi**: ingresso nell'universo, cambio shard, morti, ecc.

## Come funziona

```
Star Citizen ──(telemetria locale)──┐
Game.log ───(server, shard, IP)─────┼──► PONTE (sul PC di gioco) ──► pagina web sullo schermo secondario
Ping verso il server ───────────────┘
```

Il **ponte** è un piccolo programma che gira sul PC dove giochi. Non modifica il gioco e
non legge la sua memoria: usa solo la telemetria che il gioco stesso offre e il file
`Game.log` che il gioco scrive.

> ⚠️ La telemetria **non è documentata ufficialmente da CIG** e può cambiare o smettere di
> funzionare con una patch. Ping e dati del server (dal `Game.log`) funzionano comunque.

---

## 1. Cosa serve (una volta sola)

1. **Node.js** versione LTS: scaricalo da <https://nodejs.org> e installalo (avanti, avanti, fine).
2. **Questo progetto** sul PC: dalla pagina GitHub del repository, pulsante verde **Code → Download ZIP**,
   poi estrai la cartella dove vuoi (es. `Documenti\telemetria-sc`).

## 2. Attivare la telemetria nel gioco

### Se giochi in LIVE (4.10.x)

1. Apri **PowerShell** (tasto Windows, scrivi `powershell`, Invio).
2. Incolla questo comando e premi Invio:
   ```
   setx GRPC_CLIENT_SERVER_ENABLED true
   ```
   Deve rispondere `OPERAZIONE RIUSCITA` (o `SUCCESS`).
3. **Chiudi completamente l'RSI Launcher**, anche dall'icona vicino all'orologio di Windows
   (tasto destro → Esci). Il comando vale solo per i programmi aperti *dopo*.
4. Riapri il launcher e avvia il gioco.

Sulla LIVE si possono solo **leggere** i dati (niente comandi verso il gioco).

### Quando uscirà la 5.0 (o se provi la PTU)

Nella cartella del gioco (es. `...\StarCitizen\PTU\`) apri o crea il file `user.cfg`
con il Blocco note e aggiungi:

```
server.game.telemetry.enabled = 1
grpc.client.server.port = 29420
grpc.client.server.external = 0
```

Ricordati di cambiare anche il percorso del `Game.log` (vedi punto 4).

### Come verificare che sia attiva

Apri `Game.log` (nella cartella `LIVE` o `PTU`) e cerca la riga:

```
Local services server is running on 127.0.0.1:XXXX
```

Se c'è, la telemetria è attiva sulla porta `XXXX`. Il ponte la legge da solo.
I dati iniziano ad arrivare **solo quando il personaggio è in gioco** (non nel menu).

## 3. Avviare il ponte

Doppio clic su **`avvia-ponte.bat`** nella cartella del progetto.

La prima volta installa le librerie e prepara la pagina (un paio di minuti). Poi si apre il
browser su `http://localhost:8787`: trascina la finestra sul secondo monitor e premi **F11**
per lo schermo intero.

In alto a destra tre spie ti dicono cosa funziona:

| Spia | Verde significa | Se è rossa |
|---|---|---|
| PONTE | la pagina riceve dati dal ponte | il ponte è chiuso: riaprilo |
| LOG | `Game.log` trovato | percorso sbagliato: vedi punto 4 |
| TELEMETRIA | il gioco sta inviando dati | gioco chiuso, personaggio non in gioco o telemetria non attiva |

Per chiudere il ponte: nella finestra nera premi **CTRL + C** oppure chiudila.

### Provarlo senza il gioco

Apri un terminale nella cartella del progetto ed esegui:

```
npm install
npm run build
npm run demo
```

e apri `http://localhost:8787`: vedrai dati simulati (con la scritta DEMO).

## 4. Impostazioni personali

Copia `ponte\config.esempio.json` in `ponte\config.json` e modifica solo quello che serve:

| Chiave | A cosa serve |
|---|---|
| `gameLog` | percorso del `Game.log` se hai installato il gioco altrove o usi la PTU. Nei percorsi usa doppie barre `\\` |
| `apriInRete` | `true` per vedere lo schermo anche da telefono/tablet in casa (indirizzo `http://IP-DEL-PC:8787`). Windows potrebbe chiederti il permesso del firewall |
| `portaWeb` | se la porta 8787 è già usata da altro |
| `telemetriaPorte` | porte da provare se il `Game.log` non indica quella della telemetria |
| `intervalloPing` | ogni quanti millisecondi misurare il ping |

## 5. Note sul ping

- Il ponte usa il normale comando `ping` di Windows verso il server di gioco.
- Alcuni server **non rispondono al ping**: in quel caso il ponte passa da solo a una stima
  basata sul tempo di risposta del server, e sullo schermo compare **"ping stimato (TCP)"**.
  È un valore indicativo, non identico a quello che mostra il gioco.
- Il valore può differire da quello di `r_displayinfo` nel gioco: quello lo misura il gioco
  dall'interno e non è accessibile dall'esterno.

## Per sviluppatori

| Comando | Cosa fa |
|---|---|
| `npm run ponte` | avvia il ponte (serve la pagina già preparata con `npm run build`) |
| `npm run demo` | avvia il ponte con dati simulati |
| `npm run dev` | pagina in modalità sviluppo (con il ponte avviato a parte) |
| `npm test` | test automatici del ponte |

Struttura:

```
ponte/            programma ponte (Node.js)
  index.mjs       server web + flusso dati
  telemetria.mjs  collegamento alla telemetria del gioco
  gamelog.mjs     lettura del Game.log
  ping.mjs        misura del ping
  demo.mjs        dati simulati
  proto/          definizioni del protocollo di telemetria
  test/           test automatici
src/              pagina dello schermo (React)
```

## Crediti e licenze

Le definizioni del protocollo in `ponte/proto/` provengono dal progetto open source
[Verse Data Gateway](https://github.com/zolij/verse-data-gateway) (licenza Apache-2.0,
copia in `ponte/proto/LICENSE-Apache-2.0.txt`). Sono ricostruite dalla community e non
sono un SDK ufficiale. Le espressioni per leggere il `Game.log` si ispirano a
[komandio-mobisync](https://github.com/komandio-labs/komandio-mobisync) (MIT).

Progetto amatoriale, non affiliato a Cloud Imperium Games. Star Citizen è un marchio dei
rispettivi proprietari.
