// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from "vitest";
import { shallowMount } from "@vue/test-utils";

// ⚠️ SE MONTA EN SUPERFICIE (`shallowMount`) A PROPÓSITO. Lo que se protege aquí es la COMPOSICIÓN
// de la pantalla --qué piezas hay y cuántas--, no lo que cada pieza pinta por dentro. Montarla
// entera obligaría a simular el catálogo de países, la institución y el enrutador, y la prueba se
// rompería por motivos que no tienen nada que ver con lo que vigila.
vi.mock("@/modules/auth/services/AuthService", () => ({
  default: {
    listarPaises: vi.fn().mockResolvedValue([]),
    institucion: vi.fn().mockResolvedValue({}),
    clearSession: vi.fn(),
  },
}));
vi.mock("vue-router", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useRoute: () => ({ query: {} }),
}));

import RegisterView from "./RegisterView.vue";
import PasosDelRegistro from "@/modules/auth/components/PasosDelRegistro.vue";
import AuthLayout from "@/layouts/auth/AuthLayout.vue";

// ⚠️ `AuthLayout` NO SE SIMULA, y hace falta decir por qué: un componente simulado NO PINTA SU
// SLOT, y toda esta pantalla vive dentro del suyo. Con él simulado no se renderizaba nada y la
// prueba de «no hay ningún botón suelto» PASABA POR EL MOTIVO EQUIVOCADO --no había ningún botón
// porque no había nada--. Se deja vivo el andamiaje y se simula lo de dentro.
const montar = () => shallowMount(RegisterView, { global: { stubs: { AuthLayout: false } } });

describe("RegisterView · la cabecera es la MISMA que la de los otros dos pasos", () => {
  beforeEach(() => vi.clearAllMocks());

  it("enseña el indicador de pasos, y marcando el PRIMERO", async () => {
    // Faltaba: se veía «1 de 3» a partir del segundo paso y no en el primero — justo al revés de
    // cuando hace falta, que es al empezar.
    const paso = montar().findComponent(PasosDelRegistro);

    expect(paso.exists()).toBe(true);
    expect(paso.props("paso")).toBe("datos");
  });

  it("usa el andamiaje compartido en vez de repetirlo a mano", async () => {
    // Aquí se reescribían los tres niveles del layout (`deasy-auth-page` > centrado > tarjeta), que
    // es justo lo que `AuthLayout` existe para no duplicar.
    const layout = montar().findComponent(AuthLayout);

    expect(layout.exists()).toBe(true);
    expect(layout.props("align")).toBe("start"); // el formulario es alto: centrado se sale de pantalla
  });
});

describe("RegisterView · una sola salida, no dos", () => {
  beforeEach(() => vi.clearAllMocks());

  it("la cabecera no lleva ningún botón", () => {
    // «Volver al login» era un `<button>` escrito a mano --sin `AppButton`-- en la banda del título,
    // y hacía EXACTAMENTE lo mismo que «Cancelar»: llamar a `volverAlAcceso`. Dos mandos para una
    // acción, y uno de ellos fuera del sistema de botones.
    //
    // ⚠️ Se mira DENTRO DE `<header>`, no en toda la pantalla: los ojos de «mostrar contraseña» son
    // `<button>` de verdad y legítimos. Una aserción global los habría contado y habría obligado a
    // relajarla hasta no vigilar nada.
    const cabecera = montar().find("header");

    expect(cabecera.exists()).toBe(true);
    expect(cabecera.findAll("button")).toHaveLength(0);
    expect(cabecera.text()).not.toContain("Volver al login");
  });

  it("«Cancelar» es NEUTRO: en esta pantalla no hay nada que destruir", () => {
    // La cuenta todavía no existe. El rojo del sistema es para lo que destruye algo, y en los pasos
    // 2 y 3 el equivalente («Salir») es neutro.
    const variantes = montar()
      .findAllComponents({ name: "AppButton" })
      .map((b) => b.props("variant"));

    expect(variantes).not.toContain("danger-outline");
    expect(variantes).toContain("neutral-outline");
  });
});
