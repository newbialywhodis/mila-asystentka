import type { Benefit, CaseFacts } from "../../engine/parent-case";

export const caseExamples: { label: string; benefit: Benefit; facts: CaseFacts }[] = [
  {
    label: "Ojcowski przez 7 dni",
    benefit: "paternity",
    facts: {
      birth: "2026-08-12",
      from: "2026-11-02",
      through: "2026-11-08",
      employment: "employee",
      insured: true,
      basis: 600_000,
      payer: "zus",
      paternityUsed: "none",
    },
  },
  {
    label: "Zlecenie bez chorobowego",
    benefit: "maternity",
    facts: { birth: "2026-11-18", employment: "contract", insured: false, children: 1 },
  },
  {
    label: "Etat po porodzie",
    benefit: "maternity",
    facts: {
      birth: "2026-11-18",
      employment: "employee",
      insured: true,
      children: 1,
      fixedSalary: 600_000,
      payer: "zus",
      standardRate: true,
    },
  },
  {
    label: "Pięć wykorzystanych części",
    benefit: "parental",
    facts: {
      birth: "2026-02-03",
      from: "2026-10-05",
      through: "2026-10-11",
      employment: "contract",
      insured: true,
      parts: 5,
    },
  },
];

export const demoCaseSource = { label: "Fikcyjny przykład Mili" };
