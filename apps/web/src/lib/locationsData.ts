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
      { id: "TG", name: "Telangana", districts: [] },
      { id: "AP", name: "Andhra Pradesh", districts: [] },
      { id: "PB", name: "Punjab", districts: [] },
      { id: "HR", name: "Haryana", districts: [] },
      { id: "BR", name: "Bihar", districts: [] },
      { id: "MP", name: "Madhya Pradesh", districts: [] },
      { id: "OD", name: "Odisha", districts: [] },
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
      { id: "AL", name: "Alabama", districts: [] },
      { id: "AK", name: "Alaska", districts: [] },
      { id: "AZ", name: "Arizona", districts: [] },
      { id: "AR", name: "Arkansas", districts: [] },
      { id: "CA", name: "California", districts: [] },
      { id: "CO", name: "Colorado", districts: [] },
      { id: "CT", name: "Connecticut", districts: [] },
      { id: "DE", name: "Delaware", districts: [] },
      { id: "DC", name: "District of Columbia", districts: [] },
      { id: "FL", name: "Florida", districts: [] },
      { id: "GA", name: "Georgia", districts: [] },
      { id: "HI", name: "Hawaii", districts: [] },
      { id: "ID", name: "Idaho", districts: [] },
      { id: "IL", name: "Illinois", districts: [] },
      { id: "IN", name: "Indiana", districts: [] },
      { id: "IA", name: "Iowa", districts: [] },
      { id: "KS", name: "Kansas", districts: [] },
      { id: "KY", name: "Kentucky", districts: [] },
      { id: "LA", name: "Louisiana", districts: [] },
      { id: "ME", name: "Maine", districts: [] },
      { id: "MD", name: "Maryland", districts: [] },
      { id: "MA", name: "Massachusetts", districts: [] },
      { id: "MI", name: "Michigan", districts: [] },
      { id: "MN", name: "Minnesota", districts: [] },
      { id: "MS", name: "Mississippi", districts: [] },
      { id: "MO", name: "Missouri", districts: [] },
      { id: "MT", name: "Montana", districts: [] },
      { id: "NE", name: "Nebraska", districts: [] },
      { id: "NV", name: "Nevada", districts: [] },
      { id: "NH", name: "New Hampshire", districts: [] },
      { id: "NJ", name: "New Jersey", districts: [] },
      { id: "NM", name: "New Mexico", districts: [] },
      { id: "NY", name: "New York", districts: [] },
      { id: "NC", name: "North Carolina", districts: [] },
      { id: "ND", name: "North Dakota", districts: [] },
      { id: "OH", name: "Ohio", districts: [] },
      { id: "OK", name: "Oklahoma", districts: [] },
      { id: "OR", name: "Oregon", districts: [] },
      { id: "PA", name: "Pennsylvania", districts: [] },
      { id: "RI", name: "Rhode Island", districts: [] },
      { id: "SC", name: "South Carolina", districts: [] },
      { id: "SD", name: "South Dakota", districts: [] },
      { id: "TN", name: "Tennessee", districts: [] },
      { id: "TX", name: "Texas", districts: [] },
      { id: "UT", name: "Utah", districts: [] },
      { id: "VT", name: "Vermont", districts: [] },
      { id: "VA", name: "Virginia", districts: [] },
      { id: "WA", name: "Washington", districts: [] },
      { id: "WV", name: "West Virginia", districts: [] },
      { id: "WI", name: "Wisconsin", districts: [] },
      { id: "WY", name: "Wyoming", districts: [] }
    ]
  },
  {
    id: "CA",
    name: "Canada",
    states: [
      { id: "AB", name: "Alberta", districts: [] },
      { id: "BC", name: "British Columbia", districts: [] },
      { id: "MB", name: "Manitoba", districts: [] },
      { id: "NB", name: "New Brunswick", districts: [] },
      { id: "NL", name: "Newfoundland and Labrador", districts: [] },
      { id: "NS", name: "Nova Scotia", districts: [] },
      { id: "ON", name: "Ontario", districts: [] },
      { id: "PE", name: "Prince Edward Island", districts: [] },
      { id: "QC", name: "Quebec", districts: [] },
      { id: "SK", name: "Saskatchewan", districts: [] },
      { id: "NT", name: "Northwest Territories", districts: [] },
      { id: "NU", name: "Nunavut", districts: [] },
      { id: "YT", name: "Yukon", districts: [] }
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
      { id: "AUH", name: "Abu Dhabi", districts: [] },
      { id: "AJM", name: "Ajman", districts: [] },
      { id: "DXB", name: "Dubai", districts: [] },
      { id: "FUJ", name: "Fujairah", districts: [] },
      { id: "RAK", name: "Ras Al Khaimah", districts: [] },
      { id: "SHJ", name: "Sharjah", districts: [] },
      { id: "UAQ", name: "Umm Al Quwain", districts: [] }
    ]
  }
];
