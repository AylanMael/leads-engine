import type { LeadDemenagement } from "./lead";
import type { LeadRenovation } from "./lead-renovation";

export type LocalLead = (LeadDemenagement | LeadRenovation) & {
  id: string;
  createdAt: string;
  status: "pending" | "assigned";
  assignedPartners?: string[];
  assignedAt?: string;
};

export type LocalPartner = {
  id: string;
  companyName: string;
  vertical: "demenagement" | "renovation";
  department: string;
  credits: number;
};
