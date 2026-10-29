import { useEffect, useRef } from "react";
import L from "leaflet";
import GoogleRouteMap from "./GoogleRouteMap.jsx";

export default function RealRouteMap({ waypoints, directWaypoints, originName, destinationName }) {
  const googleApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  if (googleApiKey && googleApiKey !== "your_google_maps_api_key_here") {
    return (
      <GoogleRouteMap
        waypoints={waypoints}
        directWaypoints={directWaypoints}
        originName={originName}
        destinationName={destinationName}
        apiKey={googleApiKey}
      />
    );
  }

  return <LeafletRouteMap waypoints={waypoints} directWaypoints={directWaypoints} originName={originName} destinationName={destinationName} />;
}

function LeafletRouteMap({ waypoints, directWaypoints, originName, destinationName }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const safeCoords = (waypoints || []).map((w) => [w.lat, w.lng]);
    const directCoords = (directWaypoints || []).map((w) => [w.lat, w.lng]);

    if (safeCoords.length === 0) return;

    const startPt = safeCoords[0];
    const endPt = safeCoords[safeCoords.length - 1];

    const map = L.map(mapContainerRef.current, {
      center: startPt,
      zoom: 12,
      zoomControl: true
    });

    mapInstanceRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(map);

    const createCustomIcon = (color, text) =>
      L.divIcon({
        className: "custom-leaflet-marker",
        html: `<div style="background-color: ${color}; color: white; padding: 4px 8px; border-radius: 8px; font-weight: bold; font-size: 11px; border: 2px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.5); white-space: nowrap;">${text}</div>`,
        iconSize: [80, 30],
        iconAnchor: [40, 15]
      });

    if (directCoords.length > 0) {
      L.polyline(directCoords, {
        color: "#FF4757",
        weight: 4,
        dashArray: "6, 8",
        opacity: 0.8
      }).addTo(map);
    }

    L.polyline(safeCoords, {
      color: "#10B981",
      weight: 5,
      opacity: 0.95
    }).addTo(map);

    L.marker(startPt, { icon: createCustomIcon("#7C5CFC", `📍 ${originName || "Start"}`) }).addTo(map);
    L.marker(endPt, { icon: createCustomIcon("#EF4444", `🏁 ${destinationName || "Destination"}`) }).addTo(map);

    const bounds = L.latLngBounds([...safeCoords, ...directCoords]);
    map.fitBounds(bounds, { padding: [50, 50] });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [waypoints, directWaypoints, originName, destinationName]);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-white/10 shadow-lg" style={{ height: "360px" }}>
      <div ref={mapContainerRef} className="w-full h-full z-0" />
      <div className="absolute bottom-3 left-3 z-[1000] bg-night-950/90 backdrop-blur-md border border-white/10 px-3 py-2 rounded-xl text-xs flex gap-4 text-slate-200">
        <span className="flex items-center gap-1.5"><span className="w-3.5 h-1 bg-emerald-500 rounded"></span> 🟩 AI Safe Route</span>
        <span className="flex items-center gap-1.5"><span className="w-3.5 h-0.5 bg-rose-500 border-dashed"></span> 🟥 Direct Route (Unsafe)</span>
      </div>
    </div>
  );
}
