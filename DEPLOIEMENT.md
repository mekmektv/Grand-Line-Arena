# Déploiement — One Piece Arena

Front sur **Vercel**, API sur **Railway**, base sur **Supabase** (déjà en ligne, rien à faire).

L'ordre compte : l'API d'abord, parce que le front a besoin de connaître son URL, et Twitch a
besoin de connaître celle de l'API.

---

## Le piège à connaître avant de commencer

Front et API seront sur **deux domaines différents** (`*.vercel.app` et `*.up.railway.app`).
Trois réglages en dépendent, et si l'un des trois est faux **la connexion échoue en silence** :
le joueur passe par Twitch avec succès, revient sur le site… et reste « non connecté ».

| Réglage | Où | Doit valoir |
|---|---|---|
| `FRONTEND_URL` | Railway | l'URL Vercel **exacte**, en `https://`, **sans slash final** |
| `TWITCH_REDIRECT_URI` | Railway **et** console Twitch | la même chaîne des deux côtés, au caractère près |
| `VITE_API_URL` | Vercel | l'URL Railway, en `https://`, sans slash final |

`FRONTEND_URL` ne sert pas qu'aux redirections : le serveur s'en sert pour décider d'envoyer
le cookie de session en `SameSite=None; Secure` (obligatoire entre deux domaines) plutôt qu'en
`SameSite=Lax`. S'il reste sur `http://localhost:5173`, le cookie ne partira jamais.

---

## 1. L'API sur Railway

**Réglage du service**

- Racine du projet (*Root Directory*) : `server`
- Commande de démarrage : `npm start` (fournie par `server/package.json`)
- Node **24 minimum** — le serveur exécute du TypeScript directement, sans étape de build.
  C'est le rôle du champ `engines` de `server/package.json`.

**Variables d'environnement à créer** (Railway → Variables)

| Variable | Valeur |
|---|---|
| `SUPABASE_URL` | identique à ton `server/.env` local |
| `SUPABASE_SERVICE_ROLE_KEY` | identique — ⚠️ secret, ne jamais mettre côté front |
| `SESSION_SECRET` | **génère-en un nouveau**, différent du local |
| `TWITCH_CLIENT_ID` | identique |
| `TWITCH_CLIENT_SECRET` | identique — ⚠️ secret |
| `TWITCH_REDIRECT_URI` | `https://<ton-api>.up.railway.app/auth/twitch/callback` |
| `FRONTEND_URL` | `https://<ton-front>.vercel.app` |
| `DEV_AUTH_ENABLED` | **`false`** — voir plus bas |
| `PORT` | *ne pas créer*, Railway l'injecte |

⚠️ **`DEV_AUTH_ENABLED=false` n'est pas optionnel.** Laissé à `true`, la route
`/auth/dev/login?pseudo=X` crée un compte pour n'importe qui, sans aucune vérification : on se
fabrique autant d'identités que voulu, et le classement n'a plus de sens.

---

## 2. Le front sur Vercel

- Racine du projet (*Root Directory*) : `web`
- Framework : Vite (détecté tout seul) · build `npm run build` · sortie `dist`
- Variable d'environnement : `VITE_API_URL` = `https://<ton-api>.up.railway.app`

⚠️ Une variable `VITE_*` est **lue au moment du build**, pas au démarrage. La modifier oblige à
**redéployer** le front — sinon l'ancienne valeur reste figée dans le JavaScript livré.

Et tout ce qui est préfixé `VITE_` finit **en clair dans le navigateur** : jamais de secret ici.

---

## 3. Twitch

Dans <https://dev.twitch.tv/console/apps>, sur ton application, **ajouter** (sans retirer celle
de localhost, qui sert à continuer à développer) :

```
https://<ton-api>.up.railway.app/auth/twitch/callback
```

---

## 4. Vérifier que ça marche

Dans cet ordre — chaque étape confirme la précédente :

1. `https://<ton-api>.up.railway.app/etat` → doit répondre **401** (« non connecté »).
   Une autre erreur = l'API ne démarre pas, lire les logs Railway.
2. Ouvrir le front, cliquer **Se connecter avec Twitch** → l'écran Twitch doit apparaître.
   Une erreur `redirect_mismatch` = l'URL de l'étape 3 ne correspond pas exactement.
3. Après autorisation, tu dois revenir **connecté**. Si tu reviens déconnecté, c'est le cookie :
   vérifier que `FRONTEND_URL` est bien en `https://` et sans slash final.
4. `https://<ton-api>.up.railway.app/auth/dev/login?pseudo=Test` → doit répondre **404**.
   S'il te connecte, `DEV_AUTH_ENABLED` n'est pas à `false`.

---

## Ce qui reste local

Les scripts de `server/scripts/` (validations, simulations, utilitaires de compte) continuent de
tourner sur ta machine avec `server/.env`. Ils ne sont pas déployés et n'ont pas à l'être.
