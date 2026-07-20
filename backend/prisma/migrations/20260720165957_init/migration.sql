-- CreateTable
CREATE TABLE "branches" (
    "branch_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'closed',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("branch_id")
);

-- CreateTable
CREATE TABLE "bays" (
    "bay_id" SERIAL NOT NULL,
    "branch_id" INTEGER NOT NULL,
    "bay_name" TEXT NOT NULL,
    "bay_type" TEXT,

    CONSTRAINT "bays_pkey" PRIMARY KEY ("bay_id")
);

-- CreateTable
CREATE TABLE "employees" (
    "employee_id" SERIAL NOT NULL,
    "branch_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "pin_code" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("employee_id")
);

-- CreateTable
CREATE TABLE "bay_crew_assignments" (
    "assignment_id" SERIAL NOT NULL,
    "bay_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "shift_date" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bay_crew_assignments_pkey" PRIMARY KEY ("assignment_id")
);

-- CreateTable
CREATE TABLE "services" (
    "service_id" SERIAL NOT NULL,
    "service_name" TEXT NOT NULL,
    "base_price" DOUBLE PRECISION NOT NULL,
    "suggested_trigger" TEXT,

    CONSTRAINT "services_pkey" PRIMARY KEY ("service_id")
);

-- CreateTable
CREATE TABLE "job_orders" (
    "job_id" SERIAL NOT NULL,
    "branch_id" INTEGER NOT NULL,
    "bay_id" INTEGER,
    "pos_invoice_no" TEXT,
    "plate_number" TEXT NOT NULL,
    "customer_phone" TEXT,
    "car_type" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "is_highly_dirty" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "delivered_at" TIMESTAMP(3),
    "client_uuid" TEXT,

    CONSTRAINT "job_orders_pkey" PRIMARY KEY ("job_id")
);

-- CreateTable
CREATE TABLE "quality_logs" (
    "quality_id" SERIAL NOT NULL,
    "job_id" INTEGER NOT NULL,
    "stage" TEXT NOT NULL,
    "scratches_notes" TEXT,
    "photos_json" TEXT,
    "checklist_results" TEXT,
    "touch_up_needed" BOOLEAN NOT NULL DEFAULT false,
    "touch_up_at" TIMESTAMP(3),
    "inspector_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quality_logs_pkey" PRIMARY KEY ("quality_id")
);

-- CreateTable
CREATE TABLE "upselling_logs" (
    "upsell_id" SERIAL NOT NULL,
    "job_id" INTEGER NOT NULL,
    "service_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "rejection_reason" TEXT,
    "extra_invoice_no" TEXT,
    "bonus_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "upselling_logs_pkey" PRIMARY KEY ("upsell_id")
);

-- CreateTable
CREATE TABLE "customer_feedback" (
    "feedback_id" SERIAL NOT NULL,
    "job_id" INTEGER NOT NULL,
    "voice_rec_url" TEXT,
    "is_customer_furious" BOOLEAN NOT NULL DEFAULT false,
    "alert_acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_feedback_pkey" PRIMARY KEY ("feedback_id")
);

-- CreateTable
CREATE TABLE "shift_inventory_reports" (
    "report_id" SERIAL NOT NULL,
    "branch_id" INTEGER NOT NULL,
    "supervisor_id" INTEGER NOT NULL,
    "shift_date" TIMESTAMP(3) NOT NULL,
    "chemicals_remaining_json" TEXT,
    "towels_received_start" INTEGER NOT NULL,
    "towels_collected_end" INTEGER NOT NULL,
    "storage_room_photos_json" TEXT,
    "yard_photos_json" TEXT,
    "upsell_target_pct" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shift_inventory_reports_pkey" PRIMARY KEY ("report_id")
);

-- CreateTable
CREATE TABLE "cleanliness_checks" (
    "check_id" SERIAL NOT NULL,
    "branch_id" INTEGER NOT NULL,
    "supervisor_id" INTEGER NOT NULL,
    "photos_json" TEXT,
    "due_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "was_locked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cleanliness_checks_pkey" PRIMARY KEY ("check_id")
);

-- CreateTable
CREATE TABLE "maintenance_schedules" (
    "schedule_id" SERIAL NOT NULL,
    "branch_id" INTEGER NOT NULL,
    "equipment_name" TEXT NOT NULL,
    "interval_days" INTEGER NOT NULL,
    "notes" TEXT,
    "last_performed_at" TIMESTAMP(3),
    "next_due_at" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenance_schedules_pkey" PRIMARY KEY ("schedule_id")
);

-- CreateTable
CREATE TABLE "maintenance_and_incidents" (
    "incident_id" SERIAL NOT NULL,
    "branch_id" INTEGER NOT NULL,
    "reported_by_id" INTEGER,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT,
    "photos_json" TEXT,
    "compensation_paid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "proposed_deduction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "repair_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending_approval',
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenance_and_incidents_pkey" PRIMARY KEY ("incident_id")
);

-- CreateIndex
CREATE INDEX "job_orders_branch_id_status_idx" ON "job_orders"("branch_id", "status");

-- CreateIndex
CREATE INDEX "maintenance_schedules_branch_id_next_due_at_idx" ON "maintenance_schedules"("branch_id", "next_due_at");

-- AddForeignKey
ALTER TABLE "bays" ADD CONSTRAINT "bays_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("branch_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("branch_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bay_crew_assignments" ADD CONSTRAINT "bay_crew_assignments_bay_id_fkey" FOREIGN KEY ("bay_id") REFERENCES "bays"("bay_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bay_crew_assignments" ADD CONSTRAINT "bay_crew_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("employee_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_orders" ADD CONSTRAINT "job_orders_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("branch_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_orders" ADD CONSTRAINT "job_orders_bay_id_fkey" FOREIGN KEY ("bay_id") REFERENCES "bays"("bay_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_logs" ADD CONSTRAINT "quality_logs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "job_orders"("job_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_logs" ADD CONSTRAINT "quality_logs_inspector_id_fkey" FOREIGN KEY ("inspector_id") REFERENCES "employees"("employee_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upselling_logs" ADD CONSTRAINT "upselling_logs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "job_orders"("job_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upselling_logs" ADD CONSTRAINT "upselling_logs_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("service_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_feedback" ADD CONSTRAINT "customer_feedback_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "job_orders"("job_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_inventory_reports" ADD CONSTRAINT "shift_inventory_reports_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("branch_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_inventory_reports" ADD CONSTRAINT "shift_inventory_reports_supervisor_id_fkey" FOREIGN KEY ("supervisor_id") REFERENCES "employees"("employee_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleanliness_checks" ADD CONSTRAINT "cleanliness_checks_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("branch_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_schedules" ADD CONSTRAINT "maintenance_schedules_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("branch_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_and_incidents" ADD CONSTRAINT "maintenance_and_incidents_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("branch_id") ON DELETE RESTRICT ON UPDATE CASCADE;
