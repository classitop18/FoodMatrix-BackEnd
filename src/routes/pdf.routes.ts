import { Router } from "express";
import { PdfController } from "../modules/pdf/pdf.controller.js";

const pdfRouter = Router();
const pdfController = new PdfController();

pdfRouter.post(
  "/shopping-list",
  pdfController.downloadShoppingList.bind(pdfController),
);

export default pdfRouter;
