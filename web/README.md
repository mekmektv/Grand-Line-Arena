# 🏴‍☠️ Grand Line Arena — frontend (Brique 5)

React + Vite, connecté au backend de `server/`. Reprend l'identité visuelle du §8
GAME_DESIGN.md (fond sombre, accents rose/or/cyan, police Bangers).

Pas de librairie d'UI ni de CSS-in-JS : les styles sont en `style={{}}` inline, les animations
en `@keyframes` dans `src/index.css`.

## Lancer en local

Il faut **2 serveurs en même temps**, dans 2 fenêtres de terminal séparées :

```bash
# Terminal 1 — le backend (depuis la racine du projet)
node server/src/server.ts

# Terminal 2 — le frontend
cd web
npm run dev
```

Puis ouvre **http://localhost:5173**.
Connexion sans Twitch : <http://localhost:8787/auth/dev/login?pseudo=TonPseudo>

## ⚠️ Vérifier le code

```bash
cd web
npx tsc -b --force   # LE typecheck. Voir l'avertissement ci-dessous.
npx oxlint src
```

**Ne jamais utiliser `npx tsc --noEmit -p tsconfig.json`.** Ce fichier contient `"files": []`
et ne fait que référencer `tsconfig.app.json` : la commande ne vérifie donc **rien** et sort en
succès, ce qui donne une fausse impression de code sain. Seul `tsc -b` suit les références.

Le backend, lui, **ne se recharge pas à chaud** : après une modification dans `server/src/`,
redémarre-le, sinon l'API sert encore l'ancien code.

## État actuel

✅ Connexion (bouton Twitch + connexion de dev tant que `DEV_AUTH_ENABLED=true` côté serveur)
✅ **Accueil** — perso actif, Berrys, énergie, bouton COMBATTRE
✅ **Collection** — grille, filtres classe/rareté, mode recyclage (bouton ♻️)
✅ **Fiche perso** — stats, compétence, Incarner (avec le prix quand le quota est épuisé)
✅ **Tirage** — coffre → roulette → carte (voir §8 point 7 du GAME_DESIGN)
✅ **Combat** — écran VS, rejeu des événements sur canvas, pose de victoire, barre d'XP
✅ **Classement**

🔜 Roll premium (affiché verrouillé — Brique 6). Le coffre équipement (§4ter) est branché
depuis le 21/07/2026 : ouverture, comparaison avec l'objet porté, et compteur de pièces.
🔜 Quêtes (encart verrouillé sur l'Accueil)
🔜 Sons

## Assets attendus dans `public/`

| Fichier | Rôle | Si absent |
|---|---|---|
| `berry.png` | Le symbole des Berrys, partout dans l'app | Repli sur l'emoji 💰 |
| `perso-verrouille.png` | Silhouette des persos non débloqués (Collection) | Repli sur un aplat sombre |

Les replis rendent **exactement l'ancien affichage**, donc « je ne vois pas de changement »
signifie que le fichier manque ou que son nom ne correspond pas — pas que le code est cassé.
`berry.png` a besoin d'un **fond transparent** (il s'affiche sur fond sombre) ;
`perso-verrouille.png` non, il est composé en `mix-blend-mode: multiply`.

## Fichiers

| Fichier | Rôle |
|---|---|
| `src/api.ts` | Client HTTP vers `server/` (cookie de session envoyé automatiquement) + copie du contrat d'événements de combat |
| `src/App.tsx` | État de connexion, routage entre onglets, chargement du catalogue |
| `src/index.css` | Toutes les `@keyframes` (coffre, roulette, VS, fin de combat) |
| `src/components/BottomNav.tsx` | La barre du bas, 4 onglets max (§8) |
| `src/components/Berry.tsx` | Le logo des Berrys, avec repli automatique |
| `src/screens/Accueil.tsx` | L'écran le plus vu (§8 point 2) |
| `src/screens/Collection.tsx` | Grille + mode recyclage |
| `src/screens/FichePerso.tsx` | Détail d'un perso + Incarner |
| `src/screens/Tirage.tsx` | Le gacha : coffre, roulette, révélation |
| `src/screens/Combat.tsx` | Écran VS + rejeu du combat sur canvas 2D |
| `src/screens/Classement.tsx` | Classement des joueurs |
| `src/screens/Login.tsx` | Écran de connexion |

> **Le front ne calcule jamais un résultat de jeu.** Le serveur envoie une liste d'événements,
> le canvas la rejoue. C'est la règle anti-triche du §6.
