# Sushi a Schio 🍣

Un’esperienza mobile-first da scorrere: una domanda, sushi illustrato che si muove con lo scroll e una mappa finale dei ristoranti di Schio.

## Avvio locale

```bash
npm install
cp .env.example .env.local
npm run dev
```

La mappa di Schio funziona subito con il fallback OpenStreetMap. Per mostrare Google Maps e caricare dinamicamente i ristoranti, aggiungi a `.env.local`:

```text
VITE_GOOGLE_MAPS_API_KEY=la_tua_chiave
VITE_WHATSAPP_NUMBER=393331234567
```

La chiave deve avere abilitate Maps JavaScript API e Places API (New) ed essere limitata ai domini del progetto.
Il numero WhatsApp va scritto in formato internazionale, con sole cifre e senza `+`, spazi o trattini.

Su GitHub Pages aggiungi il numero in **Settings → Secrets and variables → Actions → Variables** con il nome `WHATSAPP_NUMBER`. Il workflow lo inserirà nella build automaticamente.

## Build

```bash
npm run build
```

La versione precedente è conservata in `archive/previous-site/`.
