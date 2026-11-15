# Scheda per il Chrome Web Store / Edge Add-ons

Testi pronti da incollare nella dashboard. Lingua principale della scheda:
inglese, come l'interfaccia dell'estensione. La descrizione italiana più sotto è facoltativa:
usala solo se vuoi una scheda tradotta per chi ha lo store in italiano.

---

## Store listing

**Name** (dal manifest, non si modifica qui): `Dual Subs`

**Summary / short description** (dal manifest, max 132 caratteri)

- EN: Show a second, synchronized subtitle in another language on Netflix, Prime Video and Disney+. Great for learning languages.
- IT: Mostra su Netflix, Prime Video e Disney+ un secondo sottotitolo sincronizzato in un'altra lingua. Ideale per le lingue.

**Category**: Education

**Language**: English

### Description (EN)

```
Watch Netflix, Prime Video and Disney+ with two subtitles at once.

Dual Subs keeps the platform's own subtitle where it is and adds a second one, in the language you choose, perfectly in sync with the video. It's made for language learners: follow the original dialogue and its translation at the same time.

HOW IT WORKS
• Start a title on Netflix, Prime Video or Disney+ and pick your subtitles as usual.
• Click the Dual Subs icon and choose the second language from the list of languages available for that title.
• The second subtitle appears on top of the video, in full screen too.

FEATURES
• Any subtitle language available for the current title, including closed captions (CC)
• Place it at the top or bottom of the screen
• Adjustable text size
• Turn it on and off with a single switch
• Works across episodes: follows autoplay to the next episode
• Your choices are remembered

PRIVACY
Dual Subs collects no data. It has no servers, no analytics and no accounts. Your settings are stored only in your browser.

NOTES
• Requires a Netflix, Prime Video or Disney+ subscription. Works on netflix.com, primevideo.com, disneyplus.com and Amazon's Prime Video pages in Chromium browsers (Chrome, Brave, Edge, Vivaldi, Opera).
• Some languages (for example Japanese or Chinese on some Netflix titles) are offered only as images; these are shown greyed out and cannot be used as second subtitle.

Dual Subs is an independent project and is not affiliated with, endorsed by or sponsored by Netflix, Inc., Amazon.com, Inc. or The Walt Disney Company. Netflix is a trademark of Netflix, Inc. Prime Video is a trademark of Amazon.com, Inc. or its affiliates. Disney+ is a trademark of Disney Enterprises, Inc.
```

### Descrizione (IT)

```
Guarda Netflix, Prime Video e Disney+ con due sottotitoli contemporaneamente.

Dual Subs lascia al suo posto il sottotitolo della piattaforma e ne aggiunge un secondo, nella lingua che scegli, perfettamente sincronizzato con il video. È pensato per chi studia le lingue: segui il dialogo originale e la sua traduzione nello stesso momento.

COME FUNZIONA
• Avvia un titolo su Netflix, Prime Video o Disney+ e scegli i sottotitoli come al solito.
• Clicca l'icona di Dual Subs e scegli la seconda lingua tra quelle disponibili per quel titolo.
• Il secondo sottotitolo compare sopra il video, anche a schermo intero.

FUNZIONI
• Tutte le lingue di sottotitoli disponibili per il titolo, compresi quelli per non udenti (CC)
• Posizione in alto o in basso
• Dimensione del testo regolabile
• Attivazione e disattivazione con un interruttore
• Segue il passaggio automatico all'episodio successivo
• Le tue scelte vengono ricordate

PRIVACY
Dual Subs non raccoglie nessun dato. Non ha server, statistiche o account. Le impostazioni restano solo nel tuo browser.

NOTE
• Serve un abbonamento Netflix, Prime Video o Disney+. Funziona su netflix.com, primevideo.com, disneyplus.com e sulle pagine Prime Video di Amazon, nei browser Chromium (Chrome, Brave, Edge, Vivaldi, Opera).
• Alcune lingue (per esempio giapponese o cinese in certi titoli Netflix) sono fornite solo come immagini: compaiono in grigio e non si possono usare come secondo sottotitolo.

Dual Subs è un progetto indipendente, non affiliato, approvato o sponsorizzato da Netflix, Inc., Amazon.com, Inc. o The Walt Disney Company. Netflix è un marchio di Netflix, Inc. Prime Video è un marchio di Amazon.com, Inc. o delle sue affiliate. Disney+ è un marchio di Disney Enterprises, Inc.
```

### Immagini

- **Icona**: `icons/icon-128.png` (già nel pacchetto).
- **Screenshot**: almeno 1, fino a 5, **1280×800** (o 640×400), PNG o JPEG.
  Suggeriti:
  1. Una scena con entrambi i sottotitoli visibili (nativo in basso, Dual Subs in alto).
  2. Il popup aperto sopra il player, con il menu delle lingue.
  3. Lo stesso a schermo intero, con il secondo sottotitolo in basso e testo grande.
  Evita il logo Netflix in primo piano e locandine riconoscibili come immagine
  principale.
- **Small promo tile** (facoltativa): 440×280.

---

## Privacy practices

**Single purpose**

```
Dual Subs displays a second, user-selected subtitle track on top of Netflix, Prime Video and Disney+ videos, synchronized with playback, to help users learn languages.
```

**Permission justification**

- `storage`:
  ```
  Saves the user's preferences (on/off, chosen language, position and text size) locally so they persist between sessions.
  ```
- Host permissions (netflix.com, primevideo.com, disneyplus.com, amazon.*/gp/video/*):
  ```
  The extension runs only on Netflix, Prime Video and Disney+ pages (on Amazon sites, only under /gp/video/, never on the store). It reads the list of subtitle tracks that the streaming service sends to its own player, downloads the subtitle file in the language the user chose, and draws it over the video. It does not access any other site or page.
  ```

**Are you using remote code?** No, I am not using remote code.
(Tutto il codice è nel pacchetto; i file scaricati sono solo sottotitoli in
formato testo WebVTT, non codice.)

**Data usage**: non selezionare nessuna categoria (l'estensione non raccoglie
dati). Spunta le tre dichiarazioni:

- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL**: pubblica `store/PRIVACY_POLICY.md` (ad esempio come
GitHub Gist pubblico o pagina GitHub Pages) e incolla il link.

---

## Note per la revisione (campo facoltativo "Notes for reviewers" su Edge)

```
To test: open netflix.com, primevideo.com or disneyplus.com (an account is required), start any title with subtitles, click the Dual Subs toolbar icon and pick a language. The selected subtitle is shown over the video. On Netflix the extension hooks JSON.stringify/JSON.parse in the page only to request and read the WebVTT subtitle track list; on Prime Video and Disney+ it only reads the subtitle list from the player's own responses and playlists. It does not touch video, audio or DRM.
```
