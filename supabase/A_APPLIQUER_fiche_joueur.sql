-- GRAND LINE ARENA — fiche joueur détaillée (palmarès, perso favori) : il fallait savoir QUEL
-- perso le joueur a utilisé à chaque combat, ce qui n'était jamais stocké (seul l'adversaire
-- l'était). À coller à la main dans l'éditeur SQL de Supabase.

alter table fights add column if not exists joueur_a_character_id bigint references characters(id);
create index if not exists idx_fights_joueur_a_character_id on fights(joueur_a_character_id);

-- Les combats déjà en base auront cette colonne à NULL : le perso favori et l'historique ne
-- pourront pas l'afficher pour ces anciens combats (traité comme "inconnu" côté serveur).
