# Práce na webu

Každá práce má vlastní složku `content/prace/<adresa>/`. Název složky je adresa stránky: `content/prace/kavarna-paulus/` → `/prace/kavarna-paulus/`.

Ve složce je `projekt.json` a obrázky. Build z toho sám vytvoří kartu do stuhy, stránku detailu, záznam v rejstříku, sitemapu a strukturovaná data.

## projekt.json

| pole | co to je |
| --- | --- |
| `nazev` | krátký název (na kartě a v rejstříku) |
| `typ` | `web`, `identita`, `motion` nebo `tisk` (určuje prostředí detailu) |
| `typy` | nepovinné: u práce přes víc služeb (celá značka) seznam, např. `["identita", "tisk", "web"]`; detail pak ukáže všechna prostředí v tomhle pořadí |
| `klient`, `rok`, `role` | fakta do panelu (`rok` je nepovinný) |
| `sluzby` | seznam služeb |
| `perex` | jedna až dvě věty pod názvem |
| `kapitoly` | `[{ "nadpis": "Zadání", "text": "…" }, …]` |
| `barvy` | 3 barvy značky, první je pozadí karty |
| `poradi` | pořadí ve stuze a v rejstříku |
| `web` | jen u webů: adresa živého webu pro rám (cizí web se zobrazí, jen pokud vložení do rámu dovoluje) |
| `webNazev` | nepovinné: co se má ukázat v liště rámu místo adresy, např. `kavarna-para.cz` |
| `poznamky` | jen u webů: `[{ "x": 50, "y": 12, "text": "…" }]`, pozice v procentech rámu |
| `ukazka` | `true` u ukázkových projektů: stránka má štítek Ukázka a nejde do vyhledávačů |

## Obrázky

- `obal.webp`: čtverec, karta ve stuze a hlavní obrázek detailu
- `og.jpg` (nepovinné): 1200 × 630, obrázek při sdílení odkazu na sociálních sítích (jinak se použije obal)
- web: `desktop.webp` (16:10) a `mobil-1.webp`, `mobil-2.webp`, … (telefon v zařízení); nepovinně `web-cela.webp` (celá stránka jako jeden dlouhý obrázek; použije se místo živého rámu, když web vložení do rámu nedovoluje, `poznamky` jsou pak v procentech obrázku), nebo složka `web/` se statickou kopií webu, která se ukáže v rámu (adresa pak `/prace/<slug>/web/`)
- identita a motion: `galerie-1.webp`, `galerie-2.webp`, … (hloubková galerie); u motion prací může vedle obrázku ležet video se stejným jménem (`galerie-2.mp4`), které se pak přehraje na jeho místě (obrázek slouží jako náhled). Video krátké, bez zvuku, ideálně do 1–2 MB
- tisk: `kus-1.webp`, `kus-2.webp`, … (kusy na stole) a `strana-1.webp`, `strana-2.webp`, … (listovatelná tiskovina)
