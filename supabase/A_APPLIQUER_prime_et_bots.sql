-- ═══════════════════════════════════════════════════════════════════════════
-- ONE PIECE ARENA — à coller dans l'éditeur SQL de Supabase, puis Run.
--
-- Deux chantiers du 22/07/2026 :
--   · la PRIME (§8 point 7) — le classement ne trie plus par Berrys. Trier par Berrys, c'était
--     trier par RÉSERVE : un joueur qui dépensait tout en tirages dégringolait, et thésauriser
--     était le meilleur moyen de monter. On classait la richesse, pas les exploits.
--   · l'ANTI-RÉPÉTITION (§4bis) — pour ne pas resservir le même adversaire, encore faut-il
--     savoir lequel a été servi. `joueur_b` est null face à un bot : il manquait la trace du
--     bot lui-même.
--
-- ⚠️ Pense à REDÉMARRER le serveur Node après : il ne recharge pas à chaud.
--
-- Idempotent : relançable sans risque.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. La prime ────────────────────────────────────────────────────────────
-- Cumulative et jamais décroissante (décidé le 22/07/2026) : c'est ainsi dans One Piece, et
-- voir son chiffre baisser en direct décourage. Elle ne monte qu'en battant un VRAI joueur —
-- sinon l'anti-frustration (bot faible garanti après 3 défaites) deviendrait une machine à
-- prime, et enchaîner les défaites serait la façon la plus rentable de grimper.
alter table players
  add column if not exists prime bigint not null default 0;

create index if not exists idx_players_prime on players(prime desc);

-- ── 2. La trace du bot affronté ────────────────────────────────────────────
-- `adversaire_pseudo` existe déjà, mais ne suffit pas comme identité : deux bots peuvent
-- porter le même perso, et un pseudo se change en config. La clé, elle, est stable.
alter table fights
  add column if not exists adversaire_bot_cle text;

create index if not exists idx_fights_joueur_a_date on fights(joueur_a, date desc);

-- ── 3. Vérification ────────────────────────────────────────────────────────
select
  count(*)                     as joueurs,
  coalesce(max(prime), 0)      as prime_max,
  count(*) filter (where prime > 0) as joueurs_avec_prime
from players;
