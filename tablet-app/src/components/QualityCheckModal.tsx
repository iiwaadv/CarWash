import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { enqueue, flushOutbox, queueJobPatch } from "../lib/sync";
import { jobRef } from "./UpsellModal";

const AREAS: { id: string; label: string }[] = [
  { id: "exterior", label: "الخارجي" },
  { id: "interior", label: "الداخلي" },
  { id: "tires", label: "الإطارات" },
  { id: "finishing", label: "اللمسات النهائية" },
];

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
      alert("تعذر الوصول إلى الميكروفون. يرجى منح الصلاحية اللازمة.");
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

      await queueJobPatch(jobId, { status: "ready" }, token);
      onDone();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-title">🎙️ فحص الجودة والتسليم — {plateNumber}</div>

        <div className="checklist-grid">
          {AREAS.map((a) => (
            <button
              key={a.id}
              className={`checklist-item ${checklist[a.id]}`}
              onClick={() => tapArea(a.id)}
            >
              {a.label}
              <small>
                {checklist[a.id] === "ok" && "سليم — اضغط مرتين لتصحيح ميداني"}
                {checklist[a.id] === "issue" && "يحتاج انتباه"}
                {checklist[a.id] === "corrected" && "✔ تم التصحيح بالمنشفة"}
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
            {recording ? `...جاري التسجيل (${seconds}/15 ثانية)` : audioBlob ? "✔ تم تسجيل تقييم العميل" : "اضغط لتسجيل تقييم العميل الصوتي (15 ثانية)"}
          </div>
        </div>

        <button
          className={`big-btn ${isFurious ? "danger" : "warning"}`}
          style={{ width: "100%", marginBottom: 20 }}
          onClick={pressAngry}
        >
          👎 العميل غاضب — تنبيه فوري للمدير العام
        </button>

        <div className="modal-actions">
          <button className="big-btn secondary" onClick={onClose}>
            إغلاق
          </button>
          <button className="big-btn success" onClick={finish} disabled={submitting}>
            {submitting ? "...جاري الحفظ" : "إنهاء الفحص والتسليم"}
          </button>
        </div>
      </div>
    </div>
  );
}
