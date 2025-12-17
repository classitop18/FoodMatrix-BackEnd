// src/modules/health-profiles/routes/health-profile.routes.ts
import { authenticate } from "@/middlewares/auth.middleware.js";
import { HealthCalculatorService } from "@/modules/health-profile/health-calculate.service.js";
import { HealthProfileController } from "@/modules/health-profile/health-profile.controller.js";
import { HealthProfileRepository } from "@/modules/health-profile/health-profile.repository.js";
import { HealthProfileService } from "@/modules/health-profile/health-profile.service.js";
import { Router } from "express";



const healthCalculator = new HealthCalculatorService();
const healthProfileRepo = new HealthProfileRepository();
const healProfileService = new HealthProfileService(healthProfileRepo, healthCalculator)
const healthProfileController = new HealthProfileController(healProfileService)


const router = Router();

// All routes require authentication
router.use(authenticate);

// Health Profile CRUD
// router.post(
//     "/",
//     validateRequest({ body: createHealthProfileSchema }),
//     HealthProfileController.createHealthProfile
// );

router.get("/:id", healthProfileController.getHealthProfile);

// router.get("/:id", controller.getHealthProfile);

// router.get("/member/:memberId", controller.getHealthProfileByMember);

// router.patch(
//     "/:id",
//     validateRequest({ body: updateHealthProfileSchema }),
//     controller.updateHealthProfile
// );

// router.delete("/:id", controller.deleteHealthProfile);

// // Health Calculations
// router.post("/calculate-bmi", controller.calculateBMI);

// // Health Assessment
// router.post(
//     "/member/:memberId/assessment",
//     validateRequest({ body: healthAssessmentSchema }),
//     controller.performHealthAssessment
// );

// // Wearable Integration
// router.post("/member/:memberId/sync-wearable", controller.syncWearableData);

// return router;



export default router;