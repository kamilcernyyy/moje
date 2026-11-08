# Práce na webu

Každá práce má vlastní složku `content/prace/<adresa>/`. Název složky je adresa stránky: `content/prace/kavarna-paulus/` → `/prace/kavarna-paulus/`.

Ve složce je `projekt.json` a obrázky. Build z toho sám vytvoří kartu do stuhy, stránku detailu, záznam v rejstříku, sitemapu a strukturovaná data.

## projekt.json

| pole | co to je |
| --- | --- |
| `nazev` | krátký název (na kartě a v rejstříku) |
| `typ` | `web`, `identita`, `motion` nebo `tisk` (určuje prostředí detailu) |
| `klient`, `rok`, `role` | fakta do panelu |
| `sluzby` | seznam služeb |
| `perex` | jedna až dvě věty pod názvem |
| `kapitoly` | `[{ "nadpis": "Zadání", "text": "…" }, …]` |
| `barvy` | 3 barvy značky, první je pozadí karty |
| `poradi` | pořadí ve stuze a v rejstříku |
| `web` | jen u webů: adresa živého webu pro rám |
| `poznamky` | jen u webů: `[{ "x": 50, "y": 12, "text": "…" }]`, pozice v procentech rámu |
| `ukazka` | `true` u ukázkových projektů: stránka má štítek Ukázka a nejde do vyhledávačů |

## Obrázky

- `obal.webp`: čtverec, karta ve stuze a hlavní obrázek detailu
- web: `desktop.webp` (16:10) a `mobil-1.webp`, `mobil-2.webp`, … (telefon v zařízení)
- identita a motion: `galerie-1.webp`, `galerie-2.webp`, … (hloubková galerie)
- tisk: `kus-1.webp`, `kus-2.webp`, … (kusy na stole) a `strana-1.webp`, `strana-2.webp`, … (listovatelná tiskovina)
