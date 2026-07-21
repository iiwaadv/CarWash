-- AlterTable
ALTER TABLE "services" ADD COLUMN     "linked_product_ids_json" TEXT,
ADD COLUMN     "quantity" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "target_branch_ids_json" TEXT;
