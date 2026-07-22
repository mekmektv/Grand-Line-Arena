-- ONE PIECE ARENA — schéma de base
-- Crée les 6 tables du §6 de GAME_DESIGN.md : players, characters, collection, equipment, fights, config
-- Règle d'or du projet : aucune valeur de gameplay en dur dans le code, tout vit ici (tables) ou dans `config`.

create extension if not exists "pgcrypto";

-- =========================================================
-- 1) config — tous les chiffres d'équilibrage (clé / valeur)
-- =========================================================
-- Une ligne = un réglage. Rééquilibrer le jeu = changer une valeur ici, jamais dans le code.
create table if not exists config (
  cle         text primary key,
  valeur      jsonb not null,
  description text,
  updated_at  timestamptz not null default now()
);

-- =========================================================
-- 2) characters — le catalogue des persos (importé depuis persos.csv)
-- =========================================================
create table if not exists characters (
  id                     bigint generated always as identity primary key,
  nom                    text not null unique,
  classe                 text not null check (classe in ('Haki','Logia','Paramecia','Zoan','Sniper','Sabreur')),
  rarete                 text not null check (rarete in ('Commun','Peu commun','Rare','Epique','Legendaire')),
  profil                 text not null check (profil in ('Bourrin','Equilibre','Tank')),
  cout_kit_pct           numeric not null default 0,

  -- Stats aux 3 niveaux (§3 GAME_DESIGN / §4 EQUILIBRAGE_FINAL — calculées par la formule budget/profil)
  pv_niv1                integer not null,
  attack_niv1            integer not null,
  pv_niv2                integer not null,
  attack_niv2            integer not null,
  pv_niv3                integer not null,
  attack_niv3            integer not null,

  -- Valeurs dérivées de la classe, dupliquées ici pour lecture facile (persos.csv les fournit déjà)
  esquive_pct            numeric not null default 0,
  crit_pct               numeric not null default 0,

  -- §3 : résistance des transformations. Défaut 0 = rétrocompatible avec tout l'existant.
  resistance             numeric not null default 0,

  -- Compétence unique (1 par perso, §3)
  competence_nom         text,
  competence_type        text,
  competence_declencheur text,
  competence_effet       text,

  -- §7 : assets. Vide pour l'instant — vivront dans Supabase Storage en persos/{nom}/{anim}/{frame}.png
  sprite_folder          text not null default '',

  -- §3 : transformation optionnelle — pointe vers le perso "forme transformée" (perso complet à part)
  forme_transformee_id   bigint references characters(id),

  -- Indicateurs d'équilibrage mesurés par v6.py (informatif, cf. EQUILIBRAGE_FINAL.md §3)
  winrate_global_pct     numeric,
  winrate_tier_pct       numeric,

  created_at             timestamptz not null default now()
);

-- =========================================================
-- 3) players — comptes joueurs (viewers Twitch)
-- =========================================================
create table if not exists players (
  id                      uuid primary key default gen_random_uuid(),
  twitch_id               text not null unique,
  pseudo                  text not null,
  berrys                  integer not null default 0,
  niveau_compte           integer not null default 1,
  -- FK vers collection ajoutée plus bas (collection dépend de players, référence circulaire)
  perso_actif_id          bigint,
  changements_restants    integer not null default 3,
  energie                 integer not null default 10,
  derniere_recharge       timestamptz not null default now(),
  created_at              timestamptz not null default now()
);

-- =========================================================
-- 4) collection — quels persos possède quel joueur
-- =========================================================
create table if not exists collection (
  id            bigint generated always as identity primary key,
  player_id     uuid not null references players(id) on delete cascade,
  character_id  bigint not null references characters(id) on delete restrict,
  niveau        integer not null default 1,
  xp            integer not null default 0,
  obtenu_le     timestamptz not null default now()
);

create index if not exists idx_collection_player_id on collection(player_id);
create index if not exists idx_collection_character_id on collection(character_id);

-- Referme la boucle players.perso_actif_id -> collection.id
-- (bloc conditionnel : évite une erreur si ce fichier est relancé par erreur)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'fk_players_perso_actif'
  ) then
    alter table players
      add constraint fk_players_perso_actif
      foreign key (perso_actif_id) references collection(id) on delete set null;
  end if;
end $$;

-- =========================================================
-- 5) equipment — chapeaux / tenues possédés par un joueur (§4ter)
-- =========================================================
create table if not exists equipment (
  id          bigint generated always as identity primary key,
  player_id   uuid not null references players(id) on delete cascade,
  type        text not null check (type in ('Chapeau','Tenue')),
  hp          integer not null default 0,
  attack      integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists idx_equipment_player_id on equipment(player_id);

-- =========================================================
-- 6) fights — historique des combats (log JSON rejoué par le client)
-- =========================================================
create table if not exists fights (
  id          bigint generated always as identity primary key,
  joueur_a    uuid not null references players(id),
  joueur_b    uuid references players(id), -- nullable : peut être un bot du pool (§4bis)
  vainqueur   uuid references players(id), -- nullable : idem si le vainqueur est un bot
  log         jsonb not null,
  date        timestamptz not null default now()
);

create index if not exists idx_fights_joueur_a on fights(joueur_a);
create index if not exists idx_fights_joueur_b on fights(joueur_b);
