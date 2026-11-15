# Dual Subs

Estensione per browser basati su Chromium (Brave, Chrome, Edge, Vivaldi,
Opera…, versione 111 o superiore) che su **Netflix**, **Prime Video** e **Disney+** mostra
un secondo sottotitolo, in un'altra lingua, sopra il video. Il sottotitolo
principale resta quello nativo della piattaforma.

Prime Video funziona su `primevideo.com` e sulle pagine `amazon.<paese>/gp/video/`
(Italia, USA, Regno Unito, Germania, Francia, Spagna, Giappone e altri). Se
arrivi a Prime Video navigando dalla home del negozio Amazon, ricarica la
pagina una volta: l'estensione si attiva solo all'apertura di una pagina video.

Su Disney+ i sottotitoli seguono il tempo del programma esposto dal player, così
restano allineati anche dopo pubblicità e sigle; durante le interruzioni il
secondo sottotitolo viene nascosto.

## Installazione per lo sviluppo

1. Apri la pagina delle estensioni (`brave://extensions`, `chrome://extensions`,
   `edge://extensions`).
2. Attiva **Modalità sviluppatore**.
3. **Carica estensione non pacchettizzata** → scegli questa cartella.
4. Dopo ogni modifica al codice: icona di ricarica sulla scheda di Dual Subs,
   **poi** ricarica la pagina di Netflix (F5). Il popup si aggiorna da solo, gli
   script nella pagina no.

## Uso

Clicca l'icona di Dual Subs (fissala dal menu a forma di puzzle) mentre guardi
un titolo:

- interruttore: attiva o disattiva il secondo sottotitolo;
- **Lingua**: le lingue del titolo corrente; quelle disponibili solo come
  immagini sono grigie;
- **Posizione**: in alto o in basso;
- **Dimensione del testo**: dal 60% al 200%.

Le scelte vengono salvate e applicate subito.

## Struttura

| File | Mondo | Ruolo |
|---|---|---|
| `vtt-parser.js` | MAIN | Parser WebVTT (Netflix) e ricerca binaria della battuta (puro, testato) |
| `ttml-parser.js` | MAIN | Parser TTML/DFXP (Prime Video) (puro, testato) |
| `hls.js` | MAIN | Playlist HLS e segmenti WebVTT (Disney+) (testato) |
| `tracks.js` | MAIN | Scelta della traccia per lingua, comune a tutte le piattaforme (puro, testato) |
| `platforms/netflix.js` | MAIN | Adattatore Netflix: profilo WebVTT, manifest, player |
| `platforms/prime.js` | MAIN | Adattatore Prime Video: risorse di riproduzione, player |
| `platforms/disney.js` | MAIN | Adattatore Disney+: playlist principale, orologio del programma |
| `overlay.js` | MAIN | Overlay sul player, `MutationObserver`, schermo intero |
| `page.js` | MAIN | Sceglie l'adattatore, hook su JSON/XHR, navigazione, download, stato |
| `content.js` | ISOLATED | Ponte tra pagina, popup e `chrome.storage` |
| `popup.*` | – | Interfaccia delle impostazioni |
| `_locales/` | – | Testi dell'interfaccia, solo in inglese |
| `scripts/` | – | `pack.js` crea lo zip, `make-icons.js` genera le icone |
| `store/` | – | Testi per lo store e privacy policy |

## Test

Serve Node.js 18+ (solo per lo sviluppo):

```sh
node --test tests/
```

## Debug

Di base l'estensione scrive in console solo gli avvisi. Per i log dettagliati,
nella console della scheda di Netflix, Prime Video o Disney+ (F12 → Console):

```js
localStorage.dualSubsDebug = '1'   // attiva, poi ricarica la pagina
delete localStorage.dualSubsDebug  // disattiva
```

Tutti i messaggi hanno il prefisso `[DualSubs]`.

## Pubblicazione

1. Aggiorna `version` in `manifest.json` **e** `BUILD_VERSION` in `page.js`
   (un test controlla che coincidano).
2. `node --test tests/`
3. `node scripts/pack.js` → crea `dist/dual-subs-<versione>.zip`.
4. Carica lo zip:
   - Chrome Web Store (vale anche per Brave, Vivaldi, Opera):
     https://chrome.google.com/webstore/devconsole — registrazione una tantum di 5 $.
   - Microsoft Edge Add-ons (gratuito):
     https://partner.microsoft.com/dashboard/microsoftedge
5. Compila scheda e privacy con i testi di `store/LISTING.md`; pubblica
   `store/PRIVACY_POLICY.md` (es. GitHub Gist pubblico) e incollane il link.

Per gli aggiornamenti successivi: nuova versione, nuovo zip, "Upload new
package" nella dashboard.
