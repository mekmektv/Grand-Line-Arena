-- ONE PIECE ARENA — import des 16 persos de départ
-- Source : persos.csv (v3 — 16/07/2026), directement transposé en lignes (§6 GAME_DESIGN.md :
-- "persos.csv est directement importable dans cette table").
-- À exécuter APRÈS 20260717000000_init_schema.sql (et après 01_config.sql, sans dépendance entre les deux).
-- Idempotent : peut être relancé sans dupliquer (ON CONFLICT (nom) DO UPDATE).

insert into characters (
  nom, classe, rarete, profil, cout_kit_pct,
  pv_niv1, attack_niv1, pv_niv2, attack_niv2, pv_niv3, attack_niv3,
  esquive_pct, crit_pct,
  competence_nom, competence_type, competence_declencheur,
  winrate_global_pct, winrate_tier_pct
) values
  ('Octi',      'Sabreur',   'Commun',     'Equilibre', 1.1,
   445, 49, 534, 59, 623, 69, 10, 30,
   'Frappe des 8 Lames', 'dmg', 'tour<=8', 22, 63),

  ('Smack',     'Sniper',    'Commun',     'Equilibre', 0.0,
   450, 50, 540, 60, 630, 70, 10, 0,
   'Bulle d''Eau', 'dmg', 'tour<=8', 18, 54),

  ('Baggy',     'Paramecia', 'Commun',     'Equilibre', 2.3,
   440, 49, 528, 59, 616, 68, 20, 0,
   'Fragment Tornade', 'dmg', 'tour<=8', 18, 47),

  ('Kuroobi',   'Haki',      'Commun',     'Bourrin',   5.0,
   350, 58, 420, 70, 490, 82, 10, 0,
   'Karaté des Hommes-Poissons', 'buff', 'tour<=3', 15, 44),

  ('Dalton',    'Zoan',      'Commun',     'Tank',      17.4,
   469, 35, 563, 42, 657, 49, 10, 0,
   'Forme Bison', 'transfo', 'pv<=60%', 12, 41),

  ('Zoro',      'Sabreur',   'Peu commun', 'Bourrin',   5.0,
   420, 70, 490, 82, 560, 93, 10, 30,
   'Phénix des 36 Désirs Terrestres', 'dmg', 'tour<=8', 58, 68),

  ('Sanji',     'Haki',      'Peu commun', 'Equilibre', 2.3,
   528, 59, 616, 68, 704, 78, 10, 0,
   'Lame Noire', 'dmg', 'tour<=8', 52, 50),

  ('Luffy',     'Paramecia', 'Peu commun', 'Bourrin',   5.5,
   418, 70, 488, 81, 557, 93, 20, 0,
   'Sang Bouillonnant', 'buff', 'tour<=3', 47, 44),

  ('Usopp',     'Sniper',    'Peu commun', 'Equilibre', 4.4,
   517, 57, 603, 67, 690, 77, 10, 0,
   'Marteau d''Usopp', 'dmg', 'tour<=8', 44, 46),

  ('Chopper',   'Zoan',      'Peu commun', 'Tank',      11.8,
   592, 44, 690, 51, 789, 58, 10, 0,
   'Heavy Point', 'transfo', 'pv<=60%', 44, 42),

  ('Arlong',    'Haki',      'Rare',       'Bourrin',   12.7,
   456, 76, 522, 87, 587, 98, 10, 0,
   'Squalo Crunch', 'dmg', 'pv<=50%', 84, 58),

  ('Mr.1',      'Sabreur',   'Rare',       'Bourrin',   6.6,
   483, 80, 551, 92, 620, 103, 10, 30,
   'Tornade d''Acier', 'dmg', 'tour<=8', 82, 66),

  ('Mr.5',      'Sniper',    'Rare',       'Equilibre', 6.5,
   592, 66, 676, 75, 761, 85, 10, 0,
   'Nez-Palm Cannon', 'dmg', 'tour<=8', 78, 58),

  ('Smoker',    'Logia',     'Rare',       'Equilibre', 4.9,
   601, 67, 686, 76, 772, 86, 20, 0,
   'Clone de Fumée', 'dmg', 'tour<=8', 73, 43),

  ('Pell',      'Zoan',      'Rare',       'Equilibre', 8.3,
   582, 65, 665, 74, 748, 83, 10, 0,
   'Envol du Faucon', 'transfo', 'pv<=60%', 65, 25),

  ('Crocodile', 'Logia',     'Epique',     'Equilibre', 5.9,
   701, 78, 765, 85, 829, 92, 20, 0,
   'Tornade de Sable', 'dmg', 'tour<=8', 89, null)

on conflict (nom) do update set
  classe               = excluded.classe,
  rarete                = excluded.rarete,
  profil                = excluded.profil,
  cout_kit_pct          = excluded.cout_kit_pct,
  pv_niv1               = excluded.pv_niv1,
  attack_niv1           = excluded.attack_niv1,
  pv_niv2               = excluded.pv_niv2,
  attack_niv2           = excluded.attack_niv2,
  pv_niv3               = excluded.pv_niv3,
  attack_niv3           = excluded.attack_niv3,
  esquive_pct           = excluded.esquive_pct,
  crit_pct              = excluded.crit_pct,
  competence_nom        = excluded.competence_nom,
  competence_type       = excluded.competence_type,
  competence_declencheur = excluded.competence_declencheur,
  winrate_global_pct    = excluded.winrate_global_pct,
  winrate_tier_pct      = excluded.winrate_tier_pct;

-- Note : sprite_folder reste '' (défaut) et forme_transformee_id reste NULL pour les 16 lignes.
-- Dalton, Chopper et Pell ont une compétence de type "transfo" (§3 GAME_DESIGN.md) : leur forme
-- transformée sera ajoutée plus tard comme un perso à part entière, puis reliée via
-- `update characters set forme_transformee_id = <id de la forme> where nom = '...';`
