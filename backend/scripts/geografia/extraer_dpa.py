#!/usr/bin/env python3
"""Extrae provincias, cantones y parroquias del Clasificador Geografico Estadistico del INEC.

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
paralelo, y SI se usa: la mitad de las parroquias vive ahi.

LA TRAMPA 1, y esta dicha en el propio fichero: las jurisdicciones precedidas por UN
asterisco son historicas -cantones que pasaron a formar parte de provincias nuevas-. Sin
ese filtro, Santa Elena, Santo Domingo, La Concordia y los de Orellana aparecen DOS
veces, en su provincia vieja y en la nueva.

LA TRAMPA 2, que NO esta dicha y costo un canton entero. DOS asteriscos no son un
asterisco: `**` es una llamada a pie de pagina y la jurisdiccion SIGUE VIGENTE. El unico
caso es `**CANTON LA CONCORDIA` (2302), cuya nota al pie cita el decreto que lo creo en
2013. Hasta el 2026-09-08 este extractor hacia `nombre.startswith("*")` y por eso La
Concordia NO ESTABA en el catalogo, dejando sus cuatro parroquias huerfanas. Y el assert
decia 221 y CONSAGRABA el fallo: al quitar uno, el numero cuadraba. Son 222.

LA TRAMPA 3: la provincia 90 "ZONAS EN ESTUDIO" no es una provincia. Son territorios en
disputa que no pertenecen a ninguna provincia ni canton. Se excluye entera, que es el
mismo criterio por el que el catalogo tiene 24 provincias y no 25.

Ojo: "CANTON BOLIVAR" y "CANTON OLMEDO" estan repetidos y NO llevan asterisco. Son dos
cantones distintos con el mismo nombre en provincias distintas (Carchi/Manabi y
Loja/Manabi), asi que la unicidad del catalogo es (provincia, nombre), nunca el nombre.

Y CON LAS PARROQUIAS LA LECCION VA UN NIVEL MAS HONDO: su nombre no es unico NI DENTRO
DE SU PROPIO CANTON. La cabecera de Azogues se llama "Azogues" y una de las parroquias
urbanas de dentro tambien -- son 33 casos--. Su identidad es el codigo DPA.

LA CLASE de una parroquia esta en su codigo, no en una columna: 01-49 urbanas, 50 la
cabecera cantonal, 51+ rurales. Cada canton vigente tiene EXACTAMENTE una cabecera, y ese
invariante vale de verificacion: si el INEC cambia la forma del fichero, se rompe.

    pip install xlrd pandas
    python3 backend/scripts/geografia/extraer_dpa.py cge2025.xls > dpa.json
"""
import json
import re
import sys

import pandas as pd

CODIGO = re.compile(r"\d{2}")
PROVINCIA_EN_ESTUDIO = "90"


def es_historica(nombre):
    """UN asterisco marca una jurisdiccion historica. DOS son una llamada a pie de pagina
    y la jurisdiccion SIGUE VIGENTE -- ver LA TRAMPA 2 en la cabecera."""
    marca = re.match(r"^(\*+)", nombre)
    return bool(marca) and len(marca.group(1)) == 1


def _codigo(valor):
    """El .xls trae los codigos como texto unas veces y como float otras ("13.0")."""
    if pd.isna(valor):
        return ""
    texto = str(valor).strip()
    if texto.endswith(".0"):
        texto = texto[:-2]
    return texto.zfill(2) if texto.isdigit() and len(texto) <= 2 else texto


def extraer(ruta):
    hoja = pd.read_excel(ruta, sheet_name=0, header=None, dtype=str)
    provincias, cantones, parroquias = [], [], {}
    for i in range(len(hoja)):
        cod_prov, cod_cant, cod_parr = (_codigo(hoja.iat[i, j]) for j in (1, 2, 3))
        nombre = hoja.iat[i, 4]
        if pd.notna(nombre) and CODIGO.fullmatch(cod_prov):
            nombre = str(nombre).strip()
            historica = es_historica(nombre)
            limpio = nombre.lstrip("*").strip()
            if not cod_cant and limpio.upper().startswith("PROVINCIA"):
                provincias.append({"dpa": cod_prov, "nombre": limpio, "historica": historica})
            elif CODIGO.fullmatch(cod_cant) and not CODIGO.fullmatch(cod_parr) \
                    and limpio.upper().startswith(("CANTÓN", "CANTON")):
                cantones.append({"dpa": cod_prov + cod_cant, "provincia_dpa": cod_prov,
                                 "nombre": limpio, "historica": historica})
        # Las parroquias vienen en DOS bloques de columnas en paralelo (1-4 y 5-8).
        for base in (1, 5):
            p, c, pa = (_codigo(hoja.iat[i, j]) for j in (base, base + 1, base + 2))
            nom = hoja.iat[i, base + 3]
            if pd.isna(nom) or not (CODIGO.fullmatch(p) and CODIGO.fullmatch(c) and CODIGO.fullmatch(pa)):
                continue
            nom = str(nom).strip()
            parroquias[p + c + pa] = {"dpa": p + c + pa, "canton_dpa": p + c,
                                      "nombre": nom.lstrip("*").strip(),
                                      "historica": es_historica(nom), "orden": int(pa)}
    return provincias, cantones, list(parroquias.values())


def clase(orden):
    """La clase esta en el codigo: 50 es la cabecera cantonal, por debajo urbanas y por
    encima rurales."""
    if orden == 50:
        return "cabecera"
    return "urbana" if orden < 50 else "rural"


def limpiar(nombre, prefijos):
    """"PROVINCIA DEL AZUAY" -> "Azuay". El clasificador escribe todo en mayusculas y
    con el tipo de jurisdiccion delante, que no forma parte del nombre."""
    n = re.sub(r"\s+", " ", nombre).strip()
    for p in prefijos:
        if n.upper().startswith(p):
            n = n[len(p):].strip()
            break
    return n.title()


# Particulas que van en minuscula dentro de un nombre propio. `str.title()` las capitaliza
# todas y deja "Cab. En San Vicente" o "San Jose De Quichinche".
PARTICULAS = {"de", "del", "la", "las", "el", "los", "y", "en", "a", "al"}


def castellanizar(nombre):
    """Title case del castellano: la primera palabra siempre en alta, las particulas
    interiores en baja."""
    salida = []
    for i, w in enumerate(nombre.split()):
        bajo = w.lower()
        salida.append(bajo if i > 0 and bajo in PARTICULAS else w[:1].upper() + w[1:].lower())
    return " ".join(salida)


def limpiar_parroquia(nombre):
    """La cabecera se llama "CUENCA, CABECERA CANTONAL Y CAPITAL PROVINCIAL." en el
    fichero: ese rotulo describe su papel, no es su nombre. El sufijo "(cab. en X)" SI se
    conserva -- es como el INEC distingue parroquias homonimas y dice donde esta su
    cabecera parroquial."""
    n = re.sub(r"\s+", " ", nombre).strip().rstrip(".")
    n = re.sub(r",\s*CABECERA CANTONAL.*$", "", n, flags=re.IGNORECASE)
    n = re.sub(r",\s*CAPITAL PROVINCIAL.*$", "", n, flags=re.IGNORECASE)
    # SIETE nombres vienen TRUNCADOS EN EL PROPIO FICHERO DEL INEC, con el parentesis
    # abierto y sin cerrar: "SAN GERARDO (CAB. EN SAN GERARDO DE". Ese inciso dice donde
    # esta la cabecera parroquial, y a medias no dice nada -- ademas de verse roto en un
    # desplegable--. Se recorta: el nombre de la parroquia si esta completo en los siete.
    if n.count("(") != n.count(")"):
        n = n[: n.index("(")].strip()
    return castellanizar(n)


if __name__ == "__main__":
    provincias, cantones, parroquias = extraer(sys.argv[1])
    vivas = [p for p in provincias if not p["historica"] and p["dpa"] != PROVINCIA_EN_ESTUDIO]
    vivos = [c for c in cantones if not c["historica"] and c["provincia_dpa"] != PROVINCIA_EN_ESTUDIO]
    dpa_vivos = {c["dpa"] for c in vivos}
    vivas_parr = [p for p in parroquias if not p["historica"] and p["canton_dpa"] in dpa_vivos]

    # Los invariantes que hacen fiable la extraccion. Si el INEC publica una version
    # nueva y estos numeros cambian, es un cambio real y hay que mirarlo, no ajustarlo.
    assert len(vivas) == 24, f"provincias vigentes: {len(vivas)}, esperadas 24"
    assert len(vivos) == 222, f"cantones vigentes: {len(vivos)}, esperados 222"
    assert len(vivas_parr) == 1314, f"parroquias vigentes: {len(vivas_parr)}, esperadas 1314"
    # CADA CANTON TIENE EXACTAMENTE UNA CABECERA. Es lo que prueba que no se perdio ninguno
    # por el camino, y lo que caza un cambio de forma del fichero.
    cabeceras = {p["canton_dpa"] for p in vivas_parr if p["orden"] == 50}
    assert cabeceras == dpa_vivos, f"cantones sin cabecera: {sorted(dpa_vivos - cabeceras)}"

    salida = {
        "provincias": [{"dpa": p["dpa"], "nombre": limpiar(p["nombre"], ("PROVINCIA DEL ", "PROVINCIA DE LOS ", "PROVINCIA DE LA ", "PROVINCIA DE "))} for p in vivas],
        "cantones": [{"dpa": c["dpa"], "provincia_dpa": c["provincia_dpa"], "nombre": limpiar(c["nombre"], ("CANTÓN ", "CANTON "))} for c in vivos],
        "parroquias": [{"dpa": p["dpa"], "canton_dpa": p["canton_dpa"],
                        "nombre": limpiar_parroquia(p["nombre"]), "clase": clase(p["orden"])}
                       for p in sorted(vivas_parr, key=lambda x: x["dpa"])],
    }
    print(json.dumps(salida, ensure_ascii=False, indent=1))
