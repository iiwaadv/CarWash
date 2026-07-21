-- AlterTable
ALTER TABLE "maintenance_and_incidents" ADD COLUMN     "bay_id" INTEGER,
ADD COLUMN     "breakdown_type" TEXT,
ADD COLUMN     "completed_at" TIMESTAMP(3),
ADD COLUMN     "cost_pending" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "equipment_id" INTEGER,
ADD COLUMN     "received_at" TIMESTAMP(3),
ADD COLUMN     "received_by_id" INTEGER,
ADD COLUMN     "started_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "bay_equipment" (
    "equipment_id" SERIAL NOT NULL,
    "bay_id" INTEGER NOT NULL,
    "equipment_name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bay_equipment_pkey" PRIMARY KEY ("equipment_id")
);

-- AddForeignKey
ALTER TABLE "bay_equipment" ADD CONSTRAINT "bay_equipment_bay_id_fkey" FOREIGN KEY ("bay_id") REFERENCES "bays"("bay_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_and_incidents" ADD CONSTRAINT "maintenance_and_incidents_bay_id_fkey" FOREIGN KEY ("bay_id") REFERENCES "bays"("bay_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_and_incidents" ADD CONSTRAINT "maintenance_and_incidents_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "bay_equipment"("equipment_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_and_incidents" ADD CONSTRAINT "maintenance_and_incidents_received_by_id_fkey" FOREIGN KEY ("received_by_id") REFERENCES "employees"("employee_id") ON DELETE SET NULL ON UPDATE CASCADE;
