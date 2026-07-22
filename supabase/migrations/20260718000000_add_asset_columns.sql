-- ONE PIECE ARENA — colonnes d'assets manquantes (§7 GAME_DESIGN.md).
-- La Brique 1 avait prévu `sprite_folder` et `forme_transformee_id`, mais pas les réglages
-- de rendu du _INFO.txt de chaque zip perso. Sans ça, le pipeline d'assets n'a nulle part
-- où stocker "Taille projectile spécial", "Effet decalage X", etc.
--
-- Ajoute aussi `jouable` : les formes transformées (Dalton_Zoan, Chopper_Heavy_Point,
-- Pell_Zoan) sont des lignes `characters` À PART (§7 : "un perso complet à part, relié au
-- perso de base" via forme_transformee_id) mais ne doivent JAMAIS apparaître dans le tirage
-- gacha ni la collection — elles ne servent qu'à fournir leurs propres assets visuels.

alter table characters
  add column if not exists taille                       numeric not null default 1.0,
  add column if not exists taille_projectile             numeric,
  add column if not exists hauteur_projectile            numeric,
  add column if not exists taille_projectile_special     numeric,
  add column if not exists hauteur_projectile_special    numeric,
  add column if not exists vitesse_anim_special           numeric,
  add column if not exists vitesse_projectile_special    numeric,
  add column if not exists depart_projectile_special     numeric,
  add column if not exists effet_decalage_x              numeric,
  add column if not exists effet_decalage_y              numeric,
  add column if not exists effet_taille                  numeric,
  add column if not exists effet_opacite                 numeric,
  add column if not exists effet_vitesse                 numeric,
  add column if not exists effet_plan                    text check (effet_plan in ('derriere', 'devant', 'arriere')),
  add column if not exists effet_boucle                  boolean,
  -- §7 : l'image fixe (portrait) affichée en Accueil/Collection/Tirage, en plus des sprites animés.
  add column if not exists image_menu                    text,
  -- false pour les formes transformées : elles ne sont ni tirables ni collectionnables,
  -- juste un porteur d'assets pointé par forme_transformee_id.
  add column if not exists jouable                       boolean not null default true;
