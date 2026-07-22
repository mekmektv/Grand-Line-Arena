# Déploiement — Grand Line Arena

**En ligne : <https://grand-line-arena.vercel.app>**
Front + API sur **Vercel**, base sur **Supabase**. Chaque `git push` sur `main` redéploie tout.

Front et API partagent le **même domaine** : le site à la racine, l'API sous `/api`. Ce n'est
pas un détail d'organisation — c'est ce qui évite les deux pièges du déploiement en deux
morceaux : le CORS, et surtout le cookie de session qu'un navigateur refuse d'envoyer entre
deux domaines différents.

---

## Comment c'est branché

| Fichier | Rôle |
|---|---|
| `vercel.json` | build du front, routage de l'API, fichiers à embarquer |
| `api/index.ts` | reçoit toute requête `/api/…`, reconstitue le chemin, délègue au routeur |
| `server/src/server.ts` | le routeur, **partagé** entre le serveur local et la fonction Vercel |

`server/src/server.ts` ne démarre un vrai serveur que **hors** Vercel (test sur
`process.env.VERCEL`). Sur Vercel il est seulement importé : rien n'écoute de port.

Le front n'a **aucune variable à configurer** : sans `VITE_API_URL`, il appelle `/api`,
c'est-à-dire lui-même.

### Les deux réglages non négociables de `vercel.json`

```json
"functions": { "api/index.ts": { "includeFiles": "server/src/**" } },
"rewrites":  [ { "source": "/api/(.*)", "destination": "/api?chemin=$1" }, … ]
```

**`includeFiles`** — Vercel n'embarque **pas** `server/src/` dans le paquet de la fonction, même
s'il est importé. Sans cette ligne, la fonction plante au chargement avec un
`FUNCTION_INVOCATION_FAILED` **sans le moindre message**. C'est le piège qui a coûté le plus
cher lors de la mise en ligne.

**La règle `rewrites`** — les fichiers « attrape-tout » ne fonctionnent pas ici :
`api/[[...x]].ts` n'est pas reconnu, et `api/[...x].ts` ne capture qu'**un seul niveau** de
chemin. `/api/etat` passait, mais `/api/auth/dev/login` renvoyait un 404 de Vercel : la moitié
de l'API était injoignable, sans que rien ne le signale. La règle explicite passe le chemin
d'origine dans le paramètre `chemin`, que `api/index.ts` recombine avec la requête.

---

## Les variables d'environnement (Vercel → Settings → Environment Variables)

| Variable | Valeur |
|---|---|
| `SUPABASE_URL` | identique au `server/.env` local |
| `SUPABASE_SERVICE_ROLE_KEY` | identique — 🔒 secret |
| `TWITCH_CLIENT_ID` | identique |
| `TWITCH_CLIENT_SECRET` | identique — 🔒 secret |
| `SESSION_SECRET` | **différent** du local |
| `FRONTEND_URL` | `https://grand-line-arena.vercel.app` — **sans slash final** |
| `TWITCH_REDIRECT_URI` | `https://grand-line-arena.vercel.app/api/auth/twitch/callback` |
| `DEV_AUTH_ENABLED` | **`false`** |
| `TWITCH_STREAMER_SECRET` | 🔒 secret — protège `/api/auth/twitch/streamer/login` (Brique 6) |
| `TWITCH_EVENTSUB_SECRET` | 🔒 secret — vérifie les notifications webhook EventSub (Brique 6), même valeur que dans `server/.env` local (le script `config-eventsub-twitch.ts` la lit pour créer les abonnements) |
| `CRON_SECRET` | 🔒 secret — protège `/api/cron/presence` (Brique 6), appelée par cron-job.org |

Après toute modification : **Redeploy**. Les variables ne sont lues qu'au déploiement suivant.

⚠️ **`DEV_AUTH_ENABLED=false` n'est pas optionnel.** Laissé à `true`, la route
`/api/auth/dev/login?pseudo=X` crée un compte pour n'importe qui : on se fabrique autant
d'identités qu'on veut et le classement perd tout sens.

⚠️ **Jamais de secret dans une variable `VITE_*`** : tout ce qui porte ce préfixe est intégré au
JavaScript envoyé au navigateur, donc lisible par tous.

`FRONTEND_URL` ne sert pas qu'aux redirections : le serveur s'en sert pour décider d'envoyer le
cookie de session en `SameSite=None; Secure` plutôt qu'en `SameSite=Lax`.

---

## Twitch

Dans <https://dev.twitch.tv/console/apps> → l'application → **Manage** → **OAuth Redirect URLs**,
deux URL coexistent (garder les deux) :

```
http://localhost:8787/auth/twitch/callback                        ← développement
https://grand-line-arena.vercel.app/api/auth/twitch/callback      ← production
```

La seconde doit être **identique au caractère près** à `TWITCH_REDIRECT_URI`. Toute différence
donne une erreur `redirect_mismatch`.

---

## Vérifier après un déploiement

Dans cet ordre — chaque étape confirme la précédente :

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://grand-line-arena.vercel.app/api/etat
#   401 attendu (« non connecté »). Un 500 = la fonction plante : voir Runtime Logs.

curl -s -o /dev/null -w "%{http_code}\n" -X POST https://grand-line-arena.vercel.app/api/quetes/reclamer
#   401 attendu. Un 404 = le routage multi-niveaux est cassé (règle rewrites).

curl -s -w "%{http_code}\n" "https://grand-line-arena.vercel.app/api/auth/dev/login?pseudo=X"
#   404 EXIGÉ. S'il connecte, DEV_AUTH_ENABLED n'est pas à false.

curl -s -o /dev/null -w "%{http_code}\n" https://grand-line-arena.vercel.app/api/auth/twitch/login
#   302 attendu, vers id.twitch.tv.
```

Puis, dans le navigateur : se connecter avec Twitch et vérifier qu'on revient **connecté**. Si
on revient déconnecté, c'est le cookie : vérifier `FRONTEND_URL` (https, sans slash final).

---

## Lire les bons logs quand ça casse

Vercel en propose deux, et ils ne disent pas la même chose :

- **Deployments → un déploiement → `Building`** : les erreurs de construction. ⚠️ Un déploiement
  marqué **`Ready` (vert) peut contenir des dizaines d'erreurs TypeScript** et servir une
  fonction cassée — le statut vert ne prouve rien.
- **Deployments → un déploiement → `Runtime Logs`** : ce qui se passe pendant une requête. C'est
  là qu'on voit la route réellement empruntée et le vrai message derrière un
  `FUNCTION_INVOCATION_FAILED`.

Indice utile : un crash en moins de 200 ms avec « No outgoing requests » signifie que la
fonction meurt **au chargement du module**, avant d'atteindre la base.

---

## Ce qui reste local

Les scripts de `server/scripts/` (validations, simulations, utilitaires de compte) tournent sur
la machine avec `server/.env`. Ils ne sont pas déployés et n'ont pas à l'être.

---

## Brique 6 (Twitch en live) — mise en route une seule fois

Après un déploiement qui touche `server/src/twitch-*.ts` ou change de chaîne Twitch :

1. Coller `supabase/A_APPLIQUER_twitch.sql` si de nouvelles colonnes/tables ont été ajoutées.
2. Visiter `https://.../api/auth/twitch/streamer/login?cle=TWITCH_STREAMER_SECRET` (connecté
   avec le compte Twitch du streamer) — enregistre le jeton broadcaster en base.
3. `node server/scripts/config-eventsub-twitch.ts https://.../api` — crée la récompense
   "Tirage premium" et les abonnements EventSub. Rejouable sans risque (idempotent).
4. Vérifier que le cron externe (cron-job.org) appelle bien `GET /api/cron/presence?cle=...`
   toutes les 1 min.

Utilitaires de test (créditent directement en base, sans passer par une vraie redemption
Twitch) :
```bash
node server/scripts/crediter-coffre-premium.ts <twitch_id> <quantite>
node server/scripts/crediter-presence.ts <twitch_id> <montant>
```
