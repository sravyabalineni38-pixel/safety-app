export async function getCurrentLocation() {
  return new Promise((resolve) => {
    let resolved = false;

    const finish = (lat, lng, source, error = null) => {
      if (resolved) return;
      resolved = true;
      resolve({
        lat: Number(lat).toFixed(6),
        lng: Number(lng).toFixed(6),
        source, // 'gps', 'ip', or 'fallback'
        error,
      });
    };

    // 1. Check browser geolocation support
    if (!navigator.geolocation) {
      tryIpLocation(finish, "Browser geolocation not supported");
      return;
    }

    // 2. Try HTML5 Geolocation API with high accuracy
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        finish(pos.coords.latitude, pos.coords.longitude, "gps");
      },
      (err) => {
        console.warn("Geolocation failed or denied, trying IP fallback:", err);
        const errMsg = getGeoErrorMessage(err);
        tryIpLocation(finish, errMsg);
      },
      {
        enableHighAccuracy: true,
        timeout: 7000,
        maximumAge: 10000,
      }
    );
  });
}

async function tryIpLocation(finish, initialError) {
  try {
    const res = await fetch("https://freeipapi.com/api/json");
    if (!res.ok) throw new Error("FreeIPAPI response not ok");
    const data = await res.json();
    if (data && data.latitude && data.longitude) {
      return finish(data.latitude, data.longitude, "ip", initialError);
    }
  } catch (e1) {
    try {
      const res2 = await fetch("https://ipapi.co/json/");
      if (!res2.ok) throw new Error("ipapi.co response not ok");
      const data2 = await res2.json();
      if (data2 && data2.latitude && data2.longitude) {
        return finish(data2.latitude, data2.longitude, "ip", initialError);
      }
    } catch (e2) {
      console.error("IP location fallback failed:", e2);
    }
  }

  // Ultimate fallback if both GPS and IP fail (e.g. offline or blocked)
  // Default coordinates: Vijayawada/Ongole/Hyderabad region (15.479339, 80.019902)
  finish(15.479339, 80.019902, "fallback", initialError || "Could not retrieve live location");
}

function getGeoErrorMessage(err) {
  if (!err) return null;
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return "Location permission was denied. Used estimated network location.";
    case err.POSITION_UNAVAILABLE:
      return "Location unavailable. Used estimated network location.";
    case err.TIMEOUT:
      return "Location request timed out. Used estimated network location.";
    default:
      return "Location request failed. Used estimated location.";
  }
}
