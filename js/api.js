// SUB-SKU PPD 2026 - API Functions (calls to Google Apps Script)

// Check if Google Apps Script is available
function isGoogleScriptAvailable() {
  return typeof google !== 'undefined' && google.script;
}

// Get dashboard metrics
function callGetDashboardData(callback) {
  if (!isGoogleScriptAvailable()) {
    callback({ total: 0, assigned: 0, pending: 0, percentage: 0 });
    return;
  }
  
  google.script.run
    .withSuccessHandler(callback)
    .withFailureHandler(function(error) {
      console.error('Error loading dashboard data:', error);
      callback({ total: 0, assigned: 0, pending: 0, percentage: 0 });
    })
    .getDashboardData();
}

// Get records
function callGetRecords(limit, callback) {
  if (!isGoogleScriptAvailable()) {
    callback([]);
    return;
  }
  
  google.script.run
    .withSuccessHandler(callback)
    .withFailureHandler(function(error) {
      console.error('Error loading records:', error);
      callback([]);
    })
    .getRecords(limit || 10);
}

// Search records
function callSearchRecords(term, callback) {
  if (!isGoogleScriptAvailable()) {
    callback([]);
    return;
  }
  
  google.script.run
    .withSuccessHandler(callback)
    .withFailureHandler(function(error) {
      console.error('Error searching records:', error);
      callback([]);
    })
    .searchRecords(term);
}

// Get statistics by department
function callGetStatsByDepartment(callback) {
  if (!isGoogleScriptAvailable()) {
    callback({});
    return;
  }
  
  google.script.run
    .withSuccessHandler(callback)
    .withFailureHandler(function(error) {
      console.error('Error loading department stats:', error);
      callback({});
    })
    .getStatsByDepartment();
}

// Update record status
function callUpdateRecordStatus(rowNum, status, callback) {
  if (!isGoogleScriptAvailable()) {
    callback({ success: false, error: 'Google Apps Script not available' });
    return;
  }
  
  google.script.run
    .withSuccessHandler(callback)
    .withFailureHandler(function(error) {
      console.error('Error updating record:', error);
      callback({ success: false, error: error.toString() });
    })
    .updateRecordStatus(rowNum, status);
}

// Export for use
window.API = {
  callGetDashboardData,
  callGetRecords,
  callSearchRecords,
  callGetStatsByDepartment,
  callUpdateRecordStatus,
  isGoogleScriptAvailable
};
