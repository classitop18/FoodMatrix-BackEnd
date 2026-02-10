import PDFDocument from "pdfkit";

export class PdfService {
  async generateShoppingListPdf(data: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: "A4" });
      const buffers: Buffer[] = [];

      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err) => reject(err));

      // --- Colors ---
      const PRIMARY_COLOR = "#7dab4f";
      const TEXT_COLOR = "#333333";
      const MUTED_COLOR = "#666666";
      // const BORDER_COLOR = "#E0E0E0"; // Added for potential future use or consistency

      // --- Header ---
      doc
        .fontSize(24)
        .font("Helvetica-Bold")
        .fillColor(PRIMARY_COLOR)
        .text("Shopping List", { align: "center" });

      doc.moveDown(0.2);

      if (data.eventName) {
        doc
          .fontSize(16)
          .font("Helvetica")
          .fillColor(TEXT_COLOR)
          .text(data.eventName, { align: "center" });
      }

      doc.moveDown(0.5);

      // --- Metadata Strip ---
      const dateStr = data.eventDate
        ? new Date(data.eventDate).toLocaleDateString()
        : new Date().toLocaleDateString();

      const parts = [
        `Date: ${dateStr}`,
        data.guestCount ? `Guests: ${data.guestCount}` : null,
        data.totalEventBudget
          ? `Budget: $${parseFloat(data.totalEventBudget).toFixed(2)}`
          : null,
      ].filter(Boolean);

      doc
        .fontSize(10)
        .font("Helvetica")
        .fillColor(MUTED_COLOR)
        .text(parts.join("  |  "), { align: "center" });

      doc.moveDown(1.5);

      // --- Process Data ---
      const ingredients = data.ingredients || [];
      const categories: Record<string, any[]> = {};

      ingredients.forEach((item: any) => {
        const cat = (item.category || "Others").toLowerCase();
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(item);
      });

      const categoryOrder = [
        "vegetables",
        "fruits",
        "meat",
        "dairy",
        "pantry",
        "spices",
        "bakery",
        "snacks",
        "drinks",
        "beverages",
        "desserts",
        "others",
      ];

      const sortedCats = Object.keys(categories).sort((a, b) => {
        const ia = categoryOrder.indexOf(a);
        const ib = categoryOrder.indexOf(b);
        if (ia !== -1 && ib !== -1) return ia - ib;
        if (ia !== -1) return -1;
        if (ib !== -1) return 1;
        return a.localeCompare(b);
      });

      // --- Render Categories ---
      let y = doc.y;

      sortedCats.forEach((cat) => {
        const items = categories[cat];
        if (!items || items.length === 0) return;

        // Check for page break
        if (y + 50 + items.length * 20 > doc.page.height - 50) {
          doc.addPage();
          y = 50;
        }

        // Category Header
        doc.rect(50, y, 495, 25).fill(PRIMARY_COLOR);

        doc
          .fontSize(12)
          .font("Helvetica-Bold")
          .fillColor("white")
          .text(cat.charAt(0).toUpperCase() + cat.slice(1), 60, y + 7);

        y += 35;

        // Items
        items.forEach((item: any) => {
          // Page break check per item
          if (y > doc.page.height - 50) {
            doc.addPage();
            y = 50;
          }

          const name = item.name || item.ingredientName || "Unknown Item";
          const qty = item.displayQuantity || item.quantity || "";
          const unit = item.displayUnit || item.unit || "";
          const quantityStr = qty ? `${qty} ${unit}` : "";
          const estPrice = item.estimatedPrice
            ? `$${parseFloat(item.estimatedPrice).toFixed(2)}`
            : "";

          // Checkbox
          doc
            .rect(50, y, 12, 12)
            .lineWidth(1)
            .strokeColor(MUTED_COLOR)
            .stroke();

          // Name
          doc
            .fontSize(11)
            .font("Helvetica")
            .fillColor(TEXT_COLOR)
            .text(name, 75, y);

          // Quantity (Right aligned relative to a column)
          if (quantityStr) {
            doc
              .fontSize(11)
              .font("Helvetica-Bold")
              .text(quantityStr, 350, y, { width: 100, align: "right" });
          }

          // Price (Far Right)
          if (estPrice) {
            doc
              .fontSize(10)
              .font("Helvetica")
              .fillColor(MUTED_COLOR)
              .text(estPrice, 480, y + 1, { width: 65, align: "right" });
          }

          // Separator Line
          doc
            .moveTo(50, y + 18)
            .lineTo(545, y + 18)
            .lineWidth(0.5)
            .strokeColor("#F0F0F0")
            .stroke();

          y += 25;
        });

        y += 15; // Space between categories
      });

      // --- Footer ---
      // Total Estimated Cost check
      const totalEst = ingredients.reduce(
        (sum: number, item: any) =>
          sum + (parseFloat(item.estimatedPrice) || 0),
        0,
      );

      if (y > doc.page.height - 80) {
        doc.addPage();
        y = 50;
      }

      if (totalEst > 0) {
        doc.rect(350, y, 195, 30).fill("#f9f9f9");
        doc
          .fontSize(12)
          .font("Helvetica-Bold")
          .fillColor(TEXT_COLOR)
          .text(`Est. Total: $${totalEst.toFixed(2)}`, 350, y + 8, {
            align: "center",
            width: 195,
          });
      }

      // Page numbering
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc
          .fontSize(8)
          .fillColor(MUTED_COLOR)
          .text(
            `Page ${i + 1} of ${range.count} - Generated by Food Matrix`,
            50,
            doc.page.height - 30,
            { align: "center", width: 500 },
          );
      }

      doc.end();
    });
  }
}
