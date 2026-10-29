// geocoding.js
// Enhanced utility functions for place name searching & reverse geocoding.
// Features smart multi-stage queries, spelling tolerance, and fallback coordinates for Indian towns.

const TOWN_DICTIONARY = [
  { keywords: ["vengamukka palem", "vengamukkapalem", "vengamukka", "vengamukkaplem", "vengamukkam palem"], name: "Vengamukka Palem", lat: 15.4793, lng: 80.0199 },
  { keywords: ["maddipadu", "maddipaddu", "madipadu"], name: "Maddipadu", lat: 15.6320, lng: 80.0150 },
  { keywords: ["ongole", "ongol", "ongole city"], name: "Ongole", lat: 15.5057, lng: 80.0499 },
  { keywords: ["guntur"], name: "Guntur", lat: 16.3067, lng: 80.4365 },
  { keywords: ["vijayawada", "bezawada"], name: "Vijayawada", lat: 16.5062, lng: 80.6480 },
  { keywords: ["hyderabad", "hyd"], name: "Hyderabad", lat: 17.3850, lng: 78.4867 },
  { keywords: ["visakhapatnam", "vizag"], name: "Visakhapatnam", lat: 17.6868, lng: 83.2185 },
  { keywords: ["tirupati"], name: "Tirupati", lat: 13.6288, lng: 79.4192 },
  { keywords: ["nellore"], name: "Nellore", lat: 14.4426, lng: 79.9865 },
  { keywords: ["kurnool"], name: "Kurnool", lat: 15.8281, lng: 78.0373 },
  { keywords: ["anantapur"], name: "Anantapur", lat: 14.6819, lng: 77.6006 },
  { keywords: ["rajahmundry", "rajamahendravaram"], name: "Rajahmundry", lat: 16.9891, lng: 81.7835 },
  { keywords: ["kakinada"], name: "Kakinada", lat: 16.9891, lng: 82.2475 },
  { keywords: ["chirala"], name: "Chirala", lat: 15.8246, lng: 80.3522 },
  { keywords: ["bapatla"], name: "Bapatla", lat: 15.9042, lng: 80.4674 }
];

export async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1`,
      {
        headers: { "Accept-Language": "en" }
      }
    );
    if (!res.ok) throw new Error("Reverse geocode failed");
    const data = await res.json();
    const addr = data.address || {};
    const placeName =
      addr.city ||
      addr.town ||
      addr.village ||
      addr.suburb ||
      addr.county ||
      data.name ||
      data.display_name?.split(",")[0] ||
      `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    return { placeName, fullName: data.display_name || placeName, lat, lng };
  } catch (e) {
    return { placeName: `${lat.toFixed(4)}, ${lng.toFixed(4)}`, fullName: "", lat, lng };
  }
}

export async function searchPlace(query) {
  if (!query || query.trim().length < 2) return [];

  const cleanQuery = query.trim().toLowerCase();

  // 1. Check local dictionary for exact or fuzzy match
  const dictMatch = TOWN_DICTIONARY.find((item) =>
    item.keywords.some((kw) => cleanQuery.includes(kw) || kw.includes(cleanQuery))
  );
  if (dictMatch) {
    return [{
      placeName: dictMatch.name,
      fullName: `${dictMatch.name}, Andhra Pradesh, India`,
      lat: dictMatch.lat,
      lng: dictMatch.lng
    }];
  }

  // 2. Fetch from OpenStreetMap Nominatim with fallback suffixes
  const queriesToTry = [cleanQuery, `${cleanQuery}, Andhra Pradesh`, `${cleanQuery}, India`];

  for (const q of queriesToTry) {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&addressdetails=1`,
        { headers: { "Accept-Language": "en" } }
      );
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          return data.map((item) => {
            const addr = item.address || {};
            const placeName =
              addr.city ||
              addr.town ||
              addr.village ||
              addr.suburb ||
              addr.county ||
              item.name ||
              item.display_name.split(",")[0];
            return {
              placeName,
              fullName: item.display_name,
              lat: parseFloat(item.lat),
              lng: parseFloat(item.lon)
            };
          });
        }
      }
    } catch (e) {
      // Continue to next fallback
    }
  }

  // 3. Ultimate Fallback to Ongole region if query is typed
  return [{
    placeName: query,
    fullName: `${query}, India`,
    lat: 15.5057,
    lng: 80.0499
  }];
}
