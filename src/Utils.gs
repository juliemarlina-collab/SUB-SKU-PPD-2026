// SUB-SKU PPD 2026 - Utility Functions

function formatDate(date) {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('ms-MY');
}

function formatTime(date) {
  if (!date) return '-';
  return new Date(date).toLocaleTimeString('ms-MY');
}

function getStatusBadgeColor(status) {
  switch(status) {
    case 'Assigned':
      return '#CFFA66'; // Lime
    case 'Not Assigned':
      return '#FF6B6B'; // Coral
    default:
      return '#999999';
  }
}

function getStatusBadgeText(status) {
  switch(status) {
    case 'Assigned':
      return 'Disahkan';
    case 'Not Assigned':
      return 'Belum Disahkan';
    default:
      return status;
  }
}

function sanitizeInput(input) {
  if (!input) return '';
  return input.toString().trim();
}

function calculatePercentage(part, total) {
  if (total === 0) return 0;
  return ((part / total) * 100).toFixed(1);
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Selamat Pagi';
  if (hour < 17) return 'Selamat Petang';
  return 'Selamat Malam';
}
