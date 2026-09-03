import { supabase } from "@/integrations/supabase/client";

/**
 * Photo helpers. Every image is shrunk in the browser before it leaves the
 * phone: small files mean cheap storage, fast uploads on 3G and low data bills.
 */

const MAX_EDGE = 1280;
const GALLERY_EDGE = 1000;

export async function compressImage(
  file: File,
  { maxEdge = MAX_EDGE, quality = 0.72 }: { maxEdge?: number; quality?: number } = {},
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return file;
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );
  return blob ?? file;
}

/** Upload a compressed photo into a private bucket, inside the user's folder. */
export async function uploadPhoto(input: {
  bucket: "verification" | "portfolio" | "market-photos";
  userId: string;
  file: File;
  label: string;
}): Promise<string> {
  const isGallery = input.bucket !== "verification";
  const blob = await compressImage(input.file, {
    maxEdge: isGallery ? GALLERY_EDGE : MAX_EDGE,
    quality: isGallery ? 0.68 : 0.75,
  });
  if (blob.size > 4_000_000) throw new Error("That photo is too large. Try another one.");

  const path = `${input.userId}/${input.label}-${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from(input.bucket)
    .upload(path, blob, { contentType: "image/jpeg", upsert: true });
  if (error) throw new Error(error.message);
  return path;
}

/** Short-lived viewing links for private photos. */
export async function signedUrls(
  bucket: "verification" | "portfolio" | "market-photos",
  paths: string[],
  seconds = 3600,
): Promise<Record<string, string>> {
  const clean = paths.filter(Boolean);
  if (clean.length === 0) return {};
  const { data, error } = await supabase.storage.from(bucket).createSignedUrls(clean, seconds);
  if (error) throw new Error(error.message);
  return Object.fromEntries(
    (data ?? []).flatMap((row) => (row.signedUrl ? [[row.path ?? "", row.signedUrl]] : [])),
  );
}

/** Capture a still frame from a live camera stream as an upload-ready file. */
export function frameToFile(video: HTMLVideoElement, name = "selfie.jpg"): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d")?.drawImage(video, 0, 0);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(new File([blob], name, { type: "image/jpeg" }))
          : reject(new Error("Could not capture the photo")),
      "image/jpeg",
      0.8,
    ),
  );
}
