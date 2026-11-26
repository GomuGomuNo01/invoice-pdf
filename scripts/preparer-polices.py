"""Prépare les polices Carlito embarquées dans le PDF.

Supprime la table GSUB (substitutions typographiques, dont les ligatures "ti", "fi", "ff").
Raison : PDFBox 3 applique les ligatures latines et le glyphe obtenu n'a pas de
correspondance Unicode fiable, ce qui casse la recherche et le copier-coller dans le PDF.

Source des polices : https://github.com/google/fonts/tree/main/ofl/carlito (licence OFL).
Usage : python scripts/preparer-polices.py backend/src/main/resources/fonts
"""
import sys
from pathlib import Path

from fontTools.ttLib import TTFont


def main(directory: str) -> None:
    for path in sorted(Path(directory).glob("Carlito-*.ttf")):
        font = TTFont(path)
        if "GSUB" in font:
            del font["GSUB"]
            font.save(path)
            print(f"GSUB supprimée : {path.name}")
        else:
            print(f"Déjà préparée : {path.name}")


if __name__ == "__main__":
    main(sys.argv[1])
