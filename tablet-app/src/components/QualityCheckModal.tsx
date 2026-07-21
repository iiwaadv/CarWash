import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { enqueue, flushOutbox, queueJobPatch } from "../lib/sync";
import { jobRef } from "./UpsellModal";

type AreaStatus = "ok" | "issue" | "corrected";

export default function QualityCheckModal({
  jobId,
  plateNumber,
  onDone,
  onClose,
}: {
  jobId: number | string;
  plateNumber: string;
  onDone: () => void;
  onClose: () => void;
}) {
  const { token } = useAuth();
  const { t } = useTranslation();
  const [checklist, setChecklist] = useState<Record<string, AreaStatus>>({
    exterior: "ok",
    interior: "ok",
    tires: "ok",
    finishing: "ok",
  });
  const [isFurious, setIsFurious] = useState(false);
  const [furiousSent, setFuriousSent] = useState(false);
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const AREAS = [
    { id: "exterior", label: t("quality.areas.exterior") },
    { id: "interior", label: t("quality.areas.interior") },
    { id: "tires", label: t("quality.areas.tires") },
    { id: "finishing", label: t("quality.areas.finishing") },
  ];

  const lastTap = useRef<Record<string, number>>({});
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  function tapArea(area: string) {
    const now = Date.now();
    const isDouble = now - (lastTap.current[area] ?? 0) < 320;
    lastTap.current[area] = now;

    setChecklist((prev) => {
      if (isDouble) return { ...prev, [area]: "corrected" };
      const current = prev[area];
      return { ...prev, [area]: current === "ok" ? "issue" : "ok" };
    });
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks.current = [];
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => chunks.current.push(e.data);
      rec.onstop = () => {
        setAudioBlob(new Blob(chunks.current, { type: "audio/webm" }));
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorder.current = rec;
      rec.start();
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= 15) stopRecording();
          return s + 1;
        });
      }, 1000);
    } catch {
      alert(t("quality.micError"));
    }
  }

  function stopRecording() {
    mediaRecorder.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  async function sendFeedback(furious: boolean) {
    await enqueue({
      kind: "feedback",
      url: "/api/feedback",
      method: "POST",
      fields: { jobId: jobRef(jobId), isCustomerFurious: furious },
      fileFields: audioBlob ? { audio: [{ blob: audioBlob, filename: "feedback.webm" }] } : undefined,
    });
    if (navigator.onLine) void flushOutbox(token);
  }

  async function pressAngry() {
    setIsFurious(true);
    if (!furiousSent) {
      setFuriousSent(true);
      await sendFeedback(true);
    }
  }

  async function finish() {
    setSubmitting(true);
    try {
      await enqueue({
        kind: "quality-post-wash",
        url: "/api/quality-logs",
        method: "POST",
        fields: {
          jobId: jobRef(jobId),
          checklistResults: JSON.stringify(
            Object.fromEntries(Object.entries(checklist).map(([k, v]) => [k, { status: v }]))
          ),
        },
      });

      if (audioBlob && !furiousSent) {
        await sendFeedback(isFurious);
      }

      // Finishing the quality check now hands the car straight to the customer:
      // no intermediate "ready" waiting step, so there's no delay or extra tap.
      await queueJobPatch(jobId, { status: "delivered" }, token);
      onDone();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-title">{t("quality.title", { plate: plateNumber })}</div>

        <div className="checklist-grid">
          {AREAS.map((a) => (
            <button
              key={a.id}
              className={`checklist-item ${checklist[a.id]}`}
              onClick={() => tapArea(a.id)}
            >
              {a.label}
              <small>
                {checklist[a.id] === "ok" && t("quality.statusOk")}
                {checklist[a.id] === "issue" && t("quality.statusIssue")}
                {checklist[a.id] === "corrected" && t("quality.statusCorrected")}
              </small>
            </button>
          ))}
        </div>

        <div className="center-col" style={{ marginBottom: 20 }}>
          <button
            className={`mic-button ${recording ? "recording" : ""}`}
            onClick={recording ? stopRecording : startRecording}
          >
            🎙️
          </button>
          <div style={{ color: "var(--muted)" }}>
            {recording
              ? t("quality.micRecording", { s: seconds })
              : audioBlob
              ? t("quality.micDone")
              : t("quality.micHint")}
          </div>
        </div>

        <button
          className={`big-btn ${isFurious ? "danger" : "warning"}`}
          style={{ width: "100%", marginBottom: 20 }}
          onClick={pressAngry}
        >
          {t("quality.angryBtn")}
        </button>

        <div className="modal-actions">
          <button className="big-btn secondary" onClick={onClose}>
            {t("common.close")}
          </button>
          <button className="big-btn success" onClick={finish} disabled={submitting}>
            {submitting ? t("common.saving") : t("quality.finishBtn")}
          </button>
        </div>
      </div>
    </div>
  );
}
