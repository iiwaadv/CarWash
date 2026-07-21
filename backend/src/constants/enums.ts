// Application-level enum definitions.
// SQLite (used for zero-setup local dev) has no native enum type in Prisma,
// so every "enum" column from the PRD schema is stored as TEXT and validated
// here with zod at the API boundary.

export const BRANCH_STATUS = ["open", "closed", "maintenance"] as const;
export const EMPLOYEE_ROLE = ["manager", "supervisor", "washer", "detailer"] as const;
export const CAR_TYPE = ["small", "medium", "large"] as const;
export const JOB_STATUS = [
  "queued",
  "washing",
  "quality_check",
  "ready",
  "delivered",
  "cancelled",
] as const;
export const QUALITY_STAGE = ["pre_wash_photos", "post_wash_checklist"] as const;
export const UPSELL_STATUS = ["accepted", "rejected"] as const;
export const REJECTION_REASON = [
  "too_expensive",
  "in_a_hurry",
  "old_car",
  "loyalty_program",
] as const;
export const INCIDENT_TYPE = ["equipment_breakdown", "customer_car_damage"] as const;
export const INCIDENT_SEVERITY = ["critical_stop", "partial_slow"] as const;
export const INCIDENT_STATUS = ["pending_approval", "approved", "rejected"] as const;
export const CHECKLIST_AREAS = ["exterior", "interior", "tires", "finishing"] as const;

// z.coerce.boolean() treats the *string* "false" as truthy (Boolean("false") === true),
// which breaks multipart/form-data bodies where every field arrives as a string.
// This preprocessor interprets "false"/"0"/"" as false before boolean coercion.
import { z } from "zod";
export const zFormBoolean = z.preprocess((value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value === "true" || value === "1";
  return value;
}, z.boolean());
