/**
 * GeniusBI Main Controller
 * Professional Edition - 2026
 */

// Global State
window.AppData = null;
window.LogData = []; 
window.mainChart = null; 
let progressChart = null; 

// Automatically determine the API base URL based on environment
const API_BASE = `${window.location.protocol}//${window.location.hostname}:5000`;

const CHART_PALETTES = {
    default:   ['#4e73df', '#2e59d9', 'rgba(78, 115, 223, 0.2)'],
    emerald:   ['#10b981', '#059669', 'rgba(16, 185, 129, 0.2)'],
    sunset:    ['#f59e0b', '#d97706', 'rgba(245, 158, 11, 0.2)'],
    royal:     ['#8b5cf6', '#7c3aed', 'rgba(139, 92, 246, 0.2)'],
    crimson:   ['#ef4444', '#dc2626', 'rgba(239, 68, 68, 0.2)'],
    slate:     ['#64748b', '#475569', 'rgba(100, 116, 139, 0.2)'],
    gold:      ['#fbbf24', '#f59e0b', 'rgba(251, 191, 36, 0.2)'],
    ocean:     ['#0ea5e9', '#0284c7', 'rgba(14, 165, 233, 0.2)'],
    mint:      ['#2dd4bf', '#0d9488', 'rgba(45, 212, 191, 0.2)'],
    rose:      ['#f43f5e', '#e11d48', 'rgba(244, 63, 94, 0.2)']
};

document.addEventListener('DOMContentLoaded', () => {
    initTheme(); 
    loadHistory();
    initListeners(); 
    setupDragAndDrop();
});

// ==========================================
// CORE UI & NAVIGATION
// ==========================================

function initTheme() {
    const themeSelect = document.getElementById('themeSelect');
    const savedTheme = localStorage.getItem('genius_bi_theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    if(themeSelect) themeSelect.value = savedTheme;

    if (themeSelect) {
        themeSelect.addEventListener('change', (e) => {
            const newTheme = e.target.value;
            document.body.setAttribute('data-theme', newTheme);
            localStorage.setItem('genius_bi_theme', newTheme);
            if (typeof refreshBICharts === 'function') refreshBICharts(); 
        });
    }
}

function initListeners() {
    const uploadBtn = document.getElementById('uploadBtn');
    if (uploadBtn) uploadBtn.addEventListener('click', handleUpload);

    const filePicker = document.getElementById('filePicker');
    if (filePicker) {
        filePicker.addEventListener('change', (e) => updateFileLabel(e.target.files[0]));
    }

    // Bind change events for Chart and Pivot controls
    ['chartTypeSelect', 'chartColorSelect', 'pivot-row-select', 'pivot-val-select', 'pivot-agg'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', () => {
            if (id.startsWith('pivot')) generatePivot();
            else if (typeof refreshBICharts === 'function') refreshBICharts();
        });
    });

    const radiusInput = document.getElementById('setting-radius');
    if (radiusInput) {
        radiusInput.addEventListener('input', (e) => {
            const radius = e.target.value + 'px';
            document.documentElement.style.setProperty('--border-radius', radius);
            if(document.getElementById('radius-val')) document.getElementById('radius-val').innerText = radius;
        });
    }
}

function switchView(viewId, element = null) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    const targetView = document.getElementById(viewId);
    if (targetView) targetView.classList.remove('hidden');

    document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
    if (element) {
        element.classList.add('active');
        const navTitle = document.getElementById('view-title');
        if (navTitle) navTitle.innerText = element.innerText.replace(/[📥📊🧮⚙️📜]/g, '').trim();
    }
    
    if (viewId === 'logs') fetchDatabaseLogs();
}

// ==========================================
// FILE ANALYSIS & DB SYNC
// ==========================================

async function handleUpload() {
    const fileInput = document.getElementById('filePicker');
    if (!fileInput || !fileInput.files[0]) return alert("Please select a file.");
    await processAndAnalyzeFile(fileInput.files[0]);
}

async function processAndAnalyzeFile(file) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.remove('hidden');

    const formData = new FormData();
    formData.append('file', file);

    try {
        const res = await fetch(`${API_BASE}/analyze`, { method: 'POST', body: formData });
        const result = await res.json();

        if (result.status === "success") {
            window.AppData = result; 
            const dashboardTab = document.querySelector('li[onclick*="dashboard"]');
            switchView('dashboard', dashboardTab);

            setTimeout(() => {
                if (overlay) overlay.classList.add('hidden');
                updateKPICards(result);
                renderAIInsights(result.insights);
                if (typeof createProfessionalCharts === 'function') createProfessionalCharts(result);
                renderProgressChart(result.data);
                initPivotWorkspace(result.schema);
                saveToHistory(file.name);
            }, 600); 
        }
    } catch (err) {
        if (overlay) overlay.classList.add('hidden');
        alert("Server connection failed. Ensure Flask is running at " + API_BASE);
    }
}

async function pushDataToMySQL() {
    if (!window.AppData) return alert("No data to sync. Please upload a file first.");
    const btn = document.querySelector('.btn-sync');
    const originalText = btn.innerHTML;
    btn.innerText = "⏳ Syncing...";
    try {
        const res = await fetch(`${API_BASE}/push-to-db`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(window.AppData)
        });
        const r = await res.json();
        alert(r.message);
    } catch (err) {
        alert("Database sync failed. Check your Python console.");
    } finally { btn.innerHTML = originalText; }
}

// ==========================================
// LOGS & DELETION
// ==========================================

async function fetchDatabaseLogs() {
    const container = document.getElementById('logs-table-container');
    if(!container) return;
    
    try {
        const res = await fetch(`${API_BASE}/get-db-logs`);
        const r = await res.json();
        if (r.status === "success" && r.data.length > 0) {
            const cols = Object.keys(r.data[0]);
            container.innerHTML = `
                <table class="log-table">
                    <thead>
                        <tr>
                            ${cols.map(c => `<th>${c.replace(/_/g, ' ')}</th>`).join('')}
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${r.data.map(row => `
                            <tr id="row-${row.id}">
                                ${cols.map(c => `<td>${row[c] || '-'}</td>`).join('')}
                                <td>
                                    <button class="btn-delete" title="Delete record" onclick="deleteLog(${row.id})">🗑️</button>
                                </td>
                            </tr>`).join('')}
                    </tbody>
                </table>`;
        } else {
            container.innerHTML = "<p style='text-align:center; padding:40px; opacity:0.6;'>Registry is currently empty. Upload files to see history.</p>";
        }
    } catch (e) { container.innerHTML = "<p style='color:red;'>Failed to load database logs.</p>"; }
}

async function deleteLog(logId) {
    if (!logId) return;
    if (!confirm('Permanently delete this record and its database table?')) return;
    
    try {
        const res = await fetch(`${API_BASE}/delete-log/${logId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        });
        const result = await res.json();
        
        if (result.status === "success") {
            const row = document.getElementById(`row-${logId}`);
            if (row) {
                row.style.opacity = '0';
                row.style.transform = 'scale(0.9)';
                row.style.transition = 'all 0.3s ease';
                setTimeout(() => {
                    row.remove();
                    fetchDatabaseLogs();
                }, 300);
            }
        } else {
            alert("Delete failed: " + result.message);
        }
    } catch (e) {
        alert(`Could not connect to server. Ensure Flask is running.`);
    }
}

// ==========================================
// PDF & EXPORT ENGINE
// ==========================================

async function downloadDashboardPDF() {
    // 1. Safety Check: Ensure libraries are loaded
    if (typeof window.jspdf === 'undefined' || typeof html2canvas === 'undefined') {
        alert("Error: PDF libraries (jsPDF or html2canvas) are not loaded. Please check your internet connection or HTML imports.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const dashboardElement = document.getElementById('dashboard'); 
    
    // Logic to find the button regardless of how it was clicked
    const btn = event.target.closest('button') || document.querySelector('button[onclick*="downloadDashboardPDF"]');
    
    if (!dashboardElement) return alert("Dashboard content not found.");

    const originalText = btn ? btn.innerHTML : "Export PDF";
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = "⌛ Rendering...";
    }

    try {
        // 2. Capture the element
        const canvas = await html2canvas(dashboardElement, {
            scale: 2, // High quality
            useCORS: true,
            logging: false,
            backgroundColor: "#0f172a" // Force background color so it's not transparent
        });

        const imgData = canvas.toDataURL('image/png');
        
        // 3. Create PDF (Landscape 'l', millimeters 'mm', A4 size)
        const pdf = new jsPDF('l', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

        // 4. Add Image and Save
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`GeniusBI_Report_${new Date().toISOString().slice(0,10)}.pdf`);

    } catch (error) {
        console.error("PDF Export Error:", error);
        alert("Failed to generate PDF. Check console for details.");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
}

// ==========================================
// ANALYTICS & PIVOT GENERATION
// ==========================================

function updateKPICards(result) {
    const rowEl = document.getElementById('stat-rows');
    const colEl = document.getElementById('stat-cols');
    if(rowEl) rowEl.innerText = (result.full_count || result.data.length).toLocaleString();
    if(colEl) colEl.innerText = (result.schema.dimensions.length + result.schema.measures.length);
}

function renderAIInsights(insights) {
    const list = document.getElementById('ai-insights-list');
    if (list && insights) {
        list.innerHTML = insights.map(i => `<li style="margin-bottom:10px;"><span style="color:var(--accent); font-weight:bold;">✦</span> ${i}</li>`).join('');
    }
}

function renderProgressChart(data) {
    const ctx = document.getElementById('progressChart');
    if (!ctx) return;
    if (progressChart) progressChart.destroy();
    
    const sampleData = data.slice(-10);
    progressChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sampleData.map((_, i) => i),
            datasets: [{ 
                data: sampleData.map(d => Object.values(d).find(val => typeof val === 'number') || 0), 
                borderColor: '#10b981', 
                borderWidth: 2,
                pointRadius: 0,
                fill: true, 
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.4 
            }]
        },
        options: { 
            plugins: { legend: { display: false } }, 
            scales: { x: { display: false }, y: { display: false } }, 
            maintainAspectRatio: false,
            responsive: true
        }
    });
}

function initPivotWorkspace(schema) {
    const rowSel = document.getElementById('pivot-row-select');
    const valSel = document.getElementById('pivot-val-select');
    if (rowSel && valSel) {
        rowSel.innerHTML = schema.dimensions.map(d => `<option value="${d}">${d}</option>`).join('');
        valSel.innerHTML = schema.measures.map(m => `<option value="${m}">${m}</option>`).join('');
        generatePivot();
    }
}

function generatePivot() {
    if (!window.AppData || !window.AppData.data) return;
    const rowDim = document.getElementById('pivot-row-select').value;
    const valMeas = document.getElementById('pivot-val-select').value;
    const aggType = document.getElementById('pivot-agg').value;
    const output = document.getElementById('pivot-table-output');

    const groups = {};
    window.AppData.data.forEach(row => {
        const key = row[rowDim] || "Unknown";
        const val = parseFloat(row[valMeas]) || 0;
        if (!groups[key]) groups[key] = [];
        groups[key].push(val);
    });

    const results = Object.keys(groups).map(key => {
        const vals = groups[key];
        let res = 0;
        if (aggType === 'sum') res = vals.reduce((a, b) => a + b, 0);
        else if (aggType === 'mean') res = vals.reduce((a, b) => a + b, 0) / vals.length;
        else if (aggType === 'count') res = vals.length;
        else if (aggType === 'min') res = Math.min(...vals);
        else if (aggType === 'max') res = Math.max(...vals);
        return { key, val: res };
    });

    let tableHtml = `
        <table class="pro-table" id="pivot-data-table">
            <thead>
                <tr>
                    <th>${rowDim.toUpperCase()}</th>
                    <th style="text-align:right;">${aggType.toUpperCase()} of ${valMeas}</th>
                </tr>
            </thead>
            <tbody>
                ${results.map(r => `
                    <tr>
                        <td><strong>${r.key}</strong></td>
                        <td style="text-align:right; color:var(--accent); font-family:'JetBrains Mono';">
                            ${r.val.toLocaleString(undefined, {minimumFractionDigits: 2})}
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>`;
    if (output) output.innerHTML = tableHtml;
}

// ==========================================
// HELPERS
// ==========================================

function updateFileLabel(file) {
    if (file) {
        const label = document.getElementById('fileLabel');
        const display = document.getElementById('fileNameDisplay');
        if(label) label.innerText = "Target Selected:";
        if(display) display.innerText = file.name;
    }
}

function setupDragAndDrop() {
    const dz = document.getElementById('dropZone');
    if(!dz) return;
    dz.addEventListener('dragover', (e) => { 
        e.preventDefault(); 
        dz.style.background = "rgba(37, 99, 235, 0.05)";
        dz.style.borderColor = "var(--accent)"; 
    });
    dz.addEventListener('dragleave', () => {
        dz.style.background = "transparent";
        dz.style.borderColor = "var(--border)";
    });
    dz.addEventListener('drop', (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        const fileInput = document.getElementById('filePicker');
        if(fileInput) {
            fileInput.files = e.dataTransfer.files;
            updateFileLabel(file);
            processAndAnalyzeFile(file);
        }
    });
}

function saveToHistory(name) {
    let h = JSON.parse(localStorage.getItem('genius_bi_history')) || [];
    h = [{name, time: new Date().toLocaleTimeString()}, ...h.filter(x => x.name !== name)].slice(0, 5);
    localStorage.setItem('genius_bi_history', JSON.stringify(h));
    loadHistory();
}

function loadHistory() {
    const list = document.getElementById('history-list');
    if(!list) return;
    const h = JSON.parse(localStorage.getItem('genius_bi_history')) || [];
    list.innerHTML = h.map(i => `
        <li class="history-item">
            <span>📄 ${i.name}</span>
            <small>${i.time}</small>
        </li>`).join('');
}