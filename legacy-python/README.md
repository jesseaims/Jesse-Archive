# Jesse's Archive

Password manager **100% locale**, cifrato e portatile. Nessun cloud, nessun account.

## Creare l'applicazione (.exe)
Su Windows fai doppio clic su `Crea-EXE.bat`: in un paio di minuti ottieni `Jesse's Archive.exe`, un programma a finestra nativa (nessun browser). Puoi spostarlo dove vuoi: il vault resta nella cartella `dati` accanto all'exe, quindi per portare tutto su un altro PC copia `Jesse's Archive.exe` + `dati`. Sull'altro PC non serve installare nulla (Windows 10/11 include già WebView2).

## Avvio da sorgente
1. Installa Python 3.9+.
2. Doppio clic su `Avvia.bat` (Windows) oppure `./avvia.sh` (macOS/Linux). La prima volta installa `cryptography`.
3. Si apre il browser (o una finestra nativa, se hai `pip install pywebview`). Chiudendo la scheda, il programma si chiude da solo.

## Portabilità
Il vault è un unico file cifrato: `dati/jesse_archive.vault`. Copia l'intera cartella (anche su chiavetta) su un altro computer e avvia. Per cambiare posizione: variabile d'ambiente `JESSE_ARCHIVE_VAULT`. Ad ogni salvataggio viene tenuta una copia `.bak`.

## Sicurezza
- AES-256-GCM; chiave del vault casuale, protetta dalla password principale con scrypt (N=2^15) e, in parallelo, dal codice di recupero.
- Il server ascolta solo su 127.0.0.1, con token di sessione e controllo dell'header Host.
- Blocco automatico, pulizia degli appunti, ritardo progressivo sui tentativi errati.
- Lo scanner violazioni (opzionale) invia solo i primi 5 caratteri dello SHA-1 (k-anonymity). Tutto il resto funziona offline.

## Funzioni
Elementi: password, passkey, note sicure, carte, info personali, asset cripto, cartelle, preferiti, cestino, 2FA (TOTP) · Generatore (password, passphrase, PIN, nome utente) · **Archivio password collegato agli account con storico delle precedenti** · Salute password · Scanner violazioni · Elementi condivisi (pacchetti `.jshare` cifrati) · Accesso di emergenza (codice di recupero, backup cifrato, foglio stampabile) · Import/export CSV e JSON.

## Account raggruppati (stile Kaspersky)
Nella vista **Password** gli account sono carte raggruppate per sito o app, con le frecce per scorrere gli account dello stesso gruppo. Aggiungendo un account scegli tra:
- **Sito web / Email**: i sottodomini finiscono nello stesso gruppo (es. store.epicgames.com e epicgames.com). Il logo viene scaricato una volta (solo il dominio viene inviato a DuckDuckGo; si disattiva in Impostazioni) e salvato nel vault.
- **App**: scegli tra le app del computer (Windows: menu Start; macOS: /Applications) oppure incolla il percorso di un .exe; l'icona viene presa dall'app.
- **Altro**: nome libero e icona scelta da un file del tuo computer.
Dal menu ⋮ di una carta puoi aggiungere un account allo stesso gruppo o cambiarne nome e icona.

## Aspetto
Impostazioni → Aspetto: 8 temi pronti (Ametista predefinito, Notte, Oceano, Foresta, Tramonto, Rosa, Grafite, Menta scuro) oppure **Personalizzato** con quattro colori a scelta (principale, barra laterale, sfondo, carte). I colori dei testi si adattano da soli. Il tema è salvato nel vault e si sincronizza tra i dispositivi.

## Comportamento dell'app (solo exe / finestra nativa)
Impostazioni → Comportamento dell'app:
- **Tasto X**: chiude del tutto l'applicazione oppure la riduce nell'area di notifica (system tray). Nel tray il vault si blocca; clic sull'icona per riaprire, tasto destro per «Blocca il vault» o «Esci».
- **Avvia con Windows**: aggiunge o toglie il programma dall'avvio automatico dell'utente. Parte ridotto nel tray.
Sono impostazioni **del singolo computer** (stanno in `config.json`, non nel vault sincronizzato). Se il programma è già aperto nel tray, riavviarlo riapre la finestra invece di aprirne una seconda.

## Selezione multipla
Nelle liste (Tutti gli elementi, categorie, cartelle, cestino) il pulsante **Seleziona** attiva le caselle: spunta gli elementi (Maiusc+clic per un intervallo, Ctrl+A per tutti) e usa «Sposta nel cestino», «Sposta in cartella…», «Ripristina» o «Elimina definitivamente» (solo dal cestino).

## Archivio password: selezione multipla
Nell'Archivio password il pulsante **Seleziona** permette di spuntare più password (anche con Maiusc+clic e Ctrl+A) ed eliminarle in blocco con «Elimina selezionate». Le password attuali di un account non sono selezionabili.

## Struttura
`jesse_archive.py` (backend, crittografia, API) · `ui/index.html` (interfaccia) · `dati/` (vault).
