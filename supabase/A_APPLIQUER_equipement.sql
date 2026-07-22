-- =====================================================================================
-- ONE PIECE ARENA — À APPLIQUER dans l'éditeur SQL de Supabase (§4ter : l'équipement)
-- =====================================================================================
-- À coller tel quel dans Supabase → SQL Editor → Run. Rejouable sans risque (idempotent).
--
-- Ce que ça fait :
--   1) refait la table `equipment` (celle du schéma initial n'a jamais servi et ne sait pas
--      dire QUEL objet elle contient, ni s'il est équipé, ni sur quel perso)
--   2) insère en `config` le prix du coffre, les taux, le recyclage, les seuils de sacrifice
--      et le catalogue des 18 objets
--
-- Après avoir appliqué ça, REDÉMARRE le serveur node (il ne recharge pas la config à chaud).
-- =====================================================================================


-- =====================================================================================
-- 1) La table `equipment`
-- =====================================================================================
-- Décisions du 21/07/2026, à lire avant de toucher à quoi que ce soit ici :
--
--   • L'équipement est PAR PERSO, pas par joueur. `collection_id` NULL = l'objet dort dans
--     l'inventaire global ; renseigné = il est soudé à ce perso-là. Conformément au §4ter,
--     un objet équipé ne peut plus revenir à l'inventaire : on ne peut que le RECYCLER.
--
--   • On ne stocke QUE la clé de l'objet (`cle`), jamais ses PV/Attack. La règle d'or veut
--     une seule source de vérité : les stats vivent dans `config.equipement_catalogue`.
--     Conséquence voulue : rééquilibrer un objet met à jour l'équipement de tout le monde.
--     (L'ancienne table avait des colonnes `hp` / `attack` — c'était exactement le piège.)
--
--   • `type` est en revanche bien stocké : ce n'est pas une valeur d'équilibrage mais une
--     donnée structurelle (un Chapeau reste un Chapeau), et l'unicité du slot en dépend.

-- Garde-fou : ce script recrée la table, donc il refuse de tourner si elle contient
-- des données. Elle doit être vide — l'équipement n'a jamais été branché.
do $$
declare n bigint;
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'equipment') then
    execute 'select count(*) from equipment' into n;
    if n > 0 then
      raise exception
        'La table equipment contient % ligne(s) : ce script les détruirait. Arrêt.', n;
    end if;
  end if;
end $$;

drop table if exists equipment cascade;

create table equipment (
  id            bigint generated always as identity primary key,
  player_id     uuid   not null references players(id)    on delete cascade,
  -- NULL = dans l'inventaire global · renseigné = soudé à ce perso (§4ter)
  collection_id bigint          references collection(id) on delete cascade,
  -- clé d'un objet de `config.equipement_catalogue` (ex: 'chapeau_bleu_pv')
  cle           text   not null,
  type          text   not null check (type in ('Chapeau','Tenue')),
  obtenu_le     timestamptz not null default now()
);

create index idx_equipment_player     on equipment(player_id);
create index idx_equipment_collection on equipment(collection_id) where collection_id is not null;

-- Un seul Chapeau et une seule Tenue par perso. C'est cet index qui rend le slot exclusif :
-- pour en équiper un autre, le serveur doit d'abord supprimer (= recycler) celui en place.
create unique index idx_equipment_slot_unique
  on equipment(collection_id, type)
  where collection_id is not null;


-- =====================================================================================
-- 2) (supprimé le 21/07/2026) — la table `equipment_pieces`
-- =====================================================================================
-- Ce fichier créait ici une table de « pièces » accumulées au recyclage. La mécanique a été
-- remplacée le jour même par le SACRIFICE DIRECT : le joueur sélectionne N objets de son
-- inventaire et les détruit d'un coup pour un coffre garanti. Il n'y a donc plus rien à
-- stocker. Voir A_APPLIQUER_equipement_2.sql, qui supprime la table si tu l'avais déjà créée.

-- =====================================================================================
-- 3) La config (règle d'or : aucun de ces nombres ne doit apparaître dans le code)
-- =====================================================================================

insert into config (cle, valeur, description) values
  ('cout_coffre_equipement', '35', 'Coût en Berrys d''un coffre équipement (§4ter)'),

  -- Taux d'un coffre. Doivent totaliser 1. Chapeau/Tenue est un 50/50 séparé (§4ter).
  ('drop_rate_equipement_gris', '0.65', 'Taux d''un coffre équipement — Gris (§4ter)'),
  ('drop_rate_equipement_vert', '0.28', 'Taux d''un coffre équipement — Vert (§4ter)'),
  ('drop_rate_equipement_bleu', '0.07', 'Taux d''un coffre équipement — Bleu (§4ter)'),

  -- Berrys rendus par la destruction d'un objet (§4, ligne « Recyclage/destruction équipement »)
  ('recyclage_equipement_gris', '10', 'Berrys gagnés en recyclant un équipement Gris (§4)'),
  ('recyclage_equipement_vert', '20', 'Berrys gagnés en recyclant un équipement Vert (§4)'),
  ('recyclage_equipement_bleu', '40', 'Berrys gagnés en recyclant un équipement Bleu (§4)'),

  -- Sacrifice : combien d'objets d'une rareté détruire d'un coup pour un coffre garanti au
  -- dessus. 0 = mécanique éteinte pour cette rareté. Chiffré par simu-equipement.ts.
  ('equipement_compteur_gris', '6', 'Objets Gris à sacrifier d''un coup pour ouvrir un coffre garanti Vert (§4ter). 0 = désactivé'),
  ('equipement_compteur_vert', '4', 'Objets Vert à sacrifier d''un coup pour ouvrir un coffre garanti Bleu (§4ter). 0 = désactivé')
on conflict (cle) do update set valeur = excluded.valeur, description = excluded.description, updated_at = now();


-- =====================================================================================
-- 4) Le catalogue des 18 objets
-- =====================================================================================
-- Chiffrage du 21/07/2026. Méthode — et elle n'a rien d'arbitraire :
--
--   La formule du §4 d'EQUILIBRAGE_FINAL donne une conversion universelle entre les deux
--   stats :  1 point de budget = 9 PV = 1 Attack  (c'est `hp_scale`, ≈ la durée d'un combat :
--   un point d'Attack resservant à chaque tour, il vaut ~8 PV encaissés sur 8 tours).
--
--   Chaque objet reçoit donc un budget selon sa rareté — Gris 2 / Vert 4 / Bleu 6 points —
--   qu'il répartit entre PV et Attack selon son profil. Vérification : `hp/9 + attack` doit
--   redonner EXACTEMENT le budget de la rareté. Les trois profils d'une même rareté sont
--   ainsi rigoureusement équivalents ; seul le style de jeu change.
--
--   Un set Bleu complet vaut 12 points, soit ~60 % d'un niveau de perso (+20). Volontaire :
--   monter son perso doit rester plus rentable que farmer des coffres.
--
--   ⚠️ En Gris, les objets « orientés » sont en fait PURS (18/0 et 0/2). À 2 points de
--   budget, un 75/25 tomberait sur des demi-points, impossibles à stocker en entier.
--
--   ⚠️ §4ter : l'équipement ne donne QUE des PV et de l'Attack. Jamais d'esquive ni de crit,
--   qui appartiennent aux classes — sans quoi le triangle du §2 se dérègle.
insert into config (cle, valeur, description) values (
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
  'Catalogue des 18 objets d''équipement (§4ter). Budget par rareté : Gris 2 / Vert 4 / Bleu 6 points, avec 1 point = 9 PV = 1 Attack. Vérifiable : hp/9 + attack = le budget de la rareté.'
)
on conflict (cle) do update set valeur = excluded.valeur, description = excluded.description, updated_at = now();


-- =====================================================================================
-- 5) Vérification — à lire dans la sortie de Supabase après le Run
-- =====================================================================================
-- Doit afficher 18 lignes, et la colonne `budget` doit valoir 2 pour tous les Gris,
-- 4 pour les Verts, 6 pour les Bleus. Toute autre valeur = une faute de frappe ci-dessus.
select
  o->>'rarete'  as rarete,
  o->>'type'    as type,
  o->>'nom'     as nom,
  (o->>'hp')::numeric     as hp,
  (o->>'attack')::numeric as attack,
  (o->>'hp')::numeric / 9 + (o->>'attack')::numeric as budget
from config, jsonb_array_elements(valeur::jsonb) as o
where cle = 'equipement_catalogue'
order by 1, 2, 3;
