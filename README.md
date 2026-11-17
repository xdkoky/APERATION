# APERATION

Forgatási napvezérlő 1st AD-knek. Telefonon fut, net nélkül is.

**App:** https://xdkoky.github.io/ANDRIS--LLOYD/base/ – telefonon a főképernyőre kell tenni (Megosztás → Főképernyőhöz adás).

## Mit tud

- **Most:** óra, visszaszámláló, várható wrap, Kész / Vissza / +5′, take-stopper, a következő beállítás és fényváltás.
- **Terv:** Excel betöltése (a `base/Forgatasi_sablon.xlsx` sablonnal a legbiztosabb) vagy beírás az appban, blokkok húzással átrendezve, mentés Excelbe, korábbi projektek.
- **Közös munka:** pozíciónkénti belépőkód, beállítható, ki mit lát, és ki vezérelheti a napot (Firebase).
- **Nyomtatás:** diszpó, forgatókönyv, shotlist, szkriptlap (A4, PDF-be is).

## Fejlesztés

```
python3 base/build_base.py   # app (base/app.html), sablon, telepíthető változat (docs/base/)
```

- Források: `base/` (`app_template.html`, `editor.js`, `multi.js`, `print.js`, `gate.js`, `*.css`), logó: `base/brand/`
- Firebase-szabályok és beállítás: `base/firebase/`
- A *Kapaszkodni* (2026. 11. 12.) forgatás saját anyagai: `diszpo/`, `anyagok/`, `docs/` gyökere

© 2026 Tóth Tamás János · APERATION™
