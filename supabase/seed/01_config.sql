-- ONE PIECE ARENA — remplissage de la table config
-- Source : EQUILIBRAGE_FINAL.md §1 (constantes), GAME_DESIGN.md §3bis (taux de drop),
--          §3 / §4 (budgets par rareté et niveau), §3 (profils h)
-- À exécuter APRÈS 20260717000000_init_schema.sql (dans l'éditeur SQL de Supabase, ou via `supabase db push`).
-- Idempotent : peut être relancé sans dupliquer les lignes (ON CONFLICT ... DO UPDATE).

-- =========================================================
-- Les 8 constantes de combat (§1 EQUILIBRAGE_FINAL.md)
-- =========================================================
insert into config (cle, valeur, description) values
  ('hp_scale',          '9',     '1 point de budget PV = 9 PV'),
  ('esquive_base',      '0.10',  'Esquive de base, toutes classes'),
  ('esquive_logia',     '0.10',  'Bonus esquive Logia/Paramecia (→ 20% au total)'),
  ('crit_sabreur',      '0.30',  'Chance de coup critique du Sabreur'),
  ('crit_mult',         '1.5',   'Multiplicateur de dégâts en cas de critique'),
  ('zoan_regen',        '0.012', 'PV max régénérés par tour pour le Zoan. ATTENTION falaise : ne jamais dépasser 0.013'),
  ('sniper_ouverture',  'true',  'Le Sniper tire une fois avant le tour 1'),
  ('counter_mult',      '1.1',   'Multiplicateur de dégâts quand on frappe la classe qu''on contre')
on conflict (cle) do update set valeur = excluded.valeur, description = excluded.description, updated_at = now();

-- =========================================================
-- Ajouts du moteur de combat (17/07/2026)
-- Deux constantes que le moteur utilise et qui n'étaient encore nulle part.
-- Valeurs reprises telles quelles de v6.py (CONFIG.max_tours et le dictionnaire COUNTRE).
-- =========================================================
insert into config (cle, valeur, description) values
  ('max_tours', '200', 'Garde-fou anti-combat infini. Jamais atteint en pratique (un combat dure ~8 tours) : c''est une ceinture de sécurité, pas un réglage de gameplay.'),

  -- Le triangle du §2 : qui contre qui. Frapper une classe de sa liste → dégâts ×counter_mult.
  -- Sniper et Sabreur ont une liste vide : ils ne contrent personne, et comme ils
  -- n'apparaissent dans la liste de personne, personne ne les contre. (§2 : classes neutres)
  ('triangle_counters',
   '{"Haki":["Logia","Paramecia"],"Logia":["Zoan"],"Paramecia":["Zoan"],"Zoan":["Haki"],"Sniper":[],"Sabreur":[]}',
   'Le triangle des classes (§2 GAME_DESIGN) : classe attaquante -> liste des classes qu''elle contre.')
on conflict (cle) do update set valeur = excluded.valeur, description = excluded.description, updated_at = now();

-- =========================================================
-- Taux de drop du tirage perso (§3bis GAME_DESIGN.md)
-- =========================================================
insert into config (cle, valeur, description) values
  ('drop_rate_commun',      '0.70',  'Taux de tirage global — rareté Commun'),
  ('drop_rate_peu_commun',  '0.22',  'Taux de tirage global — rareté Peu commun'),
  ('drop_rate_rare',        '0.075', 'Taux de tirage global — rareté Rare'),
  ('drop_rate_epique',      '0.005', 'Taux de tirage global — rareté Épique (se partage si plusieurs Épiques)')
on conflict (cle) do update set valeur = excluded.valeur, description = excluded.description, updated_at = now();

-- =========================================================
-- Coût du tirage et récompenses de recyclage (§4 GAME_DESIGN.md)
-- =========================================================
insert into config (cle, valeur, description) values
  ('cout_tirage_perso', '100', 'Coût en Berrys d''un tirage perso (§4)'),

  ('recyclage_doublon_commun',     '20',  'Berrys gagnés en recyclant un doublon Commun (§4)'),
  ('recyclage_doublon_peu_commun', '40',  'Berrys gagnés en recyclant un doublon Peu commun (§4)'),
  ('recyclage_doublon_rare',       '80',  'Berrys gagnés en recyclant un doublon Rare (§4)'),
  ('recyclage_doublon_epique',     '160', 'Berrys gagnés en recyclant un doublon Épique (§4)')
on conflict (cle) do update set valeur = excluded.valeur, description = excluded.description, updated_at = now();

-- =========================================================
-- Gains de combat (§4 GAME_DESIGN.md)
-- =========================================================
insert into config (cle, valeur, description) values
  ('gain_combat_gagne', '20', 'Berrys gagnés en gagnant un combat (§4)'),
  ('gain_combat_perdu', '8',  'Berrys gagnés même en perdant, plancher garanti (§4)')
on conflict (cle) do update set valeur = excluded.valeur, description = excluded.description, updated_at = now();

-- =========================================================
-- Budgets de puissance par rareté et par niveau (§3 GAME_DESIGN.md / §4 EQUILIBRAGE_FINAL.md)
-- =========================================================
insert into config (cle, valeur, description) values
  ('budget_commun_niv1',      '100', 'Budget de puissance — Commun niveau 1'),
  ('budget_commun_niv2',      '120', 'Budget de puissance — Commun niveau 2'),
  ('budget_commun_niv3',      '140', 'Budget de puissance — Commun niveau 3'),

  ('budget_peu_commun_niv1',  '120', 'Budget de puissance — Peu commun niveau 1'),
  ('budget_peu_commun_niv2',  '140', 'Budget de puissance — Peu commun niveau 2'),
  ('budget_peu_commun_niv3',  '160', 'Budget de puissance — Peu commun niveau 3'),

  ('budget_rare_niv1',        '140', 'Budget de puissance — Rare niveau 1'),
  ('budget_rare_niv2',        '160', 'Budget de puissance — Rare niveau 2'),
  ('budget_rare_niv3',        '180', 'Budget de puissance — Rare niveau 3'),

  ('budget_epique_niv1',      '165', 'Budget de puissance — Épique niveau 1'),
  ('budget_epique_niv2',      '180', 'Budget de puissance — Épique niveau 2'),
  ('budget_epique_niv3',      '195', 'Budget de puissance — Épique niveau 3'),

  ('budget_legendaire_niv1',  '185', 'Budget de puissance — Légendaire niveau 1 (à venir)'),
  ('budget_legendaire_niv2',  '195', 'Budget de puissance — Légendaire niveau 2 (à venir)'),
  ('budget_legendaire_niv3',  '205', 'Budget de puissance — Légendaire niveau 3 (à venir)')
on conflict (cle) do update set valeur = excluded.valeur, description = excluded.description, updated_at = now();

-- =========================================================
-- XP de combat et seuils de niveau (§3 GAME_DESIGN.md — ajouté le 20/07/2026)
-- =========================================================
-- Cadence visée : ~20 combats pour le niveau 2, ~60 pour le niveau 3. Avec 10 combats/jour
-- d'énergie et un mix victoires/défaites réaliste (~7 XP en moyenne par combat), ça donne
-- environ 2 jours pour le niveau 2 et 6 jours pour le niveau 3.
--
-- ⚠️ Les seuils sont CUMULÉS (xp total du perso), pas "XP depuis le dernier niveau" —
-- c'est ce que lit progression.ts. Ils doivent rester strictement croissants.
insert into config (cle, valeur, description) values
  ('xp_combat_gagne', '10', 'XP gagnés par le perso actif quand le combat est gagné (§3)'),
  ('xp_combat_perdu', '4',  'XP gagnés même en perdant : perdre fait progresser, plus lentement (§3)'),

  ('xp_niveau_2', '140', 'XP CUMULÉS pour passer niveau 2 (~20 combats)'),
  ('xp_niveau_3', '420', 'XP CUMULÉS pour passer niveau 3 (~60 combats). Niveau 3 = maximum (§3).')
on conflict (cle) do update set valeur = excluded.valeur, description = excluded.description, updated_at = now();

-- =========================================================
-- Recharge de l'énergie et des changements de perso (§4 — ajouté le 20/07/2026)
-- =========================================================
-- La recharge REMET À la valeur maximale, elle n'ajoute pas : "10 combats par jour", pas
-- "+10 par jour". Un joueur absent trois jours ne cumule donc aucune réserve.
insert into config (cle, valeur, description) values
  ('energie_max',             '10', 'Combats gratuits par jour (§4). La recharge quotidienne remet à cette valeur.'),
  ('changements_par_semaine', '3',  'Changements de perso actif gratuits par semaine (§3).'),

  -- Prix des changements AU-DELÀ du quota gratuit, dans l'ordre. La DERNIÈRE valeur fait
  -- plafond et se répète : ici le 4e changement de la semaine coûte 20, le 5e 40, le 6e et
  -- tous les suivants 60. Le compteur repart à zéro à la remise hebdomadaire.
  ('changement_prix_paliers', '[20, 40, 60]', 'Prix en Berrys des changements de perso au-delà du quota (§3). La dernière valeur est le plafond.'),

  -- Le fuseau décide quand tombe "minuit" pour la recharge. Identifiant IANA obligatoire :
  -- chargerConfig teste sa validité au démarrage plutôt que de planter en pleine requête.
  ('fuseau_horaire',   '"Europe/Paris"', 'Fuseau de référence pour les remises à zéro (identifiant IANA).'),
  ('heure_reset',      '0',              'Heure locale de la remise à zéro quotidienne, 0–23. 0 = minuit.'),
  ('jour_reset_hebdo', '1',              'Jour de la remise à zéro hebdomadaire : 0 = dimanche … 6 = samedi. 1 = lundi.')
on conflict (cle) do update set valeur = excluded.valeur, description = excluded.description, updated_at = now();

-- =========================================================
-- Matchmaking — anti-frustration (§4bis GAME_DESIGN.md)
-- =========================================================
-- Après N défaites consécutives, l'adversaire suivant est un bot faible (perso Commun niveau 1).
-- Le joueur ne doit jamais pouvoir le distinguer d'un vrai viewer : d'où la liste de pseudos.
insert into config (cle, valeur, description) values
  ('defaites_avant_bot_faible', '3', 'Nombre de défaites consécutives avant qu''un bot faible soit proposé (§4bis)'),

  ('bot_faible_raretes', '["Commun"]', 'Raretés dans lesquelles un bot faible pioche son perso. Commun niveau 1 = quasi-victoire garantie.'),

  -- Pseudos de façade des bots. Volontairement dans le même registre que de vrais viewers
  -- fans de One Piece : aucun indice (pas de "Bot", pas de numéro) ne doit trahir la nature
  -- de l'adversaire. Ajouter/retirer un pseudo = éditer cette ligne, pas le code.
  ('bot_pseudos',
   '["LuffyFan92","GommeGomme_TV","ZoroSanTeu","NamiChaan","SanjiCurlyBrow","ChopperGang","RogerLeRoi","MerryGoRound","BaratieChef","LogPose_","AkaGami_","SunnyGoTV","Grand_Line_77","ThousandSunny_","PouleMouillee","Kuina_","EastBlue_Rookie","BaggyLeClown","SabodeSirop","CapNoBeard"]',
   'Pseudos affichés pour les bots (§4bis). Doivent rester indiscernables de vrais viewers.')
on conflict (cle) do update set valeur = excluded.valeur, description = excluded.description, updated_at = now();

-- =========================================================
-- Matchmaking — pool de bots et anti-répétition (§4bis GAME_DESIGN.md)
-- =========================================================
-- §4bis : « chaque bot = un perso défini manuellement, pas de génération aléatoire, contrôle
-- total ». Le niveau de chaque bot est écrit ici et N'EST PAS aligné sur celui du joueur :
-- c'est tout l'objet d'un pool défini à la main que de choisir la difficulté rencontrée.
--   faible:true → réservé à l'anti-frustration (quasi-victoire garantie après N défaites).
--   cle         → identité stable, c'est elle que lit l'anti-répétition (joueur_b est null
--                 face à un bot, le pseudo seul ne suffirait pas à le reconnaître).
insert into config (cle, valeur, description) values
  ('bots_pool',
   '[
     {"cle":"bot_f1","pseudo":"PouleMouillee","perso":"Baggy","niveau":1,"faible":true},
     {"cle":"bot_f2","pseudo":"SabodeSirop","perso":"Smack","niveau":1,"faible":true},
     {"cle":"bot_f3","pseudo":"EastBlue_Rookie","perso":"Octi","niveau":1,"faible":true},
     {"cle":"bot_01","pseudo":"LuffyFan92","perso":"Dalton","niveau":1,"faible":false},
     {"cle":"bot_02","pseudo":"ZoroSanTeu","perso":"Kuroobi","niveau":2,"faible":false},
     {"cle":"bot_03","pseudo":"NamiChaan","perso":"Chopper","niveau":2,"faible":false},
     {"cle":"bot_04","pseudo":"SanjiCurlyBrow","perso":"Usopp","niveau":2,"faible":false},
     {"cle":"bot_05","pseudo":"ChopperGang","perso":"Zoro","niveau":3,"faible":false},
     {"cle":"bot_06","pseudo":"RogerLeRoi","perso":"Arlong","niveau":2,"faible":false},
     {"cle":"bot_07","pseudo":"BaratieChef","perso":"Mr.5","niveau":3,"faible":false},
     {"cle":"bot_08","pseudo":"AkaGami_","perso":"Pell","niveau":3,"faible":false},
     {"cle":"bot_09","pseudo":"Grand_Line_77","perso":"Smoker","niveau":2,"faible":false},
     {"cle":"bot_10","pseudo":"BaggyLeClown","perso":"Luffy","niveau":1,"faible":false}
   ]',
   'Pool de bots (§4bis), chacun défini à la main. faible:true = réservé à l''anti-frustration.'),

  ('anti_repetition_combats', '4',
   'Un adversaire ne peut pas revenir dans les N derniers combats du joueur (§4bis). 0 = désactivé.')
on conflict (cle) do update set valeur = excluded.valeur, description = excluded.description, updated_at = now();

-- =========================================================
-- La prime — le classement (§8 point 7 GAME_DESIGN.md)
-- =========================================================
-- La prime ne monte qu'en battant un VRAI joueur, et ne redescend JAMAIS (décidé le
-- 22/07/2026). Les victoires contre un bot ne rapportent rien : sinon l'anti-frustration
-- ci-dessus deviendrait une machine à prime, et perdre exprès serait la stratégie optimale.
--
-- L'échelle par rareté reprend celle du recyclage des doublons (20/40/80/160, doublement par
-- palier) divisée par deux, plutôt que d'inventer une n-ième échelle non validée.
insert into config (cle, valeur, description) values
  ('prime_commun',      '10', 'Prime gagnée en battant un joueur dont le perso actif est Commun (§8).'),
  ('prime_peu_commun',  '20', 'Prime gagnée en battant un Peu commun (§8).'),
  ('prime_rare',        '40', 'Prime gagnée en battant un Rare (§8).'),
  ('prime_epique',      '80', 'Prime gagnée en battant un Épique (§8).'),

  -- 0.4 reprend le chiffre d'équilibrage du projet (« un niveau vaut +40 % »), plutôt qu'une
  -- valeur inventée : battre un adversaire niveau 3 vaut donc 1,8× le même en niveau 1.
  ('prime_bonus_niveau', '0.4',
   'Bonus de prime par niveau de l''adversaire au-dessus de 1 (§8). 0.4 = un niveau 3 vaut 1,8×.')
on conflict (cle) do update set valeur = excluded.valeur, description = excluded.description, updated_at = now();

-- =========================================================
-- Les 3 profils de répartition PV / Attack (§3 GAME_DESIGN.md, formule budget_effectif → h)
-- =========================================================
insert into config (cle, valeur, description) values
  ('profil_bourrin_h',    '0.40', 'Profil Bourrin — coefficient h de la formule PV/Attack'),
  ('profil_equilibre_h',  '0.50', 'Profil Équilibré — coefficient h de la formule PV/Attack'),
  ('profil_tank_h',       '0.60', 'Profil Tank — coefficient h de la formule PV/Attack')
on conflict (cle) do update set valeur = excluded.valeur, description = excluded.description, updated_at = now();

-- =========================================================
-- Les quêtes (§8 — ajouté le 21/07/2026)
-- =========================================================
-- Tout le contenu des quêtes vit ici (règle d'or) : chargerConfig() valide chaque entrée au
-- démarrage. Trois catégories : 'jour' (une seule affichée, rotation quotidienne), 'semaine',
-- et 'collection' (succès permanents, réclamables une seule fois). Voir types.ts (QueteDef) pour
-- le détail des champs. La quête "coffre" est actif:false tant que l'équipement (§4ter) manque.
insert into config (cle, valeur, description) values
(
  'quetes_catalogue',
  '[
    {"cle":"jour_jouer_10",   "categorie":"jour",    "type":"combats_joues",     "titre":"Jouer 10 combats",       "recompense":50,  "objectif":10, "actif":true},
    {"cle":"jour_gagner_3",   "categorie":"jour",    "type":"combats_gagnes",    "titre":"Gagner 3 combats",       "recompense":50,  "objectif":3,  "actif":true},
    {"cle":"jour_coffre_1",   "categorie":"jour",    "type":"coffres_ouverts",   "titre":"Ouvrir 1 coffre d''équipement", "recompense":50, "objectif":1, "actif":false},

    {"cle":"sem_gagner_20",   "categorie":"semaine", "type":"combats_gagnes",    "titre":"Gagner 20 combats cette semaine", "recompense":200, "objectif":20, "actif":true},

    {"cle":"col_r_commun",     "categorie":"collection","type":"collection_rarete","titre":"Obtenir tous les Communs",     "recompense":150, "filtre":"Commun",     "actif":true},
    {"cle":"col_r_peu_commun", "categorie":"collection","type":"collection_rarete","titre":"Obtenir tous les Peu communs", "recompense":250, "filtre":"Peu commun", "actif":true},
    {"cle":"col_r_rare",       "categorie":"collection","type":"collection_rarete","titre":"Obtenir tous les Rares",       "recompense":500, "filtre":"Rare",       "actif":true},
    {"cle":"col_r_epique",     "categorie":"collection","type":"collection_rarete","titre":"Obtenir tous les Épiques",     "recompense":500, "filtre":"Epique",     "actif":true},

    {"cle":"col_c_haki",      "categorie":"collection","type":"collection_classe","titre":"Obtenir toute la classe Haki",      "recompense":300, "filtre":"Haki",      "actif":true},
    {"cle":"col_c_logia",     "categorie":"collection","type":"collection_classe","titre":"Obtenir toute la classe Logia",     "recompense":300, "filtre":"Logia",     "actif":true},
    {"cle":"col_c_paramecia", "categorie":"collection","type":"collection_classe","titre":"Obtenir toute la classe Paramecia", "recompense":300, "filtre":"Paramecia", "actif":true},
    {"cle":"col_c_zoan",      "categorie":"collection","type":"collection_classe","titre":"Obtenir toute la classe Zoan",      "recompense":300, "filtre":"Zoan",      "actif":true},
    {"cle":"col_c_sniper",    "categorie":"collection","type":"collection_classe","titre":"Obtenir toute la classe Sniper",    "recompense":300, "filtre":"Sniper",    "actif":true},
    {"cle":"col_c_sabreur",   "categorie":"collection","type":"collection_classe","titre":"Obtenir toute la classe Sabreur",   "recompense":300, "filtre":"Sabreur",   "actif":true}
  ]',
  'Catalogue des quêtes (§8) : jour (rotation quotidienne), semaine, et succès de collection permanents.'
)
on conflict (cle) do update set valeur = excluded.valeur, description = excluded.description, updated_at = now();

-- =========================================================
-- L'équipement (§4ter — ajouté le 21/07/2026)
-- =========================================================
-- Identique à supabase/A_APPLIQUER_equipement.sql, qui contient en plus les tables.
-- Ce bloc-ci est ce que lisent les scripts de validation (server/scripts/lire-seed.ts).
insert into config (cle, valeur, description) values
  ('cout_coffre_equipement', '35', 'Coût en Berrys d''un coffre équipement (§4ter)'),

  ('drop_rate_equipement_gris', '0.65', 'Taux d''un coffre équipement — Gris (§4ter)'),
  ('drop_rate_equipement_vert', '0.28', 'Taux d''un coffre équipement — Vert (§4ter)'),
  ('drop_rate_equipement_bleu', '0.07', 'Taux d''un coffre équipement — Bleu (§4ter)'),

  ('recyclage_equipement_gris', '10', 'Berrys gagnés en recyclant un équipement Gris (§4)'),
  ('recyclage_equipement_vert', '20', 'Berrys gagnés en recyclant un équipement Vert (§4)'),
  ('recyclage_equipement_bleu', '40', 'Berrys gagnés en recyclant un équipement Bleu (§4)'),

  ('equipement_compteur_gris', '6', 'Objets Gris à sacrifier d''un coup pour ouvrir un coffre garanti Vert (§4ter). 0 = désactivé'),
  ('equipement_compteur_vert', '4', 'Objets Vert à sacrifier d''un coup pour ouvrir un coffre garanti Bleu (§4ter). 0 = désactivé')
on conflict (cle) do update set valeur = excluded.valeur, description = excluded.description, updated_at = now();

-- Le catalogue des 18 objets. Budget par rareté : Gris 2 / Vert 4 / Bleu 6 points, sachant
-- que 1 point = `hp_scale` PV (9) = 1 Attack. chargerConfig() vérifie au démarrage que tous
-- les objets d'une même rareté coûtent exactement le même budget : c'est ce qui garantit que
-- les trois profils (équilibré / PV / Attack) sont interchangeables et qu'aucun n'est un piège.
insert into config (cle, valeur, description) values
(
  'equipement_catalogue',
  '[
    {"cle":"chapeau_gris_equilibre","type":"Chapeau","rarete":"Gris","profil":"equilibre","nom":"Bandana usé",              "hp":9, "attack":1},
    {"cle":"chapeau_gris_pv",       "type":"Chapeau","rarete":"Gris","profil":"pv",       "nom":"Casque de Marine cabossé","hp":18,"attack":0},
    {"cle":"chapeau_gris_atk",      "type":"Chapeau","rarete":"Gris","profil":"atk",      "nom":"Bonnet de pirate",        "hp":0, "attack":2},
    {"cle":"tenue_gris_equilibre",  "type":"Tenue",  "rarete":"Gris","profil":"equilibre","nom":"Chemise de matelot",      "hp":9, "attack":1},
    {"cle":"tenue_gris_pv",         "type":"Tenue",  "rarete":"Gris","profil":"pv",       "nom":"Gilet rembourré",         "hp":18,"attack":0},
    {"cle":"tenue_gris_atk",        "type":"Tenue",  "rarete":"Gris","profil":"atk",      "nom":"Débardeur déchiré",       "hp":0, "attack":2},

    {"cle":"chapeau_vert_equilibre","type":"Chapeau","rarete":"Vert","profil":"equilibre","nom":"Tricorne de capitaine",   "hp":18,"attack":2},
    {"cle":"chapeau_vert_pv",       "type":"Chapeau","rarete":"Vert","profil":"pv",       "nom":"Casque de Baroque Works", "hp":27,"attack":1},
    {"cle":"chapeau_vert_atk",      "type":"Chapeau","rarete":"Vert","profil":"atk",      "nom":"Bandeau de sabreur",      "hp":9, "attack":3},
    {"cle":"tenue_vert_equilibre",  "type":"Tenue",  "rarete":"Vert","profil":"equilibre","nom":"Manteau d''East Blue",     "hp":18,"attack":2},
    {"cle":"tenue_vert_pv",         "type":"Tenue",  "rarete":"Vert","profil":"pv",       "nom":"Cotte de mailles",        "hp":27,"attack":1},
    {"cle":"tenue_vert_atk",        "type":"Tenue",  "rarete":"Vert","profil":"atk",      "nom":"Costume noir",            "hp":9, "attack":3},

    {"cle":"chapeau_bleu_equilibre","type":"Chapeau","rarete":"Bleu","profil":"equilibre","nom":"Chapeau de paille",       "hp":27,"attack":3},
    {"cle":"chapeau_bleu_pv",       "type":"Chapeau","rarete":"Bleu","profil":"pv",       "nom":"Casque du Roi des Mers",  "hp":36,"attack":2},
    {"cle":"chapeau_bleu_atk",      "type":"Chapeau","rarete":"Bleu","profil":"atk",      "nom":"Masque de Baroque",       "hp":18,"attack":4},
    {"cle":"tenue_bleu_equilibre",  "type":"Tenue",  "rarete":"Bleu","profil":"equilibre","nom":"Manteau de Shichibukai",  "hp":27,"attack":3},
    {"cle":"tenue_bleu_pv",         "type":"Tenue",  "rarete":"Bleu","profil":"pv",       "nom":"Armure de Kaïrōseki",     "hp":36,"attack":2},
    {"cle":"tenue_bleu_atk",        "type":"Tenue",  "rarete":"Bleu","profil":"atk",      "nom":"Costume de Mr. Prince",   "hp":18,"attack":4}
  ]',
  'Catalogue des 18 objets d''équipement (§4ter). 1 point de budget = 9 PV = 1 Attack ; hp/9 + attack doit redonner le budget de la rareté (Gris 2 / Vert 4 / Bleu 6).'
)
on conflict (cle) do update set valeur = excluded.valeur, description = excluded.description, updated_at = now();
