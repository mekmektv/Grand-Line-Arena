-- GRAND LINE ARENA — duel amical depuis le classement. Un joueur peut défier un autre joueur
-- (§8bis) : c'est un vrai combat PvP asynchrone, mais qui NE RAPPORTE RIEN (ni Berrys, ni XP,
-- ni prime, ni énergie dépensée) et NE COMPTE PAS pour le matchmaking. À coller à la main dans
-- l'éditeur SQL de Supabase.

alter table fights add column if not exists amical boolean not null default false;

-- Pourquoi une colonne plutôt que déduire du contexte : un duel amical s'écrit dans `fights`
-- comme n'importe quel combat (pour nourrir le head-to-head du système de rivaux — "3 victoires
-- – 1 défaite"), mais doit rester invisible pour l'anti-répétition du matchmaking (§4bis) et pour
-- la prime (§8). Sans marqueur explicite, impossible de séparer un duel pour l'honneur d'un vrai
-- combat. Les combats déjà en base sont `false` (le défaut), donc traités comme de vrais combats.
