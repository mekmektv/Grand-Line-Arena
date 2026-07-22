# ONE PIECE ARENA — ÉQUILIBRAGE FINAL (v6)

> **Source de vérité des chiffres de combat.** Généré par `v6.py`. À donner tel quel à Claude Code.
> Le catalogue des persos est dans `FICHE_PERSOS.md` / `persos.csv`.
> Date : 16/07/2026.

---

## 1. Table `config` — les constantes de combat

⚠️ Ces valeurs n'existaient **nulle part** avant. Sans elles, aucun chiffre d'équilibrage n'est reproductible. **Premier truc à mettre en base.**

| Clé | Valeur |
|---|---|
| `hp_scale` | **9** — 1 point de budget PV = 9 PV |
| `esquive_base` | **10 %** |
| `esquive_logia` | **+10 %** (Logia/Paramecia → 20 % au total) |
| `crit_sabreur` | **30 %** |
| `crit_mult` | **1.5** |
| `zoan_regen` | **1,2 %** des PV max / tour |
| `sniper_ouverture` | **true** |
| `counter_mult` | **1.1** |

## 2. Les 5 passifs de classe

| Classe | Passif | Vaut |
|---|---|---|
| **Haki** | Ses coups ne peuvent pas être esquivés | +11 % dégâts |
| **Logia / Paramecia** | +10 % d'esquive | +12 % survie |
| **Zoan** | Régénère 1,2 % des PV max par tour (tout le temps) | +11 % PV effectifs |
| **Sabreur** | 30 % de chance de critique (×1.5) | +15 % dégâts |
| **Sniper** | Tire une fois avant le tour 1 | +11 % dégâts |

**Triangle : ×1.1** — Haki bat Logia/Paramecia · Logia et Paramecia battent Zoan · Zoan bat Haki.
**Sniper et Sabreur : neutres.** Ils ne contrent personne, personne ne les contre — les classes sans faiblesse.

**Résultat mesuré** (16 persos vierges, stats strictement identiques, aucun spécial, compo réelle 3/2+2/3/3/3) :

| Classe | Avant | **Après** |
|---|---|---|
| Haki | 68,1 % | **56 %** |
| Sniper | **27,7 %** ☠️ | **50 %** |
| Sabreur | 43,7 % | **50 %** |
| Zoan | 48,3 % | **49 %** |
| Logia | 55,9 % | 47 % |
| Paramecia | 56,4 % | 46 % |

**40 points d'écart → 10 points**, sans avoir touché à une seule stat.

> ⚠️ **`zoan_regen` est sur une falaise.** À 1,2 % → Zoan 49 %. À **1,3 % → Zoan 60 %**. Un dixième de pourcent = 11 points. Ne jamais dépasser 1,2.

---

## 3. TABLEAU FINAL — les 16 persos

| Perso | Classe | Rareté | Kit | Niv 1 | Niv 2 | Niv 3 | tier | **global** |
|---|---|---|---|---|---|---|---|---|
| Octi | Sabreur | Commun | +1 % | 445/49 | 534/59 | **623/69** | 63 % | 22 % |
| Smack | Sniper | Commun | 0 % | 450/50 | 540/60 | **630/70** | 54 % | 18 % |
| Baggy | Paramecia | Commun | +2 % | 440/49 | 528/59 | **616/68** | 47 % | 18 % |
| Kuroobi | Haki | Commun | +5 % | 350/58 | 420/70 | **490/82** | 44 % | 15 % |
| Dalton | Zoan | Commun | +17 % | 469/35 | 563/42 | **657/49** | 41 % | 12 % |
| Zoro | Sabreur | Peu commun | +5 % | 420/70 | 490/82 | **560/93** | 68 % | 58 % |
| Sanji | Haki | Peu commun | +2 % | 528/59 | 616/68 | **704/78** | 50 % | 52 % |
| Luffy | Paramecia | Peu commun | +6 % | 418/70 | 488/81 | **557/93** | 44 % | 47 % |
| Usopp | Sniper | Peu commun | +4 % | 517/57 | 603/67 | **690/77** | 46 % | 44 % |
| Chopper | Zoan | Peu commun | +12 % | 592/44 | 690/51 | **789/58** | 42 % | 44 % |
| **Arlong** | Haki | Rare | +13 % | 456/76 | 522/87 | **587/98** | 58 % | **84 %** |
| Mr.1 | Sabreur | Rare | +7 % | 483/80 | 551/92 | **620/103** | 66 % | 82 % |
| Mr.5 | Sniper | Rare | +6 % | 592/66 | 676/75 | **761/85** | 58 % | 78 % |
| Smoker | Logia | Rare | +5 % | 601/67 | 686/76 | **772/86** | 43 % | 73 % |
| Pell | Zoan | Rare | +8 % | 582/65 | 665/74 | **748/83** | 25 % | 65 % |
| **Sir Crocodile** | Logia | **Épique** | +6 % | 701/78 | 765/85 | **829/92** | seul | **89 %** 👑 |

Format : **PV / Attack**. « Kit » = coût du spécial, prélevé sur le budget de rareté. Durée moyenne d'un combat : **7,9 tours**.

### Hiérarchie de rareté

| Rareté | Winrate global moyen |
|---|---|
| Commun | **17 %** |
| Peu commun | **49 %** |
| Rare | **76 %** |
| **Épique** | **89 %** |

**Crocodile est le meilleur perso du jeu.** Arlong (84 %) est 2e, et il est **le contre naturel du boss — tant que Crocodile n'est pas monté au niveau 3.**

| Arlong niv 3 contre… | Croco **niv 1** | Croco **niv 2** | Croco **niv 3** |
|---|---|---|---|
| **Arlong gagne** | **100 %** | **80 %** | **41 %** |

Crocodile se tire au **niveau 1** (budget 165), pas au niveau 3 (195) : un Crocodile fraîchement obtenu se fait effacer 100-0 par un Arlong investi. **Le vrai contre du boss, c'est le niveau, pas la classe** — ce qui récompense l'investissement plutôt que le tirage.

> ⚠️ **À niveau 3 contre niveau 3, Arlong PERD (41 %) — et personne d'autre ne fait mieux.**
> Le contre fonctionne pourtant très bien : sans lui Arlong serait à 16 % (il vaut **+25 points**). Mais à ×1.1, le triangle ne renverse pas un écart de rareté. C'est exactement l'intention affichée au §2 de GAME_DESIGN : *« à ×1.1, contrer reste très fort mais la rareté reprend le dessus »*.
> **Corrigé le 17/07/2026.** Cette ligne disait avant « Arlong bat Crocodile en duel » : c'était un reste de l'époque du triangle à **×1.5** (où, §2, « un Commun qui contrait battait Crocodile l'Épique »). Faux depuis le passage à ×1.1 le 16/07. Vérifié dans `v6.py` **et** dans le moteur de combat, qui donnent le même chiffre à 0,1 point près (41,2 % / 41,3 %).

**Conséquence assumée : au niveau 3, Crocodile n'a aucune réponse.** Meilleures tentatives : Arlong 41 %, Mr.1 38 %, Smoker 28 %. Et **5 persos sont à 0 %** (Smack, Dalton, Octi, Baggy, Chopper) — ils ne peuvent pas gagner, jamais. Son équilibrage ne tient donc plus qu'à **un seul levier : la rareté à 0,5 %** — ce que le §8 interdit par ailleurs. Or ce levier s'use tout seul (§6 : 6 Crocodiles sur 20 joueurs au jour 30, 9 au jour 60).
→ **Date à surveiller : J+30.** Si ça pique, le levier le moins destructeur n'est ni le triangle ni les stats, c'est le **matchmaking** (éviter Épique niv 3 vs niveau 1). Voir aussi §7.

---

## 4. La formule — à coder telle quelle

```
budget_effectif = BUDGET[rareté][niveau] / (1 + coût_kit)
h               = PROFIL[profil]          # 0.40 Bourrin / 0.50 Équilibré / 0.60 Tank

PV     = 9 × (budget_effectif / 2) × √( h / (1 − h) )
ATTACK =     (budget_effectif / 2) × √( (1 − h) / h )
```

| Rareté | Niv 1 | Niv 2 | Niv 3 |
|---|---|---|---|
| Commun | 100 | 120 | 140 |
| Peu commun | 120 | 140 | 160 |
| Rare | 140 | 160 | 180 |
| **Épique** | **165** | **180** | **195** |
| *Légendaire (à venir)* | *185* | *195* | *205* |

⚠️ **La racine carrée est essentielle.** Sans elle, le profil Tank perd **25 % de sa puissance gratuitement** — c'est ce qui mettait Dalton à 7 % de winrate. Avec elle, tous les profils sont strictement équivalents (vérifié : 48-50 % dans les deux sens). Le profil est un **choix de style, pas un piège**.

---

## 5. Ajouter un perso plus tard

1. Choisir **classe**, **rareté**, **profil**. C'est tout ce qu'on décide.
2. Estimer le **coût du kit** avec la grille ci-dessous.
3. Appliquer la formule. **Terminé.**

### Grille tarifaire (mesurée sur le roster)

| Type d'effet | Coût |
|---|---|
| Dégâts ×1.3 à ×2.5, **une seule fois** | **0 à +2 %** — c'est gratuit |
| Dégâts + poison, ou + blocage de régén | +2 à +6 % |
| Dégâts + debuff court (2 tours) | +4 à +5 % |
| Dégâts + **critique garanti** | +5 à +7 % |
| Dégâts + **vol de vie** | +13 % (⚠️ sous-estimé, voir §7) |
| **Buff permanent +30/35 % Attack** | +5 à +6 % |
| **Transfo +20 % résistance / +25 % Attack** | +12 % |
| **Transfo +26 % résistance / +35 % Attack** | +17 % |

> **Règle du pouce : un effet permanent coûte ~10× un effet ponctuel.**
> « ×2.5 une fois » = gratuit. « +30 % pour toujours » = 5 à 17 % du budget.
> Une erreur de 2-3 % ne se voit pas. Dans le doute, arrondir vers le haut.

### Le chiffre exact
`v6.py` le calcule contre un **panel de 16 mannequins vierges** (un par classe, pondéré par la compo réelle du roster) : il compare le perso **avec** son spécial au **même perso sans spécial**. Ça isole le kit avec des durées de combat représentatives. **Un nouveau perso = un seul passage, pas besoin de re-simuler le roster.**

### Composition des vagues
- Le triangle a **3 cases** : `Haki` / `Logia + Paramecia` / `Zoan`. Garde-les à effectifs proches (aujourd'hui 3 / 4 / 3).
- **2-3 persos par vague, étalés sur les tiers.** Jamais 5 Rares d'un coup.
- **Jamais plus fort que le tier existant.** Un nouveau Rare = 140→180, comme Arlong. Le désir vient du personnage (c'est du One Piece), pas de la puissance.
- **Le taux se partage** : le tier Épique est à 0,5 % **au total**. Ajouter un 2e Épique → 0,25 % chacun → deux fois plus long à obtenir.

---

## 6. Ce que ça donne en vrai

**Population réelle simulée** (7 hardcore / 5 réguliers+lives / 4 réguliers hors live / 4 lurkers), matchmaking **100 % aléatoire**, taux **70 / 22 / 7,5 / 0,5** :

| Jour | Crocodile (sur 20) | Persos joués |
|---|---|---|
| 1 | 0 | 15-16 / 16 |
| 7 | 1 | 10 / 16 |
| 30 | **6** | 6 / 16 |
| 60 | 9 | 6 / 16 |

**Winrate ressenti** (le bot faible après 3 défaites est compté) :

| Profil | J+7 | J+30 |
|---|---|---|
| Hardcore | 62 % | 62 % |
| Régulier + lives | 62 % | 61 % |
| Régulier hors live | 52 % | 58 % |
| Lurker | **30 %** | 32 % |

---

## 7. ⚠️ Les limites connues de la méthode

**1. Les effets conditionnels sont mal facturés.** Le prix d'un kit est mesuré contre un panel moyen. Or un effet dont la valeur dépend de l'adversaire est mal évalué :
- **Le vol de vie d'Arlong** vaut ~22 % contre un perso tanky, il est facturé 13 % → il est trop fort (84 %).
- **Les transfos déclenchées à 60 % PV** (Dalton, Chopper) sont payées dès le tour 1 mais ne servent qu'en 2e moitié → surfacturées.

→ **Règle : tout nouvel effet conditionnel doit être testé contre un perso tanky ET un perso rapide**, pas seulement contre la moyenne.

**2. Pell est à 25 % dans sa rareté.** Structurel : il est Zoan face à Mr.1 (Sabreur) et Mr.5 (Sniper), les deux meilleurs passifs. **Un Zoan vierge à budget plein perd aussi contre eux (27 %).** Ce n'est pas Pell, c'est sa position dans le tier. À revoir à la vague 2.

**3. Dalton et Chopper sont surfacturés** (41 % et 42 % dans leur tier). Non corrigé volontairement : ce sont un Commun et un Peu commun, **plus personne ne les joue au jour 7**. Impact joueur : zéro.

---

## 8. La loi du jeu — à ne jamais oublier

> **Dans un combat de 8 tours, +10 % de puissance = 80 % de victoires.**

Il n'existe pas de « un peu plus fort ». Tout avantage permanent se répète 8 fois et devient une certitude. Conséquences vérifiées :

- **Tous les chiffres doivent être petits.** ×1.05 se sent déjà énormément. `zoan_regen` 1,2 → 1,3 = +11 points de winrate.
- **La variance ne sert à rien.** Testée jusqu'à ±100 % sur les dégâts : 93 % au lieu de 100 %. Sur 8 tours, tout se moyenne.
- **Plus le combat est long, plus le résultat est écrit d'avance.** La cible « 8-10 tours » achète du spectacle au prix du suspense — choix assumé.
- **Ne jamais régler 4 problèmes avec un seul levier.** Rareté → budget. Classe → triangle + passif. Perso → spécial payé sur le budget. Investissement → niveau. Jamais les stats pour tout.
