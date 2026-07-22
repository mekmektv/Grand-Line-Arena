-- ONE PIECE ARENA — recharge de l'énergie et des changements de perso (§4).
--
-- Contexte : `players.derniere_recharge` existait depuis le schéma initial mais AUCUN code ne
-- la lisait. Résultat, l'énergie ne se rechargeait jamais et chaque joueur avait 10 combats à
-- vie. Idem pour les changements de perso "par semaine", jamais rendus.
--
-- L'énergie (quotidienne) et les changements (hebdomadaires) n'ont pas la même période : ils
-- ne peuvent donc pas partager le même horodatage, d'où cette colonne.
--
-- Idempotent : relançable sans risque.

alter table players
  add column if not exists derniere_recharge_changements timestamptz not null default now();

-- Les comptes existants n'ont jamais été rechargés : on les aligne sur leur dernière recharge
-- connue plutôt que sur maintenant, pour que la première recharge due parte du bon repère.
update players
set derniere_recharge_changements = derniere_recharge
where derniere_recharge_changements > derniere_recharge;
