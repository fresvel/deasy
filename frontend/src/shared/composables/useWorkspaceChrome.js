import { ref } from "vue";

/** Umbral de escritorio: el `xl` de Tailwind, el mismo que usa la rejilla del shell. */
const DESKTOP_BREAKPOINT = 1280;

/**
 * Estado del chrome del workspace: el menu lateral y el panel de notificaciones.
 *
 * Las vistas que montan AppWorkspaceShell (admin, perfil, procesos, home, documentos, firmas) repetian
 * este estado y sus handlers a mano, con tres nombres distintos para lo mismo (`vmenu` / `menuOpen` /
 * `showMenu`) y el numero magico 1280 escrito diez veces en tres ficheros. Desde el 2026-08-22 comparten
 * ademas el mismo valor inicial: la excepcion de procesos se retiro. El shell ya resuelve solo su navegacion y sus
 * permisos (AppWorkspaceShell.vue:162-267), pero exige a cada vista que le lleve este estado.
 *
 * Lo que NO entra aqui, y es a proposito:
 *
 * - **La identidad del usuario** (`userPhoto`, `userFullName`). Parece duplicada y no lo es: procesos la
 *   deriva con `computed` y las demas con `ref`; perfil necesita la foto MUTABLE porque se sube desde el
 *   propio sidebar; y el fallback del nombre cambia por vista ("Administrador" vs "Usuario", y procesos
 *   ademas cae al email). Unificarlo cambiaria comportamiento en tres vistas.
 * - **`handlePrimaryNavInteraction` entero.** Admin, perfil y procesos comparten exactamente
 *   `revealSidebarForNav`, pero home antepone su propio escalado (navegar a /home, cerrar el proceso
 *   abierto, cerrar paneles) y solo despues cae en la misma logica. Por eso se expone la pieza compartida
 *   y no el handler completo: home la llama al final del suyo.
 *
 * Cuando el shell pase a ser layout de ruta (ver docs/planes/referencia/frontend.md, fase 3), este estado
 * subira al layout y las paginas dejaran de verlo. Este composable es el paso intermedio que quita la
 * duplicacion sin tocar el router todavia.
 */
export function useWorkspaceChrome() {
  const isClient = typeof window !== "undefined";
  // La barra viene abierta en escritorio y cerrada en movil. UNA regla para las seis vistas.
  //
  // ⚠️ AQUI HABIA UN PARAMETRO `menuOpenByDefault`, Y CON EL LA EXCEPCION DE PROCESOS.
  // Este mismo comentario decia: «procesos es el unico que arranca siempre cerrado… la discrepancia es
  // 3 contra 1 y probablemente sea un descuido, pero unificarla es una decision de producto». El dueño
  // la tomo el 2026-08-22: **se unifica**. Con `/procesos` sin la excepcion, el parametro se queda sin
  // consumidor, y un parametro sin consumidor no es una API sino una puerta abierta a que la
  // discrepancia vuelva. Se retira con ella.
  //
  // 🪤 De donde salio la confusion: la barra plegada mide 88 px (`xl:w-22`) y la abierta 282
  // (`--ancho-barra-lateral`), asi que medir el ancho hacia pensar que habia DOS asides. Es uno solo,
  // en `SMenu.vue`, montado por `AppWorkspaceShell` en un unico sitio; lo que cambiaba era su ESTADO.
  const menuOpen = ref(isClient ? window.innerWidth >= DESKTOP_BREAKPOINT : true);
  const showNotify = ref(false);

  const toggleMenu = () => {
    menuOpen.value = !menuOpen.value;
  };
  const closeMenu = () => {
    menuOpen.value = false;
  };
  const toggleNotify = () => {
    showNotify.value = !showNotify.value;
  };
  const closeNotify = () => {
    showNotify.value = false;
  };

  /**
   * Reaccion del rail de navegacion primaria: en escritorio alterna la barra (y la abre si se venia de
   * otra seccion); en movil siempre la abre, porque ahi el rail es el unico modo de sacarla.
   */
  const revealSidebarForNav = ({ active } = {}) => {
    if (!isClient) return;
    if (window.innerWidth >= DESKTOP_BREAKPOINT) {
      menuOpen.value = active ? !menuOpen.value : true;
      return;
    }
    menuOpen.value = true;
  };

  return { isClient, menuOpen, showNotify, toggleMenu, closeMenu, toggleNotify, closeNotify, revealSidebarForNav };
}
