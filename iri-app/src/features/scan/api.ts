import * as ImageManipulator from 'expo-image-manipulator';

import { supabase } from '@/lib/supabase';

import type { InventoryResponse, ScanResponse, ScanResult } from './types';

export class ScanError extends Error {
  constructor(
    readonly code:
      | 'fair_use_exceeded'
      | 'analysis_failed'
      | 'unauthorized'
      | 'missing_anthropic_key'
      | 'network'
      | 'unknown',
    readonly scansUsed?: number,
  ) {
    super(code);
  }
}

/** Foto clientseitig verkleinern (~1024 px) und komprimieren — Kostenoptimierung aus Konzept Kap. 7 */
export async function compressPhoto(uri: string): Promise<{ base64: string; mediaType: string }> {
  const result = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1024 } }], {
    compress: 0.7,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
  });
  if (!result.base64) throw new ScanError('unknown');
  return { base64: result.base64, mediaType: 'image/jpeg' };
}

/** Kühlschrank-/Vorrats-Foto → erkannte Zutaten + freier AI-Vorschlag */
export async function analyzeInventory(image: {
  base64: string;
  mediaType: string;
}): Promise<InventoryResponse> {
  return (await invokeAnalyze({ image, mode: 'inventory' })) as InventoryResponse;
}

/** Freitext ('100 g Hähnchenbrust gebraten …') → Zutaten + Nährwerte (Session 22) */
export async function analyzeTextMeal(text: string): Promise<ScanResponse> {
  return (await invokeAnalyze({ text, mode: 'text' })) as ScanResponse;
}

export async function analyzeFood(
  image: { base64: string; mediaType: string },
  correction?: { previous: ScanResult; note?: string },
): Promise<ScanResponse> {
  return (await invokeAnalyze({ image, correction })) as ScanResponse;
}

async function invokeAnalyze(body: object): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke('analyze-food', {
    body,
  });

  if (error) {
    // FunctionsHttpError trägt den Response-Body mit unserem Fehlercode
    const context = (error as { context?: Response }).context;
    if (context) {
      try {
        const body = await context.json();
        if (body?.error === 'fair_use_exceeded') {
          throw new ScanError('fair_use_exceeded', body.scansUsed);
        }
        if (body?.error) {
          throw new ScanError(
            body.error === 'unauthorized' || body.error === 'missing_anthropic_key'
              ? body.error
              : 'analysis_failed',
          );
        }
      } catch (e) {
        if (e instanceof ScanError) throw e;
      }
    }
    throw new ScanError('network');
  }

  return data;
}
