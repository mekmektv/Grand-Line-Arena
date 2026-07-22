"""ONE PIECE ARENA — générateur d'équilibrage v6 (FINAL).
Tout est en config. Ajouter un perso = ajouter une ligne dans ROSTER + SPECIAUX, relancer.
"""
import random, json, csv, itertools
from collections import defaultdict

# ------------------------------------------------ CONFIG (table `config`)
CONFIG = dict(
    hp_scale=9.0, esquive_base=0.10, esquive_logia=0.10,
    crit_sabreur=0.30, crit_mult=1.5, zoan_regen=0.012,
    sniper_ouverture=True, counter_mult=1.1, max_tours=200,
)
BUDGET = {"Commun":[100,120,140], "Peu commun":[120,140,160],
          "Rare":[140,160,180], "Epique":[165,180,195]}
PROFIL = {"Bourrin":0.40, "Equilibre":0.50, "Tank":0.60}
COUNTRE = {"Haki":{"Logia","Paramecia"}, "Logia":{"Zoan"}, "Paramecia":{"Zoan"},
           "Zoan":{"Haki"}, "Sniper":set(), "Sabreur":set()}   # duo Sniper/Sabreur supprimé
TAUX_DROP = {"Commun":0.70, "Peu commun":0.22, "Rare":0.075, "Epique":0.005}

ROSTER = {
 "Kuroobi":("Haki","Commun","Bourrin"), "Baggy":("Paramecia","Commun","Equilibre"),
 "Dalton":("Zoan","Commun","Tank"), "Octi":("Sabreur","Commun","Equilibre"),
 "Smack":("Sniper","Commun","Equilibre"), "Sanji":("Haki","Peu commun","Equilibre"),
 "Luffy":("Paramecia","Peu commun","Bourrin"), "Chopper":("Zoan","Peu commun","Tank"),
 "Zoro":("Sabreur","Peu commun","Bourrin"), "Usopp":("Sniper","Peu commun","Equilibre"),
 "Arlong":("Haki","Rare","Bourrin"), "Smoker":("Logia","Rare","Equilibre"),
 "Pell":("Zoan","Rare","Equilibre"), "Mr.1":("Sabreur","Rare","Bourrin"),
 "Mr.5":("Sniper","Rare","Equilibre"), "Crocodile":("Logia","Epique","Equilibre"),
}
SPECIAUX = {
 "Kuroobi":  dict(nom="Karaté des Hommes-Poissons", kind="buff", atk=0.30, trig=("rand",3)),
 "Baggy":    dict(nom="Fragment Tornade", kind="dmg", mult=1.6, trig=("rand",8)),
 "Dalton":   dict(nom="Forme Bison", kind="transfo", resist=0.26, atk=0.35, trig=("hp",0.60)),
 "Octi":     dict(nom="Frappe des 8 Lames", kind="dmg", mult=1.6, trig=("rand",8)),
 "Smack":    dict(nom="Bulle d'Eau", kind="dmg", mult=1.3, trig=("rand",8)),
 "Sanji":    dict(nom="Lame Noire", kind="dmg", mult=1.8, trig=("rand",8)),
 "Luffy":    dict(nom="Sang Bouillonnant", kind="buff", atk=0.35, trig=("rand",3)),
 "Chopper":  dict(nom="Heavy Point", kind="transfo", resist=0.20, atk=0.25, trig=("hp",0.60)),
 "Zoro":     dict(nom="Phénix des 36 Désirs Terrestres", kind="dmg", mult=1.8, crit_garanti=True, trig=("rand",8)),
 "Usopp":    dict(nom="Marteau d'Usopp", kind="dmg", mult=1.4, debuff_esq=0.15, debuff_tours=2, trig=("rand",8)),
 "Arlong":   dict(nom="Squalo Crunch", kind="dmg", mult=2.2, vol_de_vie=0.20, trig=("hp",0.50)),
 "Smoker":   dict(nom="Clone de Fumée", kind="dmg", mult=1.8, debuff_atk=0.20, debuff_tours=2, trig=("rand",8)),
 "Pell":     dict(nom="Envol du Faucon", kind="transfo", atk=0.35, esquive=0.10, trig=("hp",0.60)),
 "Mr.1":     dict(nom="Tornade d'Acier", kind="dmg", mult=2.2, crit_garanti=True, trig=("rand",8)),
 "Mr.5":     dict(nom="Nez-Palm Cannon", kind="dmg", mult=2.2, poison=0.15, poison_tours=2, trig=("rand",8)),
 "Crocodile":dict(nom="Tornade de Sable", kind="dmg", mult=2.5, bloque_regen=2, trig=("rand",8)),
}

# ------------------------------------------------ FORMULE
def stats(budget, h):
    hp_u = (budget/2)*((h/(1-h))**0.5)
    return hp_u*CONFIG["hp_scale"], (budget/2)*(((1-h)/h)**0.5)

def stats_perso(nom, niveau, cout):
    cls, rar, prof = ROSTER[nom]
    return stats(BUDGET[rar][niveau-1]/(1+cout), PROFIL[prof])

# ------------------------------------------------ COMBAT
class Perso:
    def __init__(s, nom, cls, hp, atk, spe):
        s.nom, s.cls = nom, cls
        s.hpmax = s.hp = float(hp); s.atk = s.atk_base = float(atk)
        s.spe, s.used = spe, spe is None
        s.esq = CONFIG["esquive_base"] + (CONFIG["esquive_logia"] if cls in ("Logia","Paramecia") else 0)
        s.crit = CONFIG["crit_sabreur"] if cls == "Sabreur" else 0.0
        s.resist = 0.0
        s.mal_atk = s.mal_esq = s.no_regen = s.dot = s.dot_t = 0

def frappe(a, d, m, rng):
    if a.cls != "Haki" and rng.random() < max(0.0, d.esq - d.mal_esq): return 0.0
    x = a.atk*(1-a.mal_atk)*m*(CONFIG["counter_mult"] if d.cls in COUNTRE[a.cls] else 1.0)*(1-d.resist)
    d.hp -= x
    return x

def agir(a, d, tour, rng):
    use = False
    if not a.used:
        t = a.spe["trig"]
        use = (tour >= t[1] or rng.random() < 1.0/(t[1]-tour+1)) if t[0]=="rand" else a.hp <= a.hpmax*t[1]
    if not use:
        frappe(a, d, CONFIG["crit_mult"] if (a.crit and rng.random() < a.crit) else 1.0, rng); return
    a.used = True; sp = a.spe
    if sp["kind"] == "buff": a.atk *= (1+sp["atk"]); return
    if sp["kind"] == "transfo":
        a.resist = max(a.resist, sp.get("resist", 0.0))
        a.atk *= (1+sp.get("atk", 0.0)); a.esq += sp.get("esquive", 0.0); return
    x = frappe(a, d, sp["mult"]*(CONFIG["crit_mult"] if sp.get("crit_garanti") else 1.0), rng)
    if x <= 0: return
    if "vol_de_vie" in sp: a.hp = min(a.hpmax, a.hp + x*sp["vol_de_vie"])
    if "debuff_atk" in sp: d.mal_atk = sp["debuff_atk"]; d._t1 = sp["debuff_tours"]
    if "debuff_esq" in sp: d.mal_esq = sp["debuff_esq"]; d._t2 = sp["debuff_tours"]
    if "bloque_regen" in sp: d.no_regen = sp["bloque_regen"]
    if "poison" in sp: d.dot = a.atk_base*sp["poison"]; d.dot_t = sp["poison_tours"]

def combat(mk1, mk2, rng):
    a, b = mk1(), mk2()
    if CONFIG["sniper_ouverture"]:
        for x, y in ((a,b),(b,a)):
            if x.cls == "Sniper" and y.cls != "Sniper": frappe(x, y, 1.0, rng)
    for tour in range(1, CONFIG["max_tours"]+1):
        for x in ([a,b] if rng.random()<0.5 else [b,a]):
            y = b if x is a else a
            if x.hp > 0 and y.hp > 0: agir(x, y, tour, rng)
        for x in (a,b):
            if x.hp <= 0: continue
            if x.cls == "Zoan" and x.no_regen <= 0: x.hp = min(x.hpmax, x.hp + x.hpmax*CONFIG["zoan_regen"])
            if x.no_regen > 0: x.no_regen -= 1
            if x.dot_t > 0: x.hp -= x.dot; x.dot_t -= 1
            if x.mal_atk:
                x._t1 -= 1
                if x._t1 <= 0: x.mal_atk = 0
            if x.mal_esq:
                x._t2 -= 1
                if x._t2 <= 0: x.mal_esq = 0
        if a.hp <= 0 or b.hp <= 0:
            if a.hp <= 0 and b.hp <= 0: return rng.random() < 0.5, tour
            return b.hp <= 0, tour
    return None, CONFIG["max_tours"]

# ------------------------------------------------ PRIX DU KIT (méthode du panel)
PANEL = ["Haki"]*3+["Logia"]*2+["Paramecia"]*2+["Zoan"]*3+["Sniper"]*3+["Sabreur"]*3

def wr_panel(cls, budget, h, spe, rar, N=700, seed=101):
    hp, atk = stats(budget, h); mhp, matk = stats(BUDGET[rar][2], 0.5)
    rng = random.Random(seed); tot = 0
    for c in PANEL:
        w = 0
        for _ in range(N):
            r, _t = combat(lambda: Perso("X", cls, hp, atk, dict(spe) if spe else None),
                           lambda: Perso("M", c, mhp, matk, None), rng)
            w += r
        tot += w/N
    return tot/len(PANEL)

def cout_du_kit(nom, N=700):
    cls, rar, prof = ROSTER[nom]; h = PROFIL[prof]; b = BUDGET[rar][2]
    ref = wr_panel(cls, b, h, None, rar, N)
    lo, hi = -0.35, 1.20
    for _ in range(14):
        mid = (lo+hi)/2
        if wr_panel(cls, b/(1+mid), h, SPECIAUX[nom], rar, N) > ref: lo = mid
        else: hi = mid
    return round((lo+hi)/2, 3)

def tournoi(couts, N=2000, seed=23):
    rng = random.Random(seed)
    win, jou, tw, tg = defaultdict(int), defaultdict(int), defaultdict(int), defaultdict(int)
    S = {n: stats_perso(n, 3, couts[n]) for n in ROSTER}; tours = []
    for n1, n2 in itertools.combinations(ROSTER, 2):
        for _ in range(N):
            w, t = combat(lambda: Perso(n1, ROSTER[n1][0], *S[n1], dict(SPECIAUX[n1])),
                          lambda: Perso(n2, ROSTER[n2][0], *S[n2], dict(SPECIAUX[n2])), rng)
            tours.append(t); jou[n1] += 1; jou[n2] += 1
            g = n1 if w else n2; win[g] += 1
            if ROSTER[n1][1] == ROSTER[n2][1]:
                tg[n1] += 1; tg[n2] += 1; tw[g] += 1
    return win, jou, tw, tg, sum(tours)/len(tours)

if __name__ == "__main__":
    couts = {n: cout_du_kit(n) for n in ROSTER}
    json.dump(couts, open("couts_v6.json","w"))
    win, jou, tw, tg, avg = tournoi(couts)
    ordre = {"Commun":0,"Peu commun":1,"Rare":2,"Epique":3}
    ESQ = lambda c: 20 if c in ("Logia","Paramecia") else 10
    rows = []
    print(f"=== v6 FINAL — {avg:.1f} tours ===\n")
    print(f"{'Perso':<11}{'Classe':<11}{'Rareté':<12}{'Kit':>5}{'Niv1':>11}{'Niv2':>11}{'Niv3':>11}{'tier':>7}{'global':>8}")
    for n in sorted(ROSTER, key=lambda x:(ordre[ROSTER[x][1]], -win[x]/jou[x])):
        cls, rar, prof = ROSTER[n]
        st = {lv: stats_perso(n, lv, couts[n]) for lv in (1,2,3)}
        it = f"{100*tw[n]/tg[n]:.0f}%" if tg[n] else "seul"
        print(f"{n:<11}{cls:<11}{rar:<12}{couts[n]:+5.0%}"
              + "".join(f"{round(st[lv][0])}/{round(st[lv][1]):<3}".rjust(11) for lv in (1,2,3))
              + f"{it:>7}{100*win[n]/jou[n]:7.0f}%")
        sp = SPECIAUX[n]
        rows.append(dict(nom=n, classe=cls, rarete=rar, profil=prof, cout_kit_pct=round(couts[n]*100,1),
            pv_niv1=round(st[1][0]), attack_niv1=round(st[1][1]), pv_niv2=round(st[2][0]), attack_niv2=round(st[2][1]),
            pv_niv3=round(st[3][0]), attack_niv3=round(st[3][1]), esquive_pct=ESQ(cls),
            crit_pct=30 if cls=="Sabreur" else 0, competence_nom=sp["nom"], competence_type=sp["kind"],
            competence_declencheur=(f"tour<={sp['trig'][1]}" if sp["trig"][0]=="rand" else f"pv<={int(sp['trig'][1]*100)}%"),
            winrate_global_pct=round(100*win[n]/jou[n]), winrate_tier_pct=round(100*tw[n]/tg[n]) if tg[n] else ""))
    print()
    for r in ordre:
        g = [n for n in ROSTER if ROSTER[n][1]==r]
        print(f"  {r:<12}{100*sum(win[n]/jou[n] for n in g)/len(g):.0f}%")
    with open("/mnt/user-data/outputs/equilibrage/persos.csv","w",newline="",encoding="utf-8") as f:
        w_ = csv.DictWriter(f, fieldnames=list(rows[0].keys())); w_.writeheader(); w_.writerows(rows)
