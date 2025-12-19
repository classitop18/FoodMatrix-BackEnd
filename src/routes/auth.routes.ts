import { AuthController } from "@/modules/auth/auth.controller.js";
import { SessionRepository } from "@/modules/session/session.repository.js";
import { SessionService } from "@/modules/session/session.service.js";
import { UserRepository } from "@/modules/user/user.repository.js";
import { UserService } from "@/modules/user/user.service.js";
import { Router } from "express";

const router = Router();

// Initialize dependencies
const sessionRepository = new SessionRepository();
const sessionService = new SessionService(sessionRepository);
const userRepository = new UserRepository();
const userService = new UserService(userRepository);

// Initialize controller
const authController = new AuthController(sessionService, userService);

/**
 * @route   POST /api/v1/auth/refresh-token
 * @desc    Refresh access token
 * @access  Public (requires refresh token in cookie)
 */
router.post("/refresh-token", authController.refreshToken);

export default router;
