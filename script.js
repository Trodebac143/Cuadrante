(() => {
  const INITIAL_NIPS = ["56", "114", "221", "101", "143", "215", "145", "146", "193", "214", "223", "41", "190", "151"];
  const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const VALID_TYPES = ["V", "VA", "AP", "APA", "Lc", "FH", "C"];
  const FREE_BLOCK_START = new Date(Date.UTC(2026, 5, 4)); // 04/06/2026: jueves libre

  const els = {};
  let supabaseClient = null;
  let session = null;
  let currentYear = 2026;
  let currentMonth = 6;
  let annotations = [];
  let users = [...INITIAL_NIPS];
  let selectedDate = null;
  let selectedAnnotation = null;

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    bindElements();
    setupSupabase();
    populateYearMonthSelectors();
    populateNipSelects(INITIAL_NIPS);
    bindEvents();
    renderCalendar();

    if (!isSupabaseConfigured()) {
      els.configWarning.classList.remove("hidden");
      setLoginMessage("Configura Supabase antes de usar la V2 compartida.", true);
      return;
    }

    loadPublicUsers();
  }

  function bindElements() {
    [
      "loginView", "appView", "nipSelect", "passwordInput", "loginBtn", "loginMessage", "configWarning",
      "monthLabel", "sessionInfo", "logoutBtn", "yearSelect", "monthSelect", "refreshBtn",
      "calendarGrid", "adminPanel", "transferPanel", "newNipInput", "newNipPasswordInput",
      "createUserBtn", "generalPasswordInput", "changeGeneralPasswordBtn", "adminMessage",
      "exportBtn", "importInput", "deleteMonthBtn", "dayModal", "closeModalBtn", "modalTitle",
      "modalInfo", "existingAnnotations", "editForm", "formTitle", "targetNipSelect", "typeSelect",
      "fhFields", "fromTimeInput", "toTimeInput", "changeFields", "changeNipInput",
      "saveAnnotationBtn", "deleteAnnotationBtn", "modalMessage"
    ].forEach(id => els[id] = document.getElementById(id));
  }

  function bindEvents() {
    els.loginBtn.addEventListener("click", login);
    els.passwordInput.addEventListener("keydown", e => { if (e.key === "Enter") login(); });
    els.logoutBtn.addEventListener("click", logout);
    els.yearSelect.addEventListener("change", () => { currentYear = Number(els.yearSelect.value); loadAnnotations(); });
    els.monthSelect.addEventListener("change", () => { currentMonth = Number(els.monthSelect.value); loadAnnotations(); });
    els.refreshBtn.addEventListener("click", loadAnnotations);
    els.closeModalBtn.addEventListener("click", closeModal);
    els.typeSelect.addEventListener("change", updateConditionalFields);
    els.targetNipSelect.addEventListener("change", () => {
      selectedAnnotation = annotations.find(a => a.fecha === selectedDate && String(a.nip) === String(els.targetNipSelect.value)) || null;
      fillFormFromSelected();
    });
    els.saveAnnotationBtn.addEventListener("click", saveAnnotation);
    els.deleteAnnotationBtn.addEventListener("click", deleteSelectedAnnotation);
    els.createUserBtn.addEventListener("click", createUser);
    els.changeGeneralPasswordBtn.addEventListener("click", changeGeneralPassword);
    els.exportBtn.addEventListener("click", exportMonth);
    els.importInput.addEventListener("change", importJson);
    els.deleteMonthBtn.addEventListener("click", deleteMonth);
  }

  function setupSupabase() {
    if (!window.supabase || !isSupabaseConfigured()) return;
    supabaseClient = window.supabase.createClient(window.UPO4_SUPABASE_URL, window.UPO4_SUPABASE_ANON_KEY);
  }

  function isSupabaseConfigured() {
    return window.UPO4_SUPABASE_URL && window.UPO4_SUPABASE_ANON_KEY &&
      !window.UPO4_SUPABASE_URL.includes("PEGA_AQUI") &&
      !window.UPO4_SUPABASE_ANON_KEY.includes("PEGA_AQUI");
  }

  function populateYearMonthSelectors() {
    const current = new Date().getFullYear();
    const start = 2026;
    const end = Math.max(current + 2, 2030);
    els.yearSelect.innerHTML = "";
    for (let y = start; y <= end; y++) {
      const option = document.createElement("option");
      option.value = y;
      option.textContent = y;
      els.yearSelect.appendChild(option);
    }
    els.monthSelect.innerHTML = "";
    MONTHS.forEach((name, index) => {
      const option = document.createElement("option");
      option.value = index + 1;
      option.textContent = name;
      els.monthSelect.appendChild(option);
    });
    els.yearSelect.value = currentYear;
    els.monthSelect.value = currentMonth;
  }

  function populateNipSelects(nips) {
    users = [...new Set(nips.map(String))].sort((a, b) => Number(a) - Number(b));
    els.nipSelect.innerHTML = users.map(nip => `<option value="${escapeHtml(nip)}">${escapeHtml(nip)}</option>`).join("");
    populateTargetNipSelect();
  }

  function populateTargetNipSelect() {
    if (!els.targetNipSelect) return;
    const visibleUsers = session?.is_admin ? users : [session?.nip].filter(Boolean);
    els.targetNipSelect.innerHTML = visibleUsers.map(nip => `<option value="${escapeHtml(nip)}">${escapeHtml(nip)}</option>`).join("");
  }

  async function loadPublicUsers() {
    try {
      const { data, error } = await supabaseClient.rpc("upo4_active_nips");
      if (error) throw error;
      if (data?.length) populateNipSelects(data.map(row => row.nip));
    } catch (err) {
      console.error(err);
      setLoginMessage("No se pudieron cargar los NIP desde Supabase. Revisa que hayas ejecutado el SQL.", true);
    }
  }

  async function login() {
    if (!supabaseClient) {
      setLoginMessage("Supabase no está configurado.", true);
      return;
    }
    const nip = els.nipSelect.value;
    const password = els.passwordInput.value.trim();
    if (!nip || !password) {
      setLoginMessage("Selecciona NIP e introduce contraseña.", true);
      return;
    }

    setLoginMessage("Comprobando acceso...");
    const { data, error } = await supabaseClient.rpc("upo4_login", { p_nip: nip, p_password: password });
    if (error) {
      console.error(error);
      setLoginMessage("Acceso denegado o error de conexión.", true);
      return;
    }
    if (!data || data.length === 0) {
      setLoginMessage("Contraseña incorrecta.", true);
      return;
    }

    session = {
      token: data[0].token,
      nip: String(data[0].nip),
      is_admin: Boolean(data[0].is_admin)
    };
    els.passwordInput.value = "";
    els.loginView.classList.add("hidden");
    els.appView.classList.remove("hidden");
    els.sessionInfo.textContent = `NIP ${session.nip}${session.is_admin ? " · Administrador" : ""}`;
    els.adminPanel.classList.toggle("hidden", !session.is_admin);
    els.transferPanel.classList.toggle("hidden", !session.is_admin);
    populateTargetNipSelect();
    await loadPublicUsers();
    await loadAnnotations();
  }

  function logout() {
    session = null;
    annotations = [];
    els.appView.classList.add("hidden");
    els.loginView.classList.remove("hidden");
    els.adminPanel.classList.add("hidden");
    els.transferPanel.classList.add("hidden");
    setLoginMessage("");
    renderCalendar();
  }

  async function loadAnnotations() {
    if (!session) return;
    els.yearSelect.value = currentYear;
    els.monthSelect.value = currentMonth;
    try {
      const { data, error } = await supabaseClient.rpc("upo4_get_annotations", {
        p_token: session.token,
        p_year: currentYear,
        p_month: currentMonth
      });
      if (error) throw error;
      annotations = (data || []).map(row => ({ ...row, nip: String(row.nip) }));
      renderCalendar();
    } catch (err) {
      console.error(err);
      alert("No se pudieron cargar los datos. Revisa la conexión o la configuración de Supabase.");
    }
  }

  function renderCalendar() {
    els.calendarGrid.innerHTML = "";
    const monthName = MONTHS[currentMonth - 1];
    els.monthLabel.textContent = `${monthName} ${currentYear} · ${getMonthShift(currentYear, currentMonth) === "T" ? "Tardes" : "Mañanas"}`;

    const first = new Date(Date.UTC(currentYear, currentMonth - 1, 1));
    const daysInMonth = new Date(Date.UTC(currentYear, currentMonth, 0)).getUTCDate();
    const firstWeekday = (first.getUTCDay() + 6) % 7; // lunes=0

    for (let i = 0; i < firstWeekday; i++) {
      const empty = document.createElement("div");
      empty.className = "day-cell empty";
      els.calendarGrid.appendChild(empty);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = toDateString(currentYear, currentMonth, day);
      const isFree = isFreeDay(dateStr);
      const dayAnnotations = annotations.filter(a => a.fecha === dateStr).sort((a, b) => Number(a.nip) - Number(b.nip));
      const hasVacation = dayAnnotations.some(a => a.tipo === "V");
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "day-cell";
      if (isFree) cell.classList.add("libre");
      else if (hasVacation) cell.classList.add("vacaciones");
      else if (dayAnnotations.length) cell.classList.add("incidencia");
      else cell.classList.add("trabajo");

      const label = isFree ? "LIB" : getMonthShift(currentYear, currentMonth);
      cell.innerHTML = `
        <div class="day-top"><span>${day}</span><span class="shift-label">${label}</span></div>
        <div class="annotations">
          ${dayAnnotations.map(formatAnnotationHtml).join("")}
        </div>
      `;
      cell.addEventListener("click", () => openDay(dateStr));
      els.calendarGrid.appendChild(cell);
    }
  }

  function openDay(dateStr) {
    selectedDate = dateStr;
    selectedAnnotation = null;
    const isFree = isFreeDay(dateStr);
    const dayAnnotations = annotations.filter(a => a.fecha === dateStr).sort((a, b) => Number(a.nip) - Number(b.nip));
    const dateObj = parseDate(dateStr);
    els.modalTitle.textContent = `${dateObj.getUTCDate()} de ${MONTHS[dateObj.getUTCMonth()]} de ${dateObj.getUTCFullYear()}`;
    els.modalInfo.textContent = isFree ? "Día libre. No se puede modificar." : `Día de trabajo · ${getMonthShift(dateObj.getUTCFullYear(), dateObj.getUTCMonth() + 1) === "T" ? "Tarde" : "Mañana"}`;
    els.existingAnnotations.innerHTML = dayAnnotations.length
      ? dayAnnotations.map(a => existingAnnotationHtml(a)).join("")
      : `<p class="subtitle">Sin incidencias anotadas.</p>`;

    els.editForm.classList.toggle("hidden", isFree || !session);
    if (!isFree && session) {
      populateTargetNipSelect();
      els.targetNipSelect.disabled = !session.is_admin;
      els.targetNipSelect.value = session.is_admin ? users[0] : session.nip;
      selectedAnnotation = annotations.find(a => a.fecha === selectedDate && String(a.nip) === String(els.targetNipSelect.value)) || null;
      fillFormFromSelected();
    }
    setModalMessage("");
    els.dayModal.classList.remove("hidden");

    document.querySelectorAll("[data-edit-id]").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-edit-id");
        selectedAnnotation = annotations.find(a => a.id === id) || null;
        if (selectedAnnotation) {
          els.targetNipSelect.value = selectedAnnotation.nip;
          fillFormFromSelected();
        }
      });
    });
  }

  function closeModal() {
    els.dayModal.classList.add("hidden");
    selectedDate = null;
    selectedAnnotation = null;
  }

  function fillFormFromSelected() {
    const nip = els.targetNipSelect.value;
    selectedAnnotation = annotations.find(a => a.fecha === selectedDate && String(a.nip) === String(nip)) || null;
    const canEdit = session?.is_admin || String(nip) === session?.nip;
    els.formTitle.textContent = selectedAnnotation ? "Modificar incidencia" : "Anotar incidencia";
    els.typeSelect.value = selectedAnnotation?.tipo || "V";
    els.fromTimeInput.value = selectedAnnotation?.hora_inicio || "";
    els.toTimeInput.value = selectedAnnotation?.hora_fin || "";
    els.changeNipInput.value = selectedAnnotation?.nip_cambio || "";
    els.saveAnnotationBtn.disabled = !canEdit;
    els.deleteAnnotationBtn.classList.toggle("hidden", !selectedAnnotation || !canEdit);
    updateConditionalFields();
  }

  function updateConditionalFields() {
    const type = els.typeSelect.value;
    els.fhFields.classList.toggle("hidden", type !== "FH");
    els.changeFields.classList.toggle("hidden", type !== "C");
  }

  async function saveAnnotation() {
    const targetNip = els.targetNipSelect.value;
    const tipo = els.typeSelect.value;
    if (!VALID_TYPES.includes(tipo)) return setModalMessage("Concepto no válido.", true);
    const horaInicio = tipo === "FH" ? els.fromTimeInput.value : null;
    const horaFin = tipo === "FH" ? els.toTimeInput.value : null;
    const nipCambio = tipo === "C" ? els.changeNipInput.value.trim() : null;
    if (tipo === "FH" && (!horaInicio || !horaFin)) return setModalMessage("Indica hora de inicio y fin para FH.", true);
    if (tipo === "C" && !nipCambio) return setModalMessage("Indica el NIP del compañero para el cambio.", true);

    try {
      const { error } = await supabaseClient.rpc("upo4_save_annotation", {
        p_token: session.token,
        p_fecha: selectedDate,
        p_nip: targetNip,
        p_tipo: tipo,
        p_hora_inicio: horaInicio,
        p_hora_fin: horaFin,
        p_nip_cambio: nipCambio
      });
      if (error) throw error;
      setModalMessage("Guardado.");
      await loadAnnotations();
      openDay(selectedDate);
    } catch (err) {
      console.error(err);
      setModalMessage("No se ha podido guardar. Comprueba permisos o conexión.", true);
    }
  }

  async function deleteSelectedAnnotation() {
    if (!selectedAnnotation) return;
    if (!confirm("¿Borrar esta incidencia?")) return;
    try {
      const { error } = await supabaseClient.rpc("upo4_delete_annotation", {
        p_token: session.token,
        p_annotation_id: selectedAnnotation.id
      });
      if (error) throw error;
      await loadAnnotations();
      openDay(selectedDate);
    } catch (err) {
      console.error(err);
      setModalMessage("No se ha podido borrar.", true);
    }
  }

  async function createUser() {
    const newNip = els.newNipInput.value.trim();
    const password = els.newNipPasswordInput.value.trim() || null;
    if (!newNip) return setAdminMessage("Introduce un NIP.", true);
    try {
      const { error } = await supabaseClient.rpc("upo4_admin_create_user", {
        p_token: session.token,
        p_nip: newNip,
        p_password: password
      });
      if (error) throw error;
      els.newNipInput.value = "";
      els.newNipPasswordInput.value = "";
      await loadPublicUsers();
      setAdminMessage("Usuario creado o actualizado.");
    } catch (err) {
      console.error(err);
      setAdminMessage("No se ha podido crear el usuario.", true);
    }
  }

  async function changeGeneralPassword() {
    const password = els.generalPasswordInput.value.trim();
    if (!password) return setAdminMessage("Introduce la nueva contraseña general.", true);
    if (!confirm("¿Cambiar la contraseña general para usuarios sin contraseña específica?")) return;
    try {
      const { error } = await supabaseClient.rpc("upo4_admin_change_general_password", {
        p_token: session.token,
        p_new_password: password
      });
      if (error) throw error;
      els.generalPasswordInput.value = "";
      setAdminMessage("Contraseña general actualizada.");
    } catch (err) {
      console.error(err);
      setAdminMessage("No se ha podido cambiar la contraseña.", true);
    }
  }

  function exportMonth() {
    const payload = {
      app: "CUADRANTE UPO4",
      year: currentYear,
      month: currentMonth,
      exported_at: new Date().toISOString(),
      annotations
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cuadrante_upo4_${currentYear}_${String(currentMonth).padStart(2, "0")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importJson(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!confirm("Se importarán las incidencias del JSON. Si coinciden fecha y NIP, se actualizarán.")) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const rows = Array.isArray(parsed) ? parsed : parsed.annotations;
      if (!Array.isArray(rows)) throw new Error("Formato inválido");
      for (const row of rows) {
        await supabaseClient.rpc("upo4_save_annotation", {
          p_token: session.token,
          p_fecha: row.fecha,
          p_nip: String(row.nip),
          p_tipo: row.tipo,
          p_hora_inicio: row.hora_inicio || null,
          p_hora_fin: row.hora_fin || null,
          p_nip_cambio: row.nip_cambio || null
        });
      }
      await loadAnnotations();
      alert("Importación completada.");
    } catch (err) {
      console.error(err);
      alert("No se ha podido importar el archivo.");
    } finally {
      event.target.value = "";
    }
  }

  async function deleteMonth() {
    if (!confirm(`¿Borrar TODAS las incidencias de ${MONTHS[currentMonth - 1]} ${currentYear}?`)) return;
    try {
      const { error } = await supabaseClient.rpc("upo4_admin_delete_month", {
        p_token: session.token,
        p_year: currentYear,
        p_month: currentMonth
      });
      if (error) throw error;
      await loadAnnotations();
      alert("Datos del mes borrados.");
    } catch (err) {
      console.error(err);
      alert("No se pudieron borrar los datos del mes.");
    }
  }

  function isFreeDay(dateStr) {
    const date = parseDate(dateStr);
    const diffDays = Math.floor((date - FREE_BLOCK_START) / 86400000);
    const block = mod(Math.floor(diffDays / 7), 2);
    return block === 0;
  }

  function getMonthShift(year, month) {
    const diff = (year - 2026) * 12 + (month - 6);
    return mod(diff, 2) === 0 ? "T" : "M";
  }

  function toDateString(year, month, day) {
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function parseDate(dateStr) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }

  function mod(n, m) { return ((n % m) + m) % m; }

  function formatAnnotationHtml(a) {
    return `<div class="annotation-line">${escapeHtml(formatAnnotationText(a))}</div>`;
  }

  function existingAnnotationHtml(a) {
    const editable = session?.is_admin || String(a.nip) === session?.nip;
    return `
      <div class="existing-item">
        <div><strong>${escapeHtml(formatAnnotationText(a))}</strong><span class="subtitle">Actualizado por ${escapeHtml(a.actualizado_por || "-")}</span></div>
        ${editable ? `<button class="secondary-btn small-btn" data-edit-id="${escapeHtml(a.id)}">Editar</button>` : ""}
      </div>
    `;
  }

  function formatAnnotationText(a) {
    if (a.tipo === "FH") return `${a.nip} FH ${a.hora_inicio || ""} a ${a.hora_fin || ""}`.trim();
    if (a.tipo === "C") return `${a.nip} C ${a.nip_cambio || ""}`.trim();
    return `${a.nip} ${a.tipo}`;
  }

  function setLoginMessage(text, isError = false) {
    els.loginMessage.textContent = text;
    els.loginMessage.style.color = isError ? "#b91c1c" : "#607086";
  }

  function setModalMessage(text, isError = false) {
    els.modalMessage.textContent = text;
    els.modalMessage.style.color = isError ? "#b91c1c" : "#607086";
  }

  function setAdminMessage(text, isError = false) {
    els.adminMessage.textContent = text;
    els.adminMessage.style.color = isError ? "#b91c1c" : "#607086";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
})();
