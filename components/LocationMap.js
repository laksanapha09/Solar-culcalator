"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

// Tap or click the map to choose a location. Leaflet needs `window`,
// so it is loaded inside useEffect.
export default function LocationMap({ lat, lon, onPick }) {
  const box = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const pick = useRef(onPick);
  pick.current = onPick;

  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || map.current || !box.current) return;
      const m = L.map(box.current, { scrollWheelZoom: false }).setView([lat, lon], 6);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(m);
      marker.current = L.circleMarker([lat, lon], {
        radius: 9, color: "#ffffff", weight: 3, fillColor: "#c2410c", fillOpacity: 1,
      }).addTo(m);
      m.on("click", (e) => pick.current(e.latlng.lat, e.latlng.lng));
      map.current = m;
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const la = Number(lat), lo = Number(lon);
    if (!map.current || !Number.isFinite(la) || !Number.isFinite(lo)) return;
    marker.current.setLatLng([la, lo]);
    if (!map.current.getBounds().contains([la, lo])) map.current.panTo([la, lo]);
  }, [lat, lon]);

  return <div ref={box} className="map" role="application" aria-label="แผนที่เลือกตำแหน่ง" />;
}
