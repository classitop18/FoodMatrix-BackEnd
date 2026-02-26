import multer from "multer";
import { AppError } from "./app-error.utils.js";
import { Request } from "express";

// ─── Memory Storage (buffers go directly to S3) ────────────
const storage = multer.memoryStorage();

// ─── Image File Filter ─────────────────────────────────────
const imageFileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  const allowedMimes = ["image/jpeg", "image/png", "image/jpg", "image/webp"];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        "Invalid file type. Only JPEG, PNG, JPG, and WebP are allowed.",
        400,
      ),
    );
  }
};

// ─── Receipt File Filter (images + PDF) ────────────────────
const receiptFileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
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
    );
  }
};

/**
 * Standard image upload (avatars, recipe images)
 * - Memory storage (buffer available for S3)
 * - 5MB limit
 * - Images only
 */
export const upload = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

/**
 * Receipt upload (images + PDFs)
 * - Memory storage (buffer available for S3)
 * - 10MB limit
 * - Images + PDF
 */
export const receiptUpload = multer({
  storage,
  fileFilter: receiptFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});
