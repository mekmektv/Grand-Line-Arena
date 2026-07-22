-- ONE PIECE ARENA — Brique 6 (Twitch en live) : coffres premium + présence.
-- À coller à la main dans l'éditeur SQL de Supabase (DDL, pas de CLI ni psql sur cette machine).

-- =========================================================
-- 1) players — stock de coffres premium + présence en attente
-- =========================================================
alter table players add column if not exists coffres_premium_perso integer not null default 0;
alter table players add column if not exists presence_berrys_en_attente integer not null default 0;

-- Sert à savoir si les compteurs ci-dessous correspondent AU LIVE EN COURS (comparé à
-- twitch_live_etat.demarre_le) ou à un live précédent — auquel cas on repart de zéro sans
-- avoir besoin d'une remise à zéro explicite à chaque fin de live.
alter table players add column if not exists presence_dernier_live_debut timestamptz;
alter table players add column if not exists presence_tranches_creditees integer not null default 0;
alter table players add column if not exists presence_bonus_recu boolean not null default false;

-- =========================================================
-- 2) twitch_live_etat — état du live, UNE seule chaîne donc UNE seule ligne (singleton)
-- =========================================================
create table if not exists twitch_live_etat (
  id                    boolean primary key default true,
  en_direct             boolean not null default false,
  demarre_le            timestamptz,
  -- Nécessaire pour appeler Get Chatters (broadcaster_id) sans redemander le profil à chaque
  -- minute — rempli depuis event.broadcaster_user_id à la réception de stream.online.
  broadcaster_user_id   text,
  constraint twitch_live_etat_singleton check (id)
);
insert into twitch_live_etat (id, en_direct) values (true, false) on conflict (id) do nothing;

-- =========================================================
-- 3) twitch_broadcaster_token — le jeton OAuth DU STREAMER (scopes élevés : lire les chatters,
-- lire/gérer les récompenses). Différent des jetons joueurs, qui ne servent qu'une fois à la
-- connexion et ne sont jamais stockés. Singleton : une seule chaîne.
-- =========================================================
create table if not exists twitch_broadcaster_token (
  id             boolean primary key default true,
  access_token   text not null,
  refresh_token  text not null,
  expire_le      timestamptz not null,
  updated_at     timestamptz not null default now(),
  constraint twitch_broadcaster_token_singleton check (id)
);
