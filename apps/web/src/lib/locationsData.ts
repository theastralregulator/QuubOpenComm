export interface CountryOption {
  id: string; // country_code (e.g. "US")
  name: string; // human readable (e.g. "United States")
  states: StateOption[];
}

export interface StateOption {
  id: string; // state_code (e.g. "TX")
  name: string;
  districts: DistrictOption[];
}

export interface DistrictOption {
  id: string;
  name: string;
  cities: CityOption[];
}

export interface CityOption {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export const COUNTRIES_DATA: CountryOption[] = [
  {
    id: "US",
    name: "United States",
    states: [
      {
        id: "TX",
        name: "Texas",
        districts: [
          {
            id: "travis",
            name: "Travis County",
            cities: [
              { id: "austin", name: "Austin", lat: 30.2672, lng: -97.7431 },
              { id: "westlake", name: "West Lake Hills", lat: 30.2913, lng: -97.8114 },
              { id: "manor", name: "Manor", lat: 30.3408, lng: -97.5567 }
            ]
          },
          {
            id: "harris",
            name: "Harris County",
            cities: [
              { id: "houston", name: "Houston", lat: 29.7604, lng: -95.3698 },
              { id: "pasadena", name: "Pasadena", lat: 29.6911, lng: -95.2091 },
              { id: "baytown", name: "Baytown", lat: 29.7355, lng: -94.9774 }
            ]
          },
          {
            id: "dallas",
            name: "Dallas County",
            cities: [
              { id: "dallas", name: "Dallas", lat: 32.7767, lng: -96.7970 },
              { id: "irving", name: "Irving", lat: 32.8140, lng: -96.9489 },
              { id: "garland", name: "Garland", lat: 32.9126, lng: -96.6389 }
            ]
          }
        ]
      },
      {
        id: "CA",
        name: "California",
        districts: [
          {
            id: "los_angeles",
            name: "Los Angeles County",
            cities: [
              { id: "los_angeles", name: "Los Angeles", lat: 34.0522, lng: -118.2437 },
              { id: "santa_monica", name: "Santa Monica", lat: 34.0194, lng: -118.4912 },
              { id: "long_beach", name: "Long Beach", lat: 33.7701, lng: -118.1937 }
            ]
          },
          {
            id: "san_francisco",
            name: "San Francisco County",
            cities: [
              { id: "san_francisco", name: "San Francisco", lat: 37.7749, lng: -122.4194 }
            ]
          },
          {
            id: "santa_clara",
            name: "Santa Clara County",
            cities: [
              { id: "san_jose", name: "San Jose", lat: 37.3382, lng: -121.8863 },
              { id: "sunnyvale", name: "Sunnyvale", lat: 37.3688, lng: -122.0363 },
              { id: "mountain_view", name: "Mountain View", lat: 37.3861, lng: -122.0839 }
            ]
          }
        ]
      },
      {
        id: "NY",
        name: "New York",
        districts: [
          {
            id: "new_york_co",
            name: "New York County",
            cities: [
              { id: "manhattan", name: "Manhattan (NYC)", lat: 40.7831, lng: -73.9712 }
            ]
          },
          {
            id: "kings_co",
            name: "Kings County",
            cities: [
              { id: "brooklyn", name: "Brooklyn (NYC)", lat: 40.6782, lng: -73.9442 }
            ]
          },
          {
            id: "queens_co",
            name: "Queens County",
            cities: [
              { id: "queens", name: "Queens (NYC)", lat: 40.7282, lng: -73.7949 }
            ]
          }
        ]
      }
    ]
  },
  {
    id: "IN",
    name: "India",
    states: [
      {
        id: "KA",
        name: "Karnataka",
        districts: [
          {
            id: "bengaluru_urban",
            name: "Bengaluru Urban",
            cities: [
              { id: "bengaluru", name: "Bengaluru", lat: 12.9716, lng: 77.5946 },
              { id: "whitefield", name: "Whitefield", lat: 12.9698, lng: 77.7500 },
              { id: "electronic_city", name: "Electronic City", lat: 12.8391, lng: 77.6778 }
            ]
          },
          {
            id: "mysuru",
            name: "Mysuru",
            cities: [
              { id: "mysuru_city", name: "Mysuru", lat: 12.2958, lng: 76.6394 },
              { id: "nanjangud", name: "Nanjangud", lat: 12.1190, lng: 76.6801 }
            ]
          }
        ]
      },
      {
        id: "MH",
        name: "Maharashtra",
        districts: [
          {
            id: "mumbai_suburban",
            name: "Mumbai Suburban",
            cities: [
              { id: "mumbai", name: "Mumbai", lat: 19.0760, lng: 72.8777 },
              { id: "bandra", name: "Bandra", lat: 19.0596, lng: 72.8295 }
            ]
          },
          {
            id: "pune",
            name: "Pune",
            cities: [
              { id: "pune_city", name: "Pune", lat: 18.5204, lng: 73.8567 },
              { id: "pimpri", name: "Pimpri-Chinchwad", lat: 18.6298, lng: 73.7997 }
            ]
          }
        ]
      }
    ]
  },
  {
    id: "CA_CN",
    name: "Canada",
    states: [
      {
        id: "ON",
        name: "Ontario",
        districts: [
          {
            id: "toronto_div",
            name: "Toronto Division",
            cities: [
              { id: "toronto", name: "Toronto", lat: 43.6532, lng: -79.3832 },
              { id: "scarborough", name: "Scarborough", lat: 43.7764, lng: -79.2318 }
            ]
          },
          {
            id: "ottawa_div",
            name: "Ottawa",
            cities: [
              { id: "ottawa", name: "Ottawa", lat: 45.4215, lng: -75.6972 }
            ]
          }
        ]
      },
      {
        id: "BC",
        name: "British Columbia",
        districts: [
          {
            id: "greater_vancouver",
            name: "Greater Vancouver",
            cities: [
              { id: "vancouver", name: "Vancouver", lat: 49.2827, lng: -123.1207 },
              { id: "burnaby", name: "Burnaby", lat: 49.2488, lng: -122.9805 },
              { id: "richmond", name: "Richmond", lat: 49.1666, lng: -123.1336 }
            ]
          }
        ]
      }
    ]
  },
  {
    id: "GB",
    name: "United Kingdom",
    states: [
      {
        id: "ENG",
        name: "England",
        districts: [
          {
            id: "greater_london",
            name: "Greater London",
            cities: [
              { id: "london", name: "London", lat: 51.5074, lng: -0.1278 },
              { id: "westminster", name: "Westminster", lat: 51.4975, lng: -0.1357 }
            ]
          },
          {
            id: "greater_manchester",
            name: "Greater Manchester",
            cities: [
              { id: "manchester", name: "Manchester", lat: 53.4808, lng: -2.2426 },
              { id: "salford", name: "Salford", lat: 53.4875, lng: -2.2901 }
            ]
          }
        ]
      }
    ]
  }
];
