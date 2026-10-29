import { useEffect, useRef } from "react";
import L from "leaflet";

const CATEGORY_ICONS = {
  "Poor lighting": "💡",
  "Harassment reported": "⚠️",
  "Isolated / empty area": "🏚️",
  "No CCTV": "📹",
  "Stray animals": "🐕",
  Other: "▲"
};

const SEVERITY_COLORS = {
  high: { bg: "#EF4444", text: "High Risk", border: "#F87171" },
  medium: { bg: "#F59E0B", text: "Medium Risk", border: "#FBBF24" },
  low: { bg: "#10B981", text: "Low Risk", border: "#34D399" }
};

export default function UnsafeAreasMap({
  userLocation,
  reports = [],
  riskAssessment = null,
  routeWaypoints = [],
  onLocationSelect
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const defaultLat = userLocation?.lat ? Number(userLocation.lat) : 15.4793;
    const defaultLng = userLocation?.lng ? Number(userLocation.lng) : 80.0199;

    const map = L.map(mapContainerRef.current, {
      center: [defaultLat, defaultLng],
      zoom: 15,
      zoomControl: true
    });
    mapInstanceRef.current = map;

    // Standard OpenStreetMap tiles - 100% Free, No API Key needed, No Watermark!
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(map);

    // Click handler on map to pick location
    if (onLocationSelect) {
      map.on("click", (e) => {
        onLocationSelect(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6)));
      });
    }

    const boundsPoints = [];

    // User Location & Area Risk Zone
    if (userLocation?.lat && userLocation?.lng) {
      const uLat = Number(userLocation.lat);
      const uLng = Number(userLocation.lng);
      boundsPoints.push([uLat, uLng]);

      const isHigh = riskAssessment?.level === "high" || (riskAssessment?.score || 0) >= 50;
      const isMed = riskAssessment?.level === "medium" || ((riskAssessment?.score || 0) >= 25 && (riskAssessment?.score || 0) < 50);

      const zoneColor = isHigh ? "#EF4444" : isMed ? "#F59E0B" : "#10B981";
      const zoneLabel = isHigh ? "High Danger Area" : isMed ? "Moderate Caution Area" : "Safe Zone";
      const zoneRadius = isHigh ? 800 : isMed ? 600 : 400; // in meters

      // Shaded Area Risk Zone Circle on the map
      const riskCircle = L.circle([uLat, uLng], {
        radius: zoneRadius,
        color: zoneColor,
        weight: 2,
        dashArray: isHigh ? "6, 6" : undefined,
        fillColor: zoneColor,
        fillOpacity: isHigh ? 0.22 : isMed ? 0.16 : 0.12
      }).addTo(map);

      riskCircle.bindPopup(`
        <div style="font-family: inherit; font-size: 12px; color: #0f172a; min-width: 170px;">
          <div style="font-weight: 700; color: ${zoneColor}; font-size: 13px; margin-bottom: 2px;">
            ${isHigh ? "🚨" : isMed ? "⚠️" : "🟢"} ${zoneLabel}
          </div>
          <div><strong>Area Risk Score:</strong> ${riskAssessment?.score != null ? `${riskAssessment.score}/100` : "Assessing..."}</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
            ${isHigh ? "Warning: High hazard density reported in this area zone." : isMed ? "Caution: Moderate risks present. Stay on main lighted streets." : "Safe: No major hazards nearby."}
          </div>
        </div>
      `);

      const userIcon = L.divIcon({
        className: "user-loc-marker",
        html: `
          <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; width: 32px; height: 32px; border-radius: 50%; background: rgba(124, 92, 252, 0.35); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="position: relative; width: 22px; height: 22px; border-radius: 50%; background: #7C5CFC; border: 3px solid #ffffff; box-shadow: 0 4px 12px rgba(124, 92, 252, 0.6); display: flex; align-items: center; justify-content: center; color: white; font-size: 11px;">
              📍
            </div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });

      const userMarker = L.marker([uLat, uLng], { icon: userIcon }).addTo(map);
      userMarker.bindPopup(`
        <div style="font-family: inherit; font-size: 12px; color: #1e293b; min-width: 140px;">
          <div style="font-weight: 700; color: #7C5CFC; margin-bottom: 2px;">📍 Current / Entered Point</div>
          <div>${userLocation.placeName || `${uLat.toFixed(4)}, ${uLng.toFixed(4)}`}</div>
          <div style="font-size: 11px; color: ${zoneColor}; font-weight: 600; margin-top: 2px;">Status: ${zoneLabel}</div>
        </div>
      `);
    }

    // Reports Markers & Danger Radius Bubbles
    reports.forEach((r) => {
      const rLat = Number(r.lat);
      const rLng = Number(r.lng);
      if (isNaN(rLat) || isNaN(rLng)) return;
      boundsPoints.push([rLat, rLng]);

      const sev = SEVERITY_COLORS[r.severity] || SEVERITY_COLORS.medium;
      const catIcon = CATEGORY_ICONS[r.category] || "▲";

      // Danger zone bubble around the reported spot
      L.circle([rLat, rLng], {
        radius: r.severity === "high" ? 280 : r.severity === "medium" ? 200 : 120,
        color: sev.bg,
        weight: 1.5,
        fillColor: sev.bg,
        fillOpacity: 0.22
      }).addTo(map);

      const reportIcon = L.divIcon({
        className: "report-marker",
        html: `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
            <div style="background-color: ${sev.bg}; color: white; padding: 4px 8px; border-radius: 12px; font-weight: 700; font-size: 11px; border: 2px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.35); display: flex; align-items: center; gap: 4px; white-space: nowrap;">
              <span>${catIcon}</span>
              <span>${r.category}</span>
            </div>
            <div style="width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 6px solid ${sev.bg};"></div>
          </div>
        `,
        iconSize: [110, 32],
        iconAnchor: [55, 30]
      });

      const marker = L.marker([rLat, rLng], { icon: reportIcon }).addTo(map);

      const distanceDisplay =
        r.distanceMeters != null
          ? r.distanceMeters < 1000
            ? `⚡ ${r.distanceMeters}m away`
            : `📍 ${r.distanceKm} km away`
          : "";

      marker.bindPopup(`
        <div style="font-family: inherit; font-size: 12px; color: #0f172a; min-width: 170px;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 4px;">
            <strong style="color: ${sev.bg}; font-size: 13px;">${catIcon} ${r.category}</strong>
            <span style="background: ${sev.bg}22; color: ${sev.bg}; padding: 2px 6px; border-radius: 6px; font-size: 10px; font-weight: 600;">${sev.text}</span>
          </div>
          ${distanceDisplay ? `<div style="font-weight: 600; color: #dc2626; margin-bottom: 4px; font-size: 11px;">${distanceDisplay}</div>` : ""}
          ${r.description ? `<p style="margin: 4px 0; color: #475569; font-size: 11px;">"${r.description}"</p>` : ""}
          <div style="font-size: 10px; color: #94a3b8; margin-top: 4px;">
            Coords: ${rLat.toFixed(4)}, ${rLng.toFixed(4)}<br/>
            👍 ${r.upvotes || 0} upvotes
          </div>
        </div>
      `);
    });

    // Optional Route Polyline
    if (routeWaypoints && routeWaypoints.length > 0) {
      const coords = routeWaypoints.map((w) => [w.lat, w.lng]);
      coords.forEach((c) => boundsPoints.push(c));
      L.polyline(coords, {
        color: "#10B981",
        weight: 5,
        opacity: 0.9,
        lineCap: "round"
      }).addTo(map);
    }

    // Fit map bounds if there are points
    if (boundsPoints.length > 1) {
      map.fitBounds(L.latLngBounds(boundsPoints), { padding: [40, 40], maxZoom: 16 });
    } else if (boundsPoints.length === 1) {
      map.setView(boundsPoints[0], 15);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [userLocation, reports, riskAssessment, routeWaypoints, onLocationSelect]);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-white/10 shadow-xl bg-night-950" style={{ height: "400px" }}>
      <div ref={mapContainerRef} className="w-full h-full z-0" />
      
      {/* Top Left Instruction */}
      <div className="absolute top-3 left-3 z-[1000] bg-night-950/85 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-lg text-xs text-slate-300 pointer-events-none flex items-center gap-1.5 shadow-md">
        <span>🗺️</span>
        <span>Tap anywhere on the map to set location</span>
      </div>

      {/* Top Right Live Risk Status Overlay on Map */}
      {riskAssessment && (
        <div className="absolute top-3 right-3 z-[1000] bg-night-950/90 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-xl text-xs flex items-center gap-2 shadow-lg">
          <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${
            riskAssessment.level === "high" ? "bg-rose-500 ring-2 ring-rose-400/40" : riskAssessment.level === "medium" ? "bg-amber-500 ring-2 ring-amber-400/40" : "bg-emerald-500 ring-2 ring-emerald-400/40"
          }`}></span>
          <span className="font-semibold text-slate-100">
            {riskAssessment.level === "high" ? "🚨 High Risk Area" : riskAssessment.level === "medium" ? "⚠️ Moderate Caution" : "🟢 Safe Area"}
          </span>
          <span className="text-[11px] font-mono text-slate-400">({riskAssessment.score}/100)</span>
        </div>
      )}

      {/* Bottom Legend */}
      <div className="absolute bottom-3 left-3 z-[1000] bg-night-950/90 backdrop-blur-md border border-white/10 px-3 py-2 rounded-xl text-xs flex gap-3 text-slate-200 shadow-md flex-wrap items-center">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-violet-500 ring-2 ring-violet-300"></span> You</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> High Risk Zone</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Moderate Zone</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Safe Zone</span>
        {routeWaypoints?.length > 0 && (
          <span className="flex items-center gap-1.5"><span className="w-4 h-1 bg-emerald-500 rounded"></span> Safe Route</span>
        )}
      </div>
    </div>
  );
}
