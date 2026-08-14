/**
 * Bild clientseitig verkleinern und mit Fortschritt hochladen.
 *
 * Warum eigenes XHR statt supabase.storage.upload(): die Bibliothek meldet
 * keinen Fortschritt. Auf dem Telefon dauert ein Upload aber spürbar lange, und
 * ohne Rückmeldung sieht es aus, als passiere nichts (Sascha 14.08.).
 */

/** Auf max. 1280 px verkleinern und als JPEG ausgeben — aus 5 MB werden ~200 KB */
export async function compressImage(file: File, maxSize = 1280, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob fehlgeschlagen'))), 'image/jpeg', quality),
  );
}

export async function uploadWithProgress(
  bucket: string,
  path: string,
  body: Blob,
  accessToken: string,
  onProgress: (percent: number) => void,
): Promise<void> {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${bucket}/${encodeURIComponent(path)}`;
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    xhr.setRequestHeader('Content-Type', body.type || 'application/octet-stream');
    xhr.setRequestHeader('x-upsert', 'true');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload fehlgeschlagen (${xhr.status})`));
    xhr.onerror = () => reject(new Error('Upload fehlgeschlagen (Netzwerk)'));
    xhr.send(body);
  });
}
