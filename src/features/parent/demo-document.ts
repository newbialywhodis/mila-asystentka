import type { DocumentRead } from "./case-documents";

const birth = "2026-08-12";
const from = "2026-11-02";
const through = "2026-11-08";

export const demoDocumentRead: DocumentRead = {
  kind: "application",
  requestedBenefit: "paternity",
  candidates: [
    { key: "birth", value: birth, page: 1 },
    { key: "from", value: from, page: 1 },
    { key: "through", value: through, page: 1 },
    { key: "employment", value: "employee", page: 1 },
    { key: "insured", value: true, page: 1 },
    { key: "paternityUsed", value: "none", page: 1 },
    { key: "payer", value: "zus", page: 1 },
    { key: "basis", value: 600_000, page: 1 },
  ],
  decisions: [],
};

const exampleLines = [
  "FIKCYJNY PRZYKLAD MILI - NIE JEST TO DRUK ZUS",
  "Wniosek o zasilek macierzynski za okres urlopu ojcowskiego.",
  `Data urodzenia dziecka: ${birth}.`,
  `Wnioskowany okres od ${from} do ${through} wlacznie.`,
  "Zatrudnienie: umowa o prace.",
  "Ubezpieczenie chorobowe w dniu rozpoczecia okresu: TAK.",
  "Wykorzystany dotad urlop ojcowski: 0 tygodni.",
  "Platnik zasilku: ZUS.",
  "Ustalona miesieczna podstawa wymiaru zasilku: 6000,00 PLN.",
];

export function makeDemoPdf() {
  const contents =
    "BT /F1 11 Tf 45 764 Td 19 TL\n" +
    exampleLines.map((line, index) => (index ? "T* " : "") + "(" + line + ") Tj").join("\n") +
    "\nET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Length " + contents.length + " >>\nstream\n" + contents + "\nendstream",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = objects.map((object, index) => {
    const offset = pdf.length;
    pdf += index + 1 + " 0 obj\n" + object + "\nendobj\n";
    return offset;
  });
  const xref = pdf.length;
  pdf += "xref\n0 6\n0000000000 65535 f \n";
  pdf += offsets.map((offset) => String(offset).padStart(10, "0") + " 00000 n \n").join("");
  pdf += "trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF\n";
  return new TextEncoder().encode(pdf);
}
