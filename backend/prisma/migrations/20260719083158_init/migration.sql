-- CreateTable
CREATE TABLE "branches" (
    "branch_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'closed',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "bays" (
    "bay_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "branch_id" INTEGER NOT NULL,
    "bay_name" TEXT NOT NULL,
    "bay_type" TEXT,
    CONSTRAINT "bays_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches" ("branch_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "employees" (
    "employee_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "branch_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "pin_code" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "employees_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches" ("branch_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "bay_crew_assignments" (
    "assignment_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "bay_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "shift_date" DATETIME NOT NULL,
    CONSTRAINT "bay_crew_assignments_bay_id_fkey" FOREIGN KEY ("bay_id") REFERENCES "bays" ("bay_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "bay_crew_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees" ("employee_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "services" (
    "service_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "service_name" TEXT NOT NULL,
    "base_price" REAL NOT NULL,
    "suggested_trigger" TEXT
);

-- CreateTable
CREATE TABLE "job_orders" (
    "job_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "branch_id" INTEGER NOT NULL,
    "bay_id" INTEGER,
    "pos_invoice_no" TEXT,
    "plate_number" TEXT NOT NULL,
    "customer_phone" TEXT,
    "car_type" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "is_highly_dirty" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "delivered_at" DATETIME,
    "client_uuid" TEXT,
    CONSTRAINT "job_orders_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches" ("branch_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "job_orders_bay_id_fkey" FOREIGN KEY ("bay_id") REFERENCES "bays" ("bay_id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "quality_logs" (
    "quality_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "job_id" INTEGER NOT NULL,
    "stage" TEXT NOT NULL,
    "scratches_notes" TEXT,
    "photos_json" TEXT,
    "checklist_results" TEXT,
    "touch_up_needed" BOOLEAN NOT NULL DEFAULT false,
    "touch_up_at" DATETIME,
    "inspector_id" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "quality_logs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "job_orders" ("job_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "quality_logs_inspector_id_fkey" FOREIGN KEY ("inspector_id") REFERENCES "employees" ("employee_id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "upselling_logs" (
    "upsell_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "job_id" INTEGER NOT NULL,
    "service_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "rejection_reason" TEXT,
    "extra_invoice_no" TEXT,
    "bonus_amount" REAL NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "upselling_logs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "job_orders" ("job_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "upselling_logs_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services" ("service_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "customer_feedback" (
    "feedback_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "job_id" INTEGER NOT NULL,
    "voice_rec_url" TEXT NOT NULL,
    "is_customer_furious" BOOLEAN NOT NULL DEFAULT false,
    "alert_acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "customer_feedback_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "job_orders" ("job_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "shift_inventory_reports" (
    "report_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "branch_id" INTEGER NOT NULL,
    "supervisor_id" INTEGER NOT NULL,
    "shift_date" DATETIME NOT NULL,
    "chemicals_remaining_json" TEXT,
    "towels_received_start" INTEGER NOT NULL,
    "towels_collected_end" INTEGER NOT NULL,
    "storage_room_photos_json" TEXT,
    "yard_photos_json" TEXT,
    "upsell_target_pct" REAL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shift_inventory_reports_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches" ("branch_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "shift_inventory_reports_supervisor_id_fkey" FOREIGN KEY ("supervisor_id") REFERENCES "employees" ("employee_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cleanliness_checks" (
    "check_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "branch_id" INTEGER NOT NULL,
    "supervisor_id" INTEGER NOT NULL,
    "photos_json" TEXT,
    "due_at" DATETIME NOT NULL,
    "completed_at" DATETIME,
    "was_locked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cleanliness_checks_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches" ("branch_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "maintenance_and_incidents" (
    "incident_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "branch_id" INTEGER NOT NULL,
    "reported_by_id" INTEGER,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT,
    "photos_json" TEXT,
    "compensation_paid" REAL NOT NULL DEFAULT 0,
    "proposed_deduction" REAL NOT NULL DEFAULT 0,
    "repair_cost" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending_approval',
    "resolved_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "maintenance_and_incidents_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches" ("branch_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "job_orders_branch_id_status_idx" ON "job_orders"("branch_id", "status");
