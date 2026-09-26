// 영수증 사진을 올리기 전에 브라우저에서 줄인다 (긴 변 1600px JPEG, 700KB 넘으면 더 줄임).

const TARGET_BYTES = 700_000;

export async function compressImage(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    for (const [maxSide, quality] of [
      [1600, 0.8],
      [1280, 0.7],
      [1024, 0.6],
    ] as const) {
      const blob = await draw(bitmap, maxSide, quality);
      if (blob.size <= TARGET_BYTES) return blob;
    }
    return await draw(bitmap, 800, 0.5);
  } finally {
    bitmap.close();
  }
}

function draw(bitmap: ImageBitmap, maxSide: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("canvas"));
  // 투명 PNG 는 흰 바탕으로
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob"))), "image/jpeg", quality),
  );
}
