# 🏴‍☠️ GRAND LINE ARENA — FICHE DES PERSOS (vague 1)

> Les 16 persos, prêts à créer en base. Chiffres validés par simulation (`v6.py`).
> Version machine-lisible : **`persos.csv`** — c'est elle qu'on importe, pas ce fichier.
> Les règles et la méthode sont dans **`EQUILIBRAGE_FINAL.md`**.

---

## Comment lire une fiche

**Un perso n'a que 2 stats à lui : PV et Attack.**
L'esquive, le crit, la régén et le tir d'ouverture **viennent de la classe** — hérités, pas stockés par perso.

## Les 5 classes

| Classe | Passif | Esquive | Crit |
|---|---|---|---|
| **Haki** | Ses coups **ne peuvent pas être esquivés** | 10 % | 0 % |
| **Logia** | +10 % d'esquive | **20 %** | 0 % |
| **Paramecia** | +10 % d'esquive | **20 %** | 0 % |
| **Zoan** | **Régénère 1,2 % des PV max par tour** — tout le temps, dès le tour 1, transformé ou non | 10 % | 0 % |
| **Sabreur** | **30 %** de chance de critique (×1.5) | 10 % | **30 %** |
| **Sniper** | **Tire une fois AVANT le tour 1** (attaque gratuite d'ouverture) | 10 % | 0 % |

**Triangle : ×1.1** — Haki bat Logia/Paramecia · Logia et Paramecia battent Zoan · Zoan bat Haki.
**Sniper et Sabreur sont neutres** : ils ne contrent personne, personne ne les contre.

---

## ⚪ COMMUNS

### Octi — Sabreur, Equilibre

| Niv 1 | Niv 2 | Niv 3 |
|---|---|---|
| 445 PV / 49 ATK | 534 PV / 59 ATK | **623 PV / 69 ATK** |

**Frappe des 8 Lames** — Dégâts **×1.6**.
Déclencheur : aléatoire, garanti au plus tard **tour 8**. · Coût du kit : +1 % · **Winrate global : 22 %** · dans sa rareté : 63 %

### Smack — Sniper, Equilibre

| Niv 1 | Niv 2 | Niv 3 |
|---|---|---|
| 450 PV / 50 ATK | 540 PV / 60 ATK | **630 PV / 70 ATK** |

**Bulle d'Eau** — Dégâts **×1.3** (projectile).
Déclencheur : aléatoire, garanti au plus tard **tour 8**. · Coût du kit : -0 % · **Winrate global : 18 %** · dans sa rareté : 54 %

### Baggy — Paramecia, Equilibre

| Niv 1 | Niv 2 | Niv 3 |
|---|---|---|
| 440 PV / 49 ATK | 528 PV / 59 ATK | **616 PV / 68 ATK** |

**Fragment Tornade** — Dégâts **×1.6**.
Déclencheur : aléatoire, garanti au plus tard **tour 8**. · Coût du kit : +2 % · **Winrate global : 18 %** · dans sa rareté : 47 %

### Kuroobi — Haki, Bourrin

| Niv 1 | Niv 2 | Niv 3 |
|---|---|---|
| 350 PV / 58 ATK | 420 PV / 70 ATK | **490 PV / 82 ATK** |

**Karaté des Hommes-Poissons** — Buff : **+30 % Attack** pour le reste du combat (aucun dégât direct).
Déclencheur : aléatoire, garanti au plus tard **tour 3**. · Coût du kit : +5 % · **Winrate global : 15 %** · dans sa rareté : 44 %

### Dalton — Zoan, Tank

| Niv 1 | Niv 2 | Niv 3 |
|---|---|---|
| 469 PV / 35 ATK | 563 PV / 42 ATK | **657 PV / 49 ATK** |

**Forme Bison** — Transformation : **+26 % de résistance et +35 % Attack**, reste du combat.
Déclencheur : passe sous **60 % de ses PV**. · Coût du kit : +17 % · **Winrate global : 12 %** · dans sa rareté : 41 %


## 🟢 PEU COMMUNS

### Zoro — Sabreur, Bourrin

| Niv 1 | Niv 2 | Niv 3 |
|---|---|---|
| 420 PV / 70 ATK | 490 PV / 82 ATK | **560 PV / 93 ATK** |

**Phénix des 36 Désirs Terrestres** — Dégâts **×1.8** + **critique garanti** sur ce coup.
Déclencheur : aléatoire, garanti au plus tard **tour 8**. · Coût du kit : +5 % · **Winrate global : 58 %** · dans sa rareté : 68 %

### Sanji — Haki, Equilibre

| Niv 1 | Niv 2 | Niv 3 |
|---|---|---|
| 528 PV / 59 ATK | 616 PV / 68 ATK | **704 PV / 78 ATK** |

**Lame Noire** — Dégâts **×1.8** (projectile).
Déclencheur : aléatoire, garanti au plus tard **tour 8**. · Coût du kit : +2 % · **Winrate global : 52 %** · dans sa rareté : 50 %

### Luffy — Paramecia, Bourrin

| Niv 1 | Niv 2 | Niv 3 |
|---|---|---|
| 418 PV / 70 ATK | 488 PV / 81 ATK | **557 PV / 93 ATK** |

**Sang Bouillonnant** — Buff : **+35 % Attack** pour le reste du combat (aucun dégât direct).
Déclencheur : aléatoire, garanti au plus tard **tour 3**. · Coût du kit : +6 % · **Winrate global : 47 %** · dans sa rareté : 44 %

### Usopp — Sniper, Equilibre

| Niv 1 | Niv 2 | Niv 3 |
|---|---|---|
| 517 PV / 57 ATK | 603 PV / 67 ATK | **690 PV / 77 ATK** |

**Marteau d'Usopp** — Dégâts **×1.4** + **−15 % d'esquive** adverse pendant 2 tours.
Déclencheur : aléatoire, garanti au plus tard **tour 8**. · Coût du kit : +4 % · **Winrate global : 44 %** · dans sa rareté : 46 %

### Chopper — Zoan, Tank

| Niv 1 | Niv 2 | Niv 3 |
|---|---|---|
| 592 PV / 44 ATK | 690 PV / 51 ATK | **789 PV / 58 ATK** |

**Heavy Point** — Transformation : **+20 % de résistance et +25 % Attack**, reste du combat.
Déclencheur : passe sous **60 % de ses PV**. · Coût du kit : +12 % · **Winrate global : 44 %** · dans sa rareté : 42 %


## 🔵 RARES

### Arlong — Haki, Bourrin

| Niv 1 | Niv 2 | Niv 3 |
|---|---|---|
| 456 PV / 76 ATK | 522 PV / 87 ATK | **587 PV / 98 ATK** |

**Squalo Crunch** — Dégâts **×2.2** + **vol de vie 20 %** des dégâts infligés.
Déclencheur : passe sous **50 % de ses PV**. · Coût du kit : +13 % · **Winrate global : 84 %** · dans sa rareté : 58 %

### Mr.1 — Sabreur, Bourrin

| Niv 1 | Niv 2 | Niv 3 |
|---|---|---|
| 483 PV / 80 ATK | 551 PV / 92 ATK | **620 PV / 103 ATK** |

**Tornade d'Acier** — Dégâts **×2.2** + **critique garanti** sur ce coup.
Déclencheur : aléatoire, garanti au plus tard **tour 8**. · Coût du kit : +7 % · **Winrate global : 82 %** · dans sa rareté : 66 %

### Mr.5 — Sniper, Equilibre

| Niv 1 | Niv 2 | Niv 3 |
|---|---|---|
| 592 PV / 66 ATK | 676 PV / 75 ATK | **761 PV / 85 ATK** |

**Nez-Palm Cannon** — Dégâts **×2.2** + **poison** 2 tours (15 % de l'Attack de base par tour).
Déclencheur : aléatoire, garanti au plus tard **tour 8**. · Coût du kit : +6 % · **Winrate global : 78 %** · dans sa rareté : 58 %

### Smoker — Logia, Equilibre

| Niv 1 | Niv 2 | Niv 3 |
|---|---|---|
| 601 PV / 67 ATK | 686 PV / 76 ATK | **772 PV / 86 ATK** |

**Clone de Fumée** — Dégâts **×1.8** + **−20 % Attack** adverse pendant 2 tours.
Déclencheur : aléatoire, garanti au plus tard **tour 8**. · Coût du kit : +5 % · **Winrate global : 73 %** · dans sa rareté : 43 %

### Pell — Zoan, Equilibre

| Niv 1 | Niv 2 | Niv 3 |
|---|---|---|
| 582 PV / 65 ATK | 665 PV / 74 ATK | **748 PV / 83 ATK** |

**Envol du Faucon** — Transformation : **+35 % Attack et +10 % d'esquive**, reste du combat.
Déclencheur : passe sous **60 % de ses PV**. · Coût du kit : +8 % · **Winrate global : 65 %** · dans sa rareté : 25 %


## 🟣 ÉPIQUE

### Crocodile — Logia, Equilibre 👑

| Niv 1 | Niv 2 | Niv 3 |
|---|---|---|
| 701 PV / 78 ATK | 765 PV / 85 ATK | **829 PV / 92 ATK** |

**Tornade de Sable** — Dégâts **×2.5** + **bloque la régénération** adverse pendant 2 tours.
Déclencheur : aléatoire, garanti au plus tard **tour 8**. · Coût du kit : +6 % · **Winrate global : 89 %**

---

## Ce qui a changé depuis le brief de juillet

| Perso / règle | Avant | Après | Pourquoi |
|---|---|---|---|
| **Passif Sniper** | agit en premier tour 1 | **tir d'ouverture** | l'ancien valait **0 %** (classe à 27,7 %) |
| **Crit Sabreur** | 20 % | **30 %** | à 20 % le Sabreur était la pire classe |
| **Régén Zoan** | « une partie des PV » | **1,2 %/tour** | chiffré ; à 1,3 % la classe explose à 60 % |
| **Triangle** | ×1.5 | **×1.1** | à ×1.5, contrer = auto-win 100/0 |
| **Duo Sniper ⇄ Sabreur** | ×1.5 mutuel | **supprimé** | s'annulait, et offrait 11 pts au hasard |
| **Plafond Épique** | 200 | **195** (base 165) | à 200, 57 % des combats étaient des écrasements |
| **Pell** | +25 % esquive / +10 % ATK | **+35 % ATK / +10 % esquive** | son esquive était annulée par les Haki qu'il contre |
| **Dalton** | +35 % PV max | **+26 % de résistance** | même puissance, et la barre de vie ne bouge plus |
| **Chopper** | +25 % PV max | **+20 % de résistance** | idem |
| **Crocodile** | ×1.8 | **×2.5** | nerf annulé : un spécial de dégâts vaut +2,5 pts de winrate |
| **Mr.5** | ×1.5 | **×2.2** | idem |
| **Smoker** | ×1.3 | **×1.8** | idem |

### Conversion PV → résistance, si tu en refais un jour
> **résistance = 1 − 1 / (1 + gain de PV)**
> +25 % PV = **20 %** · +35 % PV = **26 %** · +50 % PV = **33 %**
> ⚠️ Ne recopie **jamais** le chiffre tel quel : « 35 % de résistance » est bien plus fort que « +35 % de PV ».

---

## ⚠️ Les deux résidus connus

**Pell est à 25 % dans sa rareté.** Il est Zoan, et le tier Rare contient Mr.1 (Sabreur, crit 30 %) et Mr.5 (Sniper, tir d'ouverture) — les deux meilleurs passifs du jeu. Mesuré : **un Zoan totalement vierge à budget plein perd aussi contre eux (27 %)**. Ce n'est pas Pell, c'est sa position dans le tier. À revoir quand la vague 2 rééquilibrera la compo.

**Arlong est sous-facturé d'environ 9 points.** Son Squalo Crunch (×2.2 + vol de vie) vaut ~22 % de budget, il est facturé 13 %. C'est ce qui le met à 84 % — 2e du jeu, juste derrière Crocodile. Décision assumée : il reste le contre naturel du boss.

---

## Note pour Claude Code

- **Types de compétence** (colonne `competence_type`) : `buff`, `dmg`, `transfo`. Les variantes sont dans les autres colonnes du CSV.
- **La résistance est une nouvelle mécanique** : `dégâts_subis × (1 − résistance)`. Valeur par défaut **0** → rétrocompatible.
- Chaque compétence s'active **1 seule fois par combat**.
- Tout ce fichier va en table `characters` ou en `config`. **Rien en dur.**
