export type ClaimStatus = "New" | "In Progress" | "In Repair" | "Settled";
export type Priority = "high" | "medium" | "low";
export type DocStatus = "pending" | "received" | "auto_verified" | "not_required";
export type EmailDirection = "sent" | "received";
export type MessageRole = "user" | "assistant";
export type MessageFormat = "text" | "photo" | "doc_upload";

export interface Claim {
  id: string;
  vehicle: string;
  registration: string;
  incident: string;
  insurer: string;
  policy_number: string;
  estimated_amount: number;
  settled_amount: number | null;
  status: ClaimStatus;
  priority: Priority;
  claimant_name: string;
  claimant_phone: string;
  loan_account: string;
  loan_outstanding: number;
  emi_status: string;
  filed_date: string;
  incident_date: string;
  location: string;
  fir_required: boolean;
  fir_number: string | null;
  surveyor: string | null;
  surveyor_status: string | null;
  surveyor_date: string | null;
  repair_shop: string | null;
  repair_status: string | null;
  integrations: Record<string, string>;
  documents: Document[];
  emails: Email[];
  timeline: TimelineEvent[];
}

export interface Document {
  id: string;
  name: string;
  status: DocStatus;
  received_date: string | null;
}

export interface Email {
  id: string;
  direction: EmailDirection;
  type: string;
  subject: string;
  from: string;
  to: string;
  body: string;
  timestamp: string;
}

export interface TimelineEvent {
  id: string;
  type: string;
  description: string;
  claim_id: string;
  timestamp: string;
}

export interface ConversationMessage {
  role: MessageRole;
  format: MessageFormat;
  content: string;
  images?: string[];
  timestamp: string;
}

export interface AgentDecision {
  type: string;
  action: string;
  claim_id: string;
  timestamp: string;
}
