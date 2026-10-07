// NADIE CONSTRUYE UNA DE NUESTRAS CLASES AL CARGAR EL MODULO. Puerta a techo cero.
//
// Por que existe: ESM tolera los ciclos, pero NO tolera usar una referencia antes de que se
// inicialice. Si el cuerpo de un modulo hace `new Servicio()`, eso se ejecuta en el instante del
// import; y si `Servicio` llega por la puerta de un dominio —un `index.js` que reexporta— se pide
// antes de que esa puerta termine de evaluarse y revienta con
//
//     ReferenceError: Cannot access 'X' before initialization
//
// Mordio CUATRO veces el 2026-10-07 moviendo dominios, y una QUINTA al mover `identidad`, esa ya
// con la puerta puesta — porque la puerta mirabasolo `controllers/`, `routes/` y `dominios/`, y el
// culpable estaba en `services/realtime/RealtimeGateway.js`. Lecciones, las dos en el codigo de
// abajo:
//
//   1 · NO SE RECORTA EL ALCANCE A OJO. Se mira todo el backend. Antes se excluian `services/`,
//       `middlewares/`, `config/`, `utils/` y `scripts/` «porque el problema vive en los
//       controladores», y alli habia NUEVE sitios, tres de ellos construyendo justo lo que pasa por
//       la puerta de un dominio. Es el mismo fallo que tuvieron `check:sql-aliases` y
//       `check:sql-comments` al excluir una carpeta por NOMBRE.
//
//   2 · UNA SOLA REGLA Y CERO EXCEPCIONES. Se probo tambien mirar el CUERPO DE LOS CONSTRUCTORES
//       —`RealtimeGateway` construia tres servicios de dos dominios en el suyo, igual que
//       `SqlAdminService` con sus seis— y se RETIRO al medirlo: marcaba 13 sitios de los que 11 eran
//       inofensivos. Un constructor solo corre al cargar SI alguien instancia esa clase a nivel de
//       modulo, asi que con el nivel de modulo a CERO la comprobacion del constructor no puede
//       encontrar nada: es redundante por construccion, no por optimismo.
//
//       ⚠️ Lo que eso exige es que NO HAYA EXCEPCIONES. Las dos que parecian razonables —`index.js`,
//       cuyo cuerpo corre al final, y `scripts/*.mjs`, que son puntos de entrada— se arreglaron en
//       vez de eximirse, y costaron cuatro lineas. Si alguien añade una excepcion aqui, la
//       redundancia de arriba deja de ser cierta y vuelve el fallo por el constructor.
//
// Lo que NO se mira, y por que: construir algo de FUERA (`new Minio.Client({...})`, `new Router()`,
// `new Set()`) no puede participar en un ciclo de nuestros modulos, que es el fallo que esto
// persigue. Se reconoce por el import: si la clase no entra por una ruta RELATIVA, no es nuestra.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const RAIZ = process.cwd();
const IGNORAR = new Set(["node_modules", "coverage", ".git", "templates", "public"]);

const listar = async (dir) => {
  const salida = [];
  for (const entrada of await readdir(dir, { withFileTypes: true })) {
    if (IGNORAR.has(entrada.name)) continue;
    const ruta = path.join(dir, entrada.name);
    if (entrada.isDirectory()) salida.push(...await listar(ruta));
    else if (/\.(js|mjs)$/.test(entrada.name) && !/\.test\.(js|mjs)$/.test(entrada.name)) salida.push(ruta);
  }
  return salida;
};

// Las clases que el fichero importa por ruta RELATIVA: esas son nuestras.
const nuestrasClases = (src) => {
  const nombres = new Set();
  const relativo = /import\s+([^;]+?)\s+from\s+"(\.[^"]+)"/g;
  for (const m of src.matchAll(relativo)) {
    for (const trozo of m[1].replace(/[{}]/g, ",").split(",")) {
      const nombre = trozo.trim().split(/\s+as\s+/).pop()?.trim();
      if (nombre && /^[A-Z][\w$]*$/.test(nombre)) nombres.add(nombre);
    }
  }
  // Y las que el propio fichero declara: un singleton de su propia clase cuenta igual.
  for (const m of src.matchAll(/^\s*(?:export\s+(?:default\s+)?)?class\s+([A-Z][\w$]*)/gm)) nombres.add(m[1]);
  return nombres;
};

const DECLARACION = /^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*new\s+([A-Za-z_$][\w$]*)\s*\(/;

const fallos = [];
let ficheros = 0;
for (const ruta of await listar(RAIZ)) {
  ficheros += 1;
  const src = await readFile(ruta, "utf8");
  const nuestras = nuestrasClases(src);
  src.split("\n").forEach((linea, i) => {
    const m = DECLARACION.exec(linea);
    if (m && nuestras.has(m[2])) {
      fallos.push({ rel: path.relative(RAIZ, ruta), linea: i + 1, nombre: m[1], clase: m[2], texto: linea.trim() });
    }
  });
}

if (fallos.length) {
  console.error(`check:instancias FALLA — ${fallos.length} sitio(s) construyendo una clase nuestra al cargar:\n`);
  for (const f of fallos) {
    console.error(`  ${f.rel}:${f.linea}  ${f.texto}`);
    console.error(`      ->  let _${f.nombre} = null;`);
    console.error(`          const ${f.nombre} = () => (_${f.nombre} ??= new ${f.clase}(…));`);
    console.error(`          ...y cada uso pasa de \`${f.nombre}.\` a \`${f.nombre}().\`\n`);
  }
  process.exit(1);
}
console.log(`check:instancias OK — ${ficheros} ficheros, nada nuestro construido al cargar el modulo.`);
