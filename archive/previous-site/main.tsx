import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowDown, ArrowUpRight, Check, Heart, MapPin, Navigation, Star, X } from 'lucide-react';
import './styles.css';

type SushiPlace = {
  id: string;
  name: string;
  address: string;
  note: string;
  rating?: number;
  lat: number;
  lng: number;
  mapsUrl: string;
};

const SCHIO = {
  label: 'Schio, Italia',
  center: { lat: 45.7142, lng: 11.3568 },
};

const localPlaces: SushiPlace[] = [
  {
    id: 'aji-osteria',
    name: 'Aji Osteria Giapponese',
    address: 'Via Giarette 13, Schio',
    note: 'Cucina giapponese autentica, per una cena fatta con calma.',
    rating: 4.8,
    lat: 45.7122,
    lng: 11.3484,
    mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Aji+Osteria+Giapponese+Schio',
  },
  {
    id: 'fude-ramen',
    name: 'Fude Ramen',
    address: 'Viale Europa Unita 2/A, Schio',
    note: 'Sushi e ramen in un ambiente vivace e informale.',
    rating: 3.8,
    lat: 45.7103,
    lng: 11.3494,
    mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Fude+Ramen+Schio',
  },
  {
    id: 'golden-sushi',
    name: 'Golden Sushi',
    address: 'Via Molise 7, Schio',
    note: 'Una scelta semplice per una serata senza troppi programmi.',
    lat: 45.7069,
    lng: 11.3662,
    mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Golden+Sushi+Schio',
  },
];

let mapsLoader: Promise<void> | null = null;

function loadGoogleMaps(apiKey: string) {
  if (window.google?.maps) return Promise.resolve();
  if (mapsLoader) return mapsLoader;

  mapsLoader = new Promise((resolve, reject) => {
    const callbackName = '__sushiMapsReady';
    const mapsWindow = window as Window & {
      __sushiMapsReady?: () => void;
      gm_authFailure?: () => void;
    };
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      delete mapsWindow[callbackName];
      callback();
    };

    mapsWindow[callbackName] = () => finish(resolve);
    mapsWindow.gm_authFailure = () => finish(() => reject(new Error()));

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async&libraries=maps,places,marker&callback=${callbackName}`;
    script.async = true;
    script.onerror = () => finish(() => reject(new Error()));
    const timeout = window.setTimeout(() => finish(() => reject(new Error())), 15000);
    document.head.appendChild(script);
  });

  return mapsLoader;
}

function App() {
  const configuredApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim();
  const apiKey = configuredApiKey && configuredApiKey !== 'your_google_maps_api_key' ? configuredApiKey : '';
  const placesSection = useRef<HTMLElement>(null);
  const mapNode = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRefs = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const [places, setPlaces] = useState<SushiPlace[]>(localPlaces);
  const [activeId, setActiveId] = useState(localPlaces[0].id);
  const [mapReady, setMapReady] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [chosen, setChosen] = useState<SushiPlace | null>(null);

  const activePlace = useMemo(
    () => places.find((place) => place.id === activeId) ?? places[0],
    [activeId, places],
  );

  function goToPlaces() {
    placesSection.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function sayYes() {
    setAccepted(true);
    window.setTimeout(goToPlaces, 180);
  }

  useEffect(() => {
    if (!apiKey || !mapNode.current) return;
    let cancelled = false;

    loadGoogleMaps(apiKey)
      .then(async () => {
        if (cancelled || !mapNode.current) return;
        const { Map } = (await google.maps.importLibrary('maps')) as google.maps.MapsLibrary;
        const placesLibrary = (await google.maps.importLibrary('places')) as google.maps.PlacesLibrary;

        mapRef.current = new Map(mapNode.current, {
          center: SCHIO.center,
          zoom: 13,
          mapId: 'DEMO_MAP_ID',
          clickableIcons: false,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          cameraControl: false,
          zoomControl: false,
        });
        setMapReady(true);

        const { Place, SearchNearbyRankPreference } = placesLibrary;
        const response = await Place.searchNearby({
          fields: ['id', 'displayName', 'formattedAddress', 'rating', 'location', 'googleMapsURI'],
          locationRestriction: { center: SCHIO.center, radius: 10000 },
          includedTypes: ['sushi_restaurant'],
          maxResultCount: 8,
          rankPreference: SearchNearbyRankPreference.POPULARITY,
        });

        if (cancelled || !response.places.length) return;
        const livePlaces = response.places.flatMap((place, index): SushiPlace[] => {
          if (!place.location) return [];
          return [{
            id: place.id || `place-${index}`,
            name: place.displayName || 'Ristorante giapponese',
            address: place.formattedAddress?.replace(', Italia', '') || SCHIO.label,
            note: 'Un’altra buona idea per la nostra cena.',
            rating: place.rating ?? undefined,
            lat: place.location.lat(),
            lng: place.location.lng(),
            mapsUrl: place.googleMapsURI || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.displayName} Schio`)}`,
          }];
        });

        setPlaces(livePlaces);
        setActiveId(livePlaces[0].id);
      })
      .catch(() => setMapReady(false));

    return () => { cancelled = true; };
  }, [apiKey]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    let cancelled = false;

    async function drawMarkers() {
      const { AdvancedMarkerElement, PinElement } = (await google.maps.importLibrary('marker')) as google.maps.MarkerLibrary;
      markerRefs.current.forEach((marker) => { marker.map = null; });
      markerRefs.current = [];

      places.forEach((place, index) => {
        if (cancelled) return;
        const isActive = place.id === activeId;
        const pin = new PinElement({
          background: isActive ? '#a93b32' : '#283c35',
          borderColor: '#fffaf4',
          glyphColor: '#fffaf4',
          glyphText: String(index + 1),
          scale: isActive ? 1.12 : 0.9,
        });
        const marker = new AdvancedMarkerElement({
          map: mapRef.current,
          position: { lat: place.lat, lng: place.lng },
          title: place.name,
          content: pin.element,
        });
        marker.addListener('click', () => setActiveId(place.id));
        markerRefs.current.push(marker);
      });
    }

    drawMarkers();
    return () => { cancelled = true; };
  }, [places, activeId, mapReady]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Torna all'inizio">
          <span className="brand-dot" aria-hidden="true" />
          <span>una piccola domanda</span>
        </a>
        <div className="fixed-location" aria-label="Località fissa: Schio, Italia">
          <MapPin size={15} aria-hidden="true" />
          <span>Schio, Italia</span>
        </div>
      </header>

      <div className="page-content">
        <section className="hero" id="top">
          <span className="hero-kicker">Ehi, ci stavo pensando…</span>
          <h1>Ti va di mangiare<br /><em>sushi con me?</em></h1>
          <p>Una cena insieme, due bacchette e nessun programma complicato.</p>
          <div className="hero-actions">
            <button className="primary-button" type="button" onClick={sayYes}>
              <Heart size={18} fill="currentColor" /> Sì, mi va
            </button>
            <button className="text-button" type="button" onClick={goToPlaces}>
              Prima fammi vedere i posti <ArrowDown size={16} />
            </button>
          </div>
          {accepted && (
            <div className="yes-note" role="status">
              <span><Check size={16} /></span>
              <p><strong>Allora è un appuntamento.</strong> Ora manca solo scegliere dove.</p>
            </div>
          )}
        </section>

        <section className="places-section" id="posti" ref={placesSection}>
          <div className="section-intro">
            <div>
              <span className="eyebrow">Qualche idea a Schio</span>
              <h2>Scegliamo il nostro tavolo.</h2>
            </div>
            <p>Ho raccolto qualche posto. Dimmi quello che ti ispira di più.</p>
          </div>

          <div className="places-layout">
            <div className="place-list">
              {places.map((place, index) => (
                <article key={place.id} className={place.id === activeId ? 'place-card active' : 'place-card'}>
                  <button className="place-select" type="button" onClick={() => setActiveId(place.id)} aria-label={`Seleziona ${place.name}`}>
                    <span className="place-index">0{index + 1}</span>
                    <span className="place-copy">
                      <span className="place-title-row">
                        <strong>{place.name}</strong>
                        {place.rating && <span className="place-rating"><Star size={13} fill="currentColor" /> {place.rating.toFixed(1)}</span>}
                      </span>
                      <span className="place-address">{place.address}</span>
                      <span className="place-note">{place.note}</span>
                    </span>
                  </button>
                  <div className="place-actions">
                    <button className="choose-button" type="button" onClick={() => setChosen(place)}>
                      Questo mi piace
                    </button>
                    <a href={place.mapsUrl} target="_blank" rel="noreferrer" aria-label={`Guarda ${place.name} sulla mappa`}>
                      <ArrowUpRight size={18} />
                    </a>
                  </div>
                </article>
              ))}
            </div>

            <aside className="map-panel" aria-label="Ristoranti a Schio">
              <div ref={mapNode} className={mapReady ? 'google-map' : 'google-map hidden'} />
              {!mapReady && (
                <div className="place-backdrop" aria-hidden="true">
                  <span className="place-backdrop-label">SCHIO</span>
                  <span className="place-backdrop-subtitle">Veneto · Italia</span>
                </div>
              )}
              {activePlace && (
                <div className="map-card">
                  <span><small>La scelta di adesso</small>{activePlace.name}</span>
                  <a href={activePlace.mapsUrl} target="_blank" rel="noreferrer" aria-label={`Apri ${activePlace.name} sulla mappa`}>
                    <Navigation size={17} />
                  </a>
                </div>
              )}
            </aside>
          </div>
        </section>

        <footer>
          <span>Una cena a Schio</span>
          <span>fatta con un po’ di coraggio</span>
        </footer>
      </div>

      {chosen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setChosen(null)}>
          <section className="choice-modal" role="dialog" aria-modal="true" aria-labelledby="choice-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setChosen(null)} aria-label="Chiudi"><X size={18} /></button>
            <span className="modal-heart"><Heart size={23} fill="currentColor" /></span>
            <span className="eyebrow">Abbiamo un piano</span>
            <h2 id="choice-title">{chosen.name}</h2>
            <p>{chosen.address}</p>
            <a className="primary-button" href={chosen.mapsUrl} target="_blank" rel="noreferrer">
              Guardiamolo insieme <ArrowUpRight size={17} />
            </a>
            <button className="change-choice" type="button" onClick={() => setChosen(null)}>Ne scegliamo un altro</button>
          </section>
        </div>
      )}
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
