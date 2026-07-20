const CONFIG = Object.freeze({
  spreadsheetId: '1ubtQghJQQtyfUA2eO_utUAWjZBS8LgohHSJ5VJ0gsOI',
  masterSheet: 'MASTER SUB-SKU 2026',
  referenceSheet: 'REFERENCES',
  adminSheet: 'PENTADBIR 2026',
  auditSheet: 'PORTAL AUDIT LOG',
  headerRow: 3,
  adminHeaderRow: 2,
  pageSize: 20,
  maxPageSize: 50,
  allowedDomain: 'polipd.edu.my'
});

function doGet(e) {
  try {
    const parameters = (e && e.parameter) || {};
    const action = clean_(parameters.action || 'health');
    let data;
    if (action === 'health') data = { service: 'SUB-SKU PPD 2026 API', status: 'ok', version: '2.1.0' };
    else if (action === 'bootstrap') data = getPortalBootstrap();
    else if (action === 'records') data = getRecords(parameters);
    else if (action === 'record') data = getRecordById_(clean_(parameters.recordId));
    else if (action === 'adminPanel') data = getAdminPanelData();
    else throw new Error('Tindakan API tidak disokong.');
    return apiOutput_({ ok: true, data: data }, parameters.callback);
  } catch (error) {
    return apiOutput_({ ok: false, error: error.message || String(error) }, e && e.parameter && e.parameter.callback);
  }
}

function doPost(e) {
  try {
    const parameters = (e && e.parameter) || {};
    if (clean_(parameters.action) !== 'updateRecord') throw new Error('Tindakan kemaskini tidak disokong.');
    const patch = JSON.parse(parameters.patch || '{}');
    const result = updateRecord(clean_(parameters.recordId), patch);
    return apiOutput_({ ok: true, data: result });
  } catch (error) {
    return apiOutput_({ ok: false, error: error.message || String(error) });
  }
}

function apiOutput_(payload, callback) {
  const json = JSON.stringify(payload);
  callback = clean_(callback);
  if (callback) {
    if (!/^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback)) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Nama callback tidak sah.' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService.createTextOutput(callback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function getPortalBootstrap() {
  const records = getMasterRecords_();
  return {
    generatedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd MMM yyyy, HH:mm'),
    summary: buildSummary_(records),
    references: getReferences_(),
    user: getUserContext_()
  };
}

function getRecords(params) {
  params = params || {};
  const records = getMasterRecords_();
  const query = clean_(params.query).toLowerCase();
  const teras = clean_(params.teras);
  const tier = clean_(params.tier);
  const approval = clean_(params.approval);
  const action = clean_(params.action);
  const filtered = records.filter(function (record) {
    const haystack = [record.recordId, record.teras, record.kluster, record.tier, record.pic,
      record.department, record.subSku, record.target, record.kpi].join(' ').toLowerCase();
    return (!query || haystack.indexOf(query) !== -1) &&
      (!teras || record.teras === teras) &&
      (!tier || record.tier === tier) &&
      (!approval || record.statusKelulusan === approval) &&
      (!action || record.perluTindakan === action);
  });
  const pageSize = Math.min(Math.max(Number(params.pageSize) || CONFIG.pageSize, 1), CONFIG.maxPageSize);
  const pageCount = Math.max(Math.ceil(filtered.length / pageSize), 1);
  const page = Math.min(Math.max(Number(params.page) || 1, 1), pageCount);
  const start = (page - 1) * pageSize;
  return {
    rows: filtered.slice(start, start + pageSize),
    total: filtered.length,
    page: page,
    pageSize: pageSize,
    pageCount: pageCount,
    options: {
      teras: unique_(records.map(function (r) { return r.teras; })),
      tier: unique_(records.map(function (r) { return r.tier; })),
      approval: unique_(records.map(function (r) { return r.statusKelulusan; }))
    }
  };
}

function getAdminPanelData() {
  const user = requireAdministrator_();
  const records = getMasterRecords_();
  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const admins = getSheetObjects_(ss.getSheetByName(CONFIG.adminSheet), CONFIG.adminHeaderRow);
  const auditSheet = ss.getSheetByName(CONFIG.auditSheet);
  let activity = [];
  if (auditSheet && auditSheet.getLastRow() > 1) {
    const start = Math.max(2, auditSheet.getLastRow() - 19);
    activity = auditSheet.getRange(start, 1, auditSheet.getLastRow() - start + 1, 5)
      .getDisplayValues().reverse().map(function (row) {
        return { timestamp: row[0], email: row[1], recordId: row[2], action: row[3], detail: row[4] };
      });
  }
  return {
    user: user,
    overview: {
      registeredAdministrators: admins.length,
      completeAdministratorRecords: admins.filter(function (a) { return a['STATUS QA DATA'] === 'LENGKAP'; }).length,
      incompleteAdministratorRecords: admins.filter(function (a) { return a['STATUS QA DATA'] === 'PERLU LENGKAPKAN'; }).length,
      recordsNeedingAction: records.filter(function (r) { return r.perluTindakan === 'YA'; }).length
    },
    activity: activity
  };
}

function updateRecord(recordId, patch) {
  const user = requireAdministrator_();
  recordId = clean_(recordId);
  if (!/^SSKU-2026-\d{4}$/.test(recordId)) throw new Error('ID rekod tidak sah.');
  patch = patch || {};
  validatePatch_(patch);

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
    const sheet = ss.getSheetByName(CONFIG.masterSheet);
    const headers = sheet.getRange(CONFIG.headerRow, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
    const recordIdColumn = headers.indexOf('RECORD ID') + 1;
    const match = sheet.getRange(CONFIG.headerRow + 1, recordIdColumn, sheet.getLastRow() - CONFIG.headerRow, 1)
      .createTextFinder(recordId).matchEntireCell(true).findNext();
    if (!match) throw new Error('Rekod tidak ditemui.');

    const row = match.getRow();
    const fieldMap = {
      statusPembangunan: 'STATUS PEMBANGUNAN',
      statusKelulusan: 'STATUS KELULUSAN',
      statusSumber: 'STATUS SUMBER',
      pegawaiPenyemak: 'PEGAWAI PENYEMAK',
      tarikhSemakan: 'TARIKH SEMAKAN',
      tarikhKemaskini: 'TARIKH KEMASKINI',
      catatanPindaan: 'CATATAN PINDAAN',
      pautanBukti: 'PAUTAN BUKTI / SUMBER',
      versiRekod: 'VERSI REKOD'
    };
    const oldValues = {};
    const newValues = {};
    Object.keys(fieldMap).forEach(function (key) {
      if (!Object.prototype.hasOwnProperty.call(patch, key)) return;
      const column = headers.indexOf(fieldMap[key]) + 1;
      if (!column) throw new Error('Medan tidak ditemui: ' + fieldMap[key]);
      const cell = sheet.getRange(row, column);
      oldValues[key] = cell.getDisplayValue();
      const value = clean_(patch[key]);
      cell.setValue(value);
      newValues[key] = value;
    });
    setIfBlank_(sheet, row, headers, 'PEGAWAI PENYEMAK', user.name || user.email);
    setIfBlank_(sheet, row, headers, 'TARIKH SEMAKAN', new Date());
    setCell_(sheet, row, headers, 'TARIKH KEMASKINI', new Date());
    SpreadsheetApp.flush();
    appendAudit_(ss, user.email, recordId, 'KEMASKINI REKOD', JSON.stringify({ before: oldValues, after: newValues }));
    return { ok: true, message: 'Rekod ' + recordId + ' telah dikemaskini.', record: getRecordById_(recordId) };
  } finally {
    lock.releaseLock();
  }
}

function getMasterRecords_() {
  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const sheet = ss.getSheetByName(CONFIG.masterSheet);
  const table = getSheetObjects_(sheet, CONFIG.headerRow);
  return table.filter(function (row) { return row['RECORD ID']; }).map(function (row) {
    return {
      bil: row.BIL,
      teras: row.TERAS,
      kluster: row.KLUSTER,
      tier: row['TIER JAWATAN'],
      pic: row.PIC,
      department: row['JABATAN / UNIT'],
      subSku: row['SUB-SKU 2026'],
      target: row['SASARAN CADANGAN'],
      kpi: row.KPI,
      apacc: row.APACC,
      takwim: row.TAKWIM,
      legacyStatus: row['STATUS VALIDASI'],
      legacyNote: row['CATATAN SEMAKAN'],
      recordId: row['RECORD ID'],
      statusPembangunan: row['STATUS PEMBANGUNAN'],
      statusKelulusan: row['STATUS KELULUSAN'],
      statusSumber: row['STATUS SUMBER'],
      pegawaiPenyemak: row['PEGAWAI PENYEMAK'],
      tarikhSemakan: row['TARIKH SEMAKAN'],
      tarikhKemaskini: row['TARIKH KEMASKINI'],
      catatanPindaan: row['CATATAN PINDAAN'],
      pautanBukti: safeUrl_(row['PAUTAN BUKTI / SUMBER']),
      versiRekod: row['VERSI REKOD'],
      perluTindakan: row['PERLU TINDAKAN']
    };
  });
}

function getRecordById_(recordId) {
  return getMasterRecords_().filter(function (r) { return r.recordId === recordId; })[0] || null;
}

function buildSummary_(records) {
  const approval = countBy_(records, 'statusKelulusan');
  const source = countBy_(records, 'statusSumber');
  const teras = countBy_(records, 'teras');
  const terasRows = Object.keys(teras).sort().map(function (name) {
    const subset = records.filter(function (r) { return r.teras === name; });
    const approved = subset.filter(function (r) { return r.statusKelulusan === 'Disahkan'; }).length;
    return { name: name, total: subset.length, approved: approved, percentage: subset.length ? Math.round(approved / subset.length * 1000) / 10 : 0 };
  });
  const approved = approval.Disahkan || 0;
  return {
    total: records.length,
    approved: approved,
    conditional: approval['Disahkan Bersyarat'] || 0,
    unreviewed: approval['Belum Disemak'] || 0,
    action: records.filter(function (r) { return r.perluTindakan === 'YA'; }).length,
    officialKpi: source['KPI Rasmi'] || 0,
    strategicReference: source['Rujukan Strategik'] || 0,
    approvedPercentage: records.length ? Math.round(approved / records.length * 1000) / 10 : 0,
    approval: approval,
    source: source,
    teras: terasRows
  };
}

function getReferences_() {
  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  return getSheetObjects_(ss.getSheetByName(CONFIG.referenceSheet), 1)
    .filter(function (r) { return r.id && String(r.active).toUpperCase() !== 'FALSE'; })
    .map(function (r) {
      return {
        id: r.id,
        title: r.title,
        shortName: r.short_name,
        category: r.category,
        source: r.source,
        year: r.year,
        url: safeUrl_(r.url),
        qaStatus: r['STATUS QA URL'],
        qaNote: r['CATATAN QA URL'],
        reviewedAt: r['TARIKH SEMAKAN URL']
      };
    });
}

function getUserContext_() {
  const email = clean_(Session.getActiveUser().getEmail()).toLowerCase();
  if (!email) return { email: '', name: '', department: '', authorized: false, reason: 'Log masuk organisasi diperlukan untuk kemaskini.' };
  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const admins = getSheetObjects_(ss.getSheetByName(CONFIG.adminSheet), CONFIG.adminHeaderRow);
  const match = admins.filter(function (row) {
    return clean_(row['eMEL rasmi @polipd.edu.my']).toLowerCase() === email;
  })[0];
  return {
    email: email,
    name: match ? match.Nama : '',
    department: match ? match.Jabatan : '',
    authorized: Boolean(match && email.endsWith('@' + CONFIG.allowedDomain)),
    reason: match ? '' : 'E-mel tidak disenaraikan dalam PENTADBIR 2026.'
  };
}

function requireAdministrator_() {
  const user = getUserContext_();
  if (!user.authorized) throw new Error(user.reason || 'Akses pentadbir diperlukan.');
  return user;
}

function validatePatch_(patch) {
  const allowed = ['statusPembangunan', 'statusKelulusan', 'statusSumber', 'pegawaiPenyemak',
    'tarikhSemakan', 'tarikhKemaskini', 'catatanPindaan', 'pautanBukti', 'versiRekod'];
  Object.keys(patch).forEach(function (key) {
    if (allowed.indexOf(key) === -1) throw new Error('Medan kemaskini tidak dibenarkan: ' + key);
  });
  const lists = {
    statusPembangunan: ['Draf', 'Sedia Disemak', 'Perlu Pindaan', 'Lengkap'],
    statusKelulusan: ['Belum Disemak', 'Disahkan', 'Disahkan Bersyarat', 'Ditolak'],
    statusSumber: ['KPI Rasmi', 'Rujukan Strategik', 'Sumber Belum Disahkan', 'Cadangan Baharu'],
    versiRekod: ['1.0', '1.1', '1.2', '2.0']
  };
  Object.keys(lists).forEach(function (key) {
    if (Object.prototype.hasOwnProperty.call(patch, key) && lists[key].indexOf(clean_(patch[key])) === -1) {
      throw new Error('Nilai tidak sah untuk ' + key + '.');
    }
  });
  if (patch.pautanBukti && !safeUrl_(patch.pautanBukti)) throw new Error('Pautan bukti mestilah URL HTTPS yang sah.');
}

function getSheetObjects_(sheet, headerRow) {
  if (!sheet) throw new Error('Tab spreadsheet tidak ditemui.');
  if (sheet.getLastRow() < headerRow) return [];
  const values = sheet.getRange(headerRow, 1, sheet.getLastRow() - headerRow + 1, sheet.getLastColumn()).getDisplayValues();
  const headers = values.shift().map(clean_);
  return values.map(function (row) {
    const object = {};
    headers.forEach(function (header, index) { if (header) object[header] = clean_(row[index]); });
    return object;
  });
}

function appendAudit_(ss, email, recordId, action, detail) {
  let sheet = ss.getSheetByName(CONFIG.auditSheet);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.auditSheet);
    sheet.appendRow(['TIMESTAMP', 'EMAIL', 'RECORD ID', 'TINDAKAN', 'BUTIRAN']);
    sheet.setFrozenRows(1);
  }
  sheet.appendRow([new Date(), email, recordId, action, detail]);
}

function setIfBlank_(sheet, row, headers, header, value) {
  const column = headers.indexOf(header) + 1;
  if (column && !sheet.getRange(row, column).getValue()) sheet.getRange(row, column).setValue(value);
}

function setCell_(sheet, row, headers, header, value) {
  const column = headers.indexOf(header) + 1;
  if (column) sheet.getRange(row, column).setValue(value);
}

function countBy_(rows, key) {
  return rows.reduce(function (result, row) {
    const value = row[key] || 'Tidak dinyatakan';
    result[value] = (result[value] || 0) + 1;
    return result;
  }, {});
}

function unique_(values) {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

function safeUrl_(value) {
  value = clean_(value);
  return /^https:\/\//i.test(value) ? value : '';
}

function clean_(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}
