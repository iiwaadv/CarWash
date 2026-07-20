// Stamps every mandatory inspection photo with a timestamp + plate watermark
// directly on-device, before the file ever leaves the tablet. This is the
// legal-protection guarantee described in the PRD ("صور موثقة بعلامة مائية").
export async function watermarkImage(file: File, label: string): Promise<Blob> {
  const imgUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = imgUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");

    ctx.drawImage(img, 0, 0);

    const timestamp = new Date().toLocaleString("ar-SA", { hour12: false });
    const text = `${label}  •  ${timestamp}`;
    const fontSize = Math.max(18, Math.round(canvas.width / 32));
    ctx.font = `bold ${fontSize}px sans-serif`;
    const paddingX = fontSize * 0.6;
    const barHeight = fontSize * 2.2;

    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, canvas.height - barHeight, canvas.width, barHeight);

    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "middle";
    ctx.direction = "rtl";
    ctx.fillText(text, canvas.width - paddingX, canvas.height - barHeight / 2, canvas.width - paddingX * 2);

    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))), "image/jpeg", 0.85)
    );
  } finally {
    URL.revokeObjectURL(imgUrl);
  }
}
