# Backend Apps Script — SUB-SKU PPD 2026

`GitHubApi.gs` ialah satu-satunya fail backend portal. Ia dideploy sebagai
Google Apps Script Web App dan dipanggil oleh frontend (GitHub Pages) melalui
JSONP — lihat `js/api-client.js` dan URL deployment dalam `js/config.js`.

## Sumber data

Spreadsheet: `1ubtQghJQQtyfUA2eO_utUAWjZBS8LgohHSJ5VJ0gsOI`
(Senarai Pentadbir & MASTER SUB-SKU 2026)

Tab yang diperlukan (nama mesti sepadan dengan `CONFIG` dalam `GitHubApi.gs`):

| Tab | Baris pengepala | Kegunaan |
| --- | --- | --- |
| `MASTER SUB-SKU 2026` | 3 | Rekod induk (RECORD ID, status, PIC, dll.) |
| `REFERENCES` | 1 | Dokumen rujukan untuk halaman Rujukan |
| `PENTADBIR 2026` | 2 | Senarai pentadbir yang dibenarkan mengemaskini |
| `PORTAL AUDIT LOG` | 1 | Dicipta secara automatik semasa kemaskini pertama |

## Tindakan API

`doGet` — `health`, `bootstrap`, `records`, `record`, `adminPanel` (JSONP).
`doPost` — `updateRecord` (pentadbir sahaja; disahkan melalui e-mel organisasi).

## Deployment

1. Salin kandungan `GitHubApi.gs` ke projek Apps Script yang terikat pada akaun
   organisasi (`polipd.edu.my`).
2. Deploy sebagai Web App: *Execute as: User accessing the web app*,
   *Who has access: Anyone within polipd.edu.my*.
3. Kemas kini `apiUrl` dalam `js/config.js` jika URL deployment berubah
   (gunakan bentuk domain: `https://script.google.com/a/macros/polipd.edu.my/s/…/exec`).

Nota: jangan salin fail lain ke projek Apps Script — fungsi berganda
(contohnya `getRecords`) boleh menindih API sebenar secara senyap.
