-- GRAND LINE ARENA — comptes créés sans Twitch (pseudo + mot de passe), avec possibilité de
-- lier son compte Twitch plus tard. À coller à la main dans l'éditeur SQL de Supabase.

-- twitch_id était NOT NULL : un compte local n'en a pas tant qu'il n'a pas lié Twitch.
-- (les NULL multiples n'entrent pas en conflit avec la contrainte unique existante)
alter table players alter column twitch_id drop not null;

-- Jamais en clair : scryptSync (natif Node) + sel aléatoire par compte, stocké
-- "sel:hachage" — voir server/src/auth-local.ts.
alter table players add column if not exists mot_de_passe_hash text;

-- Pseudo unique, sensible à la casse (simplification assumée : "Mehdi" et "mehdi" pourraient
-- coexister, accepté vu la taille de la communauté). Vérifié avant d'appliquer : les pseudos
-- déjà en base (comptes Twitch) sont tous distincts, cette contrainte ne peut pas échouer.
alter table players add constraint players_pseudo_unique unique (pseudo);
