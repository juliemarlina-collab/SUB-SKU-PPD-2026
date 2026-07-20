// SUB-SKU PPD 2026 - Main JavaScript

console.log('SUB-SKU App Loaded');

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM Ready - Initializing SUB-SKU App');
  initializeApp();
});

function initializeApp() {
  // Check if Google Apps Script is available
  if (typeof google !== 'undefined' && google.script) {
    console.log('Google Apps Script available');
  } else {
    console.log('Running outside Google Apps Script environment');
  }
}

// Navigation
function navigateTo(page) {
  window.location.href = page + '.html';
}

// Utility: Format date
function formatDate(date) {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('ms-MY', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// Utility: Format number
function formatNumber(num) {
  return new Intl.NumberFormat('ms-MY').format(num);
}

// Utility: Show message
function showMessage(message, type = 'info') {
  console.log(`[${type.toUpperCase()}] ${message}`);
  // Can be extended to show toast notification
}

// Utility: Handle errors
function handleError(error) {
  console.error('Error:', error);
  showMessage('Ada kesalahan: ' + error.toString(), 'error');
}

// Export for use in other scripts
window.SubSKU = {
  navigateTo,
  formatDate,
  formatNumber,
  showMessage,
  handleError
};
