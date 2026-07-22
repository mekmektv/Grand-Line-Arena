-- =====================================================================================
-- ONE PIECE ARENA — À APPLIQUER dans l'éditeur SQL de Supabase (§8 : les quêtes)
-- =====================================================================================
-- À coller tel quel dans Supabase → SQL Editor → Run. Rejouable sans risque (idempotent) :
-- la table est créée seulement si absente, et le catalogue s'écrase proprement (upsert).
--
-- Ce que ça fait :
--   1) crée la table `quetes_reclamees` (mémorise quelles récompenses ont déjà été versées)
--   2) insère le catalogue des quêtes dans la table `config` (règle d'or : tout le contenu
--      vit en base, jamais en dur dans le code)
--
-- Après avoir appliqué ça, REDÉMARRE le serveur node (il ne recharge pas la config à chaud).
-- =====================================================================================

-- 1) La seule chose qu'on stocke : une réclamation = (joueur, quête, période).
--    - période = la journée (YYYY-MM-DD) pour une quête du jour  → réclamable à nouveau demain
--    - période = le lundi de la semaine  pour une quête hebdo    → réclamable à nouveau la semaine suivante
--    - période = 'permanent'             pour un succès de collection → une seule fois à vie
--    La clé primaire (player_id, cle_quete, periode) empêche toute double-réclamation.
create table if not exists quetes_reclamees (
  player_id   uuid   not null references players(id) on delete cascade,
  cle_quete   text   not null,
  periode     text   not null,
  reclamee_le timestamptz not null default now(),
  primary key (player_id, cle_quete, periode)
);

create index if not exists idx_quetes_reclamees_player on quetes_reclamees(player_id);

-- 2) Le catalogue des quêtes (§8). Une seule clé config `quetes_catalogue`, un tableau JSON.
--    chargerConfig() valide chaque entrée au démarrage et plante si l'une est mal formée.
--
--    Champs d'une quête :
--      cle        identifiant stable (NE JAMAIS renommer : c'est la clé de réclamation)
--      categorie  'jour' | 'semaine' | 'collection'
--      type       comment mesurer : combats_joues | combats_gagnes | coffres_ouverts
--                 | collection_classe | collection_rarete
--      titre      texte affiché au joueur
--      recompense Berrys versés
--      objectif   palier à atteindre (quêtes de combat/coffre uniquement)
--      filtre     la classe ou la rareté visée (quêtes de collection uniquement)
--      actif      false = préparée mais jamais proposée (ex: coffre tant que l'équipement §4ter
--                 n'existe pas)
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
  'Catalogue des quêtes (§8) : jour (rotation quotidienne), semaine, et succès de collection permanents. La quête "coffre" reste inactive tant que l''équipement (§4ter) n''est pas construit.'
)
on conflict (cle) do update set valeur = excluded.valeur, description = excluded.description, updated_at = now();
