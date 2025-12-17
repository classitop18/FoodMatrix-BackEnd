import { Request, Response, NextFunction } from "express";
import { IPlacesService } from "./gp.service.js";
import { sendSuccess } from "@/utils/response.utils.js";



export class PlacesController {
    constructor(private placesService: IPlacesService) { }

    /* =========================
       Autocomplete
    ========================= */
    autocomplete = async (
        req: Request,
        res: Response,
        next: NextFunction
    ) => {
        try {
            const dto = req.query

            console.log(req.query,"myquwry")

            const results = await this.placesService.autocomplete(
                dto.input,
                dto.types
            );

            return sendSuccess(
                res,
                results,
                "Autocomplete suggestions fetched successfully",
                200
            );
        } catch (error) {
            
            next(error);
        }
    };

    /* =========================
       Place Details
    ========================= */
    getPlaceDetails = async (
        req: Request,
        res: Response,
        next: NextFunction
    ) => {
        try {
            const dto = req.params;

            const details = await this.placesService.getPlaceDetails(dto.placeId);

            return sendSuccess(
                res,
                details,
                "Place details fetched successfully",
                200
            );
        } catch (error) {
            next(error);
        }
    };

    /* =========================
       Geocode Address
    ========================= */
    geocodeAddress = async (
        req: Request,
        res: Response,
        next: NextFunction
    ) => {
        try {
            const dto = req.body;


            const coordinates = await this.placesService.geocodeAddress(dto.address);

            return sendSuccess(
                res,
                coordinates,
                "Address geocoded successfully",
                200
            );
        } catch (error) {
            next(error);
        }
    };

    /* =========================
       Reverse Geocode
    ========================= */
    reverseGeocode = async (
        req: Request,
        res: Response,
        next: NextFunction
    ) => {
        try {
            const dto = req.body;

            const details = await this.placesService.reverseGeocode(
                dto.latitude,
                dto.longitude
            );

            return sendSuccess(
                res,
                details,
                "Coordinates reverse geocoded successfully",
                200
            );
        } catch (error) {
            next(error);
        }
    };
}
