-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_customer_feedback" (
    "feedback_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "job_id" INTEGER NOT NULL,
    "voice_rec_url" TEXT,
    "is_customer_furious" BOOLEAN NOT NULL DEFAULT false,
    "alert_acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "customer_feedback_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "job_orders" ("job_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_customer_feedback" ("alert_acknowledged", "created_at", "feedback_id", "is_customer_furious", "job_id", "voice_rec_url") SELECT "alert_acknowledged", "created_at", "feedback_id", "is_customer_furious", "job_id", "voice_rec_url" FROM "customer_feedback";
DROP TABLE "customer_feedback";
ALTER TABLE "new_customer_feedback" RENAME TO "customer_feedback";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
