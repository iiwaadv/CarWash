import cors from "cors";
import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import path from "path";

import authRoutes from "./routes/auth.routes";
import baysRoutes from "./routes/bays.routes";
import branchesRoutes from "./routes/branches.routes";
import cleanlinessRoutes from "./routes/cleanliness.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import employeesRoutes from "./routes/employees.routes";
import feedbackRoutes from "./routes/feedback.routes";
import jobOrdersRoutes from "./routes/jobOrders.routes";
import maintenanceRoutes from "./routes/maintenance.routes";
import maintenanceSchedulesRoutes from "./routes/maintenanceSchedules.routes";
import qualityLogsRoutes from "./routes/qualityLogs.routes";
import servicesRoutes from "./routes/services.routes";
import shiftInventoryRoutes from "./routes/shiftInventory.routes";
import upsellingRoutes from "./routes/upselling.routes";

const app = express();
const PORT = Number(process.env.PORT ?? 4000);
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? (process.env.VERCEL ? "/tmp/uploads" : "./uploads");

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.resolve(UPLOAD_DIR)));

app.get("/api/health", (_req, res) => res.json({ status: "ok", service: "COE backend" }));

app.use("/api/auth", authRoutes);
app.use("/api/branches", branchesRoutes);
app.use("/api/bays", baysRoutes);
app.use("/api/employees", employeesRoutes);
app.use("/api/services", servicesRoutes);
app.use("/api/job-orders", jobOrdersRoutes);
app.use("/api/quality-logs", qualityLogsRoutes);
app.use("/api/upselling", upsellingRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/shift-inventory", shiftInventoryRoutes);
app.use("/api/cleanliness", cleanlinessRoutes);
app.use("/api/maintenance", maintenanceRoutes);
app.use("/api/maintenance-schedules", maintenanceSchedulesRoutes);
app.use("/api/dashboard", dashboardRoutes);

app.use((req, res) => {
  res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(err?.status ?? 500).json({ error: err?.message ?? "Internal server error" });
});

// On Vercel the app is invoked as a serverless function (see api/index.ts)
// and must not bind to a port itself; everywhere else (local dev, other
// hosts) it runs as a normal long-lived HTTP server.
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚗 CarWash Ops Engine API running on http://localhost:${PORT}`);
  });
}

export default app;
