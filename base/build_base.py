# APERATION – általános alapváltozat (bármelyik forgatási naphoz).
# Futtatás: python3 base/build_base.py
#   -> base/app.html                 (Artifact-változat, a mintával; a sablon mellé publikálva)
#   -> base/Forgatasi_sablon.xlsx    (az apphoz legjobban illő Excel-sablon, kitöltött mintával)
#   -> docs/base/                    (offline PWA a GitHub Pages-re: index.html, sw.js, xlsx-olvasó helyben, betűk, ikonok, sablon)
import datetime, hashlib, json, os, re, shutil, subprocess
from openpyxl import Workbook
from openpyxl.formatting.rule import FormulaRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.worksheet.datavalidation import DataValidation
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PAGES = os.path.join(ROOT, "docs", "base")
XLSX_CDN = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"
MINTA = json.load(open(os.path.join(HERE, "minta.json"), encoding="utf-8"))

# ---------- 1) app.html ----------
tpl = open(os.path.join(HERE, "app_template.html"), encoding="utf-8").read()
tpl = tpl.replace("/*__EDITOR_CSS__*/", open(os.path.join(HERE, "editor.css"), encoding="utf-8").read())
# üveg-fénytörés térképe (PNG; Chromium csak ezt fogadja el backdrop-filterben): a peremen befelé húz, középen semleges
def lgmap(W=256, e=0.16):
    import base64, io
    from PIL import ImageFilter
    f = lambda t: (1 - t / e) ** 2 if t < e else (-((t - (1 - e)) / e) ** 2 if t > 1 - e else 0)
    im = Image.new("RGB", (W, W))
    px = im.load()
    for y in range(W):
        for x in range(W):
            px[x, y] = (int(128 + 127 * f(x / (W - 1))), int(128 + 127 * f(y / (W - 1))), 128)
    b = io.BytesIO(); im.filter(ImageFilter.GaussianBlur(2)).save(b, "PNG")
    return "data:image/png;base64," + base64.b64encode(b.getvalue()).decode()
tpl = tpl.replace("__LGMAP__", lgmap())
LOGO_SVG = open(os.path.join(HERE, "brand", "aperation-logo.svg"), encoding="utf-8").read().strip()
tpl = tpl.replace("/*__LOGO__*/null", json.dumps(LOGO_SVG, ensure_ascii=False))
tpl = tpl.replace("/*__GLASS_CSS__*/", open(os.path.join(HERE, "glass.css"), encoding="utf-8").read())
tpl = tpl.replace("/*__DESKTOP_CSS__*/", open(os.path.join(HERE, "desktop.css"), encoding="utf-8").read())
tpl = tpl.replace("/*__MULTI_CSS__*/", open(os.path.join(HERE, "multi.css"), encoding="utf-8").read())
tpl = tpl.replace("/*__GATE_JS__*/", open(os.path.join(HERE, "gate.js"), encoding="utf-8").read())
PRINT_CSS = open(os.path.join(HERE, "print.css"), encoding="utf-8").read()
tpl = tpl.replace("/*__PRINT_CSS_STYLE__*/", PRINT_CSS)
tpl = tpl.replace("/*__EDITOR_JS__*/", "\n".join(open(os.path.join(HERE, f), encoding="utf-8").read() for f in ("multi.js", "editor.js", "print.js")))
tpl = tpl.replace('const PRINT_CSS=/*__PRINT_CSS__*/"";', "const PRINT_CSS=" + json.dumps(PRINT_CSS, ensure_ascii=False) + ";")
tpl = tpl.replace("const MINTA=/*__MINTA__*/null;", "const MINTA=" + json.dumps(MINTA, ensure_ascii=False) + ";")
assert "/*__" not in tpl.replace("/*__XLSX__*/", "").replace("/*__FBCFG__*/", "").replace("/*__FBSRC__*/", "").replace("/*__GATE__*/", "")
open(os.path.join(HERE, "app.html"), "w", encoding="utf-8").write(tpl)
print("kész: base/app.html")

# ---------- 2) Excel-sablon ----------
TN = {"prep": "Előkészület", "pres": "Prezentálás", "shoot": "Forgatás", "move": "Átállás", "lunch": "Ebéd", "res": "Tartalék"}
ST = {"sh": "Jelenet", "ac": "Akció", "ch": "Szereplő", "pa": "Instrukció", "dl": "Dialógus", "end": "Vége"}
thin = Side(style="thin", color="C9CED6")
BOX = Border(left=thin, right=thin, top=thin, bottom=thin)
F = lambda c: PatternFill("solid", fgColor=c)
HEAD, INPUT, CALC = F("1F2630"), F("FFFDF3"), F("EEF1F5")
WRAP = Alignment(wrap_text=True, vertical="top")
tm = lambda m: datetime.time(int(m) // 60 % 24, int(m) % 60)
def hmt(s):
    m = re.match(r"(\d{1,2}):(\d{2})", s or "")
    return datetime.time(int(m.group(1)), int(m.group(2))) if m else (s or None)

def header(ws, cols, row=1):
    for i, (name, width) in enumerate(cols, 1):
        c = ws.cell(row=row, column=i, value=name)
        c.font = Font(bold=True, color="FFFFFF"); c.fill = HEAD; c.border = BOX
        c.alignment = Alignment(vertical="center", wrap_text=True)
        ws.column_dimensions[c.column_letter].width = width
    ws.row_dimensions[row].height = 30
    ws.freeze_panes = ws.cell(row=row + 1, column=1)

def body(ws, r1, r2, ncol, calc=()):
    for r in range(r1, r2 + 1):
        for c in range(1, ncol + 1):
            x = ws.cell(row=r, column=c); x.border = BOX; x.alignment = WRAP
            x.fill = CALC if c in calc else INPUT

wb = Workbook()
# Útmutató
ws = wb.active; ws.title = "Útmutató"
ws.column_dimensions["A"].width = 110
lines = [
    ("Forgatási sablon az APERATION™-hoz", Font(bold=True, size=16)),
    ("© 2026 Tóth Tamás János · APERATION™. Minden jog fenntartva.", Font(italic=True, color="777777")),
    ("Töltsd ki a lapokat, mentsd el .xlsx-ként, és az appban: Terv → Fájl → Excel-táblázat betöltése (vagy húzd rá a fájlt).", None),
    ("A sárgás cellákba írsz, a szürkéket a táblázat számolja. A lapok és a fejlécek nevét ne írd át; sort nyugodtan szúrhatsz be vagy törölhetsz.", None),
    ("A kitöltött sorok csak minta (MINTA · Az utolsó busz): írd felül vagy töröld őket.", Font(italic=True, color="7A5B00")),
    ("", None),
    ("Projekt", Font(bold=True, size=12)),
    ("Cím, dátum, crew call, wrap-határ (eddig kell végezni), helyszín, parkolás. A „Fontos” sorokból annyi lehet, amennyi kell; a BIZTONSÁG kezdetű piros lesz az appban.", None),
    ("Időrend", Font(bold=True, size=12)),
    ("Egy sor = egy blokk, abban a sorrendben, ahogy a nap megy. Csak a Percet, a Típust és a Blokk / shot nevét kell beírni: a Kezdés és a Vége magától számolódik a crew callból, akármilyen sorrendbe rakod a sorokat.", None),
    ("Áthelyezés: jelöld ki a sor számát, és húzd a helyére. Excelben gépen: kijelölés szélét megfogva Shift-tel húzd. Google Táblázatokban: a sorszámot húzd. Telefonon: Kivágás, majd a célsornál Kivágott cellák beszúrása.", None),
    ("Új blokk: húzz fel egy üres sort a lista aljáról oda, ahová kell (abban már benne vannak a képletek). Törlés: a sor tartalmát töröld, vagy a sort.", None),
    ("A lap tetején látod a számolt véget és hogy mennyi a tartalék vagy a túllépés. Sárga: két átállás egymás után (nem hiba, csak nézd át). Piros idő: a blokk a wrap-határ után ér véget.", None),
    ("Típus: Előkészület, Prezentálás, Forgatás, Átállás, Ebéd, Tartalék (legördülő lista).", None),
    ("Blokk / shot: forgatásnál a shot száma (pl. 1/1, vagy több: 2/1A + 2/1B). Erre hivatkozik a Forgatókönyv lap Shotok oszlopa.", None),
    ("Fény: a Fények lap kódja (pl. A). Az app ebből tudja, mikor változik a fény.", None),
    ("Szereplők: vesszővel (pl. Anna, Bence), ugyanúgy írva, mint a Szereplők lap Szerep oszlopában. Kellékek: cellán belül soronként (Alt+Enter).", None),
    ("Kihagyható: „igen”, ha csúszásnál ezt lehet elhagyni; az app késésnél felajánlja.", None),
    ("Storyboard kép / Vilkó kép: nyilvános kép-link (https://…). Képet a telefonról az appban is hozzáadhatsz (Terv → Időrend → blokk → Képek).", None),
    ("Szereplők, Stáb", Font(bold=True, size=12)),
    ("Időpontok óra:perc formában (8:30). A Stáb lapon a részleg minden sorba írható; a telefonszám az appban hívható.", None),
    ("Fények", Font(bold=True, size=12)),
    ("Kód (rövid, pl. A, K1, E), név és leírás: lámpák, szűrők, mi változik. Kép (URL): a fényterv / vilkó nyilvános linkje; telefonról az appban is feltölthető (Terv → Projekt → Fénybeállítások).", None),
    ("Forgatókönyv", Font(bold=True, size=12)),
    ("Soronként: Típus (Jelenet, Akció, Szereplő, Instrukció, Dialógus, Vége), Szöveg, és Shotok: melyik shot veszi ezt a sort (pl. 1/1, 1/3).", None),
    ("A forgatókönyvet az appba szövegként is bemásolhatod (Terv → Forgatókönyv), ott magától szétszedi.", None),
    ("", None),
    ("Más táblázat is működik: az app a fejlécsorok alapján keresi a Perc/Kezdés, Típus, Blokk / shot oszlopokat, és a Színész, Pozíció + Név, Kód, Szöveg + Típus táblázatokat.", Font(color="555555")),
]
for i, (t, f) in enumerate(lines, 1):
    c = ws.cell(row=i, column=1, value=t); c.alignment = Alignment(wrap_text=True, vertical="top")
    if f: c.font = f

# Projekt
ws = wb.create_sheet("Projekt")
header(ws, [("Mező", 20), ("Érték", 70)])
rows = [("Cím", MINTA["title"]), ("Dátum", None), ("Crew call", tm(MINTA["call"])), ("Tervezett wrap", tm(MINTA["wrapTarget"])),
        ("Helyszín", MINTA["location"]), ("Parkolás", MINTA["parking"])] + [("Fontos", n) for n in MINTA["notes"]] + [("Fontos", None)] * 3
for i, (k, v) in enumerate(rows, 2):
    ws.cell(row=i, column=1, value=k).font = Font(bold=True)
    ws.cell(row=i, column=2, value=v)
body(ws, 2, len(rows) + 1, 2, calc=(1,))
ws["B3"].number_format = "yyyy.mm.dd."
ws["B4"].number_format = ws["B5"].number_format = "h:mm"
last = len(rows) + 3
ws.cell(row=last, column=1, value="Számolt vége").font = Font(bold=True, color="555555")
ws.cell(row=last, column=2, value="=B4+SUM(Időrend!C4:C200)/1440").number_format = "h:mm"
ws.cell(row=last + 1, column=1, value="Túllépés (perc)").font = Font(bold=True, color="555555")
ws.cell(row=last + 1, column=2, value=f'=IF(B5="","",MAX(0,ROUND((B{last}-B5)*1440,0)))')
for r in (last, last + 1):
    for c in (1, 2):
        ws.cell(row=r, column=c).fill = CALC; ws.cell(row=r, column=c).border = BOX
ws.conditional_formatting.add(f"B{last + 1}", FormulaRule(formula=[f'AND(ISNUMBER(B{last + 1}),B{last + 1}>0)'], fill=F("FFD7DB"), font=Font(bold=True, color="B00020")))

# Időrend – úgy működik, mint az appban: a sorok szabadon húzhatók, a Kezdés/Vége képlete nem függ a sor helyétől
# (a fölötte lévő percek összege: SUM(C$3:INDEX(C:C,ROW()-1))), a tetején összesítő, sárga jel két egymás utáni átállásnál.
ws = wb.create_sheet("Időrend")
cols = [("Kezdés", 8), ("Vége", 8), ("Perc", 7), ("Típus", 13), ("Blokk / shot", 16), ("Beállítás", 26), ("Megjegyzés", 34), ("Fény", 7),
        ("Szereplők", 16), ("Kellékek", 28), ("Sztori", 30), ("Kihagyható", 11), ("Storyboard kép (URL)", 24), ("Vilkó kép (URL)", 24)]
HR, R0, N = 3, 4, 120                      # fejlécsor, első adatsor, előre kitöltött sorok
RL = R0 + N - 1
header(ws, cols, row=HR)
for c in range(1, 15):                     # az összesítő sorok szélessége ne zavarjon
    ws.cell(row=1, column=c).fill = PatternFill(fill_type=None)
summ = [("A1", "Crew call", "B1", "=Projekt!$B$4"), ("C1", "Vége", "D1", f"=Projekt!$B$4+SUM(C{R0}:C{RL})/1440"),
        ("E1", "Wrap-határ", "F1", '=IF(Projekt!$B$5="","",Projekt!$B$5)')]
for lc, lab, vc, f in summ:
    ws[lc] = lab; ws[lc].font = Font(bold=True, color="555555"); ws[lc].alignment = Alignment(horizontal="right")
    ws[vc] = f; ws[vc].number_format = "h:mm"; ws[vc].font = Font(bold=True, size=13)
ws["G1"] = '=IF(F1="","",IF(D1>F1,"⚠ "&ROUND((D1-F1)*1440,0)&" perc túllépés",ROUND((F1-D1)*1440,0)&" perc tartalék"))'
ws["G1"].font = Font(bold=True, size=12)
ws["A2"] = "Sort áthelyezni: jelöld ki a sor számát, és húzd a helyére (Excelben Shift-tel). Új blokk: húzz fel egy üres sort a lista aljáról. Az idők maguktól számolódnak."
ws["A2"].font = Font(italic=True, color="777777", size=9)
ws.conditional_formatting.add("G1", FormulaRule(formula=['LEFT($G$1,1)="⚠"'], font=Font(bold=True, color="B00020")))
ws.conditional_formatting.add("G1", FormulaRule(formula=['AND($G$1<>"",LEFT($G$1,1)<>"⚠")'], font=Font(bold=True, color="1E7F4F")))
for i, b in enumerate(MINTA["blocks"], R0):
    vals = [None, None, b["d"], TN[b["type"]], b.get("label", ""), b.get("setup", ""), b.get("note", ""), b.get("group", ""),
            b.get("talent", ""), b.get("props", ""), b.get("story", ""), "igen" if b.get("skippable") else "", "", ""]
    for c, v in enumerate(vals, 1):
        if v not in (None, ""):
            ws.cell(row=i, column=c, value=v)
for r in range(R0, RL + 1):
    ws.cell(row=r, column=1, value=f'=IF(AND(C{r}="",E{r}=""),"",Projekt!$B$4+SUM(C${HR}:INDEX(C:C,ROW()-1))/1440)').number_format = "h:mm"
    ws.cell(row=r, column=2, value=f'=IF(A{r}="","",A{r}+C{r}/1440)').number_format = "h:mm"
body(ws, R0, RL, len(cols), calc=(1, 2))
ws.freeze_panes = ws.cell(row=R0, column=1)
dv = DataValidation(type="list", formula1='"Előkészület,Prezentálás,Forgatás,Átállás,Ebéd,Tartalék"', allow_blank=True)
dv.error = "Válassz a listából."; ws.add_data_validation(dv); dv.add(f"D{R0}:D{RL}")
dv2 = DataValidation(type="list", formula1='"igen,nem"', allow_blank=True); ws.add_data_validation(dv2); dv2.add(f"L{R0}:L{RL}")
dv3 = DataValidation(type="whole", operator="between", formula1="0", formula2="600", allow_blank=True)
dv3.error = "A Perc egész szám (0–600)."; ws.add_data_validation(dv3); dv3.add(f"C{R0}:C{RL}")
rng = f"A{R0}:N{RL}"
# figyelmeztetések (nem tiltanak): két egymás utáni átállás sárga, a wrap-határ után végződő blokk ideje piros
ws.conditional_formatting.add(rng, FormulaRule(formula=[f'AND($D{R0}="Átállás",OR($D{R0 - 1}="Átállás",$D{R0 + 1}="Átállás"))'], fill=F("FFE9A8"), stopIfTrue=True))
ws.conditional_formatting.add(f"A{R0}:B{RL}", FormulaRule(formula=[f'AND(ISNUMBER($B{R0}),ISNUMBER($F$1),$B{R0}>$F$1)'], font=Font(bold=True, color="B00020")))
for t, col in (("Forgatás", "D9F4F7"), ("Átállás", "E6EAFF"), ("Ebéd", "F1E6FF")):
    ws.conditional_formatting.add(rng, FormulaRule(formula=[f'$D{R0}="{t}"'], fill=F(col)))
ws.conditional_formatting.add(f"E{R0}:E{RL}", FormulaRule(formula=[f'$D{R0}="Forgatás"'], font=Font(bold=True)))

# Szereplők, Stáb, Fények, Forgatókönyv
def table(name, cols, data, n=40, valid=None):
    ws = wb.create_sheet(name); header(ws, cols)
    for i, row in enumerate(data, 2):
        for c, v in enumerate(row, 1):
            if v not in (None, ""):
                ws.cell(row=i, column=c, value=v)
    body(ws, 2, max(n, len(data)) + 1, len(cols))
    if valid:
        col, lst = valid
        dv = DataValidation(type="list", formula1=f'"{lst}"', allow_blank=True); ws.add_data_validation(dv); dv.add(f"{col}2:{col}{max(n, len(data)) + 1}")
    return ws
ws = table("Szereplők", [("Szerep", 14), ("Színész", 22), ("Érkezés", 9), ("Ruha", 9), ("Smink", 9), ("Haj", 9), ("Setre", 9), ("Telefon", 16)],
           [(c["role"], c["name"], hmt(c["arr"]), hmt(c["ruha"]), hmt(c["smink"]), hmt(c["haj"]), hmt(c["onset"]), c["phone"]) for c in MINTA["cast"]], 20)
for r in ws.iter_rows(min_row=2, min_col=3, max_col=7):
    for c in r: c.number_format = "h:mm"
ws = table("Stáb", [("Részleg", 20), ("Pozíció", 20), ("Név", 24), ("Érkezés", 9), ("Telefon", 16)],
           [(c["dept"], c["pos"], c["name"], hmt(c["arr"]), c["phone"]) for c in MINTA["crew"]], 60)
for r in ws.iter_rows(min_row=2, min_col=4, max_col=4):
    for c in r: c.number_format = "h:mm"
table("Fények", [("Kód", 8), ("Név", 26), ("Leírás", 70), ("Kép (URL)", 30)], [(g["code"], g["name"], g["desc"], "") for g in MINTA["groups"]], 20)
table("Forgatókönyv", [("Típus", 13), ("Szöveg", 80), ("Shotok", 16)], [(ST[l["t"]], l["x"], ", ".join(l["ids"])) for l in MINTA["script"]], 300,
      valid=("A", ",".join(ST.values())))
wb.properties.creator = "Tóth Tamás János"; wb.properties.title = "Forgatási sablon · APERATION"
wb.active = 1
SABLON = os.path.join(HERE, "Forgatasi_sablon.xlsx")
wb.save(SABLON)
print("kész: base/Forgatasi_sablon.xlsx")

# ---------- 3) GitHub Pages: docs/base/ ----------
shutil.rmtree(PAGES, ignore_errors=True)
os.makedirs(os.path.join(PAGES, "vendor")); os.makedirs(os.path.join(PAGES, "fonts"))
vend = os.path.join(HERE, ".cache", "xlsx.full.min.js")
if not os.path.exists(vend):
    os.makedirs(os.path.dirname(vend), exist_ok=True)
    subprocess.run(["curl", "-sSfL", "-o", vend, XLSX_CDN], check=True)
shutil.copy(vend, os.path.join(PAGES, "vendor", "xlsx.full.min.js"))
shutil.copy(SABLON, os.path.join(PAGES, "Forgatasi_sablon.xlsx"))
os.makedirs(os.path.join(PAGES, "brand"))
for f in ("aperation-logo.svg", "aperation-mark.svg", "aperation-icon.svg"):
    shutil.copy(os.path.join(HERE, "brand", f), os.path.join(PAGES, "brand", f))

src = tpl.replace('/*__XLSX__*/"' + XLSX_CDN + '"', '"vendor/xlsx.full.min.js"')
src = src.replace("const GATE=/*__GATE__*/false;", "const GATE=true;")   # telefonon csak főképernyőről indítva
# közös munka: Firebase SDK helyben (npm-ből), konfiguráció a base/firebase/config.json-ból (ha van)
FBV = "11.10.0"
fbfiles = ["firebase-app-compat.js", "firebase-auth-compat.js", "firebase-firestore-compat.js"]
fbcache = os.path.join(HERE, ".cache", "firebase-" + FBV)
if not all(os.path.exists(os.path.join(fbcache, f)) for f in fbfiles):
    os.makedirs(fbcache, exist_ok=True)
    subprocess.run(["npm", "pack", "--silent", f"firebase@{FBV}", "--pack-destination", fbcache], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    tgz = [f for f in os.listdir(fbcache) if f.endswith(".tgz")][0]
    subprocess.run(["tar", "-xzf", tgz] + [f"package/{f}" for f in fbfiles], cwd=fbcache, check=True)
    for f in fbfiles:
        shutil.move(os.path.join(fbcache, "package", f), os.path.join(fbcache, f))
for f in fbfiles:
    shutil.copy(os.path.join(fbcache, f), os.path.join(PAGES, "vendor", f))
cfgp = os.path.join(HERE, "firebase", "config.json")
fbcfg = json.load(open(cfgp)) if os.path.exists(cfgp) else None
src = src.replace("const FBCFG=/*__FBCFG__*/null;", "const FBCFG=" + json.dumps(fbcfg) + ";")
src = src.replace("const FB_SRC=/*__FBSRC__*/null;", "const FB_SRC=" + json.dumps(["vendor/" + f for f in fbfiles]) + ";")
print("közös munka:", "beállítva (" + fbcfg.get("projectId", "?") + ")" if fbcfg else "nincs config.json, csak emulátorral próbálható")
href = re.search(r'<link rel="stylesheet" href="(https://fonts\.googleapis\.com[^"]+)"', src).group(1).replace("&amp;", "&")
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
for _ in range(4):   # a Google Fonts néha hibás választ ad: újrapróbáljuk
    gcss = subprocess.check_output(["curl", "-sS", "-A", UA, href]).decode()
    if "@font-face" in gcss and "fonts.gstatic.com" in gcss:
        break
faces = []
for subset, ff in re.findall(r"/\*\s*([\w-]+)\s*\*/\s*(@font-face\s*{[^}]*})", gcss):
    if subset not in ("latin", "latin-ext"):
        continue
    url = re.search(r"url\((https://[^)]+)\)", ff).group(1)
    tail = url.split("/s/")[1] if "/s/" in url else hashlib.sha1(url.encode()).hexdigest()[:16]
    fn = re.sub(r"[^A-Za-z0-9]+", "-", tail.rsplit(".", 1)[0])[-60:] + ".woff2"
    if not os.path.exists(os.path.join(PAGES, "fonts", fn)):
        subprocess.run(["curl", "-sS", "-o", os.path.join(PAGES, "fonts", fn), url], check=True)
    faces.append(ff.replace(url, "fonts/" + fn))
src = re.sub(r'<link rel="preconnect"[^>]*>\n?', "", src)
src = re.sub(r'<link rel="stylesheet" href="https://fonts\.googleapis\.com[^>]*>\n?', "", src)
src = src.replace("<style>", "<style>\n" + "\n".join(faces) + "\n", 1)
src = re.sub(r'<meta name="claude:viewport-fit-sides"[^>]*>\n?', "", src)
src = re.sub(r"<title>.*?</title>\n", "", src, count=1)

# app-ikon: az APERATION rekeszjele a kapott logóból (brand/aperation-logo-source.png), #10141D négyzeten, torzítás nélkül
BRAND = os.path.join(HERE, "brand")
def icon(size):
    src = Image.open(os.path.join(BRAND, "aperation-logo-source.png")).convert("RGBA")
    mark = src.crop((540, 55, 820, 377))                      # csak a rekeszjel (a felirat nélkül)
    im = Image.new("RGBA", (size, size), (16, 20, 29, 255))
    k = size * 0.64 / max(mark.size)                          # biztonsági margó a maszkolt (kerek) ikonokhoz
    m = mark.resize((round(mark.width * k), round(mark.height * k)), Image.LANCZOS)
    im.alpha_composite(m, ((size - m.width) // 2, (size - m.height) // 2))
    return im.convert("RGB")
# a repó főcímére (docs/) is az APERATION ikonja kerül: a Safari ott a korábbi (Kapaszkodni) ikont tárolta el
DOCS = os.path.dirname(PAGES)
for s in (180, 192, 512):
    icon(s).save(os.path.join(DOCS, f"icon-{s}.png"))
icon(180).save(os.path.join(DOCS, "apple-touch-icon.png"))
icon(180).save(os.path.join(DOCS, "apple-touch-icon-precomposed.png"))
for s in (180, 192, 512):
    icon(s).save(os.path.join(PAGES, f"icon-{s}.png"))
json.dump({"name": "APERATION", "short_name": "APERATION", "start_url": "./", "scope": "./", "display": "standalone", "orientation": "any",
           "background_color": "#10141D", "theme_color": "#07090d", "lang": "hu",
           "icons": [{"src": "icon-192.png", "sizes": "192x192", "type": "image/png"},
                     {"src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable"}]},
          open(os.path.join(PAGES, "manifest.json"), "w"), ensure_ascii=False, indent=1)

head = """<!doctype html>
<html lang="hu"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>APERATION</title>
<meta name="theme-color" content="#07090d">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="APERATION">
<link rel="manifest" href="manifest.json">
<link rel="apple-touch-icon" href="icon-180.png?v=aperation">
<link rel="icon" href="brand/aperation-icon.svg?v=aperation" type="image/svg+xml">
<link rel="icon" href="icon-192.png?v=aperation" sizes="192x192">
<style>html{padding-top:env(safe-area-inset-top,0px)}[hidden]{display:none!important}img{max-width:100%}</style>
</head><body>
"""
tail = """
<script>
// Offline működés. Ha új változat érkezik, az oldal egyszer magától újratölt, hogy azonnal az új fusson.
if("serviceWorker" in navigator){
  const had=!!navigator.serviceWorker.controller;let done=false;
  navigator.serviceWorker.addEventListener("controllerchange",()=>{if(had&&!done){done=true;location.reload()}});
  navigator.serviceWorker.register("sw.js",{updateViaCache:"none"}).then(r=>r.update()).catch(()=>{});
}
</script>
</body></html>
"""
html = head + src + tail
open(os.path.join(PAGES, "index.html"), "w", encoding="utf-8").write(html)
files = sorted(os.path.relpath(os.path.join(r, f), PAGES).replace(os.sep, "/") for r, _, fs in os.walk(PAGES) for f in fs)
h = hashlib.sha1()
for f in files:
    h.update(f.encode()); h.update(open(os.path.join(PAGES, f), "rb").read())
core = ["./"] + [f for f in files if f != "index.html"]
open(os.path.join(PAGES, "sw.js"), "w").write(f"""const CACHE="diszpo-base-{h.hexdigest()[:10]}";
const CORE={json.dumps(core)};
self.addEventListener("install",e=>{{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()))}});
self.addEventListener("activate",e=>{{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith("diszpo-base-")&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))}});
self.addEventListener("fetch",e=>{{
  if(e.request.method!=="GET"||new URL(e.request.url).origin!==location.origin)return;
  e.respondWith((async()=>{{
    // az oldal és a manifest: előbb a hálózat (így a frissítés, pl. új név, azonnal megjön), net nélkül a mentett példány
    const u=new URL(e.request.url),fresh=e.request.mode==="navigate"||u.pathname.endsWith("/manifest.json");
    if(fresh){{try{{const r=await fetch(e.request.mode==="navigate"?e.request.url:e.request,{{cache:"no-cache"}});if(r.ok){{const c=await caches.open(CACHE);c.put(e.request.mode==="navigate"?"./":e.request,r.clone())}}return r}}
      catch(err){{return (await caches.match(e.request.mode==="navigate"?"./":e.request,{{ignoreSearch:true}}))||Response.error()}}}}
    const hit=await caches.match(e.request,{{ignoreSearch:true}});if(hit)return hit;
    try{{return await fetch(e.request)}}catch(err){{throw err}}
  }})());
}});
""")
print("kész: docs/base/ ·", len(files) + 1, "fájl")
