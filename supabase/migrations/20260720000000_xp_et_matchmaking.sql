-- ONE PIECE ARENA — XP de combat (§3/§6) et amorce du matchmaking §4bis.
--
-- Deux manques constatés à l'audit :
--   1. `collection.xp` existait déjà mais personne ne l'incrémentait — les persos restaient
--      niveau 1 à vie, alors que le niveau est le levier d'équilibrage n°1 (+40 %).
--   2. L'anti-frustration du §4bis (bot faible après 3 défaites) demande de se souvenir de la
--      série de défaites en cours : c'est la colonne ajoutée ici.
--
-- Idempotent : `if not exists` partout, ce fichier peut être relancé sans risque.

-- =========================================================
-- players — série de défaites en cours (§4bis anti-frustration)
-- =========================================================
-- Remise à 0 à chaque victoire. Quand elle atteint `defaites_avant_bot_faible` (config),
-- le prochain adversaire est un bot faible — et le joueur ne doit JAMAIS le deviner.
alter table players
  add column if not exists defaites_consecutives integer not null default 0;

-- =========================================================
-- fights — mémoire de l'adversaire affronté (§4bis anti-répétition)
-- =========================================================
-- `joueur_b` est null quand l'adversaire est un bot : on ne saurait donc pas *quel* bot a été
-- affronté, ni ré-afficher le pseudo qu'on lui a montré. Ces deux colonnes ferment le trou et
-- permettront l'anti-répétition sur les 4 derniers combats sans nouvelle migration.
alter table fights
  add column if not exists adversaire_character_id bigint references characters(id);
alter table fights
  add column if not exists adversaire_pseudo text;

create index if not exists idx_fights_joueur_a_date on fights(joueur_a, date desc);
