# Segnalare un problema di sicurezza

Jesse's Archive custodisce password e dati personali: le segnalazioni di sicurezza sono benvenute e vengono trattate con priorità.

**Non aprire una issue pubblica** per una vulnerabilità: finché non c'è una correzione, renderebbe il problema noto a tutti. Usa uno di questi canali privati.

## Come segnalare

1. **GitHub, segnalazione privata (consigliato):** nella scheda [Security](https://github.com/jesseaims/Jesse-Archive/security) del repository premi **Report a vulnerability**. La segnalazione resta visibile solo a te e al maintainer, e lì si può discutere e preparare la correzione.
2. **Email:** <support@jessearchive.it>, con oggetto che inizia per «[Sicurezza]».

Per domande, problemi normali o suggerimenti usa invece le [issue](https://github.com/jesseaims/Jesse-Archive/issues) o i contatti in <https://jessearchive.it/supporto/>.

## Cosa includere

- versione dell'app (la trovi in Impostazioni) e, se riguarda il browser, dell'estensione e del browser;
- cosa succede e cosa ti aspettavi, con i passaggi per riprodurlo;
- l'impatto che vedi (per esempio: dati leggibili da chi, in quali condizioni).

**Non inviare mai password, codici di recupero, vault reali o dati personali.** Usa un vault di prova creato apposta e dati inventati.

## Cosa aspettarsi

Il progetto ha un solo maintainer, che fa del suo meglio per:

- confermare la ricezione entro **7 giorni**;
- dare una prima valutazione entro **14 giorni**;
- pubblicare una correzione il prima possibile, in base alla gravità, e citarti nelle note della release se lo desideri.

Ti chiediamo di non rendere pubblico il problema finché la correzione non è disponibile, o finché non sono passati 90 giorni dalla segnalazione senza risposta.

## Versioni supportate

Le correzioni di sicurezza escono solo per **l'ultima versione pubblicata**. L'app avvisa quando c'è un aggiornamento: tienila aggiornata.

## Ambito

Rientrano: l'app desktop, l'estensione per browser, il canale tra loro, il formato e la cifratura del vault, l'aggiornamento automatico e il setup.

Limiti già noti e documentati, che non sono vulnerabilità nuove: un programma malevolo già in esecuzione con il tuo stesso utente Windows può leggere ciò che legge l'app; l'azzeramento della memoria non è completo; le esportazioni JSON e CSV sono in chiaro per scelta. Il modello di sicurezza completo è in [docs/SECURITY.md](docs/SECURITY.md).

Le ricerche fatte in buona fede, su vault e dati di prova, senza danneggiare altri utenti né accedere ai loro dati, sono benvenute.

---

## Reporting a security issue (English)

Please **do not open a public issue** for a vulnerability. Report it privately through [GitHub's private vulnerability reporting](https://github.com/jesseaims/Jesse-Archive/security) (recommended) or by email to <support@jessearchive.it> with a subject starting with "[Security]". Include the app (and extension/browser) version, steps to reproduce and the impact; never send real passwords, recovery codes, vaults or personal data. The single maintainer aims to acknowledge within 7 days and give a first assessment within 14 days. Fixes are released for the latest version only. Please keep the issue private until a fix is available, or 90 days after your report if there is no answer. Good-faith research on test vaults and data is welcome. Known limits are documented in [docs/SECURITY.md](docs/SECURITY.md).
