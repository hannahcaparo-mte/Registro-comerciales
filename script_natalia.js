/* ============================================================
   REGISTRO COMERCIAL · NATALIA
   Formulario siempre visible. Botones "Llamando" y "Fin"
   solo marcan las horas internamente (opcionales).
   ============================================================ */

const COMERCIAL = "NATALIA";
const STORAGE_KEY = "reg_natalia_v5";
const PENDING_KEY = "reg_natalia_v5_pending";
const SHEETS_WEBAPP_URL = "PONER_URL_AQUI";

// META personalizable por comercial: default 50 lun-vie, 25 sábado
const META_LUN_VIE = 50;
const META_SABADO  = 25;

/* ============================================================
   ESTADO
   ============================================================ */
let historial = [];
let pendientes = [];

const callState = {
  celular: "",
  fuente: "",
  programa: "",
  contesto: "",
  calidad: "",
  conversacion: "",
  llamarLuego: false,
  carrera: "",
  provincia: "",
  edad: "",
  nota: "",
  horaInicio: "",   // se toma al apretar "Llamando"
  horaFin: "",      // se toma al apretar "Fin de interacción"
  fecha: "",        // se toma al apretar "Llamando" (o al Guardar como fallback)
};

/* ============================================================
   UTIL
   ============================================================ */
function nowTime() { return new Date().toTimeString().slice(0, 8); }
function nowDateBonita() {
  const d = new Date();
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}
function nowDateISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ============================================================
   META DEL DÍA
   ============================================================ */
function getMetaDelDia() {
  const d = new Date();
  return d.getDay() === 6 ? META_SABADO : META_LUN_VIE;
}
function actualizarMeta() {
  const hoy = historial.length;
  const meta = getMetaDelDia();
  document.getElementById("goalCurrent").textContent = hoy;
  document.getElementById("goalTotal").textContent = meta;
  const pct = Math.min(100, (hoy / meta) * 100);
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
    d.toLocaleDateString("es-PE", { day: "numeric", month: "short" });
}
updateClock();
setInterval(updateClock, 1000);

/* ============================================================
   LOCAL STORAGE
   ============================================================ */
function saveHistorialLocal() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      fecha: nowDateISO(),
      historial: historial
    }));
  } catch (e) { console.warn(e); }
}
function loadHistorialLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    if (d.fecha !== nowDateISO()) {
      localStorage.removeItem(STORAGE_KEY);
      historial = [];
    } else {
      historial = d.historial || [];
    }
  } catch (e) { console.warn(e); }
}
function savePendientesLocal() {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(pendientes)); }
  catch (e) { console.warn(e); }
}
function loadPendientesLocal() {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    pendientes = raw ? JSON.parse(raw) : [];
  } catch (e) { pendientes = []; }
}

/* ============================================================
   TOAST
   ============================================================ */
function showToast(msg, err = false) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.toggle("error", !!err);
  t.classList.add("visible");
  setTimeout(() => t.classList.remove("visible"), 3000);
}
function escapeHtml(s) {
  if (s == null) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/* ============================================================
   TABS
   ============================================================ */
document.querySelectorAll(".tab").forEach(t => {
  t.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(x =>
      x.classList.toggle("active", x === t));
    document.querySelectorAll(".tab-panel").forEach(p =>
      p.classList.toggle("active", p.id === `panel-${t.dataset.tab}`));
    if (t.dataset.tab === "history") renderHistorial();
  });
});

/* ============================================================
   CHIPS
   ============================================================ */
function setupChipGroup(groupId, onSelect) {
  const g = document.getElementById(groupId);
  if (!g) return;
  g.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    if (chip.classList.contains("selected")) {
      chip.classList.remove("selected");
      onSelect("");
    } else {
      g.querySelectorAll(".chip").forEach(c => c.classList.remove("selected"));
      chip.classList.add("selected");
      onSelect(chip.dataset.value);
    }
  });
}
setupChipGroup("contestoGroup",     v => callState.contesto = v);
setupChipGroup("conversacionGroup", v => callState.conversacion = v);
setupChipGroup("calidadGroup",      v => callState.calidad = v);
setupChipGroup("provinciaGroup",    v => callState.provincia = v);
setupChipGroup("edadGroup",         v => callState.edad = v);

document.getElementById("fuente").addEventListener("change",  e => callState.fuente = e.target.value);
document.getElementById("programa").addEventListener("change", e => callState.programa = e.target.value);
document.getElementById("carrera").addEventListener("change",  e => callState.carrera = e.target.value);
document.getElementById("llamarLuego").addEventListener("change", e => callState.llamarLuego = e.target.checked);

/* ============================================================
   CELULAR
   ============================================================ */
const celularInput = document.getElementById("celular");
celularInput.addEventListener("input", (e) => {
  e.target.value = e.target.value.replace(/\D/g, "").slice(0, 11);
  callState.celular = e.target.value;
});

/* ============================================================
   BOTONES DE TIEMPO (Llamando / Fin) — opcionales
   ============================================================ */
const btnLlamando = document.getElementById("btnLlamando");
const btnFin = document.getElementById("btnFinInteraccion");
const callStatus = document.getElementById("callStatus");

btnLlamando.addEventListener("click", () => {
  callState.horaInicio = nowTime();
  callState.fecha = nowDateBonita();
  btnLlamando.disabled = true;
  btnLlamando.textContent = "✓ En llamada";
  btnFin.disabled = false;
  callStatus.textContent = "📞 Llamada en curso…";
  callStatus.className = "call-status active";
});

btnFin.addEventListener("click", () => {
  callState.horaFin = nowTime();
  btnFin.disabled = true;
  btnFin.textContent = "✓ Finalizada";
  callStatus.textContent = "✓ Llamada finalizada. Completa el formulario y guarda.";
  callStatus.className = "call-status done";
});

/* ============================================================
   GUARDAR
   ============================================================ */
document.getElementById("btnGuardar").addEventListener("click", () => {
  // Validaciones mínimas
  if (!callState.celular || callState.celular.length !== 11) {
    showToast("Ingresa un celular de 11 dígitos", true);
    document.getElementById("celular").focus();
    return;
  }
  if (!callState.contesto) {
    showToast("Marca si contestó o no", true);
    return;
  }

  // Fallbacks para horas y fecha si no apretaron los botones
  const registro = {
    _id: Date.now() + "-" + Math.random().toString(36).slice(2, 8),
    _fecha_iso: nowDateISO(),
    comercial: COMERCIAL,
    celular: callState.celular,
    fuente: callState.fuente,
    programa: callState.programa,
    contesto: callState.contesto,
    calidad: callState.calidad,
    conversacion: callState.conversacion,
    llamarLuego: callState.llamarLuego ? "SI" : "",
    carrera: callState.carrera,
    provincia: callState.provincia,
    edad: callState.edad,
    nota: document.getElementById("nota").value.trim(),
    horaInicio: callState.horaInicio || nowTime(),
    horaFin: callState.horaFin || nowTime(),
    fecha: callState.fecha || nowDateBonita(),
  };

  historial.unshift(registro);
  saveHistorialLocal();
  actualizarMeta();

  pendientes.push(registro);
  savePendientesLocal();

  showToast("✅ Guardado. Enviando a la hoja…");
  limpiarFormulario();
  sincronizarPendientes();
});

/* ============================================================
   LIMPIAR FORMULARIO
   ============================================================ */
function limpiarFormulario() {
  Object.keys(callState).forEach(k => {
    if (typeof callState[k] === "boolean") callState[k] = false;
    else callState[k] = "";
  });

  document.querySelectorAll("#panel-register .chip.selected")
    .forEach(c => c.classList.remove("selected"));
  document.getElementById("celular").value = "";
  document.getElementById("fuente").value = "";
  document.getElementById("programa").value = "";
  document.getElementById("carrera").value = "";
  document.getElementById("nota").value = "";
  document.getElementById("llamarLuego").checked = false;

  // Resetear botones de tiempo
  btnLlamando.disabled = false;
  btnLlamando.textContent = "📞 Llamando";
  btnFin.disabled = true;
  btnFin.textContent = "⏹ Fin";
  callStatus.textContent = "";
  callStatus.className = "call-status";
}

document.getElementById("btnLimpiar").addEventListener("click", () => {
  if (confirm("¿Limpiar todos los campos?")) limpiarFormulario();
});

/* ============================================================
   SINCRONIZACIÓN
   ============================================================ */
let sincronizando = false;
async function sincronizarPendientes() {
  if (sincronizando) return;
  if (pendientes.length === 0) {
    actualizarIndicadorSync();
    return;
  }
  sincronizando = true;
  actualizarIndicadorSync();

  while (pendientes.length > 0) {
    const reg = pendientes[0];
    const ok = await enviarRegistro(reg);
    if (ok) {
      pendientes.shift();
      savePendientesLocal();
      actualizarIndicadorSync();
    } else {
      break;
    }
  }
  sincronizando = false;
  actualizarIndicadorSync();
  if (pendientes.length > 0) setTimeout(sincronizarPendientes, 15000);
}

async function enviarRegistro(reg) {
  try {
    await fetch(SHEETS_WEBAPP_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(reg)
    });
    return true;
  } catch (e) {
    console.warn("Error al enviar:", e);
    return false;
  }
}

function actualizarIndicadorSync() {
  const text = document.getElementById("syncText");
  const box = document.getElementById("syncStatus");
  const dot = document.getElementById("syncDot");
  if (pendientes.length === 0) {
    box.className = "sync-indicator sync-ok";
    text.textContent = "Sincronizado";
    dot.textContent = "●";
  } else {
    box.className = "sync-indicator sync-pending";
    text.textContent = `Sincronizando (${pendientes.length})`;
    dot.textContent = "○";
  }
}

/* ============================================================
   HISTORIAL
   ============================================================ */
function renderHistorial() {
  const tbody = document.getElementById("historyBody");
  const empty = document.getElementById("historyEmpty");
  const tbl = document.getElementById("historyTable");

  if (historial.length === 0) {
    empty.classList.remove("hidden");
    tbl.classList.add("hidden");
    return;
  }
  empty.classList.add("hidden");
  tbl.classList.remove("hidden");

  tbody.innerHTML = historial.map((r, i) => {
    const contPill = r.contesto === "SI"
      ? '<span class="pill pill-si">SÍ</span>'
      : '<span class="pill pill-no">NO</span>';
    return `
      <tr>
        <td>${historial.length - i}</td>
        <td class="mono">${escapeHtml(r.celular)}</td>
        <td>${escapeHtml(r.programa || "—")}</td>
        <td>${escapeHtml(r.fuente || "—")}</td>
        <td>${contPill}</td>
        <td>${escapeHtml(r.calidad || "—")}</td>
        <td>${escapeHtml((r.nota || "").slice(0, 40))}${(r.nota || "").length > 40 ? "…" : ""}</td>
      </tr>
    `;
  }).join("");
}

/* ============================================================
   INICIALIZACIÓN
   ============================================================ */
loadHistorialLocal();
loadPendientesLocal();
actualizarMeta();
actualizarIndicadorSync();
renderHistorial();

if (pendientes.length > 0) sincronizarPendientes();
setInterval(sincronizarPendientes, 30000);
