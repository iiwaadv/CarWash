-- AlterTable
ALTER TABLE "upselling_logs" ADD COLUMN     "employee_id" INTEGER;

-- AddForeignKey
ALTER TABLE "upselling_logs" ADD CONSTRAINT "upselling_logs_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("employee_id") ON DELETE SET NULL ON UPDATE CASCADE;
