(() => {
  const state = { bootstrap: null, records: [], recordResult: null, page: 1, filters: {}, activeView: window.INITIAL_VIEW || 'utama' };
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const gas = (name, ...args) => window.SubSkuApi.call(name, ...args);

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    bindNavigation(); bindWorkspace(); bindReferenceSearch();
    navigate(state.activeView);
    try {
      state.bootstrap = await gas('getPortalBootstrap');
      renderBootstrap();
      await loadRecords();
    } catch (error) { showFatal(error); }
  }

  function bindNavigation() {
    $$('[data-view]').forEach(control => control.addEventListener('click', event => { event.preventDefault(); navigate(control.dataset.view); }));
    $('#menu-toggle').addEventListener('click', () => {
      const nav = $('#primary-nav'); const open = nav.classList.toggle('open'); $('#menu-toggle').setAttribute('aria-expanded', String(open));
    });
  }

  function navigate(view) {
    if (!$('#view-' + view)) view = 'utama'; state.activeView = view;
    $$('.view').forEach(section => section.hidden = section.dataset.page !== view);
    $$('.primary-nav [data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === view));
    $('#primary-nav').classList.remove('open'); $('#menu-toggle').setAttribute('aria-expanded', 'false');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (view === 'pentadbir' && state.bootstrap) loadAdminPanel();
    $('#main-content').focus({ preventScroll: true });
  }

  function renderBootstrap() {
    const { summary, references, user, generatedAt } = state.bootstrap;
    const metrics = [
      ['Bilangan rekod', summary.total], ['Disahkan', summary.approved], ['Perlu tindakan', summary.action], ['% disahkan', summary.approvedPercentage + '%']
    ];
    $('#dashboard-metrics').innerHTML = metrics.map(([label, value]) => `<article class="metric-card"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></article>`).join('');
    const circles = [
      [summary.total, 'circle-navy', 'Rekod SUB-SKU'],
      [summary.teras.length, 'circle-lime', 'TERAS Strategik'],
      [summary.action, 'circle-pink', 'Perlu Tindakan'],
      [summary.approvedPercentage + '%', 'circle-coral', 'Disahkan Keseluruhan']
    ];
    $('#home-metrics').innerHTML = circles.map(([value, cls, label]) => `<div class="stat-circle"><div class="circle ${cls}">${escapeHtml(value)}</div><span>${escapeHtml(label)}</span></div>`).join('');
    $$('[data-total]').forEach(el => { el.textContent = summary.total; });
    const GAUGE_COLORS = ['var(--violet)', 'var(--lime)', 'var(--pink)', 'var(--coral)'];
    $('#home-teras').innerHTML = summary.teras.map((t, i) => {
      const color = GAUGE_COLORS[i % GAUGE_COLORS.length];
      const notStarted = t.total > 0 && t.approved === 0;
      return `<article class="gauge-card"><div class="gauge" style="background:conic-gradient(${color} 0% ${t.percentage}%, #EDEBFA ${t.percentage}% 100%)" role="img" aria-label="${t.percentage}% disahkan"><div class="gauge-core">${t.percentage}%</div></div><h3>${escapeHtml(t.name)}</h3>${notStarted ? '<span class="gauge-flag">Belum Bermula</span>' : ''}<span class="gauge-note">${t.approved} / ${t.total} disahkan</span></article>`;
    }).join('');
    $('#dashboard-teras').innerHTML = summary.teras.map(t => `<div class="teras-progress-card"><div class="tp-head"><span>${escapeHtml(t.name)}</span><span>${t.percentage}%</span></div><div class="tp-track" role="img" aria-label="${t.percentage}% disahkan"><div class="tp-fill" style="width:${t.percentage}%"></div></div><div class="tp-note">${t.approved} / ${t.total} Sub-SKU disahkan</div></div>`).join('');
    $$('.donut-core').forEach(el => { el.textContent = `${summary.total} rekod`; });
    renderDonut('#approval-donut', '#approval-bars', summary.approval, summary.total);
    renderDonut('#source-donut', '#source-bars', summary.source, summary.total);
    renderReferences(references);
    $('#data-timestamp').textContent = `Data dijana: ${generatedAt}`;
    if (!user.authorized) $('#admin-content').innerHTML = `<div class="error-box"><strong>Akses baca sahaja.</strong><br>${escapeHtml(user.reason || 'Akaun anda tidak mempunyai akses kemaskini.')}</div>`;
  }

  const DONUT_COLORS = ['#8BC53F', '#5457FF', '#B06AD1', '#FF6568', '#0A0E4A'];
  const DONUT_TEXT = ['#0A0E4A', '#fff', '#fff', '#fff', '#fff'];
  function renderDonut(donutSelector, legendSelector, data, total) {
    const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
    const sum = entries.reduce((s, [, count]) => s + count, 0) || 1;
    let acc = 0;
    $(donutSelector).style.background = 'conic-gradient(' + entries.map(([, count], i) => {
      const start = acc / sum * 360; acc += count; const end = acc / sum * 360;
      return `${DONUT_COLORS[i % DONUT_COLORS.length]} ${start}deg ${end}deg`;
    }).join(', ') + ')';
    $(legendSelector).innerHTML = entries.map(([label, count], i) => {
      const percent = total ? Math.round(count / total * 1000) / 10 : 0;
      return `<div class="legend-row"><span class="legend-pill" style="background:${DONUT_COLORS[i % DONUT_COLORS.length]};color:${DONUT_TEXT[i % DONUT_TEXT.length]}">${escapeHtml(label)}</span><span class="legend-count">${count} · ${percent}%</span></div>`;
    }).join('');
  }

  const REFERENCE_GROUPS = [['UTAMA', 'Dokumen Utama — Hala Tuju, KPI & Akreditasi'], ['SOKONGAN', 'Dokumen Sokongan'], ['DALAMAN', 'Dokumen Dalaman PPD']];
  function bindReferenceSearch() {
    const input = $('#reference-search');
    if (!input) return;
    input.addEventListener('input', () => renderReferences(state.bootstrap ? state.bootstrap.references : [], input.value));
  }
  function renderReferences(references, query = '') {
    const q = query.trim().toLowerCase();
    const rows = q ? references.filter(r => [r.title, r.shortName, r.source, r.year, r.category].filter(Boolean).join(' ').toLowerCase().includes(q)) : references;
    if (!rows.length) { $('#reference-list').innerHTML = `<div class="empty-state">${q ? 'Tiada dokumen sepadan dengan carian ini.' : 'Tiada rujukan buat masa ini.'}</div>`; return; }
    const known = REFERENCE_GROUPS.map(([key]) => key);
    const groups = REFERENCE_GROUPS.filter(([key]) => rows.some(r => r.category === key))
      .map(([key, label]) => [label, rows.filter(r => r.category === key)]);
    const others = rows.filter(r => !known.includes(r.category));
    if (others.length) groups.push(['Lain-lain', others]);
    $('#reference-list').innerHTML = groups.map(([label, groupRows]) =>
      `<section class="ref-group"><h3>${escapeHtml(label)}<span class="group-count">${groupRows.length} dokumen</span></h3>${groupRows.map(referenceCard).join('')}</section>`).join('');
  }
  function referenceCard(r) {
    const flagged = r.qaStatus && r.qaStatus !== 'PADANAN KANDUNGAN';
    const link = r.url && !flagged ? `<a href="${escapeHtml(r.url)}" target="_blank" rel="noopener noreferrer">Buka dokumen</a>` : `<span class="disabled-link">Perlu pengesahan</span>`;
    return `<article class="reference-card"><div class="reference-code">PDF</div><div><h4>${escapeHtml(r.title)}</h4><p>Sumber: ${escapeHtml([r.source, r.year].filter(Boolean).join(' · '))}</p>${flagged ? `<span class="badge unreviewed">${escapeHtml(r.qaStatus)}</span>${r.qaNote ? `<p>${escapeHtml(r.qaNote)}</p>` : ''}` : ''}</div>${link}</article>`;
  }

  function bindWorkspace() {
    const form = $('#record-filters'); let timer;
    form.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { state.page = 1; readFilters(); loadRecords(); }, 300); });
    form.addEventListener('change', () => { state.page = 1; readFilters(); loadRecords(); });
    form.addEventListener('reset', () => setTimeout(() => { state.page = 1; state.filters = {}; loadRecords(); }, 0));
    $('#previous-page').addEventListener('click', () => { if (state.page > 1) { state.page--; loadRecords(); } });
    $('#next-page').addEventListener('click', () => { if (state.recordResult && state.page < state.recordResult.pageCount) { state.page++; loadRecords(); } });
    $('#export-page').addEventListener('click', exportCurrentPage);
  }

  function readFilters() {
    state.filters = { query: $('#filter-query').value, teras: $('#filter-teras').value, tier: $('#filter-tier').value, approval: $('#filter-approval').value, tindakan: $('#filter-action').value };
  }

  async function loadRecords() {
    $('#record-rows').innerHTML = '<tr><td colspan="7">Memuatkan rekod…</td></tr>';
    try {
      const result = await gas('getRecords', { ...state.filters, page: state.page, pageSize: 20 });
      state.recordResult = result; state.records = result.rows; state.page = result.page;
      renderRecords(result); populateSelectOnce('#filter-teras', result.options.teras); populateSelectOnce('#filter-tier', result.options.tier); populateSelectOnce('#filter-approval', result.options.approval);
    } catch (error) { $('#record-rows').innerHTML = `<tr><td colspan="7">${escapeHtml(error.message)}</td></tr>`; }
  }

  function renderRecords(result) {
    $('#record-count').textContent = `${result.total} rekod ditemui`;
    $('#page-status').textContent = `Halaman ${result.page} daripada ${result.pageCount}`;
    $('#previous-page').disabled = result.page <= 1; $('#next-page').disabled = result.page >= result.pageCount;
    $('#record-rows').innerHTML = result.rows.map((r, index) => `<tr><td><strong>${escapeHtml(r.recordId)}</strong></td><td>${escapeHtml(r.teras)}</td><td>${escapeHtml(r.department)}</td><td>${escapeHtml(r.subSku)}</td><td>${statusBadge(r.statusKelulusan)}</td><td>${actionBadge(r.perluTindakan)}</td><td><button class="row-action" type="button" data-record-index="${index}">Butiran</button></td></tr>`).join('') || '<tr><td colspan="7">Tiada rekod sepadan.</td></tr>';
    $$('[data-record-index]').forEach(button => button.addEventListener('click', () => openRecord(state.records[Number(button.dataset.recordIndex)])));
  }

  function statusBadge(status) { const cls = status === 'Disahkan' ? 'approved' : status === 'Disahkan Bersyarat' ? 'conditional' : 'unreviewed'; return `<span class="badge ${cls}">${escapeHtml(status)}</span>`; }
  function actionBadge(action) { return `<span class="badge ${action === 'YA' ? 'yes' : 'no'}">${escapeHtml(action)}</span>`; }

  function openRecord(record) {
    const authorized = state.bootstrap.user.authorized;
    $('#dialog-title').textContent = record.recordId;
    const detail = (label, value, wide=false) => `<div class="detail${wide?' wide':''}"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value || '—')}</span></div>`;
    const editForm = authorized ? `<div class="edit-form" id="record-edit-form">
      ${selectField('statusPembangunan','Status pembangunan',['Draf','Sedia Disemak','Perlu Pindaan','Lengkap'],record.statusPembangunan)}
      ${selectField('statusKelulusan','Status kelulusan',['Belum Disemak','Disahkan','Disahkan Bersyarat','Ditolak'],record.statusKelulusan)}
      ${selectField('statusSumber','Status sumber',['KPI Rasmi','Rujukan Strategik','Sumber Belum Disahkan','Cadangan Baharu'],record.statusSumber)}
      ${selectField('versiRekod','Versi rekod',['1.0','1.1','1.2','2.0'],record.versiRekod)}
      <label class="wide">Catatan pindaan<textarea name="catatanPindaan" rows="3">${escapeHtml(record.catatanPindaan)}</textarea></label>
      <label class="wide">Pautan bukti / sumber<input name="pautanBukti" type="url" value="${escapeHtml(record.pautanBukti)}" placeholder="https://..."></label>
      <div class="dialog-actions wide"><button class="button button-navy" type="button" id="save-record">Simpan kemaskini</button></div>
    </div>` : '<div class="notice warning"><strong>Akses baca sahaja.</strong> Log masuk menggunakan akaun pentadbir yang tersenarai untuk mengemaskini rekod.</div>';
    $('#dialog-content').innerHTML = `<div class="dialog-body"><div class="detail-grid">${detail('Teras',record.teras)}${detail('Tier jawatan',record.tier)}${detail('Jabatan / Unit',record.department)}${detail('PIC',record.pic)}${detail('SUB-SKU 2026',record.subSku,true)}${detail('Sasaran cadangan',record.target,true)}${detail('KPI',record.kpi)}${detail('Status sumber',record.statusSumber)}${detail('Status kelulusan',record.statusKelulusan)}${detail('Perlu tindakan',record.perluTindakan)}</div>${editForm}</div>`;
    if (authorized) $('#save-record').addEventListener('click', () => saveRecord(record.recordId));
    $('#record-dialog').showModal();
  }

  function selectField(name,label,options,value) { return `<label>${escapeHtml(label)}<select name="${name}">${options.map(option=>`<option value="${escapeHtml(option)}" ${option===value?'selected':''}>${escapeHtml(option)}</option>`).join('')}</select></label>`; }
  async function saveRecord(recordId) {
    const button = $('#save-record'); button.disabled = true; button.textContent = 'Menyimpan…';
    const form = $('#record-edit-form'); const patch = {};
    $$('[name]', form).forEach(field => { patch[field.name] = field.value; });
    try { const result = await gas('updateRecord', recordId, patch); showToast(result.message); $('#record-dialog').close(); await Promise.all([refreshBootstrap(),loadRecords()]); }
    catch (error) { showToast(error.message); button.disabled = false; button.textContent = 'Simpan kemaskini'; }
  }

  async function refreshBootstrap() { state.bootstrap = await gas('getPortalBootstrap'); renderBootstrap(); }
  async function loadAdminPanel() {
    if (!state.bootstrap.user.authorized) return;
    $('#admin-content').innerHTML = '<div class="loading-card">Memuatkan panel pentadbir…</div>';
    try {
      const data = await gas('getAdminPanelData'); const o = data.overview;
      $('#admin-content').innerHTML = `<div class="notice"><strong>${escapeHtml(data.user.name || data.user.email)}</strong><br>${escapeHtml(data.user.department)}</div><div class="admin-overview">${adminCard(o.registeredAdministrators,'Pentadbir berdaftar')}${adminCard(o.completeAdministratorRecords,'Profil lengkap')}${adminCard(o.incompleteAdministratorRecords,'Profil perlu dilengkapkan')}${adminCard(o.recordsNeedingAction,'Rekod perlu tindakan')}</div><section class="panel"><h2>Aktiviti kemaskini terkini</h2><div class="activity-list">${data.activity.map(a=>`<div class="activity-item"><strong>${escapeHtml(a.recordId)} · ${escapeHtml(a.action)}</strong>${escapeHtml(a.timestamp)} · ${escapeHtml(a.email)}</div>`).join('') || '<p>Belum ada aktiviti kemaskini melalui portal.</p>'}</div></section>`;
    } catch (error) { $('#admin-content').innerHTML = `<div class="error-box">${escapeHtml(error.message)}</div>`; }
  }
  function adminCard(value,label){return `<article class="admin-card"><strong>${value}</strong><span>${escapeHtml(label)}</span></article>`;}

  function populateSelect(selector, values) { const select=$(selector); values.sort().forEach(value=>select.insertAdjacentHTML('beforeend',`<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)); }
  function populateSelectOnce(selector, values) { const select=$(selector); if(select.dataset.ready)return; populateSelect(selector,values); select.dataset.ready='true'; }
  function exportCurrentPage() {
    if (!state.records.length) return showToast('Tiada rekod untuk dieksport.');
    const headers=['RECORD ID','TERAS','JABATAN / UNIT','SUB-SKU 2026','STATUS KELULUSAN','PERLU TINDAKAN'];
    const lines=[headers,...state.records.map(r=>[r.recordId,r.teras,r.department,r.subSku,r.statusKelulusan,r.perluTindakan])].map(row=>row.map(value=>`"${String(value??'').replace(/"/g,'""')}"`).join(','));
    const blob=new Blob(['\uFEFF'+lines.join('\n')],{type:'text/csv;charset=utf-8'}); const link=document.createElement('a'); link.href=URL.createObjectURL(blob); link.download=`sub-sku-halaman-${state.page}.csv`; link.click(); URL.revokeObjectURL(link.href);
  }
  function showToast(message){const toast=$('#toast');toast.textContent=message;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),3500);}
  function showFatal(error){ $$('.metric-grid').forEach(el=>el.innerHTML=`<div class="error-box">${escapeHtml(error.message)}</div>`); showToast(error.message); }
})();
