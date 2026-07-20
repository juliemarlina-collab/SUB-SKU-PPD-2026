// SUB-SKU PPD 2026 - Server Functions
// These functions handle data from Google Sheets

function getDashboardData() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheets()[0];
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    
    let total = 0;
    let assigned = 0;
    let pending = 0;
    
    data.forEach(row => {
      if(row[0]) total++;
      const status = row[6];
      if(status === 'Assigned') assigned++;
      else pending++;
    });
    
    const percentage = total > 0 ? ((assigned / total) * 100).toFixed(1) : 0;
    
    return {
      total: total,
      assigned: assigned,
      pending: pending,
      percentage: percentage
    };
  } catch(e) {
    return { total: 0, assigned: 0, pending: 0, percentage: 0 };
  }
}

function getRecords(limit = 10) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheets()[0];
    const data = sheet.getRange(2, 1, Math.min(limit, sheet.getLastRow() - 1), sheet.getLastColumn()).getValues();
    return data;
  } catch(e) {
    return [];
  }
}

function searchRecords(term) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheets()[0];
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    
    const results = [];
    const searchTerm = term.toLowerCase();
    
    data.forEach(row => {
      const name = row[1] ? row[1].toString().toLowerCase() : '';
      const dept = row[2] ? row[2].toString().toLowerCase() : '';
      const email = row[3] ? row[3].toString().toLowerCase() : '';
      
      if(name.includes(searchTerm) || dept.includes(searchTerm) || email.includes(searchTerm)) {
        results.push({
          bil: row[0],
          nama: row[1],
          jabatan: row[2],
          email: row[3],
          status: row[6]
        });
      }
    });
    
    return results;
  } catch(e) {
    return [];
  }
}

function getStatsByDepartment() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheets()[0];
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    
    const stats = {};
    
    data.forEach(row => {
      const dept = row[2];
      if(!dept) return;
      
      if(!stats[dept]) {
        stats[dept] = { total: 0, assigned: 0 };
      }
      
      stats[dept].total++;
      if(row[6] === 'Assigned') {
        stats[dept].assigned++;
      }
    });
    
    return stats;
  } catch(e) {
    return {};
  }
}

function updateRecordStatus(rowNum, status) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheets()[0];
    
    sheet.getRange(rowNum, 7).setValue(status);
    sheet.getRange(rowNum, 8).setValue(new Date());
    
    return { success: true, message: 'Updated' };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}
