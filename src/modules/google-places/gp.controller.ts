import { Request, Response, NextFunction } from "express";
import { IPlacesService } from "./gp.service.js";
import { sendResponse } from "@/utils/response.utils.js";

export class PlacesController {
  constructor(private placesService: IPlacesService) {}

  /* =========================
       Autocomplete
    ========================= */
  autocomplete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = req.query;

      // console.log(req.query, "myquwry");

      const results = await this.placesService.autocomplete(
        dto.input as string,
        dto.types as string,
      );

      return sendResponse(
        res,
        results,
        "Autocomplete suggestions fetched successfully",
        200,
      );
    } catch (error) {
      next(error);
    }
  };

  /* =========================
       Place Details
    ========================= */
  getPlaceDetails = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = req.params;

      const details = await this.placesService.getPlaceDetails(dto.placeId);

      return sendResponse(
        res,
        details,
        "Place details fetched successfully",
        200,
      );
    } catch (error) {
      next(error);
    }
  };

  /* =========================
       Geocode Address
    ========================= */
  geocodeAddress = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = req.body;

      const coordinates = await this.placesService.geocodeAddress(dto.address);

      return sendResponse(
        res,
        coordinates,
        "Address geocoded successfully",
        200,
      );
    } catch (error) {
      next(error);
    }
  };

  /* =========================
       Reverse Geocode
    ========================= */
  reverseGeocode = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = req.body;

      const details = await this.placesService.reverseGeocode(
        dto.latitude,
        dto.longitude,
      );

      return sendResponse(
        res,
        details,
        "Coordinates reverse geocoded successfully",
        200,
      );
    } catch (error) {
      next(error);
    }
  };

  /* =========================
       Nearby Grocery Shops
  ========================= */
  nearbyGroceryShops = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { latitude, longitude, radius } = req.body;

      if (!latitude || !longitude) {
        return sendResponse(
          res,
          null,
          "Latitude and longitude are required",
          400,
        );
      }

      const results = await this.placesService.searchNearbyGroceryShops(
        Number(latitude),
        Number(longitude),
        radius ? Number(radius) : 15000,
      );

      return sendResponse(
        res,
        results,
        "Nearby grocery shops fetched successfully",
        200,
      );
    } catch (error) {
      next(error);
    }
  };
}
