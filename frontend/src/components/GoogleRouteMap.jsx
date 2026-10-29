import { useEffect, useRef, useState } from "react";
import L from "leaflet";

export default function GoogleRouteMap({ waypoints, directWaypoints, originName, destinationName, apiKey }) {
  const mapRef = useRef(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!mapRef.current || !apiKey) return;

    // Listen for Google Maps Authentication Failure (invalid key or quota)
    window.gm_authFailure = () => {
      console.warn("Google Maps Auth failed — falling back to OpenStreetMap Leaflet.");
      setHasError(true);
    };

    const scriptId = "google-maps-sdk";
    let script = document.getElementById(scriptId);

    const initMap = () => {
      try {
        if (!window.google || !window.google.maps) {
          setHasError(true);
          return;
        }

        const safeCoords = (waypoints || []).map((w) => ({ lat: w.lat, lng: w.lng }));
        const directCoords = (directWaypoints || []).map((w) => ({ lat: w.lat, lng: w.lng }));

        if (safeCoords.length === 0) return;

        const map = new window.google.maps.Map(mapRef.current, {
          center: safeCoords[0],
          zoom: 13,
          mapTypeId: "roadmap",
          styles: [
            { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
            { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
            { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
            { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] }
          ]
        });

        if (directCoords.length > 0) {
          new window.google.maps.Polyline({
            path: directCoords,
            geodesic: true,
            strokeColor: "#FF4757",
            strokeOpacity: 0.8,
            strokeWeight: 4,
            map
          });
        }

        new window.google.maps.Polyline({
          path: safeCoords,
          geodesic: true,
          strokeColor: "#10B981",
          strokeOpacity: 0.95,
          strokeWeight: 5,
          map
        });

        new window.google.maps.Marker({
          position: safeCoords[0],
          map,
          title: originName || "Start Location",
          label: "📍"
        });

        new window.google.maps.Marker({
          position: safeCoords[safeCoords.length - 1],
          map,
          title: destinationName || "Destination",
          label: "🏁"
        });

        const bounds = new window.google.maps.LatLngBounds();
        [...safeCoords, ...directCoords].forEach((pt) => bounds.extend(pt));
        map.fitBounds(bounds);
      } catch (err) {
        setHasError(true);
      }
    };

    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.onload = initMap;
      script.onerror = () => setHasError(true);
      document.head.appendChild(script);
    } else {
      if (window.google && window.google.maps) {
        initMap();
      }
    }
  }, [waypoints, directWaypoints, originName, destinationName, apiKey]);

  if (hasError) {
    return (
      <LeafletFallbackMap
        waypoints={waypoints}
        directWaypoints={directWaypoints}
        originName={originName}
        destinationName={destinationName}
      />
    );
  }

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-white/10 shadow-lg" style={{ height: "360px" }}>
      <div ref={mapRef} className="w-full h-full" />
      <div className="absolute bottom-3 left-3 z-[1000] bg-night-950/90 backdrop-blur-md border border-white/10 px-3 py-2 rounded-xl text-xs flex gap-4 text-slate-200">
        <span className="flex items-center gap-1.5"><span className="w-3.5 h-1 bg-emerald-500 rounded"></span> 🟩 AI Safe Route</span>
        <span className="flex items-center gap-1.5"><span className="w-3.5 h-0.5 bg-rose-500 border-dashed"></span> 🟥 Direct Path (Unsafe)</span>
      </div>
    </div>
  );
}

function LeafletFallbackMap({ waypoints, directWaypoints, originName, destinationName }) {
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
        <span className="flex items-center gap-1.5"><span className="w-3.5 h-0.5 bg-rose-500 border-dashed"></span> 🟥 Direct Path (Unsafe)</span>
      </div>
    </div>
  );
}
