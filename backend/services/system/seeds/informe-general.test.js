// Tests de `informe-general/src/make.sh` — en concreto de la BUSQUEDA del fichero de datos.
//
// ⚠️ ESTE FICHERO VIVE FUERA DE `informe-general/` A PROPOSITO, y no es estetica.
// `publishBaseSeedAssets` sube a MinIO el arbol COMPLETO de `BASE_SEED_DIR` (dos veces: al catalogo
// `Seeds/` y, para todo lo que cuelga de `src/`, al artifact instanciado). Un `*.test.js` dentro de
// la semilla acabaria publicado en el bucket y, si cayera bajo `src/`, dentro del ZIP de TODAS las
// plantillas que descargue el usuario. `seeds/` no lo enumera nadie: `BASE_SEED_DIR` apunta a la
// carpeta de la semilla, no a su padre.
//
// Por que se prueba un script de bash desde node: `make.sh` es el unico eslabon de la cadena que se
// ejecuta en la maquina del USUARIO, y ninguna otra puerta lo mira — ni `check:imports`, ni el
// arranque, ni el char. Es la misma clase de agujero que el SQL de la regla 3 del metodo: una cadena
// de texto que nadie valida hasta que alguien la ejecuta.
//
// Como se prueba sin Docker: `make.sh` delega el render en `docker run ... python .deasy_render.py
// '<fichero de datos>'`. Con un `docker` falso en el PATH que solo registra su argv, se observa
// EXACTAMENTE que candidato gano la busqueda, sin descargar imagenes ni renderizar nada. El script
// termina en 1 despues (no hay `main.tex`), y da igual: lo que se afirma es el argv registrado.

import test from "node:test";
import assert from "node:assert/strict";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const MAKE_SH = path.join(AQUI, "informe-general", "src", "make.sh");

// Monta un paquete de mentira y devuelve el fichero de datos que `make.sh` acabo pasando al render.
// `ficheros` son rutas relativas a WORKDIR; `../algo` cae en el directorio padre, que es justo el
// caso del arbol de la semilla (make.sh en `src/`, defaults.yaml en el padre).
const dataFileElegido = (ficheros) => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "make-sh-"));
  const workdir = path.join(raiz, "pkg");
  const bin = path.join(raiz, "bin");
  fs.mkdirSync(workdir);
  fs.mkdirSync(bin);

  fs.copyFileSync(MAKE_SH, path.join(workdir, "make.sh"));
  // Sin plantillas .j2 el paso de render es un no-op y no habria nada que observar.
  fs.writeFileSync(path.join(workdir, "dummy.tex.j2"), "sin variables\n");
  for (const rel of ficheros) {
    const abs = path.resolve(workdir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, "clave: valor\n");
  }

  const argv = path.join(raiz, "docker-argv.txt");
  fs.writeFileSync(path.join(bin, "docker"), `#!/usr/bin/env bash\nprintf '%s\\n' "$@" > ${JSON.stringify(argv)}\n`);
  fs.chmodSync(path.join(bin, "docker"), 0o755);

  spawnSync("bash", ["make.sh"], {
    cwd: workdir,
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
    encoding: "utf8",
  });

  if (!fs.existsSync(argv)) {
    return null; // el render ni se intento
  }
  // El ultimo argumento es el `sh -c "pip install … && python .deasy_render.py '<X>'"`.
  const elegido = /\.deasy_render\.py '([^']*)'/.exec(fs.readFileSync(argv, "utf8"));
  return elegido ? elegido[1] : null;
};

// --- Lo que ya funcionaba y no se puede romper ---------------------------------------------------

test("un paquete con solo data.yaml sigue renderizando con data.yaml", () => {
  assert.equal(dataFileElegido(["data.yaml"]), "data.yaml");
});

test("el arbol de la semilla (defaults.yaml en el padre) se copia dentro conservando .yaml", () => {
  // El contenedor solo monta WORKDIR, asi que un fichero del padre hay que copiarlo dentro. El
  // nombre de la copia conserva la extension porque de ella depende que el render use yaml o json.
  assert.equal(dataFileElegido(["../defaults.yaml"]), ".deasy_data.yaml");
});

test("sin ningun fichero de datos no se pasa ninguno (y el render revienta con StrictUndefined)", () => {
  assert.equal(dataFileElegido([]), "");
});

// --- El camino JSON que abre el §0.4 -------------------------------------------------------------

test("un paquete con data.json renderiza con data.json", () => {
  assert.equal(dataFileElegido(["data.json"]), "data.json");
});

test("con los DOS, gana data.json: el payload generado pisa al copiado de la semilla", () => {
  // Este es el orden que permite que el generador emita `data.json` sin reemitir los paquetes que ya
  // llevan `data.yaml` dentro. Si ganara el `.yaml`, el generador quedaria mudo en esos paquetes.
  assert.equal(dataFileElegido(["data.yaml", "data.json"]), "data.json");
});

test("data.json de la raiz gana incluso a un data.yaml del padre", () => {
  assert.equal(dataFileElegido(["data.json", "../data.yaml"]), "data.json");
});

test("un data.json del padre se copia dentro conservando .json", () => {
  // Sin conservar la extension, el render lo abriria con el lector de YAML y el JSON generado se
  // interpretaria mal o fallaria.
  assert.equal(dataFileElegido(["../data.json"]), ".deasy_data.json");
});

test("data.* del paquete gana a defaults.* de la semilla", () => {
  assert.equal(dataFileElegido(["data.yaml", "defaults.yaml"]), "data.yaml");
});
