export const TN_STATIONS = [
  // Original 15
  { id: 0,  name: 'Chennai — Nungambakkam', short: 'Chennai',       lat: 13.0604, lng: 80.2496, t: 34, p: 1008, h: 72,  coverage_km: 35 },
  { id: 1,  name: 'Madurai — Meenambakkam', short: 'Madurai',       lat: 9.8327,  lng: 78.0930, t: 33, p: 1005, h: 68,  coverage_km: 30 },
  { id: 2,  name: 'Coimbatore — Peelamedu', short: 'Coimbatore',    lat: 11.0300, lng: 77.0390, t: 29, p: 1010, h: 65,  coverage_km: 32 },
  { id: 3,  name: 'Tiruchirappalli',        short: 'Trichy',        lat: 10.7905, lng: 78.7047, t: 35, p: 1004, h: 70,  coverage_km: 28 },
  { id: 4,  name: 'Salem — Fairlands',      short: 'Salem',         lat: 11.6643, lng: 78.1460, t: 31, p: 1007, h: 62,  coverage_km: 25 },
  { id: 5,  name: 'Tirunelveli',            short: 'Tirunelveli',   lat: 8.7271,  lng: 77.6954, t: 32, p: 1006, h: 75,  coverage_km: 27 },
  { id: 6,  name: 'Vellore — Katpadi',      short: 'Vellore',       lat: 12.9165, lng: 79.1325, t: 30, p: 1009, h: 60,  coverage_km: 24 },
  { id: 7,  name: 'Erode — Surampatti',     short: 'Erode',         lat: 11.3410, lng: 77.7172, t: 30, p: 1008, h: 63,  coverage_km: 26 },
  { id: 8,  name: 'Thoothukudi — Harbour',  short: 'Thoothukudi',   lat: 8.7642,  lng: 78.1348, t: 33, p: 1007, h: 80,  coverage_km: 22 },
  { id: 9,  name: 'Dindigul — Sirumalai',   short: 'Dindigul',      lat: 10.3624, lng: 77.9695, t: 28, p: 1012, h: 67,  coverage_km: 23 },
  { id: 10, name: 'Kancheepuram',           short: 'Kancheepuram',  lat: 12.8352, lng: 79.7100, t: 33, p: 1008, h: 71,  coverage_km: 22 },
  { id: 11, name: 'Thanjavur',              short: 'Thanjavur',     lat: 10.7870, lng: 79.1378, t: 34, p: 1005, h: 74,  coverage_km: 26 },
  { id: 12, name: 'Nagapattinam — Coast',   short: 'Nagapattinam',  lat: 10.7672, lng: 79.8449, t: 32, p: 1007, h: 82,  coverage_km: 20 },
  { id: 13, name: 'Ooty — Nilgiris',        short: 'Ooty',          lat: 11.4102, lng: 76.6950, t: 16, p: 1015, h: 78,  coverage_km: 18 },
  { id: 14, name: 'Rameshwaram — Island',   short: 'Rameshwaram',   lat: 9.2876,  lng: 79.3129, t: 31, p: 1008, h: 83,  coverage_km: 20 },
  // 5 additional stations
  { id: 15, name: 'Cuddalore — Coastal',    short: 'Cuddalore',     lat: 11.7480, lng: 79.7680, t: 32, p: 1007, h: 80,  coverage_km: 22 },
  { id: 16, name: 'Puducherry — Raj Nivas', short: 'Puducherry',    lat: 11.9340, lng: 79.8300, t: 33, p: 1007, h: 78,  coverage_km: 18 },
  { id: 17, name: 'Hosur — Denkanikottai',  short: 'Hosur',         lat: 12.7409, lng: 77.8253, t: 27, p: 1011, h: 60,  coverage_km: 20 },
  { id: 18, name: 'Karur — Pappireddipatti',short: 'Karur',         lat: 10.9601, lng: 78.0766, t: 32, p: 1006, h: 65,  coverage_km: 22 },
  { id: 19, name: 'Virudhunagar',           short: 'Virudhunagar',  lat: 9.5850,  lng: 77.9624, t: 33, p: 1005, h: 68,  coverage_km: 20 },
];

export async function fetchLiveWeatherForStations(stations = TN_STATIONS) {
  try {
    const lats = stations.map(s => s.lat).join(',');
    const lngs = stations.map(s => s.lng).join(',');
    const url  = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}` +
                 `&current=temperature_2m,surface_pressure,relative_humidity_2m,wind_speed_10m,weather_code` +
                 `&wind_speed_unit=kmh&timezone=Asia%2FKolkata&forecast_days=1`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const results = Array.isArray(json) ? json : [json];
    
    const weatherMap = {};
    results.forEach((data, i) => {
      const c = data.current;
      if (c && stations[i]) {
        weatherMap[stations[i].id] = {
          t: Math.round(c.temperature_2m * 10) / 10,
          p: Math.round((c.surface_pressure ?? 1010) * 10) / 10,
          h: Math.round(c.relative_humidity_2m),
          wind: c.wind_speed_10m,
          code: c.weather_code,
          live: true
        };
      }
    });
    return weatherMap;
  } catch (err) {
    console.warn('Weather fetch fallback to simulated values:', err);
    return null;
  }
}
