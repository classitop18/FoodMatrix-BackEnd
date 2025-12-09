import { Router } from "express";
import { UserRepository } from "../modules/user/user.repository";
import { UserService } from "../modules/user/user.service";
import { UserController } from "../modules/user/user.controller";

const router = Router();

// Initialize dependencies
const userRepository = new UserRepository();
const userService = new UserService(userRepository);
const userController = new UserController(userService);

// Routes
router.post("/register", userController.createUser);
router.post("/login", userController.loginUser)
router.post("/check", userController.checkIsPropertytExist);
router.get("/", userController.getUsers);
router.get("/:id", userController.getUser);
router.patch("/:id", userController.updateUser);
router.delete("/:id", userController.deleteUser);
router.post("/:id/change-password", userController.changePassword);
router.post("/send-otp", userController.sendVerificationOtp);
router.post("/verify-email", userController.verifyEmail);
router.post("/:id/enable-mfa", userController.enableMfa);
router.post("/:id/disable-mfa", userController.disableMfa);

export default router;
