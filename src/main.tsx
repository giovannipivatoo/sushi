import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowUpRight, MapPin, Navigation } from 'lucide-react';
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
    note: 'Per una cena fatta con calma.',
    rating: 4.8,
    lat: 45.7122,
    lng: 11.3484,
    mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Aji+Osteria+Giapponese+Schio',
  },
  {
    id: 'fude-ramen',
    name: 'Fude Ramen',
    address: 'Viale Europa Unita 2/A, Schio',
    note: 'Vivace, informale, molto facile.',
    rating: 3.8,
    lat: 45.7103,
    lng: 11.3494,
    mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Fude+Ramen+Schio',
  },
  {
    id: 'golden-sushi',
    name: 'Golden Sushi',
    address: 'Via Molise 7, Schio',
    note: 'Quando vuoi andare sul sicuro.',
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
    mapsWindow.gm_authFailure = () => finish(() => reject(new Error('Google Maps authentication failed')));
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async&libraries=maps,places,marker&callback=${callbackName}`;
    script.async = true;
    script.onerror = () => finish(() => reject(new Error('Google Maps failed to load')));
    const timeout = window.setTimeout(() => finish(() => reject(new Error('Google Maps timed out'))), 15000);
    document.head.appendChild(script);
  });

  return mapsLoader;
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function windowed(progress: number, start: number, end: number) {
  return clamp((progress - start) / (end - start));
}

function Maki({ className = '' }: { className?: string }) {
  return <div className={`sushi-piece maki ${className}`} aria-hidden="true"><span className="maki-rice"><i /></span></div>;
}

function Nigiri({ className = '' }: { className?: string }) {
  return <div className={`sushi-piece nigiri ${className}`} aria-hidden="true"><span className="nigiri-rice" /><span className="nigiri-fish"><i /><i /><i /></span></div>;
}

function Ebi({ className = '' }: { className?: string }) {
  return <div className={`sushi-piece ebi ${className}`} aria-hidden="true"><span className="ebi-rice" /><span className="ebi-top"><i /><i /><i /><i /></span><span className="ebi-tail" /></div>;
}

function App() {
  const configuredApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim();
  const apiKey = configuredApiKey && configuredApiKey !== 'your_google_maps_api_key' ? configuredApiKey : '';
  const journeyRef = useRef<HTMLElement>(null);
  const mapNode = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRefs = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [places, setPlaces] = useState<SushiPlace[]>(localPlaces);
  const [activeId, setActiveId] = useState(localPlaces[0].id);
  const [mapReady, setMapReady] = useState(false);

  const activePlace = useMemo(
    () => places.find((place) => place.id === activeId) ?? places[0],
    [activeId, places],
  );

  useEffect(() => {
    let frame = 0;
    const updateProgress = () => {
      frame = 0;
      const section = journeyRef.current;
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const distance = section.offsetHeight - window.innerHeight;
      setScrollProgress(clamp(-rect.top / Math.max(distance, 1)));
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(updateProgress);
    };
    updateProgress();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (!apiKey || !mapNode.current) return;
    let cancelled = false;

    loadGoogleMaps(apiKey)
      .then(async () => {
        if (cancelled || !mapNode.current) return;
        const { Map } = (await google.maps.importLibrary('maps')) as google.maps.MapsLibrary;
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
          gestureHandling: 'cooperative',
        });
        setMapReady(true);

        const placesLibrary = (await google.maps.importLibrary('places')) as google.maps.PlacesLibrary;
        const { Place, SearchNearbyRankPreference } = placesLibrary;
        const response = await Place.searchNearby({
          fields: ['id', 'displayName', 'formattedAddress', 'rating', 'location', 'googleMapsURI'],
          locationRestriction: { center: SCHIO.center, radius: 10000 },
          includedTypes: ['sushi_restaurant'],
          maxResultCount: 6,
          rankPreference: SearchNearbyRankPreference.POPULARITY,
        });

        if (cancelled || !response.places.length) return;
        const livePlaces = response.places.flatMap((place, index): SushiPlace[] => {
          if (!place.location) return [];
          return [{
            id: place.id || `place-${index}`,
            name: place.displayName || 'Ristorante giapponese',
            address: place.formattedAddress?.replace(', Italia', '') || SCHIO.label,
            note: 'Potrebbe essere quello giusto.',
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
          background: isActive ? '#ff4f32' : '#172c25',
          borderColor: '#fff8ec',
          glyphColor: '#fff8ec',
          glyphText: String(index + 1),
          scale: isActive ? 1.15 : 0.88,
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

  const firstPhase = 1 - windowed(scrollProgress, 0.18, 0.34);
  const secondPhase = Math.min(windowed(scrollProgress, 0.25, 0.4), 1 - windowed(scrollProgress, 0.55, 0.69));
  const thirdPhase = windowed(scrollProgress, 0.64, 0.82);
  const plateProgress = windowed(scrollProgress, 0.68, 0.96);
  const makiProgress = windowed(scrollProgress, 0.03, 0.62);
  const nigiriProgress = windowed(scrollProgress, 0.18, 0.78);
  const ebiProgress = windowed(scrollProgress, 0.42, 0.92);

  return (
    <main className="app-shell">
      <section className="hero" id="top">
        <div className="hero-copy">
          <span className="overline">Una domanda importante</span>
          <h1>Ti piace<br />il sushi<br /><em>giusto?</em></h1>
        </div>
      </section>

      <section className="sushi-journey" id="viaggio" ref={journeyRef}>
        <div className="journey-stage">
          <div className="journey-topline"><span>01 — La prova</span><span>{String(Math.round(scrollProgress * 100)).padStart(2, '0')}%</span></div>

          <div className="journey-copy" aria-live="polite">
            <p style={{ opacity: firstPhase, transform: `translateY(${(1 - firstPhase) * -22}px)` }}>Quello<br /><em>fatto bene.</em></p>
            <p style={{ opacity: secondPhase, transform: `translateY(${(1 - secondPhase) * 22}px)` }}>Quello che arriva<br /><em>al momento giusto.</em></p>
            <p style={{ opacity: thirdPhase, transform: `translateY(${(1 - thirdPhase) * 22}px)` }}>Possibilmente<br /><em>a Schio.</em></p>
          </div>

          <div className="moving-piece moving-maki" style={{ transform: `translate3d(${118 - makiProgress * 136}vw, ${61 - makiProgress * 36}vh, 0) rotate(${makiProgress * 520 - 25}deg) scale(${0.78 + makiProgress * 0.32})` }}><Maki /></div>
          <div className="moving-piece moving-nigiri" style={{ transform: `translate3d(${-57 + nigiriProgress * 92}vw, ${73 - nigiriProgress * 48}vh, 0) rotate(${-28 + nigiriProgress * 392}deg) scale(${0.84 + nigiriProgress * 0.2})` }}><Nigiri /></div>
          <div className="moving-piece moving-ebi" style={{ transform: `translate3d(${116 - ebiProgress * 72}vw, ${77 - ebiProgress * 55}vh, 0) rotate(${18 - ebiProgress * 305}deg) scale(${0.76 + ebiProgress * 0.25})` }}><Ebi /></div>

          <div className="sushi-plate" style={{ opacity: plateProgress, transform: `translate(-50%, ${120 - plateProgress * 120}px) scale(${0.76 + plateProgress * 0.24})` }}><span>il tavolo è quasi pronto</span></div>
          <div className="journey-progress" aria-hidden="true"><i style={{ height: `${scrollProgress * 100}%` }} /></div>
        </div>
      </section>

      <section className="map-section" id="mappa">
        <div className="map-heading">
          <span className="overline">02 — Dove andiamo?</span>
          <h2>Ci vediamo<br />a <em>Schio.</em></h2>
          <p>Tre idee, una mappa e una decisione molto semplice.</p>
        </div>

        <div className="map-wrap">
          <div ref={mapNode} className={mapReady ? 'google-map' : 'google-map is-hidden'} />
          {!mapReady && (
            <div className="fallback-map" aria-label="Mappa di Schio, Italia">
              <iframe title="Mappa di Schio" src="https://www.openstreetmap.org/export/embed.html?bbox=11.327%2C45.694%2C11.389%2C45.735&layer=mapnik" loading="lazy" />
              <div className="map-wash" />
              {localPlaces.map((place, index) => (
                <button key={place.id} type="button" className={`fallback-pin pin-${index + 1}${place.id === activeId ? ' is-active' : ''}`} onClick={() => setActiveId(place.id)} aria-label={`Seleziona ${place.name}`}>{index + 1}</button>
              ))}
            </div>
          )}

          <div className="map-location-pill"><MapPin size={15} /> 45.7142° N · 11.3568° E</div>
          {activePlace && (
            <article className="active-place-card">
              <span className="place-number">0{Math.max(1, places.findIndex((place) => place.id === activePlace.id) + 1)}</span>
              <div><small>La scelta di adesso</small><strong>{activePlace.name}</strong><p>{activePlace.address}</p></div>
              <a href={activePlace.mapsUrl} target="_blank" rel="noreferrer" aria-label={`Apri ${activePlace.name} su Google Maps`}><Navigation size={18} /></a>
            </article>
          )}
        </div>

        <div className="places-strip" aria-label="Ristoranti di sushi a Schio">
          {places.map((place, index) => (
            <button type="button" key={place.id} className={place.id === activeId ? 'place-chip is-active' : 'place-chip'} onClick={() => setActiveId(place.id)}>
              <span>0{index + 1}</span><strong>{place.name}</strong><small>{place.rating ? `★ ${place.rating.toFixed(1)}` : place.note}</small>
            </button>
          ))}
        </div>

        <footer>
          <Maki />
          <p>Quindi, sushi?</p>
          <a href={activePlace?.mapsUrl} target="_blank" rel="noreferrer">Andiamo <ArrowUpRight size={16} /></a>
        </footer>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
