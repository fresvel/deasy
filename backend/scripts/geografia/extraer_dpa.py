#!/usr/bin/env python3
"""Extrae provincias y cantones del Clasificador Geografico Estadistico del INEC.

FUENTE OFICIAL (no inventar estos datos a mano):
    https://aplicaciones2.ecuadorencifras.gob.ec/SIN/descargas/cge2025.xls
    INEC - Direccion de Cartografia Estadistica y Operaciones de Campo (DICA)
    "Clasificador Geografico Estadistico 2025", actualizado al 31 de diciembre de 2024.
    sha256 del fichero usado: 205b33e777a903095fd838c614659a3a3ff737beac03be8a36c3531cd272cc7b
    (Se guarda el hash y no el .xls: son 337 KB de binario y la URL es estable. Si el
     INEC publica una version nueva el hash cambia, y los assert de abajo dicen si el
     cambio es real o si se rompio la extraccion.)

FORMA DEL FICHERO. Una sola hoja ("DPA 2025") con la jerarquia implicita en las
columnas, no en el codigo: la columna 1 lleva los 2 digitos de la PROVINCIA, la 2 los
del CANTON y la 3 los de la PARROQUIA. El codigo DPA completo se compone concatenando.
La columna 4 es el nombre. Las columnas 5-8 son un SEGUNDO bloque de parroquias en
paralelo, que aqui no se usa.

LA TRAMPA, y esta dicha en el propio fichero: las jurisdicciones precedidas por un
asterisco son historicas -cantones que pasaron a formar parte de provincias nuevas-.
Salen 231 cantones; quitando las 10 marcadas quedan los 221 vigentes, que es la cifra
oficial. Sin ese filtro, Santa Elena, Santo Domingo, La Concordia y los de Orellana
aparecen DOS veces, en su provincia vieja y en la nueva.

Ojo: "CANTON BOLIVAR" y "CANTON OLMEDO" estan repetidos y NO llevan asterisco. Son dos
cantones distintos con el mismo nombre en provincias distintas (Carchi/Manabi y
Loja/Manabi), asi que la unicidad del catalogo es (provincia, nombre), nunca el nombre.

    pip install xlrd pandas
    python3 backend/scripts/geografia/extraer_dpa.py cge2025.xls > dpa.json
"""
import json
import re
import sys

import pandas as pd

CODIGO = re.compile(r"\d{2}")


def extraer(ruta):
    hoja = pd.read_excel(ruta, sheet_name=0, header=None, dtype=str)
    provincias, cantones = [], []
    for i in range(len(hoja)):
        cod_prov, cod_cant, cod_parr, nombre = (hoja.iat[i, j] for j in (1, 2, 3, 4))
        if pd.isna(nombre) or pd.isna(cod_prov):
            continue
        nombre, cod_prov = str(nombre).strip(), str(cod_prov).strip()
        if not CODIGO.fullmatch(cod_prov):
            continue
        historica = nombre.startswith("*")
        nombre = nombre.lstrip("*").strip()
        cc = str(cod_cant).strip() if pd.notna(cod_cant) else ""
        cp = str(cod_parr).strip() if pd.notna(cod_parr) else ""
        if not cc and nombre.upper().startswith("PROVINCIA"):
            provincias.append({"dpa": cod_prov, "nombre": nombre, "historica": historica})
        elif CODIGO.fullmatch(cc) and not CODIGO.fullmatch(cp) and nombre.upper().startswith(("CANTÓN", "CANTON")):
            cantones.append({"dpa": cod_prov + cc, "provincia_dpa": cod_prov,
                             "nombre": nombre, "historica": historica})
    return provincias, cantones


def limpiar(nombre, prefijos):
    """"PROVINCIA DEL AZUAY" -> "Azuay". El clasificador escribe todo en mayusculas y
    con el tipo de jurisdiccion delante, que no forma parte del nombre."""
    n = re.sub(r"\s+", " ", nombre).strip()
    for p in prefijos:
        if n.upper().startswith(p):
            n = n[len(p):].strip()
            break
    return n.title()


if __name__ == "__main__":
    provincias, cantones = extraer(sys.argv[1])
    vivas = [p for p in provincias if not p["historica"]]
    vivos = [c for c in cantones if not c["historica"]]
    # Los invariantes que hacen fiable la extraccion. Si el INEC publica una version
    # nueva y estos numeros cambian, es un cambio real y hay que mirarlo, no ajustarlo.
    assert len(vivas) == 24, f"provincias vigentes: {len(vivas)}, esperadas 24"
    assert len(vivos) == 221, f"cantones vigentes: {len(vivos)}, esperados 221"
    salida = {
        "provincias": [{"dpa": p["dpa"], "nombre": limpiar(p["nombre"], ("PROVINCIA DEL ", "PROVINCIA DE LOS ", "PROVINCIA DE LA ", "PROVINCIA DE "))} for p in vivas],
        "cantones": [{"dpa": c["dpa"], "provincia_dpa": c["provincia_dpa"], "nombre": limpiar(c["nombre"], ("CANTÓN ", "CANTON "))} for c in vivos],
    }
    print(json.dumps(salida, ensure_ascii=False, indent=1))
