# Beijer Elektro — website

Een statische website voor **Electrotechnisch Bedrijf Beijer**, Julianastraat 3 in
Rozenburg (ZH). Geen build-stap, geen dependencies.

## De live site

**https://jalvdbroek-ship-it.github.io/beijer-elektro/**

Die link is permanent en altijd bereikbaar. De site staat op GitHub Pages: de code
staat in de repository `jalvdbroek-ship-it/beijer-elektro` en elke keer dat je naar
`main` pusht, bouwt GitHub de site opnieuw. De repo is openbaar, want GitHub Pages is
op een gratis account alleen mogelijk voor openbare repos. Er staat geen
privékleding of wachtwoord in.

Om de site te delen: onderaan de voettekst staat het adres met een knop om het te
kopieren, of om het via het deelmenu van je telefoon door te sturen.

## De site lokaal openen

**Makkelijkst: dubbelklik `index.html`.** De site werkt dan meteen, zonder server.
Het offerteformulier laat dan het e-mailprogramma van de bezoeker openen, precies
als op de live site.

**Met een lokale server** (aanbevolen, want dan werkt ook de route
`/api/offertes` waarmee aanvragen in `data/offertes.jsonl` worden bewaard):

- Windows: dubbelklik **`start-site.bat`**. De browser gaat vanzelf open op
  `http://localhost:4173`. Sluit het venster om te stoppen.
- Of via de terminal: `npm start`, en open daarna <http://localhost:4173>.

## Mapstructuur

```
index.html              de hele site
assets/css/style.css    alle stijlen, met OKLCH-kleurtokens
assets/js/main.js       mobiel menu, projectfoto's en het offerteformulier
assets/img/             favicon en de plek voor de projectfoto's
server.js               lokale server met de route /api/offertes
start-site.bat          start de lokale server en open de browser
DESIGN.md               ontwerpkeuzes en de kleurcontrasten
tools/                  scripts voor pictogrammen, contrast en toetsing
```

## De site online zetten

De site staat op GitHub Pages. Om iets te wijzigen:

1. Pas de bestanden aan in deze map.
2. `git add` en `git commit`.
3. `git push origin main`.

GitHub bouwt de site daarna binnen een minuut opnieuw. De URL blijft hetzelfde.

De workflow in `.github/workflows/pages.yml` doet dat automatisch bij elke push.

## Controle

```bash
npm run contrast      # WCAG-contrast van het kleurenpalet
npm run check:a11y    # toegankelijkheid, contrast, doelwit en reflow
npm run check:content # koppenstructuur, sterrenbeoordeling, em-dash
npm run check:form    # de volledige invulflow van het offerteformulier
npm run check:current # of de stroomlijn en de contactpunten in de pas lopen
npm run check:mail    # de terugval op de e-mailapp zonder api-route
npm run check:live    # dezelfde controle tegen de live site
npm run shots         # opnames van elke sectie in .gg/screenshots
```

De controles draaien op Chromium via Playwright. Installeer die een keer met:

```bash
npm install --save-dev playwright
npx playwright install chromium
```

De website zelf heeft geen pakketten nodig; alleen de controles wel.

## Wat er staat vast

- **KvK 24226048**, eenmanszaak, opgericht 1 september 1976, twee medewerkers.
- **Telefoon 0181 212 765**, 24/7 bereikbaar.
- **Openingstijden** maandag tot vrijdag, 08.30 tot 17.00 uur.
- **Werkgebied**: Rozenburg, Brielle, Maassluis, Vlaardingen, Hoek van Holland,
  Zwartewaal, Oud-Beijerland en Spijkenisse.
- **Beoordeling 3,7 van de 5** op Google, op basis van 3 reviews. Die score staat
  zo op de site: drie volle sterren en een vierde voor 74 procent gevuld.

## Wat je nog moet doen voor live gang

1. **E-mailadres controleren.** Op de site staat `info@beijerektro.nl`. Dat adres is
   nergens openbaar gevonden, dus controleer het. Het staat op twee plekken:
   `assets/js/main.js` bij `MAIL_ADRES` en in `index.html` bij de contactgegevens.
2. **WhatsApp-nummer controleren.** De link gebruikt het telefoonnummer
   `+31 181 212765`. Controleer of dat ook het WhatsApp-nummer is.
3. **Privacyverklaring laten nakijken.** De tekst is een voorstel. Laat hem
   aanvullen met de hostingspartij en de bewaartermijn. Onderaan de
   privacyverklaring staat een regel die hier om vraagt; haal die weg zodra de
   verklaring definitief is.
4. **Projectfoto's plaatsen** in `assets/img/projecten/` met de namen
   `meterkast.jpg`, `verlichting.jpg`, `laadpaal.jpg` en `zonnepanelen.jpg`. Draai
   daarna `npm run photos` en commit de bestanden. Zonder foto blijft de
   illustratie staan.
5. **Aanvragen doorsturen.** Op de live site opent het formulier het
   e-mailprogramma van de bezoeker, met de aanvraag ingevuld. Dat werkt, maar niet
   iedereen verstuurt de mail daarna. Een formulierdienst of een eigen server
   geeft meer zekerheid.
6. **KvK-nummer controleren** in de footer. Het nummer 24226048 komt uit de
   openbare bedrijfsgegevens.

## Techniek

Standaard HTML, CSS en JavaScript, zonder frameworks. De kleuren staan als
OKLCH-tokens in `assets/css/style.css` en zijn gemeten op WCAG 2.2 AA; de
controle daarop staat in `tools/contrast.mjs`. De pictogrammen komen uit
[Lucide](https://lucide.dev) (ISC-licentie) en staan als inline sprite in
`index.html`. De tekeningen van de meterkast en de werkgebiedkaart zijn zelf
getekend. De lettertypen komen van Google Fonts (Archivo en IBM Plex Mono).

De stroomlijn onder de kop is de enige beweging op de pagina: een koperen straal
loopt over de lijn en de contactpunten lichten op als de straal ze bereikt. Met
`prefers-reduced-motion` staat alles stil.
