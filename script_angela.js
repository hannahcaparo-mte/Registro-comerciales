/* =========================================================
   REGISTRO COMERCIAL · NATALIA
   ========================================================= */

const COMERCIAL = "Angela";

/* =========================================================
   🔌 CONFIGURACIÓN GOOGLE SHEETS
   ========================================================= */

const SHEETS_WEBAPP_URL = "https://script.google.com/a/macros/mte.com.pe/s/AKfycbx-fk7WOoUC3T2DXAkNmSMllVvP72HFsYmcVIokVijrSm7wZA6J6Z4Yig8nEHl8vnXNCw/exec";

const STORAGE_KEY = "registroAngela_v3";

const METAS_POR_DIA = {
  0: 0,   // Domingo
  1: 50,  // Lunes
  2: 50,  // Martes
  3: 50,  // Miércoles
  4: 50,  // Jueves
  5: 50,  // Viernes
  6: 25,  // Sábado
};

const callState = {
  contacto: "",
  fecha: "",
  horaInicio: "",
  horaRespondio: null,
  horaFin: "",
  duracionSeg: 0,
  contesto: false,
  motivo: "",
  volverLlamar: false,
  fechaProxContacto: "",
  horaProxContacto: "",
  interes: "",
  calidadLead: "",
  llamarLuego: false,
  programa: "",
  carrera: "",
  provincia: "",
  edad: "",
  motivoNoInteres: "",
  observacion: "",
  nombre: "",
  razonNuevaLlamada: "",
};

let timerInterval = null;
let timerStart = 0;

let historial = [];

/* =========================================================
   PERSISTENCIA LOCAL + REINICIO DIARIO
   ========================================================= */
function guardarLocal() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ fecha: nowDate(), registros: historial })
    );
  } catch (e) {
    console.warn("No se pudo guardar localmente:", e);
  }
}

function cargarLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const data = JSON.parse(raw);
    const hoy = nowDate();

    if (data.fecha === hoy && Array.isArray(data.registros)) {
      historial = data.registros;
    } else {
      historial = [];
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ fecha: hoy, registros: [] })
      );
    }
  } catch (e) {
    console.warn("No se pudo cargar el historial local:", e);
    historial = [];
  }
}

function chequearCambioDeDia() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const guardadoFecha = raw ? JSON.parse(raw).fecha : null;
    const hoy = nowDate();
    if (guardadoFecha && guardadoFecha !== hoy) {
      historial = [];
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ fecha: hoy, registros: [] })
      );
      renderHistorial();
      updateGoalTracker();
      showToast("Nuevo día: historial reiniciado (backup en la hoja)");
    }
  } catch (e) {
    console.warn(e);
  }
}

setInterval(chequearCambioDeDia, 60 * 1000);

/* =========================================================
   RELOJ + META DIARIA
   ========================================================= */
function getMetaDelDia() {
  const d = new Date().getDay();
  return METAS_POR_DIA[d] || 50;
}

function updateClock() {
  const now = new Date();

  const fecha = now.toLocaleDateString("es-PE", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  document.getElementById("currentDate").textContent =
    fecha.charAt(0).toUpperCase() + fecha.slice(1);

  const hora = now.toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  document.getElementById("currentTime").textContent = hora;
}
updateClock();
setInterval(updateClock, 1000);

function updateGoalTracker() {
  const today = nowDate();
  const llamadasHoy = historial.filter((r) => r.fecha === today).length;
  const meta = getMetaDelDia();

  document.getElementById("goalCurrent").textContent = llamadasHoy;
  document.getElementById("goalTotal").textContent = meta;

  const pct = meta > 0 ? Math.min(100, (llamadasHoy / meta) * 100) : 0;
  document.getElementById("goalBarFill").style.width = pct + "%";

  const tracker = document.getElementById("goalTracker");
  tracker.classList.toggle("complete", llamadasHoy >= meta && meta > 0);
}
updateGoalTracker();

/* =========================================================
   PESTAÑAS
   ========================================================= */
const tabs = document.querySelectorAll(".tab");
const panels = document.querySelectorAll(".tab-panel");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.tab;
    tabs.forEach((t) => t.classList.toggle("active", t === tab));
    panels.forEach((p) =>
      p.classList.toggle("active", p.id === `panel-${target}`)
    );
    if (target === "reminders") {
      renderRecordatorios();      // instantáneo, con lo que ya hay
      cargarProgramadasHoy();     // luego refresca con la hoja
    }
  });
});

/* =========================================================
   STAGES
   ========================================================= */
const stages = {
  start:   document.getElementById("stage-start"),
  calling: document.getElementById("stage-calling"),
};

function showStage(name) {
  Object.entries(stages).forEach(([key, el]) => {
    el.classList.toggle("hidden", key !== name);
  });
}

/* =========================================================
   UTILIDADES
   ========================================================= */
function nowTime() {
  return new Date().toTimeString().slice(0, 8);
}
function nowDate() {
  var d = new Date();
  var y = d.getFullYear();
  var m = ("0" + (d.getMonth() + 1)).slice(-2);
  var dia = ("0" + d.getDate()).slice(-2);
  return y + "-" + m + "-" + dia;
}
function formatDuration(seg) {
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  const s = seg % 60;
  if (h > 0)
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function startTimer() {
  timerStart = Date.now();
  callState.duracionSeg = 0;
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const seg = Math.floor((Date.now() - timerStart) / 1000);
    callState.duracionSeg = seg;
    document.getElementById("timer").textContent = formatDuration(seg);
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function showToast(msg, error = false) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.toggle("error", error);
  setTimeout(() => t.classList.add("show"), 10);
  setTimeout(() => t.classList.remove("show"), 2600);
}

function resetCallState() {
  Object.assign(callState, {
    contacto: "",
    fecha: "",
    horaInicio: "",
    horaRespondio: null,
    horaFin: "",
    duracionSeg: 0,
    contesto: false,
    motivo: "",
    volverLlamar: false,
    fechaProxContacto: "",
    horaProxContacto: "",
    interes: "",
    calidadLead: "",
    llamarLuego: false,
    programa: "",
    carrera: "",
    provincia: "",
    edad: "",
    motivoNoInteres: "",
    observacion: "",
    nombre: "",
    razonNuevaLlamada: "",
  });

  document.getElementById("inputContacto").value = "";
  document.getElementById("inputContacto").classList.remove("invalid");
  document.getElementById("contactoHint").textContent = "Solo 9 dígitos numéricos";
  document.getElementById("contactoHint").classList.remove("error");
  document.getElementById("btnIniciar").disabled = true;

  document.getElementById("volverLlamar").checked = true;
  document.getElementById("proxContactoNo").value = "";
  document.getElementById("proxHoraNoH").value = "";
  document.getElementById("proxHoraNoM").value = "00";
  document.getElementById("proxHoraNoAP").value = "PM";
  document.getElementById("llamarLuego").checked = false;
  document.getElementById("proxContactoYes").value = "";
  document.getElementById("proxHoraYesH").value = "";
  document.getElementById("proxHoraYesM").value = "00";
  document.getElementById("proxHoraYesAP").value = "PM";
  document.getElementById("programa").value = "";
  document.getElementById("carrera").value = "";
  document.getElementById("motivoNoInteres").value = "";
  document.getElementById("motivoNoInteresOtros").value = "";
  document.getElementById("motivoOtrosWrap").classList.add("hidden");
  document.getElementById("Nota").value = "";
  const _nr = document.getElementById("nombreRef");
  if (_nr) _nr.value = "";

  // Razón de nueva llamada: limpiar y ocultar
  const _rn = document.getElementById("razonNuevaLlamada");
  const _ro = document.getElementById("razonNuevaLlamadaOtros");
  if (_rn) _rn.value = "";
  if (_ro) _ro.value = "";
  document.getElementById("razonLlamadaWrap").classList.add("hidden");
  document.getElementById("razonOtrosWrap").classList.add("hidden");
  document.getElementById("razonReqMark").classList.add("hidden");

  document.querySelectorAll(".chip.selected").forEach((c) =>
    c.classList.remove("selected")
  );

  document.getElementById("callingActions1").classList.remove("hidden");
  document.getElementById("callingActions2").classList.add("hidden");
  document.getElementById("closingBlockYes").classList.add("hidden");
  document.getElementById("closingBlockNo").classList.add("hidden");


  document.getElementById("timer").textContent = "00:00";
  document.getElementById("timerWrap1").classList.remove("active", "ended");
  document.getElementById("timerStatus").textContent = "Marcando…";

  document.getElementById("stageTag").textContent = "En curso";
  document.getElementById("stageTag").classList.remove("live");
  document.getElementById("stageTag").classList.add("pulse");
  document.getElementById("callingSub").textContent = "Esperando respuesta…";

  document.getElementById("liveForm").classList.remove("hidden");
  document.getElementById("noAnswerPanel").classList.add("hidden");
  document.getElementById("volverLlamarFields").classList.remove("disabled");
}

/* =========================================================
   VALIDACIÓN INPUT 9 DÍGITOS
   ========================================================= */
const inputContacto = document.getElementById("inputContacto");
const btnIniciar = document.getElementById("btnIniciar");
const contactoHint = document.getElementById("contactoHint");

inputContacto.addEventListener("input", (e) => {
  // Solo permite dígitos
  const filtered = e.target.value.replace(/\D/g, "").slice(0, 9);
  if (filtered !== e.target.value) {
    e.target.value = filtered;
  }

  const len = filtered.length;
  if (len === 0) {
    contactoHint.textContent = "Solo 9 dígitos numéricos";
    contactoHint.classList.remove("error");
    inputContacto.classList.remove("invalid");
    btnIniciar.disabled = true;
  } else if (len < 9) {
    contactoHint.textContent = `Faltan ${9 - len} dígito${9 - len === 1 ? "" : "s"}`;
    contactoHint.classList.add("error");
    inputContacto.classList.add("invalid");
    btnIniciar.disabled = true;
  } else {
    contactoHint.textContent = "✓ Número válido";
    contactoHint.classList.remove("error");
    inputContacto.classList.remove("invalid");
    btnIniciar.disabled = false;
  }
});

inputContacto.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !btnIniciar.disabled) {
    e.preventDefault();
    btnIniciar.click();
  }
});

/* =========================================================
   FLUJO: INICIAR LLAMADA
   ========================================================= */
btnIniciar.addEventListener("click", () => {
  const contacto = inputContacto.value.trim();
  if (!/^\d{9}$/.test(contacto)) {
    showToast("Ingresa 9 dígitos válidos", true);
    return;
  }

  callState.contacto = contacto;
  callState.fecha = nowDate();
  callState.horaInicio = nowTime();

  document.getElementById("dispContacto").textContent = contacto;
  document.getElementById("dispHoraInicio").textContent = callState.horaInicio;

  startTimer();
  showStage("calling");
});

/* =========================================================
   ESCENARIO 1: NO CONTESTÓ
   ========================================================= */
document.getElementById("btnNoContesto").addEventListener("click", () => {
  stopTimer();
  callState.horaFin = nowTime();
  callState.contesto = false;

  const stageTag = document.getElementById("stageTag");
  stageTag.textContent = "Sin respuesta";
  stageTag.classList.remove("pulse");
  document.getElementById("callingSub").textContent =
    "Indica el motivo y agrega seguimiento.";

  document.getElementById("timerWrap1").classList.add("ended");
  document.getElementById("timerStatus").textContent =
    `Finalizó · ${callState.horaFin} · Duración ${formatDuration(callState.duracionSeg)}`;


  document.getElementById("callingActions1").classList.add("hidden");
  document.getElementById("closingBlockNo").classList.remove("hidden");


  document.getElementById("liveForm").classList.add("hidden");
  document.getElementById("noAnswerPanel").classList.remove("hidden");

  // Actualizar marcador de obligatoriedad de razón
  if (typeof actualizarObligatoriedadRazon === "function") {
    actualizarObligatoriedadRazon();
  }
});

/* =========================================================
   ESCENARIO 2: RESPONDIÓ
   ========================================================= */
document.getElementById("btnRespondio").addEventListener("click", () => {
  callState.horaRespondio = nowTime();
  callState.contesto = true;


  const stageTag = document.getElementById("stageTag");
  stageTag.textContent = "● En conversación";
  stageTag.classList.remove("pulse");
  stageTag.classList.add("live");
  document.getElementById("callingSub").textContent =
    `Respondió a las ${callState.horaRespondio}. Llena el formulario mientras hablas.`;


  document.getElementById("timerWrap1").classList.add("active");
  document.getElementById("timerStatus").textContent = "En conversación";


  document.getElementById("callingActions1").classList.add("hidden");
  document.getElementById("callingActions2").classList.remove("hidden");

  // Actualizar marcador de obligatoriedad de razón (ahora contestó = Sí)
  if (typeof actualizarObligatoriedadRazon === "function") {
    actualizarObligatoriedadRazon();
  }
});


document.getElementById("btnTerminar").addEventListener("click", () => {
  stopTimer();
  callState.horaFin = nowTime();


  document.getElementById("callingActions2").classList.add("hidden");
  document.getElementById("closingBlockYes").classList.remove("hidden");


  document.getElementById("timerWrap1").classList.remove("active");
  document.getElementById("timerWrap1").classList.add("ended");
  document.getElementById("timerStatus").textContent =
    `Finalizó · ${callState.horaFin} · Duración ${formatDuration(callState.duracionSeg)}`;

  document.getElementById("callingSub").textContent =
    "Selecciona el motivo de cierre y completa la información.";
});

/* =========================================================
   CHIPS
   ========================================================= */
function setupChipGroup(groupId, onSelect) {
  const group = document.getElementById(groupId);
  if (!group) return;
  group.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      group.querySelectorAll(".chip").forEach((c) =>
        c.classList.remove("selected")
      );
      chip.classList.add("selected");
      onSelect(chip.dataset.value);
    });
  });
}

setupChipGroup("motivoNoGroup", (val) => { callState.motivo = val; });
setupChipGroup("motivoYesGroup", (val) => { callState.motivo = val; });
setupChipGroup("interesGroup", (val) => { callState.interes = val; });
setupChipGroup("calidadGroup", (val) => { callState.calidadLead = val; });
setupChipGroup("provinciaGroup", (val) => { callState.provincia = val; });
setupChipGroup("edadGroup", (val) => { callState.edad = val; });

/* =========================================================
   MOTIVO DE NO INTERÉS 
   ========================================================= */
const motivoNoInteresSel = document.getElementById("motivoNoInteres");
const motivoOtrosWrap = document.getElementById("motivoOtrosWrap");
motivoNoInteresSel.addEventListener("change", () => {
  if (motivoNoInteresSel.value === "Otros") {
    motivoOtrosWrap.classList.remove("hidden");
    document.getElementById("motivoNoInteresOtros").focus();
  } else {
    motivoOtrosWrap.classList.add("hidden");
    document.getElementById("motivoNoInteresOtros").value = "";
  }
});

/* =========================================================
   RAZÓN DE NUEVA LLAMADA — se muestra cuando se marca
   "llamar luego = Sí" y se guarda con la llamada actual.
   Cuando hay recordatorio, esta razón se mostrará al día
   siguiente en la pestaña 03 como referencia.
   ========================================================= */
const razonNuevaLlamadaSel = document.getElementById("razonNuevaLlamada");
const razonOtrosWrap = document.getElementById("razonOtrosWrap");
if (razonNuevaLlamadaSel) {
  razonNuevaLlamadaSel.addEventListener("change", () => {
    if (razonNuevaLlamadaSel.value === "Otros") {
      razonOtrosWrap.classList.remove("hidden");
      document.getElementById("razonNuevaLlamadaOtros").focus();
    } else {
      razonOtrosWrap.classList.add("hidden");
      document.getElementById("razonNuevaLlamadaOtros").value = "";
    }
  });
}

/* =========================================================
   TOGGLE "Llamar luego" -> mostrar/ocultar bloque de razón
   ---------------------------------------------------------
   - Si llamarLuego = Sí: razón = por qué se va a volver a
     llamar (no contestó, colgó, pidió que lo llamen, etc.)
   - Si llamarLuego = No: razón = por qué no se hará seguimiento
     (sin interés, petición de no llamar, ya llamado muchas
     veces, etc.)
   La razón es obligatoria solo cuando contestó = Sí.
   ========================================================= */
const llamarLuegoCheck = document.getElementById("llamarLuego");
const razonLlamadaWrap = document.getElementById("razonLlamadaWrap");
const razonLlamadaLabel = document.getElementById("razonLlamadaLabel");

const OPCIONES_RAZON_SI = [
  "No contestó",
  "Pidió que lo vuelvan a llamar",
  "Colgó",
  "Quedaron en volver a comunicarse",
  "Otros",
];
const OPCIONES_RAZON_NO = [
  "Sin interés",
  "Petición de no llamar",
  "Ya llamado muchas veces",
  "Otros",
];

function llenarOpcionesRazon(opciones, etiqueta) {
  if (!razonNuevaLlamadaSel) return;
  const valorActual = razonNuevaLlamadaSel.value;
  razonNuevaLlamadaSel.innerHTML =
    '<option value="">Seleccionar…</option>' +
    opciones.map((o) => `<option value="${o}">${o}</option>`).join("");
  // Conservar valor si todavía aplica a la nueva lista
  if (opciones.indexOf(valorActual) !== -1) {
    razonNuevaLlamadaSel.value = valorActual;
  }
  // Actualizar el label visible
  if (razonLlamadaLabel) {
    razonLlamadaLabel.innerHTML =
      etiqueta + ' <span class="req-mark hidden" id="razonReqMark">*</span>';
  }
}

function actualizarVisibilidadRazon() {
  if (!llamarLuegoCheck) return;
  const activo = llamarLuegoCheck.checked;
  // Si llamarLuego está marcado -> opciones SI ("por qué se vuelve a llamar")
  // Si NO está marcado          -> opciones NO ("por qué no se llama")
  // Siempre se muestra el campo (porque queremos saber el motivo en ambos casos)
  razonLlamadaWrap.classList.remove("hidden");
  if (activo) {
    llenarOpcionesRazon(OPCIONES_RAZON_SI, "Razón de la nueva llamada");
  } else {
    llenarOpcionesRazon(OPCIONES_RAZON_NO, "Razón por la que no se llamará");
  }
  // Si el valor cambió, ocultar el campo "Otros"
  if (razonNuevaLlamadaSel.value !== "Otros") {
    razonOtrosWrap.classList.add("hidden");
    document.getElementById("razonNuevaLlamadaOtros").value = "";
  }
  actualizarObligatoriedadRazon();
}

// Razón obligatoria SOLO cuando contestó = Sí
function actualizarObligatoriedadRazon() {
  const contesto = callState.contesto === true;
  const req = document.getElementById("razonReqMark");
  if (!req) return;
  if (contesto) req.classList.remove("hidden");
  else req.classList.add("hidden");
}

if (llamarLuegoCheck) {
  llamarLuegoCheck.addEventListener("change", actualizarVisibilidadRazon);
}

// Al cargar la página, inicializar con las opciones según el
// estado por defecto del toggle (que arranca apagado = "No")
actualizarVisibilidadRazon();

/* =========================================================
   HORA
   ========================================================= */
function composeTime(hourSel, minSel, ampmSel) {
  const h = document.getElementById(hourSel).value;
  const m = document.getElementById(minSel).value || "00";
  const ap = document.getElementById(ampmSel).value;
  if (!h) return "";

  let h24 = parseInt(h, 10);
  if (ap === "PM" && h24 !== 12) h24 += 12;
  if (ap === "AM" && h24 === 12) h24 = 0;

  // Formato amable: "11:00 a.m."  /  "3:30 p.m."
  const apTexto = ap === "PM" ? "p.m." : "a.m.";
  return `${h}:${m} ${apTexto}`;
}

/* =========================================================
   RECOLECTAR FORMULARIO EN VIVO
   ========================================================= */
function recolectarFormularioEnVivo() {
  callState.programa = document.getElementById("programa").value;
  callState.carrera = document.getElementById("carrera").value;
  callState.llamarLuego = document.getElementById("llamarLuego").checked;
  callState.fechaProxContacto = document.getElementById("proxContactoYes").value;
  callState.horaProxContacto = composeTime("proxHoraYesH", "proxHoraYesM", "proxHoraYesAP");

  const _nr = document.getElementById("nombreRef");
  callState.nombre = _nr ? _nr.value.trim() : "";


  const motivoSel = document.getElementById("motivoNoInteres").value;
  if (motivoSel === "Otros") {
    const otro = document.getElementById("motivoNoInteresOtros").value.trim();
    callState.motivoNoInteres = otro ? `Otros: ${otro}` : "Otros";
  } else {
    callState.motivoNoInteres = motivoSel;
  }

  callState.observacion = document.getElementById("Nota").value.trim();

  // Razón de la nueva llamada (solo se rellena cuando viene
  // del recordatorio; en otro caso queda en blanco).
  const _rn = document.getElementById("razonNuevaLlamada");
  if (_rn) {
    const razonSel = _rn.value;
    if (razonSel === "Otros") {
      const otro = document.getElementById("razonNuevaLlamadaOtros").value.trim();
      callState.razonNuevaLlamada = otro ? `Otros: ${otro}` : "Otros";
    } else {
      callState.razonNuevaLlamada = razonSel;
    }
  }
}

/* =========================================================
   TOGGLE: Volver a llamar (deshabilita campos cuando está OFF)
   ========================================================= */
const volverLlamarToggle = document.getElementById("volverLlamar");
const volverLlamarFields = document.getElementById("volverLlamarFields");
volverLlamarToggle.addEventListener("change", () => {
  volverLlamarFields.classList.toggle("disabled", !volverLlamarToggle.checked);
});

/* =========================================================
   GUARDAR — Escenario NO contestó
   ========================================================= */
document.getElementById("btnGuardarNo").addEventListener("click", () => {
  if (!callState.motivo) {
    showToast("Selecciona un motivo", true);
    return;
  }

  callState.volverLlamar = volverLlamarToggle.checked;
  if (callState.volverLlamar) {
    callState.fechaProxContacto = document.getElementById("proxContactoNo").value;
    callState.horaProxContacto = composeTime("proxHoraNoH", "proxHoraNoM", "proxHoraNoAP");
  } else {
    callState.fechaProxContacto = "";
    callState.horaProxContacto = "";
  }

  saveCall();
});

document.getElementById("btnCancelarNo").addEventListener("click", () => {
  if (confirm("¿Cancelar el registro de esta llamada?")) {
    stopTimer();
    resetCallState();
    showStage("start");
  }
});

/* =========================================================
   GUARDAR — Escenario SÍ contestó
   ========================================================= */
document.getElementById("btnGuardarYes").addEventListener("click", () => {
  if (!callState.motivo) {
    showToast("Selecciona un motivo de cierre", true);
    return;
  }

  recolectarFormularioEnVivo();
  saveCall();
});

document.getElementById("btnCancelarYes").addEventListener("click", () => {
  if (confirm("¿Cancelar el registro de esta llamada?")) {
    stopTimer();
    resetCallState();
    showStage("start");
  }
});

/* =========================================================
   GUARDAR LLAMADA EN HISTORIAL
   ========================================================= */
function saveCall() {
  // Validación: razón obligatoria cuando se contestó.
  // (La razón es obligatoria sea "llamar luego" Sí o No, mientras
  // haya habido conversación.)
  if (callState.contesto === true) {
    if (!callState.razonNuevaLlamada || callState.razonNuevaLlamada.trim() === "") {
      showToast("Selecciona la razón antes de guardar", true);
      const sel = document.getElementById("razonNuevaLlamada");
      if (sel) { sel.focus(); sel.classList.add("invalid-pulse"); setTimeout(() => sel.classList.remove("invalid-pulse"), 1500); }
      return;
    }
    if (callState.razonNuevaLlamada === "Otros") {
      const otro = document.getElementById("razonNuevaLlamadaOtros").value.trim();
      if (!otro) {
        showToast("Escribe la razón en 'Otros'", true);
        document.getElementById("razonNuevaLlamadaOtros").focus();
        return;
      }
    }
  }

  const registro = {
    id: Date.now(),
    comercial: COMERCIAL,
    contacto: callState.contacto,
    fecha: callState.fecha,
    horaInicio: callState.horaInicio,
    horaRespondio: callState.horaRespondio,
    horaFin: callState.horaFin,
    duracion: formatDuration(callState.duracionSeg),
    duracionSeg: callState.duracionSeg,
    contesto: callState.contesto ? "Sí" : "No",
    motivo: callState.motivo,
    interes: callState.interes,
    calidadLead: callState.calidadLead,
    llamarLuego: callState.llamarLuego ? "Sí" : "No",
    fechaProxContacto: callState.fechaProxContacto,
    horaProxContacto: callState.horaProxContacto,
    programa: callState.programa,
    carrera: callState.carrera,
    provincia: callState.provincia,
    edad: callState.edad,
    motivoNoInteres: callState.motivoNoInteres,
    observacion: callState.observacion,
    nombre: callState.nombre,
    razonNuevaLlamada: callState.razonNuevaLlamada,
    volverLlamar: callState.volverLlamar ? "Sí" : "No",
    timestamp: new Date().toISOString(),
  };

  historial.unshift(registro);
  renderHistorial();
  updateGoalTracker();
  guardarLocal();

  // ============================================================
  // 🔌 ENVÍO INSTANTÁNEO A GOOGLE SHEETS
  // ============================================================
  enviarASheets(registro);

  // Si esta llamada vino de un recordatorio, marcarlo como "llamado".
  if (recordatorioActivo) {
    marcarRecordatorioLlamado(recordatorioActivo, registro);
    recordatorioActivo = null;
  }

  showToast("Llamada registrada");
  resetCallState();
  showStage("start");


  document.querySelector('.tab[data-tab="register"]').click();
  document.getElementById("inputContacto").focus();
}

/* =========================================================
   ENVÍO A GOOGLE SHEETS
   ========================================================= */
function enviarASheets(r) {
  if (
    !SHEETS_WEBAPP_URL ||
    SHEETS_WEBAPP_URL.indexOf("PEGA_AQUI") === 0
  ) {
    // Aún no se ha configurado la URL del Apps Script.
    console.warn(
      "SHEETS_WEBAPP_URL no configurada: el registro NO se subió a la hoja."
    );
    return;
  }

  const fila = {
    comercial: r.comercial,
    contacto: r.contacto,
    fecha: r.fecha,
    horaInicio: r.horaInicio,
    horaContesta: r.horaRespondio || "",
    duracion: r.duracion,
    horaFin: r.horaFin,
    contesto: r.contesto,
    calidadLead: r.calidadLead,
    interes: r.interes,
    llamarLuego: r.llamarLuego,
    fechaProxContacto: r.fechaProxContacto,
    horaProxContacto: r.horaProxContacto,
    nombre: r.nombre || "",
    programa: r.programa,
    carrera: r.carrera,
    provincia: r.provincia,
    edad: r.edad,
    motivoNoInteres: r.motivoNoInteres,
    observacion: r.observacion,
    razonNuevaLlamada: r.razonNuevaLlamada || "",
  };

  fetch(SHEETS_WEBAPP_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(fila),
  })
    .then(() => {
      console.log("Registro enviado a Google Sheets:", fila.contacto);
    })
    .catch((err) => {
      console.error("Error al enviar a Google Sheets:", err);
      showToast("⚠ No se pudo subir a la hoja (revisa internet)", true);
    });
}

/* =========================================================
   RENDER HISTORIAL
   ========================================================= */
function renderHistorial() {
  const tbody = document.getElementById("historyBody");
  const empty = document.getElementById("emptyState");
  const badge = document.getElementById("historyCount");
  const sub = document.getElementById("historySub");

  badge.textContent = historial.length;

  if (historial.length === 0) {
    tbody.innerHTML = "";
    empty.classList.remove("hidden");
    sub.textContent = "Aún no hay llamadas registradas.";
    return;
  }

  empty.classList.add("hidden");
  sub.textContent = `${historial.length} ${
    historial.length === 1 ? "llamada registrada" : "llamadas registradas"
  }.`;

  tbody.innerHTML = historial
    .map((r) => {
      const contestoBadge =
        r.contesto === "Sí"
          ? `<span class="badge badge-yes">Sí</span>`
          : `<span class="badge badge-no">No</span>`;

      let interesBadge = "—";
      if (r.interes === "Sí") interesBadge = `<span class="badge badge-yes">Sí</span>`;
      else if (r.interes === "No") interesBadge = `<span class="badge badge-no">No</span>`;

      let calidadBadge = "—";
      if (r.calidadLead === "Frío")
        calidadBadge = `<span class="badge badge-cold">❄ Frío</span>`;
      else if (r.calidadLead === "Tibio")
        calidadBadge = `<span class="badge badge-warm">◐ Tibio</span>`;
      else if (r.calidadLead === "Caliente")
        calidadBadge = `<span class="badge badge-hot">🔥 Caliente</span>`;

      let proxText = formatDateDisplay(r.fechaProxContacto);
      if (proxText && r.horaProxContacto) proxText += ` ${r.horaProxContacto}`;
      if (!proxText) proxText = "—";

      return `
        <tr>
          <td><strong class="mono">${escapeHtml(r.contacto)}</strong></td>
          <td class="mono">${r.horaInicio || "—"}</td>
          <td class="mono">${r.duracion || "—"}</td>
          <td class="mono">${r.horaFin || "—"}</td>
          <td>${contestoBadge}</td>
          <td>${interesBadge}</td>
          <td>${calidadBadge}</td>
          <td>${proxText}</td>
          <td class="obs-cell" title="${escapeHtml(r.observacion || "")}">${
        escapeHtml(r.observacion) || "—"
      }</td>
        </tr>
      `;
    })
    .join("");
}

function formatDateDisplay(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* =========================================================
   LLAMADAS PROGRAMADAS PARA HOY (RECORDATORIOS)
   ---------------------------------------------------------
   La lista es PERSISTENTE: cada fila tiene un estado:
     - "por_llamar" (estado inicial al cargar)
     - "llamando"   (cuando se presiona Llamar ahora)
     - "llamado"    (cuando se guarda la llamada)
   Al refrescar, NO se borra: se MERGE la información nueva
   manteniendo los estados ya marcados como "llamando"/"llamado".
   ========================================================= */

// Mapa de items mostrados: rowId -> {item, estado}
const recordatoriosUI = new Map();

// Item activo en este momento (de qué recordatorio venimos)
let recordatorioActivo = null;

// Clave para localStorage (sobrevive a recargas)
const STORAGE_REMINDERS = STORAGE_KEY + "_reminders";

// ---------- persistencia local de la lista ----------
function guardarEstadosRecordatorios() {
  try {
    const data = { fecha: nowDate(), items: [] };
    recordatoriosUI.forEach((v) => {
      data.items.push({ item: v.item, estado: v.estado });
    });
    localStorage.setItem(STORAGE_REMINDERS, JSON.stringify(data));
  } catch (e) { console.warn(e); }
}

function cargarEstadosRecordatorios() {
  try {
    const raw = localStorage.getItem(STORAGE_REMINDERS);
    if (!raw) return;
    const data = JSON.parse(raw);
    // Si cambió el día, descartar y empezar limpio.
    if (data.fecha !== nowDate()) {
      localStorage.removeItem(STORAGE_REMINDERS);
      return;
    }
    (data.items || []).forEach((d) => {
      if (d.item && d.item.rowId) {
        recordatoriosUI.set(d.item.rowId, { item: d.item, estado: d.estado });
      }
    });
  } catch (e) { console.warn(e); }
}

// ---------- cargar de la hoja ----------
function cargarProgramadasHoy() {
  const sub = document.getElementById("remindersSub");
  const body = document.getElementById("remindersBody");
  const vacio = document.getElementById("remindersEmpty");
  const badge = document.getElementById("remindersCount");

  if (!SHEETS_WEBAPP_URL || SHEETS_WEBAPP_URL.indexOf("PEGA_AQUI") === 0) {
    sub.textContent = "Falta configurar la conexión con la hoja de cálculo.";
    return;
  }

  // Si ya hay items en pantalla, no borramos: solo decimos cargando.
  sub.textContent = "Cargando llamadas programadas…";

  const hoy = nowDate();
  const cbName =
    "jsonp_programadas_" + Date.now() + "_" +
    Math.floor(Math.random() * 100000);

  let scriptTag = null;
  let timeoutId = null;

  function limpiar() {
    if (timeoutId) clearTimeout(timeoutId);
    if (scriptTag && scriptTag.parentNode) {
      scriptTag.parentNode.removeChild(scriptTag);
    }
    try { delete window[cbName]; } catch (e) { window[cbName] = undefined; }
  }

  window[cbName] = function (data) {
    limpiar();
    procesarProgramadas(data, { sub, body, vacio, badge });
  };

  const url =
    SHEETS_WEBAPP_URL +
    "?accion=programadas" +
    "&comercial=" + encodeURIComponent(COMERCIAL.toLowerCase()) +
    "&fecha=" + encodeURIComponent(hoy) +
    "&callback=" + encodeURIComponent(cbName) +
    "&t=" + Date.now();

  scriptTag = document.createElement("script");
  scriptTag.src = url;
  scriptTag.onerror = function () {
    limpiar();
    sub.textContent =
      "Error de conexión al leer la hoja. Revisa tu internet e inténtalo otra vez.";
  };

  timeoutId = setTimeout(function () {
    limpiar();
    sub.textContent =
      "La hoja tardó demasiado en responder. Presiona “Actualizar lista”.";
  }, 15000);

  document.body.appendChild(scriptTag);
}

// ---------- procesar respuesta y MERGEAR con lo que ya hay ----------
function procesarProgramadas(data, ui) {
  const { sub, body, vacio, badge } = ui;

  if (!data || !data.ok) {
    sub.textContent =
      "No se pudo leer la hoja" +
      (data && data.error ? ": " + data.error : "") + ".";
    return;
  }

  const nuevos = data.items || [];

  // MERGE:
  //  - Items que llegan nuevos: si no estaban, se agregan como "por_llamar".
  //  - Items que ya estaban (con estado llamando/llamado): se mantienen.
  //  - Items que estaban como "por_llamar" pero ya no llegan: se quitan.
  const idsNuevos = new Set(nuevos.map((it) => it.rowId));
  const aBorrar = [];
  recordatoriosUI.forEach((v, rowId) => {
    if (!idsNuevos.has(rowId) && v.estado === "por_llamar") {
      aBorrar.push(rowId);
    }
  });
  aBorrar.forEach((id) => recordatoriosUI.delete(id));

  nuevos.forEach((it) => {
    if (!recordatoriosUI.has(it.rowId)) {
      recordatoriosUI.set(it.rowId, { item: it, estado: "por_llamar" });
    } else {
      // Refrescar el item por si la hoja cambió, pero mantener el estado.
      const prev = recordatoriosUI.get(it.rowId);
      recordatoriosUI.set(it.rowId, { item: it, estado: prev.estado });
    }
  });

  guardarEstadosRecordatorios();
  renderRecordatorios();
}

// ---------- pintar la tabla ----------
function renderRecordatorios() {
  const sub = document.getElementById("remindersSub");
  const body = document.getElementById("remindersBody");
  const vacio = document.getElementById("remindersEmpty");
  const badge = document.getElementById("remindersCount");

  // Convertir a array y ordenar:
  //  1) "por_llamar" arriba; 2) "llamando"; 3) "llamado" abajo
  //  Dentro de cada grupo, por hora tentativa.
  // Convertir hora tipo "11:00 a.m." a minutos totales del día (0-1439)
  // para ordenar cronológicamente. Si no se puede parsear, va al final.
  function horaAMinutos(s) {
    if (!s) return 99999;
    const m = String(s).trim().toLowerCase()
      .match(/^(\d{1,2}):(\d{2})\s*(a\.?m\.?|p\.?m\.?|am|pm)?$/i);
    if (!m) return 99999;
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const ap = (m[3] || "").replace(/\./g, "");
    if (ap === "pm" && h !== 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    return h * 60 + min;
  }

  const ordenEstado = { por_llamar: 0, llamando: 1, llamado: 2 };
  const todos = Array.from(recordatoriosUI.values()).sort((a, b) => {
    const e = (ordenEstado[a.estado] ?? 99) - (ordenEstado[b.estado] ?? 99);
    if (e !== 0) return e;
    return horaAMinutos(a.item.horaProx) - horaAMinutos(b.item.horaProx);
  });

  // Contador del badge = solo "por_llamar"
  const pendientes = todos.filter((x) => x.estado === "por_llamar").length;
  badge.textContent = pendientes;

  if (todos.length === 0) {
    sub.textContent = "No tienes llamadas programadas para hoy.";
    body.innerHTML = "";
    vacio.classList.remove("hidden");
    return;
  }
  vacio.classList.add("hidden");

  sub.textContent =
    pendientes === 0
      ? "Todas las llamadas programadas de hoy ya fueron realizadas."
      : pendientes === 1
      ? "Tienes 1 llamada pendiente."
      : "Tienes " + pendientes + " llamadas pendientes.";

  body.innerHTML = todos
    .map(({ item, estado }) => {
      const numero = escapeHtml(item.contacto);
      const nombre = escapeHtml(item.nombre) || "—";
      const hora = escapeHtml(item.horaProx) || "—";
      const razon = escapeHtml(item.razon) || "—";
      const situacion = escapeHtml(item.situacionActual || "1ra llamada");

      let estadoHtml, accionHtml, rowClass;
      if (estado === "llamado") {
        rowClass = "row-llamado";
        estadoHtml = '<span class="estado estado-llamado">✓ Llamado</span>';
        accionHtml = '<span class="muted">—</span>';
      } else if (estado === "llamando") {
        rowClass = "row-llamando";
        estadoHtml = '<span class="estado estado-llamando">⏳ Llamando</span>';
        accionHtml = `<button class="btn btn-secondary btn-llamar-ahora" data-row="${item.rowId}" type="button">Reintentar</button>`;
      } else {
        rowClass = "row-por-llamar";
        estadoHtml = '<span class="estado estado-por-llamar">Por llamar</span>';
        accionHtml = `<button class="btn btn-primary btn-llamar-ahora" data-row="${item.rowId}" type="button">Llamar ahora</button>`;
      }

      return `
        <tr class="${rowClass}">
          <td><strong class="mono">${numero}</strong></td>
          <td>${nombre}</td>
          <td class="mono">${hora}</td>
          <td>${razon}</td>
          <td>${situacion}</td>
          <td>${estadoHtml}</td>
          <td>${accionHtml}</td>
        </tr>
      `;
    })
    .join("");

  body.querySelectorAll(".btn-llamar-ahora").forEach((btn) => {
    btn.addEventListener("click", () => {
      const rowId = parseInt(btn.dataset.row, 10);
      llamarAhoraDesdeRecordatorio(rowId);
    });
  });
}

// ---------- al presionar "Llamar ahora" ----------
function llamarAhoraDesdeRecordatorio(rowId) {
  const r = recordatoriosUI.get(rowId);
  if (!r) return;

  // Marcar como "llamando" y guardar
  r.estado = "llamando";
  recordatoriosUI.set(rowId, r);
  recordatorioActivo = rowId;
  guardarEstadosRecordatorios();
  renderRecordatorios();

  // Ir a la pestaña 01 y poner el número
  document.querySelector('.tab[data-tab="register"]').click();

  const inp = document.getElementById("inputContacto");
  inp.value = String(r.item.contacto).replace(/\D/g, "").slice(0, 9);
  inp.dispatchEvent(new Event("input", { bubbles: true }));
  inp.focus();

  // Si hay nombre en el recordatorio, prellenarlo
  const _nr = document.getElementById("nombreRef");
  if (_nr && r.item.nombre) _nr.value = r.item.nombre;

  // NOTA: la "razón de la nueva llamada" NO se pide aquí.
  // Ya fue registrada en la llamada original (cuando se marcó
  // "llamar luego = Sí") y se mostró en la pestaña 03 como
  // referencia. Por eso aquí solo dejamos el campo oculto.

  showToast("Número " + r.item.contacto + " listo. Presiona “Iniciar llamada”.");
}

// ---------- al guardar la llamada, marcar como "llamado" ----------
function marcarRecordatorioLlamado(rowId, registro) {
  const r = recordatoriosUI.get(rowId);
  if (!r) return;
  r.estado = "llamado";
  recordatoriosUI.set(rowId, r);
  guardarEstadosRecordatorios();
  // Si la pestaña 03 está visible, actualizar inmediatamente
  renderRecordatorios();
}

const _btnRecargar = document.getElementById("btnRecargarProgramadas");
if (_btnRecargar) {
  _btnRecargar.addEventListener("click", cargarProgramadasHoy);
}

/* =========================================================
   INICIALIZACIÓN
   ========================================================= */
cargarLocal();
cargarEstadosRecordatorios();   // recordatorios "llamando/llamado" persistidos
renderHistorial();
updateGoalTracker();
showStage("start");
