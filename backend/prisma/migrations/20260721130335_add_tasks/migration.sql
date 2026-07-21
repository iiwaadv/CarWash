-- CreateTable
CREATE TABLE "tasks" (
    "task_id" SERIAL NOT NULL,
    "branch_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assigned_to_id" INTEGER,
    "created_by_id" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'new',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "due_at" TIMESTAMP(3),
    "acknowledged_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("task_id")
);

-- CreateIndex
CREATE INDEX "tasks_branch_id_status_idx" ON "tasks"("branch_id", "status");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("branch_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "employees"("employee_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "employees"("employee_id") ON DELETE SET NULL ON UPDATE CASCADE;
