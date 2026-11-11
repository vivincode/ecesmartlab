import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * RFC-4180 compliant CSV generator with formula-injection protection.
 */
export function generateCSV(headers: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  const escapeCell = (val: string | number | boolean | null | undefined): string => {
    let str = val == null ? "" : String(val);
    // Prevent CSV spreadsheet formula injection
    if (/^[=+\-@\t\r]/.test(str)) {
      str = `'${str}`;
    }
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [headers.map(escapeCell).join(","), ...rows.map((r) => r.map(escapeCell).join(","))];
  return lines.join("\r\n");
}

export function downloadCSV(filename: string, csvContent: string) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadPDFReport(params: {
  title: string;
  subtitle: string;
  filename: string;
  headers: string[];
  rows: (string | number)[][];
}) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text(`SMARTLAB // ${params.title.toUpperCase()}`, 40, 44);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(`${params.subtitle}  |  Generated: ${new Date().toLocaleString()}`, 40, 62);

  autoTable(doc, {
    startY: 78,
    head: [params.headers],
    body: params.rows.map((r) => r.map((c) => String(c ?? "—"))),
    theme: "grid",
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [15, 23, 42],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 40, right: 40 },
  });

  doc.save(params.filename.endsWith(".pdf") ? params.filename : `${params.filename}.pdf`);
}
