-- GRAND LINE ARENA — bascule les comptes locaux (pseudo + mot de passe) vers Supabase Auth,
-- pour profiter de son envoi d'email de réinitialisation intégré. À coller à la main.

-- Le mot de passe est désormais géré par Supabase Auth (table auth.users, hors de notre
-- schéma) — plus besoin de le stocker nous-mêmes.
alter table players drop column if exists mot_de_passe_hash;

-- Le lien vers l'utilisateur Supabase Auth correspondant. NULL pour un compte 100 % Twitch
-- (jamais passé par l'inscription locale).
alter table players add column if not exists auth_user_id uuid unique;
