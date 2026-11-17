# A trace_logo.py kimenetéből (görbék) készíti a logó-változatokat. Új formát nem rajzol.
#   aperation-logo.svg  – teljes logó, világos, sötét (#10141D) felületre
#   aperation-mark.svg  – csak a rekeszjel, négyzetes, a középső pont kivágva (átlátszó)
#   aperation-icon.svg  – app-ikon: #10141D négyzet, középen a jel, a pont a háttér színével
import json, sys
J = json.load(open(sys.argv[1]))
cx, cy, r = J["dot"]
SYM, TXT, BG = "#F1F3F8", "#F4F6FA", "#10141D"
T = '<title>APERATION</title>'
H = 'xmlns="http://www.w3.org/2000/svg" role="img" aria-label="APERATION"'
# Az „APER” és „ATION” közé (az R és az A közé) DX egységnyi rés kerül; az eredeti képen a két betű összeért.
DX = 20
open("aperation-logo.svg", "w").write(
    f'<svg {H} viewBox="493 60 {772 + DX} 477">{T}<path fill="{SYM}" d="{J["sym"]}"/><circle cx="{cx}" cy="{cy}" r="{r}" fill="{BG}"/>'
    f'<path fill="{TXT}" d="{J["aper"]}"/><path fill="{TXT}" transform="translate({DX} 0)" d="{J["ation"]}"/></svg>\n')
s = 340
open("aperation-mark.svg", "w").write(
    f'<svg {H} viewBox="{cx - s / 2:.2f} {cy - s / 2:.2f} {s} {s}">{T}<path fill="{SYM}" d="{J["sym"]}"/></svg>\n')  # a középső rész (a ponttal együtt) átlátszó
s = 440
open("aperation-icon.svg", "w").write(
    f'<svg {H} viewBox="{cx - s / 2:.2f} {cy - s / 2:.2f} {s} {s}">{T}<rect x="{cx - s / 2:.2f}" y="{cy - s / 2:.2f}" width="{s}" height="{s}" fill="{BG}"/><path fill="{SYM}" d="{J["sym"]}"/><circle cx="{cx}" cy="{cy}" r="{r}" fill="{BG}"/></svg>\n')
print("kész: aperation-logo.svg, aperation-mark.svg, aperation-icon.svg")
