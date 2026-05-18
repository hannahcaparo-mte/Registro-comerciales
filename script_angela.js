/* =========================================================
   REGISTRO COMERCIAL · NATALIA  ·  v3
   ========================================================= */

const COMERCIAL = "Angela";

/* =========================================================
   🔌 CONFIGURACIÓN GOOGLE SHEETS
   Pega aquí la URL que te da Google Apps Script al publicar
   (ver instrucciones en INSTRUCCIONES.md). Mientras esté
   vacío, la app funciona igual pero NO sube a la hoja.
   ========================================================= */
const SHEETS_WEBAPP_URL = "https://script.google.com/a/macros/mte.com.pe/s/AKfycbx-fk7WOoUC3T2DXAkNmSMllVvP72HFsYmcVIokVijrSm7wZA6J6Z4Yig8nEHl8vnXNCw/exec";

// Clave para guardar el historial del día en el navegador
const STORAGE_KEY = "registroAngela_v3";

// Metas por día (semana). 0 = domingo, 6 = sábado.
const METAS_POR_DIA = {
  0: 0,   // Domingo
  1: 50,  // Lunes
  2: 50,  // Martes
  3: 50,  // Miércoles
  4: 50,  // Jueves
  5: 50,  // Viernes
  6: 25,  // Sábado
};

// Estado de la llamada actual
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
};

let timerInterval = null;
let timerStart = 0;

// Almacenamiento (memoria)
let historial = [];

/* =========================================================
   PERSISTENCIA LOCAL + REINICIO DIARIO

   - Todo lo que se registra en el día queda guardado en el
     navegador (sobrevive si se recarga la página).
   - Cuando cambia el día, el historial visible se reinicia
     (las filas anteriores ya quedaron como backup en la
     hoja de cálculo de Google).
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
      // Mismo día: recuperamos lo registrado hoy
      historial = data.registros;
    } else {
      // Cambió el día -> se reinicia el historial visible.
      // El día anterior ya está respaldado en Google Sheets.
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

// Revisa periódicamente si cambió el día mientras la app está abierta.
function chequearCambioDeDia() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const guardadoFecha = raw ? JSON.parse(raw).fecha : null;
    const hoy = nowDate();
    if (guardadoFecha && guardadoFecha !== hoy) {
      // Pasamos a un nuevo día: reiniciar todo en pantalla.
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
// Chequear cada minuto
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
    // Al abrir la pestaña de llamadas programadas, refrescar la lista.
    if (target === "reminders") {
      cargarProgramadasHoy();
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
  // Fecha LOCAL (no UTC). Antes usaba toISOString() que está en
  // UTC y, en Perú (UTC-5), de noche ya marcaba el día siguiente.
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

  document.querySelectorAll(".chip.selected").forEach((c) =>
    c.classList.remove("selected")
  );

  // Reset visibilidad de botones / bloques de cierre
  document.getElementById("callingActions1").classList.remove("hidden");
  document.getElementById("callingActions2").classList.add("hidden");
  document.getElementById("closingBlockYes").classList.add("hidden");
  document.getElementById("closingBlockNo").classList.add("hidden");

  // Reset timer display y status
  document.getElementById("timer").textContent = "00:00";
  document.getElementById("timerWrap1").classList.remove("active", "ended");
  document.getElementById("timerStatus").textContent = "Marcando…";

  // Reset header
  document.getElementById("stageTag").textContent = "En curso";
  document.getElementById("stageTag").classList.remove("live");
  document.getElementById("stageTag").classList.add("pulse");
  document.getElementById("callingSub").textContent = "Esperando respuesta…";

  // Restaurar columnas: live form visible, no-answer-panel oculto
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

  // Cambia el header
  const stageTag = document.getElementById("stageTag");
  stageTag.textContent = "Sin respuesta";
  stageTag.classList.remove("pulse");
  document.getElementById("callingSub").textContent =
    "Indica el motivo y agrega seguimiento.";

  // Marcar timer como ended (sigue visible la duración final)
  document.getElementById("timerWrap1").classList.add("ended");
  document.getElementById("timerStatus").textContent =
    `Finalizó · ${callState.horaFin} · Duración ${formatDuration(callState.duracionSeg)}`;

  // Esconder botones iniciales, mostrar bloque de cierre
  document.getElementById("callingActions1").classList.add("hidden");
  document.getElementById("closingBlockNo").classList.remove("hidden");

  // Ocultar el formulario en vivo (no aplica para "no contestó")
  // y mostrar el panel de seguimiento en la columna derecha
  document.getElementById("liveForm").classList.add("hidden");
  document.getElementById("noAnswerPanel").classList.remove("hidden");
});

/* =========================================================
   ESCENARIO 2: RESPONDIÓ
   ========================================================= */
document.getElementById("btnRespondio").addEventListener("click", () => {
  callState.horaRespondio = nowTime();
  callState.contesto = true;

  // Cambiar tag y subtítulo
  const stageTag = document.getElementById("stageTag");
  stageTag.textContent = "● En conversación";
  stageTag.classList.remove("pulse");
  stageTag.classList.add("live");
  document.getElementById("callingSub").textContent =
    `Respondió a las ${callState.horaRespondio}. Llena el formulario mientras hablas.`;

  // Cambiar timer a "activo" (verde)
  document.getElementById("timerWrap1").classList.add("active");
  document.getElementById("timerStatus").textContent = "En conversación";

  // Cambiar botones: ahora solo "Terminó llamada"
  document.getElementById("callingActions1").classList.add("hidden");
  document.getElementById("callingActions2").classList.remove("hidden");
});

/* "Terminó llamada" — sigue dejando editar el formulario */
document.getElementById("btnTerminar").addEventListener("click", () => {
  stopTimer();
  callState.horaFin = nowTime();

  // Mostrar el bloque de motivo de cierre
  document.getElementById("callingActions2").classList.add("hidden");
  document.getElementById("closingBlockYes").classList.remove("hidden");

  // Marcar timer como finalizado
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
   MOTIVO DE NO INTERÉS — mostrar campo "Otros"
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
   HELPER: Componer hora a partir de selectores h+m+AP
   ========================================================= */
function composeTime(hourSel, minSel, ampmSel) {
  const h = document.getElementById(hourSel).value;
  const m = document.getElementById(minSel).value || "00";
  const ap = document.getElementById(ampmSel).value;
  if (!h) return "";

  let h24 = parseInt(h, 10);
  if (ap === "PM" && h24 !== 12) h24 += 12;
  if (ap === "AM" && h24 === 12) h24 = 0;

  // Formato amigable: "2:30 PM"  (también guardamos versión 24h interna)
  return `${h}:${m} ${ap}`;
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

  // Motivo de no interés: si es "Otros", tomar el texto escrito
  const motivoSel = document.getElementById("motivoNoInteres").value;
  if (motivoSel === "Otros") {
    const otro = document.getElementById("motivoNoInteresOtros").value.trim();
    callState.motivoNoInteres = otro ? `Otros: ${otro}` : "Otros";
  } else {
    callState.motivoNoInteres = motivoSel;
  }

  callState.observacion = document.getElementById("Nota").value.trim();
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
    volverLlamar: callState.volverLlamar ? "Sí" : "No",
    timestamp: new Date().toISOString(),
  };

  historial.unshift(registro);
  renderHistorial();
  updateGoalTracker();
  guardarLocal();

  // ============================================================
  // 🔌 ENVÍO INSTANTÁNEO A GOOGLE SHEETS (hoja "NATALIA")
  // ============================================================
  enviarASheets(registro);

  showToast("Llamada registrada");
  resetCallState();
  showStage("start");

  // Volver a la página inicial y dejar el cursor listo
  // para ingresar el siguiente número.
  document.querySelector('.tab[data-tab="register"]').click();
  document.getElementById("inputContacto").focus();
}

/* =========================================================
   ENVÍO A GOOGLE SHEETS
   Manda las 19 columnas en el orden exacto de la hoja:
   COMERCIAL, CONTACTO, FECHA, HORA INICIO, HORA CONTESTA,
   DURACIÓN, HORA FIN, CONTESTO, CALIDAD DE LEAD, INTERES,
   LLAMAR LUEGO, FECHA PROXIMO CONTACTO, HORA PROXIMO CONTACTO,
   PROGRAMA, CARRERA, PROVINCIA, EDAD, MOTIVO DE NO INTERES,
   OBSERVACION
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
   Lee la hoja de cálculo (vía el Apps Script) y muestra
   todas las filas de esta comercial cuya FECHA PROXIMO
   CONTACTO sea igual a hoy. Al presionar "Llamar ahora",
   el número pasa a la pestaña 1 listo para iniciar, y esa
   línea desaparece de la lista (en pantalla).
   ========================================================= */

// Números que ya se "llamaron ahora" hoy desde recordatorios.
// Se ocultan de la lista aunque sigan en la hoja.
let programadasOcultas = [];

function cargarProgramadasHoy() {
  const sub = document.getElementById("remindersSub");
  const body = document.getElementById("remindersBody");
  const vacio = document.getElementById("remindersEmpty");
  const badge = document.getElementById("remindersCount");

  if (!SHEETS_WEBAPP_URL || SHEETS_WEBAPP_URL.indexOf("PEGA_AQUI") === 0) {
    sub.textContent = "Falta configurar la conexión con la hoja de cálculo.";
    return;
  }

  sub.textContent = "Cargando llamadas programadas…";
  body.innerHTML = "";
  vacio.classList.add("hidden");

  const hoy = nowDate();

  // Lectura por JSONP (esquiva la restricción CORS de Apps Script).
  // Se crea un <script> que llama a la URL con un "callback".
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

  // Función global temporal que el Apps Script "ejecutará".
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

  // Si en 15 s no respondió, avisar.
  timeoutId = setTimeout(function () {
    limpiar();
    sub.textContent =
      "La hoja tardó demasiado en responder. Presiona “Actualizar lista”.";
  }, 15000);

  document.body.appendChild(scriptTag);
}

function procesarProgramadas(data, ui) {
  const { sub, body, vacio, badge } = ui;

  if (!data || !data.ok) {
    sub.textContent =
      "No se pudo leer la hoja" +
      (data && data.error ? ": " + data.error : "") + ".";
    return;
  }

  // Filtrar las que ya se llamaron desde aquí hoy.
  const items = (data.items || []).filter(
    (it) => programadasOcultas.indexOf(it.contacto) === -1
  );

  badge.textContent = items.length;

  if (items.length === 0) {
    sub.textContent = "No tienes llamadas programadas pendientes para hoy.";
    vacio.classList.remove("hidden");
    return;
  }

  sub.textContent =
    items.length === 1
      ? "Tienes 1 llamada programada para hoy."
      : "Tienes " + items.length + " llamadas programadas para hoy.";

  // Ordenar por hora tentativa (texto; vacías al final).
  items.sort((a, b) => {
    if (!a.horaProx) return 1;
    if (!b.horaProx) return -1;
    return String(a.horaProx).localeCompare(String(b.horaProx));
  });

  body.innerHTML = items
    .map((it) => {
      const numero = escapeHtml(it.contacto);
      const nombre = escapeHtml(it.nombre) || "—";
      const hora = escapeHtml(it.horaProx) || "—";
      return `
        <tr>
          <td><strong class="mono">${numero}</strong></td>
          <td>${nombre}</td>
          <td class="mono">${hora}</td>
          <td>
            <button class="btn btn-primary btn-llamar-ahora"
                    data-num="${numero}" type="button">
              Llamar ahora
            </button>
          </td>
        </tr>
      `;
    })
    .join("");

  // Conectar botones "Llamar ahora".
  body.querySelectorAll(".btn-llamar-ahora").forEach((btn) => {
    btn.addEventListener("click", () => {
      const num = btn.dataset.num;
      llamarAhoraDesdeRecordatorio(num);
    });
  });
}

function llamarAhoraDesdeRecordatorio(numero) {
  // Ocultar esta línea de la lista (ya se va a llamar).
  if (programadasOcultas.indexOf(numero) === -1) {
    programadasOcultas.push(numero);
  }

  // Ir a la pestaña 1 (Registrar nueva llamada).
  document.querySelector('.tab[data-tab="register"]').click();

  // Poner el número en el campo y habilitar "Iniciar llamada".
  const inp = document.getElementById("inputContacto");
  inp.value = String(numero).replace(/\D/g, "").slice(0, 9);
  // Disparar la validación que habilita el botón.
  inp.dispatchEvent(new Event("input", { bubbles: true }));
  inp.focus();

  showToast("Número " + numero + " listo. Presiona “Iniciar llamada”.");
}

// Botón "Actualizar lista".
const _btnRecargar = document.getElementById("btnRecargarProgramadas");
if (_btnRecargar) {
  _btnRecargar.addEventListener("click", cargarProgramadasHoy);
}

/* =========================================================
   INICIALIZACIÓN
   ========================================================= */
cargarLocal();        // recupera lo registrado hoy (o reinicia si cambió el día)
renderHistorial();
updateGoalTracker();
showStage("start");
