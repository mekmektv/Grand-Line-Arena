// ONE PIECE ARENA — lecteur des fichiers de seed SQL. OUTIL DE TEST UNIQUEMENT.
//
// À quoi ça sert : la validation d'équilibrage doit tourner sur les VRAIES données du jeu,
// pas sur des chiffres recopiés à la main dans le test (sinon le test ne prouve rien : il
// vérifierait le test, pas la base). Ce fichier lit donc directement les .sql de supabase/seed/
// et en sort les mêmes lignes que `select * from config` / `select * from characters`.
//
// ⚠️ Ce fichier ne sert QU'aux tests. En production, les lignes viennent de Supabase et on
// passe directement par chargerConfig() / chargerPerso().

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LigneCharacter, LigneConfig } from '../src/config.ts';

const ICI = dirname(fileURLToPath(import.meta.url));
const SEED = join(ICI, '..', '..', 'supabase', 'seed');

type Valeur = string | number | null;

/** Découpe une liste SQL en respectant les quotes et les parenthèses imbriquées. */
function decouper(texte: string, separateur: ',' | ')'): { morceaux: string[]; fin: number } {
  const morceaux: string[] = [];
  let courant = '';
  let profondeur = 0;
  let dansQuote = false;

  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (dansQuote) {
      if (c === "'") {
        if (texte[i + 1] === "'") { courant += "''"; i++; continue; } // '' = une quote échappée
        dansQuote = false;
      }
      courant += c;
      continue;
    }
    if (c === "'") { dansQuote = true; courant += c; continue; }
    if (c === '(') { profondeur++; courant += c; continue; }
    if (c === ')') {
      if (profondeur === 0 && separateur === ')') { morceaux.push(courant); return { morceaux, fin: i }; }
      profondeur--; courant += c; continue;
    }
    if (c === ',' && profondeur === 0) { morceaux.push(courant); courant = ''; continue; }
    courant += c;
  }
  morceaux.push(courant);
  return { morceaux, fin: texte.length };
}

/** Transforme un littéral SQL en valeur JS : 'texte' → texte, 12.5 → 12.5, null → null. */
function lireLitteral(brut: string): Valeur {
  const t = brut.trim();
  if (t.toLowerCase() === 'null') return null;
  if (t.startsWith("'")) return t.slice(1, -1).replace(/''/g, "'");
  const n = Number(t);
  return Number.isFinite(n) ? n : t;
}

/** Extrait les tuples d'un `insert into <table> (...) values (...), (...);` */
function lireInserts(sql: string, table: string): Record<string, Valeur>[] {
  const lignes: Record<string, Valeur>[] = [];
  const debutInsert = new RegExp(`insert\\s+into\\s+${table}\\s*\\(`, 'gi');

  let m: RegExpExecArray | null;
  while ((m = debutInsert.exec(sql)) !== null) {
    // 1. les noms de colonnes
    const apresParen = sql.slice(m.index + m[0].length);
    const finColonnes = apresParen.indexOf(')');
    const colonnes = apresParen.slice(0, finColonnes).split(',').map((c) => c.trim());

    // 2. la zone VALUES, qui s'arrête au `on conflict` ou au `;`
    const reste = apresParen.slice(finColonnes + 1);
    const posValues = reste.toLowerCase().indexOf('values');
    const zone = reste.slice(posValues + 'values'.length);
    const fin = zone.search(/;|\bon\s+conflict\b/i);
    const valeurs = zone.slice(0, fin === -1 ? zone.length : fin);

    // 3. chaque tuple `( ... )`
    let i = 0;
    while (i < valeurs.length) {
      const ouvre = valeurs.indexOf('(', i);
      if (ouvre === -1) break;
      const { morceaux, fin: ferme } = decouper(valeurs.slice(ouvre + 1), ')');
      const ligne: Record<string, Valeur> = {};
      morceaux.forEach((v, k) => { ligne[colonnes[k]] = lireLitteral(v); });
      lignes.push(ligne);
      i = ouvre + 1 + ferme + 1;
    }
  }
  return lignes;
}

/** Applique les `update characters set competence_effet = '...' where nom = '...'` du seed 03. */
function appliquerCompetences(sql: string, persos: Record<string, Valeur>[]): void {
  const re = /update\s+characters\s+set\s+competence_effet\s*=\s*'((?:[^']|'')*)'\s*where\s+nom\s*=\s*'((?:[^']|'')*)'/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    const effet = m[1].replace(/''/g, "'");
    const nom = m[2].replace(/''/g, "'");
    const perso = persos.find((p) => p.nom === nom);
    if (!perso) throw new Error(`03_competences.sql fait référence au perso "${nom}", absent de 02_characters.sql.`);
    perso.competence_effet = effet;
  }
}

/** Les lignes de la table `config`, telles que le seed les insère. */
export function lireConfigDepuisSeed(): LigneConfig[] {
  const sql = readFileSync(join(SEED, '01_config.sql'), 'utf8');
  return lireInserts(sql, 'config').map((l) => ({ cle: String(l.cle), valeur: l.valeur }));
}

/** Les lignes de la table `characters`, seeds 02 (les persos) + 03 (les effets de compétence). */
export function lirePersosDepuisSeed(): LigneCharacter[] {
  const persos = lireInserts(readFileSync(join(SEED, '02_characters.sql'), 'utf8'), 'characters');
  appliquerCompetences(readFileSync(join(SEED, '03_competences.sql'), 'utf8'), persos);
  return persos as unknown as LigneCharacter[];
}
