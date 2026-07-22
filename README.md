# One Piece Arena

Jeu de collection et de combat pour les viewers d'une chaîne Twitch. Conçu pour le mobile, en
portrait. On incarne un pirate, on l'améliore, on affronte les persos des autres viewers, et on
fait monter sa prime.

**En ligne : <https://grand-line-arena.vercel.app>**

---

## Les documents

| Fichier | Contenu |
|---|---|
| `GAME_DESIGN (1).md` | **Fait autorité sur les règles du jeu.** Tous les chiffres, tous les arbitrages. |
| `CLAUDE.md` | Ce qu'il faut savoir pour travailler sur le projet : pièges connus, commandes, état d'avancement. |
| `DEPLOIEMENT.md` | Le déploiement Vercel, les variables, et quoi regarder quand ça casse. |
| `EQUILIBRAGE_FINAL.md` | L'équilibrage des personnages. |
| `FICHE_PERSOS.md` | Le catalogue des persos. |

## L'organisation du code

```
web/          front React + Vite
server/src/   API sans framework (node:http), zéro dépendance npm
api/          adaptateur qui sert cette même API sur Vercel — aucune logique de jeu
supabase/     schéma (migrations/) et valeurs (seed/)
```

Deux principes structurent tout le reste :

**Aucune valeur de gameplay n'est écrite dans le code.** Taux de drop, prix, récompenses,
équilibrage : tout vit dans la table `config` ou dans `characters`. Rééquilibrer le jeu, c'est
changer une ligne en base — pas une ligne de code. Le serveur refuse d'ailleurs de démarrer si
une clé manque, plutôt que d'inventer une valeur par défaut.

**Le serveur décide, le client rejoue.** Un combat est calculé côté serveur, qui renvoie la
liste des événements ; le front ne fait que l'animer. Le navigateur ne calcule jamais un
résultat de jeu.

## Développer

```bash
node server/src/server.ts   # API   sur http://localhost:8787
cd web && npm run dev       # front sur http://localhost:5173
```

Il faut un `server/.env` (voir `server/.env.example`) et un `web/.env`.
Connexion sans Twitch, en local : <http://localhost:8787/auth/dev/login?pseudo=Test>

## Vérifier

```bash
npm run typecheck       # serveur + api
npm run typecheck:web   # front
npm run validate        # 6 scripts de validation (logique pure, ni base ni horloge)
```

Les scripts de validation ne sont pas des tests unitaires classiques : ils rejouent des dizaines
de milliers de combats et de tirages pour vérifier que les taux, les durées et l'équilibrage
restent conformes au `GAME_DESIGN`.

---

*Le code, les commentaires et les messages d'erreur sont en français, volontairement.*
