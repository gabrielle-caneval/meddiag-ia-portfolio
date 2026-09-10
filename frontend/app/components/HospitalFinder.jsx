/*

PROTECTION – DROITS D’AUTEUR – 2026

 

© 2026 

 

Ce travail (code source + documents associés) est protégé par le droit d’auteur.

Code consultable pour évaluation du portfolio. Voir LICENSE.

Aucune cession de droits. Toute autre utilisation (reproduction, modification,

exploitation pédagogique ou commerciale) interdite sans accord écrit préalable.

*/

"use client";
import React, { useState, useEffect, useRef } from "react";

const P = {
  turquoise: "#75ddd3", turquoiseDark: "#4bbfb5",
  turquoiseLight: "rgba(117,221,211,0.13)",
  azurLight: "#dbeef9", azur: "#54a4bf", azurDark: "#3a7fa0",
  azurFaint: "rgba(84,164,191,0.1)",
  jauneLight: "#F2F0e9", jaune: "#e1e776",
  white: "#ffffff", bg: "#f4f9fb",
  text: "#1a2e38", textSub: "#4a6578", textMuted: "#8aa3b0",
  border: "rgba(84,164,191,0.2)",
  shadow: "0 2px 12px rgba(84,164,191,0.1)",
};

function useHover() {
  const [h, setH] = useState(false);
  return [h, { onMouseEnter: () => setH(true), onMouseLeave: () => setH(false) }];
}

// ─── Nominatim geocoding ──────────────────────────────────────────────────────
async function geocode(query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1`;
  const r = await fetch(url, { headers: { "Accept-Language": "fr" } });
  const data = await r.json();
  if (!data.length) throw new Error("Lieu introuvable");
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), display: data[0].display_name };
}

// ─── Overpass API — hôpitaux, cliniques, urgences ────────────────────────────
async function fetchHealthFacilities(lat, lon, radiusKm = 5) {
  const r = radiusKm * 1000;
  // Query compact - hospitals & clinics only, no way (faster)
  const q = `[out:json][timeout:30];(node["amenity"~"hospital|clinic|doctors"](around:${r},${lat},${lon});node["healthcare"~"hospital|clinic"](around:${r},${lat},${lon}););out;`;

  const endpoints = [
    { url: "https://overpass-api.de/api/interpreter",              method: "POST", body: () => "data=" + encodeURIComponent(q) },
    { url: "https://overpass.kumi.systems/api/interpreter",         method: "POST", body: () => "data=" + encodeURIComponent(q) },
    { url: "https://overpass.openstreetmap.ru/api/interpreter",     method: "POST", body: () => "data=" + encodeURIComponent(q) },
    // GET fallback — some proxies block POST
    { url: `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`, method: "GET", body: () => null },
  ];

  const parseElements = (data) => data.elements
    .map(el => ({
      id: el.id,
      name: el.tags?.name || el.tags?.["name:fr"] || "Établissement de santé",
      type: el.tags?.amenity || el.tags?.healthcare || "clinic",
      lat: el.lat,
      lon: el.lon,
      phone: el.tags?.phone || el.tags?.["contact:phone"] || null,
      website: el.tags?.website || el.tags?.["contact:website"] || null,
      emergency: el.tags?.emergency === "yes",
      address: [el.tags?.["addr:housenumber"], el.tags?.["addr:street"], el.tags?.["addr:city"]].filter(Boolean).join(" "),
    }))
    .filter(el => el.lat && el.lon)
    .sort((a, b) => (a.emergency ? 0 : a.type === "hospital" ? 1 : 2) - (b.emergency ? 0 : b.type === "hospital" ? 1 : 2));

  for (const ep of endpoints) {
    try {
      const opts = { method: ep.method, signal: AbortSignal.timeout(12000) };
      if (ep.method === "POST") {
        opts.headers = { "Content-Type": "application/x-www-form-urlencoded" };
        opts.body = ep.body();
      }
      const res = await fetch(ep.url, opts);
      const text = await res.text();
      if (text.trim().startsWith("<") || text.trim().startsWith("<!")) continue; // XML error page
      const data = JSON.parse(text);
      if (data.elements) return parseElements(data);
    } catch {}
  }
  return []; // Return empty instead of throwing — map still shows
}

// Distance haversine en km
function distKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return (R * 2 * Math.asin(Math.sqrt(a))).toFixed(1);
}

function FacilityCard({ f, i, center, selected, setSelected }) {
  const [hov, hProps] = useHover();
  const cfg = TYPE_LABELS[f.type] || TYPE_LABELS.clinic;
  const dist = distKm(center.lat, center.lon, f.lat, f.lon);
  const isSelected = selected === i;
  return (
    <div {...hProps} onClick={() => setSelected(isSelected ? null : i)} style={{
      padding: "12px 14px", borderRadius: 10, cursor: "pointer", transition: "all 0.15s",
      background: isSelected ? P.turquoiseLight : hov ? P.jauneLight : P.white,
      border: `1px solid ${isSelected ? P.turquoise : P.border}`,
      transform: hov && !isSelected ? "translateX(2px)" : "none",
      boxShadow: isSelected ? `0 2px 12px rgba(117,221,211,0.2)` : "none",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 15 }}>{f.emergency ? "🚨" : cfg.icon}</span>
          <span style={{ fontWeight: 700, fontSize: 13, color: P.text, lineHeight: 1.3 }}>{f.name}</span>
        </div>
        <span style={{ fontSize: 11, color: P.textMuted, whiteSpace: "nowrap", marginLeft: 8 }}>{dist} km</span>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: `${cfg.color}15`, color: cfg.color, fontWeight: 600 }}>{cfg.label}</span>
        {f.emergency && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: "rgba(231,76,60,0.12)", color: "#e74c3c", fontWeight: 600 }}>Urgences</span>}
      </div>
      {f.address && <div style={{ fontSize: 11, color: P.textMuted, marginTop: 4 }}>📍 {f.address}</div>}
      {isSelected && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${P.border}`, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {f.phone && <a href={`tel:${f.phone}`} style={{ fontSize: 11, color: P.azur, textDecoration: "none" }}>📞 {f.phone}</a>}
          {f.website && <a href={f.website} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: P.azur, textDecoration: "none" }}>🌐 Site web</a>}
          <a href={`https://www.openstreetmap.org/directions?to=${f.lat},${f.lon}`} target="_blank" rel="noreferrer"
            style={{ fontSize: 11, color: P.turquoiseDark, fontWeight: 600, textDecoration: "none" }}>
            🗺️ Itinéraire
          </a>
        </div>
      )}
    </div>
  );
}

const TYPE_LABELS = {
  hospital: { label: "Hôpital", color: "#e74c3c", icon: "🏥" },
  clinic:   { label: "Clinique", color: P.azur,    icon: "🏨" },
  doctors:  { label: "Cabinet", color: P.turquoiseDark, icon: "🩺" },
};

// ─── Carte Leaflet ────────────────────────────────────────────────────────────
const leafletLoaded = { done: false };

async function ensureLeaflet() {
  if (leafletLoaded.done && window.L) return window.L;
  if (!window.L) {
    if (!document.querySelector('link[href*="leaflet"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    await new Promise((res, rej) => {
      if (window.L) { res(); return; }
      const s = document.createElement("script");
      s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  leafletLoaded.done = true;
  return window.L;
}

function LeafletMap({ center, facilities }) {
  const wrapperRef = useRef(null);
  const mapRef     = useRef(null);
  const markersLayerRef = useRef(null);

  // ── Effet 1 : init carte (uniquement quand center change) ──
  useEffect(() => {
    if (!center || !wrapperRef.current) return;
    let alive = true;

    ensureLeaflet().then(L => {
      if (!alive || !wrapperRef.current) return;

      // Détruire la carte précédente proprement
      if (mapRef.current) {
        try { mapRef.current.off(); mapRef.current.remove(); } catch {}
        mapRef.current = null; markersLayerRef.current = null;
      }

      // Créer un div impératif dans le wrapper React
      wrapperRef.current.innerHTML = "";
      const div = document.createElement("div");
      div.style.cssText = "width:100%;height:100%;";
      wrapperRef.current.appendChild(div);

      const map = L.map(div, { zoomControl: true, scrollWheelZoom: false });
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://openstreetmap.org">OSM</a>',
        maxZoom: 18,
      }).addTo(map);

      map.setView([center.lat, center.lon], 13);

      // Marqueur de position
      L.divIcon && L.marker([center.lat, center.lon], {
        icon: L.divIcon({
          html: `<div style="width:12px;height:12px;background:#ff3b30;border:2.5px solid white;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>`,
          iconSize:[12,12], iconAnchor:[6,6], className:"",
        })
      }).addTo(map).bindPopup("<b>Votre position</b>");

      // Créer un LayerGroup pour les marqueurs d'établissements
      markersLayerRef.current = L.layerGroup().addTo(map);
    }).catch(console.error);

    return () => {
      alive = false;
      if (mapRef.current) {
        try { mapRef.current.off(); mapRef.current.remove(); } catch {}
        mapRef.current = null; markersLayerRef.current = null;
      }
    };
  }, [center]); // ← uniquement center, PAS facilities

  // ── Effet 2 : mise à jour des marqueurs (sans recréer la carte) ──
  useEffect(() => {
    if (!mapRef.current || !markersLayerRef.current || !window.L) return;
    const L = window.L;
    const layer = markersLayerRef.current;

    layer.clearLayers(); // Efface anciens marqueurs, garde la carte

    const typeColor = { hospital:"#ff3b30", clinic:"#54a4bf", doctors:"#34c759" };
    const typeLabel = { hospital:"Hôpital", clinic:"Clinique", doctors:"Cabinet" };

    facilities.forEach(f => {
      const c = typeColor[f.type] || "#54a4bf";
      const icon = L.divIcon({
        html: `<div style="background:${f.emergency?"#ff3b30":c};color:white;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.2);border:2px solid white;font-weight:800;">+</div>`,
        iconSize:[30,30], iconAnchor:[15,15], className:"",
      });
      const popup = `<div style="font-family:system-ui;min-width:160px"><strong style="font-size:13px">${f.name}</strong><br/><span style="font-size:11px;color:#666">${typeLabel[f.type]||""}${f.emergency?" · Urgences":""}</span>${f.address?`<br/><span style="font-size:11px">📍 ${f.address}</span>`:""}${f.phone?`<br/><a href="tel:${f.phone}" style="font-size:11px;color:#54a4bf">📞 ${f.phone}</a>`:""}${f.website?`<br/><a href="${f.website}" target="_blank" style="font-size:11px;color:#54a4bf">🌐 Site</a>`:""}<br/><a href="https://www.openstreetmap.org/directions?to=${f.lat},${f.lon}" target="_blank" style="font-size:11px;color:#4bbfb5;font-weight:600">🗺️ Itinéraire</a></div>`;
      L.marker([f.lat, f.lon], { icon }).addTo(layer).bindPopup(popup);
    });
  }, [facilities]); // ← uniquement facilities, PAS center

  return <div ref={wrapperRef} style={{ width:"100%", height:380, borderRadius:12, overflow:"hidden", border:`1px solid ${P.border}` }} />;
}


// ─── Composant principal ──────────────────────────────────────────────────────
export default function HospitalFinder({ urgenceLevel }) {
  const [query, setQuery]           = useState("");
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const [center, setCenter]         = useState(null);
  const [facilities, setFacilities] = useState([]);
  const [radius, setRadius]         = useState(5);
  const [selected, setSelected]     = useState(null);
  const [geolocating, setGeolocating] = useState(false);

  const [loadingFacilities, setLoadingFacilities] = useState(false);

  const loadFacilities = async (lat, lon) => {
    setLoadingFacilities(true);
    setFacilities([]);
    const results = await fetchHealthFacilities(lat, lon, radius);
    setFacilities(results);
    setLoadingFacilities(false);
  };

  const search = async (searchQuery) => {
    const q = searchQuery || query;
    if (!q.trim()) return;
    setLoading(true); setError(""); setFacilities([]); setSelected(null);
    try {
      const loc = await geocode(q);
      setCenter(loc);      // ← carte s'affiche immédiatement
      setLoading(false);
      loadFacilities(loc.lat, loc.lon); // ← établissements en arrière-plan
    } catch (e) {
      setError(e.message || "Lieu introuvable — vérifiez l'orthographe");
      setLoading(false);
    }
  };

  const geolocate = () => {
    if (!navigator.geolocation) { setError("Géolocalisation non disponible."); return; }
    setGeolocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        setError(""); setFacilities([]); setSelected(null);
        setCenter({ lat, lon, display: "Votre position actuelle" });
        setGeolocating(false);
        loadFacilities(lat, lon);
      },
      (err) => { setError("Position indisponible : " + err.message); setGeolocating(false); }
    );
  };

  const urgCfg = urgenceLevel === "haute"
    ? { msg: "Urgence — orientation hospitalière recommandée", color: "#e74c3c", iconName: "emergency" }
    : urgenceLevel === "moyenne"
    ? { msg: "Bilan ambulatoire recommandé", color: P.azur, iconName: "labs" }
    : { msg: "Suivi médical de ville possible", color: P.turquoiseDark, iconName: "stethoscope" };

  return (
    <div style={{ background: P.white, border: `1px solid ${P.border}`, borderRadius: 14, padding: 22, boxShadow: P.shadow }}>
      {/* Titre */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 24 }}>📍</span>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, color: P.text }}>Établissements de santé à proximité</div>
          <div style={{ fontSize: 12, color: P.textMuted }}>OpenStreetMap · Données libres</div>
        </div>
        {urgenceLevel && (
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 20, background: `${urgCfg.color}12`, border: `1px solid ${urgCfg.color}40` }}>
            <span style={{fontSize:16}} translate="no" className="material-symbols-rounded" aria-hidden="true">{urgCfg.iconName}</span>
            <span style={{ fontSize: 12, color: urgCfg.color, fontWeight: 600 }}>{urgCfg.msg}</span>
          </div>
        )}
      </div>

      {/* Barre de recherche */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && search()}
          placeholder="Ville, quartier, adresse... ex: Dakar, Lyon 3, Bruxelles"
          style={{
            flex: 1, background: P.jauneLight, border: `1.5px solid ${P.border}`,
            borderRadius: 8, padding: "10px 14px", color: P.text, fontSize: 13,
            fontFamily: "inherit", outline: "none", transition: "border-color 0.2s",
          }}
          onFocus={e => e.target.style.borderColor = P.turquoise}
          onBlur={e => e.target.style.borderColor = P.border}
        />
        <button onClick={geolocate} disabled={geolocating} title="Utiliser ma position" style={{
          background: geolocating ? P.azurFaint : P.jauneLight, border: `1.5px solid ${P.border}`,
          borderRadius: 8, padding: "10px 14px", cursor: "pointer", fontSize: 16, transition: "all 0.15s",
        }}
          onMouseEnter={e => e.currentTarget.style.borderColor = P.turquoise}
          onMouseLeave={e => e.currentTarget.style.borderColor = P.border}>
          {geolocating ? "⟳" : "📍"}
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: P.jauneLight, border: `1.5px solid ${P.border}`, borderRadius: 8, padding: "0 12px" }}>
          <span style={{ fontSize: 11, color: P.textMuted, whiteSpace: "nowrap" }}>Rayon</span>
          <select value={radius} onChange={e => setRadius(Number(e.target.value))} style={{ background: "transparent", border: "none", outline: "none", fontSize: 13, color: P.text, cursor: "pointer" }}>
            {[1, 2, 5, 10, 20, 50].map(v => <option key={v} value={v}>{v} km</option>)}
          </select>
        </div>
        <button onClick={() => search()} disabled={loading || !query.trim()} style={{
          background: loading ? P.azurFaint : P.turquoise, border: "none", borderRadius: 8,
          padding: "10px 22px", fontWeight: 700, fontSize: 13, cursor: loading ? "wait" : "pointer",
          color: P.text, transition: "all 0.15s", boxShadow: "0 2px 8px rgba(117,221,211,0.3)",
        }}>
          {loading ? "⟳ Recherche..." : "Rechercher"}
        </button>
      </div>

      {/* Erreur */}
      {error && (
        <div style={{ padding: "10px 14px", background: "rgba(231,76,60,0.07)", border: "1px solid rgba(231,76,60,0.25)", borderRadius: 8, fontSize: 12, color: "#c0392b", marginBottom: 12 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Résultats + Carte */}
      {center && (
        <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 14, marginTop: 4 }}>
          {/* Liste */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 380, overflowY: "auto", paddingRight: 4 }}>
            {loadingFacilities && (
            <div style={{ textAlign: "center", padding: "30px 0", color: P.textMuted, fontSize: 13, display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
              <span style={{animation:"spin 1s linear infinite",display:"inline-block",fontSize:16}} translate="no" className="material-symbols-rounded">autorenew</span>
              Recherche des établissements...
            </div>
          )}
          {!loadingFacilities && facilities.length === 0 && center && (
              <div style={{ textAlign: "center", padding: "40px 0", color: P.textMuted, fontSize: 13 }}>
                Aucun résultat dans ce rayon
              </div>
            )}
            {facilities.map((f, i) => (
              <FacilityCard key={f.id} f={f} i={i} center={center} selected={selected} setSelected={setSelected}/>
            ))}
          </div>

          {/* Carte */}
          <LeafletMap center={center} facilities={facilities} userLocation={center} />
        </div>
      )}

      {/* Message vide initial */}
      {!center && !loading && (
        <div style={{ textAlign: "center", padding: "32px 0", color: P.textMuted, fontSize: 13, lineHeight: 2, border: `2px dashed ${P.border}`, borderRadius: 10 }}>
          🔍 Saisissez un lieu pour trouver les établissements de santé proches<br />
          <span style={{ fontSize: 11 }}>Fonctionne partout dans le monde · Données OpenStreetMap</span>
        </div>
      )}
    </div>
  );
}