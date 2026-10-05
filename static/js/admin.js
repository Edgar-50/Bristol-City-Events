document.addEventListener('DOMContentLoaded', () => {

  /* ── REFS  */
  const root      = document.documentElement;
  const sidebar   = document.getElementById('sidebar');
  const hamburger = document.getElementById('hamburger');
  const themeBtn  = document.getElementById('themeToggle');
  const moonIcon  = document.getElementById('moonIcon');
  const sunIcon   = document.getElementById('sunIcon');
  const clockEl   = document.getElementById('liveClock');
  const topTitle  = document.getElementById('topbarTitle');
  const ambCanvas = document.getElementById('ambient-bg');
  const toastWrap = document.getElementById('toastWrap');

  /* ── THEME  */
  function applyTheme(t) {
    root.setAttribute('data-theme', t);
    localStorage.setItem('bce-admin-theme', t);
    if (moonIcon) moonIcon.style.display = t === 'dark'  ? '' : 'none';
    if (sunIcon)  sunIcon.style.display  = t === 'light' ? '' : 'none';
    drawAmbient();
    // ── FIX: guard with try/catch so a chart error never kills the tab system
    try { if (window._adminChart) refreshChart(); } catch(e) { console.warn('chart refresh:', e); }
  }
  themeBtn?.addEventListener('click', () =>
    applyTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark')
  );
  applyTheme(localStorage.getItem('bce-admin-theme') || 'dark');

  /* ── LIVE CLOCK */
  function tick() {
    if (!clockEl) return;
    const n = new Date(), p = x => String(x).padStart(2,'0');
    clockEl.textContent = `${n.getFullYear()}-${p(n.getMonth()+1)}-${p(n.getDate())}  ${p(n.getHours())}:${p(n.getMinutes())}:${p(n.getSeconds())}`;
  }
  tick(); setInterval(tick, 1000);

  /* ── SIDEBAR HAMBURGER  */
  hamburger?.addEventListener('click', () => sidebar?.classList.toggle('open'));
  document.addEventListener('click', e => {
    if (sidebar?.classList.contains('open') && !sidebar.contains(e.target) && e.target !== hamburger)
      sidebar.classList.remove('open');
  });

  /*  TAB SYSTEM  */
  const TABS   = ['overview','events','venues','bookings','users','reports','logs'];
  const LABELS = { overview:'Overview', events:'Events', venues:'Venues',
                   bookings:'Bookings', users:'Users', reports:'Reports', logs:'Audit Log' };

  function switchTab(name) {
    // ── FIX: validate name first so a bad hash never breaks the page
    if (!TABS.includes(name)) name = 'overview';

    TABS.forEach(t => {
      const el = document.getElementById(`tab-${t}`);
      if (el) el.classList.toggle('show', t === name);
    });
    document.querySelectorAll('.nav-item[data-tab]').forEach(btn =>
      btn.classList.toggle('active', btn.dataset.tab === name)
    );
    if (topTitle) topTitle.textContent = LABELS[name] || name;
    sidebar?.classList.remove('open');
    history.replaceState(null, '', `#${name}`);

    // ── FIX: each tab callback wrapped independently so one failure
    //         never stops the others from running
    if (name === 'reports') {
      try { animateReportBars(); } catch(e) { console.warn('reports:', e); }
    }
    if (name === 'overview') {
      try { refreshChart(); } catch(e) { console.warn('chart:', e); }
    }
  }

  document.querySelectorAll('.nav-item[data-tab]').forEach(btn =>
    btn.addEventListener('click', () => switchTab(btn.dataset.tab))
  );
  document.querySelectorAll('[data-goto]').forEach(btn =>
    btn.addEventListener('click', () => switchTab(btn.dataset.goto))
  );

  // ── FIX: sanitise the hash — strip the '#' and default to 'overview'
  //         if it's empty or not a recognised tab name
  const rawHash = location.hash.replace('#', '').trim();
  switchTab(TABS.includes(rawHash) ? rawHash : 'overview');

  /* ── AMBIENT CANVAS  */
  function drawAmbient() {
    if (!ambCanvas) return;
    try {
      const ctx  = ambCanvas.getContext('2d');
      const dark = root.getAttribute('data-theme') !== 'light';
      let w, h;

      if (ambCanvas._raf) cancelAnimationFrame(ambCanvas._raf);
      window.removeEventListener('resize', ambCanvas._resize || (() => {}));

      function resize() { w = ambCanvas.width = innerWidth; h = ambCanvas.height = innerHeight; }
      ambCanvas._resize = resize;
      window.addEventListener('resize', resize);
      resize();

      let t = 0;
      function frame() {
        t += 0.007;
        ctx.clearRect(0, 0, w, h);
        const sp = 44;
        for (let x = sp/2; x < w; x += sp) {
          for (let y = sp/2; y < h; y += sp) {
            const pulse = 0.4 + 0.6 * Math.sin(t + x * 0.018 + y * 0.013);
            ctx.beginPath();
            ctx.arc(x, y, pulse * 1.1, 0, Math.PI * 2);
            ctx.fillStyle = dark ? `rgba(0,229,255,${0.05 * pulse})` : `rgba(0,149,179,${0.06 * pulse})`;
            ctx.fill();
          }
        }
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          for (let x = 0; x <= w; x += 5) {
            const y = h*(0.2 + i*0.2) + Math.sin(x*0.007 + t + i*1.2) * (15 + i*10);
            x === 0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
          }
          ctx.strokeStyle = dark
            ? `rgba(0,229,255,${0.025 - i*0.005})`
            : `rgba(0,149,179,${0.03 - i*0.006})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        ambCanvas._raf = requestAnimationFrame(frame);
      }
      frame();
    } catch(e) {
      console.warn('ambient canvas error:', e);
    }
  }

  /* ── TOAST  */
  function toast(msg, type = 'info') {
    if (!toastWrap) return;
    const icons = { success:'✓', error:'✕', warn:'!', info:'›' };
    const el = document.createElement('div');
    el.className = `toast t-${type}`;
    el.innerHTML = `<span>${icons[type]||'›'}</span>${msg}`;
    toastWrap.appendChild(el);
    setTimeout(() => { el.style.opacity='0'; el.style.transform='translateX(14px)'; }, 2800);
    setTimeout(() => el.remove(), 3100);
  }

  /* COUNTER ANIMATION  */
  document.querySelectorAll('.stat-value[data-count]').forEach(el => {
    const target = parseFloat(el.dataset.count || '0');
    const prefix = el.dataset.prefix || '';
    const dur    = 900;
    const start  = performance.now();
    function step(now) {
      const p = Math.min((now - start) / dur, 1);
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = prefix + Math.round(target * e).toLocaleString();
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  });

  /* ACTIVITY CHART  */
  // ── FIX: the entire chart function is wrapped in try/catch so any
  //         Chart.js error is silently logged rather than crashing
  //         the tab switcher that called it
  async function refreshChart() {
    const canvas = document.getElementById('activityChart');
    if (!canvas) return;

    // ── FIX: if Chart.js hasn't loaded (e.g. network issue), skip
    //         gracefully rather than throwing ReferenceError
    if (typeof Chart === 'undefined') {
      console.warn('Chart.js not loaded yet');
      return;
    }

    const dark = root.getAttribute('data-theme') !== 'light';
    const tc   = dark ? 'rgba(232,244,248,0.42)' : 'rgba(13,26,38,0.48)';
    const gc   = dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';

    let labels = [], values = [];
    try {
      const res  = await fetch('/api/admin/stats');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      labels = data.chart?.labels || [];
      values = data.chart?.values || [];
    } catch (err) {
      console.warn('Stats fetch failed, using placeholder data:', err);
      const days = Array.from({length:30},(_,i)=>{
        const d=new Date(); d.setDate(d.getDate()-29+i);
        return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short'});
      });
      labels = days;
      values = days.map(() => 0);
    }

    try {
      if (window._adminChart) {
        window._adminChart.destroy();
        window._adminChart = null;
      }
      window._adminChart = new Chart(canvas, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Bookings',
            data: values,
            backgroundColor: dark ? 'rgba(0,229,255,0.18)' : 'rgba(0,149,179,0.15)',
            borderColor:     dark ? '#00e5ff' : '#0095b3',
            borderWidth: 1,
            borderRadius: 4,
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: dark ? 'rgba(13,17,32,0.95)' : 'rgba(240,244,248,0.95)',
              titleColor: dark ? '#00e5ff' : '#0095b3',
              bodyColor:  dark ? '#e8f4f8' : '#0d1a26',
              borderColor: dark ? 'rgba(0,229,255,0.2)' : 'rgba(0,149,179,0.2)',
              borderWidth: 1,
            }
          },
          scales: {
            x: { ticks:{ color:tc, font:{family:'DM Mono',size:9}, maxRotation:45 }, grid:{color:gc} },
            y: { ticks:{ color:tc, font:{family:'DM Mono',size:10} }, grid:{color:gc}, beginAtZero:true }
          }
        }
      });
    } catch(e) {
      console.warn('Chart render error:', e);
    }
  }

  /*  REPORT BAR ANIMATIONS  */
  function animateReportBars() {
    document.querySelectorAll('.report-bar').forEach(bar => {
      const w = bar.style.getPropertyValue('--bar-w') || '0%';
      bar.style.setProperty('--bar-w', w);
      bar.style.transform = 'scaleX(0)';
      bar.style.transition = 'none';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          bar.style.transition = '';
          bar.style.transform  = '';
        });
      });
    });
  }

  /*  TABLE SEARCH + FILTER  */
  function filterTable(tableId, filterFn) {
    document.querySelectorAll(`#${tableId} tbody tr`).forEach(row => {
      row.style.display = filterFn(row) ? '' : 'none';
    });
  }

  function liveFilter(inputId, tableId, filterFn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.addEventListener('input', () => filterTable(tableId, filterFn));
  }

  function bookingFilter(row) {
    const q      = (document.getElementById('bookingSearch')?.value || '').toLowerCase();
    const status = (document.getElementById('bookingStatusFilter')?.value || '').toLowerCase();
    const text   = row.textContent.toLowerCase();
    const rowSt  = (row.dataset.status || '').toLowerCase();
    return text.includes(q) && (!status || rowSt === status);
  }
  liveFilter('bookingSearch', 'bookingsTable', bookingFilter);
  document.getElementById('bookingStatusFilter')?.addEventListener('change', () =>
    filterTable('bookingsTable', bookingFilter)
  );

  function userFilter(row) {
    const q       = (document.getElementById('userSearch')?.value || '').toLowerCase();
    const role    = document.getElementById('userRoleFilter')?.value || '';
    const student = document.getElementById('userStudentFilter')?.value || '';
    const text    = row.textContent.toLowerCase();
    const rowRole = row.dataset.role || '';
    const rowSt   = String(row.dataset.student || '');
    return text.includes(q) &&
           (!role    || rowRole === role) &&
           (!student || rowSt   === student);
  }
  liveFilter('userSearch', 'usersTable', userFilter);
  document.getElementById('userRoleFilter')?.addEventListener('change',   () => filterTable('usersTable', userFilter));
  document.getElementById('userStudentFilter')?.addEventListener('change', () => filterTable('usersTable', userFilter));

  liveFilter('logSearch', 'logsTable', row => {
    const q = (document.getElementById('logSearch')?.value || '').toLowerCase();
    return row.textContent.toLowerCase().includes(q);
  });

  /*  EVENT FILTER  */
  function applyEventFilter() {
    const q    = (document.getElementById('eventSearchInput')?.value || '').toLowerCase();
    const cat  = (document.getElementById('eventCategoryFilter')?.value || '').toLowerCase();
    const stat = (document.getElementById('eventStatusFilter')?.value || '').toLowerCase();
    document.querySelectorAll('#eventsTableBody tr').forEach(row => {
      const match =
        (!q    || (row.dataset.title||'').includes(q) || (row.dataset.venue||'').includes(q)) &&
        (!cat  || (row.dataset.category||'').toLowerCase() === cat) &&
        (!stat || (row.dataset.status||'').toLowerCase()   === stat);
      row.style.display = match ? '' : 'none';
    });
  }
  document.getElementById('filterEventsBtn')?.addEventListener('click',  applyEventFilter);
  document.getElementById('eventSearchInput')?.addEventListener('input',  applyEventFilter);
  document.getElementById('eventCategoryFilter')?.addEventListener('change', applyEventFilter);
  document.getElementById('eventStatusFilter')?.addEventListener('change',   applyEventFilter);
  document.getElementById('clearEventFilter')?.addEventListener('click', () => {
    ['eventSearchInput','eventCategoryFilter','eventStatusFilter'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    applyEventFilter();
  });

  /* EDIT EVENT MODAL  */
  window.openEditModal = function(event) {
    const modal = document.getElementById('editEventModal');
    if (!modal) return;
    document.getElementById('editModalTitle').textContent = `Edit: ${event.title}`;
    document.getElementById('editName').value     = event.title       || '';
    document.getElementById('editCategory').value = event.category_id || '';
    document.getElementById('editVenue').value    = event.venue_id    || '';
    document.getElementById('editPrice').value    = event.price       || 0;
    document.getElementById('editTickets').value  = event.capacity    || 0;
    document.getElementById('editDesc').value     = event.description || '';
    if (event.date) {
      const dt = event.date.replace(' ', 'T').slice(0,16);
      document.getElementById('editStart').value = dt;
      document.getElementById('editEnd').value   = dt;
    }
    document.getElementById('editEventForm').action = `/admin/events/${event.id}/edit`;
    modal.classList.add('show');
  };

  /*  CAPACITY MODAL  */
  window.openCapacityModal = function(id, title, current) {
    const modal = document.getElementById('capacityModal');
    if (!modal) return;
    document.getElementById('capModalTitle').textContent = `Capacity: ${title}`;
    document.getElementById('capInput').value            = current;
    document.getElementById('capacityForm').action       = `/admin/events/${id}/capacity`;
    modal.classList.add('show');
  };

  /*  MODAL CLOSE  */
  window.closeModal = function(id) {
    document.getElementById(id)?.classList.remove('show');
  };

  /*  KEYBOARD SHORTCUTS  */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal.show').forEach(m => m.classList.remove('show'));
    }
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
      const map = {'1':'overview','2':'events','3':'venues','4':'bookings','5':'users','6':'reports','7':'logs'};
      if (map[e.key]) { e.preventDefault(); switchTab(map[e.key]); }
    }
  });

  
  ['eventsTable','bookingsTable','usersTable','logsTable'].forEach(id => {
    document.querySelectorAll(`#${id} tbody tr`).forEach((row, i) => {
      row.style.opacity   = '0';
      row.style.transform = 'translateY(6px)';
      row.style.transition = `opacity .22s ease ${i * 25}ms, transform .22s ease ${i * 25}ms`;
      requestAnimationFrame(() => { row.style.opacity = '1'; row.style.transform = 'translateY(0)'; });
    });
  });

  
  document.querySelectorAll('.flash').forEach((el, i) => {
    setTimeout(() => {
      el.style.opacity = '0'; el.style.transform = 'translateX(-10px)';
      setTimeout(() => el.remove(), 320);
    }, 3500 + i * 200);
  });

  document.head.insertAdjacentHTML('beforeend',
    '<style>.hidden{display:none!important}</style>'
  );

  
  setTimeout(() => toast('Control panel loaded', 'info'), 700);

});