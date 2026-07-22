-- ═══════════════════════════════════════════════════════════════════════════
-- ONE PIECE ARENA — remet les vraies valeurs après MODE_TEST.sql.
--
-- À exécuter d'un bloc. Restaure exactement ce que contient seed/01_config.sql :
-- si tu as changé un équilibrage entre-temps, c'est CE fichier qui gagne, pense
-- à le réaligner.
-- ═══════════════════════════════════════════════════════════════════════════

-- Taux de drop réels (§3bis) — total = 1.
update config set valeur = '0.70'  where cle = 'drop_rate_commun';
update config set valeur = '0.22'  where cle = 'drop_rate_peu_commun';
update config set valeur = '0.075' where cle = 'drop_rate_rare';
update config set valeur = '0.005' where cle = 'drop_rate_epique';

-- Coût du tirage (§4).
update config set valeur = '100' where cle = 'cout_tirage_perso';

-- Courbe d'XP réelle : ~20 combats pour le niveau 2, ~60 pour le niveau 3.
update config set valeur = '140' where cle = 'xp_niveau_2';
update config set valeur = '420' where cle = 'xp_niveau_3';

-- Anti-frustration : 3 défaites consécutives (§4bis).
update config set valeur = '3' where cle = 'defaites_avant_bot_faible';

-- Remet l'énergie sur le quota normal. Les Berrys de test, eux, ne sont pas
-- remis à zéro automatiquement — à toi de voir (update players set berrys = ...).
update players set energie = 10 where pseudo = 'Mehdi';
update players set defaites_consecutives = 0 where pseudo = 'Mehdi';

-- Vérification : doit renvoyer les valeurs ci-dessus.
select cle, valeur from config
where cle like 'drop_rate%' or cle like 'xp_niveau%' or cle = 'defaites_avant_bot_faible'
   or cle = 'cout_tirage_perso'
order by cle;
