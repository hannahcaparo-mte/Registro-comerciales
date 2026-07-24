/* ============================================================
   REGISTRO COMERCIAL · script_natalia.js
   Rediseño 2026-07: formulario siempre visible, ficha mini
   ============================================================ */

const COMERCIAL = "Nirvana";
const STORAGE_KEY = "registroNirvana_v4";
const SHEETS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbxDlC3YncCd7D_MgI6KJjTywR74IRvEVXa4wvAMslUyXBQ3A7Xn5hqD5NjPARGDP48BmA/exec";

/* ============================================================
   ESTADO GLOBAL
   ============================================================ */
let historial = [];
let timerInterval = null;
let timerStart = null;
let leadVinculado = null;

const callState = {
  // básicos
  contacto: "",
  codigo: "",
  fecha: "",
  horaInicio: "",
  horaContesta: "",
  horaFin: "",
  duracionSeg: 0,
  contesto: null,       // true/false
  // formulario nuevo
  nombre: "",
  programa: "",
  universidad: "",
  carrera: "",
  ciclo: "",
  provincia: "",         // Sí/No
  edad: "",              // Sí/No
  conversacion: "",      // Sí/No
  calidadLead: "",       // Caliente/Tibio/Frío
  demo: "",              // Sí/No
  situacionDemo: "",     // Interesado/Confirma asistencia/No interesado
  fechaDemoConfirmada: "",
  descuento: "",         // Sí/No
  descuentoOfrecido: "", // %
  ventaCerrada: "",      // Sí/No (lead ganado)
  llamarLuego: "",       // Sí/No
  fechaProxContacto: "",
  horaProxContacto: "",
  razonLlamada: "",
  nota: "",
};

/* ============================================================
   LOCAL STORAGE (historial)
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
      return;
    }
    historial = data.historial || [];
  } catch (e) { console.warn(e); }
}

/* ============================================================
   TIEMPO
   ============================================================ */
function nowTime() { return new Date().toTimeString().slice(0, 8); }
function nowDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function nowDateBonita() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
}
function formatDuration(seg) {
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  const s = seg % 60;
  return `${String(h).padStart(1,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

function startTimer() {
  timerStart = Date.now();
  const el = document.getElementById("callTimer");
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const seg = Math.floor((Date.now() - timerStart) / 1000);
    callState.duracionSeg = seg;
    if (el) el.textContent = formatDuration(seg).replace(/^0:/, "");  // 05:23 en vez de 0:05:23
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
  const hoy = historial.filter(r => r.fecha === today).length;
  const meta = getMetaDelDia();
  const el1 = document.getElementById("goalCurrent");
  const el2 = document.getElementById("goalTotal");
  const bar = document.getElementById("goalBarFill");
  if (el1) el1.textContent = hoy;
  if (el2) el2.textContent = meta;
  if (bar) bar.style.width = Math.min(100, (hoy / meta) * 100) + "%";
}

/* ============================================================
   RELOJ
   ============================================================ */
function updateClock() {
  const d = new Date();
  const t = document.getElementById("currentTime");
  const f = document.getElementById("currentDate");
  if (t) t.textContent = d.toLocaleTimeString("es-PE", { hour12: false });
  if (f) f.textContent = d.toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "short" });
}
updateClock();
setInterval(updateClock, 1000);

/* ============================================================
   TABS
   ============================================================ */
const tabs = document.querySelectorAll(".tab");
const panels = document.querySelectorAll(".tab-panel");

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.tab;
    tabs.forEach(t => t.classList.toggle("active", t === tab));
    panels.forEach(p => p.classList.toggle("active", p.id === `panel-${target}`));

    if (target === "pending") {
      if (programaActual && cacheLeads[programaActual]) {
        mostrarLeadsPrograma(programaActual);
      } else if (cacheConteos.data) {
        renderProgramChips(cacheConteos.data);
        document.getElementById("pendingProgramsView").classList.remove("hidden");
        document.getElementById("pendingLeadsView").classList.add("hidden");
      } else {
        cargarConteosKommo();
      }
    }
    if (target === "funnel") {
      if (cacheFunnel.data) renderFunnel(cacheFunnel.data);
      else cargarReporteEmbudos();
    }
    if (target === "history") renderHistorial();
  });
});

/* ============================================================
   TOAST
   ============================================================ */
function showToast(msg, error = false) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.toggle("error", !!error);
  t.classList.add("visible");
  setTimeout(() => t.classList.remove("visible"), 3000);
}
function escapeHtml(s) {
  if (s == null) return "";
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

/* ============================================================
   ESTADOS: fase de la llamada
   Fase A (idle): botón Iniciar visible, no timer
   Fase B (en llamada): timer + sí/no contestó
   Fase C (contestó, hablando): timer + fin interacción
   Fase D (finalizada): solo formulario visible, botón Guardar
   ============================================================ */
function setEstadoLlamada(estado) {
  const btnIniciar = document.getElementById("btnIniciar");
  const btnCancelar = document.getElementById("btnCancelarLlamada");
  const timer = document.getElementById("callTimerBox");
  const ph2 = document.getElementById("callPhase2Actions");
  const ph3 = document.getElementById("callPhase3Actions");

  if (estado === "idle") {
    btnIniciar.classList.remove("hidden");
    btnCancelar.classList.remove("hidden");
    timer.classList.add("hidden");
    ph2.classList.add("hidden");
    ph3.classList.add("hidden");
  } else if (estado === "marcando") {
    btnIniciar.classList.add("hidden");
    btnCancelar.classList.remove("hidden");
    timer.classList.remove("hidden");
    ph2.classList.remove("hidden");
    ph3.classList.add("hidden");
  } else if (estado === "hablando") {
    btnIniciar.classList.add("hidden");
    btnCancelar.classList.remove("hidden");
    timer.classList.remove("hidden");
    ph2.classList.add("hidden");
    ph3.classList.remove("hidden");
  } else if (estado === "finalizada") {
    btnIniciar.classList.add("hidden");
    btnCancelar.classList.remove("hidden");
    timer.classList.remove("hidden");
    ph2.classList.add("hidden");
    ph3.classList.add("hidden");
  }
}

/* ============================================================
   RESET
   ============================================================ */
function resetCallState() {
  Object.keys(callState).forEach(k => {
    if (typeof callState[k] === "number") callState[k] = 0;
    else if (typeof callState[k] === "boolean") callState[k] = false;
    else callState[k] = "";
  });
  callState.contesto = null;
  leadVinculado = null;

  // Limpiar chips
  document.querySelectorAll("#panel-register .chip.selected").forEach(c => c.classList.remove("selected"));

  // Limpiar inputs del formulario
  ["nombreLead","programaInteres","universidad","carrera","ciclo",
   "situacionDemo","fechaDemoConfirmada","descuentoOfrecido",
   "proxContacto","proxHoraH","proxHoraM","razonLlamada","nota",
   "inputContacto"].forEach(id => {
    const e = document.getElementById(id); if (e) e.value = "";
  });
  const apEl = document.getElementById("proxHoraAP");
  if (apEl) apEl.value = "p.m.";

  // Ocultar wrappers condicionales
  ["situacionDemoWrap","fechaDemoWrap","descuentoOfrecidoWrap","proxContactoWrap"].forEach(id => {
    const e = document.getElementById(id); if (e) e.classList.add("hidden");
  });

  // Ocultar ficha mini
  document.getElementById("leadMiniCard").classList.add("hidden");

  // Timer
  stopTimer();
  const t = document.getElementById("callTimer"); if (t) t.textContent = "00:00";

  // Botón iniciar deshabilitado hasta que haya 11 dígitos
  document.getElementById("btnIniciar").disabled = true;

  setEstadoLlamada("idle");
}

/* ============================================================
   CHIP GROUPS
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

function marcarChip(groupId, valor) {
  const g = document.getElementById(groupId);
  if (!g) return;
  g.querySelectorAll(".chip").forEach(c => c.classList.remove("selected"));
  if (!valor) return;
  const target = g.querySelector(`.chip[data-value="${valor}"]`);
  if (target) target.classList.add("selected");
}

setupChipGroup("provinciaGroup",   v => callState.provincia = v);
setupChipGroup("edadGroup",        v => callState.edad = v);
setupChipGroup("conversacionGroup", v => callState.conversacion = v);
setupChipGroup("calidadGroup",     v => callState.calidadLead = v);
setupChipGroup("demoGroup",        v => {
  callState.demo = v;
  document.getElementById("situacionDemoWrap").classList.toggle("hidden", v !== "Sí");
  if (v !== "Sí") {
    callState.situacionDemo = "";
    document.getElementById("situacionDemo").value = "";
    document.getElementById("fechaDemoWrap").classList.add("hidden");
    document.getElementById("fechaDemoConfirmada").value = "";
  }
});
setupChipGroup("descuentoGroup",   v => {
  callState.descuento = v;
  document.getElementById("descuentoOfrecidoWrap").classList.toggle("hidden", v !== "Sí");
  if (v !== "Sí") {
    callState.descuentoOfrecido = "";
    document.getElementById("descuentoOfrecido").value = "";
  }
});
setupChipGroup("ventaGroup",       v => callState.ventaCerrada = v);
setupChipGroup("llamarLuegoGroup", v => {
  callState.llamarLuego = v;
  document.getElementById("proxContactoWrap").classList.toggle("hidden", v !== "Sí");
});

// Situación demo: si es "Confirma asistencia", mostrar fecha
document.getElementById("situacionDemo").addEventListener("change", (e) => {
  callState.situacionDemo = e.target.value;
  document.getElementById("fechaDemoWrap").classList.toggle("hidden", e.target.value !== "Confirma asistencia");
});

/* ============================================================
   INPUT CONTACTO
   ============================================================ */
const inputContacto = document.getElementById("inputContacto");
const btnIniciar = document.getElementById("btnIniciar");

inputContacto.addEventListener("input", (e) => {
  const filtered = e.target.value.replace(/\D/g, "").slice(0, 11);
  e.target.value = filtered;
  btnIniciar.disabled = filtered.length !== 11;
});

/* ============================================================
   TOGGLE FICHA MINI (+/-)
   ============================================================ */
document.getElementById("btnToggleLeadMini").addEventListener("click", () => {
  const content = document.getElementById("leadMiniContent");
  const btn = document.getElementById("btnToggleLeadMini");
  if (content.classList.contains("collapsed")) {
    content.classList.remove("collapsed");
    btn.textContent = "−";
  } else {
    content.classList.add("collapsed");
    btn.textContent = "+";
  }
});

/* ============================================================
   INICIAR LLAMADA
   ============================================================ */
btnIniciar.addEventListener("click", () => {
  const contacto = inputContacto.value.trim();
  if (!/^\d{11}$/.test(contacto)) {
    showToast("Ingresa 11 dígitos válidos", true);
    return;
  }

  const tipo = document.getElementById("tipoLlamada").value;
  if (tipo === "Llamada por cobranza") {
    showToast("Llamada por cobranza — Próximamente", true);
    return;
  }

  callState.contacto = contacto;
  callState.fecha = nowDate();
  callState.horaInicio = nowTime();

  document.getElementById("dispHoraInicio").textContent = callState.horaInicio;
  document.getElementById("dispHoraRespBox").classList.add("hidden");

  startTimer();
  setEstadoLlamada("marcando");
});

/* ============================================================
   CANCELAR LLAMADA
   ============================================================ */
document.getElementById("btnCancelarLlamada").addEventListener("click", () => {
  if (confirm("¿Cancelar? Se perderán todos los datos ingresados.")) {
    resetCallState();
  }
});

/* ============================================================
   FLUJO SI/NO CONTESTÓ
   ============================================================ */
document.getElementById("btnRespondio").addEventListener("click", () => {
  callState.contesto = true;
  callState.horaContesta = nowTime();
  document.getElementById("dispHoraResp").textContent = callState.horaContesta;
  document.getElementById("dispHoraRespBox").classList.remove("hidden");
  setEstadoLlamada("hablando");
  marcarChip("conversacionGroup", "Sí");
  callState.conversacion = "Sí";
});

document.getElementById("btnNoRespondio").addEventListener("click", () => {
  callState.contesto = false;
  callState.horaContesta = "";
  stopTimer();
  callState.horaFin = nowTime();
  document.getElementById("dispHoraRespBox").classList.add("hidden");
  setEstadoLlamada("finalizada");
  marcarChip("conversacionGroup", "No");
  callState.conversacion = "No";
});

document.getElementById("btnFinInteraccion").addEventListener("click", () => {
  stopTimer();
  callState.horaFin = nowTime();
  setEstadoLlamada("finalizada");
});

/* ============================================================
   RECOLECTAR + GUARDAR
   ============================================================ */
function recolectarFormulario() {
  callState.nombre = document.getElementById("nombreLead").value.trim();
  callState.programa = document.getElementById("programaInteres").value.trim();
  callState.universidad = document.getElementById("universidad").value.trim();
  callState.carrera = document.getElementById("carrera").value;
  callState.ciclo = document.getElementById("ciclo").value;
  callState.situacionDemo = document.getElementById("situacionDemo").value;
  callState.fechaDemoConfirmada = document.getElementById("fechaDemoConfirmada").value;
  callState.descuentoOfrecido = document.getElementById("descuentoOfrecido").value;
  callState.razonLlamada = document.getElementById("razonLlamada").value;
  callState.nota = document.getElementById("nota").value.trim();

  if (callState.llamarLuego === "Sí") {
    callState.fechaProxContacto = document.getElementById("proxContacto").value;
    callState.horaProxContacto = composeTime("proxHoraH","proxHoraM","proxHoraAP");
  } else {
    callState.fechaProxContacto = "";
    callState.horaProxContacto = "";
  }
}

function composeTime(h, m, ap) {
  const hh = document.getElementById(h).value;
  const mm = document.getElementById(m).value || "00";
  const apRaw = document.getElementById(ap).value;
  if (!hh) return "";
  const esPM = String(apRaw||"").toLowerCase().includes("p");
  return `${hh}:${mm} ${esPM ? "p.m." : "a.m."}`;
}

document.getElementById("btnGuardarLlamada").addEventListener("click", () => {
  recolectarFormulario();
  saveCall();
});

function saveCall() {
  // Si estaba en marcha y no cerraron, cerramos ahora
  if (timerInterval) stopTimer();
  if (!callState.horaFin) callState.horaFin = nowTime();

  const contesto = callState.contesto === true ? "Sí" :
                   callState.contesto === false ? "No" : "";

  const registro = {
    id: Date.now(),
    comercial: COMERCIAL,
    contacto: callState.contacto,
    codigo: callState.codigo,
    fecha: callState.fecha || nowDate(),
    fechaRegistroBonita: nowDateBonita(),
    horaInicio: callState.horaInicio,
    horaContesta: callState.horaContesta,
    horaFin: callState.horaFin,
    duracion: formatDuration(callState.duracionSeg),
    duracionSeg: callState.duracionSeg,
    contesto: contesto,
    conversacion: callState.conversacion,
    razonLlamada: callState.razonLlamada,
    calidadLead: callState.calidadLead,
    programa: callState.programa,
    carrera: callState.carrera,
    universidad: callState.universidad,
    ciclo: callState.ciclo,
    provincia: callState.provincia,
    edad: callState.edad,
    llamarLuego: callState.llamarLuego,
    nombre: callState.nombre,
    fechaProxContacto: callState.fechaProxContacto,
    horaProxContacto: callState.horaProxContacto,
    nota: callState.nota,
    demo: callState.demo,
    situacionDemo: callState.situacionDemo,
    fechaDemoConfirmada: callState.fechaDemoConfirmada,
    descuento: callState.descuento,
    descuentoOfrecido: callState.descuentoOfrecido ? callState.descuentoOfrecido + "%" : "",
    ventaCerrada: callState.ventaCerrada,
    timestamp: new Date().toISOString(),
  };

  historial.unshift(registro);
  renderHistorial();
  updateGoalTracker();
  guardarLocal();
  enviarASheets(registro);

  showToast("Llamada registrada");
  resetCallState();

  // Ir a Pendientes
  document.querySelector('.tab[data-tab="pending"]').click();
}

function enviarASheets(r) {
  // Estructura de 29 columnas según nueva hoja
  const fila = {
    comercial: r.comercial,
    contacto: r.contacto,
    codigo: r.codigo,
    fechaRegistro: r.fechaRegistroBonita,
    horaInicio: r.horaInicio,
    horaContesta: r.horaContesta,
    horaFin: r.horaFin,
    contesto: r.contesto,
    conversacion: r.conversacion,
    duracion: r.duracion,
    razonLlamada: r.razonLlamada,
    calidadLead: r.calidadLead,
    programa: r.programa,
    carrera: r.carrera,
    universidad: r.universidad,
    ciclo: r.ciclo,
    provincia: r.provincia,
    edad: r.edad,
    llamarLuego: r.llamarLuego,
    nombre: r.nombre,
    fechaProxContacto: r.fechaProxContacto,
    horaProxContacto: r.horaProxContacto,
    nota: r.nota,
    demo: r.demo,
    situacionDemo: r.situacionDemo,
    fechaDemoConfirmada: r.fechaDemoConfirmada,
    descuento: r.descuento,
    descuentoOfrecido: r.descuentoOfrecido,
    ventaCerrada: r.ventaCerrada,
  };

  fetch(SHEETS_WEBAPP_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(fila),
  }).then(() => console.log("Registrado:", fila.contacto))
    .catch(e => { console.warn(e); showToast("⚠ No se pudo subir a la hoja", true); });
}

/* ============================================================
   VINCULAR LEAD DESDE PENDIENTES
   ============================================================ */
function llamarLeadDesdeKommo(d) {
  document.querySelector('.tab[data-tab="register"]').click();

  const tel = String(d.tel || "").replace(/\D/g, "").slice(0, 11);
  inputContacto.value = tel;
  inputContacto.dispatchEvent(new Event("input", { bubbles: true }));

  leadVinculado = {
    id: d.id, nombre: d.nombre || "", programa: d.prog || "",
    situacion: d.sit || "", etapa: d.etapa || "",
    universidad: "", carrera: "", ciclo: "", distrito: "",
    presupuesto: "", descuentoOtorgado: "", comentariosCierre: "",
    objeciones: "", exEntrenado: "", notas: []
  };
  callState.codigo = String(d.id || "");
  callState.programa = d.prog || "";
  callState.nombre = d.nombre || "";

  // Prellenar campos del formulario que sabemos
  document.getElementById("nombreLead").value = leadVinculado.nombre;
  document.getElementById("programaInteres").value = leadVinculado.programa;

  // Mostrar mini card (con loading)
  document.getElementById("leadMiniCard").classList.remove("hidden");
  document.getElementById("leadMiniContent").classList.remove("collapsed");
  document.getElementById("btnToggleLeadMini").textContent = "−";
  document.getElementById("lcmPrograma").textContent = leadVinculado.programa || "—";
  document.getElementById("lcmSituacion").textContent = leadVinculado.situacion || "—";
  document.getElementById("lcmNotasWrap").classList.add("hidden");
  document.getElementById("lcmLoading").classList.remove("hidden");

  // Traer detalle desde Kommo (custom fields + notas)
  jsonpGet({ accion: "kommoLeadDetalle", leadId: d.id }, (resp) => {
    document.getElementById("lcmLoading").classList.add("hidden");
    if (!resp || !resp.ok) {
      showToast("No se pudo cargar detalle: " + ((resp && resp.error) || "error"), true);
      return;
    }
    const det = resp.lead;
    Object.assign(leadVinculado, det);
    leadVinculado.situacion = d.sit || det.etapaNombre;

    // Actualizar ficha mini
    document.getElementById("lcmPrograma").textContent = leadVinculado.programa || "—";
    document.getElementById("lcmSituacion").textContent = leadVinculado.situacion || "—";
    renderNotasMini(det.notas || []);

    // Prellenar campos del formulario que vengan de Kommo
    const setIf = (id, val) => {
      const e = document.getElementById(id);
      if (e && val && !e.value) e.value = val;
    };
    setIf("universidad", det.universidad);
    setIf("ciclo", det.ciclo);
    // Distrito → Provincia (sí/no) NO se prellena porque son campos distintos ahora
  });

  showToast(`Lead ${leadVinculado.nombre} listo. Presiona "Iniciar llamada".`);
}

function renderNotasMini(notas) {
  const wrap = document.getElementById("lcmNotasWrap");
  const cont = document.getElementById("lcmNotas");
  const filtradas = (notas || []).filter(n => n.texto && n.texto.trim());
  if (filtradas.length === 0) {
    wrap.classList.add("hidden");
    cont.innerHTML = "";
    return;
  }
  wrap.classList.remove("hidden");
  cont.innerHTML = filtradas.slice(0, 5).map(n => `
    <div class="lead-note-item">
      <div class="lead-note-date">${escapeHtml((n.fecha||"").substring(0,10))}</div>
      <div class="lead-note-text">${escapeHtml(n.texto)}</div>
    </div>
  `).join("");
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
resetCallState();
// Al cargar la página, ya cargar los conteos para que estén listos
cargarConteosKommo();
