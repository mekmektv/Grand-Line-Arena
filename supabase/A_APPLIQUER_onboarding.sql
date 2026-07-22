-- ═══════════════════════════════════════════════════════════════════════════
-- ONE PIECE ARENA — à coller dans l'éditeur SQL de Supabase, puis Run.
--
-- Refonte de l'onboarding (§4). Avant : le serveur tirait le perso offert ET le
-- tirage gratuit EN SILENCE au moment de la création du compte — le joueur
-- découvrait deux persos déjà dans sa collection sans avoir rien fait.
-- Maintenant le joueur JOUE ses deux tirages, répartis dans le parcours :
--   · à la connexion, un roll forcé Commun ("débloque ton premier pirate") ;
--   · après son premier combat, le coffre offert "pour fêter son arrivée en mer".
--
-- Ajoute aussi l'avatar Twitch, qui n'existait nulle part dans le projet.
--
-- ⚠️ Pense à REDÉMARRER le serveur Node après : il ne recharge pas à chaud.
--
-- Idempotent : relançable sans risque.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Où en est le joueur dans son onboarding ─────────────────────────────
-- Un seul entier plutôt que trois booléens : les étapes sont strictement
-- successives, on ne peut pas être à la fois "doit roller" et "a fini".
--   0 = doit faire son roll de départ (forcé Commun)
--   1 = a son pirate — tutoriel de l'Accueil, puis premier combat
--   2 = combat fait — le coffre offert l'attend dans l'onglet Coffres
--   3 = onboarding terminé
--
-- default 0 : c'est la valeur que doit avoir un compte NEUF. Les comptes qui
-- existent déjà ont reçu leurs persos par l'ancien code, il ne faut surtout pas
-- leur refaire jouer l'onboarding — d'où le update juste après.
alter table players
  add column if not exists onboarding_etape smallint not null default 0;

update players set onboarding_etape = 3 where onboarding_etape = 0;

-- ── 2. L'avatar Twitch ─────────────────────────────────────────────────────
-- Rempli à CHAQUE connexion depuis profile_image_url de l'API Twitch (et pas
-- seulement à la création) : un joueur qui change sa photo sur Twitch doit la
-- voir changer ici. Nullable : les comptes de dev (/auth/dev/login) n'en ont pas.
alter table players
  add column if not exists avatar_url text;

-- ── 3. Vérification ────────────────────────────────────────────────────────
-- Doit renvoyer les deux colonnes, et aucun joueur existant à l'étape 0.
select
  count(*)                                          as joueurs,
  count(*) filter (where onboarding_etape = 3)      as onboarding_termine,
  count(*) filter (where onboarding_etape <> 3)     as onboarding_en_cours
from players;
