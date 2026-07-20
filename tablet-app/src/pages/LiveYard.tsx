import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import CleanlinessGate from "../components/CleanlinessGate";
import NewCarModal from "../components/NewCarModal";
import QualityCheckModal from "../components/QualityCheckModal";
import UpsellModal from "../components/UpsellModal";
import { useAuth } from "../context/AuthContext";
import { useSync } from "../context/SyncContext";
import { apiFetch } from "../lib/api";
import { db } from "../lib/db";
import { queueJobPatch } from "../lib/sync";

interface Job {
  id: number | string;
  plateNumber: string;
  carType?: string;
  bayId?: number | null;
  bay?: { bayName: string } | null;
  status: string;
  isHighlyDirty?: boolean;
  createdAt: string;
  pendingSync?: boolean;
}

const CACHE_KEY = "coe_jobs_cache";

function getGreetingKey(date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "topbar.greetingMorning";
  if (hour >= 12 && hour < 17) return "topbar.greetingAfternoon";
  if (hour >= 17 && hour < 20) return "topbar.greetingEvening";
  return "topbar.greetingNight";
}

export default function LiveYard() {
  const { token, branchId, employee } = useAuth();
  const sync = useSync();
  const { t, i18n } = useTranslation();
  const [jobs, setJobs] = useState<Job[]>(JSON.parse(localStorage.getItem(CACHE_KEY) ?? "[]"));
  const [showNewCar, setShowNewCar] = useState(false);
  const [upsellFor, setUpsellFor] = useState<Job | null>(null);
  const [qualityFor, setQualityFor] = useState<Job | null>(null);

  async function refresh() {
    if (!token || !branchId) return;
    let serverJobs: Job[] = [];
    try {
      serverJobs = await apiFetch(`/api/job-orders?branchId=${branchId}`, token);
    } catch {
      serverJobs = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "[]").filter((j: Job) => typeof j.id === "number");
    }

    const serverUuids = new Set(serverJobs.map((j: any) => j.clientUuid).filter(Boolean));
    const pendingLocal = await db.cachedJobs
      .where("branchId")
      .equals(branchId)
      .toArray();
    const pendingOnly = pendingLocal
      .filter((p) => !p.serverId && !serverUuids.has(p.localId))
      .map((p) => ({ ...p.data, id: p.localId, pendingSync: true }));

    const merged = [...serverJobs, ...pendingOnly];
    setJobs(merged);
    localStorage.setItem(CACHE_KEY, JSON.stringify(merged));
  }

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 8000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, branchId, sync.pendingCount]);

  const active = jobs.filter((j) => j.status !== "delivered");
  const columns: { key: string; title: string; jobs: Job[] }[] = [
    { key: "queued", title: t("yard.columnQueued"), jobs: active.filter((j) => j.status === "queued") },
    { key: "washing", title: t("yard.columnWashing"), jobs: active.filter((j) => j.status === "washing") },
    {
      key: "quality",
      title: t("yard.columnQuality"),
      jobs: active.filter((j) => j.status === "quality_check" || j.status === "ready"),
    },
  ];

  async function startWashing(job: Job) {
    await queueJobPatch(job.id, { status: "washing" }, token);
    setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: "washing" } : j)));
  }

  async function deliverCar(job: Job) {
    await queueJobPatch(job.id, { status: "delivered" }, token);
    setJobs((prev) => prev.filter((j) => j.id !== job.id));
  }

  const remaining = active.filter((j) => j.status !== "delivered").length;
  const locale = i18n.language === "ar" ? "ar-SA" : "en-US";

  return (
    <div className="page" style={{ padding: 0, display: "flex", flexDirection: "column" }}>
      <div className="yard-summary">
        {t(getGreetingKey())} — {employee?.name}
        {i18n.language === "ar" ? "، " : ", "}
        {t("yard.remainingCars", { count: remaining })}
      </div>
      <div className="yard-board">
        {columns.map((col) => (
          <div className="yard-column" key={col.key}>
            <div className="yard-column-header">
              <span>{col.title}</span>
              <span style={{ color: "var(--muted)" }}>{col.jobs.length}</span>
            </div>
            <div className="yard-column-body">
              {col.jobs.map((job) => (
                <div className="car-card" key={String(job.id)}>
                  <div className="plate">{job.plateNumber}</div>
                  <div className="meta">
                    <span>{job.bay?.bayName ?? (job.bayId ? t("yard.bayNumber", { n: job.bayId }) : t("yard.noBay"))}</span>
                    <span>{new Date(job.createdAt).toLocaleTimeString(locale)}</span>
                  </div>
                  <div className="badges">
                    {job.carType && <span className="badge">{job.carType}</span>}
                    {job.isHighlyDirty && <span className="badge dirty">{t("yard.dirtyBadge")}</span>}
                    {job.pendingSync && <span className="badge pending-sync">{t("yard.pendingSyncBadge")}</span>}
                  </div>

                  {col.key === "queued" && (
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <button className="big-btn secondary" style={{ padding: "10px 14px", fontSize: 14 }} onClick={() => setUpsellFor(job)}>
                        {t("yard.upsellBtn")}
                      </button>
                      <button className="big-btn success" style={{ padding: "10px 14px", fontSize: 14 }} onClick={() => startWashing(job)}>
                        {t("yard.startWashingBtn")}
                      </button>
                    </div>
                  )}

                  {col.key === "washing" && (
                    <button
                      className="big-btn"
                      style={{ padding: "10px 14px", fontSize: 14, marginTop: 8 }}
                      onClick={() => setQualityFor(job)}
                    >
                      {t("yard.qualityCheckBtn")}
                    </button>
                  )}

                  {col.key === "quality" && job.status === "ready" && (
                    <button
                      className="big-btn success"
                      style={{ padding: "10px 14px", fontSize: 14, marginTop: 8 }}
                      onClick={() => deliverCar(job)}
                    >
                      {t("yard.deliverBtn")}
                    </button>
                  )}
                  {col.key === "quality" && job.status === "quality_check" && (
                    <div style={{ color: "var(--muted)", fontSize: 13 }}>{t("yard.checkingInProgress")}</div>
                  )}
                </div>
              ))}
              {col.jobs.length === 0 && <div style={{ color: "var(--muted)", textAlign: "center", marginTop: 20 }}>{t("yard.noCars")}</div>}
            </div>
          </div>
        ))}
      </div>

      <button className="fab" onClick={() => setShowNewCar(true)}>
        +
      </button>

      {showNewCar && (
        <NewCarModal
          onClose={() => setShowNewCar(false)}
          onCreated={(job) => {
            setShowNewCar(false);
            setJobs((prev) => [job, ...prev]);
            setUpsellFor(job);
          }}
        />
      )}

      {upsellFor && (
        <UpsellModal
          jobId={upsellFor.id}
          carType={upsellFor.carType}
          onDone={() => {
            const job = upsellFor;
            setUpsellFor(null);
            if (job.status === "queued") void startWashing(job);
          }}
        />
      )}

      {qualityFor && (
        <QualityCheckModal
          jobId={qualityFor.id}
          plateNumber={qualityFor.plateNumber}
          onClose={() => setQualityFor(null)}
          onDone={() => {
            setJobs((prev) => prev.map((j) => (j.id === qualityFor.id ? { ...j, status: "ready" } : j)));
            setQualityFor(null);
          }}
        />
      )}

      {employee?.role === "supervisor" && <CleanlinessGate />}
    </div>
  );
}
