# 🏴‍☠️ ONE PIECE ARENA — Document de référence

> **Source de vérité du projet.** À déposer dans le Projet Claude et à donner à Claude Code.
> Mettre à jour à chaque décision.
>
> **v3 — 16/07/2026.** Refonte du §2 (classes), du §3 (puissance) et du §3bis (taux) après vérification par simulation.
> Les chiffres détaillés vivent dans **`EQUILIBRAGE_FINAL.md`** et **`FICHE_PERSOS.md` / `persos.csv`**.

---

## 1. CONCEPT

Jeu de **combat auto** façon *La Brute*, thème **One Piece**, connecté à **Twitch**.

- Chaque viewer **collectionne** des persos (gacha) et en **incarne un seul** à la fois (son identité).
- Les combats sont **calculés côté serveur** → le client **rejoue les animations** (léger, tourne sur mobile bas de gamme).
- Style : **sprites 2D** style *One Piece Treasure Cruise* (chibi HD, fond transparent).
- Format : **webapp mobile-first** (le viewer clique un lien dans le chat, rien à installer).

---

## 2. SYSTÈME DE CLASSES *(révisé le 16/07/2026)*

**5 classes, 1 seule par perso.**

**Triangle :**
- **Haki** bat **Logia** et **Paramecia**
- **Logia** bat **Zoan**
- **Paramecia** bat **Zoan** *(Paramecia = même case que Logia, nom différent)*
- **Zoan** bat **Haki**

**Sniper et Sabreur : neutres.** Ils ne contrent personne, personne ne les contre. Ce sont **les classes sans faiblesse** — thématiquement, ceux qui n'ont pas de pouvoir et compensent par la technique.
> ✅ **Décidé le 16/07/2026 : le duo Sniper ⇄ Sabreur est supprimé.** Il ne faisait rien (les deux recevaient le même bonus, ça s'annulait) mais raccourcissait leur combat, ce qui offrait **11 points de winrate au hasard**. Preuve que c'était un artefact : le Sniper battait le Sabreur à 40 % avec un bonus ×1.1, et à 59 % avec ×1.3. Ça descendait puis ça remontait — du bruit d'arrondi, pas une tactique. Supprimé : Sniper 50 %, Sabreur 50 %, et rien d'autre ne bouge.

**Multiplicateur : ×1.1** *(baissé de ×1.5 le 16/07/2026)*
- Frapper une classe qu'on contre → **×1.1**
- Frapper son counter → **×1** (⚠️ **pas de malus**)
- Neutre / même classe → **×1**

> **Pourquoi ×1.1 et pas ×1.5 :** mesuré, dans un combat de 8 tours **un ×1.5 = un auto-win 100/0**. Un Commun qui contrait battait Crocodile l'Épique. Même à ×1.2 c'était encore 100 %. À ×1.1, contrer reste très fort (≈ 80 % de victoires à rareté égale) mais la rareté reprend le dessus.
> **Règle à retenir : dans ce jeu, tous les chiffres doivent être petits.** Un combat long répète l'avantage 8 fois — ×1.05 se sent déjà énormément.

| Attaquant | Cible | Dégâts |
|---|---|---|
| Haki | Logia / Paramecia | ×1.1 |
| Logia | Zoan | ×1.1 |
| Paramecia | Zoan | ×1.1 |
| Zoan | Haki | ×1.1 |
| tout autre cas (dont Sniper et Sabreur) | | ×1 |

### Passifs de classe *(chiffrés le 16/07/2026)*

| Classe | Passif | Vaut |
|---|---|---|
| **Haki** | Ses coups **ne peuvent pas être esquivés** | +11 % dégâts |
| **Logia / Paramecia** | **+10 % d'esquive** (→ 20 % au total) | +12 % survie |
| **Zoan** | **Régénère 1,2 % des PV max à chaque tour** — tout le temps, dès le tour 1, transformé ou non | +11 % PV effectifs |
| **Sabreur** | **30 % de chance de coup critique** (×1.5) *(monté de 20 %)* | +15 % dégâts |
| **Sniper** | **Tire une fois AVANT le tour 1** (attaque gratuite d'ouverture) *(remplace « agit en premier »)* | +11 % dégâts |

> **Pourquoi le passif Sniper a changé :** « agit en premier au tour 1 » valait **0** sur un combat de 8 tours. La classe Sniper était à **27,7 %** de winrate à stats strictement égales. Le tir d'ouverture = 1 attaque de plus sur ~9 = +11 %, il garde le fantasme du tireur, et il est spectaculaire à l'écran.

**Équilibre des classes** (6 persos vierges, stats identiques, aucun spécial) :

| Classe | Avant | **Après** |
|---|---|---|
| Haki | 68,1 % | **56 %** |
| Sniper | **27,7 %** ☠️ | **50 %** |
| Sabreur | 43,7 % | **50 %** |
| Zoan | 48,3 % | **49 %** |
| Logia | 55,9 % | 47 % |
| Paramecia | 56,4 % | 46 % |

Écart meilleure/pire classe : **40 points → 10 points**, sans toucher à une seule stat.
*(Mesuré sur la compo réelle du roster : 3 Haki / 2 Logia + 2 Paramecia / 3 Zoan / 3 Sniper / 3 Sabreur.)*

> Cohérence : le passif du Haki (inesquivable) contre celui du Logia (esquive).
> ⚠️ Attention, c'est le matchup le plus déséquilibré du jeu : le Haki cumule le ×1.1 **et** l'annulation totale du passif adverse. C'est pour ça que le triangle est descendu à ×1.1.
> 🔮 Évolution possible : pentagone complet (chaque classe en bat 2).

### Les constantes de combat → table `config`

⚠️ Ces valeurs n'existaient nulle part avant. **Sans elles, aucun chiffre d'équilibrage n'a de sens.**

| Clé | Valeur |
|---|---|
| `hp_scale` | **9** (1 point de budget HP = 9 PV) |
| `esquive_base` | **10 %** |
| `esquive_logia` | **+10 %** |
| `crit_sabreur` | **30 %** |
| `crit_mult` | **1.5** |
| `zoan_regen` | **1,2 %** des PV max / tour — ⚠️ **falaise : à 1,3 % la classe Zoan passe à 60 %. Ne jamais dépasser.** |
| `sniper_ouverture` | **true** |
| `counter_mult` | **1.1** |

---

## 3. PERSOS, RARETÉ, PROGRESSION *(révisé le 16/07/2026)*

Le viewer **collectionne** (gacha) et **incarne un seul** perso (perso actif).

### Raretés
| Rareté | Couleur | Phase |
|---|---|---|
| Commun | ⚪ Gris | Lancement |
| Peu commun | 🟢 Vert | Lancement |
| Rare | 🔵 Bleu | Lancement |
| Épique | 🟣 Violet | Plus tard |
| Légendaire | 🟡 Doré | Plus tard |

### Puissance : la rareté fixe le **plafond**, le **niveau** fait monter de la base au plafond

**Un perso n'a que 2 stats : PV et Attack.** L'esquive, le crit, la régén et le tir d'ouverture viennent de la **classe**, ils ne sont pas stockés par perso.

| Rareté | Niv 1 | Niv 2 | Niv 3 |
|---|---|---|---|
| Commun | 100 | 120 | **140** |
| Peu commun | 120 | 140 | **160** |
| Rare | 140 | 160 | **180** |
| **Épique** | **165** | **180** | **195** *(baissé de 200)* |
| *Légendaire (à venir)* | *185* | *195* | *205* |

> **Pourquoi l'Épique est passé de 200 à 195 :** à 200, **57 %** des combats du jeu étaient des écrasements (pire que 80/20). À 195, on tombe à **39 %**, et Crocodile reste le meilleur perso du jeu (91 %).

### 🔑 La formule (à coder telle quelle)

```
budget_effectif = BUDGET[rareté][niveau] / (1 + coût_kit)
h               = 0.40 (Bourrin) | 0.50 (Équilibré) | 0.60 (Tank)

PV     = 9 × (budget_effectif / 2) × √( h / (1 − h) )
ATTACK =     (budget_effectif / 2) × √( (1 − h) / h )
```

⚠️ **La racine carrée n'est pas décorative.** En combat d'usure, ce qui décide c'est **PV × Attack**, pas PV + Attack. Sans elle, un profil Tank perd **25 % de sa puissance gratuitement** (c'est ce qui mettait Dalton à 7 % de winrate). Avec elle, tous les profils sont strictement équivalents — le profil redevient un **choix de style, pas un piège**.

**Philosophie :** la rareté = **vraie puissance** (un Shanks légendaire doit dominer un commun, c'est logique). Le garde-fou : un **commun investi reste utile**. Vérifié : **un Commun niveau 3 (140) = un Rare niveau 1 (140)**, à 50/50. Le niveau vaut plus qu'une rareté.

### Hiérarchie obtenue (tournoi complet, niveau 3)

| Rareté | Winrate global |
|---|---|
| Commun | 17 % |
| Peu commun | 49 % |
| Rare | 76 % |
| **Épique** | **89 %** 👑 |

> **Corrigé le 17/07/2026.** Cette table affichait 19 / 46 / 77 / 91 % : des chiffres d'avant les réglages du 16/07 (triangle ×1.5 → ×1.1, plafond Épique 200 → 195). Elle contredisait `EQUILIBRAGE_FINAL.md` §3, qui est la **source de vérité des chiffres de combat**. Valeurs ci-dessus reconfirmées le 17/07 par `v6.py` **et** par le moteur de combat (16,8 / 48,9 / 76,6 / 88,5 %).
> ⚠️ **En cas de doute, c'est toujours `EQUILIBRAGE_FINAL.md` qui fait foi**, jamais ce document.

Crocodile est le meilleur perso du jeu. Arlong (84 %, Rare) est juste derrière : il est **le contre naturel du boss tant que Crocodile n'est pas monté au niveau 3** (Arlong niv 3 gagne à **100 %** contre un Croco niv 1, **80 %** contre un niv 2 — mais **41 %** contre un niv 3). Crocodile se tire au niveau 1 : **le vrai contre du boss, c'est le niveau, pas la classe.**

> ⚠️ **À niveau 3 contre niveau 3, Arlong perd — et personne ne fait mieux.** Contrer lui vaut pourtant +25 points, mais à ×1.1 le triangle ne renverse pas un écart de rareté : c'est exactement l'intention du §2 (*« à ×1.1, contrer reste très fort mais la rareté reprend le dessus »*).
> **Corrigé le 17/07/2026.** Cette ligne disait « il le bat en duel » : reste de l'époque du triangle ×1.5. Faux depuis le 16/07. Détail complet, chiffres et conséquences : **§3 d'EQUILIBRAGE_FINAL.md**.

### Niveau
- **Niveau du perso** : monte en jouant CE perso → le fait grimper base → plafond. **Fait le 20/07/2026.**
- **Niveau de compte** : la colonne `players.niveau_compte` existe mais **n'est utilisée nulle part dans le code**. Usage toujours à définir. ⚠️ Il n'y a donc **qu'un seul système d'XP dans le jeu : celui du perso**.

#### L'XP en pratique *(tout est dans `config`, rien en dur — voir `server/src/progression.ts`)*

| Clé | Valeur | Effet |
|---|---|---|
| `xp_combat_gagne` | **10** | XP au perso actif si le combat est gagné |
| `xp_combat_perdu` | **4** | XP même en perdant : perdre fait progresser, plus lentement |
| `xp_niveau_2` | **140** | XP **cumulés** pour le niveau 2 |
| `xp_niveau_3` | **420** | XP **cumulés** pour le niveau 3 (= maximum, l'XP est plafonnée là) |

Les seuils sont **cumulés**, pas « depuis le dernier niveau » : le palier 2→3 coûte donc 280 XP, le double du premier. `chargerConfig` refuse de démarrer si les seuils ne sont pas strictement croissants.

**Cadence obtenue** (10 combats/jour d'énergie) :

| | Que des victoires | Moitié-moitié | Que des défaites |
|---|---|---|---|
| Niveau 1 → 2 | 14 combats | **20** | 35 |
| Niveau 2 → 3 | 28 combats | **40** | 70 |
| **Total 1 → 3** | 42 combats | **60** (~6 jours) | 105 |

**Trois conséquences assumées :**
- L'XP appartient au **perso**, pas au compte : changer de perso actif repart du compteur du nouveau (0 s'il n'a jamais combattu). Combiné aux 3 changements/semaine ci-dessous, **incarner un nouveau perso remet la progression à zéro** — c'est le prix de la bascule, à surveiller si les joueurs s'en plaignent.
- Seul le **perso actif** gagne de l'XP ; les autres dorment.
- Le gain de niveau ne vaut pas pareil selon la rareté : un Commun passe de 100 à 140 de budget (**+40 %**), un Épique de 165 à 195 (**+18 %**). Monter un Commun rapporte proportionnellement bien plus — cohérent avec le §3 (« un commun investi reste utile »).

### Changement de perso actif
- **3 changements gratuits par semaine** (`changements_par_semaine`), remis à zéro le lundi
- **Débloquer un perso (roll) = changement gratuit immédiat** (ne consomme pas le quota)
- Au-delà → **prix escaladant : 20, puis 40, puis 60 Berrys**, plafonné à 60
  (`changement_prix_paliers`). Le compteur repart à zéro à la remise hebdomadaire, donc
  l'escalade ne se cumule jamais d'une semaine sur l'autre.

> Le vrai frein n'est pas le prix, c'est l'**XP** : changer de perso repart du compteur du
> nouveau, soit 140 XP (une vingtaine de combats) jetés. Le coût en Berrys ne sert qu'à
> décourager le zapping impulsif en cours de session.

### Compétence unique par perso
- **1 compétence par perso**, s'active **1× par combat**.
- Sur les rares : effet **plus intéressant / spectaculaire** (pas juste "+de dégâts").
- Donne une identité à chaque perso et crée des synergies en équipe.
- Détail des 16 compétences : voir **`FICHE_PERSOS.md`**.

> 💡 **Mesuré : un spécial de dégâts pur ne coûte rien.** Un « ×1.6 une fois » ne vaut que **+2,5 points de winrate** — sur ~9 attaques, ça n'ajoute que +6 % de dégâts totaux. C'est du **spectacle gratuit**. Les nerfs proposés en juillet (Crocodile ×1.8, Mr.5 ×1.5, Smoker ×1.3) ont donc été **annulés** : ×2.5, ×2.2 et ×1.8.
> **Ce qui coûte, c'est ce qui dure.** Un effet permanent coûte ~10× un effet ponctuel.

### Transformation *(optionnel, ouvert à tous les persos)*
- Déclencheur : **le spécial** (qu'il fasse des dégâts ou soit juste une anim de transfo).
- Après le spécial → **bascule sur les assets de la forme transformée** pour **tout le reste du combat**.
- **Pas de 2e spécial** une fois transformé. **Classe inchangée. Barre de vie inchangée.**
- ✅ **Les transformations donnent de la RÉSISTANCE, jamais des PV max** *(décidé le 16/07/2026)*. Ça rend la règle « barre de vie inchangée » vraie, et c'est plus logique : une forme animale encaisse mieux, elle ne gonfle pas. Appliqué : **Dalton +26 % de résistance**, **Chopper +20 %** — puissance identique au point près (vérifié).
- ✅ **Pell : son spécial est passé de « +25 % esquive / +10 % ATK » à « +35 % ATK / +10 % esquive »** *(décidé le 16/07/2026)*. L'esquive est la seule mécanique qu'une classe entière (le Haki) annule à 100 % — et Pell contre justement les Haki. Il payait 9 % de son budget pour un pouvoir mort dans le seul combat qu'il devait gagner. **Règle à retenir : jamais un spécial dont l'esquive est le cœur.**
- Techniquement : la forme transformée est un **perso complet** à part (avec ses propres réglages : taille, effets, projectiles), relié au perso de base.

**Nouvelle mécanique : la résistance.** `dégâts_subis × (1 − résistance)`. Valeur par défaut **0** → rétrocompatible avec tout l'existant.

> **Conversion PV → résistance (à réutiliser) :**
> ```
> résistance = 1 − 1 / (1 + gain de PV)
> ```
> +25 % PV = **20 %** · +35 % PV = **26 %** · +50 % PV = **33 %**
> ⚠️ **Ne jamais recopier le chiffre tel quel** : « 35 % de résistance » est bien plus fort que « +35 % de PV ». Vérifié : avec la bonne conversion, la puissance est identique au point près.

---

## 3bis. TAUX DE DROP — TIRAGE PERSO *(révisé le 16/07/2026)*

| Rareté | Taux global | Nb persos (vague 1) | Taux par perso |
|---|---|---|---|
| Commun | **70 %** *(était 57 %)* | 5 | 14 % |
| Peu commun | **22 %** *(était 30 %)* | 5 | 4,4 % |
| Rare | **7,5 %** *(était 12 %)* | 5 | 1,5 % |
| Épique | **0,5 %** *(était 1 %)* | 1 (Sir Crocodile) | 0,5 % |

> **Pourquoi :** les anciens taux mettaient un Rare dans les mains de 39 % des joueurs **dès le jour 1** → 66 % des combats étaient pliés d'avance le soir du lancement. Avec 70 % de Communs, on tombe à 25 % de Rares au jour 1 et **16 persos sur 16 sont joués**. Et Crocodile à 0,5 % redevient un événement.

**Ce que ça donne (population réelle : 7 hardcore / 5 réguliers+lives / 4 réguliers hors live / 4 lurkers) :**

| Jour | Crocodile (sur 20) | Persos joués |
|---|---|---|
| 1 | 0 | **15-16 / 16** |
| 7 | 1 | 10 / 16 |
| 30 | **6** | 6 / 16 |
| 60 | 9 | 6 / 16 |

⚠️ **Le taux se partage.** Le tier Épique est à 0,5 % **au total**. Ajouter un 2e Épique → 0,25 % chacun → deux fois plus long à obtenir. Il faudra monter le total pour garder le rythme.

---

## 3ter. LE ROSTER SE RÉDUIT À 6 PERSOS — analysé, assumé *(16/07/2026)*

**Au jour 7, seuls ~6 persos sur 16 sont réellement joués.** Ce n'est **pas** un bug d'économie — c'est ta règle du §3 appliquée jusqu'au bout :

> **Rareté = puissance** + **1 seul perso actif** = tout le monde joue le meilleur tier accessible.
> Ton meilleur tier contient 5 persos. Donc **maximum 5-6 persos vivants**, quoi que fasse l'économie.

**Ce qui a été testé et écarté :**
- **Baisser le volume de tirages** (1/jour au lieu de 3) → 6/16 quand même. Ça retarde de 3 semaines, ça ne règle rien.
- **Baisser les taux** → testé sur 6 combinaisons, ~0 % de Communs joués au jour 30 dans toutes.
- **Ajouter des persos** → *empire les choses* : doubler le roster donne **2/32** persos joués au jour 90 (les 2 Épiques écrasent tout).
- **Niveau par doublons + base commune** → ça marche (11/16 pendant 2 mois) **mais Crocodile devient max en 9 mois**. Rejeté : inadapté à un viewer Twitch.

**Décision : on assume.** Les 10 autres persos ne sont pas du déchet — ils sont collectionnés, recyclés, ils remplissent la galerie. Dans tous les gachas du monde, on joue une poignée d'unités et on en collectionne des centaines. **Ce qu'il faut surveiller, c'est plutôt : au jour 90, 93 % des joueurs ont fini la collection.** C'est le rythme des vagues (§9) qui règle ça, pas l'équilibrage.

---

## 4. ÉCONOMIE *(chiffres validés le 15/07/2026 — ⚠️ le volume de tirages est à revoir, cf. §3ter)*

**Deux monnaies :**
- **Berrys** = monnaie **de jeu** (gagnée en jouant + présence live), sert au **tirage perso** (100) et au **coffre équipement** (35)
- **Points de chaîne Twitch** = achètent des **tirages premium** (même pool, meilleurs taux de rareté — jamais de contenu exclusif, pour rester non pay-to-win)

**Philosophie :** n'importe qui peut jouer (même absent des lives), mais **être présent en live rapporte plus**. L'ancien a un avantage de **largeur** (collection, réserve), pas un mur de puissance.

### Gains
| Source | Gain |
|---|---|
| Combat gagné | +20 Berrys |
| Combat perdu | +8 Berrys (plancher, jamais moins) |
| Quête du jour | +50 Berrys |
| Connexion quotidienne (hors live) | +30 Berrys |
| Présence en live (30 min) | +40 Berrys |
| Bonus de connexion live (1×/live) | +20 Berrys |
| Recyclage doublon perso — Gris/Vert/Bleu/Violet | +20 / +40 / +80 / +160 Berrys |
| Recyclage/destruction équipement — Gris/Vert/Bleu/Violet | +10 / +20 / +40 / +80 Berrys |

**Cible atteinte (simulations) :**
- Joueur non-live, actif tous les jours (10 combats, ~50 % winrate) : ~220 Berrys/jour → **~2 tirages perso/jour**
- Joueur présent à un live (2h-2h30) + ses combats : ~400 Berrys → **~4 tirages perso**
- Joueur régulier + 3 lives/semaine : **~20 tirages perso/semaine (~3/jour en moyenne)**
- Plancher garanti même en perdant tous ses combats : 10×8 + 50 + 30 = **160 Berrys minimum/jour**

### Dépenses
- **Tirage perso** : 100 Berrys (ou points de chaîne pour un tirage premium, meilleurs taux)
- **Coffre équipement** : 35 Berrys (ou points de chaîne pour un coffre premium, meilleurs taux)
- **Monter le niveau** d'un perso
- **Détruire un équipement équipé** pour libérer le slot (recyclage) — un équipement ne peut pas être transféré, seulement détruit
- **Changement de perso** au-delà des 3/semaine
- **Recharge d'énergie**

### Énergie
- **10 combats gratuits/jour**, rechargés quotidiennement
- Au-delà : payer en Berrys
- En live : recharge plus rapide

### Nouveaux joueurs
- 1 perso commun **offert** + **1 tirage gratuit immédiat** à la 1re connexion

**Déroulé précisé le 21/07/2026.** Les deux tirages sont **joués par le joueur**, pas attribués
en silence : avant, le compte se créait avec ses deux persos déjà dedans et la roulette — le
moment fort du jeu — lui passait sous le nez. Ils sont maintenant répartis sur le parcours
d'arrivée (`players.onboarding_etape`) :

| Étape | Ce que voit le joueur |
|---|---|
| 0 | Écran plein écran « débloque ton premier pirate » → roll **forcé Commun** (= le perso offert) |
| 1 | Accueil, tutoriel : son pirate, puis son premier combat |
| 2 | Bascule sur l'onglet Coffres : « un coffre offert pour fêter ton arrivée en mer » → roll aux **taux normaux** (= le tirage gratuit) |
| 3 | Terminé |

Le roll de départ est uniforme parmi les Communs (§3bis partage déjà le taux d'un tier à parts
égales entre ses persos, donc uniforme = la bonne distribution). Le coffre de l'étape 2 est
vérifié **côté serveur** : sans ça, la route se rappellerait à volonté pour des tirages gratuits.

### Subs
Récompenses **cosmétiques / confort** (tirage premium mensuel, titre, skin, petit bonus de gains ~+10 %). **Pas de pay-to-win.**

### Points de chaîne — implémentation Twitch
Le taux de gain est **fixé par Twitch** (~320 pts/heure pour un non-abonné), impossible à modifier côté streamer. L'équilibrage se fait via le **coût des rewards** et leur **limite de redemption** :
- **Tirage premium** : Custom Reward à **600 points**, plafonné à **3 par viewer et par stream**
- **Coffre équipement premium** : Custom Reward à **250 points**, même plafond de 3/stream

---

## 4bis. COMBAT — MATCHMAKING *(révisé le 16/07/2026)*

**Principe :** **PvP asynchrone** (on affronte la défense sauvegardée d'un vrai joueur, calculée côté serveur), avec un **pool de bots en fallback permanent**.

- **Appariement : 100 % aléatoire.** *(décidé le 16/07/2026)*
- **Pas de matchmaking par puissance.** Simulé sur 20 joueurs : dès le jour 7, **l'écart de puissance médian entre deux joueurs au hasard est de 0 %** — ils convergent naturellement vers les mêmes raretés. L'aléatoire est déjà équitable tout seul.
- **20 joueurs suffisent.** Dès le jour 1, chaque joueur a en médiane **8 adversaires sur 19** dans sa tranche de puissance. Et en asynchrone, les 20 sont dispo 24/7 même hors live.
- **Résultat mesuré (jour 30, aléatoire) : 39 % de combats écrasés** (pire que 80/20) et **42 % de combats serrés**. Avant les corrections du §2/§3, c'était 57 % d'écrasements.
- **Pool de bots** : table config dédiée, chaque bot = un perso défini manuellement (classe, stats, niveau) — pas de génération aléatoire, contrôle total *(fait le 22/07/2026 — `config.bots_pool`, 13 bots dont 3 « faibles » réservés à l'anti-frustration. Le niveau d'un bot est celui écrit en config et **non** celui du joueur : c'est tout l'objet d'un pool défini à la main.)*
- **Anti-répétition** : un joueur ne peut pas retomber sur le même adversaire (réel ou bot) dans ses **4 derniers combats** *(fait le 22/07/2026 — `config.anti_repetition_combats`. **Repli assumé** : si écarter les 4 derniers ne laisse plus aucun candidat, l'exclusion saute. À 2 joueurs inscrits, la règle stricte rendrait tout combat impossible ; mieux vaut répéter un adversaire que refuser un combat déjà payé en énergie.)*
- **Anti-frustration** : après **3 défaites consécutives contre de vrais joueurs**, le prochain adversaire proposé est un **bot faible** (quasi-victoire garantie)

---

## 4quater. LA PRIME — le classement *(décidé le 22/07/2026)*

Le classement triait par **Berrys**, c'est-à-dire par **réserve** : un joueur qui dépensait tout
en tirages dégringolait, et thésauriser était le meilleur moyen de monter. On classait la
richesse, pas les exploits.

**Trois règles :**

1. **La prime ne fait que monter.** Jamais de perte — c'est ainsi dans One Piece, et voir son
   chiffre baisser en direct décourage. *(Écarté au passage : une cote type Elo, qui mesure
   mieux le niveau réel et laisse un nouveau rattraper tout le monde, mais qui descend.)*
2. **Pondérée par la force de l'adversaire battu.** Base par rareté — Commun 10 · Peu commun 20
   · Rare 40 · Épique 80 — puis **+40 % par niveau** de l'adversaire au-dessus de 1 (un niveau
   3 vaut donc 1,8×). L'échelle par rareté reprend celle du recyclage des doublons divisée par
   deux, plutôt que d'inventer une n-ième échelle non validée ; le +40 % est le chiffre
   d'équilibrage déjà établi ailleurs dans le projet.
3. **Les victoires contre un bot ne rapportent RIEN.** Sinon l'anti-frustration du §4bis (bot
   faible garanti après 3 défaites) deviendrait une machine à prime : **perdre exprès** serait
   la stratégie optimale du classement. C'est vérifié par `validation-prime.ts`, qui simule
   100 cycles « perdre 3 fois puis battre le bot faible » et exige un gain de zéro.

**Limite connue :** une prime cumulative avantage mécaniquement les anciens — un joueur arrivé
tard ne rattrape jamais. Acceptable au lancement parce que **l'énergie plafonne tout le monde à
10 combats/jour** (personne ne peut « grinder » l'écart), mais ça appellera des **saisons** le
jour où l'écart deviendra décourageant.

---

## 4ter. ÉQUIPEMENT *(validé le 15/07/2026)*

- **Pas d'affichage visuel** sur le sprite : l'équipement ne donne que des stats, aucun asset à produire.
- **2 slots au lancement : Chapeau + Tenue.** Pas d'Arme pour l'instant — viendra plus tard, probablement lié à la classe (pas un 3e slot générique).
- **Coffre équipement : 35 Berrys.** Version premium en points de chaîne, mêmes taux améliorés.
- Un coffre donne **1 objet random** (Chapeau OU Tenue, 50/50). **Chapeau et Tenue partagent le même pool de raretés.**
- **3 raretés au lancement** : **Gris 65 % / Vert 28 % / Bleu 7 %**.
- **18 objets au lancement : 3 Chapeaux + 3 Tenues par rareté**. Coût nul en assets, donc autant varier.
- **Stats non uniformes par objet** : chaque objet a son propre profil (équilibré PV/Attack, orienté Attack, orienté PV). **Les Chapeaux peuvent aussi donner de l'Attack.**
- ⚠️ **L'équipement ne donne que des PV et de l'Attack** — jamais d'esquive ni de crit, qui appartiennent aux classes.
- **Un équipement ne peut pas être déséquipé/transféré** — seulement **détruit** (recyclage en Berrys selon rareté).

### Chiffrage des 18 objets *(fait le 21/07/2026)*

La formule du §4 d'`EQUILIBRAGE_FINAL.md` donne une conversion universelle : **1 point de budget
= 9 PV = 1 Attack** (`hp_scale`, soit à peu près la durée d'un combat — un point d'Attack
resservant à chaque tour). Un objet se chiffre donc dans la même monnaie qu'un perso.

| Rareté | Budget/objet | Équilibré | Orienté PV | Orienté Attack |
|---|---|---|---|---|
| Gris | **2 pts** | +9 PV / +1 ATK | +18 PV | +2 ATK |
| Vert | **4 pts** | +18 PV / +2 ATK | +27 PV / +1 ATK | +9 PV / +3 ATK |
| Bleu | **6 pts** | +27 PV / +3 ATK | +36 PV / +2 ATK | +18 PV / +4 ATK |

`hp / 9 + attack` redonne exactement le budget de la rareté — `chargerConfig()` le vérifie au
démarrage. En Gris les objets « orientés » sont **purs** : à 2 points, un 75/25 tomberait sur
des demi-points impossibles à stocker en entier.

**Un set Bleu complet = 12 points**, soit 60 % d'un niveau de perso pour les raretés courantes
et **80 % pour un Épique** (dont les niveaux ne valent que 15 points, pas 20). Monter son perso
reste donc plus rentable que farmer des coffres — c'est l'ordre de priorité voulu.
⚠️ Les budgets Légendaire déjà en config (185/195/205) ne donnent que **10 points par niveau** :
le jour où la rareté devient tirable, un set vaudra plus qu'un de ses niveaux. À revoir alors.

### Inventaire et sacrifice *(ajouté le 21/07/2026)*

Deux ajustements décidés après simulation, qui **remplacent** la règle brute ci-dessus :

- **L'équipement est PAR PERSO, pas par joueur.** Un objet obtenu va dans un **inventaire
  global illimité** ; le joueur choisit de l'équiper sur un perso, et il y est alors **soudé**.
  La règle « on ne déséquipe pas » est conservée : pour libérer un slot il faut **recycler** ce
  qu'il contient. Ça permet de personnaliser chaque perso, et ça évite de détruire un objet au
  moment de l'obtention.

- **Sacrifice : 6 objets Gris → 1 coffre garanti Vert · 4 objets Vert → 1 coffre garanti Bleu.**
  Le joueur **sélectionne lui-même** les objets à détruire dans son inventaire, et le coffre
  s'ouvre aussitôt. Les objets en trop **sont** la monnaie : pas de ressource intermédiaire à
  accumuler, et le joueur voit exactement ce qu'il détruit. Un objet **porté** n'est jamais
  sacrifiable directement — il faut d'abord le recycler.
  *(Une première version accumulait des « pièces » au recyclage ; abandonnée le jour même,
  elle faisait monter un compteur sans que le joueur sache quoi en faire.)*

**Pourquoi le sacrifice existe** — mesuré sur 20 000 joueurs × 120 jours
(`server/scripts/simu-equipement.ts`, calibré : il retrouve les 34 jours annoncés plus haut) :

| Profil | 2 slots Bleu, sans sacrifice | **avec 6/4** |
|---|---|---|
| Plancher (~160 Berrys/j) | 25 j | **14 j** |
| Non-live actif | 9 j | **6 j** |
| Présent en live | 4 j | **3 j** |

⚠️ **Ce que le sacrifice ne règle pas** : le taux de coffres inutiles reste à ~95 %, parce que le
plafond est dur (12 points, impossible à dépasser). Une fois les 2 slots en Bleu, *tout* devient
inutile — y compris un coffre garanti Bleu. Le sacrifice change la **vitesse**, pas le plafond ;
son vrai apport est qu'un Gris en trop redevient quelque chose. Le correctif du plafond sera la
**4ᵉ rareté Violet**, dont le §4 chiffre déjà le recyclage (80 Berrys).

**Où c'est à l'écran** : le **coffre** est dans l'onglet Coffres (payé en Berrys, rien d'autre).
L'**inventaire** est dans l'onglet ÉQUIPEMENT de la Collection, qui montre **un seul perso à la
fois** (sélecteur en haut) avec ses 2 slots — jamais la liste de tous les persos équipés. Le
**sacrifice** se fait là, puisque c'est là que sont les objets.

---

## 5. TWITCH — CE QUI EST FAISABLE *(vérifié sur la doc)*

| Fonction | Faisable ? | Comment |
|---|---|---|
| Présence / watch-time → XP | ✅ | Endpoint **Get Chatters** (scope `moderator:read:chatters`). Inclut les lurkers connectés au chat. |
| Lire le **solde** de points de chaîne | ❌ | **Impossible**, aucune API. |
| Dépenser des points de chaîne | ✅ | **Custom Rewards** (max 50) + EventSub `channel.channel_points_custom_reward_redemption.add` |
| Subs | ✅ | `channel.subscribe`, `.gift`, `.message` |
| Bits | ✅ | `channel.cheer` |
| Raids / follows / hype train | ✅ | EventSub |

**Technique historique :** OAuth une fois sur la chaîne + EventSub. *(Le choix WebSocket évoqué
initialement a été abandonné — voir §5bis : le backend tourne en fonction Vercel serverless,
qui ne peut pas tenir une connexion permanente.)*

---

## 5bis. TWITCH EN LIVE — CE QUI EST CONSTRUIT *(fait le 22/07/2026)*

Présence et coffre premium sont en production. Le duel entre viewers (et son annonce dans le
chat) reste à concevoir — mis de côté volontairement.

### Présence → Berrys

- Sondée par un **cron externe** (cron-job.org, appel `GET /api/cron/presence?cle=...` toutes
  les **1 min**) plutôt qu'une boucle interne : le Vercel Cron gratuit ne permet qu'un
  déclenchement par jour, insuffisant ici.
- Le cron interroge **Get Chatters**, qui inclut déjà les lurkers connectés au chat (silencieux).
  **Limite acceptée** : aucune API Twitch n'expose qui regarde le stream chat fermé — Get
  Chatters est le maximum atteignable.
- +40 Berrys par tranche de 30 min de présence détectée, +20 une fois par live à la première
  détection (chiffres du §3, inchangés).
- **Jamais crédités automatiquement** (décidé le 22/07/2026) : ils s'accumulent dans un compteur
  "en attente" que le joueur encaisse lui-même en cliquant sur le rond du bandeau Twitch de
  l'accueil. Voulu : le joueur voit et déclenche le gain, plutôt qu'un solde qui bouge tout seul.

### Coffre premium

- **Uniquement le tirage perso** (pas l'équipement) — décidé le 22/07/2026 pour rester simple.
- Custom Reward Twitch **"Tirage premium — personnage"**, **1000 points de chaîne**, limité à
  **1 par viewer et par stream** (réglage natif Twitch `max_per_user_per_stream`, pas une règle
  côté serveur).
- Taux du tirage premium (même pool de persos, meilleurs taux, jamais de contenu exclusif) :

  | Rareté | Normal | Premium |
  |---|---|---|
  | Commun | 70 % | 41 % |
  | Peu commun | 22 % | 36 % |
  | Rare | 7,5 % | 21 % |
  | Épique | 0,5 % | 2 % |

  Épique volontairement plafonné à 2 % (une première proposition à 5 % a été jugée trop
  généreuse) — clés `drop_rate_premium_*` en config.
- Crédité dans `players.coffres_premium_perso` par le webhook EventSub sur la redemption
  (identifiée par le TITRE de la récompense, pas son id — rien à stocker de généré côté serveur).
- Bouton "ROLL PERSONNAGE PREMIUM" sur l'écran Coffres : même mise en page que le roll normal,
  en violet, **toujours visible avec un compteur rond (x0 inclus)** — jamais caché à zéro,
  seulement désactivé.
- Si le viewer qui cachète n'a jamais de compte lié à ce `twitch_id` dans le jeu, la récompense
  est perdue (limite acceptée : il faut déjà avoir joué pour dépenser des points sur ce canal).

### Autorisation technique

Deux jetons OAuth différents, à ne pas confondre :
- Le **login joueur** normal (§3), sans scope, jamais stocké.
- Un jeton **broadcaster** séparé (`/auth/twitch/streamer/login`, une seule fois, scopes
  `moderator:read:chatters channel:read:redemptions channel:manage:redemptions`), stocké en
  base avec son refresh token — c'est lui qui lit les chatters et crée la récompense.
- La création de l'abonnement EventSub, elle, exige un **jeton d'application** (client
  credentials), pas le jeton broadcaster — piège Twitch découvert en configurant : message
  d'erreur *"auth must use app access token to create webhook subscription"*.

### Statut live à l'écran

Le bandeau Twitch de l'accueil est un vrai lien cliquable vers la chaîne, avec deux textes selon
`stream.online`/`.offline` (EventSub) : violet "Ne manque pas les lives de..." hors live, rouge
"🔴 EN DIRECT" pendant.

---

## 6. ARCHITECTURE TECHNIQUE *(figé)*

| Brique | Rôle | Outil (gratuit pour démarrer) |
|---|---|---|
| **Frontend** (webapp) | Ce que le viewer voit | **Vercel** *(pas encore déployé — tourne en local, React + Vite)* |
| **Base de données + login** | Comptes, persos, collection, niveaux, Berrys | **Supabase** ✅ en place |
| **Backend** | Calcule les combats + gacha + écoute Twitch (EventSub) | **Vercel** ✅ — fonction serverless, PAS Railway (voir note ci-dessous) |

⚠️ **Le plan "3 briques" ci-dessus est dépassé** : le backend tourne finalement en **fonction
Vercel serverless**, pas sur un process permanent (Railway). Une fonction Vercel ne tient pas de
connexion continue, ce qui a changé deux choix pour la Brique 6 (voir plus bas) : EventSub en
**webhook** plutôt qu'en WebSocket, et la présence sondée par un **cron externe** (cron-job.org)
plutôt qu'une boucle interne au serveur.

### État réel *(mis à jour le 22/07/2026)*

Fait : DB + config (Brique 1), moteur de combat (Brique 2), login Twitch + onboarding (Brique 3),
gacha (Brique 4), tous les écrans + l'affichage de combat (Brique 5), XP des persos, recharge
d'énergie, matchmaking, recyclage, quêtes, équipement, prime au classement, **et la Brique 6
partiellement : présence en live + coffre premium (détail au §5bis)**.

Reste dans la Brique 6 : le duel entre viewers et l'annonce dans le chat quand l'un bat l'autre
— **mise de côté**, le duel lui-même n'est pas encore conçu.

**Routes du backend (server/src/server.ts) :** `GET/POST /auth/twitch/*`, `GET /auth/dev/login`
*(dev uniquement)*, `GET /me`, `GET /etat`, `GET /collection`, `POST /perso-actif`, `POST /tirage`,
**`POST /recycler`**, `GET /classement`, `POST /combat`, `POST /logout`.

**Scripts de validation** (logique pure, ni base ni horloge — relançables à tout moment) :
`node server/scripts/validation.ts` (moteur), `validation-gacha.ts` (taux de drop),
`validation-recharge.ts` (énergie, semaine, prix des changements), `validation-onboarding.ts`.

**Simplifications assumées, à reprendre plus tard :**
- *(Réglé le 22/07/2026 : le §4bis est couvert en ENTIER — appariement aléatoire, pool de
  13 bots écrits à la main dans `config.bots_pool`, anti-frustration et anti-répétition sur
  4 combats. Voir `combat-api.ts`.)*
- *(Réglé le 20/07/2026 : la recharge quotidienne de l'énergie, la remise à zéro hebdomadaire
  des changements et leur tarification au-delà du quota sont faites — voir `recharge.ts` et
  `server/scripts/validation-recharge.ts`.)*
- *(Fait le 21/07/2026 : les quêtes — voir §8bis. `quetes.ts`, `quetes-api.ts`,
  `validation-quetes.ts`, écran `Quetes.tsx`.)*
- *(Fait le 21/07/2026 : l'équipement — voir §4ter. `equipement.ts`, `equipement-api.ts`,
  `validation-equipement.ts`, `simu-equipement.ts`. Le bonus entre dans le combat par
  `Engage.equipement`, ajouté à plat APRÈS la formule du §4 — jamais dans le budget, sinon la
  racine carrée le rendrait inégal d'un profil à l'autre. **Les bots n'ont jamais d'équipement**,
  volontairement : leur équilibrage a été chiffré sans, et le bot faible du §4bis doit rester
  faible. L'écran est fait depuis le 21/07.)*
- *(Fait le 22/07/2026 : la prime — voir §4quater. `prime.ts`, `validation-prime.ts`. Le
  classement ne trie plus par Berrys.)*
- *(Fait le 22/07/2026 : l'onboarding est JOUÉ par le joueur — voir §4. Le compte se crée vide.)*
- **La quête « ouvrir 1 coffre » est retirée du catalogue**, faute d'un compteur de coffres
  ouverts en base : les objets recyclés disparaissent, on ne peut pas les compter après coup.
- **La prime est cumulative**, donc un joueur arrivé tard ne rattrape jamais les anciens.
  Acceptable au lancement (l'énergie plafonne tout le monde à 10 combats/jour, personne ne peut
  creuser l'écart en jouant plus), mais appellera des **saisons** le jour où ça découragera.

### 🔑 RÈGLE D'OR
**Tous les chiffres et le contenu vivent dans des fichiers de config / des tables — JAMAIS en dur dans le code.**
→ Rééquilibrer = changer un nombre. Ajouter un perso = ajouter une ligne.
Concerné : les 8 constantes de combat (§2), la table des classes, base/plafond, coûts de kit, taux de drop, gains, coûts, énergie, stats des persos.

### Flux d'un combat
1. Le backend calcule le combat → **liste d'événements** (`attaque`, `-12`, `esquive`, `×1.1`, `crit`, `spécial`, `transformation`, `KO`)
2. Il envoie la liste au frontend
3. Le frontend **rejoue les animations** selon la liste

> Le combat est **déterministe côté serveur** : le client n'est qu'un lecteur. Anti-triche + léger.

### Modèle de données *(mis à jour le 19/07/2026 — colonnes réellement en base)*
- `players` : id, twitch_id, pseudo, berrys, niveau_compte *(colonne présente mais **utilisée nulle part** — usage à définir ; il n'y a qu'un seul système d'XP dans le jeu, celui du perso)*, perso_actif_id, `changements_restants` *(⚠️ **descend sous zéro** une fois le quota épuisé : c'est ce compteur négatif qui fait monter le prix 20 → 40 → 60, sans colonne dédiée. L'affichage le borne à 0)*, energie, `derniere_recharge` *(quotidienne)*, `derniere_recharge_changements` *(hebdomadaire — période différente, donc horodatage séparé)*, `defaites_consecutives` *(§4bis, remis à 0 à chaque victoire)*
- `characters` (catalogue) : id, nom, classe, rarete, profil, cout_kit_pct, pv/attack par niveau, esquive_pct, crit_pct, resistance, competence (nom, type, effet, déclencheur), `sprite_folder`, `image_menu` (portrait fixe, Accueil/Collection/Tirage/VS), les réglages visuels du §7 (taille, taille/hauteur projectile normal + spécial, vitesse anim/projectile spécial, départ projectile spécial, effet décalage X/Y, taille, opacité, vitesse, plan, boucle), `forme_transformee_id` (nullable), **`jouable`** (`false` pour les formes transformées : elles ne sont ni tirables ni collectionnables, juste un porteur d'assets relié via `forme_transformee_id`)
  → **`persos.csv` est directement importable dans cette table** (les colonnes du §7 s'importent depuis les `_INFO.txt` des zips, voir `server/scripts/importer-sprites.ts`).
- `collection` : player_id, character_id, niveau, xp, obtenu_le
- `equipment` : id, player_id, type, hp, attack *(table créée, logique pas encore construite)*
- `fights` : id, joueur_a, joueur_b *(null si bot)*, vainqueur, log (JSON des événements), date, `adversaire_character_id` + `adversaire_pseudo` *(§4bis : `joueur_b` étant null pour un bot, sans ces colonnes on ne saurait pas quel adversaire a été affronté ni sous quel pseudo — elles sont **déjà remplies**, il ne manque que leur lecture pour l'anti-répétition sur 4 combats)*
- `config` : cle/valeur —
  - les 8 constantes de combat (§2), `triangle_counters`, `max_tours`
  - les budgets par rareté/niveau, les profils `h`
  - gacha : `drop_rate_*`, `cout_tirage_perso`, `recyclage_doublon_*` (§4)
  - combat : `gain_combat_gagne`, `gain_combat_perdu` (§4)
  - progression : `xp_combat_gagne`, `xp_combat_perdu`, `xp_niveau_2`, `xp_niveau_3` (§3)
  - recharge : `energie_max`, `changements_par_semaine`, `changement_prix_paliers`,
    `fuseau_horaire`, `heure_reset`, `jour_reset_hebdo` (§3/§4)
  - matchmaking : `defaites_avant_bot_faible`, `bot_faible_raretes`, `bot_pseudos` (§4bis)

**Sprites (Supabase Storage) :** bucket public `persos`, un dossier par perso à la racine
(`persos/{Nom}/idle/01.png`, `run/`, `attack/`, `hit/`, `death/`, `special/anim/`,
`special/effet/`, `special/projectile/`, `projectile/`, plus `menu.webp` le portrait fixe).
Les formes transformées (Dalton_Zoan, Chopper_Heavy_Point, Pell_Zoan) ont leur propre dossier,
sans `special/*` (§3 : pas de 2e spécial une fois transformé) ni portrait (jamais montrées en
dehors du combat).

---

## 7. PIPELINE ASSETS *(validé, outils en place)*

**Outils locaux (gratuits, aucun crédit Claude) :**
- 🏭 `usine-a-persos.html` : sheet → découpe auto → détourage → tri → réglages → **aperçu en direct** → export ZIP
- ⚔️ `testeur-combat.html` : dépose 2 zips → combat auto (classes, passifs, spécial, projectiles, transformation)

**Structure d'un zip perso :**
```
Nom/
  idle/ 01.png 02.png …
  run/
  attack/
  hit/
  death/
  projectile/                 (attaque à distance)
  special/anim/               (anim du corps pendant le spécial)
  special/effet/              (aura posée sur le perso)
  special/projectile/         (projectile du spécial)
  _INFO.txt
```

**Champs du `_INFO.txt` → deviennent des colonnes de `characters` :**
```
Nom, Classe, Taille (1→2)
Taille projectile, Hauteur projectile
Taille projectile special, Hauteur projectile special
Vitesse anim special, Vitesse projectile special, Depart projectile special
Effet decalage X, Effet decalage Y, Effet taille, Effet opacite,
Effet vitesse, Effet plan (derriere|devant|arriere), Effet boucle (oui|non)
```

**Comportements du spécial (déduits du contenu) :**
| Ce que le perso a | Comportement |
|---|---|
| anim de corps + projectile spécial | Il reste sur place, le projectile part |
| **projectile spécial seul** (frames du geste dedans) | **Il fonce et frappe au contact** |
| anim de corps + effet | Il reste sur place avec son aura |

**Constantes de rendu (référence : `testeur-combat.html`, en 16/10 paysage) :**
- échelle : `(H*0.30)/ref * taille` · sol : `GY = H*0.86`
- effet : `x = perso + face*(efX*bodyH*0.5)` · `y = GY - bodyH*0.5 - (efY*bodyH*0.5)`
- projectile : `largeur = H*0.22*taille` · `y = GY - H*(0.05 + hauteur*0.40)`
- temps figé du spécial : **1100 ms**, identique pour tous
- vitesse projectile : `durée = 1300 - vitesse*105` ms
- **inversion auto du sprite** selon le sens (ne jamais l'oublier)

> ⚠️ **Écart assumé dans le jeu réel (§8) : l'arène de combat est en 3/4 portrait**, pas en
> 16/10 comme le testeur (plein écran mobile, §8 point 3). Deux conséquences à connaître si tu
> retouches le rendu ou que tu crées de nouveaux assets :
> - **l'échelle perso est réduite à `(H*0.16)/ref*taille`** (pas 0.30) pour laisser assez d'écart
>   entre les deux combattants dans un cadre étroit — sinon ils se marchent dessus ;
> - **la hauteur du projectile doit être compensée dans la même proportion**
>   (`× 0.16/0.30`, sinon il part bien plus haut sur le corps que prévu, désormais plus petit) —
>   voir `RATIO_HAUTEUR_PROJECTILE` dans `web/src/screens/Combat.tsx`. Si l'échelle perso rebouge
>   encore, c'est ce seul ratio qu'il faut ajuster, pas chaque formule une par une.
> - la largeur du projectile, elle, a aussi été réduite de 15 % à l'usage (retour testeur en jeu :
>   "un peu gros") — indépendamment du point ci-dessus.

**Règles de production :** même style pour tout le roster, fond transparent, tailles cohérentes, **pieds ancrés au sol**.

✅ **La résistance a son signe visuel : une icône bouclier 🛡️** à côté du nom, dès que la
résistance du perso passe au-dessus de 0 (transformation ou passif). Même traitement pour les
**buffs** (icône 💪 à côté du nom, permanente pour le reste du combat comme le buff lui-même) et
les **debuffs** (icônes sous la barre de vie — ⚔️⬇️ Attack, 💨⬇️ esquive, ♻️🚫 régén bloquée —
affichées pour une durée approximative, faute d'un événement "debuff expiré" dans le contrat §6).

---

## 8. UX — LES ÉCRANS *(mis à jour le 19/07/2026 — reflète l'écran réel, pas juste le plan initial)*

**Navigation : barre en bas, 4 onglets max** → `🏠 PONT` (Accueil) · `📦 COLLECTION` · `🎲 COFFRES` (Tirage) · `🏆 CLASSEMENT`
*(noms repris du prototype visuel validé par l'utilisateur — différents des libellés génériques du plan initial, mêmes écrans.)*
Le **combat** n'est pas un onglet : c'est un **plein écran** lancé depuis le Pont.

**Contexte :** le viewer est sur son tél, en train de regarder le live. 30 secondes d'attention. Peu d'écrans, peu de taps, lisible d'un coup d'œil.

1. **Connexion** — un seul bouton "Se connecter avec Twitch" *(+ un login de secours sans Twitch tant que l'app officielle n'est pas créée, à retirer avant la mise en ligne)*.
2. **🏠 Pont** *(80 % du temps passé)* — perso actif (portrait fixe pour l'instant, pas encore l'idle animé en boucle) + nom/classe/rareté/niveau + Berrys + combats restants + **un gros bouton ⚔️ COMBATTRE**, puis l'encart "en live : +X Berrys/30 min" *(valeurs de test, la vraie détection de live arrive avec la Brique 6)*, puis un **encart Quêtes** qui montre la quête du jour ET celle de la semaine (progression + bouton Réclamer), avec un lien **"Voir tout"** vers le panneau complet (§8bis). Les succès de collection ne sont que dans ce panneau.
3. **⚔️ VS** (plein écran, ~2 s, pendant que les sprites du combat chargent) — portraits des deux combattants, noms, classes, animation "VS" — **nouveau, pas prévu au plan initial**, ajouté pour que le viewer sache qui il affronte avant que ça commence.
4. **⚔️ Combat** (plein écran, arène en **3/4 portrait**, pas 16/9 — voir §7). Trois moments :
   **① l'écran VS** — portraits qui entrent de chaque côté avec dépassement et 150 ms de décalage, "VS" qui claque au centre (scale 3→1 + flash blanc + micro-secousse), fond coupé en diagonale aux couleurs de classe des deux combattants, **niveau + rareté** affichés (c'est l'enjeu réel : « Arlong Niv 3 vs Crocodile Niv 1 »), **« le pirate de {pseudo} »** sous le portrait adverse, et un bandeau **« ⚔️ Haki contre Paramecia — dégâts ×1.1 »** quand le triangle joue. Durée : 3,8 s, calée sur le **temps de lecture** du bandeau et non sur celle des animations. Tap pour lancer plus tôt.
   **② le combat** — barres de vie avec nom + badge de classe + traînée de dégâts + pulsation sous 25 % de vie, popups **empilés** (plusieurs effets simultanés restent lisibles : dégâts + vol de vie + debuff), couleur selon la nature (blanc/or dégâts, cyan esquive, vert soin/régén, violet poison, orange debuff, bleu clair résistance), CRIT et SPÉCIAL avec vrai temps figé (buffs et transfos compris), icône 🛡️ résistance / 💪 buff à côté du nom, icônes de debuff sous la barre de vie, transformation avec anneau qui explose, **toggle vitesse ×1/×2** *(pas de bouton passer ⏩, retiré du plan — décision utilisateur)*. Le multiplicateur ×1.1 du triangle **n'est plus affiché sur les popups** : il parasitait le chiffre de dégâts, et l'écran VS l'enseigne déjà une bonne fois.
   **③ la fin** — après le KO, ~1,2 s où le vainqueur revient au centre sous un projecteur en pose d'idle, puis le panneau de fin qui claque avec le même punch que le VS : gains en Berrys, **barre d'XP du perso** qui se remplit, « ⬆ NIVEAU X ATTEINT ! » le cas échéant, Rejouer/Retour.
5. **📦 Collection** — grille 3/ligne, bordure de rareté, badge de classe, niveau, perso actif marqué ★, filtres classe/rareté (défilement tactile), compteur "X/16", onglets PIRATES/ÉQUIPEMENT *(l'onglet Équipement affiche "verrouillé", la logique équipement n'est pas construite)*, bouton ♻️ Recycler *(mode recyclage : un tap sur un pirate propose de l'échanger contre des Berrys, avec confirmation ; le pirate actif est exclu)*.
6. **Fiche perso** — portrait, classe (+ passif en 1 ligne), rareté, niveau + barre XP (alimentée par `collection.xp`, que chaque combat fait monter), **compétence unique**, bouton "Incarner" + "changements restants : X/3".
7. **🎲 Tirage** *(le moment de stream)* — coût, bouton TIRER, puis une cérémonie en trois temps :
   **① le coffre** tremble et s'ouvre (couvercle qui bascule + rai de lumière). ⚠️ Cette phase est **strictement identique quelle que soit la rareté** — même couleur, même durée, même intensité. Une version précédente y faisait monter un "tell" de rareté ; c'est devenu contre-productif dès que la roulette est arrivée derrière, puisque le joueur savait déjà ce qu'il aurait pendant tout le défilé.
   **② la roulette** — un ruban de 58 portraits défile sous un repère central, décélère et s'arrête **exactement** sur le perso tiré. Voir les tuiles frôlées est l'effet recherché ("j'ai failli avoir Crocodile"). Le ralentissement se joue en **deux transitions enchaînées** dont les vitesses se raccordent à la jonction (sinon on voit une accélération parasite) : une phase d'emballement, puis les 12 dernières tuiles au ralenti. Durées : Commun 4,2 s → Épique 6,8 s.
   **③ la carte** — la tuile gagnante grandit en carte, avec brillant holographique (Rare+ seulement), zoom lent sur le portrait, et stats qui montent en cascade (nom → badges → PV/ATK → compétence).
   Tap n'importe où pour passer. Résultat + "Incarner" (gratuit, changement immédiat) + **"Recycler" directement au drop**, doublon → recyclé automatiquement, taux de drop affichés. *Roll premium et coffre équipement affichés mais verrouillés (Brique 6 / équipement pas construits).*

   > **Le défilé est purement décoratif** et ne change jamais le résultat : le gagnant vient du serveur avant que la roulette ne démarre. Ses proportions vivent donc dans `Tirage.tsx` et non dans `config` (voir la nuance à la Règle d'or). Les raretés du haut y sont **rationnées explicitement** — 45 % des roulettes n'en montrent aucune, 40 % une, 15 % deux — parce qu'avec de simples pondérations un défilé sortait 3 Épiques d'affilée, et comme le catalogue n'a qu'un seul Épique on voyait Crocodile passer trois fois : le joueur comprend la supercherie en deux tirages.
8. **🏆 Classement** — tableau des primes, top joueurs + **ta position mise en avant**, triés par **prime** *(voir §8bis)*.

**Détails qui comptent :** onboarding (perso offert + tirage gratuit immédiat), états vides toujours avec un bouton d'action, tout est cliquable vers l'action.

**Tutoriel réel : 2 étapes** (perso actif → bouton COMBATTRE), déclenché automatiquement à la
première connexion. *(Le plan initial disait "à ne pas faire : tutoriel en 5 étapes" — celui-ci
en fait 2, repris du prototype validé, ça reste dans l'esprit "peu de taps".)*

**À NE PAS faire au début :** onglets vides (Boutique/Équipage/Primes), écran de stats détaillées.

### Identité visuelle (base actuelle, à affiner en DA)
- Fond `#0e0b08`, texte `#efe7d6`
- Accents : rose `#ff2d6b`, or `#ffc53d`, cyan `#25d3df`
- Titres Arial Black italique penchés (skew), style shonen
- Cartes arrondies, bordures épaisses, boutons à ombre "3D"
- Couleurs de classe : Haki `#8e44ad` · Logia `#e67e22` · Paramecia `#16a085` · Zoan `#c0392b` · Sniper `#2980b9` · Sabreur `#27ae60`

---

## 8bis. QUÊTES *(validé et construit le 21/07/2026)*

Trois familles. Tout le contenu vit dans `config` (clé `quetes_catalogue`), la progression est
**lue en direct** dans `fights` et `collection` — **aucun compteur** n'est tenu en base. La seule
chose stockée est ce qui a été **réclamé** (table `quetes_reclamees`, clé `(player, quête, période)`
qui interdit tout double-paiement).

- **Quête du jour** — une seule affichée, choisie par **rotation déterministe** (même jour = même
  quête pour tous), réclamable de nouveau chaque jour. Récompense **50 Berrys** (déjà compté dans
  l'économie du §4). Pool : *Jouer 10 combats*, *Gagner 3 combats*, *Ouvrir 1 coffre* (cette
  dernière `actif:false` tant que l'équipement §4ter n'existe pas).
- **Quête de la semaine** — même horloge hebdo que les changements de perso. Au lancement :
  *Gagner 20 combats*, **200 Berrys**. ⚠️ **Cette récompense n'est PAS dans les simulations
  d'économie du §4** — montant volontairement modeste, **à surveiller/valider**.
- **Succès de collection** — permanents, réclamables **une seule fois à vie**, uniquement dans le
  panneau "Voir tout". Objectif **dynamique** (suit le nombre de persos en base, donc ajouter un
  perso ne demande aucune modif) :
  - par rareté : tous les Communs **150**, Peu communs **250**, Rares **500**, Épiques **500** ;
  - par classe : chaque classe complète **300**.

**⚠️ Tous ces montants sont provisoires**, posés pour livrer le système ; à rééquilibrer par
simple édition de `quetes_catalogue`. Ils ne sont pas encore passés par une simulation d'économie.

---

## 9. ROADMAP

**Cœur (d'abord) :** DB ✅ → login Twitch ✅ *(login de secours en attendant l'app officielle)* → gacha/roll ✅ → collection ✅ → perso actif ✅ → combat 1v1 (classes + passifs) ✅ → connexion Twitch live ✅ *(présence + coffre premium faits, §5bis — duel/annonce chat restant, mis de côté)*.

**Ensuite :** recyclage *(fait, automatique au tirage)* · Berrys/économie ✅ · énergie ✅ · équipement (PV/Attack) ⬜ · compétences uniques ✅ · transformations ✅ · classement *(fait, version simplifiée triée par Berrys)* · quêtes ✅ *(§8bis)*.

**Plus tard :** équipage (5 **joueurs**, pas 5 persos) · combat de groupe (✅ prototypé) · boss & raids · titres · rival · primes (bounty) · aura de capitaine · guerre de territoire (le plus gros morceau).

---

## 10. ÉQUILIBRAGE — MÉTHODE *(refondue le 16/07/2026)*

### Les 4 sources de puissance — ne jamais les mélanger

| Question | Levier | Poids | Jamais touché par |
|---|---|---|---|
| « Je suis rare » | **budget** (140/160/180/195) | +14 %/rareté | le reste |
| « Je suis Haki » | **triangle + passif** (valeur égale pour tous) | ±10 % | les stats |
| « Je suis Arlong » | **spécial**, payé sur le budget | 0 à +15 % | la classe |
| « J'ai investi » | **niveau** | **+40 %** | — |

**L'erreur à ne jamais refaire :** régler les 4 avec le seul levier « stats ». C'est ce qui a détruit la hiérarchie de rareté en juillet (Usopp Peu commun s'était retrouvé plus riche qu'Arlong et Mr.1, des Rares).

### La loi du jeu
> **Dans un combat de 8 tours, +10 % de puissance = 80 % de victoires.**

Il n'existe pas de « un peu plus fort ». Tout avantage permanent se répète 8 fois et devient une certitude. Conséquences :
- **Tous les chiffres doivent être petits** (×1.05 se sent déjà énormément).
- Ajouter de la variance sur les dégâts **ne sert à rien** : sur 8 tours, ça se moyenne. Testé jusqu'à ±100 % → 93 % au lieu de 100 %.
- **Plus le combat est long, plus le résultat est écrit d'avance.** La cible « 8-10 tours » achète du spectacle au prix du suspense — c'est un choix assumé.

### La recette pour ajouter un perso *(1 seul duel à simuler, pas tout le roster)*

1. Choisir **classe**, **rareté**, **profil**. C'est tout ce qu'on décide.
2. Estimer le **coût du kit** avec la grille ci-dessous.
3. Appliquer la formule du §3. **Terminé.**

**Grille tarifaire des effets (mesurée) :**

| Type d'effet | Coût |
|---|---|
| Dégâts ×1.3 à ×2.5, **une seule fois** | **0 à +1 %** — c'est gratuit |
| Dégâts + poison, ou + blocage de régén | +0 à +6 % |
| Dégâts + debuff court (2 tours) | +4 à +5 % |
| Dégâts + **vol de vie** | +13 % ⚠️ **sous-estimé, cf. ci-dessous** |
| **Buff permanent +30/35 % Attack** | +5 à +6 % |
| Dégâts + **critique garanti** | +5 à +7 % |
| **Transfo +20 % résistance / +25 % Attack** | +12 % |
| **Transfo +26 % résistance / +35 % Attack** | +17 % |

> **Règle du pouce : un effet permanent coûte ~10× un effet ponctuel.**
> Une erreur de 2-3 % ne se voit pas. Dans le doute, arrondir vers le haut.

**Le chiffre exact :** `v6.py` le calcule contre un **panel de 16 mannequins vierges** (un par classe, pondéré par la compo réelle du roster) : il compare le perso **avec** son spécial au **même perso sans spécial**. Ça isole le kit avec des durées de combat représentatives. Un nouveau perso = **un seul passage**, pas besoin de re-simuler le roster.

> ⚠️ **La limite connue de la méthode : les effets CONDITIONNELS sont mal facturés.** Le prix est mesuré sur une moyenne, mais un effet dont la valeur dépend de l'adversaire échappe à la moyenne :
> - le **vol de vie d'Arlong** vaut ~22 % contre un perso tanky, il est facturé 13 % → il est à 84 % (2e du jeu)
> - les **transfos à 60 % PV** (Dalton, Chopper) sont payées dès le tour 1 mais ne servent qu'en 2e moitié → surfacturées
>
> **Règle : tout nouvel effet conditionnel doit être testé contre un perso tanky ET un perso rapide**, jamais seulement contre la moyenne.

### Règles pour les vagues suivantes *(décidées le 16/07/2026)*

- **Jamais plus fort que le tier existant.** Un nouveau Rare = 140→180, comme Arlong. Pas de power creep : sinon chaque vague tue la précédente et tu passes ta vie à courir derrière ton propre jeu. **Le désir vient du personnage (c'est du One Piece), pas de la puissance.** Ton viewer ne veut pas « une unité forte », il veut Zoro.
- **2-3 persos par vague, étalés sur les tiers.** Jamais 5 Rares d'un coup. *(Mesuré : ajouter 5 Communs ne change rien — personne ne les joue. Doubler le roster fait tomber à 2/32 persos joués au jour 90.)*
- **Équilibrer les cases du triangle.** Le triangle a **3 cases** : `Haki` / `Logia + Paramecia` / `Zoan`. Garder des effectifs proches (aujourd'hui 3 / 4 / 3 — c'est bon). Ajouter 4 Logia d'un coup = offrir un buffet aux Haki, et tout se déséquilibre sans que personne comprenne pourquoi.
- **Le taux de drop se partage** dans un tier. Ajouter un 2e Épique → 0,25 % chacun au lieu de 0,5 %. Monter le total pour garder le rythme.
- **Le Légendaire est une décision, pas une vague.** Le jour où tu le sors (185→205), tu montes le plafond du jeu et tes Épiques deviennent le milieu de tableau. Ça se fait une fois, à un moment choisi.

---

## 11. MÉTHODE DE TRAVAIL (forfait Claude Pro)

- **Design / décisions** → chat + **Projet** (ce document dedans)
- **DA / maquettes** → **Claude Design**
- **Build du code** → **Claude Code** (appli desktop)
- **Modèle** : **Sonnet** par défaut ; **Opus pour l'archi difficile ET pour l'équilibrage** (leçon de juillet : Sonnet a produit un équilibrage qui avait l'air rigoureux mais dont le résultat était inutilisable)
- **Tests de sprites** → outils locaux (0 crédit)
- **Anti-saturation** : 1 sujet = 1 conversation courte · éditions ciblées · ne jamais recoller de gros fichiers dans le chat · surveiller Réglages > Utilisation

### Les fichiers du projet
| Fichier | Rôle |
|---|---|
| **GAME_DESIGN.md** (ce fichier) | Source de vérité des décisions |
| **EQUILIBRAGE_FINAL.md** | Les constantes, la formule, la méthode |
| **FICHE_PERSOS.md** | Le catalogue des 16 persos (lecture humaine) |
| **persos.csv** | Les 16 persos, **importable en base** |
| `v6.py` | Le générateur de stats + simulateur |
| `vraie_vie.py` | La simu de population (20 joueurs, taux de drop) |
| ~~RAPPORT_VERIFICATION.md~~ | Archive. **Ne pas donner à Claude Code** : contient des pistes abandonnées. |

---

## 12. ⚠️ PIÈGES APPRIS (à ne pas refaire)

- **Jamais de valeurs en dur** dans le code (on y revient toujours).
- **Écrire les constantes de combat AVANT d'équilibrer.** L'esquive de base, le crit et la variance n'étaient nulle part → aucun chiffre n'était reproductible. Premier truc à mettre en config.
- **La puissance est un PRODUIT, pas une SOMME.** `PV × Attack`, pas `PV + Attack`. D'où la racine carrée du §3. Sans elle, le profil Tank paie une taxe invisible de 25 %.
- **Ne jamais équilibrer en multipliant PV et Attack ensemble** par un facteur trouvé au tâtonnement : l'effet est **quadratique** (×k sur les deux = ×k² sur le résultat) et ça fait sortir le perso de son budget de rareté sans qu'on le voie.
- **Un effet permanent coûte ~10× un effet ponctuel.** Un « ×2.5 une fois » est gratuit. Ne pas nerfer les spéciaux de dégâts : c'est du spectacle offert.
- **Vérifier les passifs à stats égales**, sinon on paie un passif cassé avec des stats. C'est comme ça que le Sniper mort a fait exploser Usopp à 71,9 %.
- **Se méfier du « c'est du bruit statistique ».** Sur 1 100 combats, 71,9 % est à **14 écarts-types** de 50 %. Ça n'a jamais été du bruit.
- **Rétrocompatibilité** : quand on ajoute un réglage, prévoir une **valeur par défaut** = comportement actuel (ex : `résistance = 0`) → les anciens assets continuent de marcher.
- **Cohérence aperçu/jeu** : si deux outils affichent la même chose, ils doivent partager **exactement** les mêmes formules.
- En JS : **hisser les variables d'état** avant les boucles de préchargement d'images.
- Toujours **tester le code avant de le livrer** (smoke test).
- **Ne jamais mesurer un perso sur un tournoi où tous les persos ont le même poids.** Le « winrate global » est un mirage : Pell affiche 66 % parce qu'il écrase des Communs que **plus personne ne joue au jour 7**. Le seul chiffre honnête, c'est le winrate contre la **population réelle**.
- **Ne jamais simuler une population de 20 clones.** Il y a un facteur **7** entre un lurker (0,6 tirage/jour) et un hardcore (4,4). Tout mesurer sur le hardcore donne des chiffres faux et optimistes.
- **Un effet conditionnel n'a pas un prix, il a un prix qui dépend de l'adversaire.** Vol de vie, transfo à X % PV, gros coup : à tester contre un tanky ET un rapide.
- **Se méfier des chiffres non monotones.** Si un bonus ×1.1 donne 40 % et ×1.3 donne 59 %, ce n'est pas une mécanique, c'est du bruit d'arrondi. Le combat se finit sur un tour entier : tout est une marche d'escalier.
- **Savoir s'arrêter.** Quand chaque correction révèle un problème plus petit et plus tordu que le précédent, c'est fini. Le matin on corrigeait des trous à 40 points ; le soir on grattait des écarts sur des persos que personne ne joue.
