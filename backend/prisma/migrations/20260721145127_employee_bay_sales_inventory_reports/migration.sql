-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "default_bay_id" INTEGER;

-- CreateTable
CREATE TABLE "sales_targets" (
    "target_id" SERIAL NOT NULL,
    "branch_id" INTEGER NOT NULL,
    "period" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_targets_pkey" PRIMARY KEY ("target_id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "item_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'liter',
    "warehouse_qty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("item_id")
);

-- CreateTable
CREATE TABLE "branch_inventory_balances" (
    "balance_id" SERIAL NOT NULL,
    "item_id" INTEGER NOT NULL,
    "branch_id" INTEGER NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "branch_inventory_balances_pkey" PRIMARY KEY ("balance_id")
);

-- CreateTable
CREATE TABLE "inventory_movements" (
    "movement_id" SERIAL NOT NULL,
    "item_id" INTEGER NOT NULL,
    "branch_id" INTEGER,
    "type" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "recipient_name" TEXT,
    "notes" TEXT,
    "created_by_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("movement_id")
);

-- CreateIndex
CREATE INDEX "sales_targets_branch_id_period_is_active_idx" ON "sales_targets"("branch_id", "period", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "branch_inventory_balances_item_id_branch_id_key" ON "branch_inventory_balances"("item_id", "branch_id");

-- CreateIndex
CREATE INDEX "inventory_movements_item_id_created_at_idx" ON "inventory_movements"("item_id", "created_at");

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_default_bay_id_fkey" FOREIGN KEY ("default_bay_id") REFERENCES "bays"("bay_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_targets" ADD CONSTRAINT "sales_targets_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("branch_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_inventory_balances" ADD CONSTRAINT "branch_inventory_balances_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_inventory_balances" ADD CONSTRAINT "branch_inventory_balances_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("branch_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("branch_id") ON DELETE SET NULL ON UPDATE CASCADE;
