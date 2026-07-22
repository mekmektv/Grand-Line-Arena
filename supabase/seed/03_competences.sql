-- ONE PIECE ARENA — paramètres des 16 compétences (colonne characters.competence_effet)
-- Source : v6.py, dictionnaire SPECIAUX (c'est lui qui a produit les chiffres d'EQUILIBRAGE_FINAL.md).
-- Lisible aussi dans FICHE_PERSOS.md, une fiche par perso.
--
-- POURQUOI CE FICHIER : 02_characters.sql remplit le NOM, le TYPE et le DÉCLENCHEUR de chaque
-- compétence, mais pas ses CHIFFRES (le "×1.6", le "vol de vie 20 %", le "poison 15 %"...).
-- Ils n'existaient nulle part en base : le moteur de combat ne pouvait pas tourner sans eux.
-- Règle d'or du projet (§6 GAME_DESIGN) : aucun chiffre en dur dans le code → ils vivent ici.
--
-- À exécuter APRÈS 02_characters.sql. Idempotent : relançable sans dommage (simple UPDATE).
--
-- ---------------------------------------------------------------------------
-- Le vocabulaire de competence_effet (JSON). Toutes les clés sont optionnelles.
--
--   mult                 multiplicateur de dégâts du coup spécial (ex. 1.6 = ×1.6)
--   crit_garanti         true = ce coup est critique d'office (applique crit_mult de config)
--   vol_de_vie           soigne l'attaquant de X % des dégâts réellement infligés
--   poison_pct           poison : X % de l'Attack DE BASE de l'attaquant, par tour
--   poison_tours         durée du poison, en tours
--   debuff_attack        -X % d'Attack sur la cible
--   debuff_esquive       -X points d'esquive sur la cible
--   debuff_tours         durée du debuff, en tours
--   bloque_regen_tours   bloque la régén Zoan de la cible pendant X tours
--   atk_pct              +X % d'Attack sur soi (buff / transfo), reste du combat
--   resistance           résistance gagnée (transfo) : dégâts_subis × (1 − résistance)
--   esquive_pct          +X points d'esquive sur soi (transfo), reste du combat
--
-- Le DÉCLENCHEUR n'est pas ici, il est déjà en base dans competence_declencheur :
--   'tour<=N'  → tour de déclenchement tiré au hasard, garanti au plus tard au tour N
--   'pv<=P%'   → se déclenche quand le perso passe sous P % de ses PV
-- ---------------------------------------------------------------------------

-- ⚪ COMMUNS ---------------------------------------------------------------

update characters set competence_effet = '{"mult": 1.6}'
  where nom = 'Octi';                    -- Frappe des 8 Lames — dégâts ×1.6

update characters set competence_effet = '{"mult": 1.3}'
  where nom = 'Smack';                   -- Bulle d'Eau — dégâts ×1.3

update characters set competence_effet = '{"mult": 1.6}'
  where nom = 'Baggy';                   -- Fragment Tornade — dégâts ×1.6

update characters set competence_effet = '{"atk_pct": 0.30}'
  where nom = 'Kuroobi';                 -- Karaté des Hommes-Poissons — buff +30 % Attack

update characters set competence_effet = '{"resistance": 0.26, "atk_pct": 0.35}'
  where nom = 'Dalton';                  -- Forme Bison — transfo +26 % résistance / +35 % Attack

-- 🟢 PEU COMMUNS ----------------------------------------------------------

update characters set competence_effet = '{"mult": 1.8, "crit_garanti": true}'
  where nom = 'Zoro';                    -- Phénix des 36 Désirs Terrestres — ×1.8 + crit garanti

update characters set competence_effet = '{"mult": 1.8}'
  where nom = 'Sanji';                   -- Lame Noire — dégâts ×1.8

update characters set competence_effet = '{"atk_pct": 0.35}'
  where nom = 'Luffy';                   -- Sang Bouillonnant — buff +35 % Attack

update characters set competence_effet = '{"mult": 1.4, "debuff_esquive": 0.15, "debuff_tours": 2}'
  where nom = 'Usopp';                   -- Marteau d'Usopp — ×1.4 + −15 % esquive, 2 tours

update characters set competence_effet = '{"resistance": 0.20, "atk_pct": 0.25}'
  where nom = 'Chopper';                 -- Heavy Point — transfo +20 % résistance / +25 % Attack

-- 🔵 RARES ----------------------------------------------------------------

update characters set competence_effet = '{"mult": 2.2, "vol_de_vie": 0.20}'
  where nom = 'Arlong';                  -- Squalo Crunch — ×2.2 + vol de vie 20 %

update characters set competence_effet = '{"mult": 2.2, "crit_garanti": true}'
  where nom = 'Mr.1';                    -- Tornade d'Acier — ×2.2 + crit garanti

update characters set competence_effet = '{"mult": 2.2, "poison_pct": 0.15, "poison_tours": 2}'
  where nom = 'Mr.5';                    -- Nez-Palm Cannon — ×2.2 + poison 2 tours

update characters set competence_effet = '{"mult": 1.8, "debuff_attack": 0.20, "debuff_tours": 2}'
  where nom = 'Smoker';                  -- Clone de Fumée — ×1.8 + −20 % Attack, 2 tours

update characters set competence_effet = '{"atk_pct": 0.35, "esquive_pct": 0.10}'
  where nom = 'Pell';                    -- Envol du Faucon — transfo +35 % Attack / +10 % esquive

-- 🟣 ÉPIQUE ---------------------------------------------------------------

update characters set competence_effet = '{"mult": 2.5, "bloque_regen_tours": 2}'
  where nom = 'Crocodile';               -- Tornade de Sable — ×2.5 + bloque la régén 2 tours

-- Vérification : doit renvoyer 0 ligne.
-- select nom from characters where competence_effet is null;
