/* ============================================================
   APP.JS – SmartMeter Dashboard Logic
   ============================================================ */

'use strict';

// ============================================================
// CẤU HÌNH & DỮ LIỆU MẪU
// ============================================================
const CONFIG = {
  serverUrl:      localStorage.getItem('cfg_server') || window.location.origin,
  refreshInterval: parseInt(localStorage.getItem('cfg_interval') || '30') * 1000,
  useDemoData:    false,   // false = dùng server thật; true = dùng dữ liệu mô phỏng khi server không trả về
};

// Dữ liệu mô phỏng cho chế độ demo
const DEMO_DATA = {
  meters: [
    {
      id: 'MTR-001', name: 'Công Tơ A-101', location: 'Khu A, Phòng 101',
      address: '123 Nguyễn Văn Linh', lat: 10.7769, lng: 106.7009,
      customer: 'Nguyễn Văn An', phone: '0901 234 567', status: 'active',
      latest_reading: 1487.3, last_reading_time: relativeTime(-15),
      ocr_confidence: 0.96, unread_alerts: 0, rssi: -62
    },
    {
      id: 'MTR-002', name: 'Công Tơ A-102', location: 'Khu A, Phòng 102',
      address: '125 Nguyễn Văn Linh', lat: 10.7772, lng: 106.7012,
      customer: 'Trần Thị Bình', phone: '0912 345 678', status: 'active',
      latest_reading: 1023.8, last_reading_time: relativeTime(-30),
      ocr_confidence: 0.91, unread_alerts: 1, rssi: -75
    },
    {
      id: 'MTR-003', name: 'Công Tơ B-201', location: 'Khu B, Phòng 201',
      address: '45 Lê Lợi', lat: 10.7758, lng: 106.6995,
      customer: 'Lê Văn Cường', phone: '0923 456 789', status: 'warning',
      latest_reading: 2387.5, last_reading_time: relativeTime(-45),
      ocr_confidence: 0.88, unread_alerts: 2, rssi: -55
    },
    {
      id: 'MTR-004', name: 'Công Tơ B-202', location: 'Khu B, Phòng 202',
      address: '47 Lê Lợi', lat: 10.7755, lng: 106.6998,
      customer: 'Phạm Thị Dung', phone: '0934 567 890', status: 'offline',
      latest_reading: 578.1, last_reading_time: relativeTime(-180),
      ocr_confidence: 0.73, unread_alerts: 1, rssi: -90
    },
    {
      id: 'MTR-005', name: 'Công Tơ C-301', location: 'Khu C, Phòng 301',
      address: '89 Đinh Tiên Hoàng', lat: 10.7780, lng: 106.7025,
      customer: 'Hoàng Văn Em', phone: '0945 678 901', status: 'danger',
      latest_reading: 1956.4, last_reading_time: relativeTime(-60),
      ocr_confidence: 0.93, unread_alerts: 1, rssi: -68
    },
  ],

  alerts: [
    {
      id: 1, meter_id: 'MTR-003', meter_name: 'Công Tơ B-201',
      alert_type: 'spike', severity: 'danger',
      message: 'Tiêu thụ điện tăng đột biến! Mức tăng: 10.5 kWh (gấp 4.2x mức TB)',
      value: 10.5, created_at: relativeTime(-45), is_read: 0
    },
    {
      id: 2, meter_id: 'MTR-005', meter_name: 'Công Tơ C-301',
      alert_type: 'theft', severity: 'danger',
      message: 'Nghi ngờ TRỘM ĐIỆN! Chỉ số giảm 5.2 kWh: 1961.6 → 1956.4 kWh',
      value: -5.2, created_at: relativeTime(-60), is_read: 0
    },
    {
      id: 3, meter_id: 'MTR-004', meter_name: 'Công Tơ B-202',
      alert_type: 'offline', severity: 'warning',
      message: 'Thiết bị không gửi dữ liệu trong 3.0 giờ!',
      value: 3.0, created_at: relativeTime(-180), is_read: 0
    },
    {
      id: 4, meter_id: 'MTR-002', meter_name: 'Công Tơ A-102',
      alert_type: 'night_usage', severity: 'warning',
      message: 'Tiêu thụ điện ban đêm cao bất thường: 2.3 kWh/h (ngưỡng: 1.5 kWh/h)',
      value: 2.3, created_at: relativeTime(-300), is_read: 0
    },
    {
      id: 5, meter_id: 'MTR-004', meter_name: 'Công Tơ B-202',
      alert_type: 'ocr_failed', severity: 'info',
      message: 'OCR thất bại 3 lần liên tiếp, kiểm tra camera và ánh sáng',
      value: null, created_at: relativeTime(-360), is_read: 0
    },
  ],

  stats: {
    total_meters: 5,
    total_readings: 3240,
    unread_alerts: 5,
    today_kwh: 47.8,
  }
};

// ============================================================
// UTILITIES
// ============================================================
function relativeTime(minutesAgo) {
  const d = new Date(Date.now() + minutesAgo * 60000);
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

function formatTime(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1)   return 'Vừa xong';
  if (diffMin < 60)  return `${diffMin} phút trước`;
  if (diffMin < 1440) return `${Math.floor(diffMin/60)} giờ trước`;
  return d.toLocaleDateString('vi-VN');
}

function formatNumber(n, decimals = 1) {
  if (n == null) return '—';
  return Number(n).toLocaleString('vi-VN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function confColor(c) {
  if (c >= 0.9) return '#10b981';
  if (c >= 0.7) return '#f59e0b';
  return '#ef4444';
}

function statusBadge(status) {
  const map = {
    active:  '<span class="badge badge-success">● Hoạt động</span>',
    warning: '<span class="badge badge-warning">⚠ Cảnh báo</span>',
    offline: '<span class="badge badge-offline">○ Offline</span>',
    danger:  '<span class="badge badge-danger">✖ Nguy hiểm</span>',
  };
  return map[status] || `<span class="badge">${status}</span>`;
}

function alertIcon(type, severity) {
  const icons = {
    spike:      '⚡',
    theft:      '🔓',
    offline:    '📡',
    night_usage:'🌙',
    ocr_failed: '📷',
  };
  return icons[type] || '⚠';
}

function alertBgColor(severity) {
  const map = { danger: 'rgba(239,68,68,0.1)', warning: 'rgba(245,158,11,0.1)', info: 'rgba(59,130,246,0.1)' };
  return map[severity] || 'rgba(255,255,255,0.05)';
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// ============================================================
// NAVIGATION
// ============================================================
const PAGE_TITLES = {
  overview: 'Tổng Quan',
  meters:   'Danh Sách Công Tơ',
  map:      'Bản Đồ',
  charts:   'Biểu Đồ Phân Tích',
  alerts:   'Cảnh Báo',
  camera:   'Ảnh Công Tơ',
  billing:  'Tính Tiền Điện',
  settings: 'Cài Đặt',
};

let currentPage = 'overview';
let mapInitialized = false;

function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) pageEl.classList.add('active');

  const navEl = document.getElementById(`nav-${page}`);
  if (navEl) navEl.classList.add('active');

  document.getElementById('page-title').textContent = PAGE_TITLES[page] || page;
  currentPage = page;

  // Khởi tạo bản đồ lazy
  if (page === 'map' && !mapInitialized) {
    initMap();
    mapInitialized = true;
  }

  // Cập nhật chart khi chuyển tab
  if (page === 'charts') {
    setTimeout(() => { updateHourlyChart(); updateMonthlyChart(); updateTimelineChart(); }, 100);
  }

  window.scrollTo(0, 0);
  return false;
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const main    = document.querySelector('.main-content');
  sidebar.classList.toggle('collapsed');
  main.classList.toggle('expanded');
}

// ============================================================
// CLOCK
// ============================================================
function updateClock() {
  const now = new Date();
  document.getElementById('topbar-time').textContent =
    now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
setInterval(updateClock, 1000);
updateClock();

// ============================================================
// DATA LOADING
// ============================================================
async function fetchData(endpoint) {
  try {
    const res = await fetch(`${CONFIG.serverUrl}${endpoint}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    return null; // Trả về null → dùng demo data
  }
}

async function loadStats() {
  const data = await fetchData('/api/stats') || DEMO_DATA.stats;
  document.getElementById('stat-meters').textContent   = data.total_meters;
  document.getElementById('stat-kwh').textContent      = formatNumber(data.today_kwh);
  document.getElementById('stat-alerts').textContent   = data.unread_alerts;
  document.getElementById('stat-readings').textContent = data.total_readings.toLocaleString();
  document.getElementById('badge-count').textContent   = data.unread_alerts;
  document.getElementById('trend-kwh').textContent     = `↑ ${formatNumber(data.today_kwh)} kWh tổng cộng`;
}

async function loadMeters() {
  const data    = await fetchData('/api/meters');
  const meters  = data ? data.meters : DEMO_DATA.meters;
  renderMetersGrid(meters);
  renderRecentTable(meters);
  populateMeterSelects(meters);
  renderCameraGallery(meters);
  return meters;
}

async function loadAlerts() {
  const data   = await fetchData('/api/alerts');
  const alerts = data ? data.alerts : DEMO_DATA.alerts;
  renderAlerts(alerts, 'all');
}

// ============================================================
// RENDER: RECENT TABLE (Trang Tổng Quan)
// ============================================================
function renderRecentTable(meters) {
  const tbody = document.getElementById('tbody-recent');
  tbody.innerHTML = meters.map(m => {
    const conf    = m.ocr_confidence || 0;
    const confPct = Math.round(conf * 100);
    const barColor = confColor(conf);
    return `
      <tr>
        <td><strong>${m.name}</strong></td>
        <td>${m.location}</td>
        <td class="mono" style="color:#60a5fa;font-size:15px">${formatNumber(m.latest_reading)}</td>
        <td>
          <div class="conf-bar-wrap">
            <div class="conf-bar">
              <div class="conf-bar-fill" style="width:${confPct}%;background:${barColor}"></div>
            </div>
            <span class="conf-val" style="color:${barColor}">${confPct}%</span>
          </div>
        </td>
        <td style="color:var(--text-muted)">${formatTime(m.last_reading_time)}</td>
        <td>${statusBadge(m.status)}</td>
      </tr>`;
  }).join('');
}

// ============================================================
// RENDER: METERS GRID
// ============================================================
let allMeters = [];

function renderMetersGrid(meters) {
  allMeters = meters;
  const grid = document.getElementById('meters-grid');
  grid.innerHTML = meters.map(m => {
    const rssi = m.rssi || -70;
    const signalClass = rssi > -65 ? 'good' : rssi > -80 ? 'ok' : 'weak';

    return `
      <div class="meter-card" onclick="openMeterModal('${m.id}')">
        <div class="meter-card-header">
          <div>
            <div class="meter-id">${m.id}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <div class="signal-bars ${signalClass}" title="WiFi: ${rssi} dBm">
              <span></span><span></span><span></span><span></span>
            </div>
            ${statusBadge(m.status)}
          </div>
        </div>
        <div class="meter-name">${m.name}</div>
        <div class="meter-location">📍 ${m.location}</div>
        <div class="meter-reading">${formatNumber(m.latest_reading)}</div>
        <div class="meter-reading-unit">kWh – Chỉ số hiện tại</div>
        <div class="meter-meta">
          <span>👤 ${m.customer || '—'}</span>
          <span class="meter-last-seen">
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            ${formatTime(m.last_reading_time)}
          </span>
          ${m.unread_alerts > 0 ? `<span style="color:var(--accent-orange)">⚠ ${m.unread_alerts} cảnh báo</span>` : ''}
        </div>
      </div>`;
  }).join('');
}

function filterMeters(query) {
  const statusFilter = document.getElementById('filter-status')?.value || '';
  const q = query.toLowerCase();
  const filtered = allMeters.filter(m => {
    const matchText = !q || [m.id, m.name, m.location, m.address, m.customer]
      .some(v => v && v.toLowerCase().includes(q));
    const matchStatus = !statusFilter || m.status === statusFilter;
    return matchText && matchStatus;
  });
  renderMetersGrid(filtered);
}

// ============================================================
// RENDER: ALERTS
// ============================================================
let allAlerts = [];

function renderAlerts(alerts, filter) {
  allAlerts = alerts;
  const list = document.getElementById('alerts-list');
  const filtered = filter === 'all' ? alerts : alerts.filter(a => a.severity === filter);

  if (filtered.length === 0) {
    list.innerHTML = `<div style="text-align:center;padding:48px;color:var(--text-muted)">✅ Không có cảnh báo nào</div>`;
    return;
  }

  list.innerHTML = filtered.map(a => `
    <div class="alert-item ${a.severity}" id="alert-${a.id}">
      <div class="alert-icon" style="background:${alertBgColor(a.severity)}">${alertIcon(a.alert_type, a.severity)}</div>
      <div class="alert-content">
        <div class="alert-meter">${a.meter_name || a.meter_id} · ${a.meter_id}</div>
        <div class="alert-message">${a.message}</div>
        <div class="alert-time">🕐 ${formatTime(a.created_at)}</div>
      </div>
      <button class="alert-dismiss" onclick="dismissAlert(${a.id})">Đã xử lý</button>
    </div>`).join('');
}

function filterAlerts(type, btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderAlerts(allAlerts, type);
}

async function dismissAlert(id) {
  try {
    await fetch(`${CONFIG.serverUrl}/api/alerts/${id}/read`, { method: 'POST' });
  } catch (_) {}
  const el = document.getElementById(`alert-${id}`);
  if (el) { el.style.opacity = '0'; el.style.transform = 'translateX(20px)'; setTimeout(() => el.remove(), 300); }
  showToast('Cảnh báo đã được đánh dấu xử lý', 'success');
}


// ============================================================
// RENDER: CAMERA GALLERY
// ============================================================
function renderCameraGallery(meters) {
  const gallery = document.getElementById('camera-gallery');
  // Hiển thị ảnh thực tế nếu có, ngược lại dùng SVG mô phỏng
  gallery.innerHTML = meters.map(m => {
    const hasImage = m.latest_image && m.latest_image.length > 0;
    const imgSrc = hasImage ? `${CONFIG.serverUrl}/api/images/${encodeURIComponent(m.latest_image)}?t=${Date.now()}` : `data:image/svg+xml,${encodeURIComponent(generateMeterSVG(m))}`;
    return `
    <div class="camera-card">
      <div style="position:relative">
        <img class="camera-img" src="${imgSrc}" alt="Công tơ ${m.id}" />
        <div style="position:absolute;top:8px;left:8px;background:rgba(0,0,0,0.7);border-radius:4px;padding:2px 6px;font-size:10px;color:white;font-family:monospace">
          ESP32-CAM · ${m.id}
        </div>
        <div style="position:absolute;bottom:8px;right:8px;background:rgba(16,185,129,0.8);border-radius:4px;padding:2px 6px;font-size:10px;color:white">
          OCR ${Math.round((m.ocr_confidence||0.9)*100)}%
        </div>
      </div>
      <div class="camera-info">
        <div class="camera-meter">${m.name}</div>
        <div class="camera-reading">${formatNumber(m.latest_reading)} kWh</div>
        <div class="camera-time">📷 ${formatTime(m.last_reading_time)}</div>
      </div>
    </div>`;
  }).join('');
}

function generateMeterSVG(m) {
  // Tạo SVG mô phỏng hình ảnh công tơ điện
  const reading = (m.latest_reading || 1000).toFixed(1);
  return `<svg xmlns='http://www.w3.org/2000/svg' width='320' height='240' viewBox='0 0 320 240'>
    <rect width='320' height='240' fill='%23111827'/>
    <rect x='20' y='20' width='280' height='200' rx='8' fill='%231e293b' stroke='%23334155' stroke-width='1.5'/>
    <text x='160' y='50' text-anchor='middle' fill='%2364748b' font-size='11' font-family='monospace'>CÔNG TƠ ĐIỆN 1 PHA</text>
    <rect x='60' y='70' width='200' height='60' rx='4' fill='%230f172a' stroke='%2310b981' stroke-width='1'/>
    <text x='160' y='112' text-anchor='middle' fill='%2310b981' font-size='28' font-family='monospace' font-weight='bold'>${reading}</text>
    <text x='160' y='128' text-anchor='middle' fill='%2364748b' font-size='9' font-family='monospace'>kWh</text>
    <circle cx='160' cy='175' r='30' fill='none' stroke='%23334155' stroke-width='2'/>
    <circle cx='160' cy='175' r='25' fill='none' stroke='%231e293b' stroke-width='1'/>
    <line x1='160' y1='175' x2='175' y2='158' stroke='%23ef4444' stroke-width='2' stroke-linecap='round'/>
    <circle cx='160' cy='175' r='3' fill='%23475569'/>
    <text x='160' y='220' text-anchor='middle' fill='%23475569' font-size='9' font-family='monospace'>${m.id} · Chụp lúc ${new Date().toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})}</text>
  </svg>`;
}

// ============================================================
// MAP (Leaflet)
// ============================================================
let leafletMap;

function initMap() {
  leafletMap = L.map('leaflet-map', {
    center: [10.7769, 106.7009],
    zoom: 15,
    zoomControl: true,
  });

  // Dark tile layer
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap, © CARTO',
    subdomains: 'abcd',
    maxZoom: 20
  }).addTo(leafletMap);

  // Markers
  const severityColor = { active: '#10b981', warning: '#f59e0b', offline: '#94a3b8', danger: '#ef4444' };

  DEMO_DATA.meters.forEach(m => {
    const color = severityColor[m.status] || '#60a5fa';
    const icon = L.divIcon({
      html: `<div style="
        width:32px;height:32px;border-radius:50%;
        background:${color};
        border:3px solid white;
        display:flex;align-items:center;justify-content:center;
        font-size:14px;
        box-shadow:0 4px 12px rgba(0,0,0,0.5);
      ">⚡</div>`,
      className: '',
      iconSize:   [32, 32],
      iconAnchor: [16, 16],
    });

    L.marker([m.lat, m.lng], { icon })
      .addTo(leafletMap)
      .bindPopup(`
        <div style="min-width:200px;font-family:Inter,sans-serif">
          <div style="font-weight:700;font-size:14px;margin-bottom:8px">${m.name}</div>
          <div style="color:#94a3b8;font-size:12px;margin-bottom:4px">📍 ${m.address}</div>
          <div style="color:#94a3b8;font-size:12px;margin-bottom:4px">👤 ${m.customer}</div>
          <hr style="border-color:rgba(255,255,255,0.1);margin:8px 0" />
          <div style="font-family:monospace;font-size:20px;font-weight:800;color:#10b981">${formatNumber(m.latest_reading)} kWh</div>
          <div style="font-size:11px;color:#94a3b8;margin-top:2px">Cập nhật: ${formatTime(m.last_reading_time)}</div>
        </div>
      `);
  });
}

// ============================================================
// CHARTS
// ============================================================
let charts = {};

function destroyChart(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

const CHART_DEFAULTS = {
  plugins: {
    legend: { labels: { color: '#94a3b8', font: { family: 'Inter' } } },
    tooltip: {
      backgroundColor: '#111827',
      titleColor: '#f1f5f9',
      bodyColor: '#94a3b8',
      borderColor: 'rgba(255,255,255,0.1)',
      borderWidth: 1,
    }
  },
  scales: {
    x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#64748b' } },
    y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#64748b' } },
  }
};

// Biểu đồ Tổng Quan (Overview)
function initOverviewChart() {
  destroyChart('overview');
  const labels = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    labels.push(d.toLocaleDateString('vi-VN', { month: 'short', day: 'numeric' }));
  }

  const datasets = DEMO_DATA.meters.slice(0, 3).map((m, i) => {
    const colors = ['#3b82f6', '#10b981', '#f59e0b'];
    const data = Array.from({length: 7}, (_, j) => +(Math.random() * 8 + 3 + j * 0.5).toFixed(1));
    return {
      label: m.name,
      data, backgroundColor: colors[i] + '33', borderColor: colors[i],
      borderWidth: 2, fill: true, tension: 0.4, pointRadius: 3,
      pointBackgroundColor: colors[i],
    };
  });

  const ctx = document.getElementById('chart-overview').getContext('2d');
  charts['overview'] = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: { ...CHART_DEFAULTS, responsive: true, maintainAspectRatio: true, interaction: { mode: 'index' } }
  });
}

function updateOverviewChart(period) {
  // Cập nhật chu kỳ - demo đơn giản
  initOverviewChart();
}

// Donut chart
function initDonutChart() {
  destroyChart('donut');
  const ctx = document.getElementById('chart-donut').getContext('2d');
  charts['donut'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: DEMO_DATA.meters.map(m => m.name),
      datasets: [{
        data: [237.3, 146.5, 389.0, 79.8, 278.1],
        backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'],
        borderColor: '#111827',
        borderWidth: 3,
        hoverOffset: 8,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: {
        legend: { position: 'right', labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 }, boxWidth: 14, padding: 12 } },
        tooltip: CHART_DEFAULTS.plugins.tooltip,
      },
      cutout: '65%',
    }
  });
}

// Hourly chart
function updateHourlyChart() {
  destroyChart('hourly');
  const labels = Array.from({length: 24}, (_, i) => `${i}:00`);
  const data   = Array.from({length: 24}, (_, i) => {
    const isNight = i < 6 || i >= 22;
    return +(Math.random() * (isNight ? 0.8 : 2.5) + 0.2).toFixed(2);
  });

  const ctx = document.getElementById('chart-hourly').getContext('2d');
  charts['hourly'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'kWh/giờ',
        data,
        backgroundColor: data.map((v, i) => {
          const isNight = i < 6 || i >= 22;
          return isNight ? 'rgba(139,92,246,0.5)' : 'rgba(59,130,246,0.5)';
        }),
        borderColor: data.map((v, i) => (i < 6 || i >= 22) ? '#8b5cf6' : '#3b82f6'),
        borderWidth: 1, borderRadius: 4,
      }]
    },
    options: { ...CHART_DEFAULTS, responsive: true, maintainAspectRatio: true }
  });
}

// Monthly comparison chart
function updateMonthlyChart() {
  destroyChart('monthly');
  const months = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const ctx = document.getElementById('chart-monthly').getContext('2d');
  charts['monthly'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months,
      datasets: [
        {
          label: 'Năm nay (kWh)',
          data: [1250, 1380, 1210, 1490, 1320, 1187],
          backgroundColor: 'rgba(59,130,246,0.6)',
          borderColor: '#3b82f6', borderWidth: 1, borderRadius: 4,
        },
        {
          label: 'Năm ngoái (kWh)',
          data: [1100, 1250, 1180, 1350, 1200, 1050],
          backgroundColor: 'rgba(139,92,246,0.4)',
          borderColor: '#8b5cf6', borderWidth: 1, borderRadius: 4,
        }
      ]
    },
    options: { ...CHART_DEFAULTS, responsive: true, maintainAspectRatio: true }
  });
}

// Timeline chart (30 ngày)
function updateTimelineChart() {
  destroyChart('timeline');
  const labels = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    labels.push(d.toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric' }));
  }

  const datasets = DEMO_DATA.meters.map((m, i) => {
    const colors = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#06b6d4'];
    let val = m.latest_reading - 30 * 5;
    const data = Array.from({length: 30}, () => {
      val += Math.random() * 5 + 2;
      return +val.toFixed(1);
    });
    return { label: m.id, data, borderColor: colors[i], backgroundColor: 'transparent',
             borderWidth: 1.5, tension: 0.4, pointRadius: 0 };
  });

  const ctx = document.getElementById('chart-timeline').getContext('2d');
  charts['timeline'] = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: { ...CHART_DEFAULTS, responsive: true, maintainAspectRatio: true, interaction: { mode: 'index' } }
  });
}

// ============================================================
// METER MODAL
// ============================================================
function openMeterModal(meterId) {
  const m = allMeters.find(x => x.id === meterId);
  if (!m) return;

  document.getElementById('modal-title').textContent = `${m.name} – ${m.id}`;

  // Tạo mini chart data
  const miniLabels = Array.from({length: 12}, (_, i) => {
    const d = new Date(); d.setHours(d.getHours() - (11 - i) * 2);
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  });
  const miniData = Array.from({length: 12}, (_, i) => +(m.latest_reading - 50 + i*4.2 + Math.random()*2).toFixed(1));

  document.getElementById('modal-body').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
      <div>
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">Chỉ số hiện tại</div>
        <div style="font-family:var(--font-mono);font-size:28px;font-weight:800;color:#60a5fa">${formatNumber(m.latest_reading)} kWh</div>
      </div>
      <div>
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">Trạng thái</div>
        <div style="margin-top:4px">${statusBadge(m.status)}</div>
      </div>
      <div><div style="font-size:11px;color:var(--text-muted);margin-bottom:2px">Khách hàng</div><div style="font-size:13px">${m.customer||'—'}</div></div>
      <div><div style="font-size:11px;color:var(--text-muted);margin-bottom:2px">SĐT</div><div style="font-size:13px">${m.phone||'—'}</div></div>
      <div><div style="font-size:11px;color:var(--text-muted);margin-bottom:2px">Địa chỉ</div><div style="font-size:13px">${m.address||'—'}</div></div>
      <div><div style="font-size:11px;color:var(--text-muted);margin-bottom:2px">Độ tin cậy OCR</div>
        <div style="font-size:13px;color:${confColor(m.ocr_confidence||0)}">${Math.round((m.ocr_confidence||0)*100)}%</div>
      </div>
      <div><div style="font-size:11px;color:var(--text-muted);margin-bottom:2px">WiFi RSSI</div><div style="font-family:monospace;font-size:13px">${m.rssi||'—'} dBm</div></div>
      <div><div style="font-size:11px;color:var(--text-muted);margin-bottom:2px">Lần đọc cuối</div><div style="font-size:13px">${formatTime(m.last_reading_time)}</div></div>
    </div>
    <div style="margin-bottom:8px;font-size:12px;font-weight:600;color:var(--text-secondary)">Chỉ số 24h qua</div>
    <div class="mini-chart-wrap">
      <canvas id="modal-chart" height="100"></canvas>
    </div>`;

  document.getElementById('modal-overlay').classList.add('open');

  // Vẽ mini chart
  setTimeout(() => {
    const ctx = document.getElementById('modal-chart').getContext('2d');
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: miniLabels,
        datasets: [{
          label: 'kWh',
          data: miniData,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59,130,246,0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointBackgroundColor: '#3b82f6',
        }]
      },
      options: { ...CHART_DEFAULTS, responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false }, tooltip: CHART_DEFAULTS.plugins.tooltip } }
    });
  }, 100);

  lucide.createIcons();
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}

// ============================================================
// BILLING
// ============================================================
const EVN_TIERS = [
  { limit: 50,  price: 1806 },
  { limit: 100, price: 1866 },
  { limit: 200, price: 2167 },
  { limit: 300, price: 2729 },
  { limit: 400, price: 3050 },
  { limit: Infinity, price: 3151 },
];

function populateMeterSelects(meters) {
  const selects = ['billing-meter', 'chart-meter-select', 'live-meter-select', 'upload-meter-select'];
  selects.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const firstOption = sel.options[0];
    sel.innerHTML = '';
    if (firstOption) sel.appendChild(firstOption);
    meters.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id; opt.textContent = `${m.id} – ${m.name}`;
      sel.appendChild(opt);
    });
  });
}


async function uploadImage() {
  const meterId = document.getElementById('upload-meter-select')?.value;
  const fileInput = document.getElementById('upload-file-input');
  const file = fileInput?.files?.[0];

  if (!meterId) {
    showToast('Vui lòng chọn công tơ để upload ảnh.', 'error');
    return;
  }
  if (!file) {
    showToast('Vui lòng chọn tệp ảnh trước khi upload.', 'error');
    return;
  }
  
  const btn = document.getElementById('btn-upload-image');
  btn.disabled = true;
  btn.textContent = 'Đang upload...';

  try {
    const res = await fetch(`${CONFIG.serverUrl}/api/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': file.type || 'image/jpeg',
        'X-Meter-ID': meterId,
        'X-Device-Token': 'dashboard',
        'X-RSSI': '0'
      },
      body: file
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const message = data?.error || `Upload thất bại (${res.status})`;
      showToast(message, 'error');
      return;
    }

    const uploadResult = document.getElementById('upload-result');
    uploadResult.style.display = 'block';
    uploadResult.innerHTML = `
      <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start;">
        <div style="flex:1;min-width:220px">
          <div><strong>Upload thành công cho</strong> ${meterId}</div>
          <div><strong>OCR:</strong> ${data.ocr_success ? '<span style="color:#4ade80">OK</span>' : '<span style="color:#f87171">Fail</span>'}</div>
          <div><strong>Chỉ số:</strong> ${data.reading_value != null ? `${data.reading_value} kWh` : 'Không có'}</div>
          <div><strong>Độ tin cậy:</strong> ${data.confidence != null ? `${Math.round(data.confidence * 100)}%` : 'Không có'}</div>
          <div><strong>OCR text:</strong> ${data.raw_text ? `<code>${data.raw_text}</code>` : '—'}</div>
          <div style="margin-top:6px;font-size:12px;color:#94a3b8">Ảnh lưu: ${data.image_saved || 'Không có'}</div>
        </div>
        <div style="width:180px;min-width:180px;max-width:180px;border:1px solid rgba(148,163,184,0.25);border-radius:10px;overflow:hidden;background:#020617">
          <div style="padding:8px;font-size:12px;color:#94a3b8;text-align:center;">Ảnh đã xử lý</div>
          <img src="${CONFIG.serverUrl}/api/images/${encodeURIComponent(data.image_saved)}?t=${Date.now()}" alt="Upload result" style="width:100%;display:block;" />
        </div>
      </div>
    `;
    showToast(`Upload thành công cho ${meterId}. OCR: ${data.ocr_success ? 'OK' : 'Fail'}`, 'success');
    fileInput.value = '';
    await loadMeters();
    renderCameraGallery(allMeters);
  } catch (error) {
    showToast(`Lỗi upload: ${error.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Upload ảnh';
  }
}

function calculateBill() {
  const meterId = document.getElementById('billing-meter').value;
  const tier    = document.getElementById('billing-tier').value;
  const from    = document.getElementById('billing-from').value;
  const to      = document.getElementById('billing-to').value;

  if (!meterId) { showToast('Vui lòng chọn công tơ!', 'error'); return; }
  if (!from || !to) { showToast('Vui lòng chọn kỳ tính!', 'error'); return; }

  const meter = allMeters.find(m => m.id === meterId);
  // Mô phỏng: tính dựa trên số ngày
  const days = Math.max(1, (new Date(to) - new Date(from)) / 86400000);
  const kwh  = +(days * (Math.random() * 8 + 10)).toFixed(1);
  const vat  = 0.1;

  let cost = 0, detail = [];
  if (tier === 'flat') {
    cost = kwh * 2006;
    detail = [{ label: `${kwh} kWh × 2.006 đ/kWh`, amount: cost }];
  } else {
    let remaining = kwh, prevLimit = 0;
    for (const t of EVN_TIERS) {
      if (remaining <= 0) break;
      const inTier = Math.min(remaining, t.limit - prevLimit);
      const subtotal = inTier * t.price;
      cost += subtotal;
      detail.push({ label: `${inTier.toFixed(1)} kWh × ${t.price.toLocaleString()} đ/kWh`, amount: subtotal });
      remaining -= inTier; prevLimit = t.limit;
    }
  }

  const vatAmount   = cost * vat;
  const totalAmount = cost + vatAmount;

  const resultEl = document.getElementById('billing-result');
  resultEl.style.display = 'block';
  document.getElementById('billing-result-body').innerHTML = `
    <div style="margin-bottom:12px">
      <div style="font-size:12px;color:var(--text-muted)">${meter?.name} – ${meterId}</div>
      <div style="font-size:12px;color:var(--text-muted)">Kỳ: ${from} → ${to} (${days.toFixed(0)} ngày)</div>
      <div style="font-size:24px;font-weight:800;color:#10b981;margin-top:8px">${kwh} kWh</div>
    </div>
    <div>
      ${detail.map(d => `
        <div class="bill-line">
          <span style="color:var(--text-secondary)">${d.label}</span>
          <span class="mono">${Math.round(d.amount).toLocaleString()} đ</span>
        </div>`).join('')}
      <div class="bill-line">
        <span style="color:var(--text-secondary)">VAT (10%)</span>
        <span class="mono">${Math.round(vatAmount).toLocaleString()} đ</span>
      </div>
      <div class="bill-total">
        <span>TỔNG CỘNG</span>
        <span>${Math.round(totalAmount).toLocaleString()} VNĐ</span>
      </div>
    </div>`;

  showToast(`Tính tiền thành công: ${Math.round(totalAmount).toLocaleString()} VNĐ`, 'success');
}

// ============================================================
// SETTINGS
// ============================================================
function saveSettings() {
  CONFIG.serverUrl = document.getElementById('cfg-server').value;
  CONFIG.refreshInterval = parseInt(document.getElementById('cfg-interval').value) * 1000;
  localStorage.setItem('cfg_server', CONFIG.serverUrl);
  localStorage.setItem('cfg_interval', document.getElementById('cfg-interval').value);
  showToast('Đã lưu cài đặt!', 'success');
}

function syncServerUrlField() {
  const cfgInput = document.getElementById('cfg-server');
  if (cfgInput && !localStorage.getItem('cfg_server')) {
    cfgInput.value = window.location.origin;
    CONFIG.serverUrl = window.location.origin;
  }
}

// ============================================================
// REFRESH
// ============================================================
async function refreshData() {
  const btn = document.getElementById('btn-refresh');
  btn.classList.add('spinning');
  await Promise.all([loadStats(), loadMeters(), loadAlerts()]);
  renderCameraGallery(allMeters);
  btn.classList.remove('spinning');
  showToast('Đã làm mới dữ liệu!', 'success');
}

// ============================================================
// INIT
// ============================================================
async function init() {
  // Khởi tạo icons
  lucide.createIcons();

  // Sync server URL field to the page origin when no custom config exists
  syncServerUrlField();

  // Load dữ liệu
  await loadStats();
  const meters = await loadMeters();
  await loadAlerts();
  renderCameraGallery(meters);

  const uploadBtn = document.getElementById('btn-upload-image');
  if (uploadBtn) uploadBtn.addEventListener('click', event => { event.preventDefault(); uploadImage(); });

  // Khởi tạo charts trang overview
  initOverviewChart();
  initDonutChart();

  // Auto-refresh
  setInterval(async () => {
    await loadStats();
    await loadMeters();
    await loadAlerts();
    lucide.createIcons();
  }, CONFIG.refreshInterval);
}

// Bắt đầu khi DOM sẵn sàng
document.addEventListener('DOMContentLoaded', init);
