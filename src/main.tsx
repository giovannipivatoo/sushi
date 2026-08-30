import React, { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowUpRight, Check, ChevronDown, Heart, LocateFixed, MapPin,
  Navigation, Search, Sparkles, Star, X,
} from 'lucide-react';
import './styles.css';

type SushiPlace = {
  id: string;
  name: string;
  address: string;
  rating: number;
  reviews: number;
  price: number;
  openNow?: boolean;
  lat: number;
  lng: number;
  mapsUrl: string;
  note: string;
};

const demoPlaces: SushiPlace[] = [
  { id: 'demo-1', name: 'Iyo Omakase', address: 'Via Piero della Francesca, Milano', rating: 4.8, reviews: 1240, price: 4, openNow: true, lat: 45.483, lng: 9.161, mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Iyo+Milano', note: "Tonight's splurge" },
  { id: 'demo-2', name: 'Poporoya', address: 'Via Bartolomeo Eustachi, Milano', rating: 4.6, reviews: 2760, price: 2, openNow: false, lat: 45.477, lng: 9.218, mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Poporoya+Milano', note: 'Tiny, iconic, no fuss' },
  { id: 'demo-3', name: 'Temakinho', address: 'Corso Garibaldi, Milano', rating: 4.5, reviews: 1910, price: 3, openNow: true, lat: 45.478, lng: 9.184, mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Temakinho+Milano', note: 'Colorful Brazilian twist' },
  { id: 'demo-4', name: "J'S Hiro", address: 'Via Carlo Vittadini, Milano', rating: 4.7, reviews: 682, price: 3, openNow: true, lat: 45.447, lng: 9.193, mapsUrl: 'https://www.google.com/maps/search/?api=1&query=J%27S+Hiro+Milano', note: 'A quiet hidden gem' },
  { id: 'demo-5', name: 'Neta', address: 'Via Palermo, Milano', rating: 4.6, reviews: 510, price: 3, openNow: true, lat: 45.476, lng: 9.185, mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Neta+Milano', note: 'Date-night energy' },
];

let mapsLoader: Promise<void> | null = null;

function loadGoogleMaps(apiKey: string) {
  if (window.google?.maps) return Promise.resolve();
  if (mapsLoader) return mapsLoader;

  mapsLoader = new Promise((resolve, reject) => {
    const callbackName = '__makiMapsReady';
    (window as Window & { __makiMapsReady?: () => void })[callbackName] = resolve;
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async&libraries=maps,places,marker,geocoding&callback=${callbackName}`;
    script.async = true;
    script.onerror = () => reject(new Error('Google Maps could not be loaded.'));
    document.head.appendChild(script);
  });
  return mapsLoader;
}

function getPriceLevel(level?: string | number | null) {
  if (typeof level === 'number') return Math.min(4, Math.max(1, level));
  const prices: Record<string, number> = {
    PRICE_LEVEL_FREE: 1,
    PRICE_LEVEL_INEXPENSIVE: 1,
    PRICE_LEVEL_MODERATE: 2,
    PRICE_LEVEL_EXPENSIVE: 3,
    PRICE_LEVEL_VERY_EXPENSIVE: 4,
  };
  return prices[String(level)] ?? 2;
}

function App() {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const mapNode = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRefs = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const [region, setRegion] = useState('Milano, Italy');
  const [activeRegion, setActiveRegion] = useState('Milano, Italy');
  const [places, setPlaces] = useState<SushiPlace[]>(demoPlaces);
  const [activeId, setActiveId] = useState(demoPlaces[0].id);
  const [saved, setSaved] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('maki-saved') || '[]'); }
    catch { return []; }
  });
  const [minRating, setMinRating] = useState(0);
  const [openOnly, setOpenOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [notice, setNotice] = useState(apiKey ? 'Search a neighborhood to begin.' : 'Demo mode — add a Google Maps API key for live results.');
  const [winner, setWinner] = useState<SushiPlace | null>(null);

  const filteredPlaces = useMemo(
    () => places.filter((place) => place.rating >= minRating && (!openOnly || place.openNow)),
    [places, minRating, openOnly],
  );

  useEffect(() => localStorage.setItem('maki-saved', JSON.stringify(saved)), [saved]);

  useEffect(() => {
    if (!apiKey || !mapNode.current) return;
    let cancelled = false;
    loadGoogleMaps(apiKey)
      .then(async () => {
        if (cancelled || !mapNode.current) return;
        const { Map } = (await google.maps.importLibrary('maps')) as google.maps.MapsLibrary;
        mapRef.current = new Map(mapNode.current, {
          center: { lat: 45.4642, lng: 9.19 }, zoom: 13, mapId: 'DEMO_MAP_ID',
          clickableIcons: false, streetViewControl: false, mapTypeControl: false,
          fullscreenControl: false, cameraControl: false,
        });
        setMapReady(true);
        setNotice('Live Google Maps is ready.');
      })
      .catch(() => setNotice('Maps could not load. Check the API key and allowed domains.'));
    return () => { cancelled = true; };
  }, [apiKey]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    let cancelled = false;
    async function drawMarkers() {
      const { AdvancedMarkerElement, PinElement } = (await google.maps.importLibrary('marker')) as google.maps.MarkerLibrary;
      markerRefs.current.forEach((marker) => { marker.map = null; });
      markerRefs.current = [];
      filteredPlaces.forEach((place, index) => {
        if (cancelled) return;
        const pin = new PinElement({
          background: place.id === activeId ? '#e64935' : '#21382f', borderColor: '#fffaf3',
          glyphColor: '#ffffff', glyphText: String(index + 1), scale: place.id === activeId ? 1.18 : 0.96,
        });
        const marker = new AdvancedMarkerElement({
          map: mapRef.current, position: { lat: place.lat, lng: place.lng },
          title: place.name, content: pin.element,
        });
        marker.addListener('click', () => setActiveId(place.id));
        markerRefs.current.push(marker);
      });
    }
    drawMarkers();
    return () => { cancelled = true; };
  }, [filteredPlaces, activeId, mapReady]);

  async function searchRegion(event: FormEvent) {
    event.preventDefault();
    const query = region.trim();
    if (!query) return;
    setActiveRegion(query);
    if (!apiKey || !mapReady || !mapRef.current) {
      setNotice(`Showing sample picks near ${query}. Add an API key for live places.`);
      return;
    }

    setLoading(true);
    setNotice(`Finding the best sushi around ${query}…`);
    try {
      const [{ Geocoder }, { Place, SearchByTextRankPreference }] = await Promise.all([
        google.maps.importLibrary('geocoding') as Promise<google.maps.GeocodingLibrary>,
        google.maps.importLibrary('places') as Promise<google.maps.PlacesLibrary>,
      ]);
      const geocoded = await new Geocoder().geocode({ address: query });
      const match = geocoded.results[0];
      if (!match) throw new Error('Region not found');
      mapRef.current.fitBounds(match.geometry.viewport);
      const response = await Place.searchByText({
        textQuery: `sushi restaurants in ${query}`,
        fields: ['id', 'displayName', 'formattedAddress', 'rating', 'userRatingCount', 'priceLevel', 'location', 'googleMapsURI', 'regularOpeningHours'],
        includedType: 'sushi_restaurant', locationRestriction: match.geometry.viewport,
        maxResultCount: 15, rankPreference: SearchByTextRankPreference.RELEVANCE,
      });
      const livePlaces = await Promise.all(response.places.filter((place) => place.location).map(async (place, index): Promise<SushiPlace> => ({
        id: place.id || `place-${index}`, name: place.displayName || 'Sushi restaurant',
        address: place.formattedAddress || query, rating: place.rating || 0,
        reviews: place.userRatingCount || 0, price: getPriceLevel(place.priceLevel),
        openNow: await place.isOpen(), lat: place.location!.lat(), lng: place.location!.lng(),
        mapsUrl: place.googleMapsURI || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.displayName || 'sushi')}`,
        note: index === 0 ? 'Top match nearby' : index < 4 ? 'A local favorite' : 'Worth a look',
      })));
      if (!livePlaces.length) throw new Error('No places found');
      setPlaces(livePlaces);
      setActiveId(livePlaces[0].id);
      setNotice(`${livePlaces.length} lovely options around ${query}.`);
    } catch (error) {
      setNotice(error instanceof Error ? `${error.message}. Try a nearby city or district.` : 'Search failed. Try again.');
    } finally { setLoading(false); }
  }

  function useMyLocation() {
    if (!navigator.geolocation) { setNotice('Location is not available in this browser.'); return; }
    setNotice('Finding your neighborhood…');
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      if (apiKey && mapReady) {
        try {
          const { Geocoder } = (await google.maps.importLibrary('geocoding')) as google.maps.GeocodingLibrary;
          const result = await new Geocoder().geocode({ location: { lat: coords.latitude, lng: coords.longitude } });
          const label = result.results[0]?.formatted_address || `${coords.latitude.toFixed(3)}, ${coords.longitude.toFixed(3)}`;
          setRegion(label); setActiveRegion(label);
          setNotice('Location found — press Find sushi to search here.');
        } catch { setNotice('Location found — enter the district name to search nearby.'); }
      } else { setNotice('Location found. Live nearby results need a Google Maps API key.'); }
    }, () => setNotice('Location permission was not granted.'), { enableHighAccuracy: false, timeout: 8000 });
  }

  function toggleSaved(id: string) {
    setSaved((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function pickForUs() {
    const savedPlaces = places.filter((place) => saved.includes(place.id));
    const pool = savedPlaces.length ? savedPlaces : filteredPlaces;
    if (!pool.length) { setNotice('No spots match those filters yet.'); return; }
    setWinner(pool[Math.floor(Math.random() * pool.length)]);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Maki a Choice home"><span className="brand-mark" aria-hidden="true"><span /></span><span>Maki a Choice</span></a>
        <div className="top-actions">
          <button className="saved-pill" type="button" onClick={() => setNotice(saved.length ? `${saved.length} saved spot${saved.length === 1 ? '' : 's'} — use Pick for us when you’re ready.` : 'Tap the hearts to make a shortlist.')}><Heart size={16} fill={saved.length ? 'currentColor' : 'none'} />{saved.length} saved</button>
          <button className="primary-button compact" type="button" onClick={pickForUs}><Sparkles size={16} /> Pick for us</button>
        </div>
      </header>

      <section className="hero" id="top">
        <div><span className="eyebrow">Dinner, decided.</span><h1>Find the one<br /><em>worth dressing up for.</em></h1></div>
        <p>Pick a neighborhood. Save her favorites.<br />Let fate handle the final decision.</p>
      </section>

      <form className="search-card" onSubmit={searchRegion}>
        <div className="search-field">
          <MapPin size={20} aria-hidden="true" />
          <label><span>Where are we looking?</span><input value={region} onChange={(event) => setRegion(event.target.value)} placeholder="City, neighborhood or region" aria-label="City, neighborhood or region" /></label>
          <button className="location-button" type="button" onClick={useMyLocation} aria-label="Use my current location" title="Use my location"><LocateFixed size={19} /></button>
        </div>
        <button className="primary-button search-button" type="submit" disabled={loading}><Search size={18} /> {loading ? 'Searching…' : 'Find sushi'}</button>
      </form>
      <div className="status-row" role="status"><span className={apiKey && mapReady ? 'live-dot' : 'demo-dot'} /> {notice}</div>

      <section className="content-grid" aria-label="Sushi restaurant results">
        <div className="results-panel">
          <div className="results-heading">
            <div><span className="eyebrow">Near {activeRegion}</span><h2>{filteredPlaces.length} places to fall for</h2></div>
            <div className="filters">
              <button className={minRating ? 'filter active' : 'filter'} type="button" onClick={() => setMinRating(minRating ? 0 : 4.5)}><Star size={14} fill={minRating ? 'currentColor' : 'none'} /> 4.5+</button>
              <button className={openOnly ? 'filter active' : 'filter'} type="button" onClick={() => setOpenOnly(!openOnly)}>{openOnly && <Check size={14} />} Open now</button>
            </div>
          </div>
          <div className="place-list">
            {filteredPlaces.map((place, index) => (
              <article key={place.id} className={place.id === activeId ? 'place-card active' : 'place-card'} onMouseEnter={() => setActiveId(place.id)}>
                <button className="card-main" type="button" onClick={() => setActiveId(place.id)} aria-label={`Show ${place.name} on map`}>
                  <span className="place-number">{String(index + 1).padStart(2, '0')}</span>
                  <span className="place-copy"><span className="place-kicker">{place.note}</span><strong>{place.name}</strong><span className="place-address">{place.address}</span>
                    <span className="place-meta"><b><Star size={13} fill="currentColor" /> {place.rating.toFixed(1)}</b><span>{place.reviews.toLocaleString()} reviews</span><span>{'€'.repeat(place.price)}</span>{place.openNow !== undefined && <span className={place.openNow ? 'open' : 'closed'}>{place.openNow ? 'Open' : 'Closed'}</span>}</span>
                  </span>
                </button>
                <div className="card-actions">
                  <button className={saved.includes(place.id) ? 'heart-button saved' : 'heart-button'} type="button" onClick={() => toggleSaved(place.id)} aria-label={`${saved.includes(place.id) ? 'Remove' : 'Save'} ${place.name}`}><Heart size={19} fill={saved.includes(place.id) ? 'currentColor' : 'none'} /></button>
                  <a href={place.mapsUrl} target="_blank" rel="noreferrer" aria-label={`Open ${place.name} in Google Maps`}><ArrowUpRight size={18} /></a>
                </div>
              </article>
            ))}
            {!filteredPlaces.length && <div className="empty-state"><span>🍣</span><h3>No rolls in sight</h3><p>Try loosening a filter or searching a nearby district.</p></div>}
          </div>
        </div>

        <aside className="map-panel" aria-label="Map of sushi restaurants">
          <div ref={mapNode} className={apiKey ? 'google-map' : 'google-map hidden'} />
          {!apiKey && <div className="demo-map" aria-label="Demo map illustration"><span className="park-label">PARCO SEMPIONE</span><span className="waterway" />{filteredPlaces.map((place, index) => <button key={place.id} className={place.id === activeId ? `map-pin pin-${index + 1} active` : `map-pin pin-${index + 1}`} type="button" onClick={() => setActiveId(place.id)} aria-label={`Select ${place.name}`}>{index + 1}</button>)}</div>}
          <div className="map-label"><Navigation size={14} /> {activeRegion}</div>
          <button className="map-recenter" type="button" onClick={() => { const active = places.find((place) => place.id === activeId); if (active && mapRef.current) mapRef.current.panTo({ lat: active.lat, lng: active.lng }); }} aria-label="Center selected restaurant"><LocateFixed size={18} /></button>
          <div className="map-card"><span>Tonight's shortlist</span><strong>{saved.length || 'No'} spot{saved.length === 1 ? '' : 's'} saved</strong><button type="button" onClick={pickForUs}>Let fate choose <ChevronDown size={15} /></button></div>
        </aside>
      </section>

      <footer><span>Made for good taste &amp; great company.</span><span>Places by Google Maps</span></footer>
      {winner && <div className="modal-backdrop" role="presentation" onMouseDown={() => setWinner(null)}><section className="winner-modal" role="dialog" aria-modal="true" aria-labelledby="winner-title" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" type="button" onClick={() => setWinner(null)} aria-label="Close"><X size={18} /></button><span className="winner-emoji">🍣</span><span className="eyebrow">The universe has spoken</span><h2 id="winner-title">{winner.name}</h2><p>{winner.address}</p><div className="winner-meta"><Star size={15} fill="currentColor" /> {winner.rating.toFixed(1)} <span>·</span> {'€'.repeat(winner.price)}</div><a className="primary-button" href={winner.mapsUrl} target="_blank" rel="noreferrer">Take me there <Navigation size={17} /></a><button className="try-again" type="button" onClick={pickForUs}>Not feeling it? Pick again</button></section></div>}
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
