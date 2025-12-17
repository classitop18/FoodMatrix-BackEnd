import { IPlacesRepository } from "./gp.repository.js";
import { IAddressDetails, ICoordinates, IPlaceAutocomplete, IPlaceDetails } from "./types/gp.types.js";

export interface IPlacesService {
    autocomplete(input: string, types?: string): Promise<IPlaceAutocomplete[]>;
    getPlaceDetails(placeId: string): Promise<IPlaceDetails>;
    geocodeAddress(address: string): Promise<ICoordinates>;
    reverseGeocode(latitude: number, longitude: number): Promise<IAddressDetails>;
}




export class PlacesService implements IPlacesService {
    constructor(private placesRepository: IPlacesRepository) { }

    async autocomplete(input: string, types: string = 'address'): Promise<IPlaceAutocomplete[]> {
        try {
            const results = await this.placesRepository.autocomplete(input, types);
            return results;
        } catch (error: any) {
            throw new Error(`Autocomplete service error: ${error.message}`);
        }
    }

    async getPlaceDetails(placeId: string): Promise<IPlaceDetails> {
        try {
            const details = await this.placesRepository.getPlaceDetails(placeId);
            return details;
        } catch (error: any) {
            throw new Error(`Place details service error: ${error.message}`);
        }
    }

    async geocodeAddress(address: string): Promise<ICoordinates> {
        try {
            const coordinates = await this.placesRepository.geocodeAddress(address);
            return coordinates;
        } catch (error: any) {
            throw new Error(`Geocode service error: ${error.message}`);
        }
    }

    async reverseGeocode(latitude: number, longitude: number): Promise<IAddressDetails> {
        try {
            const details = await this.placesRepository.reverseGeocode(latitude, longitude);
            return details;
        } catch (error: any) {
            throw new Error(`Reverse geocode service error: ${error.message}`);
        }
    }
}