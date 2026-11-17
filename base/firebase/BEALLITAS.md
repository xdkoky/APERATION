# Közös munka bekapcsolása (Firebase, egyszer kell, kb. 10 perc)

Ingyenes (Spark) csomag elég. Bankkártya nem kell.

1. **Projekt:** https://console.firebase.google.com → *Projekt hozzáadása* → név pl. `diszpo-app` → a Google Analytics kikapcsolható → *Projekt létrehozása*.
2. **Bejelentkezés:** bal menü *Build → Authentication* → *Kezdés* → *Sign-in method* fül → **Anonymous** → *Engedélyezés* → Mentés.
   Ugyanitt *Settings* fül → *Authorized domains* → *Domain hozzáadása*: `xdkoky.github.io`
3. **Adatbázis:** *Build → Firestore Database* → *Adatbázis létrehozása* → hely: `eur3 (europe-west)` → *Production mode* → Létrehozás.
4. **Szabályok:** a Firestore oldalon *Rules* fül → töröld ki, ami ott van, és másold be a teljes [`firestore.rules`](firestore.rules) fájl tartalmát → *Közzététel* (Publish).
5. **Webes app:** bal felül fogaskerék → *Projektbeállítások* → lent *Saját alkalmazások* → `</>` ikon (Web) → név: `APERATION` → *Regisztrálás* (a Hosting nem kell).
   Megjelenik egy `firebaseConfig = { apiKey: ..., authDomain: ..., projectId: ..., ... }` blokk. **Ezt másold ki és küldd el** (ezek nem titkos adatok, a webes appokban mindig nyilvánosak; a védelmet a 4. pont szabályai adják).

Ezután a konfiguráció a `base/firebase/config.json` fájlba kerül, és a `python3 base/build_base.py` újraépíti a telepíthető változatot (`docs/base/`).

## Hogyan működik

- A projekt létrehozója (Terv → Csapat → *Közös projekt indítása*) automatikusan kap 10 pozíciót, mindegyikhez egy 8 jegyű belépőkódot.
- Pozíciónként beállítható: Most, Időrend, Szkript, Stáb, Telefonszámok, Képek, Kellékek, Megjegyzések, Fények, **Vezérlés** (a nap léptetése).
- A szerver minden pozíciónak külön, előre megszűrt tervet tárol; aki nem láthat valamit, annak a telefonjára el sem jut.
- A *szerkesztői kód* egy társ-AD-nak szól: mindent lát és szerkeszt.
- *Új kód*: a régi kód megszűnik, aki már bent van, bent marad. *Kitiltás*: az illető azonnal kikerül.

## Helyi próba (fejlesztőknek)

```
cd base/firebase && npx firebase-tools emulators:start --only firestore,auth --project demo-diszpo
# másik terminálban: cd docs && python3 -m http.server 8765
# böngészőben: http://localhost:8765/base/?emu
```
