// GRAND LINE ARENA — construit les URLs publiques du bucket Storage `persos` (§7).
import { env } from './env.ts';

export function urlPublique(cheminDansStorage: string): string {
  return `${env.supabaseUrl}/storage/v1/object/public/${cheminDansStorage}`;
}
