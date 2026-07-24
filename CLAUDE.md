# GRAND LINE ARENA — mémo pour l'assistant

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

**Sons de combat : PC ≠ téléphone, deux pièges empilés (24/07/2026).** Voir détail plus bas
(§ Sons). Retenir la leçon générale : un bug audio qui "marche sur PC mais pas sur mobile" (ou
"marche mais en retard") n'est presque jamais le fichier son lui-même — c'est le mécanisme de
déblocage/démarrage du son qui diffère entre desktop et mobile. Tester au son réel sur téléphone,
pas seulement au typecheck + absence d'erreur console.

**Toute vue qui affiche PV/Attack doit inclure l'équipement.** `calculerStats()` a un 4ᵉ
paramètre optionnel (`equipement`) : l'oublier ne plante rien, ça affiche juste des stats fausses
en silence. Piège déjà tombé deux fois sur le même bug (Accueil et fiche perso l'oubliaient tous
les deux, corrigé le 24/07) — le combat, lui, l'a toujours eu via `equipementDuPerso()`. Avant
d'ajouter un nouvel endroit qui affiche PV/Attack, vérifier qu'il passe bien l'équipement du
perso à `calculerStats()`.

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

## État au 24/07/2026

**Le jeu est en ligne et jouable, sous le nom Grand Line Arena** (renommé le 23/07 — l'ancien
nom "One Piece Arena" ne doit plus apparaître nulle part, code compris). Base + config, moteur
de combat, gacha, tous les écrans, combat animé, XP des persos, recharge d'énergie, matchmaking
complet (§4bis), recyclage, quêtes, équipement, onboarding joué par le joueur, prime au
classement, fiche joueur détaillée au classement (§8 point 7).

### Petits retours utilisateur du 24/07/2026

- **Vitesse de combat** : bouton VITESSE cycle ×1 → ×2 → ×3 (au lieu de ×1/×2 seulement).
- **Écran VS** : le pseudo de l'adversaire s'affiche seul (plus de "le pirate de X", qui
  débordait avec les pseudos longs) ; le contour du portrait suit la **rareté**
  (`COULEUR_RARETE`), pas la classe — la couleur de classe reste utilisée pour le badge de
  classe et le dégradé de fond, ce sont deux informations différentes à ne pas mélanger.
- **Tableau des primes** : phrase d'explication sous le titre (comment on monte au classement).
- **Tirage** : bouton "ENCORE" renommé "RETOUR" ; le message sous INCARNER reflète le vrai coût
  du prochain changement de perso (`etat.prochain_changement_cout`) au lieu d'annoncer à tort
  que c'est toujours gratuit.
- **Fiche perso** : la barre d'XP et le seuil du niveau suivant étaient un reliquat de l'écran
  d'avant que le combat soit jouable — toujours à 0 % avec un message statique, alors que le
  serveur calculait déjà `progression_pct`/`xp_avant_prochain_niveau`, juste jamais branché côté
  affichage. Corrigé, et `quitterCombat()` (App.tsx) recharge maintenant la collection après
  chaque combat (elle ne l'était pas : XP visible seulement après un rafraîchissement manuel,
  changer d'onglet par exemple).

### Duel amical & rivaux (24/07/2026) — voir GAME_DESIGN §4quinquies

Défier un joueur depuis sa fiche (au classement) → **duel amical** : même combat PvP asynchrone que
le matchmaking, mais **sans aucun enjeu** (pas d'énergie, ni Berrys, ni XP, ni prime). Et deux
**rivaux** auto = les voisins de classement, étiquetés au classement.

- **C'est le même moteur.** `duelAmical()` (`combat-api.ts`) partage tout avec `lancerCombat()`
  mais **n'écrit aucune** mise à jour `players`/`collection` — il n'insère qu'une ligne `fights`.
  Route `POST /duel { cible }`. Le front réutilise l'écran `Combat` tel quel (panneau de fin
  allégé quand `combat.amical`, `gains` devient optionnel côté `api.ts`).
- ⚠️ **Colonne `fights.amical`** (`supabase/A_APPLIQUER_duel_amical.sql`) — **à appliquer AVANT
  de déployer** : `adversairesRecents()` filtre désormais `amical=eq.false`, et un combat normal
  **plante** si la colonne manque (PostgREST refuse le filtre sur une colonne inexistante). Piège
  d'ordonnancement classique : ne pas pousser le code avant que l'utilisateur ait collé le SQL.
- **Head-to-head** (« 3 V – 1 D ») lu en direct dans `fights`, **tout compris** (amical + normal,
  deux sens) — `lireHeadToHead()` dans `rivaux.ts`, requête PostgREST `or=(and(...),and(...))`.
- **Rivaux** = voisins de classement (`idsRivaux()`, pur, testé sur les cas limites). Aux
  extrémités on complète par l'autre côté (1er → 2e+3e). Aucune récompense à les battre : label,
  pas mécanique. `fiche-joueur.ts` reçoit désormais **deux ids** (cible + demandeur) pour calculer
  la confrontation et `est_moi` (pas de bouton défier sur sa propre fiche). Un rival est aussi
  signalé sur l'**écran VS** (badge « ⚔️ RIVAL », `adversaire.est_rival`) — jamais true pour un
  bot, donc pas de fuite de l'anti-frustration (§4bis).

### Décor de l'arène de combat (24/07/2026)

Le fond du combat n'est plus le dégradé bleu/sable dessiné au canvas : c'est une image,
**`web/public/arene-fond.jpg`** (nom volontairement neutre — changer de décor = remplacer ce seul
fichier, aucun code à toucher). Recadrée 3:4 pour l'arène. Chargée dans `Combat.tsx` (`fondRef`,
préchargée pendant l'écran VS) et dessinée en **cover** dans `drawBG()`, avec un **voile sombre
dégradé en bas** (`rgba(10,6,2,0)` → `.4` de 50 % à 100 % de la hauteur) pour détacher les persos
du sol — réglable en changeant ce seul `.4`. **Repli conservé** sur l'ancien dégradé si l'image ne
charge pas : un décor manquant ne bloque jamais un combat.
Pour **remplacer le décor** : recadrer en 3:4, puis — pixel-art → PNG quantisé palette 256
(~600 Ko) ; illustration/peint → JPG q90 (~150 Ko, pas de quantisation qui banderait les dégradés).
Garder le nom `arene-fond.jpg` (ou adapter l'extension dans `Combat.tsx` si tu passes en PNG).
`imageSmoothingEnabled` est mis à `true` pour CE dessin (on redimensionne une image ; le
nearest-neighbor des sprites scintillerait), les sprites le remettent à `false` localement.

### Connexion — deux chemins désormais (23/07/2026)

Le login n'est plus "un seul bouton Twitch" (§8 point 1 du GAME_DESIGN est dépassé sur ce
point précis) :

- **Twitch**, toujours mis en avant — seul chemin qui débloque présence live + tirages premium.
- **Email + mot de passe**, via **Supabase Auth** (pas de hachage maison, pas de dépendance
  npm — REST brut sur `/auth/v1/*`, voir `supabase-auth.ts`). Sert de porte de secours à un
  viewer qui ne veut pas connecter Twitch tout de suite. `players.auth_user_id` fait le pont ;
  notre cookie de session (`session.ts`) reste inchangé, Supabase Auth ne sert qu'à vérifier
  le mot de passe et envoyer l'email de réinitialisation.
- **Associer mon Twitch** (bandeau sur l'accueil, visible tant que `compte_lie_twitch` est
  faux) : un compte email peut lier son Twitch après coup, sans rien perdre. Réutilise
  `/auth/twitch/callback` avec un 3ᵉ cookie state (`NOM_COOKIE_STATE_LIER`) pour ne pas avoir
  à enregistrer une 2ᵉ URL de redirection côté Twitch.
- L'encart "Dev only — Connexion de test" a été **retiré** de l'écran public (la route restait
  404 en prod de toute façon, juste déroutant pour un viewer). Le login de dev
  (`/auth/dev/login?pseudo=X`) existe toujours, mais uniquement par URL directe, plus par bouton.

**Piège Supabase Auth déjà payé :** créer un abonnement EventSub Twitch demande un jeton
d'application (`client_credentials`), pas un jeton utilisateur — sans rapport avec Supabase
Auth, mais même famille d'erreur ("il faut le bon TYPE de jeton pour le bon endpoint"), déjà
rencontrée deux fois ce mois-ci (voir aussi Brique 6 plus bas).

### Combat — intro plus lisible (23/07/2026)

L'écran VS affichait `×1,1` sans contexte, et n'affichait **rien du tout** en l'absence
d'avantage (impossible de vérifier que c'était bien neutre). Remplacé par un matchup toujours
visible : `"Classe X vs Classe Y — avantage Classe X"` ou `"— neutre"`.

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

- **Saisons de prime** — la prime est cumulative, donc les anciens sont mécaniquement
  intouchables. Sans effet à 3 joueurs, mordra quand des viewers arriveront en cours de route.
- **Quête « ouvrir 1 coffre »** — retirée du catalogue faute d'un compteur de coffres ouverts
  en base (les objets recyclés disparaissent, impossible de les compter après coup).
- **Duel entre viewers + annonce dans le chat** — mis de côté volontairement (voir Brique 6
  ci-dessus), le duel lui-même n'est pas encore conçu. L'utilisateur préviendra quand l'attaquer.

### Décisions structurantes à connaître

**Sons (branchés le 23/07, effets passés en Web Audio le 24/07).** Module dédié `web/src/sons.ts`.
Rien n'est codé en dur par personnage : le choix du son suit des propriétés déjà présentes dans
les données (classe `Sabreur` → épée, animation de projectile présente → projectile, `categorie`
du spécial → spécial/transformation) — un nouveau perso hérite automatiquement des bons sons sans
toucher au code, tant que sa classe et la catégorie de son spécial sont correctement renseignées.

⚠️ **Les EFFETS (coups, crit, spécial, clash…) utilisent la Web Audio API, pas `<audio>`** —
buffers décodés d'avance (`fetch` + `decodeAudioData` au chargement du module), joués via
`AudioBufferSourceNode`. Raison, trouvée en deux temps le 24/07 sur retour utilisateur :
1. Un `<audio>.play()` a un temps de démarrage perceptible sur mobile (invisible sur PC) : ça
   décalait TOUS les sons de combat par rapport à l'impact à l'écran, de façon constante sur tout
   le combat. `AudioBufferSourceNode` démarre quasi instantanément, ça règle le décalage.
2. Un `AudioContext` démarre **suspendu** tant qu'un geste utilisateur ne l'a pas débloqué —
   `debloquerSons()` appelle `contexte.resume()` en tout premier dans `combattre()` (App.tsx),
   de façon SYNCHRONE avant le premier `await`, sinon ce n'est plus dans le geste. Piège restant
   même après ce fix : le clash sonne dès le montage de l'écran VS, potentiellement AVANT que la
   promesse de `resume()` soit tenue (contrairement à un vieux `<audio>.play()` qui attendait
   tout seul, un `source.start()` programmé pendant que le contexte est encore suspendu ne joue
   simplement pas — silencieux, sans erreur). `jouerEffet()` vérifie donc `contexte.state` et
   attend la reprise avant de programmer la lecture si besoin, sans ralentir les sons suivants
   (le cas courant, contexte déjà prêt à ce moment-là).
- La **musique** reste un `<audio>` classique (boucle en streaming, pas un effet synchronisé à
  une frame précise, la latence de démarrage n'y change rien) : elle saute les 20 premières
  secondes du fichier à **chaque** reprise de boucle (pas seulement au premier lancement) — géré
  manuellement (`ended` + `currentTime`), pas via l'attribut `loop` natif qui repartirait de 0.
- **Ouverture** : `clash` sonne dès l'écran VS, et la musique démarre juste après — enchaînement
  piloté par `onended` du buffer du clash, **pas une durée fixe devinée**. Si le buffer n'est pas
  encore décodé, la musique démarre quand même (un clash absent ne doit jamais couper la musique).
- **Impact** : coup normal / épée (classe `Sabreur`) / projectile — son joué à l'IMPACT, pas au
  lancer. Le critique **remplace** le son de coup, il ne s'y ajoute pas. Les spéciaux à
  projectile (Sniper) jouent aussi le son `coup_projectile` à l'impact.
- **Spécial** : son `special` au lancement de l'anim pour les spéciaux à dégâts ; son
  `transformation` pour les spéciaux qui buffent OU qui transforment (retour utilisateur du
  23/07 : un buff, visuellement, se lit comme une transfo — même son que la vraie transfo).
- **KO retiré** (retour utilisateur : "il est nul"), victoire/défaite suffisent.
- **Mute** : bouton 🔊/🔇 sur l'écran de combat, à côté de VITESSE. Coupe le son sans jamais
  mettre en pause — les effets continuent de se déclencher à volume 0 (gain à 0 en Web Audio),
  donc aucune désynchro possible avec l'animation. Préférence retenue en `localStorage`
  (`gla_sons_muets`).
- Volumes réajustés à l'oreille par l'utilisateur plusieurs fois (23-24/07) : musique -30 % une
  fois pour toutes, effets remontés par étapes cumulatives (+10 %, +15 %, +10 % de plus), et
  `coup_normal` (attaque de base au corps à corps) +25 % en plus de ça, nettement plus faible que
  les autres sons. Réglages dans `VOLUME_MAITRE`/`VOLUME_RELATIF` de `sons.ts` — à réajuster à
  l'oreille si un nouveau retour arrive, pas à deviner.

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
`_equipement`, `_equipement_2`, `_onboarding`, `_prime_et_bots`, `_twitch` (Brique 6),
`_fiche_joueur`, `_compte_local`, `_supabase_auth` (ce dernier remplace le contenu du
précédent : `mot_de_passe_hash` supprimé, `auth_user_id` ajouté).

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
