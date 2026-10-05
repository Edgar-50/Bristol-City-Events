document.addEventListener("DOMContentLoaded", () => {
  /* ── Bootstrap data from Flask ── */
  const { user, events, tickets, transactions, notifications, is_student } =
    window.BCE || { user: {}, events: [], tickets: [], transactions: [], notifications: [], is_student: false };

  /* ── Element refs ── */
  const root      = document.documentElement;
  const loader    = document.getElementById("loader");
  const sidebar   = document.getElementById("sidebar");
  const hamburger = document.getElementById("hamburger");
  const themeBtn  = document.getElementById("themeToggle");
  const moonIcon  = document.getElementById("moonIcon");
  const sunIcon   = document.getElementById("sunIcon");
  const searchEl  = document.getElementById("searchInput");
  const catFilter = document.getElementById("categoryFilter");
  const eventGrid = document.getElementById("eventGrid");
  const recGrid   = document.getElementById("recGrid");
  const ticketList = document.getElementById("ticketList");
  const txList    = document.getElementById("txList");
  const receiptList = document.getElementById("receiptList");
  const toastWrap = document.getElementById("toastWrap");
  const notifDot  = document.getElementById("notifDot");
  const notifBtn  = document.getElementById("notifBtn");
  const studentBadge = document.getElementById("studentBadge");

  const statTickets = document.getElementById("statTickets");
  const statEvents  = document.getElementById("statEvents");
  const statNotifs  = document.getElementById("statNotifs");
  const statSpend   = document.getElementById("statSpend");

  const seatAvail   = document.getElementById("seatAvail");
  const seatReserved = document.getElementById("seatReserved");
  const seatTaken   = document.getElementById("seatTaken");
  const seatProgress = document.getElementById("seatProgress");
  const shuffleBtn  = document.getElementById("shuffleBtn");

  const modal       = document.getElementById("bookingModal");
  const modalScrim  = document.getElementById("modalScrim");
  const modalClose  = document.getElementById("modalClose");
  const modalTitle  = document.getElementById("modalTitle");
  const modalMeta   = document.getElementById("modalMeta");
  const modalQty    = document.getElementById("modalQty");
  const modalStudent = document.getElementById("modalStudent");
  const modalSub    = document.getElementById("modalSub");
  const modalDisc   = document.getElementById("modalDisc");
  const modalTotal  = document.getElementById("modalTotal");
  const confirmBook = document.getElementById("confirmBook");
  const seatGrid    = document.getElementById("seatGrid");
  const studentRow  = document.getElementById("studentRow");

  const quickBookBtn = document.getElementById("quickBookBtn");
  const ambientCanvas = document.getElementById("ambient-bg");
  const chartCanvas = document.getElementById("activityChart");

  /* ── State ── */
  let currentEvent = null;
  let selectedSeat = null;
  let seatState = [];
  let chartInstance = null;
  let currentEvents = [...events];

  

  const fmt = (n) => `£${Number(n || 0).toFixed(2)}`;

  function toast(msg, type = "info") {
    if (!toastWrap) return;
    const el = document.createElement("div");
    el.className = "toast";
    el.style.borderLeftColor = type === "success" ? "var(--success)"
                             : type === "error"   ? "var(--danger)"
                             : type === "warn"    ? "var(--warning)"
                             : "var(--accent)";
    el.style.borderLeft = `3px solid`;
    el.textContent = msg;
    toastWrap.appendChild(el);
    setTimeout(() => { el.style.opacity = "0"; el.style.transform = "translateY(8px)"; }, 2800);
    setTimeout(() => el.remove(), 3050);
  }

  async function apiFetch(url, options = {}) {
    try {
      const res = await fetch(url, {
        headers: { "Content-Type": "application/json" },
        ...options,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      return await res.json();
    } catch (e) {
      toast(e.message, "error");
      throw e;
    }
  }

  

  function applyTheme(t) {
    root.setAttribute("data-theme", t);
    localStorage.setItem("bce-theme", t);
    moonIcon.style.display = t === "dark" ? "" : "none";
    sunIcon.style.display  = t === "light" ? "" : "none";
    renderChart();
    drawAmbient();
  }

  themeBtn?.addEventListener("click", () => {
    applyTheme(root.getAttribute("data-theme") === "dark" ? "light" : "dark");
  });

  

  hamburger?.addEventListener("click", () => sidebar?.classList.toggle("open"));
  document.addEventListener("click", (e) => {
    if (sidebar?.classList.contains("open") && !sidebar.contains(e.target) && e.target !== hamburger) {
      sidebar.classList.remove("open");
    }
  });

  /* Active nav item on hash */
  document.querySelectorAll(".nav-item[data-section]").forEach(link => {
    link.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach(l => l.classList.remove("active"));
      link.classList.add("active");
    });
  });

  

  async function loadStats() {
    try {
      const stats = await apiFetch("/api/stats");
      if (statTickets) statTickets.textContent = stats.tickets;
      if (statEvents)  statEvents.textContent  = stats.events;
      if (statNotifs)  statNotifs.textContent  = stats.notifications;
      if (statSpend)   statSpend.textContent   = fmt(stats.spend);
      if (notifDot)    notifDot.style.display  = stats.notifications > 0 ? "" : "none";
    } catch (_) {
      // Fall back to bootstrap data
      if (statTickets) statTickets.textContent = tickets.length;
      if (statEvents)  statEvents.textContent  = events.length;
      if (statNotifs)  statNotifs.textContent  = notifications.length;
      const spent = transactions.reduce((s, t) => s + Number(t.amount || 0), 0);
      if (statSpend) statSpend.textContent = fmt(spent);
    }
  }

 

  async function renderChart() {
    if (!chartCanvas || !window.Chart) return;

    let labels, values;

    try {
      const rows = await apiFetch("/api/activity");
      labels = rows.map(r => r.day);
      values = rows.map(r => r.bookings);
    } catch (_) {
      // Fallback to synthetic data from bootstrap
      labels = events.slice(0, 6).map(e => e.date || "—");
      values = events.slice(0, 6).map((_, i) => i + 1 + Math.floor(Math.random() * 3));
    }

    if (!labels.length) {
      labels = ["No data yet"];
      values = [0];
    }

    const theme = root.getAttribute("data-theme");
    const textColor = theme === "light" ? "rgba(28,19,48,0.65)" : "rgba(245,240,255,0.58)";
    const gridColor = theme === "light" ? "rgba(28,19,48,0.08)" : "rgba(245,240,255,0.09)";

    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(chartCanvas, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Bookings",
          data: values,
          borderColor: "#8b5cf6",
          backgroundColor: "rgba(139,92,246,0.14)",
          fill: true,
          tension: 0.45,
          pointRadius: 5,
          pointBackgroundColor: "#ec4899",
          pointBorderColor: "transparent",
          pointHoverRadius: 7,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { mode: "index", intersect: false } },
        scales: {
          x: { ticks: { color: textColor, font: { family: "DM Sans" } }, grid: { color: gridColor } },
          y: { ticks: { color: textColor, font: { family: "DM Sans" } }, grid: { color: gridColor }, beginAtZero: true }
        }
      }
    });
  }

  

  function renderEventGrid(evs) {
    if (!eventGrid) return;
    eventGrid.innerHTML = "";
    if (!evs.length) {
      eventGrid.innerHTML = `<div class="empty-state"><p>No events match your filter.</p></div>`;
      return;
    }
    evs.forEach(ev => {
      const rem = Number(ev.remaining_tickets ?? 99);
      const seatsClass = rem === 0 ? "seats-none" : rem < 10 ? "seats-low" : "";
      const seatsLabel = rem === 0 ? "Sold out" : rem < 10 ? `${rem} left` : "Available";

      const card = document.createElement("article");
      card.className = "event-card";
      card.dataset.id = ev.id;
      card.innerHTML = `
        <div class="event-card-top">
          <span class="event-badge">${ev.category || "Live"}</span>
          <span class="event-seats ${seatsClass}">${seatsLabel}</span>
        </div>
        <h3>${ev.title}</h3>
        <p class="event-date">${ev.date || "TBA"}</p>
        <p class="event-venue">📍 ${ev.venue || "TBA"}</p>
        <div class="event-footer">
          <strong class="event-price">£${Number(ev.price || 0).toFixed(2)}</strong>
          <button class="btn btn-sm btn-primary" type="button">Book</button>
        </div>
      `;
      card.querySelector("button").addEventListener("click", () => openModal(ev));
      eventGrid.appendChild(card);
    });
  }

  async function reloadEvents(category = "", q = "") {
    try {
      const params = new URLSearchParams();
      if (category) params.set("category", category);
      if (q) params.set("q", q);
      const fresh = await apiFetch(`/api/events?${params}`);
      currentEvents = fresh;
      renderEventGrid(fresh);
    } catch (_) {
      renderEventGrid(currentEvents);
    }
  }

  let filterTimer;
  catFilter?.addEventListener("change", () => reloadEvents(catFilter.value, searchEl?.value));
  searchEl?.addEventListener("input", () => {
    clearTimeout(filterTimer);
    filterTimer = setTimeout(() => reloadEvents(catFilter?.value, searchEl.value), 350);
  });

  

  async function loadRecommendations() {
    if (!recGrid) return;
    try {
      const recs = await apiFetch("/api/recommendations");
      recGrid.innerHTML = "";
      if (!recs.length) {
        recGrid.innerHTML = `<div class="empty-state"><p>No recommendations yet.</p></div>`;
        return;
      }
      recs.forEach(item => {
        const card = document.createElement("article");
        card.className = "rec-card";
        card.innerHTML = `
          <span class="event-badge">${item.category || "Event"}</span>
          <h4>${item.title}</h4>
          <p class="rec-meta">${item.date || ""}</p>
          <p class="rec-meta">${item.venue || ""}</p>
          <p class="rec-price">${fmt(item.price)}</p>
          <button class="btn btn-sm btn-primary" type="button">Book</button>
        `;
        card.querySelector("button").addEventListener("click", () => openModal(item));
        recGrid.appendChild(card);
      });
    } catch (_) {
      recGrid.innerHTML = `<div class="empty-state"><p>Could not load recommendations.</p></div>`;
    }
  }

  

  function renderTickets(list) {
    if (!ticketList) return;
    ticketList.innerHTML = "";
    if (!list.length) {
      ticketList.innerHTML = `<div class="empty-state"><p>No confirmed tickets yet.</p></div>`;
      return;
    }
    list.forEach(t => {
      const row = document.createElement("div");
      row.className = "ticket-row";
      row.innerHTML = `
        <div class="ticket-meta">
          <strong>${t.event}</strong>
          <p>${t.date || "TBA"} · ${t.venue || "TBA"}</p>
          <span class="seat-tag">${t.seat_ref || "General"}</span>
        </div>
        <canvas class="qr-canvas" width="72" height="72" data-qr="${t.receipt_code || t.id}"></canvas>
      `;
      ticketList.appendChild(row);
    });
    if (window.QRCode) {
      ticketList.querySelectorAll("[data-qr]").forEach(canvas => {
        QRCode.toCanvas(canvas, canvas.dataset.qr, { width: 72, margin: 1 });
      });
    }
  }

 

  const ROWS = ["A", "B", "C", "D", "E"];
  const COLS = 6;

  function makeSeatState() {
    const state = [];
    ROWS.forEach(r => {
      for (let c = 1; c <= COLS; c++) {
        const code = `${r}${c}`;
        let status = "available";
        if (["A2","B4","C3","D5"].includes(code)) status = "taken";
        if (["A4","C1","E2"].includes(code)) status = "reserved";
        state.push({ code, status });
      }
    });
    return state;
  }

  function updateSeatSummary() {
    const avail = seatState.filter(s => s.status === "available").length;
    const res   = seatState.filter(s => s.status === "reserved").length;
    const taken = seatState.filter(s => s.status === "taken").length;
    const total = seatState.length;

    if (seatAvail)    seatAvail.textContent    = avail;
    if (seatReserved) seatReserved.textContent = res;
    if (seatTaken)    seatTaken.textContent    = taken;
    if (seatProgress) seatProgress.style.setProperty("--fill", `${Math.round((avail / total) * 100)}%`);
  }

  function renderSeatGrid() {
    if (!seatGrid) return;
    seatGrid.innerHTML = "";
    seatState.forEach(seat => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = seat.code;
      btn.className = `seat ${seat.status}${selectedSeat === seat.code ? " selected" : ""}`;
      if (seat.status === "taken") btn.disabled = true;
      btn.addEventListener("click", () => {
        if (seat.status === "taken") return;
        if (seat.status === "reserved") { toast(`${seat.code} is reserved.`, "warn"); return; }
        selectedSeat = seat.code;
        renderSeatGrid();
      });
      seatGrid.appendChild(btn);
    });
    updateSeatSummary();
  }

  shuffleBtn?.addEventListener("click", () => {
    seatState = seatState.map(s => {
      if (s.status === "taken") return s;
      const r = Math.random();
      return { ...s, status: r < 0.09 ? "taken" : r < 0.22 ? "reserved" : "available" };
    });
    if (selectedSeat) {
      const sel = seatState.find(s => s.code === selectedSeat);
      if (!sel || sel.status !== "available") { selectedSeat = null; }
    }
    renderSeatGrid();
    toast("Seat simulation updated.", "info");
  });

  

  function updatePricing() {
    if (!currentEvent) return;
    const qty = Math.max(1, parseInt(modalQty?.value || "1", 10));
    const base = Number(currentEvent.price || 0) * qty;
    const canDiscount = is_student && modalStudent?.checked;
    const disc = canDiscount ? base * 0.1 : 0;
    const total = base - disc;
    if (modalSub)   modalSub.textContent  = fmt(base);
    if (modalDisc)  modalDisc.textContent = `−${fmt(disc)}`;
    if (modalTotal) modalTotal.textContent = fmt(total);
  }

  function openModal(ev) {
    currentEvent = ev;
    selectedSeat = null;
    if (modalTitle) modalTitle.textContent = ev.title;
    if (modalMeta)  modalMeta.textContent  = `${ev.date || "TBA"} — ${ev.venue || "TBA"}`;
    if (modalQty)   modalQty.value = 1;
    if (modalStudent) modalStudent.checked = false;

    // Show/hide student discount row based on user's is_student flag
    if (studentRow) studentRow.style.display = is_student ? "" : "none";

    updatePricing();
    renderSeatGrid();
    modal?.classList.add("show");
    modal?.setAttribute("aria-hidden", "false");
  }

  window.openBookingModal = (id) => {
    const ev = currentEvents.find(e => String(e.id) === String(id));
    if (ev) openModal(ev); else toast("Event not found.", "error");
  };

  function closeModal() {
    modal?.classList.remove("show");
    modal?.setAttribute("aria-hidden", "true");
  }

  modalClose?.addEventListener("click", closeModal);
  modalScrim?.addEventListener("click", closeModal);
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });
  modalQty?.addEventListener("input", updatePricing);
  modalStudent?.addEventListener("change", updatePricing);

  quickBookBtn?.addEventListener("click", () => {
    if (currentEvents.length) openModal(currentEvents[0]);
    else toast("No events available.", "warn");
  });

  /* ── CONFIRM BOOKING (hits real API) ── */
  confirmBook?.addEventListener("click", async () => {
    if (!currentEvent) return;
    if (!selectedSeat) { toast("Please select an available seat first.", "warn"); return; }

    const chosenSeat = seatState.find(s => s.code === selectedSeat);
    if (!chosenSeat || chosenSeat.status !== "available") {
      toast("Seat is no longer available.", "error");
      return;
    }

    confirmBook.disabled = true;
    confirmBook.textContent = "Booking…";

    try {
      const qty = Math.max(1, parseInt(modalQty?.value || "1", 10));
      const result = await apiFetch("/api/book", {
        method: "POST",
        body: JSON.stringify({
          event_id: currentEvent.id,
          num_tickets: qty,
          seat: selectedSeat,
          student_discount: is_student && modalStudent?.checked,
        }),
      });

      if (result.status === "BOOKED") {
        // Mark seat locally
        chosenSeat.status = "taken";
        renderSeatGrid();

        // Add ticket to local list and re-render
        const bk = result.booking || {};
        const newTicket = {
          id: bk.booking_id || Date.now(),
          event: currentEvent.title,
          date: currentEvent.date || "TBA",
          venue: currentEvent.venue || "TBA",
          seat_ref: selectedSeat,
          receipt_code: bk.receipt_code || String(Date.now()),
        };
        tickets.unshift(newTicket);
        renderTickets(tickets);

        // Add to tx/receipt lists (optimistic)
        const qty2 = Math.max(1, parseInt(modalQty?.value || "1", 10));
        const base = Number(currentEvent.price || 0) * qty2;
        const disc = is_student && modalStudent?.checked ? base * 0.1 : 0;
        const total = base - disc;
        transactions.unshift({
          event: currentEvent.title, date: currentEvent.date || "TBA",
          amount: total, status: "confirmed",
          receipt_code: bk.receipt_code || "—",
        });
        renderTransactions();

        closeModal();
        toast(`Booking confirmed! Seat ${selectedSeat}.`, "success");
        loadStats();
      } else if (result.status === "WAITING_LIST") {
        toast("Sold out — you've been added to the waiting list.", "warn");
        closeModal();
      }
    } finally {
      confirmBook.disabled = false;
      confirmBook.textContent = "Confirm booking";
    }
  });



  function renderTransactions() {
    if (!txList) return;
    txList.innerHTML = "";
    if (!transactions.length) {
      txList.innerHTML = `<div class="empty-state"><p>No transactions yet.</p></div>`;
      return;
    }
    [...transactions].forEach(tx => {
      const row = document.createElement("div");
      row.className = "tx-row";
      row.innerHTML = `
        <div class="tx-info">
          <strong>${tx.event}</strong>
          <span>${tx.date || "—"}</span>
        </div>
        <div class="tx-right">
          <strong class="tx-amount">${fmt(tx.amount)}</strong>
          <span class="tx-status status-${tx.status}">${tx.status}</span>
        </div>
      `;
      txList.appendChild(row);
    });

    if (!receiptList) return;
    receiptList.innerHTML = "";
    [...transactions].forEach(tx => {
      const row = document.createElement("div");
      row.className = "receipt-row";
      row.innerHTML = `
        <div class="receipt-info">
          <strong>${tx.event}</strong>
          <span>${tx.receipt_code || "—"}</span>
        </div>
        <strong>${fmt(tx.amount)}</strong>
      `;
      receiptList.appendChild(row);
    });
  }

  

  notifBtn?.addEventListener("click", async () => {
    if (notifications.length) {
      toast(`You have ${notifications.length} notification(s).`, "info");
      await apiFetch("/api/notifications/read", { method: "POST" });
      if (notifDot) notifDot.style.display = "none";
      if (statNotifs) statNotifs.textContent = "0";
    } else {
      toast("No new notifications.", "info");
    }
  });



  function drawAmbient() {
    if (!ambientCanvas) return;
    const ctx = ambientCanvas.getContext("2d");
    const theme = root.getAttribute("data-theme");
    const dots = Array.from({ length: 24 }, () => ({
      x: Math.random(), y: Math.random(),
      r: Math.random() * 2 + 1,
      dx: (Math.random() - 0.5) * 0.0006,
      dy: (Math.random() - 0.5) * 0.0006,
    }));
    let w, h;

    function resize() { w = ambientCanvas.width = innerWidth; h = ambientCanvas.height = innerHeight; }
    function frame() {
      ctx.clearRect(0, 0, w, h);
      dots.forEach(d => {
        d.x += d.dx; d.y += d.dy;
        if (d.x < 0 || d.x > 1) d.dx *= -1;
        if (d.y < 0 || d.y > 1) d.dy *= -1;
        ctx.beginPath();
        ctx.arc(d.x * w, d.y * h, d.r, 0, Math.PI * 2);
        ctx.fillStyle = theme === "light" ? "rgba(139,92,246,0.2)" : "rgba(139,92,246,0.18)";
        ctx.fill();
      });
      requestAnimationFrame(frame);
    }
    if (ambientCanvas._ro) ambientCanvas._ro.disconnect();
    window.removeEventListener("resize", ambientCanvas._resize || (() => {}));
    ambientCanvas._resize = resize;
    window.addEventListener("resize", resize);
    resize();
    frame();
  }



  async function boot() {
    applyTheme(localStorage.getItem("bce-theme") || "dark");

    // Student badge
    if (is_student && studentBadge) studentBadge.style.display = "";

    // Seed seat state
    seatState = makeSeatState();

    // Render from bootstrap (instant)
    renderEventGrid(currentEvents);
    renderTickets(tickets);
    renderTransactions();
    updateSeatSummary();

    // Then hit the real APIs
    await Promise.allSettled([
      loadStats(),
      loadRecommendations(),
      renderChart(),
    ]);

    // Remove loader
    setTimeout(() => loader?.classList.add("gone"), 550);
  }

  boot();
});