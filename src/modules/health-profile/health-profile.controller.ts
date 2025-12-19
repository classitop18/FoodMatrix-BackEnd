
import { Request, Response, NextFunction } from "express";

import { createHealthProfileSchema, healthAssessmentSchema, queryHealthProfileSchema, updateHealthProfileSchema } from "./dto/health-profile.dto.js";
import { IHealthProfileService } from "./types/health-profile.types.js";
import { AuthenticatedRequest } from "@/middlewares/auth.middleware.js";
import { sendSuccess } from "@/utils/response.utils.js";

export class HealthProfileController {
    constructor(private readonly service: IHealthProfileService) { }

    /**
     * @route   POST /api/health-profiles
     * @desc    Create a new health profile
     * @access  Private
     */
    createHealthProfile = async (
        req: AuthenticatedRequest,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const validatedData = createHealthProfileSchema.parse(req.body);
            const userId = req.user!.id;
            const profile = await this.service.createHealthProfile(validatedData, userId);

            sendSuccess(res, profile, "Health profile created successfully", 201);
        } catch (error) {
            next(error);
        }
    };

    /**
     * @route   GET /api/health-profiles/:id
     * @desc    Get health profile by ID
     * @access  Private
     */
    getHealthProfile = async (
        req: AuthenticatedRequest,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const { id } = req.params;
            const userId = req.user!.id;

            const profile = await this.service.getHealthProfile(id, userId);

            sendSuccess(res, profile, "", 200);

        } catch (error) {
            next(error);
        }
    };

    /**
     * @route   GET /api/health-profiles/member/:memberId
     * @desc    Get health profile by member ID
     * @access  Private
     */
    getHealthProfileByMember = async (
        req: AuthenticatedRequest,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const { memberId } = req.params;
            const userId = req.user!.id;

            const profile = await this.service.getHealthProfileByMember(memberId, userId);


        } catch (error) {
            next(error);
        }
    };

    /**
     * @route   GET /api/health-profiles
     * @desc    Get all health profiles (with filters)
     * @access  Private
     */
    getAllHealthProfiles = async (
        req: AuthenticatedRequest,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const query = queryHealthProfileSchema.parse(req.query);
            const userId = req.user!.id;

            const result = await this.service.getAllHealthProfiles(query, userId);



        } catch (error) {
            next(error);
        }
    };

    /**
     * @route   PATCH /api/health-profiles/:id
     * @desc    Update health profile
     * @access  Private
     */
    updateHealthProfile = async (
        req: AuthenticatedRequest,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const { id } = req.params;
            const validatedData = updateHealthProfileSchema.parse(req.body);
            const userId = req.user!.id;

            const profile = await this.service.updateHealthProfile(id, validatedData, userId);

            sendSuccess(res, profile, "Health profile updated successfully", 200);
        } catch (error) {
            next(error);
        }
    };

    /**
     * @route   DELETE /api/health-profiles/:id
     * @desc    Delete health profile
     * @access  Private
     */
    deleteHealthProfile = async (
        req: AuthenticatedRequest,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const { id } = req.params;
            const userId = req.user!.id;

            await this.service.deleteHealthProfile(id, userId);

            sendSuccess(res, null, "Health profile deleted successfully", 200);
        } catch (error) {
            next(error);
        }
    };

    /**
     * @route   POST /api/health-profiles/calculate-bmi
     * @desc    Calculate BMI
     * @access  Private
     */
    calculateBMI = async (
        req: AuthenticatedRequest,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const { weight, height } = req.body;


            const bmi = this.service.calculateBMI(Number(weight), Number(height));

        } catch (error) {
            next(error);
        }
    };

    /**
     * @route   POST /api/health-profiles/member/:memberId/assessment
     * @desc    Perform health assessment
     * @access  Private
     */
    performHealthAssessment = async (
        req: AuthenticatedRequest,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const { memberId } = req.params;
            const validatedData = healthAssessmentSchema.parse(req.body);
            const userId = req.user!.id;

            const assessment = await this.service.performHealthAssessment(
                memberId,
                validatedData,
                userId
            );

        } catch (error) {
            next(error);
        }
    };

    /**
     * @route   POST /api/health-profiles/member/:memberId/sync-wearable
     * @desc    Sync wearable device data
     * @access  Private
     */
    syncWearableData = async (
        req: AuthenticatedRequest,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const { memberId } = req.params;
            const userId = req.user!.id;

            await this.service.syncWearableData(memberId, userId);

        } catch (error) {
            next(error);
        }
    };
}