# Website Electrotechnisch Bedrijf Beijer, Rozenburg

Een eenpagina-site voor Beijer Elektro. Statische HTML, CSS en JavaScript, met
een kleine Node-server voor lokaal gebruik en de ontvangst van offerteaanvragen.

## Live

**https://jalvdbroek-ship-it.github.io/beijer-elektro/**

De site wordt bij elke push naar `main` opnieuw gepubliceerd door de workflow
in `.github/workflows/deploy.yml`. De map `public/` is de enige bron.

## Starten

```bash
npm start
```

De site draait dan op <http://localhost:4173>. Er zijn geen externe pakketten
nodig.

## Opbouw

```
public/
  index.html              de pagina
  assets/css/style.css    alle stijlen, met OKLCH-tokens
  assets/js/main.js       menu, projectfoto's en het offerteformulier
  assets/img/projecten/   plek voor uw eigen projectfoto's
server.js                 lokale server + API voor offerteaanvragen
tools/                    scripts voor pictogrammen, contrast en toetsing
data/offertes.jsonl       binnenkomende aanvragen (lokaal)
DESIGN.md                 de ontwerpnotitie
```

## Publiceren

De map `public/` is de hele website. Die staat online op GitHub Pages en kan
naar elke andere statische host (Netlify, Cloudflare Pages, uw eigen host)
worden gekopieerd. De Node-server uit `server.js` is alleen nodig voor lokaal
gebruik en voor het ontvangen van offerteaanvragen.

Op de live site bestaat de route `/api/offertes` niet, omdat Pages alleen
statische bestanden serveert. Het formulier merkt dat op en toont een knop
waarmee de bezoeker zijn eigen e-mailprogramma opent. De aanvraag staat daar
al voor ingevuld. Het adres van die knop staat in `public/assets/js/main.js`
bij `MAIL_ADRES`; verandert het e-mailadres, dan verandert die waarde mee.

Wilt u aanvragen liever automatisch ontvangen zonder e-mailprogramma, dan is
een eigen server nodig, of een formulierdienst die de aanvraag naar uw e-mail
of agenda stuurt.

## Projectfoto's toevoegen

Zet uw foto's in `public/assets/img/projecten/` met deze namen:

| Bestandsnaam      | Onderwerp                |
| ----------------- | ------------------------ |
| `meterkast.jpg`   | stoppenkast of meterkast |
| `verlichting.jpg` | verlichting              |
| `laadpaal.jpg`    | laadpaal                 |
| `zonnepanelen.jpg`| zonnepanelen             |

Daarna `npm run photos` uitvoeren en de foto's committen. De website toont dan
automatisch de foto in plaats van de illustratie. Zonder foto blijft de
illustratie staan.

## Controle

```bash
npm run contrast      # WCAG-contrast van het kleurenpalet
npm run check:a11y    # toegankelijkheid, contrast, doelwit, reflow
npm run check:content # koppenstructuur, sterrenbeoordeling, em-dash
npm run check:form    # volledige invulflow van het offerteformulier
npm run check:current # synchronisatie van de stroomlijn
npm run check:mail    # terugval op de e-mailapp zonder api-route
npm run check:live    # dezelfde controle tegen de live site
npm run shots         # opnames van elke sectie in .gg/screenshots
```

De live controles gebruiken de omgevingsvariabele `URL`:

```bash
URL=https://jalvdbroek-ship-it.github.io/beijer-elektro/ npm run check:live
```

De controles draaien op Chromium via Playwright. Installeer die een keer met:

```bash
npm install --save-dev playwright
npx playwright install chromium
```

De website zelf heeft geen pakketten nodig; alleen de controles wel.

## Nog te doen voor livegang

1. **E-mailadres controleren.** Op de site staat `info@beijerektro.nl`. Dit adres
   is niet bevestigd; controleer het en pas het aan in `public/index.html`.
2. **WhatsApp-nummer controleren.** De link gebruikt het telefoonnummer
   `+31 181 212765`. Controleer of dat het WhatsApp-nummer is.
3. **Privacyverklaring laten nakijken.** De tekst is een voorstel. Laat hem
   aanvullen met de hostingspartij en de bewaartermijn. Onderaan de
   privacyverklaring staat een regel die hier om vraagt; haal die weg zodra de
   verklaring definitief is.
4. **Projectfoto's plaatsen** en `npm run photos` uitvoeren.
5. **Aanvraag doorsturen.** Op de live site opent het formulier het
   e-mailprogramma van de bezoeker, met de aanvraag ingevuld. Dat werkt, maar
   niet iedereen verstuurt de mail daarna. Een formulierdienst of een eigen
   server geeft meer zekerheid.
6. **KvK-nummer controleren** in de footer. Het nummer 24226048 komt uit de
   openbare bedrijfsgegevens.

## Beeldmateriaal

De pictogrammen komen uit [Lucide](https://lucide.dev) (ISC-licentie). De
tekeningen van de meterkast en de werkgebiedkaart zijn zelf getekend. Zolang er
geen eigen foto's zijn, tonen de projectvakjes een illustratie met het label
"Foto volgt".
