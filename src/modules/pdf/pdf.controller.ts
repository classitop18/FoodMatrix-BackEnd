import { Request, Response } from "express";
import { PdfService } from "./pdf.service.js";

const pdfService = new PdfService();

export class PdfController {
  async downloadShoppingList(req: Request, res: Response) {
    try {
      const data = req.body;
      const pdfBuffer = await pdfService.generateShoppingListPdf(data);

      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="shopping-list-${Date.now()}.pdf"`,
        "Content-Length": pdfBuffer.length,
      });

      res.end(pdfBuffer);
    } catch (error) {
      console.error("Error generating PDF:", error);
      res.status(500).json({ message: "Failed to generate PDF" });
    }
  }
}
