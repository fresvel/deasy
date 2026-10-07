// NADIE INSTANCIA UN SERVICIO AL CARGAR EL MODULO. Puerta a techo cero.
//
// Por que existe: ESM tolera los ciclos, pero NO tolera usar una referencia antes de que se
// inicialice. Un `const servicio = new Servicio()` en el cuerpo de un modulo se ejecuta en el
// instante del import, asi que si `Servicio` llega por la puerta de un dominio —un `index.js` que
// reexporta— se pide antes de que esa puerta termine de evaluarse y revienta con
//
//     ReferenceError: Cannot access 'X' before initialization
//
// El 2026-10-07 mordio CUATRO veces en un dia, una por cada dominio que se movio, y cada vez costo
// un arranque roto. Y hacer perezoso UN campo solo mueve que orden rompe: hubo un caso en que el
// backend arrancaba y el test que importaba el servicio directo fallaba.
//
// La forma correcta es resolver al PRIMER USO:
//
//     let _servicio = null;
//     const servicio = () => (_servicio ??= new Servicio());
//
// Se mira `controllers/`, `routes/` y `dominios/`, que es donde vive el problema: son los modulos
// que importan servicios, y los que un router carga en cadena al arrancar.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const RAICES = ["controllers", "routes", "dominios"];
const IGNORAR = new Set(["node_modules", "coverage", ".git"]);

// No instancian nada de otro modulo nuestro, asi que no pueden participar en un ciclo:
// `Router` es de express, y `Set`/`Map`/`URL`/`Date`/`RegExp` son del lenguaje.
const INOCENTES = new Set(["Router", "Set", "Map", "WeakMap", "URL", "Date", "RegExp", "Error", "Intl"]);

// `const|let|var NOMBRE = new Clase(` en la COLUMNA CERO, que es lo que significa "a nivel de
// modulo". Con sangria esta dentro de un bloque y se ejecuta cuando toca, no al importar.
const DECLARACION = /^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*new\s+([A-Za-z_$][\w$]*)/;

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

const fallos = [];
let ficheros = 0;
for (const raiz of RAICES) {
  for (const ruta of await listar(raiz)) {
    ficheros += 1;
    const lineas = (await readFile(ruta, "utf8")).split("\n");
    lineas.forEach((linea, i) => {
      const m = DECLARACION.exec(linea);
      if (m && !INOCENTES.has(m[2])) {
        fallos.push({ ruta, linea: i + 1, nombre: m[1], clase: m[2], texto: linea.trim() });
      }
    });
  }
}

if (fallos.length) {
  console.error(`check:instancias FALLA — ${fallos.length} instanciacion(es) a nivel de modulo:\n`);
  for (const f of fallos) {
    console.error(`  ${f.ruta}:${f.linea}  ${f.texto}`);
    console.error(`      ->  let _${f.nombre} = null;`);
    console.error(`          const ${f.nombre} = () => (_${f.nombre} ??= new ${f.clase}(…));`);
    console.error(`          ...y cada uso pasa de \`${f.nombre}.\` a \`${f.nombre}().\`\n`);
  }
  process.exit(1);
}
console.log(`check:instancias OK — ${ficheros} ficheros, ningun servicio instanciado al cargar el modulo.`);
