import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { watermarkImage } from "../lib/watermark";

interface Slot {
  previewUrl: string;
  blob: Blob;
}

interface Props {
  count: number;
  label: string;
  onChange: (blobs: Blob[]) => void;
}

export default function PhotoCaptureGrid({ count, label, onChange }: Props) {
  const { t } = useTranslation();
  const [slots, setSlots] = useState<(Slot | null)[]>(Array.from({ length: count }, () => null));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  async function handleFile(index: number, file: File | undefined) {
    if (!file) return;
    const watermarked = await watermarkImage(file, `${label} #${index + 1}`);
    const previewUrl = URL.createObjectURL(watermarked);
    setSlots((prev) => {
      const next = [...prev];
      next[index] = { previewUrl, blob: watermarked };
      onChange(next.filter((s): s is Slot => Boolean(s)).map((s) => s.blob));
      return next;
    });
  }

  return (
    <div className="photo-grid">
      {slots.map((slot, i) => (
        <button
          key={i}
          type="button"
          className={`photo-slot ${slot ? "filled" : ""}`}
          onClick={() => inputRefs.current[i]?.click()}
        >
          {slot ? (
            <img src={slot.previewUrl} alt={t("photoGrid.altPhoto", { n: i + 1 })} />
          ) : (
            <>
              <span style={{ fontSize: 22 }}>📷</span>
              <span>{t("photoGrid.angle", { n: i + 1 })}</span>
            </>
          )}
          <input
            ref={(el) => (inputRefs.current[i] = el)}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: "none" }}
            onChange={(e) => handleFile(i, e.target.files?.[0])}
          />
        </button>
      ))}
    </div>
  );
}
