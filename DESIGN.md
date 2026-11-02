# Beijer Elektro, website: ontwerpnotitie

Onderwerp en publiek: Electrotechnisch Bedrijf Beijer (Rozenburg), een eenmanszaak
sinds 1976. Publiek: particulieren en bedrijven in Rozenburg en omstreken die een
elektricien zoeken. Enige taak: bezoeker belt, appt of vraagt een offerte aan.

Signature: de meterkast als technische tekening met hoofdschakelaar, zes groepen,
aardlekschakelaar met testknop en uitgaande kabels naar de klemmen. De fijne
koperen lijn met een knoopje is het tweede element en scheidt de secties. De
projectvakjes zijn donkere vlakken met koperen schuine streep, zodat ze lezen
als gereserveerde ruimte in dezelfde tekening en niet als lege templates.

Type: Archivo voor display, body en UI (400/500/600/700), IBM Plex Mono 500 voor
identificatiegegevens (KvK-nummer, telefoonnummer, projectcodes, stappenummers).
Archivo is een robuuste industriële grotesque: technisch en betrouwbaar zonder
corporate gladheid.

Kleur (OKLCH, gemeten met tools/contrast.mjs, alle paren halen WCAG 2.2 AA):
  --paper 0.975 0.006 235   --paper-2 0.952 0.008 235   --surface 1 0 0
  --ink 0.27 0.03 245       --ink-2 0.45 0.025 245       --ink-3 0.5 0.02 245
  --line 0.89 0.012 235     --line-strong 0.63 0.022 235
  --petrol 0.42 0.075 240   --petrol-deep 0.3 0.055 245
  --brass 0.82 0.13 88 (alleen op donker)  --brass-ink 0.5 0.1 70 (op licht)
  --ok 0.5 0.13 155         --err 0.5 0.17 27

Ruimte en dichtheid: basis 4px, schaal 4/8/12/16/24/32/48/64/96. Marketing-dichtheid:
ruime sectiepadding (96px desktop, 56px mobiel), inline rail 72px.

Radius en materiaal: vlak model met één borderlaag. Radius per rol: inputs en
knoppen 6px, kaarten 10px, illustratiepanelen 14px, chips 999px. Schaduw alleen op
het zwevende kaartje in de hero en het offerteformulier. Geen glas, geen blur.

Beeld: geen foto's beschikbaar (Facebook-profiel niet publiekelijk leesbaar). De
projecttegels tonen daarom een duidelijk als zodanig gemerkte illustratie met een
drop-in mechaniek: zet een foto met de juiste bestandsnaam in assets/img/projecten/
en die verschijnt automatisch na `npm run photos`. Het werkgebied staat als
schematische kaart met de Nieuwe Waterweg, de plaatsen en Rozenburg als middelpunt.

Beweging: het stroomlijntje tussen de hero en de diensten is de enige
georkestreeerde beweging. Een koperen straal loopt in 3,4 s van links naar
rechts over een lijn met vijf contactpunten; elk contactpunt licht op precies
wanneer de straal het bereikt (vertraging per knop in de markup). De meterkast
in de hero pulseert in hetzelfde ritme. Onder prefers-reduced-motion staan de
knooppunten stil in de koperen kleur en verdwijnt de straal.

Uitlijning: één contentrail van 1180px met 24px gutters (16px mobiel), gebruikt
door header, hero, alle secties en footer. Links uitgelijnd, geen gecentreerde
hero. De hero heeft twee kolommen met daaronder een factsstrip over de volle
rail, zodat beide kolommen even hoog zijn.

Vermeden slop-tells: geen gecentreerde gradient-hero met glow en twee knoppen, geen
drie identieke icon-kaarten, geen bento-grid, geen eyebrow-labels, geen
big-number-strip, geen glazen kaarten, geen paars/violet, geen Inter of system-ui,
geen emoji, geen em-dashes in UI-tekst, geen soft tint-on-tint badges, geen
hover-lift, geen transition: all, geen herhaalde iconmedailons per dienst, geen
lege fotovakjes. De sterren tonen de echte score van 3,7 en niet vijf volle
sterren.

Waar de Bodudo-site als houvast is gebruikt: volgorde van de argumenten
(werk, aanpak, werkgebied, contact), de vraag om een offerteaanvraag en het
feit dat telefoon en bereikbaarheid zwaar wegen. De vorm, kleur, typografie en
alle tekst zijn zelf geschreven.
