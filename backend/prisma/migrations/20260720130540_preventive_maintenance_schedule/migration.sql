-- CreateTable
CREATE TABLE "maintenance_schedules" (
    "schedule_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "branch_id" INTEGER NOT NULL,
    "equipment_name" TEXT NOT NULL,
    "interval_days" INTEGER NOT NULL,
    "notes" TEXT,
    "last_performed_at" DATETIME,
    "next_due_at" DATETIME NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "maintenance_schedules_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches" ("branch_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "maintenance_schedules_branch_id_next_due_at_idx" ON "maintenance_schedules"("branch_id", "next_due_at");
