-- =====================================================================================
-- ONE PIECE ARENA — À APPLIQUER dans l'éditeur SQL de Supabase
-- Suite de A_APPLIQUER_equipement.sql (§4ter) — 21/07/2026, même journée
-- =====================================================================================
-- À coller tel quel dans Supabase → SQL Editor → Run. Rejouable sans risque.
--
-- POURQUOI CE FICHIER : le compteur de pièces a été remplacé par le SACRIFICE DIRECT.
--
--   Avant : recycler un objet donnait des Berrys ET une « pièce » ; au bout de 6 pièces
--           Grises, on gagnait un coffre Vert. Ça demandait une table pour stocker les
--           pièces, et le joueur voyait un compteur monter sans savoir quoi en faire.
--
--   Après : le joueur SÉLECTIONNE 6 objets Gris de son inventaire et les détruit d'un coup
--           pour ouvrir un coffre Vert garanti. Les objets en trop SONT la monnaie : plus
--           de ressource intermédiaire, plus de table, et la décision reste sous ses yeux —
--           il voit exactement ce qu'il détruit.
--
-- Conséquence : `equipment_pieces` ne sert plus à rien. Les seuils (6 et 4) restent en
-- config, ils comptent maintenant des OBJETS et non des pièces.
-- =====================================================================================

-- 1) La table des pièces n'est plus lue ni écrite par le serveur : on la supprime.
--    (Aucune donnée de jeu n'est perdue : les objets, eux, sont dans `equipment`.)
drop table if exists equipment_pieces;

-- 2) Les deux seuils restent, mais leur description était devenue fausse.
--    Les valeurs (6 et 4) ne changent pas : elles ont été chiffrées par
--    server/scripts/simu-equipement.ts et restent valables, le mode de paiement seul change.
insert into config (cle, valeur, description) values
  ('equipement_compteur_gris', '6', 'Objets Gris à sacrifier d''un coup pour ouvrir un coffre garanti Vert (§4ter). 0 = désactivé'),
  ('equipement_compteur_vert', '4', 'Objets Vert à sacrifier d''un coup pour ouvrir un coffre garanti Bleu (§4ter). 0 = désactivé')
on conflict (cle) do update set valeur = excluded.valeur, description = excluded.description, updated_at = now();

-- 3) Vérification — doit afficher les deux lignes ci-dessus, et rien de plus.
select cle, valeur, description from config where cle like 'equipement_compteur_%' order by cle;
