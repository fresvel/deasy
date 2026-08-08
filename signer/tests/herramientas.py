"""Herramientas de medición del microservicio. No son pruebas.

Se usan para reproducir las cifras de `docs/auditoria-signer-2026-08.md` y para
comprobar, después de cada fase de refactor, que la complejidad baja de verdad
y que la red sigue cubriendo lo mismo.

    # complejidad por funcion (ciclomatica y anidamiento)
    bash scripts/docker-env.sh dev exec -T signer sh -lc 'cd /app && python -m tests.herramientas complejidad app.py'

    # que funciones de app.py ejerce la suite (no hay `coverage` en la imagen)
    bash scripts/docker-env.sh dev exec -T signer sh -lc 'cd /app && python -m tests.herramientas cobertura'
"""

import ast
import sys
import unittest

RAMIFICA = (ast.If, ast.For, ast.AsyncFor, ast.While, ast.ExceptHandler,
            ast.With, ast.AsyncWith, ast.Assert, ast.IfExp, ast.comprehension)
ANIDA = (ast.If, ast.For, ast.AsyncFor, ast.While, ast.With, ast.AsyncWith,
         ast.Try, ast.ExceptHandler, ast.FunctionDef, ast.AsyncFunctionDef)


def ciclomatica(nodo) -> int:
    total = 1
    for hijo in ast.walk(nodo):
        if isinstance(hijo, RAMIFICA):
            total += 1
        elif isinstance(hijo, ast.BoolOp):
            total += len(hijo.values) - 1
    return total


def anidamiento(nodo, nivel=0) -> int:
    mayor = nivel
    for hijo in ast.iter_child_nodes(nodo):
        siguiente = nivel + 1 if isinstance(hijo, ANIDA) else nivel
        mayor = max(mayor, anidamiento(hijo, siguiente))
    return mayor


def funciones(ruta: str):
    arbol = ast.parse(open(ruta, encoding="utf-8").read())
    return [nodo for nodo in ast.walk(arbol)
            if isinstance(nodo, (ast.FunctionDef, ast.AsyncFunctionDef))]


def informe_complejidad(ruta: str):
    filas = [
        (n.name, n.lineno, n.end_lineno, n.end_lineno - n.lineno + 1,
         ciclomatica(n), anidamiento(n))
        for n in funciones(ruta)
    ]
    filas.sort(key=lambda f: (-f[4], -f[5]))
    print(f"{'funcion':<38}{'lineas':>12}{'LOC':>6}{'CC':>5}{'anid':>6}")
    for nombre, inicio, fin, loc, cc, anid in filas:
        print(f"{nombre:<38}{inicio:>6}-{fin:<5}{loc:>6}{cc:>5}{anid:>6}")
    print(f"\ntotal funciones: {len(filas)}  suma CC: {sum(f[4] for f in filas)}")


def informe_cobertura(origen: str = "/app/app.py") -> int:
    declaradas = {n.name for n in funciones(origen)}
    vistas: set[str] = set()

    def rastreador(marco, evento, _arg):
        if marco.f_code.co_filename != origen:
            return None
        if evento == "call":
            vistas.add(marco.f_code.co_name)
        return rastreador

    suite = unittest.TestLoader().discover("tests", top_level_dir=".")
    sys.settrace(rastreador)
    resultado = unittest.TextTestRunner(verbosity=1).run(suite)
    sys.settrace(None)

    cubiertas = declaradas & vistas
    print(f"\nfunciones declaradas: {len(declaradas)}")
    print(f"funciones ejercidas : {len(cubiertas)}"
          f" ({100 * len(cubiertas) / len(declaradas):.0f} %)")
    print("sin cubrir:")
    for nombre in sorted(declaradas - vistas):
        print("  -", nombre)
    return 0 if resultado.wasSuccessful() else 1


def main(argumentos: list[str]) -> int:
    if not argumentos or argumentos[0] not in {"complejidad", "cobertura"}:
        print(__doc__)
        return 2
    if argumentos[0] == "complejidad":
        informe_complejidad(argumentos[1] if len(argumentos) > 1 else "app.py")
        return 0
    return informe_cobertura(argumentos[1] if len(argumentos) > 1 else "/app/app.py")


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
