import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CalendarDays, Check, Heart, MapPin, Moon, Navigation, Sun } from 'lucide-react';
import './styles.css';

type SushiPlace = {
  id: string;
  name: string;
  address: string;
  note: string;
  rating?: number;
  photoUrl?: string;
  photoCredit?: string;
  lat: number;
  lng: number;
  mapsUrl: string;
};

const SCHIO = {
  label: 'Schio, Italia',
  center: { lat: 45.7142, lng: 11.3568 },
};

const fallbackPhoto = `${import.meta.env.BASE_URL}og-invito.png`;

const localPlaces: SushiPlace[] = [
  {
    id: 'aji-osteria',
    name: 'Aji Osteria Giapponese',
    address: 'Via Giarette 13, Schio',
    note: 'Per una cena fatta con calma.',
    rating: 4.8,
    photoUrl: fallbackPhoto,
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
    photoUrl: fallbackPhoto,
    lat: 45.7103,
    lng: 11.3494,
    mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Fude+Ramen+Schio',
  },
  {
    id: 'golden-sushi',
    name: 'Golden Sushi',
    address: 'Via Molise 7, Schio',
    note: 'Quando vuoi andare sul sicuro.',
    photoUrl: fallbackPhoto,
    lat: 45.7069,
    lng: 11.3662,
    mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Golden+Sushi+Schio',
  },
  {
    id: 'new-concept',
    name: 'Ristorante New Concept',
    address: 'Via Venezia 101/H, Schio',
    note: 'Sushi e cucina asiatica.',
    rating: 3.7,
    photoUrl: fallbackPhoto,
    lat: 45.7086911,
    lng: 11.3614432,
    mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Ristorante+New+Concept+Schio',
  },
  {
    id: 'zen-schio',
    name: 'ZEN Sushi · Poke · Bao',
    address: 'Via Battaglione Val Leogra 80, Schio',
    note: 'Sushi, poke e bao da condividere.',
    photoUrl: fallbackPhoto,
    lat: 45.7182,
    lng: 11.3538,
    mapsUrl: 'https://www.google.com/maps/search/?api=1&query=ZEN+Sushi+Poke+Bao+Schio',
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

function useFallbackPhoto(event: React.SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;
  if (!image.src.endsWith('og-invito.png')) image.src = fallbackPhoto;
}

function App() {
  const configuredApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim();
  const apiKey = configuredApiKey && configuredApiKey !== 'your_google_maps_api_key' ? configuredApiKey : '';
  const whatsappNumber = String(import.meta.env.VITE_WHATSAPP_NUMBER || '').replace(/\D/g, '');
  const journeyRef = useRef<HTMLElement>(null);
  const appointmentRef = useRef<HTMLElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const soundPlayedRef = useRef(false);
  const mapNode = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRefs = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [viewport, setViewport] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  const [places, setPlaces] = useState<SushiPlace[]>(localPlaces);
  const [activeId, setActiveId] = useState(localPlaces[0].id);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [favoriteId, setFavoriteId] = useState<string | null>(null);
  const [date, setDate] = useState('');
  const [meal, setMeal] = useState<'pranzo' | 'cena' | ''>('');
  const [mapReady, setMapReady] = useState(false);

  const activePlace = useMemo(
    () => places.find((place) => place.id === activeId) ?? places[0],
    [activeId, places],
  );
  const selectedPlace = useMemo(
    () => places.find((place) => place.id === selectedId) ?? null,
    [selectedId, places],
  );
  const minDate = new Date().toLocaleDateString('en-CA');
  const isComplete = Boolean(selectedPlace && date && meal);

  const whatsappUrl = useMemo(() => {
    if (!selectedPlace || !date || !meal) return '';
    const formattedDate = new Intl.DateTimeFormat('it-IT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Europe/Rome',
    }).format(new Date(`${date}T12:00:00`));
    const favoriteLine = favoriteId === selectedPlace.id ? '\n⭐ È il mio preferito.' : '';
    const message = `🍣 Il nostro appuntamento sushi\n\n📍 ${selectedPlace.name}\n${selectedPlace.address}\n📅 ${formattedDate}\n🕒 A ${meal}${favoriteLine}\n\n🗺️ ${selectedPlace.mapsUrl}`;
    const whatsappBase = whatsappNumber ? `https://wa.me/${whatsappNumber}` : 'https://wa.me/';
    return `${whatsappBase}?text=${encodeURIComponent(message)}`;
  }, [selectedPlace, date, meal, favoriteId, whatsappNumber]);

  function choosePlace(place: SushiPlace) {
    setActiveId(place.id);
    setSelectedId(place.id);
    window.setTimeout(() => appointmentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
  }

  function playFinishSound() {
    const context = audioContextRef.current;
    if (!context || context.state !== 'running' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const now = context.currentTime;
    [
      { frequency: 880, delay: 0, volume: 0.035 },
      { frequency: 1320, delay: 0.09, volume: 0.025 },
    ].forEach(({ frequency, delay, volume }) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, now + delay);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.18, now + delay + 0.28);
      gain.gain.setValueAtTime(0.0001, now + delay);
      gain.gain.exponentialRampToValueAtTime(volume, now + delay + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.42);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(now + delay);
      oscillator.stop(now + delay + 0.44);
    });
  }

  useEffect(() => {
    const unlockAudio = () => {
      if (!audioContextRef.current) audioContextRef.current = new AudioContext();
      void audioContextRef.current.resume();
    };
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      void audioContextRef.current?.close();
    };
  }, []);

  useEffect(() => {
    let frame = 0;
    const updateProgress = () => {
      frame = 0;
      const section = journeyRef.current;
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const stageHeight = section.firstElementChild instanceof HTMLElement
        ? section.firstElementChild.offsetHeight
        : viewport.height;
      const distance = section.offsetHeight - stageHeight;
      const progress = clamp(-rect.top / Math.max(distance, 1));
      setScrollProgress(progress);
      if (progress < 0.86) soundPlayedRef.current = false;
      if (progress >= 0.96 && !soundPlayedRef.current) {
        soundPlayedRef.current = true;
        playFinishSound();
      }
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(updateProgress);
    };
    const syncStableViewport = () => {
      const section = journeyRef.current;
      const stage = section?.firstElementChild;
      setViewport({
        width: section?.clientWidth || window.innerWidth,
        height: stage instanceof HTMLElement ? stage.offsetHeight : window.innerHeight,
      });
    };
    const onResize = () => {
      if (Math.abs(window.innerWidth - viewport.width) < 8) return;
      syncStableViewport();
      onScroll();
    };
    syncStableViewport();
    updateProgress();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [viewport.width, viewport.height]);

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
        const { Place } = placesLibrary;
        const hydratedPlaces = await Promise.all(localPlaces.map(async (fallback, index): Promise<SushiPlace> => {
          try {
            const response = await Place.searchByText({
              textQuery: `${fallback.name}, ${fallback.address}`,
              fields: ['id', 'displayName', 'formattedAddress', 'rating', 'location', 'googleMapsURI', 'photos'],
              locationBias: { center: SCHIO.center, radius: 12000 },
              maxResultCount: 1,
            });
            const place = response.places[0];
            if (!place?.location) return fallback;
            const photo = place.photos?.[0];
            return {
              id: place.id || fallback.id || `place-${index}`,
              name: place.displayName || fallback.name,
              address: place.formattedAddress?.replace(', Italia', '') || fallback.address,
              note: fallback.note,
              rating: place.rating ?? fallback.rating,
              photoUrl: photo?.getURI({ maxWidth: 900, maxHeight: 700 }) || fallback.photoUrl,
              photoCredit: photo?.authorAttributions?.[0]?.displayName,
              lat: place.location.lat(),
              lng: place.location.lng(),
              mapsUrl: place.googleMapsURI || fallback.mapsUrl,
            };
          } catch {
            return fallback;
          }
        }));
        if (cancelled) return;
        setPlaces(hydratedPlaces);
        setActiveId(hydratedPlaces[0].id);
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
  const wideLayout = viewport.width >= 700;
  const plateHeight = viewport.width * (wideLayout ? 0.18 : 0.32);
  const plateCenterY = viewport.height * 0.95 - plateHeight / 2;
  const sushiSpread = Math.min(viewport.width * 0.145, 110);
  const plateRestingLine = plateCenterY - plateHeight * 0.27;
  const makiEnd = { x: viewport.width / 2 - (105 * 0.9) / 2, y: plateRestingLine - 105 * 0.9 };
  const nigiriEnd = { x: viewport.width / 2 - sushiSpread - (150 * 0.88) / 2, y: plateRestingLine - 92 * 0.88 };
  const ebiEnd = { x: viewport.width / 2 + sushiSpread - (150 * 0.86) / 2, y: plateRestingLine - 98 * 0.86 };
  const position = (start: number, end: number, progress: number) => start + (end - start) * progress;

  return (
    <main className="app-shell">
      <section className="hero" id="top">
        <div className="hero-copy">
          <span className="overline">Una domanda retorica</span>
          <h1>Ti piace<br />il sushi<br /><em>giusto?</em></h1>
        </div>
      </section>

      <section className="sushi-journey" id="viaggio" ref={journeyRef}>
        <div className="journey-stage">
          <div className="journey-copy" aria-live="polite">
            <p style={{ opacity: firstPhase, transform: `translateY(${(1 - firstPhase) * -22}px)` }}>Quello<br /><em>fatto bene.</em></p>
            <p style={{ opacity: secondPhase, transform: `translateY(${(1 - secondPhase) * 22}px)` }}>Quello che arriva<br /><em>al momento giusto.</em></p>
            <p style={{ opacity: thirdPhase, transform: `translateY(${(1 - thirdPhase) * 22}px)` }}>E soprattutto<br /><em>da condividere.</em></p>
          </div>

          <div className="moving-piece moving-nigiri" style={{ transform: `translate3d(${position(viewport.width * -0.57, nigiriEnd.x, nigiriProgress)}px, ${position(viewport.height * 0.73, nigiriEnd.y, nigiriProgress)}px, 0) rotate(${-28 + nigiriProgress * 366}deg) scale(${0.84 + nigiriProgress * 0.04})` }}><Nigiri /></div>
          <div className="moving-piece moving-maki" style={{ transform: `translate3d(${position(viewport.width * 1.18, makiEnd.x, makiProgress)}px, ${position(viewport.height * 0.61, makiEnd.y, makiProgress)}px, 0) rotate(${makiProgress * 360 - 25}deg) scale(${0.78 + makiProgress * 0.12})` }}><Maki /></div>
          <div className="moving-piece moving-ebi" style={{ transform: `translate3d(${position(viewport.width * 1.16, ebiEnd.x, ebiProgress)}px, ${position(viewport.height * 0.77, ebiEnd.y, ebiProgress)}px, 0) rotate(${18 + ebiProgress * 350}deg) scale(${0.76 + ebiProgress * 0.1})` }}><Ebi /></div>

          <div className="sushi-plate" style={{ opacity: plateProgress, transform: `translate(-50%, ${120 - plateProgress * 120}px) scale(${0.76 + plateProgress * 0.24})` }} />
          <div className="plate-front" style={{ opacity: plateProgress, transform: `translate(-50%, ${120 - plateProgress * 120}px) scale(${0.76 + plateProgress * 0.24})` }} />
          <div className={`finish-sparkles${scrollProgress >= 0.94 ? ' is-visible' : ''}`} aria-hidden="true">
            <i>✦</i><i>✦</i><i>✦</i><i>✦</i><i>✦</i>
          </div>
        </div>
      </section>

      <section className="map-section" id="mappa">
        <div className="map-heading">
          <span className="overline">Dove andiamo?</span>
          <h2>A lei<br /><em>la scelta.</em></h2>
        </div>

        <div className="map-wrap">
          <div ref={mapNode} className={mapReady ? 'google-map' : 'google-map is-hidden'} />
          {!mapReady && (
            <div className="fallback-map" aria-label="Mappa di Schio, Italia">
              <iframe title="Mappa di Schio" src="https://www.openstreetmap.org/export/embed.html?bbox=11.327%2C45.694%2C11.389%2C45.735&layer=mapnik" loading="lazy" />
              <div className="map-wash" />
              {localPlaces.map((place, index) => (
                <button key={place.id} type="button" className={`fallback-pin pin-${index + 1}${place.id === activeId ? ' is-active' : ''}`} onClick={() => setActiveId(place.id)} aria-label={`Seleziona ${place.name}`}><span>{index + 1}</span></button>
              ))}
            </div>
          )}

          <div className="map-location-pill"><MapPin size={15} /> 45.7142° N · 11.3568° E</div>
          {activePlace && (
            <article className="active-place-card">
              <img src={activePlace.photoUrl || fallbackPhoto} alt="" onError={useFallbackPhoto} />
              <div><small>La scelta di adesso</small><strong>{activePlace.name}</strong><p>{activePlace.address}</p></div>
              <a href={activePlace.mapsUrl} target="_blank" rel="noreferrer" aria-label={`Apri ${activePlace.name} su Google Maps`}><Navigation size={18} /></a>
            </article>
          )}
        </div>

        <div className="places-strip" aria-label="Ristoranti di sushi a Schio">
          {places.map((place, index) => (
            <article key={place.id} className={`restaurant-card${place.id === activeId ? ' is-active' : ''}${place.id === selectedId ? ' is-selected' : ''}`}>
              <button className="restaurant-preview" type="button" onClick={() => setActiveId(place.id)} aria-label={`Mostra ${place.name} sulla mappa`}>
                <span className="restaurant-photo">
                  <img src={place.photoUrl || fallbackPhoto} alt={`Sushi da ${place.name}`} loading="lazy" onError={useFallbackPhoto} />
                  <i>0{index + 1}</i>
                  {place.photoCredit && <small>Foto: {place.photoCredit}</small>}
                </span>
                <span className="restaurant-copy">
                  <strong>{place.name}</strong>
                  <small>{place.address}</small>
                  {place.rating && <span>★ {place.rating.toFixed(1)}</span>}
                </span>
              </button>
              <button className="select-place" type="button" onClick={() => choosePlace(place)}>
                {place.id === selectedId ? <><Check size={15} /> Scelto</> : 'Scegli questo posto'}
              </button>
            </article>
          ))}
        </div>

        {selectedPlace && (
          <section className="appointment-builder" ref={appointmentRef}>
            <span className="overline">Completa l’invito</span>
            <h3>Quando<br />ci andiamo?</h3>

            <div className="chosen-restaurant">
              <img src={selectedPlace.photoUrl || fallbackPhoto} alt="" onError={useFallbackPhoto} />
              <div><small>Hai scelto</small><strong>{selectedPlace.name}</strong><span>{selectedPlace.address}</span></div>
            </div>

            <label className="favorite-toggle">
              <input type="checkbox" checked={favoriteId === selectedPlace.id} onChange={(event) => setFavoriteId(event.target.checked ? selectedPlace.id : null)} />
              <i><Heart size={17} fill={favoriteId === selectedPlace.id ? 'currentColor' : 'none'} /></i>
              <span><strong>È il mio preferito</strong></span>
            </label>

            <div className="appointment-fields">
              <label className="date-field">
                <span><CalendarDays size={17} /> Scegli il giorno</span>
                <input type="date" min={minDate} value={date} onChange={(event) => setDate(event.target.value)} />
              </label>

              <fieldset className="meal-field">
                <legend>Pranzo o cena?</legend>
                <label className={meal === 'pranzo' ? 'is-selected' : ''}>
                  <input type="radio" name="meal" value="pranzo" checked={meal === 'pranzo'} onChange={() => setMeal('pranzo')} />
                  <Sun size={18} /> Pranzo
                </label>
                <label className={meal === 'cena' ? 'is-selected' : ''}>
                  <input type="radio" name="meal" value="cena" checked={meal === 'cena'} onChange={() => setMeal('cena')} />
                  <Moon size={18} /> Cena
                </label>
              </fieldset>
            </div>

            <a
              className={`whatsapp-button${isComplete ? '' : ' is-disabled'}`}
              href={isComplete ? whatsappUrl : undefined}
              target="_blank"
              rel="noreferrer"
              aria-disabled={!isComplete}
              onClick={(event) => { if (!isComplete) event.preventDefault(); }}
            >
              <Check size={19} /> E che sushi sia
            </a>
          </section>
        )}

        <footer><p>Quindi, sushi?</p></footer>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
