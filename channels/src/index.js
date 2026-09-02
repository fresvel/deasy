import { leerConfiguracion } from "./config.js";
import BarridaDeConversaciones from "./dominio/BarridaDeConversaciones.js";
import ServidorDeEstado from "./infra/ServidorDeEstado.js";
import ClienteDeDeasy from "./infra/ClienteDeDeasy.js";
import ClienteDeTelegram from "./infra/ClienteDeTelegram.js";
import CanalTelegram from "./canales/CanalTelegram.js";
import CanalWhatsApp from "./canales/CanalWhatsApp.js";
import { crearClienteDeWhatsApp, dibujarQREnConsola } from "./infra/ClienteDeWhatsApp.js";
import VerificacionDeTelefono from "./dominio/VerificacionDeTelefono.js";

/**
 * El montaje. Aquí y sólo aquí se conocen las piezas concretas: todo lo demás recibe lo que usa.
 *
 * ⚠️ **UNA sola instancia.** El sondeo de Telegram entrega cada mensaje una vez, así que dos
 * procesos se los roban entre ellos y el síntoma es intermitente. Está atado en el compose y dicho
 * en el documento de diseño; escribirlo también aquí es barato comparado con depurarlo.
 */
const arrancar = async () => {
  const config = leerConfiguracion();

  const deasy = new ClienteDeDeasy(config.deasy);
  const politica = new VerificacionDeTelefono(deasy);

  // Cada canal se monta SÓLO si su despliegue lo declara. Un servidor con Telegram y sin WhatsApp es
  // legítimo --y es el de hoy-- y no debe arrastrar un Chromium arrancado para nada.
  const canales = [];
  if (config.telegram) {
    canales.push(new CanalTelegram({ telegram: new ClienteDeTelegram({ token: config.telegram }) }));
  }
  if (config.whatsapp) {
    canales.push(new CanalWhatsApp({
      cliente: crearClienteDeWhatsApp(),
      dibujarQR: dibujarQREnConsola,
      numero: config.whatsapp,
    }));
  }

  for (const canal of canales) {
    // La política es la MISMA para todos: lo que cambia entre canales es cómo prueban el número,
    // y eso vive dentro de cada uno. Ver el contrato de `Canal`.
    canal.alRecibir((mensaje) => politica.procesar(mensaje));
    await canal.iniciar();
    console.log(`[channels] ${canal.nombre}: ${JSON.stringify(await canal.estado())}`);
  }

  // ⚠️ SE LEVANTA DESPUÉS de montar los canales, no antes: si contestara mientras arrancan, diría
  // «caído» de canales que sólo están abriendo, y un falso rojo gasta la confianza igual que un falso
  // verde.
  // ⚠️ LA BARRIDA (LOPDP). Se conserva la conversacion de quien tuvo una interaccion legitima y se
  // borra la de quien no. No es un plazo: un plazo borra por igual lo justificado y lo que no, y
  // esta regla conserva exactamente lo que tiene base legal.
  //
  // ⚠️ SOLO WHATSAPP. Telegram no acumula nada por su cuenta --el sondeo entrega y olvida-- mientras
  // que WhatsApp Web sincroniza y guarda en el perfil de Chromium. La barrida existe por eso.
  //
  // ⚠️ Y CADA SEIS HORAS, no cada minuto: borrar SE SINCRONIZA AL TELEFONO y es irreversible, asi que
  // no hay ninguna prisa por hacerlo seguido. Lo que importa es que se haga, no que se haga pronto.
  const whatsapp = canales.find((c) => c.nombre === "whatsapp");
  if (whatsapp && config.barrida) {
    const barrida = new BarridaDeConversaciones({
      cliente: { getChats: () => whatsapp.conversaciones() },
      deasy,
    });
    const cadaSeisHoras = setInterval(() => {
      barrida.unaPasada().catch((error) => {
        console.error(`[barrida] la pasada fallo: ${error.message}`);
      });
    }, 6 * 60 * 60 * 1000);
    cadaSeisHoras.unref?.();
    console.log("[channels] barrida de conversaciones: cada 6 h");
  } else if (whatsapp) {
    // Se dice que esta apagada, y no se calla: una proteccion que nadie sabe si esta puesta acaba
    // dandose por puesta.
    console.log("[channels] barrida de conversaciones: APAGADA (BARRIDA_CONVERSACIONES != 1)");
  }

  const estado = new ServidorDeEstado({ canales, clave: config.deasy.clave });
  await estado.iniciar();

  const apagar = async (senal) => {
    console.log(`[channels] ${senal}: cerrando canales`);
    await Promise.all(canales.map((c) => c.detener().catch(() => {})));
    process.exit(0);
  };
  process.on("SIGTERM", () => apagar("SIGTERM"));
  process.on("SIGINT", () => apagar("SIGINT"));
};

arrancar().catch((error) => {
  // Se muere a propósito: un servicio de canales que no puede hablar con ninguno no debe quedarse
  // en pie fingiendo que funciona.
  console.error(`[channels] no se pudo arrancar: ${error.message}`);
  process.exit(1);
});
