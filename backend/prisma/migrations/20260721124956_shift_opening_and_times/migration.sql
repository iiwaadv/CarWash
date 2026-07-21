-- AlterTable
ALTER TABLE "branches" ADD COLUMN     "shift_close_time" TEXT NOT NULL DEFAULT '23:00',
ADD COLUMN     "shift_open_time" TEXT NOT NULL DEFAULT '06:00';

-- CreateTable
CREATE TABLE "shift_openings" (
    "opening_id" SERIAL NOT NULL,
    "branch_id" INTEGER NOT NULL,
    "supervisor_id" INTEGER NOT NULL,
    "shift_date" TIMESTAMP(3) NOT NULL,
    "towels_received" INTEGER NOT NULL,
    "chemicals_json" TEXT,
    "other_items_json" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shift_openings_pkey" PRIMARY KEY ("opening_id")
);

-- CreateIndex
CREATE INDEX "shift_openings_branch_id_shift_date_idx" ON "shift_openings"("branch_id", "shift_date");

-- AddForeignKey
ALTER TABLE "shift_openings" ADD CONSTRAINT "shift_openings_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("branch_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_openings" ADD CONSTRAINT "shift_openings_supervisor_id_fkey" FOREIGN KEY ("supervisor_id") REFERENCES "employees"("employee_id") ON DELETE RESTRICT ON UPDATE CASCADE;
