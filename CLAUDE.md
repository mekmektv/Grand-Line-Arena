# ONE PIECE ARENA — mémo pour l'assistant

Jeu de collection/combat pour les viewers Twitch d'une chaîne. Mobile portrait.
**Le doc de référence est `GAME_DESIGN (1).md`** — il fait autorité sur les règles du jeu.
Ce fichier-ci ne décrit que ce qu'il faut savoir pour *travailler* sur le projet.

L'utilisateur est **débutant en développement**. Expliquer les décisions techniques en français
simple, éviter le jargon non nécessaire, et ne jamais supposer qu'il saura corriger seul.

---

## 🔴 Pièges déjà payés — ne pas les repayer

**Le typecheck du front, c'est `tsc -b`, jamais `tsc --noEmit -p tsconfig.json`.**
`web/tsconfig.json` contient `"files": []` et ne fait que référencer `tsconfig.app.json` :
la commande avec `-p` ne vérifie donc **rien du tout** et sort en succès. Une session entière
a annoncé « ça compile » à tort avant de s'en apercevoir.

```bash
cd web && npx tsc -b --force && npx oxlint src
```

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

---

## Lancer le projet

Les deux serveurs sont dans `.claude/launch.json` (à démarrer avec l'outil de preview, pas
avec Bash) :

| Nom | Port | Quoi |
|---|---|---|
| `server` | 8787 | API (`node server/src/server.ts`) |
| `web` | 5173 | Front (Vite) |

Connexion de dev, sans Twitch : <http://localhost:8787/auth/dev/login?pseudo=Mehdi>

Validation (logique pure, ni base ni horloge) :

```bash
node server/scripts/validation-recharge.ts   # énergie, semaine, prix des changements
node server/scripts/validation-gacha.ts      # taux de drop
node server/scripts/validation.ts            # moteur de combat
node server/scripts/validation-quetes.ts     # périodes et progression des quêtes
node server/scripts/validation-equipement.ts # budgets des objets
node server/scripts/validation-prime.ts      # prime : jamais décroissante, zéro contre un bot
```

Simulations d'économie (pas des tests : elles chiffrent, elles ne valident pas) :

```bash
node server/scripts/simu-quetes.ts           # ce que les quêtes ajoutent, par profil de joueur
node server/scripts/simu-equipement.ts
```

Utilitaires de base (lisent/écrivent vraiment) :

```bash
node server/scripts/etat-compte.ts <twitch_id>       # inventaire d'un compte
node server/scripts/supprimer-compte.ts <twitch_id>  # remet un compte à zéro pour retester
```

---

## Architecture

- `server/src/` — API sans framework (`node:http`), **zéro dépendance npm**. Ne pas ajouter
  Express ni le SDK Supabase : tout passe par `fetch` et l'API REST (PostgREST) via
  `supabase.ts`. La clé utilisée est **service_role**, donc jamais exposée au navigateur.
- `web/src/` — React + Vite. Styles en `style={{}}` inline, animations en keyframes CSS dans
  `index.css`. Pas de librairie d'UI.
- `supabase/migrations/` et `supabase/seed/` — le schéma et les valeurs.

**Séparation logique pure / accès base**, à respecter pour tout nouveau module :

| Pur (aucune base, testable seul) | Branchement base |
|---|---|
| `combat.ts`, `gacha.ts`, `progression.ts`, `recharge.ts`, `stats.ts` | `combat-api.ts`, `tirage-api.ts`, `recharge-api.ts`, `collection.ts`, `recyclage.ts` |

**Le combat est déterministe côté serveur.** Le serveur calcule une liste d'événements ; le
front ne fait que la rejouer. Le client ne calcule jamais un résultat de jeu.

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

---

## État au 22/07/2026

**Fait :** base + config, moteur de combat, login (Twitch codé mais pas branché, login de
secours actif), gacha, tous les écrans, combat animé, XP des persos, recharge d'énergie,
matchmaking anti-frustration, recyclage, **quêtes** (jour + semaine + succès de collection).

**Les trois bloquants avant d'ouvrir aux viewers :**

1. ~~L'énergie ne se rechargeait jamais~~ → **réglé le 20/07**.
2. **`DEV_AUTH_ENABLED=true`** — `/auth/dev/login?pseudo=X` crée une session sans aucune
   vérification. En production, n'importe qui se fabrique des comptes. L'app Twitch est créée et
   le vrai login marche (21/07) : il ne reste qu'à passer ce drapeau à `false` au déploiement.
3. **Rien n'est déployé** — tout tourne en local. Cible prévue : Vercel (front) + Railway (back).
   Recommandation donnée : déployer *avant* la Brique 6, pas après.

**Ensuite :** Brique 6 (EventSub Twitch, présence → Berrys, points de chaîne, roll premium,
annonce des tirages Épiques dans le chat).

**Quêtes (fait le 21/07) :** logique pure `quetes.ts` + branchement `quetes-api.ts`, routes
`GET /quetes` et `POST /quetes/reclamer`, écran `Quetes.tsx` + encart de l'Accueil, validation
`validation-quetes.ts`. Catalogue des 12 quêtes en config (`quetes_catalogue`), progression LUE
en direct dans `fights`/`collection` (aucun compteur en base), réclamations dans la table
`quetes_reclamees`. **SQL déjà appliqué** (`supabase/A_APPLIQUER_quetes.sql`). Montants **chiffrés le 22/07**,
voir plus bas.

**Équipement (back fait le 21/07) :** logique pure `equipement.ts` + branchement `equipement-api.ts`,
routes `GET /equipement`, `POST /coffre`, `POST /equipement/equiper`, `POST /equipement/recycler`.
Validation `validation-equipement.ts` (verte), simulation d'économie `simu-equipement.ts`.
**SQL déjà appliqué** (`supabase/A_APPLIQUER_equipement.sql`, sans RLS comme le reste).
Décisions : équipement **par perso** (`equipment.collection_id` NULL = inventaire global),
un objet équipé ne peut qu'être **recyclé**, et **sacrifice direct** : sélectionner **6 objets
Gris → coffre Vert garanti / 4 Vert → coffre Bleu** (les objets sont la monnaie, il n'y a aucune
table de « pièces » — une première version en avait une, supprimée par `A_APPLIQUER_equipement_2.sql`).
Budgets : Gris 2 / Vert 4 / Bleu 6 points (1 pt = 9 PV = 1 ATK).
⚠️ **Les bots n'ont jamais d'équipement** — voulu, pas un oubli.
**Écran fait le 21/07 aussi :** `components/Equipement.tsx` — le **coffre seul** dans l'onglet
Coffres (`Tirage.tsx`, visuel calqué sur le roll perso via `components/CoffreSvg.tsx`, extrait de
`Tirage.tsx` pour éviter un import circulaire). L'**inventaire + le sacrifice** dans l'onglet
ÉQUIPEMENT de `Collection.tsx`, qui affiche **un seul perso à la fois** (sélecteur de persos en
haut) — surtout ne pas revenir à la liste de tous les persos équipés, c'était illisible.
**Reste :** la quête « ouvrir 1 coffre » toujours `actif:false` faute d'un compteur de coffres
ouverts en base (les objets recyclés disparaissent, on ne peut pas les compter après coup).

**Login Twitch (fait le 21/07) :** l'app est créée sur `dev.twitch.tv`, les clés sont dans
`server/.env`, et le vrai login fonctionne de bout en bout. `DEV_AUTH_ENABLED` est **toujours à
`true`** — c'est le dernier verrou à fermer avant d'ouvrir aux viewers.

**Onboarding refait le 21/07 :** le compte se crée **vide** ; les deux tirages du §4 sont joués
par le joueur (roll forcé Commun à la connexion, coffre offert après le premier combat). Voir le
tableau des étapes dans `GAME_DESIGN` §4. SQL déjà appliqué (`A_APPLIQUER_onboarding.sql` :
`players.onboarding_etape` + `players.avatar_url`). L'avatar Twitch est lu à chaque connexion.
Trois pièges rencontrés, tous corrigés — ne pas les réintroduire :
1. `Tirage` appelait `onEtatChange()` dès la réponse serveur : l'étape avançait et `App`
   **démontait l'écran au milieu de l'animation**. En mode onboarding, le rafraîchissement doit
   attendre `onTermine`.
2. Le voile du tutoriel (`position:absolute; inset:0`) **avalait le clic** sur le bouton qu'il
   mettait en lumière : le trou du projecteur est un `box-shadow`, pas un vrai trou. D'où
   `pointerEvents:'none'` sur le voile de l'étape 2.
3. `onTermine` sans `recommencer()` laissait la carte affichée avec les boutons du mode normal.

⚠️ **`fights` référence `players` SANS `on delete cascade`** (contrairement à `collection`,
`equipment`, `quetes_reclamees`). Supprimer un joueur impose d'effacer ses combats d'abord —
c'est ce que fait `server/scripts/supprimer-compte.ts <twitch_id>`.

**Dettes réglées le 22/07 :**
- **Récompenses de quêtes chiffrées** (`server/scripts/simu-quetes.ts`). Le défaut n'était pas
  l'inflation mais l'écart : les quêtes donnaient +32 % à l'assidu et **0 %** à l'occasionnel.
  Hebdo passée de « gagner 20 → 200 » à « gagner 14 → 160 » (à 16, le joueur régulier la ratait
  d'exactement 1 victoire et rien ne changeait pour personne). Quête « ouvrir 1 coffre » retirée
  du catalogue. ⚠️ **La clé `sem_gagner_20` garde son nom** malgré l'objectif à 14 : la renommer
  déclassait les réclamations déjà en base et rouvrait la quête pour la semaine en cours.
- **Pool de bots** (`config.bots_pool`, 13 bots) et **anti-répétition** sur 4 combats, §4bis
  désormais couvert en entier. Le niveau d'un bot vient de la config, plus du joueur.
- **Prime** (`prime.ts` + `validation-prime.ts`) : le classement ne trie plus par Berrys.
  Cumulative, jamais décroissante, pondérée par la force de l'adversaire, **zéro contre un bot**.

**Non commencé :** sons, saisons de prime (les anciens sont mécaniquement intouchables).

**En attente de l'utilisateur :** déposer `web/public/berry.png` et
`web/public/perso-verrouille.png`. Tant qu'ils manquent, un repli affiche l'ancien rendu
(emoji 💰, aplat sombre) — donc « je ne vois pas les modifs » veut dire « les fichiers ne sont
pas là », pas « le code est cassé ».

---

## Conventions

- **Tout est en français** : code, commentaires, noms de variables, messages d'erreur.
- Les commentaires expliquent **pourquoi**, pas quoi. Beaucoup renvoient à un § du
  `GAME_DESIGN` — garder cette habitude.
- Quand une décision est un compromis assumé, l'écrire dans le code **et** dans la section
  « Simplifications assumées » du `GAME_DESIGN`.
- Ne pas inventer une valeur d'équilibrage. Si le doc ne la chiffre pas, demander.
