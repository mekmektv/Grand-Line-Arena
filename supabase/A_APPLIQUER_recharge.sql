-- ═══════════════════════════════════════════════════════════════════════════
-- ONE PIECE ARENA — à coller dans l'éditeur SQL de Supabase, puis Run.
--
-- Corrige un bug bloquant : l'énergie ne se rechargeait JAMAIS. La colonne
-- `derniere_recharge` existait depuis le début mais aucun code ne la lisait,
-- donc chaque joueur avait 10 combats à vie. Idem pour les 3 changements de
-- perso "par semaine", jamais rendus.
--
-- ⚠️ Le serveur refusera de démarrer tant que ces clés manquent (chargerConfig
--    plante en nommant la clé absente) — c'est volontaire.
--
-- ⚠️ Pense à REDÉMARRER le serveur Node après : il ne recharge pas à chaud.
--
-- Idempotent : relançable sans risque.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. La colonne qui manquait ─────────────────────────────────────────────
-- L'énergie (quotidienne) et les changements (hebdomadaires) n'ont pas la même
-- période : ils ne peuvent pas partager le même horodatage.
alter table players
  add column if not exists derniere_recharge_changements timestamptz not null default now();

update players
set derniere_recharge_changements = derniere_recharge
where derniere_recharge_changements > derniere_recharge;

-- ── 2. Les réglages ────────────────────────────────────────────────────────
insert into config (cle, valeur, description) values
  ('energie_max',             '10', 'Combats gratuits par jour (§4). La recharge remet à cette valeur, elle n''ajoute pas.'),
  ('changements_par_semaine', '3',  'Changements de perso actif gratuits par semaine (§3).'),
  ('fuseau_horaire',   '"Europe/Paris"', 'Fuseau de référence pour les remises à zéro (identifiant IANA).'),
  ('heure_reset',      '0',              'Heure locale de la remise à zéro quotidienne, 0–23. 0 = minuit.'),
  ('jour_reset_hebdo', '1',              'Jour de la remise à zéro hebdomadaire : 0 = dimanche … 6 = samedi. 1 = lundi.')
on conflict (cle) do update set valeur = excluded.valeur, description = excluded.description, updated_at = now();

-- ── 3. Vérification ────────────────────────────────────────────────────────
-- Doit renvoyer 5 lignes.
select cle, valeur from config
where cle in ('energie_max','changements_par_semaine','fuseau_horaire','heure_reset','jour_reset_hebdo')
order by cle;
