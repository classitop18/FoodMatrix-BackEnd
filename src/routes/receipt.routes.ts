import { Router } from "express";
import { authenticate } from "@/middlewares/auth.middleware.js";
import {
  uploadReceipt,
  getReceipts,
  getReceiptById,
  updateReceipt,
} from "@/modules/receipt/receipt.controller.js";
import { receiptUpload } from "@/utils/file-upload.utils.js";

const router = Router();

// GET /receipts - Paginated list with filters
router.get("/", authenticate, getReceipts);

// GET /receipts/:id - Single receipt detail
router.get("/:id", authenticate, getReceiptById);

// POST /receipts/upload - Upload and OCR a receipt
router.post(
  "/upload",
  [authenticate, receiptUpload.single("file")],
  uploadReceipt,
);

// PATCH /receipts/:id - Update description/tags
router.patch("/:id", authenticate, updateReceipt);

export default router;
