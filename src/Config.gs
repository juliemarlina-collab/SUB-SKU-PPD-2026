// SUB-SKU PPD 2026 - Configuration
// App settings and constants

const APP_CONFIG = {
  APP_NAME: 'SUB-SKU PPD 2026',
  APP_VERSION: '2.0.1',
  SUBTITLE: 'Hub Pengurusan Strategik Digital',
  
  // Colors (matching formal design)
  COLORS: {
    NAVY: '#0A0E4A',
    BLUE_VIOLET: '#5457FF',
    LIME: '#CFFA66',
    CORAL: '#FF6B6B',
    PINK: '#FF69A4'
  },
  
  // Sheet settings
  MAIN_SHEET: 0, // First sheet (index 0)
  HEADER_ROW: 1,
  DATA_START_ROW: 2,
  
  // Column mapping
  COLUMNS: {
    BIL: 0,
    NAMA: 1,
    JABATAN: 2,
    EMAIL: 3,
    CONTACT: 4,
    PAUTAN: 5,
    STATUS: 6,
    CHECKED_DATE: 7,
    NOTES: 8
  },
  
  // Pagination
  RECORDS_PER_PAGE: 10,
  
  // Status values
  STATUS_VALUES: {
    ASSIGNED: 'Assigned',
    NOT_ASSIGNED: 'Not Assigned'
  }
};

function getConfig() {
  return APP_CONFIG;
}
