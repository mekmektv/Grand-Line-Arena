# Déploiement — One Piece Arena

**Tout sur Vercel** (front + API), base sur **Supabase** (déjà en ligne, rien à faire).

Front et API partagent le **même domaine** : le site à la racine, l'API sous `/api`. Ce n'est
pas un détail d'organisation — c'est ce qui évite les deux pièges classiques du déploiement en
deux morceaux : le CORS, et surtout le cookie de session qu'un navigateur refuse d'envoyer
entre deux domaines différents.

---

## Comment c'est branché

| Fichier | Rôle |
|---|---|
| `vercel.json` | construit le front (`web/`) et publie `web/dist` |
| `api/[[...chemin]].ts` | attrape toute requête `/api/…`, retire le préfixe, délègue au routeur |
| `server/src/server.ts` | le routeur, **partagé** entre le serveur local et la fonction Vercel |

`server/src/server.ts` ne démarre un vrai serveur que **hors** Vercel (test sur
`process.env.VERCEL`). Sur Vercel, il est seulement importé : rien n'écoute de port.

Le front n'a **aucune variable à configurer** : sans `VITE_API_URL`, il appelle `/api`,
c'est-à-dire lui-même. Une variable de moins à oublier ou à mal recopier.

---

## 1. Importer le projet

<https://vercel.com> → **Add New → Project** → **Import Git Repository** → `Grand-Line-Arena`.

Laisse les réglages de build tels quels : `vercel.json` s'en charge. Ne renseigne **pas** de
« Root Directory », il doit rester la racine du dépôt (l'API est dans `api/`, le front dans
`web/` : Vercel a besoin de voir les deux).

Le premier déploiement va réussir mais l'application **ne fonctionnera pas encore** : les
variables d'environnement manquent. C'est normal, on les ajoute juste après.

---

## 2. Les variables d'environnement

**Settings → Environment Variables.** Recopie les quatre premières depuis ton `server/.env`
local (ouvre-le avec le Bloc-notes).

| Variable | Valeur |
|---|---|
| `SUPABASE_URL` | identique au local |
| `SUPABASE_SERVICE_ROLE_KEY` | identique — ⚠️ secret |
| `TWITCH_CLIENT_ID` | identique |
| `TWITCH_CLIENT_SECRET` | identique — ⚠️ secret |
| `SESSION_SECRET` | **un nouveau**, différent du local |
| `FRONTEND_URL` | `https://<ton-projet>.vercel.app` — **sans slash final** |
| `TWITCH_REDIRECT_URI` | `https://<ton-projet>.vercel.app/api/auth/twitch/callback` |
| `DEV_AUTH_ENABLED` | **`false`** |

Puis **Redeploy** : les variables ne sont lues qu'au déploiement suivant.

⚠️ **`DEV_AUTH_ENABLED=false` n'est pas optionnel.** Laissé à `true`, la route
`/api/auth/dev/login?pseudo=X` crée un compte pour n'importe qui sans aucune vérification : on
se fabrique autant d'identités qu'on veut, et le classement perd tout sens.

⚠️ **Ne crée jamais de variable commençant par `VITE_` contenant un secret.** Tout ce qui porte
ce préfixe est intégré au JavaScript envoyé au navigateur, donc lisible par tous.

---

## 3. Twitch

Dans <https://dev.twitch.tv/console/apps>, sur ton application → **Manage** → **OAuth Redirect
URLs** → **Add** (garde celle de localhost, elle sert à continuer à développer) :

```
https://<ton-projet>.vercel.app/api/auth/twitch/callback
```

Elle doit être **identique au caractère près** à `TWITCH_REDIRECT_URI`. La moindre différence
— un slash en trop, `http` au lieu de `https` — donne une erreur `redirect_mismatch`.

---

## 4. Vérifier, dans cet ordre

Chaque étape confirme la précédente. Ne passe à la suivante que si celle d'avant est verte.

1. `https://<ton-projet>.vercel.app/api/etat` → doit répondre **401** (« non connecté »).
   Autre chose = la fonction ne démarre pas : voir les logs dans Vercel → Deployments → Runtime Logs.
2. Ouvrir le site → l'écran de connexion doit s'afficher.
3. **Se connecter avec Twitch** → l'écran d'autorisation Twitch apparaît.
   `redirect_mismatch` ici = l'URL de l'étape 3 ne correspond pas.
4. Après autorisation, tu dois revenir **connecté**. Si tu reviens déconnecté, c'est le cookie :
   vérifier que `FRONTEND_URL` est en `https://` et sans slash final.
5. `https://<ton-projet>.vercel.app/api/auth/dev/login?pseudo=Test` → doit répondre **404**.
   S'il te connecte, `DEV_AUTH_ENABLED` n'est pas à `false` (ou le redéploiement manque).

---

## Ensuite : chaque `git push` redéploie tout seul

Plus rien à faire à la main. Une modification poussée sur `main` déclenche un nouveau
déploiement.

## Ce qui reste local

Les scripts de `server/scripts/` (validations, simulations, utilitaires de compte) tournent sur
ta machine avec `server/.env`. Ils ne sont pas déployés et n'ont pas à l'être.
