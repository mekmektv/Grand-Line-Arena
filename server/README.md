# ⚔️ Moteur de combat + connexion Twitch — ONE PIECE ARENA

Le moteur prend **2 persos + leur niveau** et rend **le vainqueur + la liste des événements**
que le front rejouera. Depuis la Brique 3, il y a aussi un petit serveur HTTP qui gère la
**connexion Twitch** (OAuth) et l'**onboarding** du joueur.

## Lancer la validation du moteur de combat / gacha

```bash
node server/scripts/validation.ts            # moteur de combat (240 000 combats)
node server/scripts/validation-gacha.ts      # taux de drop du tirage
node server/scripts/validation-recharge.ts   # énergie quotidienne, semaine, prix des changements
node server/scripts/validation-onboarding.ts # création de compte
```

Tous portent sur de la **logique pure** : ils ne touchent ni la base ni l'horloge (l'instant
courant est passé en paramètre), donc ils sont relançables n'importe quand sans rien casser.

Aucune installation, aucun `npm install`, aucune compilation : Node 24 lit le TypeScript
directement. Ça fait tourner **240 000 combats en une demi-seconde** et compare le résultat
au tableau du §3 d'EQUILIBRAGE_FINAL.md.

---

## Brique 3 — connexion : mise en route

### Tester tout de suite, SANS créer l'app Twitch

Tant que tu n'as pas encore créé l'app sur dev.twitch.tv, tu peux développer et tester tout
le reste (Brique 5, etc.) avec un login de secours qui fait exactement le même onboarding
que le vrai Twitch (même code, `connecterOuCreerJoueur`), juste sans le vrai écran Twitch.

```bash
cp server/.env.example server/.env
```

Remplis au minimum `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` et `SESSION_SECRET` (laisse les
`TWITCH_*` vides pour l'instant, ils ne sont pas encore lus). Vérifie que `DEV_AUTH_ENABLED=true`.

```bash
node server/src/server.ts
```

Puis ouvre **http://localhost:8787/auth/dev/login?pseudo=TonPseudo** dans le navigateur : ça
te connecte (cookie `opa_session` posé) et fait l'onboarding, exactement comme le ferait
Twitch. Se reconnecter avec le **même** `pseudo` retrouve le même joueur (pas de 2e onboarding) ;
un `pseudo` différent crée un nouveau joueur — pratique pour tester avec plusieurs comptes.

⚠️ **Avant de mettre en ligne / de passer sur Railway** : repasse `DEV_AUTH_ENABLED` à `false`
(ou supprime la variable). Sans ça, n'importe qui pourrait se connecter comme n'importe quel
joueur juste en devinant son pseudo — ce login n'a aucune vérification d'identité, c'est fait
exprès pour le développement local uniquement.

### 1) Créer l'application sur dev.twitch.tv *(à faire plus tard, quand tu veux brancher le vrai Twitch)*

1. Va sur **[dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps)** → connecte-toi avec ton
   compte Twitch (celui du streamer) → **Register Your Application**.
2. Remplis :
   - **Name** : `One Piece Arena` (ou ce que tu veux, doit juste être unique sur Twitch)
   - **OAuth Redirect URLs** : `http://localhost:8787/auth/twitch/callback`
     ⚠️ Doit correspondre **exactement** (protocole, port, `/auth/twitch/callback`) à ce que tu
     mettras dans `TWITCH_REDIRECT_URI` — sinon Twitch refuse la connexion.
   - **Category** : `Game Integration` (ou `Application Integration`, peu importe pour l'instant)
   - **Client Type** : **Confidential**
3. **Create** → tu récupères le **Client ID** affiché directement.
4. Clique **New Secret** → récupère le **Client Secret** (affiché une seule fois, note-le).

### 2) Configurer le serveur

```bash
cp server/.env.example server/.env
```

Remplis `server/.env` avec :
- `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET` : récupérés à l'étape 1
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` : Supabase → **Settings → API** de ton projet
  (⚠️ la clé **service_role**, pas la clé `anon` — le serveur doit pouvoir écrire dans toutes les
  tables ; cette clé ne doit **jamais** partir dans le code du frontend)
- `SESSION_SECRET` : n'importe quelle longue chaîne aléatoire (sert à signer le cookie de session)

### 3) Lancer le serveur

```bash
node server/src/server.ts
```

Tu dois voir :
```
One Piece Arena — serveur d'auth Twitch sur http://localhost:8787
  → connexion : http://localhost:8787/auth/twitch/login
```

### Ton test (celui du plan de route)

Ouvre **http://localhost:8787/auth/twitch/login** dans ton navigateur → autorise l'application
sur Twitch → tu es redirigé vers `FRONTEND_URL` (le frontend n'existe pas encore, la page peut
donc afficher une erreur "site injoignable" : **c'est normal**, regarde plutôt le cookie et la
base). Vérifie :
- Le navigateur a bien reçu un cookie `opa_session` (DevTools → Application → Cookies).
- Dans Supabase → *Table editor* → `players` : ta ligne apparaît, avec `twitch_id`, ton pseudo,
  `berrys` et `perso_actif_id` renseignés.
- Dans `collection` : **1 ou 2 lignes** pour ton `player_id` (2 si le tirage gratuit est tombé
  sur un perso différent du perso offert).

Tu peux aussi valider la logique d'onboarding **sans passer par le vrai écran Twitch** (utile
pour re-tester rapidement) :

```bash
node server/scripts/validation-onboarding.ts
```

Ce script simule une connexion avec un faux `twitch_id`, vérifie que l'onboarding se déroule
comme prévu, vérifie qu'une reconnexion ne redonne rien, puis **nettoie** le joueur de test qu'il
a créé dans ta vraie base.

### Les routes

| Route | Rôle |
|---|---|
| `GET /auth/twitch/login` | Redirige vers l'écran d'autorisation Twitch |
| `GET /auth/twitch/callback` | Reçoit le retour de Twitch, crée/retrouve le joueur, pose le cookie de session, redirige vers le frontend |
| `GET /auth/dev/login?pseudo=X` | **Dev uniquement.** Même onboarding que Twitch, sans Twitch. ⚠️ Ne crée AUCUNE vérification d'identité : doit être désactivé (`DEV_AUTH_ENABLED=false`) avant toute mise en production, sinon n'importe qui se fabrique des comptes. |
| `GET /me` | Renvoie le joueur connecté (lit le cookie) — 401 si pas connecté |
| `GET /etat` | L'écran Accueil : perso actif, Berrys, énergie, changements restants. **Déclenche la recharge** (§4). |
| `GET /collection` | Le catalogue complet (possédés + verrouillés), avec stats et barre d'XP |
| `POST /perso-actif` | Change de perso actif `{ collection_id }`. Gratuit dans le quota, puis 20 → 40 → 60 Berrys. |
| `POST /tirage` | Tire un perso (§3bis/§4). Doublon → recyclé automatiquement. |
| `POST /recycler` | Recycle un perso possédé `{ collection_id }` contre des Berrys. Refuse le perso actif. |
| `GET /classement` | Classement des joueurs (trié par Berrys) |
| `POST /combat` | Lance un combat réel : consomme 1 énergie, donne Berrys + XP, renvoie la liste d'événements à rejouer |
| `POST /logout` | Efface le cookie de session |

> **Le serveur ne recharge pas à chaud.** Après toute modification dans `server/src/`, il faut
> le redémarrer — sinon l'API sert encore l'ancien code (symptôme classique : le front est à
> jour mais des champs manquent dans la réponse).

### Les fichiers (Brique 3)

| Fichier | Rôle |
|---|---|
| `src/server.ts` | Le serveur HTTP, les 4 routes. `node:http` brut, pas de framework. |
| `src/onboarding.ts` | Trouve ou crée le joueur. 1er login → perso commun offert + tirage gratuit (§4), réutilise `tirer()` sans jamais y toucher. |
| `src/session.ts` | Cookie de session signé (HMAC), sans table `sessions`. |
| `src/supabase.ts` | Accès à Supabase via son API REST (`fetch` natif, pas de SDK). Clé service_role : ne tourne que côté serveur. |
| `src/env.ts` | Variables d'environnement, plante au démarrage si une manque. |
| `src/load-env.ts` | Charge `server/.env` dans `process.env` (remplacé par les vraies variables de la plateforme en prod). |
| `scripts/validation-onboarding.ts` | Teste l'onboarding sans le vrai Twitch, nettoie derrière lui. |

**Pourquoi pas de SDK/framework (`@supabase/supabase-js`, Express...) :** le reste du projet
tourne sans `npm install` (Node lit le `.ts` directement) — ajouter une dépendance casserait ça
pour 4 routes qui n'en ont pas besoin. Le jour où l'API grossit vraiment (Brique 6, EventSub
24/7 sur Railway), ça vaudra le coup de revisiter ce choix.

## Les fichiers

| Fichier | Rôle |
|---|---|
| `src/combat.ts` | **le moteur**. Le cœur. Portage fidèle de `v6.py`. |
| `src/stats.ts` | la formule du §4 (PV / Attack). ⚠️ la racine carrée y est, ne pas y toucher. |
| `src/gacha.ts` | le tirage de perso (§3bis / §4) : taux, coût, doublon → recyclage. |
| `src/config.ts` | lit les tables `config` et `characters` et les transforme en objets. |
| `src/types.ts` | le vocabulaire + **le contrat d'événements**. Aucun chiffre. |
| `src/rng.ts` | le hasard, avec un seed → un combat est rejouable à l'identique. |
| `src/index.ts` | le point d'entrée : c'est ce qu'on importe. |
| `scripts/validation.ts` | le tournoi de validation du moteur de combat. |
| `scripts/validation-gacha.ts` | la validation du tirage : taux, coût, recyclage. |
| `scripts/lire-seed.ts` | lit les `.sql` de seed. **Pour les tests uniquement.** |

## L'utiliser (quand l'API existera)

```ts
import { chargerConfig, chargerPerso, simulerCombat } from './server/src/index.ts';

const config = chargerConfig(lignesDeLaTableConfig);   // une fois au démarrage
const resultat = simulerCombat(
  { perso: chargerPerso(ligneArlong), niveau: 3 },     // camp 'a'
  { perso: chargerPerso(ligneCrocodile), niveau: 3 },  // camp 'b'
  config,
);

resultat.vainqueur    // 'a' ou 'b'
resultat.evenements   // → à stocker tel quel dans fights.log, c'est ce que le front rejoue
resultat.seed         // rejouer avec ce seed redonne EXACTEMENT le même combat
```

### Le tirage de perso (gacha)

```ts
import { chargerConfig, chargerPerso, tirer, accepterRecyclage } from './server/src/index.ts';

const config = chargerConfig(lignesDeLaTableConfig);
const persos = lignesDeLaTableCharacters.map(chargerPerso);

const resultat = tirer({
  berrysDisponibles: joueur.berrys,
  nomsDejaPossedes: new Set(joueur.collection.map((c) => c.nom)),
  persos,
  config,
});

resultat.perso                          // le perso tiré
resultat.berrys_apres                   // solde après déduction du coût (config.cout_tirage_perso)
resultat.doublon                        // déjà dans la collection ?
resultat.recyclage_propose_berrys       // si doublon : montant à proposer (§4), sinon null
resultat.changement_perso_actif_gratuit // si nouveau perso : true → basculer le perso actif
                                         // SANS toucher au quota des 3 changements/semaine (§3)

// Si le joueur accepte le recyclage proposé :
const nouveauSolde = accepterRecyclage(joueur.berrys, resultat.perso, config);
```

Tout vient de `config` : les taux (`drop_rate_*`), le coût (`cout_tirage_perso`) et les
récompenses de recyclage (`recyclage_doublon_*`). Rééquilibrer le tirage = changer une ligne
en base, relancer `node server/scripts/validation-gacha.ts`.

## Le contrat d'événements

Le front **ne calcule rien** (§6) : il déroule cette liste dans l'ordre et joue les animations.
`acteur` / `cible` valent `'a'` ou `'b'`. `tour: 0` = le tir d'ouverture du Sniper.

| Type | Quand | Champs utiles |
|---|---|---|
| `attaque` | coup normal | `acteur`, `cible`, `ouverture?` |
| `special` | le coup spécial sort | `nom`, `categorie` (`dmg`/`buff`/`transfo`) |
| `esquive` | le coup est esquivé → aucun `degats` ne suit | `acteur`, `cible` |
| `crit` | coup critique | `multiplicateur` |
| `counter` | l'attaquant contre la classe de la cible | `multiplicateur` (1.1) |
| `resistance` | la cible absorbe une partie des dégâts | `valeur`, `degats_evites` |
| `degats` | dégâts réels, **tout compris** | `valeur`, `pv_restants`, `pv_max` |
| `soin` | vol de vie (Arlong) — **la barre de vie monte** | `valeur`, `pv_restants` |
| `buff` | +% Attack permanent (Kuroobi, Luffy) | `pct`, `avant`, `apres` |
| `transformation` | bascule sur les assets de la forme transformée | `resistance?`, `attack_pct?`, `esquive_pct?` |
| `debuff` | malus sur la cible | `stat` (`attack`/`esquive`/`regen`), `valeur`, `tours` |
| `regen` | régén Zoan, en fin de tour | `valeur`, `pv_restants` |
| `poison` | dégâts de poison, en fin de tour | `valeur`, `pv_restants` |
| `ko` | PV tombés à 0 | `perso` |
| `fin` | **toujours le dernier** | `vainqueur`, `raison` |

Un coup se lit toujours comme une petite grappe : `attaque` (ou `special`), puis soit
`esquive`, soit l'enchaînement `crit?` → `counter?` → `resistance?` → `degats`.

## La règle d'or

**Aucun chiffre de gameplay dans ce code.** Tout vient de la base :
les constantes de la table `config`, les persos de la table `characters`.
Rééquilibrer le jeu = changer une ligne en base, relancer la validation. Jamais toucher au moteur.

Si une clé manque en base, le moteur **plante avec un message clair** au lieu d'inventer une
valeur par défaut. C'est volontaire : une constante silencieusement fausse, c'est 10 points de
winrate qui bougent sans que personne ne le voie (§8).

## Si tu modifies le moteur

Relance `node server/scripts/validation.ts` **avant de committer**. Tout écart de plus de
3 points est un bug. Le §8 d'EQUILIBRAGE_FINAL n'est pas une métaphore : dans un combat de
8 tours, +10 % de puissance = 80 % de victoires. Il n'existe pas de « un peu plus fort ».
