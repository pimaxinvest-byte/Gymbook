// Harbiz entity types — inferred from DDP inspection (2026-05-31)
// All values from real Harbiz instance; field names are DDP/Mongo keys

export interface HarbizClient {
  _id: string;
  userId?: string;
  profId: string;
  name: string;
  lastname?: string;
  email: string;
  phone?: string;
  birthdate?: string | Date;
  tags?: string[];
  status: "active" | "archived" | "lead" | "guest";
  type?: "presencial" | "online";
  activationDate?: string | Date;
  plan?: string;
  planStatus?: string;
  lastPayment?: string | Date;
  weeklyCompliance?: number;
  monthlyCompliance?: number;
}

export interface HarbizSession {
  _id: string;
  clientId: string;
  profId: string;
  sessionTypeId?: string;
  sessionTypeName?: string;
  startDate: string | Date;
  endDate?: string | Date;
  status?: "scheduled" | "completed" | "cancelled";
  isPresencial?: boolean;
  isOnline?: boolean;
  attended?: boolean;
  cancelled?: boolean;
}

export interface HarbizSessionPack {
  _id: string;
  clientId: string;
  profId: string;
  sessionTypeId?: string;
  sessionTypeName?: string;
  totalSessions: number;
  usedSessions?: number;
  remainingSessions?: number;
  status?: "active" | "expired" | "completed";
  startDate?: string | Date;
  endDate?: string | Date;
  price?: number;
  paymentStatus?: "paid" | "pending";
}

export interface HarbizSessionType {
  _id: string;
  name: string;
  color?: string;
  createdAt?: string | Date;
}

export interface HarbizDiffItem {
  entity: "CLIENT" | "SESSION" | "PACK";
  action: "CREATE" | "UPDATE" | "SKIP";
  harbizId: string;
  gymBookId?: string;
  entityLabel: string; // human-readable, e.g. "[NOMBRE]" or session date
  reason?: string;
}

export interface HarbizSyncOptions {
  teacherId: string;
  dryRun: boolean;
  dateRangeStart?: Date;
  dateRangeEnd?: Date;
}

export interface HarbizSyncResult {
  dryRun: boolean;
  status: "DRY_RUN_OK" | "COMPLETED" | "FAILED";
  clients: {
    found: number;
    toCreate: number;
    toUpdate: number;
    skipped: number;
  };
  sessions: {
    found: number;
    toCreate: number;
    skipped: number;
  };
  packs: {
    found: number;
    toCreate: number;
    toUpdate: number;
  };
  errors: string[];
  diff: HarbizDiffItem[];
  logId?: string;
}

export interface HarbizMappedClient {
  name: string;
  email: string;
  phone: string | null;
  status: "ACTIVE" | "SUSPENDED";
  preferredTeacherId: string;
}

export interface HarbizMappedBooking {
  clientId: string;
  teacherId: string;
  activityId: string;
  startDatetime: Date;
  endDatetime: Date;
  status: "BOOKED" | "COMPLETED" | "CANCELLED";
  sessionType: "INDIVIDUAL";
  capacity: number;
}

export interface HarbizMappedCredits {
  clientId: string;
  teacherId: string;
  creditType: "INDIVIDUAL";
  balance: number;
  totalAssigned: number;
  paymentStatus: "PAID" | "UNPAID";
  notes: string;
}
