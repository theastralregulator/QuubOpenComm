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
    id: "IN",
    name: "India",
    states: [
      { id: "KL", name: "Kerala", districts: [] },
      { id: "KA", name: "Karnataka", districts: [] },
      { id: "TN", name: "Tamil Nadu", districts: [] },
      { id: "MH", name: "Maharashtra", districts: [] },
      { id: "DL", name: "Delhi", districts: [] },
      { id: "UP", name: "Uttar Pradesh", districts: [] },
      { id: "WB", name: "West Bengal", districts: [] },
      { id: "GJ", name: "Gujarat", districts: [] },
      { id: "RJ", name: "Rajasthan", districts: [] },
      { id: "TS", name: "Telangana", districts: [] },
      { id: "AP", name: "Andhra Pradesh", districts: [] },
      { id: "PB", name: "Punjab", districts: [] },
      { id: "HR", name: "Haryana", districts: [] },
      { id: "BR", name: "Bihar", districts: [] },
      { id: "MP", name: "Madhya Pradesh", districts: [] },
      { id: "OR", name: "Odisha", districts: [] },
      { id: "AS", name: "Assam", districts: [] },
      { id: "JH", name: "Jharkhand", districts: [] },
      { id: "CT", name: "Chhattisgarh", districts: [] },
      { id: "UT", name: "Uttarakhand", districts: [] },
      { id: "HP", name: "Himachal Pradesh", districts: [] },
      { id: "GA", name: "Goa", districts: [] },
      { id: "JK", name: "Jammu and Kashmir", districts: [] },
      { id: "LA", name: "Ladakh", districts: [] },
      { id: "TR", name: "Tripura", districts: [] },
      { id: "ML", name: "Meghalaya", districts: [] },
      { id: "MN", name: "Manipur", districts: [] },
      { id: "NL", name: "Nagaland", districts: [] },
      { id: "AR", name: "Arunachal Pradesh", districts: [] },
      { id: "MZ", name: "Mizoram", districts: [] },
      { id: "SK", name: "Sikkim", districts: [] },
      { id: "CH", name: "Chandigarh", districts: [] },
      { id: "PY", name: "Puducherry", districts: [] },
      { id: "AN", name: "Andaman and Nicobar Islands", districts: [] },
      { id: "DH", name: "Dadra and Nagar Haveli and Daman and Diu", districts: [] },
      { id: "LD", name: "Lakshadweep", districts: [] }
    ]
  },
  {
    id: "US",
    name: "United States",
    states: [
      { id: "TX", name: "Texas", districts: [] },
      { id: "CA", name: "California", districts: [] },
      { id: "NY", name: "New York", districts: [] },
      { id: "FL", name: "Florida", districts: [] },
      { id: "IL", name: "Illinois", districts: [] },
      { id: "WA", name: "Washington", districts: [] }
    ]
  },
  {
    id: "CA_CN",
    name: "Canada",
    states: [
      { id: "ON", name: "Ontario", districts: [] },
      { id: "BC", name: "British Columbia", districts: [] },
      { id: "QC", name: "Quebec", districts: [] },
      { id: "AB", name: "Alberta", districts: [] }
    ]
  },
  {
    id: "GB",
    name: "United Kingdom",
    states: [
      { id: "ENG", name: "England", districts: [] },
      { id: "SCT", name: "Scotland", districts: [] },
      { id: "WLS", name: "Wales", districts: [] },
      { id: "NIR", name: "Northern Ireland", districts: [] }
    ]
  },
  {
    id: "AE",
    name: "United Arab Emirates",
    states: [
      { id: "DXB", name: "Dubai", districts: [] },
      { id: "AUH", name: "Abu Dhabi", districts: [] },
      { id: "SHJ", name: "Sharjah", districts: [] }
    ]
  }
];
