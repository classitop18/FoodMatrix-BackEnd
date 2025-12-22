export interface IPlaceAutocomplete {
  description: string;
  placeId: string;
  mainText: string;
  secondaryText: string;
  types: string[];
}

export interface IPlaceDetails {
  placeId: string;
  formattedAddress: string;
  addressComponents: {
    longName: string;
    shortName: string;
    types: string[];
  }[];
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  name?: string;
  types: string[];
}

export interface ICoordinates {
  latitude: number;
  longitude: number;
}

export interface IAddressDetails {
  formattedAddress: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
  coordinates: ICoordinates;
}
