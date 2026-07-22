# ONE PIECE ARENA — mémo pour l'assistant

Jeu de collection/combat pour les viewers Twitch d'une chaîne. Mobile portrait.
**Le doc de référence est `GAME_DESIGN (1).md`** — il fait autorité sur les règles du jeu.
Ce fichier-ci ne décrit que ce qu'il faut savoir pour *travailler* sur le projet.

L'utilisateur est **débutant en développement**. Expliquer les décisions techniques en français
simple, éviter le jargon non nécessaire, et ne jamais supposer qu'il saura corriger seul.
Il n'utilise pas de terminal : lui proposer de lancer les commandes à sa place.

**En ligne : <https://grand-line-arena.vercel.app>** · dépôt :
<https://github.com/mekmektv/Grand-Line-Arena> (public) · chaque `git push` redéploie.

---

## 🔴 Pièges déjà payés — ne pas les repayer

**Il y a DEUX typechecks, et longtemps un seul existait.**
Le front se vérifie avec `tsc -b` (jamais `tsc --noEmit -p tsconfig.json` : `web/tsconfig.json`
contient `"files": []` et ne référence que `tsconfig.app.json`, donc `-p` ne vérifie **rien**
et sort en succès). Le serveur, lui, n'avait **aucun** tsconfig jusqu'au 22/07/2026 : il n'a
jamais été typé de tout le projet, et le déploiement Vercel a révélé une centaine d'erreurs
dormantes d'un coup.

```bash
npm run typecheck        # serveur + api  (tsconfig.json racine)
npm run typecheck:web    # front
npm run validate         # les 6 scripts de validation d'affilée
cd web && npx oxlint src
```

`allowImportingTsExtensions` est **obligatoire** dans le tsconfig racine : le serveur s'exécute
en TypeScript direct (`node src/server.ts`), donc Node exige l'extension `.ts` dans les imports,
ce que TypeScript refuse sans cette option (erreur TS5097).

**Le serveur Node ne recharge PAS à chaud.** Après toute modification dans `server/src/`, il
faut le redémarrer, sinon l'API sert encore l'ancien code (symptôme typique : le front est à
jour mais des champs de réponse manquent). Le front, lui, est en Vite et se recharge seul.

**Chrome ralentit les timers des onglets en arrière-plan.** Mesuré : un `setTimeout(16 ms)`
se déclenche toutes les ~611 ms dans un onglet caché, soit 38× plus lent. Un combat ou une
roulette qui semble « bloqué » pendant un pilotage automatisé du navigateur n'est presque
jamais un bug — vérifier `document.hidden` avant de chercher plus loin.

**Ne pas éditer un fichier pendant qu'une animation le fait tourner.** Le rechargement à chaud
remonte le composant : la logique continue sur l'ancienne instance et l'affichage se fige.
Recharger la page après édition avant de conclure quoi que ce soit.

**Les captures d'écran calent souvent** (le canvas de combat tourne en boucle). Préférer
`get_page_text`, `read_page`, ou du JS qui échantillonne le DOM et stocke dans `window.__x`,
puis relire dans un second appel — un seul appel long dépasse le délai d'attente.

**Déploiement Vercel — quatre pièges payés en une seule session.** Voir `DEPLOIEMENT.md`.

1. **`functions.includeFiles` est indispensable.** Vercel n'embarque PAS `server/src/` dans le
   paquet de la fonction sous prétexte qu'il est importé : sans ce réglage, la fonction plante
   au chargement avec un `FUNCTION_INVOCATION_FAILED` **sans aucun message**. C'était la cause
   racine de tous les échecs, et elle a été cherchée pendant des heures.
2. **Les fichiers « attrape-tout » ne marchent pas.** `[[...x]].ts` n'est pas reconnu, et
   `[...x].ts` ne capture qu'**un seul niveau** — `/api/etat` passait, `/api/auth/dev/login`
   renvoyait un 404 de Vercel. D'où la règle explicite `/api/(.*)` dans `vercel.json`.
3. **Un déploiement `Ready` (vert) peut contenir 100 erreurs TypeScript** et servir une
   fonction cassée. Le statut vert ne prouve rien : lire les logs de **build**.
4. **`import.meta.url` n'a pas la forme attendue** dans le paquet compilé — `load-env.ts` ne
   s'exécute donc plus que hors plateforme (test sur `process.env.VERCEL`).

**Méthode :** quand une plateforme échoue, demander les logs à l'utilisateur AVANT de corriger.
Trois correctifs ont été tentés à l'aveugle ici, dont un a créé un nouveau bug ; c'est le log de
build fourni par l'utilisateur qui a débloqué la situation.

---

## Lancer le projet

Les deux serveurs sont dans `.claude/launch.json` (à démarrer avec l'outil de preview, pas
avec Bash) :

| Nom | Port | Quoi |
|---|---|---|
| `server` | 8787 | API (`node server/src/server.ts`) |
| `web` | 5173 | Front (Vite) |

Connexion de dev, sans Twitch : <http://localhost:8787/auth/dev/login?pseudo=Mehdi>
(⚠️ locale uniquement : `DEV_AUTH_ENABLED=false` en production, la route y répond 404.)

Validation (logique pure, ni base ni horloge) :

```bash
node server/scripts/validation.ts             # moteur de combat
node server/scripts/validation-gacha.ts       # taux de drop
node server/scripts/validation-recharge.ts    # énergie, semaine, prix des changements
node server/scripts/validation-quetes.ts      # périodes et progression des quêtes
node server/scripts/validation-equipement.ts  # budgets des objets
node server/scripts/validation-prime.ts       # prime : jamais décroissante, zéro contre un bot
```

Simulations d'économie (elles chiffrent, elles ne valident pas) :

```bash
node server/scripts/simu-quetes.ts       # ce que les quêtes ajoutent, par profil de joueur
node server/scripts/simu-equipement.ts
```

Utilitaires de base (lisent/écrivent vraiment) :

```bash
node server/scripts/verif-colonnes.ts                # colonnes présentes + liste des joueurs
node server/scripts/etat-compte.ts <twitch_id>       # inventaire d'un compte
node server/scripts/supprimer-compte.ts <twitch_id>  # remet un compte à zéro pour retester
node server/scripts/crediter-coffre-premium.ts <twitch_id> <n>  # Brique 6 : teste sans vraie redemption
node server/scripts/crediter-presence.ts <twitch_id> <montant>  # Brique 6 : teste le rond sans vrai live
```

---

## Architecture

- `server/src/` — API sans framework (`node:http`), **zéro dépendance npm**. Ne pas ajouter
  Express ni le SDK Supabase : tout passe par `fetch` et l'API REST (PostgREST) via
  `supabase.ts`. La clé utilisée est **service_role**, donc jamais exposée au navigateur.
- `api/index.ts` — l'adaptateur qui sert cette même API en production. **Aucune logique de jeu
  ne doit y entrer** : il reconstitue le chemin et délègue à `gererRequete` de `server.ts`.
  Le routeur est donc partagé, jamais dupliqué (une copie finirait par diverger, et on
  déboguerait un comportement impossible à reproduire en local).
- `web/src/` — React + Vite. Styles en `style={{}}` inline, animations en keyframes CSS dans
  `index.css`. Pas de librairie d'UI.
- `supabase/migrations/` et `supabase/seed/` — le schéma et les valeurs.
- `tsconfig.json` (racine) couvre `api/` + `server/` ; `web/` a le sien.

**Séparation logique pure / accès base**, à respecter pour tout nouveau module :

| Pur (aucune base, testable seul) | Branchement base |
|---|---|
| `combat.ts`, `gacha.ts`, `progression.ts`, `recharge.ts`, `stats.ts`, `quetes.ts`, `equipement.ts`, `prime.ts` | `combat-api.ts`, `tirage-api.ts`, `recharge-api.ts`, `quetes-api.ts`, `equipement-api.ts`, `collection.ts`, `recyclage.ts`, `onboarding.ts` |

**Le combat est déterministe côté serveur.** Le serveur calcule une liste d'événements ; le
front ne fait que la rejouer. Le client ne calcule jamais un résultat de jeu.

**Front et API partagent le même domaine** en production (front à la racine, API sous `/api`).
C'est ce qui évite le CORS et surtout le cookie de session refusé entre deux domaines. Le front
n'a donc **aucune variable à configurer** : sans `VITE_API_URL`, il appelle `/api`.

---

## 🔑 Règle d'or

**Aucune valeur de gameplay en dur dans le code.** Tout vit dans la table `config` ou dans
`characters`. `chargerConfig()` *plante volontairement* si une clé manque, avec son nom — il
ne faut jamais ajouter de valeur par défaut pour « éviter l'erreur ».

Nuance admise : les réglages **purement décoratifs** peuvent rester dans le code s'ils ne
peuvent pas changer ce que le joueur obtient. Exemple documenté : les proportions du défilé de
la roulette (`POIDS_DEFILE` dans `Tirage.tsx`), qui n'influencent aucune chance de tirage.

**Conséquence pratique :** ajouter une clé de config oblige l'utilisateur à coller du SQL dans
l'éditeur Supabase (il n'y a ni CLI `supabase` ni `psql` sur cette machine). Les `INSERT` dans
`config` peuvent être poussés via l'API REST, mais **jamais le DDL** (`alter table`) — celui-là
doit passer par l'utilisateur. Lui fournir un fichier `supabase/A_APPLIQUER_*.sql` prêt à coller.

⚠️ **Toute clé ajoutée en base doit AUSSI aller dans `supabase/seed/01_config.sql`.** Oubli déjà
commis : les clés poussées par l'API REST manquaient au seed, et les scripts de validation —
qui lisent le seed, pas la base — se sont mis à planter. Une base recréée aurait été incomplète.

---

## État au 22/07/2026

**Le jeu est en ligne et jouable.** Base + config, moteur de combat, login Twitch réel, gacha,
tous les écrans, combat animé, XP des persos, recharge d'énergie, matchmaking complet (§4bis),
recyclage, quêtes, équipement, onboarding joué par le joueur, prime au classement.

### Brique 6 (Twitch en live) — présence et coffre premium FAITS

Câblés et configurés en production (voir GAME_DESIGN §5/§5bis pour le détail des règles) :

- **Présence en live → Berrys.** Cron externe (cron-job.org, appel `/cron/presence` toutes les
  1 min — le Cron de Vercel ne permet qu'un déclenchement/jour sur le plan gratuit, insuffisant
  ici) qui interroge Get Chatters. Les Berrys s'accumulent dans un compteur "en attente"
  (`players.presence_berrys_en_attente`), **jamais crédités automatiquement** : le joueur les
  encaisse lui-même en cliquant sur le rond du bandeau Twitch de l'accueil.
- **Coffre premium** (uniquement le tirage perso, pas l'équipement — décidé le 22/07/2026) :
  Custom Reward Twitch à 1000 points, 1×/viewer/live, meilleurs taux
  (`drop_rates_premium` en config). Crédité via webhook EventSub sur la redemption, dans
  `players.coffres_premium_perso`. Bouton "ROLL PERSONNAGE PREMIUM" sur l'écran Coffres,
  toujours visible avec un compteur rond (x0 inclus), pas caché à zéro.
- **Statut live réel** sur le bandeau de l'accueil (`etat.live_en_direct`, mis à jour par
  `stream.online`/`.offline`), avec un lien cliquable vers la vraie chaîne Twitch.
- Autorisation **du streamer** séparée du login joueur normal (`/auth/twitch/streamer/login`,
  scopes élevés, jeton stocké en base avec refresh — voir `twitch-broadcaster.ts`).

⚠️ **Le backend tourne en fonction Vercel serverless, pas sur Railway** (l'ancien plan
"3 briques" plus bas est dépassé) — une fonction Vercel ne tient pas de connexion permanente,
d'où EventSub en **webhook** (pas WebSocket) et le cron externe plutôt qu'une boucle interne.

**Reste de la Brique 6** : l'annonce dans le chat quand un viewer défie et bat un autre viewer
en duel — **mise de côté** (fonctionnalité de duel elle-même pas encore conçue), l'utilisateur
préviendra quand l'attaquer. Pas encore testé en conditions réelles (prochain live).

### Reste à faire

- **Sons** — non commencé, repoussé par l'utilisateur.
- **Saisons de prime** — la prime est cumulative, donc les anciens sont mécaniquement
  intouchables. Sans effet à 3 joueurs, mordra quand des viewers arriveront en cours de route.
- **Quête « ouvrir 1 coffre »** — retirée du catalogue faute d'un compteur de coffres ouverts
  en base (les objets recyclés disparaissent, impossible de les compter après coup).
- **Encart « Dev only — Connexion de test »** — toujours affiché sur le site public. Le bouton
  ne fait plus rien (route en 404), mais c'est déroutant pour un viewer.
- **Fiche joueur détaillée** au classement (palmarès, derniers combats).
- **Duel entre viewers + annonce dans le chat** — voir ci-dessus.

### Décisions structurantes à connaître

**Onboarding (refait le 21/07).** Le compte se crée **vide**. Les deux tirages du §4 sont joués
par le joueur : roll forcé Commun à la connexion, puis coffre offert après le premier combat.
Étapes dans `players.onboarding_etape` (0→3), tableau détaillé dans `GAME_DESIGN` §4.
Trois pièges corrigés, à ne pas réintroduire :
1. `Tirage` appelait `onEtatChange()` dès la réponse serveur : l'étape avançait et `App`
   **démontait l'écran au milieu de l'animation**. En mode onboarding, le rafraîchissement doit
   attendre `onTermine`.
2. Le voile du tutoriel (`position:absolute; inset:0`) **avalait le clic** sur le bouton qu'il
   mettait en lumière : le trou du projecteur est un `box-shadow`, pas un vrai trou. D'où
   `pointerEvents:'none'` sur le voile de l'étape 2.
3. `onTermine` sans `recommencer()` laissait la carte affichée avec les boutons du mode normal.

**Équipement.** Par perso (`equipment.collection_id` NULL = inventaire global). Un objet équipé
ne peut qu'être **recyclé**. **Sacrifice direct** : 6 objets Gris → coffre Vert garanti,
4 Vert → coffre Bleu (les objets sont la monnaie, il n'y a aucune table de « pièces » — une
première version en avait une, supprimée par `A_APPLIQUER_equipement_2.sql`).
Budgets : Gris 2 / Vert 4 / Bleu 6 points (1 pt = 9 PV = 1 ATK).
⚠️ **Les bots n'ont jamais d'équipement** — voulu, pas un oubli.
Écran : le **coffre seul** dans l'onglet Coffres ; l'**inventaire + sacrifice** dans l'onglet
ÉQUIPEMENT de `Collection.tsx`, qui affiche **un seul perso à la fois** — surtout ne pas revenir
à la liste de tous les persos équipés, c'était illisible.

**Quêtes.** Progression LUE en direct dans `fights`/`collection` (aucun compteur en base),
réclamations dans `quetes_reclamees`. Montants chiffrés le 22/07 par `simu-quetes.ts` : le
défaut n'était pas l'inflation mais l'écart (+32 % à l'assidu, **0 %** à l'occasionnel).
⚠️ **La clé `sem_gagner_20` garde son nom** malgré l'objectif passé à 14 : la renommer
déclasserait les réclamations déjà en base et rouvrirait la quête pour la semaine en cours.
Une clé de quête est un identifiant, pas une description.

**Prime (§8).** Cumulative, jamais décroissante, pondérée par la force de l'adversaire,
**zéro contre un bot** — sinon l'anti-frustration (bot faible après 3 défaites) deviendrait une
machine à prime et perdre exprès serait optimal. `validation-prime.ts` teste ce scénario.

**Matchmaking (§4bis, complet).** Pool de 13 bots écrits à la main en `config.bots_pool` (3
faibles réservés à l'anti-frustration). Le niveau d'un bot vient de la config, **pas** du
joueur. Anti-répétition sur 4 combats, avec **repli assumé** : si écarter les 4 derniers ne
laisse plus personne, l'exclusion saute — à 2 joueurs, la règle stricte rendrait tout combat
impossible.

### Base de données

Tout le SQL est appliqué. Fichiers dans `supabase/` : `A_APPLIQUER_recharge.sql`, `_quetes`,
`_equipement`, `_equipement_2`, `_onboarding`, `_prime_et_bots`.

⚠️ **`fights` référence `players` SANS `on delete cascade`** (contrairement à `collection`,
`equipment`, `quetes_reclamees`). Supprimer un joueur impose d'effacer ses combats d'abord —
c'est ce que fait `server/scripts/supprimer-compte.ts <twitch_id>`.

---

## Conventions

- **Tout est en français** : code, commentaires, noms de variables, messages d'erreur.
- Les commentaires expliquent **pourquoi**, pas quoi. Beaucoup renvoient à un § du
  `GAME_DESIGN` — garder cette habitude.
- Quand une décision est un compromis assumé, l'écrire dans le code **et** dans le `GAME_DESIGN`.
- **Ne pas inventer une valeur d'équilibrage.** Si le doc ne la chiffre pas, demander — et si
  l'utilisateur propose un chiffre, le **simuler avant de l'appliquer** : il a proposé un
  objectif hebdo à 16 qui, mesuré, ne changeait rien pour personne.
- Ne jamais demander ni manipuler un secret en clair. Les valeurs sensibles se collent dans
  l'interface de l'hébergeur ; pour en générer une, l'écrire dans un fichier hors dépôt.
