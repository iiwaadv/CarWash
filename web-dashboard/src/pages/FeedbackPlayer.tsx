import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { apiFetch, API_BASE } from "../lib/api";

interface Feedback {
  id: number;
  voiceRecUrl: string | null;
  isCustomerFurious: boolean;
  alertAcknowledged: boolean;
  createdAt: string;
  job: { plateNumber: string; branchId: number; bay?: { bayName: string } | null };
}

export default function FeedbackPlayer() {
  const { token } = useAuth();
  const { t, i18n } = useTranslation();
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [furiousOnly, setFuriousOnly] = useState(false);

  async function load() {
    const data = await apiFetch(`/api/feedback${furiousOnly ? "?furious=true" : ""}`, token);
    setFeedback(data);
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, furiousOnly]);

  async function acknowledge(id: number) {
    await apiFetch(`/api/feedback/${id}/acknowledge`, token, { method: "POST" });
    setFeedback((prev) => prev.map((f) => (f.id === id ? { ...f, alertAcknowledged: true } : f)));
  }

  const locale = i18n.language === "ar" ? "ar-SA" : "en-US";

  return (
    <div>
      <div className="page-title">{t("feedback.title")}</div>
      <div className="section-card">
        <div className="form-row">
          <button
            className={`btn ${furiousOnly ? "danger" : "secondary"}`}
            onClick={() => setFuriousOnly((v) => !v)}
          >
            {furiousOnly ? t("feedback.showFuriousOnly") : t("feedback.showAll")}
          </button>
        </div>

        {feedback.length === 0 && <div className="empty-state">{t("feedback.empty")}</div>}

        {feedback.map((f) => (
          <div className={`feedback-item ${f.isCustomerFurious && !f.alertAcknowledged ? "furious" : ""}`} key={f.id}>
            <div style={{ minWidth: 120 }}>
              <div style={{ fontWeight: 700 }}>{f.job.plateNumber}</div>
              <div style={{ color: "var(--muted)", fontSize: 12 }}>
                {new Date(f.createdAt).toLocaleString(locale)}
              </div>
            </div>

            {f.voiceRecUrl ? (
              <audio controls src={`${API_BASE}${f.voiceRecUrl}`} style={{ flex: 1 }} />
            ) : (
              <div style={{ color: "var(--muted)", flex: 1 }}>{t("feedback.noRecording")}</div>
            )}

            {f.isCustomerFurious && (
              <span className="alert-badge">
                {t("feedback.furious")}
                {f.alertAcknowledged ? t("feedback.acknowledged") : ""}
              </span>
            )}
            {f.isCustomerFurious && !f.alertAcknowledged && (
              <button className="btn secondary" onClick={() => acknowledge(f.id)}>
                {t("feedback.acknowledgeBtn")}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
