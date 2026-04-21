export interface WeatherResult {
  description: string
  temperature: number
}

// WMO weather code → Czech description
const WMO: Record<number, string> = {
  0: 'Jasno', 1: 'Převážně jasno', 2: 'Polojasno', 3: 'Zataženo',
  45: 'Mlha', 48: 'Námraza',
  51: 'Slabé mrholení', 53: 'Mrholení', 55: 'Husté mrholení',
  61: 'Slabý déšť', 63: 'Déšť', 65: 'Silný déšť',
  71: 'Slabé sněžení', 73: 'Sněžení', 75: 'Silné sněžení',
  80: 'Přeháňky', 81: 'Déšť', 82: 'Silné přeháňky',
  95: 'Bouřka', 96: 'Bouřka s kroupami', 99: 'Silná bouřka',
}

export async function fetchWeather(
  lat: number,
  lon: number,
  date: string,
  fetchFn: typeof fetch = fetch,
): Promise<WeatherResult> {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&daily=weathercode,temperature_2m_max,temperature_2m_min` +
    `&timezone=Europe%2FPrague&start_date=${date}&end_date=${date}`

  const res = await fetchFn(url)
  if (!res.ok) throw new Error(`Weather API error ${res.status}`)

  const data = await res.json() as {
    daily: {
      weathercode: number[]
      temperature_2m_max: number[]
      temperature_2m_min: number[]
    }
  }

  const code = data.daily.weathercode[0] ?? 0
  const max = data.daily.temperature_2m_max[0] ?? 0
  const min = data.daily.temperature_2m_min[0] ?? 0
  const temperature = Math.round((max + min) / 2)
  const description = WMO[code] ?? 'Proměnlivě'

  return { description, temperature }
}
