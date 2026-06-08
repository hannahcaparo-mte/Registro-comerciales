/* ============================================================
   REGISTRO COMERCIAL · script_natalia.js
   Versión integrada con Kommo (lectura)
   ============================================================ */

const COMERCIAL = "Angela";
const STORAGE_KEY = "registroAngela_v4";

// URL del Apps Script publicado (la misma para las 4 comerciales).
// Reemplaza con tu URL real (la pegaste en versiones anteriores).
const SHEETS_WEBAPP_URL = "https://script.google.com/a/macros/mte.com.pe/s/AKfycbx-fk7WOoUC3T2DXAkNmSMllVvP72HFsYmcVIokVijrSm7wZA6J6Z4Yig8nEHl8vnXNCw/exec";

/* ============================================================
   ESTADO GLOBAL
   ============================================================ */
let historial = [];
let timerInterval = null;
let timerStart = null;

const callState = {
  contacto: "",
  codigo: "",         // NUEVO: ID del lead Kommo (oculto)
  fecha: "",
  horaInicio: "",
  horaContesta: "",
  horaFin: "",
  duracionSeg: 0,
  contesto: null,
  motivo: "",
  interes: "",
  calidadLead: "",
  llamarLuego: false,
  fechaProxContacto: "",
  horaProxContacto: "",
  programa: "",
  carrera: "",
  provincia: "",
  edad: "",
  motivoNoInteres: "",
  observacion: "",
  nombre: "",
  razonNuevaLlamada: "",
  ventaCerrada: "",
  demo: "",           // NUEVO
};

// Datos del lead vinculado (cuando viene de Kommo)
let leadVinculado = null;

/* ============================================================
   CARGAR Y GUARDAR EN LOCALSTORAGE
   ============================================================ */
function guardarLocal() {
  try {
    const data = { fecha: nowDate(), historial };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) { console.warn(e); }
}

function cargarLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data.fecha !== nowDate()) {
      localStorage.removeItem(STORAGE_KEY);
      historial = [];
      showToast("Nuevo día: historial reiniciado (backup en la hoja)");
      return;
    }
    historial = data.historial || [];
  } catch (e) { console.warn(e); }
}

// Cada minuto comprueba si cambió el día
setInterval(() => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data.fecha !== nowDate()) {
        cargarLocal();
        renderHistorial();
        updateGoalTracker();
      }
    }
  } catch (e) {}
}, 60000);

/* ============================================================
   TIEMPO Y FECHA (LOCAL PERÚ, no UTC)
   ============================================================ */
function nowTime() {
  return new Date().toTimeString().slice(0, 8);
}
function nowDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dia}`;
}

function formatDuration(seg) {
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

function startTimer() {
  timerStart = Date.now();
  const el = document.getElementById("callTimer");
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const seg = Math.floor((Date.now() - timerStart) / 1000);
    callState.duracionSeg = seg;
    el.textContent = formatDuration(seg);
  }, 1000);
}
function stopTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

/* ============================================================
   META DEL DÍA
   ============================================================ */
function getMetaDelDia() {
  const d = new Date();
  return d.getDay() === 6 ? 25 : 50;
}

function updateGoalTracker() {
  const today = nowDate();
  const llamadasHoy = historial.filter((r) => r.fecha === today).length;
  const meta = getMetaDelDia();
  document.getElementById("goalCurrent").textContent = llamadasHoy;
  document.getElementById("goalTotal").textContent = meta;
  const pct = meta > 0 ? Math.min(100, (llamadasHoy / meta) * 100) : 0;
  document.getElementById("goalBarFill").style.width = pct + "%";
}

/* ============================================================
   RELOJ
   ============================================================ */
function updateClock() {
  const d = new Date();
  document.getElementById("currentTime").textContent =
    d.toLocaleTimeString("es-PE", { hour12: false });
  document.getElementById("currentDate").textContent =
    d.toLocaleDateString("es-PE", { weekday:"long", day:"numeric", month:"short" });
}
updateClock();
setInterval(updateClock, 1000);

/* ============================================================
   TABS
   ============================================================ */
const tabs = document.querySelectorAll(".tab");
const panels = document.querySelectorAll(".tab-panel");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.tab;
    tabs.forEach((t) => t.classList.toggle("active", t === tab));
    panels.forEach((p) => p.classList.toggle("active", p.id === `panel-${target}`));

    // Al cambiar de pestaña, usar lo que ya está cargado (no recargar).
    // Solo cargar de Kommo si NO hay datos previos.
    if (target === "pending") {
      // Si ya estábamos viendo un programa, mostrar esa lista de leads.
      // Si no, mostrar la vista A (chips de programas).
      if (programaActual && cacheLeads[programaActual]) {
        mostrarLeadsPrograma(programaActual);   // usa caché
      } else if (cacheConteos.data) {
        renderProgramChips(cacheConteos.data);   // usa caché
        document.getElementById("pendingProgramsView").classList.remove("hidden");
        document.getElementById("pendingLeadsView").classList.add("hidden");
      } else {
        cargarConteosKommo();   // primera vez, recargar
      }
    }
    if (target === "funnel") {
      // Mostrar caché si existe; si no, cargar
      if (cacheFunnel.data) {
        renderFunnel(cacheFunnel.data);
      } else {
        cargarReporteEmbudos();
      }
    }
    if (target === "history") renderHistorial();
  });
});

/* ============================================================
   ESTADO DE PANELES DE LA COLUMNA DERECHA
   ============================================================ */
// Posibles estados: 'empty', 'lead', 'loading', 'soon', 'liveForm', 'noAnswer'
function showRightPanel(name) {
  const ids = ["emptyLeadCard","leadCard","leadLoading","soonCard","liveForm","noAnswerPanel"];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const visible =
      (name === "empty"     && id === "emptyLeadCard") ||
      (name === "lead"      && id === "leadCard") ||
      (name === "loading"   && id === "leadLoading") ||
      (name === "soon"      && id === "soonCard") ||
      (name === "liveForm"  && id === "liveForm") ||
      (name === "noAnswer"  && id === "noAnswerPanel");
    el.classList.toggle("hidden", !visible);
  });
}

// Mostrar/ocultar timer y acciones de la columna izquierda
function showLeftCallControls(state) {
  // state: 'idle' (botón Iniciar visible), 'preCall' (timer + sí/no), 'inCall' (timer + finalizar)
  const btnIniciar = document.getElementById("btnIniciar");
  const timerBox = document.getElementById("callTimerBox");
  const a1 = document.getElementById("callingActions1");
  const a2 = document.getElementById("callingActions2");

  if (state === "idle") {
    btnIniciar.classList.remove("hidden");
    timerBox.classList.add("hidden");
    a1.classList.add("hidden");
    a2.classList.add("hidden");
  } else if (state === "preCall") {
    btnIniciar.classList.add("hidden");
    timerBox.classList.remove("hidden");
    a1.classList.remove("hidden");
    a2.classList.add("hidden");
  } else if (state === "inCall") {
    btnIniciar.classList.add("hidden");
    timerBox.classList.remove("hidden");
    a1.classList.add("hidden");
    a2.classList.remove("hidden");
  }
}

// Compatibilidad con código viejo: showStage redirige
function showStage(name) {
  if (name === "start") {
    showLeftCallControls("idle");
    if (leadVinculado) showRightPanel("lead");
    else showRightPanel("empty");
  } else if (name === "calling") {
    // Estado intermedio: timer y botones sí/no
    showLeftCallControls("preCall");
    // El panel derecho se mantiene (ficha del lead o vacío)
  } else if (name === "soon") {
    showRightPanel("soon");
  }
}

/* ============================================================
   TOAST
   ============================================================ */
function showToast(msg, error = false) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.toggle("error", !!error);
  t.classList.add("visible");
  setTimeout(() => t.classList.remove("visible"), 3000);
}

function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

/* ============================================================
   RESET DEL ESTADO
   ============================================================ */
function resetCallState() {
  Object.assign(callState, {
    contacto: "", codigo: "", fecha: "", horaInicio: "", horaContesta: "",
    horaFin: "", duracionSeg: 0, contesto: null, motivo: "",
    interes: "", calidadLead: "", llamarLuego: false,
    fechaProxContacto: "", horaProxContacto: "",
    programa: "", universidad: "", carrera: "", ciclo: "",
    provincia: "", edad: "",
    motivoNoInteres: "", observacion: "", nombre: "",
    razonNuevaLlamada: "", ventaCerrada: "", demo: "",
  });
  leadVinculado = null;

  // Reset UI: paneles derechos
  showRightPanel("empty");
  // Reset UI: controles izquierdos
  showLeftCallControls("idle");
  document.getElementById("dispHoraRespBox").classList.add("hidden");

  // Limpiar chips
  document.querySelectorAll(".chip.selected").forEach(c => c.classList.remove("selected"));

  // Limpiar inputs
  ["universidad","carrera","ciclo","provincia","edad","Nota","NotaNo",
   "razonNuevaLlamadaOtrosYes","razonNuevaLlamadaOtrosNo",
   "motivoNoInteresOtros","inputContacto"].forEach(id => {
    const e = document.getElementById(id); if (e) e.value = "";
  });
  document.getElementById("demoCheck").checked = false;
  document.getElementById("llamarLuegoYes").checked = false;
  document.getElementById("volverLlamarNo").checked = true;
  document.getElementById("motivoNoInteres").value = "";
  document.getElementById("motivoNoInteresWrap").classList.add("hidden");
  document.getElementById("motivoOtrosWrap").classList.add("hidden");
  document.getElementById("proxContactoYesWrap").classList.add("hidden");
  document.getElementById("razonOtrosWrapYes").classList.add("hidden");
  document.getElementById("razonOtrosWrapNo").classList.add("hidden");

  stopTimer();
  document.getElementById("callTimer").textContent = "00:00";
}

/* ============================================================
   FORM HELPERS
   ============================================================ */
function setupChipGroup(groupId, onSelect) {
  const g = document.getElementById(groupId);
  if (!g) return;
  g.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    g.querySelectorAll(".chip").forEach(c => c.classList.remove("selected"));
    chip.classList.add("selected");
    onSelect(chip.dataset.value);
  });
}

setupChipGroup("contestoGroup", (v) => {
  callState.contesto = (v === "Sí");
});
setupChipGroup("calidadGroup", (v) => { callState.calidadLead = v; });
setupChipGroup("interesGroup", (v) => {
  callState.interes = v;
  document.getElementById("motivoNoInteresWrap").classList.toggle("hidden", v !== "No");
  if (v !== "No") {
    document.getElementById("motivoNoInteres").value = "";
    document.getElementById("motivoOtrosWrap").classList.add("hidden");
  }
});
setupChipGroup("motivoNoGroup", (v) => { callState.motivo = v; });

document.getElementById("motivoNoInteres").addEventListener("change", (e) => {
  const wrap = document.getElementById("motivoOtrosWrap");
  if (e.target.value === "Otros") wrap.classList.remove("hidden");
  else { wrap.classList.add("hidden"); document.getElementById("motivoNoInteresOtros").value = ""; }
});

/* ============================================================
   RAZÓN NUEVA LLAMADA — siempre visible (Sí y No contestó)
   Cambia opciones según el toggle de "llamar luego" / "volver".
   ============================================================ */
const OPCIONES_RAZON_SI = [
  "No contestó", "Pidió que lo vuelvan a llamar", "Colgó",
  "Quedaron en volver a comunicarse", "Otros"
];
const OPCIONES_RAZON_NO = [
  "Sin interés", "Petición de no llamar",
  "Ya llamado muchas veces", "Otros"
];

function llenarOpcionesRazon(selectId, labelId, opciones, etiqueta, markId) {
  const sel = document.getElementById(selectId);
  const lbl = document.getElementById(labelId);
  if (!sel) return;
  const v = sel.value;
  sel.innerHTML = '<option value="">Seleccionar…</option>' +
    opciones.map(o => `<option value="${o}">${o}</option>`).join("");
  if (opciones.indexOf(v) !== -1) sel.value = v;
  if (lbl) lbl.innerHTML = etiqueta +
    ' <span class="req-mark" id="' + markId + '">*</span>';
}

function bindRazonOtros(selectId, wrapId, inputId) {
  const sel = document.getElementById(selectId);
  const wrap = document.getElementById(wrapId);
  if (!sel || !wrap) return;
  sel.addEventListener("change", () => {
    if (sel.value === "Otros") {
      wrap.classList.remove("hidden");
      document.getElementById(inputId).focus();
    } else {
      wrap.classList.add("hidden");
      document.getElementById(inputId).value = "";
    }
  });
}
bindRazonOtros("razonNuevaLlamadaYes", "razonOtrosWrapYes", "razonNuevaLlamadaOtrosYes");
bindRazonOtros("razonNuevaLlamadaNo", "razonOtrosWrapNo", "razonNuevaLlamadaOtrosNo");

// Toggle "Llamar luego" del lado Sí contestó
document.getElementById("llamarLuegoYes").addEventListener("change", (e) => {
  document.getElementById("proxContactoYesWrap").classList.toggle("hidden", !e.target.checked);
  const ops = e.target.checked ? OPCIONES_RAZON_SI : OPCIONES_RAZON_NO;
  const eti = e.target.checked ? "Razón de la nueva llamada" : "Razón por la que no se llamará";
  llenarOpcionesRazon("razonNuevaLlamadaYes", "razonLlamadaLabelYes", ops, eti, "razonReqMarkYes");
});

// Toggle "Volver a llamar" del lado No contestó
document.getElementById("volverLlamarNo").addEventListener("change", (e) => {
  document.getElementById("proxContactoNoWrap").classList.toggle("hidden", !e.target.checked);
  const ops = e.target.checked ? OPCIONES_RAZON_SI : OPCIONES_RAZON_NO;
  const eti = e.target.checked ? "Razón de la nueva llamada" : "Razón por la que no se llamará";
  llenarOpcionesRazon("razonNuevaLlamadaNo", "razonLlamadaLabelNo", ops, eti, "razonReqMarkNo");
});

// Inicializar opciones por defecto
llenarOpcionesRazon("razonNuevaLlamadaYes", "razonLlamadaLabelYes", OPCIONES_RAZON_NO, "Razón por la que no se llamará", "razonReqMarkYes");
llenarOpcionesRazon("razonNuevaLlamadaNo", "razonLlamadaLabelNo", OPCIONES_RAZON_SI, "Razón de la nueva llamada", "razonReqMarkNo");

/* ============================================================
   INICIO: input contacto + botón iniciar
   ============================================================ */
const inputContacto = document.getElementById("inputContacto");
const btnIniciar = document.getElementById("btnIniciar");

inputContacto.addEventListener("input", (e) => {
  const filtered = e.target.value.replace(/\D/g, "").slice(0, 11);
  e.target.value = filtered;
  btnIniciar.disabled = filtered.length !== 11;
});

btnIniciar.addEventListener("click", () => {
  const contacto = inputContacto.value.trim();
  if (!/^\d{11}$/.test(contacto)) {
    showToast("Ingresa 11 dígitos válidos", true);
    return;
  }

  const tipo = document.getElementById("tipoLlamada").value;
  if (tipo === "Llamada por cobranza") {
    document.getElementById("soonTitle").textContent = "Llamada por cobranza — Próximamente";
    showRightPanel("soon");
    return;
  }

  // Nueva llamada → iniciar flujo
  callState.contacto = contacto;
  callState.fecha = nowDate();
  callState.horaInicio = nowTime();

  document.getElementById("dispHoraInicio").textContent = callState.horaInicio;

  // Prellenar campos del formulario con datos del lead Kommo (si hay)
  if (leadVinculado) {
    document.getElementById("universidad").value = leadVinculado.universidad || "";
    document.getElementById("carrera").value = leadVinculado.carrera || "";
    document.getElementById("ciclo").value = leadVinculado.ciclo || "";
    document.getElementById("provincia").value = leadVinculado.distrito || "";
    // Programa ya está en callState.programa, no hay input para él
  }

  startTimer();
  showLeftCallControls("preCall");
  // Panel derecho: si hay lead, sigue mostrando la ficha; sino, queda en empty
});

document.getElementById("btnVolverInicio").addEventListener("click", () => {
  inputContacto.value = "";
  document.getElementById("tipoLlamada").value = "Nueva llamada";
  btnIniciar.disabled = true;
  resetCallState();
  showStage("start");
  inputContacto.focus();
});

document.getElementById("btnLimpiarLead").addEventListener("click", () => {
  leadVinculado = null;
  callState.codigo = "";
  callState.programa = "";
  callState.nombre = "";
  showRightPanel("empty");
  inputContacto.value = "";
  inputContacto.dispatchEvent(new Event("input", { bubbles: true }));
});

/* ============================================================
   FLUJO: SÍ CONTESTÓ
   ============================================================ */
document.getElementById("btnRespondio").addEventListener("click", () => {
  callState.horaContesta = nowTime();
  document.getElementById("dispHoraResp").textContent = callState.horaContesta;
  document.getElementById("dispHoraRespBox").classList.remove("hidden");
  showLeftCallControls("inCall");
});

document.getElementById("btnFinLlamada").addEventListener("click", () => {
  stopTimer();
  callState.horaFin = nowTime();
  showRightPanel("liveForm");
});

/* ============================================================
   FLUJO: NO CONTESTÓ
   ============================================================ */
document.getElementById("btnNoRespondio").addEventListener("click", () => {
  stopTimer();
  callState.contesto = false;
  callState.horaFin = nowTime();
  showRightPanel("noAnswer");
});

/* ============================================================
   GUARDAR LLAMADA
   ============================================================ */
function recolectarFormularioYes() {
  // Datos del formulario "sí contestó"
  callState.calidadLead = callState.calidadLead || "";
  callState.interes = callState.interes || "";

  // Motivo no interés (con Otros)
  const m = document.getElementById("motivoNoInteres").value;
  if (m === "Otros") {
    const o = document.getElementById("motivoNoInteresOtros").value.trim();
    callState.motivoNoInteres = o ? `Otros: ${o}` : "Otros";
  } else {
    callState.motivoNoInteres = m;
  }

  callState.universidad = document.getElementById("universidad").value.trim();
  callState.carrera = document.getElementById("carrera").value.trim();
  callState.ciclo = document.getElementById("ciclo").value.trim();
  callState.provincia = document.getElementById("provincia").value.trim();
  callState.edad = document.getElementById("edad").value.trim();
  callState.demo = document.getElementById("demoCheck").checked ? "Sí" : "";

  callState.llamarLuego = document.getElementById("llamarLuegoYes").checked;
  if (callState.llamarLuego) {
    callState.fechaProxContacto = document.getElementById("proxContactoYes").value;
    callState.horaProxContacto = composeTime("proxHoraYesH","proxHoraYesM","proxHoraYesAP");
  } else {
    callState.fechaProxContacto = "";
    callState.horaProxContacto = "";
  }

  // Razón
  const rs = document.getElementById("razonNuevaLlamadaYes").value;
  if (rs === "Otros") {
    const o = document.getElementById("razonNuevaLlamadaOtrosYes").value.trim();
    callState.razonNuevaLlamada = o ? `Otros: ${o}` : "Otros";
  } else {
    callState.razonNuevaLlamada = rs;
  }

  callState.observacion = document.getElementById("Nota").value.trim();
}

function recolectarFormularioNo() {
  callState.llamarLuego = document.getElementById("volverLlamarNo").checked;
  if (callState.llamarLuego) {
    callState.fechaProxContacto = document.getElementById("proxContactoNo").value;
    callState.horaProxContacto = composeTime("proxHoraNoH","proxHoraNoM","proxHoraNoAP");
  } else {
    callState.fechaProxContacto = "";
    callState.horaProxContacto = "";
  }

  const rs = document.getElementById("razonNuevaLlamadaNo").value;
  if (rs === "Otros") {
    const o = document.getElementById("razonNuevaLlamadaOtrosNo").value.trim();
    callState.razonNuevaLlamada = o ? `Otros: ${o}` : "Otros";
  } else {
    callState.razonNuevaLlamada = rs;
  }

  callState.observacion = document.getElementById("NotaNo").value.trim();
}

function composeTime(hourSel, minSel, ampmSel) {
  const h = document.getElementById(hourSel).value;
  const m = document.getElementById(minSel).value || "00";
  const apRaw = document.getElementById(ampmSel).value;
  if (!h) return "";
  const esPM = String(apRaw || "").toLowerCase().indexOf("p") !== -1;
  return `${h}:${m} ${esPM ? "p.m." : "a.m."}`;
}

document.getElementById("btnGuardarYes").addEventListener("click", () => {
  recolectarFormularioYes();
  saveCall();
});

document.getElementById("btnGuardarNo").addEventListener("click", () => {
  recolectarFormularioNo();
  saveCall();
});

document.getElementById("btnCancelarYes").addEventListener("click", () => {
  if (confirm("¿Cancelar el registro de esta llamada?")) {
    resetCallState();
    showStage("start");
  }
});

document.getElementById("btnCancelarNo").addEventListener("click", () => {
  if (confirm("¿Cancelar?")) {
    resetCallState();
    showStage("start");
  }
});

function saveCall() {
  const contesto = (callState.contesto === true) ? "Sí" : (callState.contesto === false ? "No" : "");
  const motivoCierre = contesto === "Sí" ? "" : callState.motivo;

  const registro = {
    id: Date.now(),
    comercial: COMERCIAL,
    contacto: callState.contacto,
    codigo: callState.codigo || "",
    fecha: callState.fecha,
    horaInicio: callState.horaInicio,
    horaContesta: callState.horaContesta,
    horaFin: callState.horaFin,
    duracion: formatDuration(callState.duracionSeg),
    duracionSeg: callState.duracionSeg,
    contesto: contesto,
    calidadLead: callState.calidadLead,
    interes: callState.interes,
    motivoNoContesto: motivoCierre,
    llamarLuego: callState.llamarLuego ? "Sí" : "No",
    fechaProxContacto: callState.fechaProxContacto,
    horaProxContacto: callState.horaProxContacto,
    nombre: callState.nombre,
    programa: callState.programa,
    carrera: callState.carrera,
    provincia: callState.provincia,
    edad: callState.edad,
    motivoNoInteres: callState.motivoNoInteres,
    observacion: callState.observacion,
    razonNuevaLlamada: callState.razonNuevaLlamada,
    demo: callState.demo,
    timestamp: new Date().toISOString(),
  };

  historial.unshift(registro);
  renderHistorial();
  updateGoalTracker();
  guardarLocal();

  enviarASheets(registro);

  showToast("Llamada registrada");
  resetCallState();
  showStage("start");

  // Ir a Pendientes después de guardar (para seguir con el siguiente)
  document.querySelector('.tab[data-tab="pending"]').click();
}

function enviarASheets(r) {
  const fila = {
    comercial: COMERCIAL,
    contacto: r.contacto,
    codigo: r.codigo,
    fecha: r.fecha,
    horaInicio: r.horaInicio,
    horaContesta: r.horaContesta,
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
    ventaCerrada: "",
    demo: r.demo || "",
  };

  fetch(SHEETS_WEBAPP_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(fila),
  }).then(() => console.log("Registro enviado:", fila.contacto))
    .catch(e => { console.warn(e); showToast("⚠ No se pudo subir a la hoja", true); });
}

/* ============================================================
   HISTORIAL DEL DÍA
   ============================================================ */
function renderHistorial() {
  const tbody = document.getElementById("historyBody");
  const empty = document.getElementById("historyEmpty");
  const count = document.getElementById("historyCount");
  const today = nowDate();
  const hoyList = historial.filter(r => r.fecha === today);
  count.textContent = hoyList.length;
  if (hoyList.length === 0) {
    tbody.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");
  tbody.innerHTML = hoyList.map(r => `
    <tr>
      <td class="mono">${escapeHtml(r.horaInicio)}</td>
      <td class="mono">${escapeHtml(r.contacto)}</td>
      <td>${escapeHtml(r.nombre) || "—"}</td>
      <td>${escapeHtml(r.contesto) || "—"}</td>
      <td class="mono">${escapeHtml(r.duracion)}</td>
      <td>${escapeHtml(r.interes) || "—"}</td>
      <td>${escapeHtml(r.calidadLead) || "—"}</td>
      <td>${escapeHtml(r.programa) || "—"}</td>
      <td>${escapeHtml(r.razonNuevaLlamada) || "—"}</td>
    </tr>
  `).join("");
}

/* ============================================================
   LLAMADAS PENDIENTES (KOMMO) — Vista A: chips de conteo
   ============================================================ */
const cacheConteos = { ts: 0, data: null };
const cacheLeads = {};   // { "TCI": { ts, leads }, ... }
const cacheFunnel = { ts: 0, data: null };
const CACHE_MS = 60_000; // 1 minuto

function cargarConteosKommo(forzar = false) {
  const chipsEl = document.getElementById("programChips");
  const sub = document.getElementById("pendingSub");

  // Mostrar siempre vista A primero
  document.getElementById("pendingProgramsView").classList.remove("hidden");
  document.getElementById("pendingLeadsView").classList.add("hidden");

  // Usar caché si está fresco
  if (!forzar && cacheConteos.data && (Date.now() - cacheConteos.ts) < CACHE_MS) {
    renderProgramChips(cacheConteos.data);
    return;
  }

  chipsEl.innerHTML = '<div class="empty-state-inline"><span class="spinner"></span><span>Cargando conteos…</span></div>';
  sub.textContent = "Conectando con Kommo…";

  jsonpGet({
    accion: "kommoConteos",
    comercial: COMERCIAL.toLowerCase(),
  }, (data) => {
    if (!data || !data.ok) {
      chipsEl.innerHTML = `<p class="error-text">No se pudo cargar: ${escapeHtml((data && data.error) || "error desconocido")}</p>`;
      sub.textContent = "Error al cargar conteos.";
      return;
    }
    cacheConteos.ts = Date.now();
    cacheConteos.data = data;
    renderProgramChips(data);
  });
}

function renderProgramChips(data) {
  const chipsEl = document.getElementById("programChips");
  const sub = document.getElementById("pendingSub");
  const badge = document.getElementById("pendingCount");

  const total = data.totalGeneral || 0;
  badge.textContent = total;

  if (!data.conteos || data.conteos.length === 0) {
    chipsEl.innerHTML = '<p class="muted">Sin leads pendientes.</p>';
    sub.textContent = "No tienes leads pendientes.";
    return;
  }

  sub.textContent = `Tienes ${total} leads pendientes en total. Elige un programa para empezar.`;

  chipsEl.innerHTML = data.conteos.map(c => {
    const dis = c.total === 0 ? "disabled" : "";
    return `
      <button class="program-chip ${dis}" data-programa="${escapeHtml(c.programa)}" ${dis}>
        <span class="program-chip-name">${escapeHtml(c.programa)}</span>
        <span class="program-chip-count">${c.total}</span>
      </button>
    `;
  }).join("");

  chipsEl.querySelectorAll(".program-chip:not(.disabled)").forEach(b => {
    b.addEventListener("click", () => {
      const prog = b.dataset.programa;
      mostrarLeadsPrograma(prog);
    });
  });
}

document.getElementById("btnRecargarPending").addEventListener("click", () => {
  // Si está en vista B (lista de leads de un programa), recargar esa lista
  const enVistaLeads = !document.getElementById("pendingLeadsView").classList.contains("hidden");
  if (enVistaLeads && programaActual) {
    mostrarLeadsPrograma(programaActual, true);  // forzar refresh
  } else {
    cargarConteosKommo(true);   // forzar refresh
  }
});

/* ============================================================
   LLAMADAS PENDIENTES (KOMMO) — Vista B: lista de leads
   ============================================================ */
let programaActual = null;
let leadsActuales = [];

function mostrarLeadsPrograma(programa, forzar = false) {
  programaActual = programa;

  document.getElementById("pendingProgramsView").classList.add("hidden");
  document.getElementById("pendingLeadsView").classList.remove("hidden");
  document.getElementById("leadsProgName").textContent = programa;

  // Caché por programa: si existe, usarlo (sin importar que haya
  // expirado). Solo se recarga si el usuario pide "↻ Actualizar".
  const ent = cacheLeads[programa];
  if (!forzar && ent) {
    leadsActuales = ent.leads;
    renderLeads();
    // Si el caché está viejo (>1 min), recargar en segundo plano
    if ((Date.now() - ent.ts) > CACHE_MS) {
      _recargarLeadsEnSegundoPlano(programa);
    }
    return;
  }

  document.getElementById("pendingLoading").classList.remove("hidden");
  document.getElementById("pendingLeadsEmpty").classList.add("hidden");
  document.getElementById("pendingLeadsBody").innerHTML = "";
  document.getElementById("leadsCounter").textContent = "(cargando…)";

  jsonpGet({
    accion: "kommoLeads",
    comercial: COMERCIAL.toLowerCase(),
    programa: programa,
  }, (data) => {
    document.getElementById("pendingLoading").classList.add("hidden");
    if (!data || !data.ok) {
      showToast("No se pudo cargar leads: " + ((data && data.error) || "error"), true);
      return;
    }
    leadsActuales = data.items || [];
    cacheLeads[programa] = { ts: Date.now(), leads: leadsActuales };
    renderLeads();
  });
}

// Recarga silenciosa en segundo plano (sin spinner ni interrupciones)
function _recargarLeadsEnSegundoPlano(programa) {
  jsonpGet({
    accion: "kommoLeads",
    comercial: COMERCIAL.toLowerCase(),
    programa: programa,
  }, (data) => {
    if (!data || !data.ok) return;
    cacheLeads[programa] = { ts: Date.now(), leads: data.items || [] };
    // Solo refrescar la vista si el usuario sigue mirando este programa
    if (programaActual === programa) {
      leadsActuales = data.items || [];
      renderLeads();
    }
  });
}

document.getElementById("btnVolverPrograms").addEventListener("click", () => {
  document.getElementById("pendingProgramsView").classList.remove("hidden");
  document.getElementById("pendingLeadsView").classList.add("hidden");
});

// Filtros de fase (checkboxes)
document.querySelectorAll(".phase-filter").forEach(cb => {
  cb.addEventListener("change", () => renderLeads());
});

function renderLeads() {
  const body = document.getElementById("pendingLeadsBody");
  const empty = document.getElementById("pendingLeadsEmpty");
  const counter = document.getElementById("leadsCounter");

  // Fases activas
  const fasesActivas = {};
  document.querySelectorAll(".phase-filter").forEach(cb => {
    if (cb.checked) fasesActivas[cb.value] = true;
  });

  const filtrados = leadsActuales.filter(l =>
    fasesActivas[String(l.ordenLlamada)]
  );

  counter.textContent = `(${filtrados.length})`;

  if (filtrados.length === 0) {
    body.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  body.innerHTML = filtrados.map(l => `
    <tr>
      <td class="mono"><strong>${escapeHtml(l.telefono) || "(sin tel)"}</strong></td>
      <td>${escapeHtml(l.nombre) || "—"}</td>
      <td>${escapeHtml(l.programa) || "—"}</td>
      <td><span class="situacion-badge">${escapeHtml(l.etiqueta)}</span></td>
      <td>
        <button class="btn btn-primary btn-sm btn-llamar"
                data-lead='${JSON.stringify({
                  id: l.kommoLeadId,
                  tel: l.telefono,
                  nombre: l.nombre,
                  prog: l.programa,
                  sit: l.etiqueta,
                  etapa: l.etapaNombre
                }).replace(/'/g,"&#39;")}'>
          📞 Llamar
        </button>
      </td>
    </tr>
  `).join("");

  body.querySelectorAll(".btn-llamar").forEach(b => {
    b.addEventListener("click", () => {
      const datos = JSON.parse(b.dataset.lead.replace(/&#39;/g,"'"));
      llamarLeadDesdeKommo(datos);
    });
  });
}

function llamarLeadDesdeKommo(d) {
  // Ir a Registrar
  document.querySelector('.tab[data-tab="register"]').click();

  // Llenar input contacto
  const tel = String(d.tel || "").replace(/\D/g, "").slice(0, 11);
  inputContacto.value = tel;
  inputContacto.dispatchEvent(new Event("input", { bubbles: true }));

  // Guardar info básica del lead (lo que ya tenemos de la lista)
  leadVinculado = {
    id: d.id,
    nombre: d.nombre || "",
    programa: d.prog || "",
    situacion: d.sit || "",
    etapa: d.etapa || "",
    embudoNombre: "",
    // Lo demás se llena cuando responde el endpoint kommoLeadDetalle
    universidad: "", carrera: "", ciclo: "", distrito: "",
    presupuesto: "", descuentoOtorgado: "", comentariosCierre: "",
    objeciones: "", exEntrenado: "",
    notas: []
  };
  callState.codigo = String(d.id || "");
  callState.programa = d.prog || "";
  callState.nombre = d.nombre || "";

  // Mostrar ficha con datos básicos primero, mientras se cargan los detalles
  renderLeadCard(leadVinculado);
  showRightPanel("loading");

  // Pedir detalle completo a Kommo
  jsonpGet({
    accion: "kommoLeadDetalle",
    leadId: d.id,
  }, (resp) => {
    if (!resp || !resp.ok) {
      // Mostramos lo que ya tenemos (datos básicos)
      renderLeadCard(leadVinculado);
      showRightPanel("lead");
      showToast("No se pudo cargar detalle completo: " + ((resp && resp.error) || "error"), true);
      return;
    }
    const det = resp.lead;
    // Mezclar con leadVinculado existente
    Object.assign(leadVinculado, det);
    // Mantener la situación amigable que ya tenemos
    leadVinculado.situacion = d.sit || det.etapaNombre;

    renderLeadCard(leadVinculado);
    showRightPanel("lead");
  });

  showToast(`Lead ${d.nombre} listo. Presiona "Iniciar llamada".`);
}

// Pinta la ficha del lead en la columna derecha
function renderLeadCard(L) {
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val || "—";
  };

  set("lcName", L.nombre);
  set("lcCodigo", L.id);
  set("lcPrograma", L.programa);
  set("lcSituacion", L.situacion);
  set("lcEmbudo", L.embudoNombre);
  set("lcUniversidad", L.universidad);
  set("lcCarrera", L.carrera);
  set("lcCiclo", L.ciclo);
  set("lcDistrito", L.distrito);
  set("lcPresupuesto", L.presupuesto);
  set("lcDescuento", L.descuentoOtorgado);
  set("lcCierre", L.comentariosCierre);
  set("lcObjeciones", L.objeciones);
  set("lcExEntrenado", L.exEntrenado);

  // Notas: solo con contenido
  const notasEl = document.getElementById("lcNotas");
  const wrap = document.getElementById("lcNotasWrap");
  const notas = (L.notas || []).filter(n => n.texto && n.texto.trim());

  if (notas.length === 0) {
    wrap.classList.add("hidden");
    notasEl.innerHTML = "";
  } else {
    wrap.classList.remove("hidden");
    notasEl.innerHTML = notas.map(n => {
      const fechaCorta = (n.fecha || "").substring(0, 10);
      return `
        <div class="lead-note-item">
          <div class="lead-note-date">${escapeHtml(fechaCorta)}</div>
          <div class="lead-note-text">${escapeHtml(n.texto)}</div>
        </div>
      `;
    }).join("");
  }
}

/* ============================================================
   REPORTE DE EMBUDOS
   ============================================================ */
function cargarReporteEmbudos(forzar = false) {
  const body = document.getElementById("funnelBody");
  const empty = document.getElementById("funnelEmpty");
  const loading = document.getElementById("funnelLoading");

  // Usar caché si existe y está fresco (y no se forzó refresh)
  if (!forzar && cacheFunnel.data && (Date.now() - cacheFunnel.ts) < CACHE_MS) {
    renderFunnel(cacheFunnel.data);
    return;
  }

  loading.classList.remove("hidden");
  empty.classList.add("hidden");
  body.innerHTML = "";

  jsonpGet({
    accion: "kommoLeads",
    comercial: COMERCIAL.toLowerCase(),
  }, (data) => {
    loading.classList.add("hidden");
    if (!data || !data.ok) {
      showToast("No se pudo cargar: " + ((data && data.error) || "error"), true);
      return;
    }
    cacheFunnel.ts = Date.now();
    cacheFunnel.data = data.items || [];
    renderFunnel(cacheFunnel.data);
  });
}

function renderFunnel(items) {
  const body = document.getElementById("funnelBody");
  const foot = document.getElementById("funnelFoot");
  const empty = document.getElementById("funnelEmpty");

  if (items.length === 0) {
    empty.classList.remove("hidden");
    return;
  }

  // Agrupar por programa + fase
  // ordenLlamada: 0=Info, 1=NoCont1, 2=NoCont2, 3=NoCont3
  const grupos = {};
  items.forEach(l => {
    if (!grupos[l.programa]) grupos[l.programa] = [0,0,0,0];
    if (l.ordenLlamada >= 0 && l.ordenLlamada <= 3) {
      grupos[l.programa][l.ordenLlamada]++;
    }
  });

  // Totales
  const tot = [0,0,0,0];
  Object.values(grupos).forEach(arr => arr.forEach((v,i) => tot[i]+=v));

  // Ordenar programas por total descendente
  const orden = Object.keys(grupos).sort((a,b) =>
    grupos[b].reduce((s,x)=>s+x,0) - grupos[a].reduce((s,x)=>s+x,0)
  );

  body.innerHTML = orden.map(p => {
    const a = grupos[p];
    const total = a.reduce((s,x)=>s+x,0);
    return `
      <tr>
        <td><strong>${escapeHtml(p)}</strong></td>
        <td class="num">${a[0]}</td>
        <td class="num">${a[1]}</td>
        <td class="num">${a[2]}</td>
        <td class="num">${a[3]}</td>
        <td class="num"><strong>${total}</strong></td>
      </tr>
    `;
  }).join("");

  const totGeneral = tot.reduce((s,x)=>s+x,0);
  foot.innerHTML = `
    <th>Total</th>
    <th class="num">${tot[0]}</th>
    <th class="num">${tot[1]}</th>
    <th class="num">${tot[2]}</th>
    <th class="num">${tot[3]}</th>
    <th class="num">${totGeneral}</th>
  `;
}

document.getElementById("btnRecargarFunnel").addEventListener("click", () => {
  cargarReporteEmbudos(true);
});

/* ============================================================
   JSONP HELPER (esquiva CORS para llamar al Apps Script)
   ============================================================ */
function jsonpGet(params, cb) {
  const cbName = "jsonp_" + Date.now() + "_" + Math.floor(Math.random()*100000);
  let timeoutId = null;
  let s = null;

  function cleanup() {
    if (timeoutId) clearTimeout(timeoutId);
    if (s && s.parentNode) s.parentNode.removeChild(s);
    try { delete window[cbName]; } catch(e) { window[cbName] = undefined; }
  }

  window[cbName] = function(data) { cleanup(); cb(data); };

  const qs = Object.entries(params).map(([k,v]) =>
    `${encodeURIComponent(k)}=${encodeURIComponent(v)}`
  ).join("&");

  s = document.createElement("script");
  s.src = `${SHEETS_WEBAPP_URL}?${qs}&callback=${cbName}&t=${Date.now()}`;
  s.onerror = () => { cleanup(); cb({ ok:false, error:"Error de conexión" }); };

  timeoutId = setTimeout(() => {
    cleanup();
    cb({ ok:false, error:"Tiempo agotado (>30s)" });
  }, 30000);

  document.body.appendChild(s);
}

/* ============================================================
   INICIALIZACIÓN
   ============================================================ */
cargarLocal();
renderHistorial();
updateGoalTracker();
showStage("start");
// Al cargar la página, ya cargar los conteos para que estén listos
cargarConteosKommo();
