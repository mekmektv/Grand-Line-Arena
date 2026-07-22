-- ONE PIECE ARENA — quêtes (§8). Ajoute la table qui mémorise les récompenses déjà versées.
--
-- Le CONTENU des quêtes n'est pas ici : il vit dans la table `config` (clé `quetes_catalogue`,
-- voir supabase/seed/01_config.sql), conformément à la règle d'or du projet. Cette migration ne
-- crée que le strict nécessaire côté schéma.

-- Une ligne = une récompense réclamée par un joueur, pour une quête, sur une période donnée.
--   période = 'YYYY-MM-DD' du jour   → quête du jour (réclamable à nouveau le lendemain)
--   période = 'YYYY-MM-DD' du lundi  → quête de la semaine
--   période = 'permanent'            → succès de collection (une seule fois à vie)
-- La clé primaire composite garantit qu'on ne verse jamais deux fois la même récompense.
create table if not exists quetes_reclamees (
  player_id   uuid   not null references players(id) on delete cascade,
  cle_quete   text   not null,
  periode     text   not null,
  reclamee_le timestamptz not null default now(),
  primary key (player_id, cle_quete, periode)
);

create index if not exists idx_quetes_reclamees_player on quetes_reclamees(player_id);
