import { Router } from "express";
import { UserRepository } from "../modules/user/user.repository.ts";
import { UserService } from "../modules/user/user.service.ts";
import { UserController } from "../modules/user/user.controller.ts";
import { validate } from "../middlewares/validation.middleware.ts";
import { checkPropertyExistSchema, createUserSchema, userLoginSchema, verifyEmailSchema } from "../modules/user/schema/user.schema.ts";
import { SessionService } from "../modules/session/session.service.ts";
import { SessionRepository } from "../modules/session/session.repository.ts";
import { authenticate } from "../middlewares/auth.middleware.ts";

const router = Router();

// Initialize dependencies
const userRepository = new UserRepository();
const sessionRepository = new SessionRepository()
const userService = new UserService(userRepository);
const sessionService = new SessionService(sessionRepository);
const userController = new UserController(userService, sessionService);

// Routes
router.post("/register", validate(createUserSchema, "body"), userController.createUser);
router.post("/login", validate(userLoginSchema, "body"), userController.loginUser)
router.get("/verify-email", validate(verifyEmailSchema, "query"), userController.verifyEmail)
router.post("/check", validate(checkPropertyExistSchema, "body"), userController.checkIsPropertytExist);
router.get("/me" , [authenticate] , userController.getActiveUser)
// router.get("/", userController.getUsers);
// router.get("/:id", userController.getUser);
// router.patch("/:id", userController.updateUser);
// router.delete("/:id", userController.deleteUser);
// router.post("/:id/change-password", userController.changePassword);
// router.post("/send-otp", userController.sendVerificationOtp);
// ;
// router.post("/:id/enable-mfa", userController.enableMfa);
// router.post("/:id/disable-mfa", userController.disableMfa);

export default router;
