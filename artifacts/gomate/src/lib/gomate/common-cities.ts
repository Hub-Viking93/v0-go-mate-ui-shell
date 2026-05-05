// Top cities per country — used as suggestion chips beneath the city
// input on the onboarding wizard. The list is intentionally small
// (~10–15 per country, biased toward population + expat presence).
// Users can always free-type a city not in this list; the chips are
// just shortcuts for the common case.

export const COMMON_CITIES_BY_COUNTRY: Record<string, string[]> = {
  // Europe
  germany: ["Berlin", "Munich", "Hamburg", "Frankfurt", "Cologne", "Stuttgart", "Düsseldorf", "Leipzig"],
  france: ["Paris", "Lyon", "Marseille", "Toulouse", "Nice", "Nantes", "Bordeaux", "Strasbourg"],
  spain: ["Madrid", "Barcelona", "Valencia", "Seville", "Malaga", "Bilbao", "Granada", "Palma"],
  italy: ["Rome", "Milan", "Florence", "Naples", "Turin", "Bologna", "Venice", "Verona"],
  netherlands: ["Amsterdam", "Rotterdam", "The Hague", "Utrecht", "Eindhoven", "Groningen", "Tilburg"],
  belgium: ["Brussels", "Antwerp", "Ghent", "Leuven", "Bruges", "Liège"],
  austria: ["Vienna", "Salzburg", "Graz", "Innsbruck", "Linz"],
  switzerland: ["Zurich", "Geneva", "Basel", "Bern", "Lausanne", "Lucerne", "Zug"],
  sweden: ["Stockholm", "Gothenburg", "Malmö", "Uppsala", "Lund", "Linköping", "Umeå"],
  norway: ["Oslo", "Bergen", "Trondheim", "Stavanger", "Tromsø"],
  denmark: ["Copenhagen", "Aarhus", "Odense", "Aalborg"],
  finland: ["Helsinki", "Espoo", "Tampere", "Turku", "Oulu"],
  ireland: ["Dublin", "Cork", "Galway", "Limerick"],
  portugal: ["Lisbon", "Porto", "Faro", "Coimbra", "Funchal", "Braga"],
  greece: ["Athens", "Thessaloniki", "Heraklion", "Patras"],
  poland: ["Warsaw", "Krakow", "Wroclaw", "Gdansk", "Poznan", "Lodz"],
  "czech republic": ["Prague", "Brno", "Ostrava"],
  czechia: ["Prague", "Brno", "Ostrava"],
  hungary: ["Budapest", "Debrecen", "Szeged"],
  romania: ["Bucharest", "Cluj-Napoca", "Timișoara", "Iași"],
  bulgaria: ["Sofia", "Plovdiv", "Varna"],
  croatia: ["Zagreb", "Split", "Dubrovnik", "Rijeka"],
  estonia: ["Tallinn", "Tartu"],
  latvia: ["Riga"],
  lithuania: ["Vilnius", "Kaunas"],
  luxembourg: ["Luxembourg City"],
  malta: ["Valletta", "Sliema", "St Julian's"],
  cyprus: ["Nicosia", "Limassol", "Larnaca", "Paphos"],
  iceland: ["Reykjavik"],
  "united kingdom": ["London", "Manchester", "Edinburgh", "Birmingham", "Bristol", "Glasgow", "Cambridge", "Oxford"],
  uk: ["London", "Manchester", "Edinburgh", "Birmingham", "Bristol", "Glasgow", "Cambridge", "Oxford"],

  // Americas
  "united states": ["New York", "San Francisco", "Los Angeles", "Chicago", "Boston", "Seattle", "Austin", "Miami", "Washington DC", "Denver"],
  usa: ["New York", "San Francisco", "Los Angeles", "Chicago", "Boston", "Seattle", "Austin", "Miami", "Washington DC", "Denver"],
  canada: ["Toronto", "Vancouver", "Montreal", "Calgary", "Ottawa", "Edmonton", "Quebec City"],
  mexico: ["Mexico City", "Guadalajara", "Monterrey", "Playa del Carmen", "Mérida", "Puebla"],
  brazil: ["São Paulo", "Rio de Janeiro", "Brasília", "Florianópolis", "Curitiba", "Porto Alegre"],
  argentina: ["Buenos Aires", "Córdoba", "Rosario", "Mendoza"],
  chile: ["Santiago", "Valparaíso", "Concepción"],
  colombia: ["Bogotá", "Medellín", "Cartagena", "Cali"],
  peru: ["Lima", "Cusco", "Arequipa"],
  "costa rica": ["San José", "Tamarindo", "Liberia"],
  panama: ["Panama City"],

  // Asia / Oceania
  japan: ["Tokyo", "Osaka", "Kyoto", "Yokohama", "Fukuoka", "Sapporo", "Nagoya"],
  "south korea": ["Seoul", "Busan", "Incheon", "Daegu"],
  korea: ["Seoul", "Busan", "Incheon", "Daegu"],
  china: ["Shanghai", "Beijing", "Shenzhen", "Guangzhou", "Chengdu", "Hangzhou"],
  taiwan: ["Taipei", "Kaohsiung", "Taichung"],
  "hong kong": ["Hong Kong"],
  singapore: ["Singapore"],
  thailand: ["Bangkok", "Chiang Mai", "Phuket", "Pattaya"],
  vietnam: ["Ho Chi Minh City", "Hanoi", "Da Nang"],
  indonesia: ["Jakarta", "Bali", "Yogyakarta", "Surabaya"],
  malaysia: ["Kuala Lumpur", "Penang", "Johor Bahru"],
  philippines: ["Manila", "Cebu", "Davao"],
  india: ["Mumbai", "Bangalore", "Delhi", "Hyderabad", "Chennai", "Pune", "Goa"],
  australia: ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide", "Canberra", "Gold Coast"],
  "new zealand": ["Auckland", "Wellington", "Christchurch", "Queenstown"],

  // Middle East / Africa
  "united arab emirates": ["Dubai", "Abu Dhabi", "Sharjah"],
  uae: ["Dubai", "Abu Dhabi", "Sharjah"],
  "saudi arabia": ["Riyadh", "Jeddah", "Dammam"],
  qatar: ["Doha"],
  israel: ["Tel Aviv", "Jerusalem", "Haifa"],
  turkey: ["Istanbul", "Ankara", "Izmir", "Antalya"],
  egypt: ["Cairo", "Alexandria"],
  morocco: ["Casablanca", "Marrakech", "Rabat", "Tangier"],
  "south africa": ["Cape Town", "Johannesburg", "Durban"],
  kenya: ["Nairobi", "Mombasa"],
  nigeria: ["Lagos", "Abuja"],
}

const normalize = (country: string) => country.trim().toLowerCase()

export function getCommonCities(country: string | null | undefined): string[] {
  if (!country) return []
  return COMMON_CITIES_BY_COUNTRY[normalize(country)] ?? []
}
