-- ═══════════════════════════════════════════════════════════════════════════
-- ONE PIECE ARENA — MODE TEST (temporaire !)
--
-- Rend observables en quelques clics des choses qui, en vrai, demandent des
-- heures de jeu : un Épique à 0,5 %, un niveau 2 à 20 combats, un bot faible
-- à 3 défaites d'affilée.
--
-- ⚠️ NE JAMAIS LAISSER EN PLACE. Repasse par MODE_TEST_ANNULER.sql quand tu as
--    fini — sinon tes viewers tirent des Épiques à la chaîne.
--
-- À exécuter bloc par bloc (surligne le bloc → Run), pas d'un coup.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── A. Tirage : forcer la rareté qui sort ──────────────────────────────────
-- Les 4 taux DOIVENT totaliser 1 : chargerConfig refuse de démarrer sinon
-- (c'est le garde-fou "un tirage perd des chances silencieusement").
-- Décommente UN bloc à la fois, puis fais un tirage.

-- ► 100 % ÉPIQUE (secousse violente, écran qui tremble, silhouette qui se colore)
update config set valeur = '0'   where cle = 'drop_rate_commun';
update config set valeur = '0'   where cle = 'drop_rate_peu_commun';
update config set valeur = '0'   where cle = 'drop_rate_rare';
update config set valeur = '1'   where cle = 'drop_rate_epique';

-- ► 100 % RARE (rayons, confettis, pause sur le dos de carte)
-- update config set valeur = '0' where cle = 'drop_rate_commun';
-- update config set valeur = '0' where cle = 'drop_rate_peu_commun';
-- update config set valeur = '1' where cle = 'drop_rate_rare';
-- update config set valeur = '0' where cle = 'drop_rate_epique';

-- ► 100 % COMMUN (cérémonie courte, aucun confetti, flip direct)
-- update config set valeur = '1' where cle = 'drop_rate_commun';
-- update config set valeur = '0' where cle = 'drop_rate_peu_commun';
-- update config set valeur = '0' where cle = 'drop_rate_rare';
-- update config set valeur = '0' where cle = 'drop_rate_epique';

-- Tirage gratuit, pour enchaîner sans se soucier du solde.
update config set valeur = '0' where cle = 'cout_tirage_perso';


-- ── B. XP : voir une montée de niveau tout de suite ────────────────────────
-- 1 combat gagné = niveau 2, 2 combats = niveau 3 (au lieu de 20 et 60).
update config set valeur = '10' where cle = 'xp_niveau_2';
update config set valeur = '20' where cle = 'xp_niveau_3';


-- ── C. Bot faible : déclencher l'anti-frustration dès la 1re défaite ───────
update config set valeur = '1' where cle = 'defaites_avant_bot_faible';

-- Variante plus directe : se déclarer déjà en série de défaites, sans avoir à
-- perdre. Remplace le pseudo par le tien.
-- update players set defaites_consecutives = 5 where pseudo = 'Mehdi';


-- ── D. Confort : Berrys et énergie à volonté ───────────────────────────────
-- L'énergie (10 combats/jour) est ce qui te bloquera le plus vite en test.
update players set berrys = 100000, energie = 999 where pseudo = 'Mehdi';


-- ── E. Vérifier l'état courant ─────────────────────────────────────────────
select cle, valeur from config
where cle like 'drop_rate%' or cle like 'xp_%' or cle = 'defaites_avant_bot_faible'
   or cle = 'cout_tirage_perso'
order by cle;
