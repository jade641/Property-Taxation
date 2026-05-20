export const STATUSES = {
  COMPLIANT: "Compliant",
  LATE: "Late",
  UNPAID: "Unpaid",
  PAID: "Paid",
} as const;

export type ComplianceStatus = typeof STATUSES[keyof typeof STATUSES] extends infer T ? T extends string ? (T extends "Compliant" | "Late" | "Unpaid" ? T : never) : never : never;

export const COMPLIANCE_STATUSES = [STATUSES.COMPLIANT, STATUSES.LATE, STATUSES.UNPAID] as const;
export const PAYMENT_STATUSES = [STATUSES.PAID, STATUSES.UNPAID, STATUSES.LATE] as const;

export function normalizeComplianceStatus(value: string): ComplianceStatus {
  const v = value?.trim().toLowerCase();
  if (v === "compliant") return STATUSES.COMPLIANT as ComplianceStatus;
  if (v === "late") return STATUSES.LATE as ComplianceStatus;
  return STATUSES.UNPAID as ComplianceStatus;
}

export function normalizePaymentStatus(value: string): typeof PAYMENT_STATUSES[number] {
  const v = value?.trim().toLowerCase();
  if (v === "paid") return STATUSES.PAID;
  if (v === "late") return STATUSES.LATE;
  return STATUSES.UNPAID;
}
