import { Router } from "express";
import { authenticate } from "@/middlewares/auth.middleware.js";
import { uploadReceipt } from "@/modules/receipt/receipt.controller.js";
import { receiptUpload } from "@/utils/file-upload.utils.js";

const router = Router();

// Routes
router.post(
  "/upload",
  [authenticate, receiptUpload.single("file")],
  uploadReceipt,
);

export default router;
