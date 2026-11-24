<template>
  <!-- LAS VIDAS DE UN NODO (frente 27, D-03). Arriba va la vida en curso, o el formulario para abrir
       una; abajo, las anteriores. Sin ninguna vida el nodo es un borrador. La misma pieza sirve al
       mapa de procesos y al organigrama: lo que cambia es el `sujeto` con que se nombra al nodo. -->
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between gap-2">
      <p class="deasy-overline">{{ vigencia.tituloDeLaVida.value }}</p>
      <AppTag :variant="tonoVigencia(estado)" outlined>{{ etiquetaVigencia(estado) }}</AppTag>
    </div>

    <!-- A QUIÉN SUCEDE (frente 27, D-05): varios antecesores son una fusión. Sólo se lee: la
         equivalencia se registra desde el que termina. -->
    <p v-if="vigencia.antecesores.value.length" class="m-0 text-sm text-icon">
      Sucede a
      <template v-for="(antecesor, i) in vigencia.antecesores.value" :key="antecesor.id">
        <span v-if="i">{{ i === vigencia.antecesores.value.length - 1 ? " y a " : ", a " }}</span>
        <strong class="text-strong">{{ antecesor.nombre }}</strong> (desde el {{ antecesor.desde }})</template>.
    </p>

    <!-- La última vida terminó: se puede abrir otra, pero no sin pedirlo. -->
    <div v-if="vigencia.vidaModo.value === 'cerrada'" class="flex flex-col items-start gap-3">
      <p class="m-0 text-sm text-icon">{{ sujeto }} sin vida en curso. Reactivar abre una vida nueva; la anterior queda en su historia. Lo que se cerró al suprimir no vuelve solo: hay que asignarlo otra vez.</p>
      <div v-if="editable" class="flex flex-wrap items-center gap-2">
        <AppButton variant="primary-outline" @click="$emit('reactivar')">Reactivar</AppButton>
        <!-- Otra cosa distinta: decir que el fin estaba MAL registrado. Sólo para quien puede corregir. -->
        <AppButton v-if="vigencia.puedeCorregir && vigencia.sePuedeCorregirElFin.value" variant="neutral-outline" @click="vigencia.empezarCorreccionDelFin()">Corregir la fecha del fin</AppButton>
      </div>
    </div>

    <div v-else class="flex flex-col gap-3">
      <div class="grid grid-cols-2 gap-3">
        <label class="deasy-form-label">
          Rige desde
          <input v-model="form.vigente_desde" type="date" class="deasy-control" :disabled="!editable" />
        </label>
        <label class="deasy-form-label">
          Origen del inicio
          <select v-model="form.inicio_origen" class="deasy-control deasy-control--select" :disabled="!editable">
            <option value="">—</option>
            <option value="carga_inicial">Carga inicial</option>
            <option value="reorganizacion">Reorganización</option>
            <option v-if="vigencia.puedeCorregir" value="correccion">Corrección</option>
          </select>
        </label>
      </div>
      <label v-if="form.inicio_origen === 'reorganizacion'" class="deasy-form-label">
        Acto que lo ordena
        <select v-model="form.inicio_acto_id" class="deasy-control deasy-control--select" :disabled="!editable">
          <option value="">— Elige un acto —</option>
          <option v-for="acto in vigencia.actoOptions.value" :key="acto.id" :value="String(acto.id)">{{ acto.etiqueta }}</option>
        </select>
      </label>
      <!-- El fin sólo se ofrece sobre una vida que ya existe: una vida nueva se abre, no nace cerrada. -->
      <template v-if="vigencia.vidaModo.value === 'editar'">
        <div class="grid grid-cols-2 gap-3">
          <label class="deasy-form-label">
            Rige hasta
            <input v-model="form.vigente_hasta" type="date" class="deasy-control" :disabled="!editable" :max="vigencia.corrigiendoElFin.value ? vigencia.hoy() : undefined" />
          </label>
          <label class="deasy-form-label">
            Origen del fin
            <select v-model="form.fin_origen" class="deasy-control deasy-control--select" :disabled="!editable || !form.vigente_hasta">
              <option value="">—</option>
              <option value="carga_inicial">Carga inicial</option>
              <option value="reorganizacion">Reorganización</option>
              <option v-if="vigencia.puedeCorregir" value="correccion">Corrección</option>
            </select>
          </label>
        </div>
        <label v-if="form.fin_origen === 'reorganizacion'" class="deasy-form-label">
          Acto que lo suprime
          <select v-model="form.fin_acto_id" class="deasy-control deasy-control--select" :disabled="!editable">
            <option value="">— Elige un acto —</option>
            <option v-for="acto in vigencia.actoOptions.value" :key="acto.id" :value="String(acto.id)">{{ acto.etiqueta }}</option>
          </select>
        </label>
        <p class="m-0 text-theme-xs text-muted">«Rige hasta» es el primer día en que ya no rige.</p>
        <p v-if="vigencia.corrigiendoElFin.value" class="m-0 text-theme-xs text-muted">
          Aquí sólo se corrige la fecha, y a otra que ya haya ocurrido. Un fin pasado no se quita: para que vuelva a regir, cancela y reactiva.
        </p>
        <!-- SUPRIMIR, Y LO QUE ARRASTRA: se dice ANTES, que es cuando se puede evitar. -->
        <!-- CON HIJOS NO SE SUPRIME (decisión del dueño, 2026-11-24): hay que decir antes adónde van. -->
        <AppAlert v-if="vigencia.suprime.value && vigencia.efectosQueSeQuedan.value.length" variant="danger">
          No se puede suprimir todavía: hay <strong>{{ fraseDeEfectos(vigencia.efectosQueSeQuedan.value) }}</strong>.
          Hay que resolverlo antes, y puede ser con esta misma fecha: lo que depende de este nodo se mueve a otro padre o se suprime, y sus puestos se suprimen.
        </AppAlert>
        <!-- Los puestos se pueden suprimir de una vez, con la fecha y el origen que ya están escritos
             arriba. Lo hace quien usa el panel —la unidad—, que es quien sabe de puestos. -->
        <div v-if="editable && puestosQueImpiden" class="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5">
          <p class="m-0 text-theme-xs text-muted">
            {{ form.fin_origen ? "Se pueden suprimir todos de una vez, con esta fecha y este origen." : "Elige el origen del fin para poder suprimirlos de una vez." }}
          </p>
          <AppButton variant="danger-outline" :disabled="!form.fin_origen || (form.fin_origen === 'reorganizacion' && !form.fin_acto_id)" @click="$emit('suprimir-puestos')">
            Suprimir sus {{ puestosQueImpiden }} {{ puestosQueImpiden === 1 ? "puesto" : "puestos" }}
          </AppButton>
        </div>
        <template v-else>
          <AppAlert v-if="vigencia.suprimeMasAdelante.value" variant="info">
            Dejará de regir el {{ form.vigente_hasta }}. Hasta ese día no se cierra nada, y la fecha se puede cambiar o quitar.
          </AppAlert>
          <div v-if="vigencia.suprimeYa.value" class="flex flex-col gap-2">
            <AppAlert variant="warning">
              <template v-if="vigencia.efectosQueSeCierran.value.length">
                Al guardar se {{ cuantos(vigencia.efectosQueSeCierran.value) === 1 ? "cerrará" : "cerrarán" }}
                <strong>{{ fraseDeEfectos(vigencia.efectosQueSeCierran.value) }}</strong>.
                No se recuperan al reactivar, y un fin que ya ocurrió no se puede quitar.
              </template>
              <template v-else>
                Suprimir rige desde hoy, y un fin que ya ocurrió no se puede quitar: para que vuelva a regir habrá que reactivarlo.
              </template>
            </AppAlert>
            <label class="flex items-center gap-2 text-sm text-strong">
              <input v-model="form.confirmaSupresion" type="checkbox" :disabled="!editable" />
              Entiendo que no se puede deshacer
            </label>
          </div>
        </template>
        <!-- Una vida que aún no ha empezado se puede descartar entera; una que ya rige, no: se le pone fin. -->
        <div v-if="editable && vigencia.sePuedeDescartar.value" class="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5">
          <p class="m-0 text-theme-xs text-muted">Esta vida todavía no ha empezado. Si no va a ocurrir, se puede descartar.</p>
          <AppButton variant="danger-outline" @click="$emit('descartar')">Descartar</AppButton>
        </div>
      </template>
    </div>

    <!-- QUÉ SUCEDE A LO QUE TERMINA (frente 27, D-05). Cuelga de la vida que tiene fecha de fin, y
         se registra en el acto: no espera al «Guardar» del formulario. -->
    <div v-if="vigencia.vidaQueTermina.value" class="flex flex-col gap-2">
      <p class="deasy-overline m-0">Sucesores</p>
      <p class="m-0 text-theme-xs text-muted">
        Quién continúa lo que termina el {{ vigencia.vidaQueTermina.value.vigente_hasta }}. Con varios sucesores es una división; si otro nodo que termina tiene el mismo, una fusión.
      </p>
      <ul v-if="vigencia.sucesores.value.length" class="m-0 flex list-none flex-col gap-2 p-0">
        <li v-for="sucesor in vigencia.sucesores.value" :key="sucesor.id" class="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2">
          <span class="text-sm font-semibold text-strong">{{ sucesor.nombre }}</span>
          <AppButton v-if="editable" variant="danger-outline" :disabled="ocupado" @click="quitar(sucesor)">Quitar</AppButton>
        </li>
      </ul>
      <p v-else class="m-0 text-sm text-icon">Sin sucesores registrados.</p>
      <div v-if="editable" class="flex items-end gap-2">
        <label class="deasy-form-label min-w-0 flex-1">
          Añadir un sucesor
          <select v-model="elegido" class="deasy-control deasy-control--select" :disabled="ocupado">
            <option value="">— Elige —</option>
            <option v-for="candidato in candidatosLibres" :key="candidato.id" :value="String(candidato.id)">{{ candidato.etiqueta }}</option>
          </select>
        </label>
        <AppButton variant="primary-outline" :disabled="!elegido || ocupado" @click="anadir">Añadir</AppButton>
      </div>
      <AppAlert v-if="errorDeSucesores" variant="danger">{{ errorDeSucesores }}</AppAlert>
    </div>

    <!-- UNA CORRECCIÓN PIDE SU MOTIVO. Aparece sola cuando lo que se va a guardar lo es: un origen
         «corrección», o cambiar una fecha —de inicio o de fin— que ya ocurrió. -->
    <div v-if="vigencia.vidaModo.value !== 'cerrada' && vigencia.esCorreccion.value" class="flex flex-col gap-2">
      <AppAlert v-if="!vigencia.puedeCorregir" variant="warning">
        Cambiar una fecha que ya ocurrió es una corrección, y registrar correcciones pide un permiso aparte que no tienes.
      </AppAlert>
      <label v-else class="deasy-form-label">
        Motivo de la corrección
        <textarea v-model="form.motivo" rows="2" class="deasy-control" placeholder="Qué estaba mal registrado y por qué"></textarea>
        <span class="text-theme-xs font-normal text-muted">Queda en la bitácora de correcciones, con lo que decía antes y lo que dice ahora.</span>
      </label>
    </div>

    <div v-if="vigencia.vidasAnteriores.value.length">
      <p class="deasy-overline mb-2">Vidas anteriores</p>
      <ul class="m-0 flex list-none flex-col gap-2 p-0">
        <li v-for="vida in vigencia.vidasAnteriores.value" :key="vida.id" class="rounded-xl border border-line px-3 py-2.5">
          <div class="flex items-center gap-2">
            <span class="text-sm font-semibold text-strong">{{ vida.vigente_desde }} → {{ vida.vigente_hasta || "sin fecha de fin" }}</span>
            <AppTag :variant="tonoVigencia(vida.estado)" outlined class-name="ml-auto">{{ etiquetaVigencia(vida.estado) }}</AppTag>
          </div>
          <p class="m-0 mt-1 text-theme-xs text-muted">
            Inicio: {{ etiquetaOrigen(vida.inicio_origen) }}<span v-if="vida.inicio_acto_numero"> · {{ vida.inicio_acto_numero }}</span>
            <template v-if="vida.vigente_hasta">
              · Fin: {{ etiquetaOrigen(vida.fin_origen) }}<span v-if="vida.fin_acto_numero"> · {{ vida.fin_acto_numero }}</span>
            </template>
          </p>
          <p v-if="vida.sucesores?.length" class="m-0 mt-1 text-theme-xs text-muted">
            Sucesores: {{ vida.sucesores.map((s) => s.nombre).join(", ") }}
          </p>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import AppAlert from "@/shared/components/feedback/AppAlert.vue";
import AppButton from "@/shared/components/buttons/AppButton.vue";
import AppTag from "@/shared/components/data/AppTag.vue";
import { tonoVigencia, etiquetaVigencia } from "@/shared/utils/estadoTono.js";
import { etiquetaOrigen, fraseDeEfectos } from "@/modules/admin/composables/estructura/useNodeVigencia.js";

/* Cuántos puestos impiden suprimir, si alguno: sólo lo trae la unidad. */
const puestosQueImpiden = computed(() => {
  if (!props.vigencia.suprime.value) return 0;
  return props.vigencia.efectosQueSeQuedan.value.find((e) => e.clave === "puestos")?.n || 0;
});
const cuantos = (efectos) => efectos.reduce((suma, e) => suma + e.n, 0);

const props = defineProps({
  /* Lo que devuelve `useNodeVigencia`. Se pasa entero: la pestaña es la cara de ese estado. */
  vigencia: { type: Object, required: true },
  /* El estado del nodo hoy: borrador, programado, vigente o suprimido. */
  estado: { type: String, default: "borrador" },
  /* Cómo se nombra al nodo en la frase de reactivar: «Proceso», «Unidad»… */
  sujeto: { type: String, default: "Nodo" },
  editable: { type: Boolean, default: false },
  /* Entre quiénes se elige un sucesor: [{ id, etiqueta }], de la misma clase que el nodo. */
  candidatos: { type: Array, default: () => [] }
});
defineEmits(["reactivar", "descartar", "suprimir-puestos"]);

/* LOS SUCESORES se registran y se quitan aquí mismo, uno a uno. Lo que la base rechace —que el
   elegido no rija ese día, que esté en borrador— se enseña junto al control, no arriba del modal. */
const elegido = ref("");
const ocupado = ref(false);
const errorDeSucesores = ref("");
const candidatosLibres = computed(() => {
  const yaEstan = new Set(props.vigencia.sucesores.value.map((s) => String(s.nodo_id)));
  const elMismo = String(props.vigencia.nodoId.value ?? "");
  return props.candidatos.filter((c) => String(c.id) !== elMismo && !yaEstan.has(String(c.id)));
});
const conAviso = async (trabajo, alFallar) => {
  ocupado.value = true;
  errorDeSucesores.value = "";
  try {
    await trabajo();
  } catch (e) {
    errorDeSucesores.value = e?.response?.data?.message || alFallar;
  } finally {
    ocupado.value = false;
  }
};
const anadir = () => conAviso(async () => {
  const candidato = props.candidatos.find((c) => String(c.id) === elegido.value);
  if (!candidato) return;
  await props.vigencia.anadirSucesor(candidato);
  elegido.value = "";
}, "No se pudo registrar el sucesor.");
const quitar = (sucesor) => conAviso(() => props.vigencia.quitarSucesor(sucesor.id), "No se pudo quitar el sucesor.");
/* Al pasar a otro nodo, o a otra vida, no se arrastra ni la elección ni el aviso del anterior. */
watch(() => props.vigencia.vidaQueTermina.value?.id, () => {
  elegido.value = "";
  errorDeSucesores.value = "";
});

/* El formulario vive en el composable; aquí sólo se le da un nombre corto para la plantilla. */
const form = computed(() => props.vigencia.vidaForm.value);
</script>
