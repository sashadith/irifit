import * as ImageManipulator from 'expo-image-manipulator';

import { supabase } from '@/lib/supabase';

const BUCKET = 'progress-photos';

export interface ProgressPhoto {
  id: string;
  storage_path: string;
  taken_on: string;
  signedUrl: string;
}

/** Base64 → Bytes (Hermes bringt atob mit) */
function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function listPhotos(userId: string): Promise<ProgressPhoto[]> {
  const { data, error } = await supabase
    .from('progress_photos')
    .select('id, storage_path, taken_on')
    .eq('user_id', userId)
    .order('taken_on', { ascending: true });
  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) return [];

  // Privater Bucket → signierte URLs (1 h gültig)
  const { data: signed, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(
      rows.map((r) => r.storage_path),
      3600,
    );
  if (signError) throw signError;

  return rows.flatMap((row, i) => {
    const url = signed?.[i]?.signedUrl;
    return url ? [{ ...row, signedUrl: url }] : [];
  });
}

/** Foto komprimieren (~1080 px) und in den privaten Bucket laden */
export async function uploadPhoto(userId: string, uri: string): Promise<void> {
  const manipulated = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1080 } }], {
    compress: 0.8,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
  });
  if (!manipulated.base64) throw new Error('compress_failed');

  const path = `${userId}/${Date.now()}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, base64ToBytes(manipulated.base64).buffer as ArrayBuffer, {
      contentType: 'image/jpeg',
    });
  if (uploadError) throw uploadError;

  const { error: insertError } = await supabase
    .from('progress_photos')
    .insert({ user_id: userId, storage_path: path });
  if (insertError) {
    // Zeile fehlgeschlagen → Objekt nicht verwaisen lassen
    await supabase.storage.from(BUCKET).remove([path]);
    throw insertError;
  }
}

export async function deletePhoto(photo: ProgressPhoto): Promise<void> {
  await supabase.storage.from(BUCKET).remove([photo.storage_path]);
  const { error } = await supabase.from('progress_photos').delete().eq('id', photo.id);
  if (error) throw error;
}
