import { validate } from "@/middlewares/validation.middleware.js";
import { AutocompleteQuerySchema, PlaceDetailsParamsSchema } from "@/modules/google-places/dto/gp-dto.js";
import { PlacesController } from "@/modules/google-places/gp.controller.js";
import { GooglePlacesRepository } from "@/modules/google-places/gp.repository.js";
import { PlacesService } from "@/modules/google-places/gp.service.js";
import { CONFIG } from "@/utils/env.config.js";
import { Router } from "express";

const GOOGLE_PLACES_API_KEY = CONFIG.GOOGLE_PLACES_API_KEY || 'AIzaSyBUisgDVcC4u56nJpGNSu7D_dGG9x6S_ew';

// Initialize layers
const placesRepository = new GooglePlacesRepository(GOOGLE_PLACES_API_KEY);
const placesService = new PlacesService(placesRepository);
const placesController = new PlacesController(placesService);


const googlePlacesRoutes = Router();

googlePlacesRoutes.get('/autocomplete',placesController.autocomplete);
googlePlacesRoutes.get('/details/:placeId',validate(PlaceDetailsParamsSchema,"params"), placesController.getPlaceDetails);
googlePlacesRoutes.post('/geocode', placesController.geocodeAddress);
googlePlacesRoutes.post('/reverse-geocode', placesController.reverseGeocode);



export default googlePlacesRoutes; 
