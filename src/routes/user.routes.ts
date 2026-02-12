import {
  authenticate,
  authenticateForChangePassword,
  authenticateMFA,
  verifyResetToken,
} from "@/middlewares/auth.middleware.js";
import { validate } from "@/middlewares/validation.middleware.js";
import { SessionRepository } from "@/modules/session/session.repository.js";
import { SessionService } from "@/modules/session/session.service.js";
import { UserOtpRepository } from "@/modules/user-otps/user-otp.repository.js";
import { UserOtpService } from "@/modules/user-otps/user-otp.service.js";
import {
  checkPropertyExistSchema,
  createUserSchema,
  userLoginSchema,
} from "@/modules/user/schema/user.schema.js";
import { UserController } from "@/modules/user/user.controller.js";
import { UserRepository } from "@/modules/user/user.repository.js";
import { UserService } from "@/modules/user/user.service.js";
import {
  changePasswordSchema,
  verifyEmailSchema,
} from "@/validators/auth.validators.js";
import { Router } from "express";
import { upload } from "@/utils/file-upload.utils.js";

const router = Router();

// Initialize dependencies
const userRepository = new UserRepository();
const sessionRepository = new SessionRepository();
const otpRepository = new UserOtpRepository();

const otpService = new UserOtpService(otpRepository);
const userService = new UserService(userRepository);
const sessionService = new SessionService(sessionRepository);
const userController = new UserController(
  userService,
  sessionService,
  otpService,
);

// Routes
router.post(
  "/register",
  validate(createUserSchema, "body"),
  userController.createUser,
);
router.post(
  "/login",
  validate(userLoginSchema, "body"),
  userController.loginUser,
);
router.get(
  "/verify-email",

  userController.verifyEmail,
);
router.post(
  "/check",
  validate(checkPropertyExistSchema, "body"),
  userController.checkIsPropertytExist,
);

router.post(
  "/exist",
  [authenticate, validate(checkPropertyExistSchema, "body")],
  userController.checkIsPropertytExist,
);
router.get("/me", [authenticate], userController.getActiveUser);
router.post("/refresh-token", userController.refreshToken);
router.post("/logout", [authenticate], userController.logout);
router.post("/forgot-password", userController.forgotPassword);
router.get(
  "/verify/:token",
  [validate(verifyEmailSchema, "params"), verifyResetToken],
  userController.verifyToken,
);
router.put(
  "/reset-password",
  [authenticateForChangePassword],
  userController.resetPassword,
);

router.post("/verify-mfa", [authenticateMFA], userController.verifyOtp);

// router.get("/", userController.getUsers);
// router.get("/:id", userController.getUser);
router.patch("/", [authenticate], userController.updateUser);
// router.delete("/:id", userController.deleteUser);
router.put(
  "/change-password",
  [authenticate, validate(changePasswordSchema, "body")],
  userController.changePassword,
);
// router.post("/send-otp", userController.sendVerificationOtp);
// ;
// router.post("/:id/enable-mfa", userController.enableMfa);
// router.post("/:id/disable-mfa", userController.disableMfa);

router.post(
  "/upload-avatar",
  [authenticate, upload.single("avatar")],
  userController.uploadAvatar,
);

export default router;
