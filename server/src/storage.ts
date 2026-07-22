// GRAND LINE ARENA — Supabase Storage via son API REST, même logique que supabase.ts :
// `fetch` natif, pas de SDK, clé service_role côté serveur uniquement.

import { env } from './env.ts';

const CONTENT_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.txt': 'text/plain',
};

export function deviverContentType(cheminFichier: string): string {
  const idx = cheminFichier.lastIndexOf('.');
  const ext = idx === -1 ? '' : cheminFichier.slice(idx).toLowerCase();
  return CONTENT_TYPES[ext] ?? 'application/octet-stream';
}

/** Crée le bucket s'il n'existe pas déjà (ignore l'erreur "already exists"). */
export async function assurerBucket(nomBucket: string, isPublic: boolean): Promise<void> {
  const res = await fetch(`${env.supabaseUrl}/storage/v1/bucket`, {
    method: 'POST',
    headers: {
      apikey: env.supabaseServiceRoleKey,
      Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id: nomBucket, name: nomBucket, public: isPublic }),
  });
  if (res.ok) return;
  const corps = await res.text();
  if (res.status === 400 && /already exists/i.test(corps)) return;
  throw new Error(`Storage : création du bucket "${nomBucket}" échouée : ${res.status} ${corps}`);
}

/** Liste les fichiers d'un dossier du bucket (non récursif). Triés par nom (01.png avant 02.png). */
export async function listerFichiers(nomBucket: string, prefixe: string): Promise<string[]> {
  const res = await fetch(`${env.supabaseUrl}/storage/v1/object/list/${nomBucket}`, {
    method: 'POST',
    headers: {
      apikey: env.supabaseServiceRoleKey,
      Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prefix: prefixe, limit: 100, sortBy: { column: 'name', order: 'asc' } }),
  });
  if (!res.ok) throw new Error(`Storage : listage de "${prefixe}" échoué : ${res.status} ${await res.text()}`);
  const fichiers = await res.json() as { name: string; id: string | null }[];
  // `id: null` = pseudo-dossier renvoyé par l'API pour un prefix vide, pas un vrai fichier.
  return fichiers.filter((f) => f.id !== null).map((f) => f.name);
}

/** Upload un fichier (écrase s'il existe déjà, `upsert`). `cheminDansBucket` ex: "persos/Arlong/idle/01.png". */
export async function uploaderFichier(
  nomBucket: string,
  cheminDansBucket: string,
  contenu: Buffer,
): Promise<void> {
  const url = `${env.supabaseUrl}/storage/v1/object/${nomBucket}/${cheminDansBucket}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: env.supabaseServiceRoleKey,
      Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      'Content-Type': deviverContentType(cheminDansBucket),
      'x-upsert': 'true',
    },
    // `new Uint8Array(...)` et non le Buffer brut : selon la version des types Node, `fetch`
    // refuse un Buffer comme corps de requête (« Type 'Buffer' is not assignable to type
    // 'BodyInit' »). La conversion est gratuite — un Uint8Array partage la mémoire du Buffer,
    // rien n'est recopié — et elle vaut pour toutes les versions.
    body: new Uint8Array(contenu),
  });
  if (!res.ok) {
    throw new Error(`Storage : upload de "${cheminDansBucket}" échoué : ${res.status} ${await res.text()}`);
  }
}
