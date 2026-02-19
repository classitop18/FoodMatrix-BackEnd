import { ICoordinates } from "./types/gp.types.js";
import axios from "axios";

export interface NearbySearchResult {
  id: string;
  name: string;
  formattedAddress: string;
  rating?: number;
  userRatingCount?: number;
  isOpen?: boolean;
  openingHours?: string[];
  photoUrl?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  latitude?: number;
  longitude?: number;
}

export interface IPlacesRepository {
  autocomplete(
    input: string,
    types: string,
  ): Promise<PlaceAutocompleteResult[]>;
  getPlaceDetails(placeId: string): Promise<PlaceDetails>;
  geocodeAddress(address: string): Promise<ICoordinates>;
  reverseGeocode(latitude: number, longitude: number): Promise<PlaceDetails>;
  nearbySearch(
    latitude: number,
    longitude: number,
    radiusMeters: number,
    includedTypes: string[],
  ): Promise<NearbySearchResult[]>;
}

export interface PlaceDetails {
  placeId: string;
  formattedAddress: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
  latitude?: number;
  longitude?: number;
}

export interface PlaceAutocompleteResult {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

export class GooglePlacesRepository implements IPlacesRepository {
  private apiKey: string;
  // private baseUrl = "https://maps.googleapis.com/maps/api";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Autocomplete address suggestions
   */
  async autocomplete(input: string): Promise<PlaceAutocompleteResult[]> {
    try {
      const response = await axios.post(
        "https://places.googleapis.com/v1/places:autocomplete",
        {
          input,
          includeQueryPredictions: false,
        },
        {
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": this.apiKey,
            "X-Goog-FieldMask":
              "suggestions.placePrediction.placeId,suggestions.placePrediction.text",
          },
        },
      );

      return (
        response.data.suggestions?.map((item: any) => ({
          placeId: item.placePrediction.placeId,
          description: item.placePrediction.text.text,
          mainText: item.placePrediction.text?.matches?.[0]?.text || "",
          secondaryText: item.placePrediction.text?.text
            .replace(item.placePrediction.text?.matches?.[0]?.text, "")
            .trim(),
        })) || []
      );
    } catch (error: any) {
      console.error("Google Places Autocomplete error:", error.message);
      throw new Error("Failed to fetch address suggestions");
    }
  }

  /**
   * Get detailed place information by place ID
   */
  async getPlaceDetails(placeId: string): Promise<PlaceDetails> {
    try {
      const response = await axios.get(
        `https://places.googleapis.com/v1/places/${placeId}`,
        {
          headers: {
            "X-Goog-Api-Key": this.apiKey,
            "X-Goog-FieldMask":
              "id,formattedAddress,addressComponents,location",
          },
        },
      );

      const result = response.data;
      const components = result.addressComponents || [];

      const getComponent = (type: string) =>
        components.find((c: any) => c.types.includes(type))?.longText;

      const streetNumber = getComponent("street_number");
      const route = getComponent("route");
      const addressLine1 = [streetNumber, route].filter(Boolean).join(" ");

      return {
        placeId,
        formattedAddress: result.formattedAddress,
        addressLine1: addressLine1 || undefined,
        addressLine2: getComponent("subpremise"),
        city:
          getComponent("locality") ||
          getComponent("administrative_area_level_2"),
        state: getComponent("administrative_area_level_1"),
        country: getComponent("country"),
        zipCode: getComponent("postal_code"),
        latitude: result.location?.latitude,
        longitude: result.location?.longitude,
      };
    } catch (error: any) {
      console.error("Google Places Details error:", error.message);
      throw new Error("Failed to fetch place details");
    }
  }

  /**
   * Geocode an address to get coordinates
   */
  async geocodeAddress(
    address: string,
  ): Promise<{ latitude: number; longitude: number }> {
    try {
      const response = await axios.get(
        "https://maps.googleapis.com/maps/api/geocode/json",
        {
          params: { address, key: this.apiKey },
        },
      );

      if (response.data.status !== "OK") {
        throw new Error(`Geocoding error: ${response.data.status}`);
      }

      const location = response.data.results[0]?.geometry?.location;
      return { latitude: location.lat, longitude: location.lng };
    } catch (error: any) {
      console.error("Geocoding error:", error.message);
      throw new Error("Failed to geocode address");
    }
  }

  /**
   * Reverse geocode coordinates to get address
   */
  async reverseGeocode(
    latitude: number,
    longitude: number,
  ): Promise<PlaceDetails> {
    try {
      const response = await axios.get(
        "https://maps.googleapis.com/maps/api/geocode/json",
        {
          params: {
            latlng: `${latitude},${longitude}`,
            key: this.apiKey,
          },
        },
      );

      if (response.data.status !== "OK") {
        throw new Error(`Reverse geocoding error: ${response.data.status}`);
      }

      const result = response.data.results[0];
      const components = result.address_components;

      const getComponent = (type: string) =>
        components.find((c: any) => c.types.includes(type))?.long_name;

      const streetNumber = getComponent("street_number");
      const route = getComponent("route");
      const addressLine1 = [streetNumber, route].filter(Boolean).join(" ");

      return {
        placeId: result.place_id,
        formattedAddress: result.formatted_address,
        addressLine1,
        addressLine2: getComponent("subpremise"),
        city: getComponent("locality"),
        state: getComponent("administrative_area_level_1"),
        country: getComponent("country"),
        zipCode: getComponent("postal_code"),
        latitude,
        longitude,
      };
    } catch (error: any) {
      console.error("Reverse geocoding error:", error.message);
      throw new Error("Failed to reverse geocode coordinates");
    }
  }

  /**
   * Nearby Search — find places of given types within a radius
   */
  async nearbySearch(
    latitude: number,
    longitude: number,
    radiusMeters: number = 15000,
    includedTypes: string[] = ["grocery_store", "supermarket"],
  ): Promise<NearbySearchResult[]> {
    try {
      const response = await axios.post(
        "https://places.googleapis.com/v1/places:searchNearby",
        {
          includedTypes,
          maxResultCount: 20,
          locationRestriction: {
            circle: {
              center: { latitude, longitude },
              radius: radiusMeters,
            },
          },
        },
        {
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": this.apiKey,
            "X-Goog-FieldMask":
              "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.currentOpeningHours,places.regularOpeningHours,places.websiteUri,places.googleMapsUri,places.location,places.photos",
          },
        },
      );

      const places = response.data.places || [];

      return places.map((place: any) => {
        // Build a photo URL if photos exist
        let photoUrl: string | undefined;
        if (place.photos && place.photos.length > 0) {
          const photoRef = place.photos[0].name; // e.g. "places/xxx/photos/yyy"
          photoUrl = `https://places.googleapis.com/v1/${photoRef}/media?maxHeightPx=400&maxWidthPx=600&key=${this.apiKey}`;
        }

        return {
          id: place.id,
          name: place.displayName?.text || "Unknown",
          formattedAddress: place.formattedAddress || "",
          rating: place.rating,
          userRatingCount: place.userRatingCount,
          isOpen: place.currentOpeningHours?.openNow ?? undefined,
          openingHours:
            place.currentOpeningHours?.weekdayDescriptions ||
            place.regularOpeningHours?.weekdayDescriptions ||
            [],
          photoUrl,
          websiteUri: place.websiteUri,
          googleMapsUri: place.googleMapsUri,
          latitude: place.location?.latitude,
          longitude: place.location?.longitude,
        } as NearbySearchResult;
      });
    } catch (error: any) {
      console.error("Google Places Nearby Search error:", error.message);
      throw new Error("Failed to search nearby places");
    }
  }
}
