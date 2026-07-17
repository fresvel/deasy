// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import { useWorkspaceChrome } from "./useWorkspaceChrome.js";

/** jsdom deja window.innerWidth en 1024; se fija por test para cubrir los dos lados del umbral. */
const setViewportWidth = (width) => {
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: width });
};

describe("useWorkspaceChrome", () => {
  beforeEach(() => setViewportWidth(1440));

  describe("estado inicial", () => {
    it("en escritorio la barra viene abierta", () => {
      setViewportWidth(1440);
      expect(useWorkspaceChrome().menuOpen.value).toBe(true);
    });

    it("en movil viene cerrada", () => {
      setViewportWidth(800);
      expect(useWorkspaceChrome().menuOpen.value).toBe(false);
    });

    it("menuOpenByDefault gana sobre el ancho de pantalla", () => {
      // Lo usa procesos, la unica vista que arranca siempre cerrada. Preservado a proposito.
      setViewportWidth(1440);
      expect(useWorkspaceChrome({ menuOpenByDefault: false }).menuOpen.value).toBe(false);
    });

    it("las notificaciones siempre arrancan cerradas", () => {
      expect(useWorkspaceChrome().showNotify.value).toBe(false);
    });

    it("cada vista recibe su propio estado, no uno compartido", () => {
      // Es una factory, no un singleton: dos pantallas no deben pisarse el menu.
      const a = useWorkspaceChrome({ menuOpenByDefault: false });
      const b = useWorkspaceChrome({ menuOpenByDefault: false });
      a.toggleMenu();
      expect(a.menuOpen.value).toBe(true);
      expect(b.menuOpen.value).toBe(false);
    });
  });

  describe("menu y notificaciones", () => {
    it("toggleMenu alterna; closeMenu cierra siempre", () => {
      const { menuOpen, toggleMenu, closeMenu } = useWorkspaceChrome({ menuOpenByDefault: false });
      toggleMenu();
      expect(menuOpen.value).toBe(true);
      toggleMenu();
      expect(menuOpen.value).toBe(false);
      toggleMenu();
      closeMenu();
      expect(menuOpen.value).toBe(false);
      closeMenu();
      expect(menuOpen.value).toBe(false);
    });

    it("toggleNotify alterna; closeNotify cierra siempre", () => {
      const { showNotify, toggleNotify, closeNotify } = useWorkspaceChrome();
      toggleNotify();
      expect(showNotify.value).toBe(true);
      closeNotify();
      expect(showNotify.value).toBe(false);
    });

    it("el menu y las notificaciones son independientes", () => {
      const { menuOpen, showNotify, toggleMenu } = useWorkspaceChrome({ menuOpenByDefault: false });
      toggleMenu();
      expect(showNotify.value).toBe(false);
      expect(menuOpen.value).toBe(true);
    });
  });

  describe("revealSidebarForNav: el numero magico 1280, ahora en un solo sitio", () => {
    it("en escritorio, pulsar la seccion ACTIVA alterna la barra", () => {
      setViewportWidth(1280); // justo en el umbral: cuenta como escritorio
      const { menuOpen, revealSidebarForNav } = useWorkspaceChrome({ menuOpenByDefault: false });
      revealSidebarForNav({ active: true });
      expect(menuOpen.value).toBe(true);
      revealSidebarForNav({ active: true });
      expect(menuOpen.value).toBe(false);
    });

    it("en escritorio, ir a OTRA seccion siempre abre la barra (nunca la cierra)", () => {
      const { menuOpen, revealSidebarForNav } = useWorkspaceChrome({ menuOpenByDefault: false });
      revealSidebarForNav({ active: false });
      expect(menuOpen.value).toBe(true);
      revealSidebarForNav({ active: false });
      expect(menuOpen.value).toBe(true);
    });

    it("en movil siempre abre, aunque sea la seccion activa", () => {
      // Debajo del umbral el rail es el unico modo de sacar la barra: alternarla la dejaria inalcanzable.
      setViewportWidth(1279);
      const { menuOpen, revealSidebarForNav } = useWorkspaceChrome({ menuOpenByDefault: false });
      revealSidebarForNav({ active: true });
      expect(menuOpen.value).toBe(true);
      revealSidebarForNav({ active: true });
      expect(menuOpen.value).toBe(true);
    });

    it("sin argumentos no revienta y se comporta como 'otra seccion'", () => {
      const { menuOpen, revealSidebarForNav } = useWorkspaceChrome({ menuOpenByDefault: false });
      expect(() => revealSidebarForNav()).not.toThrow();
      expect(menuOpen.value).toBe(true);
    });
  });
});
