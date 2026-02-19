import { Router } from "express";
import multer from "multer";
import { authenticate } from "@/middlewares/auth.middleware.js";
import { uploadReceipt } from "@/modules/receipt/receipt.controller.js";
import { AppError } from "@/utils/app-error.utils.js";

const router = Router();

// Configure Multer for Memory Storage (Access buffer directly)
const storage = multer.memoryStorage();

const fileFilter = (req: any, file: any, cb: any) => {
  const allowedMimes = [
    "image/jpeg",
    "image/png",
    "image/jpg",
    "image/webp",
    "application/pdf",
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        "Invalid file type. Only JPG, PNG, WEBP, and PDF are allowed.",
        400,
      ),
      false,
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Routes
router.post("/upload", [authenticate, upload.single("file")], uploadReceipt);

export default router;
