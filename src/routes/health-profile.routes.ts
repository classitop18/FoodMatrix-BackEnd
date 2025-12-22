// src/modules/health-profiles/routes/health-profile.routes.ts
import { authenticate } from "@/middlewares/auth.middleware.js";
import { HealthCalculatorService } from "@/modules/health-profile/health-calculate.service.js";
import { HealthProfileController } from "@/modules/health-profile/health-profile.controller.js";
import { HealthProfileRepository } from "@/modules/health-profile/health-profile.repository.js";
import { HealthProfileService } from "@/modules/health-profile/health-profile.service.js";
import { Router } from "express";

const healthCalculator = new HealthCalculatorService();
const healthProfileRepo = new HealthProfileRepository();
const healthProfileService = new HealthProfileService(
  healthProfileRepo,
  healthCalculator,
);
const healthProfileController = new HealthProfileController(
  healthProfileService,
);

const router = Router();

// All routes require authentication
router.use(authenticate);

// Health Profile CRUD
/**
 * @route   POST /api/health-profile
 * @desc    Create a new health profile
 * @access  Private
 */
router.post("/", healthProfileController.createHealthProfile);

/**
 * @route   GET /api/health-profile/:id
 * @desc    Get health profile by ID
 * @access  Private
 */
router.get("/:id", healthProfileController.getHealthProfile);

/**
 * @route   PUT /api/health-profile/:id
 * @desc    Update health profile
 * @access  Private
 */
router.put("/:id", healthProfileController.updateHealthProfile);

/**
 * @route   DELETE /api/health-profile/:id
 * @desc    Delete health profile
 * @access  Private
 */
router.delete("/:id", healthProfileController.deleteHealthProfile);

// Health Calculations
/**
 * @route   POST /api/health-profile/calculate-bmi
 * @desc    Calculate BMI
 * @access  Private
 */
router.post("/calculate-bmi", healthProfileController.calculateBMI);

export default router;
