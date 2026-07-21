-- AlterTable
ALTER TABLE "bay_equipment" ADD COLUMN IF NOT EXISTS "serial_number" TEXT;
ALTER TABLE "bay_equipment" ADD COLUMN IF NOT EXISTS "installed_at" TIMESTAMP(3);
ALTER TABLE "bay_equipment" ADD COLUMN IF NOT EXISTS "warranty_until" TIMESTAMP(3);
ALTER TABLE "bay_equipment" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "bay_equipment" ADD COLUMN IF NOT EXISTS "photos_json" TEXT;

-- AlterTable
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "job_title" TEXT;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "managed_branch_ids_json" TEXT;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "permissions_json" TEXT;

-- AlterTable
ALTER TABLE "job_orders" ADD COLUMN IF NOT EXISTS "washing_started_at" TIMESTAMP(3);
ALTER TABLE "job_orders" ADD COLUMN IF NOT EXISTS "ready_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "maintenance_and_incidents" ADD COLUMN IF NOT EXISTS "spare_part_name" TEXT;
ALTER TABLE "maintenance_and_incidents" ADD COLUMN IF NOT EXISTS "spare_part_sku" TEXT;
ALTER TABLE "maintenance_and_incidents" ADD COLUMN IF NOT EXISTS "spare_part_supplier" TEXT;
ALTER TABLE "maintenance_and_incidents" ADD COLUMN IF NOT EXISTS "spare_part_cost" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "maintenance_and_incidents" ADD COLUMN IF NOT EXISTS "labor_cost" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "maintenance_and_incidents" ADD COLUMN IF NOT EXISTS "warranty_months" INTEGER;
ALTER TABLE "maintenance_and_incidents" ADD COLUMN IF NOT EXISTS "warranty_photo_url" TEXT;
ALTER TABLE "maintenance_and_incidents" ADD COLUMN IF NOT EXISTS "invoice_url" TEXT;
ALTER TABLE "maintenance_and_incidents" ADD COLUMN IF NOT EXISTS "work_notes" TEXT;
ALTER TABLE "maintenance_and_incidents" ADD COLUMN IF NOT EXISTS "decision_reason" TEXT;
ALTER TABLE "maintenance_and_incidents" ADD COLUMN IF NOT EXISTS "decision_at" TIMESTAMP(3);
ALTER TABLE "maintenance_and_incidents" ADD COLUMN IF NOT EXISTS "decided_by_id" INTEGER;

-- AlterTable
ALTER TABLE "sales_targets" ADD COLUMN IF NOT EXISTS "service_id" INTEGER;
ALTER TABLE "sales_targets" ADD COLUMN IF NOT EXISTS "target_qty" INTEGER;

-- AlterTable
ALTER TABLE "inventory_items" ADD COLUMN IF NOT EXISTS "min_qty" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "inventory_items" ADD COLUMN IF NOT EXISTS "supplier" TEXT;
ALTER TABLE "inventory_items" ADD COLUMN IF NOT EXISTS "purchase_price" DOUBLE PRECISION;
ALTER TABLE "inventory_items" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "inventory_items" ADD COLUMN IF NOT EXISTS "sku" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "audit_logs" (
    "audit_id" SERIAL NOT NULL,
    "actor_id" INTEGER,
    "actor_name" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "before_json" TEXT,
    "after_json" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("audit_id")
);

CREATE INDEX IF NOT EXISTS "audit_logs_entity_type_created_at_idx" ON "audit_logs"("entity_type", "created_at");

DO $$ BEGIN
  ALTER TABLE "maintenance_and_incidents" ADD CONSTRAINT "maintenance_and_incidents_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "employees"("employee_id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "sales_targets" ADD CONSTRAINT "sales_targets_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("service_id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "employees"("employee_id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
