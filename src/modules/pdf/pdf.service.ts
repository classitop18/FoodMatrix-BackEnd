import PDFDocument from "pdfkit";

export class PdfService {
  async generateShoppingListPdf(data: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const buffers: Buffer[] = [];

      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err) => reject(err));

      // Headers
      doc.fontSize(20).text("Shopping List", { align: "center" });
      doc.moveDown();
      doc
        .fontSize(10)
        .text(
          `Generated on: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
          { align: "center" },
        );
      doc.moveDown();

      // Categories
      const ingredients = data.ingredients || [];
      const categories: Record<string, any[]> = {};
      let grandTotal = 0;

      ingredients.forEach((item: any) => {
        const cat = (item.category || "Others").toLowerCase();
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(item);

        // Calculate total
        const qty = item.displayQuantity || item.quantity || 0;
        const price = item.price || 0;
        grandTotal += price * qty;
      });

      const categoryOrder = [
        "vegetables",
        "fruits",
        "snacks",
        "drinks",
        "others",
      ];

      const sortedKeys = Object.keys(categories).sort((a, b) => {
        const idxA = categoryOrder.indexOf(a);
        const idxB = categoryOrder.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.localeCompare(b);
      });

      sortedKeys.forEach((cat) => {
        const items = categories[cat];
        if (items.length > 0) {
          doc
            .fontSize(14)
            .fillColor("#7dab4f")
            .text(cat.charAt(0).toUpperCase() + cat.slice(1));
          doc.moveDown(0.5);

          items.forEach((item) => {
            const qty = item.displayQuantity || item.quantity || 0;
            const unit = item.displayUnit || item.unit || "";
            const price = item.price ? `$${(item.price * qty).toFixed(2)}` : "";
            const source =
              item.source === "Recipe" ? item.recipeName || "Recipe" : "Manual";

            doc.fontSize(12).fillColor("black");

            // Draw bullet
            const currentY = doc.y;
            doc.text("•", 50, currentY);

            // Draw Name and Qty
            doc.text(`${item.name}: ${qty} ${unit}`, 70, currentY);

            // Draw Price if exists
            if (price) {
              doc.text(price, 400, currentY, { align: "right" });
            }

            // Draw Source in small grey
            doc.fontSize(9).fillColor("gray").text(source, 70, doc.y);
            doc.moveDown(0.5);
          });
          doc.moveDown();
        }
      });

      // Grand Total
      if (grandTotal > 0) {
        doc.moveDown();
        doc.lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown();
        doc
          .fontSize(16)
          .fillColor("black")
          .text(`Total Estimate: $${grandTotal.toFixed(2)}`, {
            align: "right",
          });
      }

      doc.end();
    });
  }
}
