/**
 * GeniusBI Advanced Dynamic Chart & Pivot Engine
 * Handles: Multi-Format Charts, Professional Palettes, and Smart Gradients
 */

// Global state for memory and persistence
let globalChartData = null;
let biChartInstance = null;

// Professional Executive Color Palettes (Aligned with main.js)
const ColorThemes = {
    default: { border: '#2563eb', bg: 'rgba(37, 99, 235, 0.1)', multi: ['#1d4ed8', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'] },
    emerald: { border: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', multi: ['#047857', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0'] },
    sunset:  { border: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', multi: ['#b45309', '#f59e0b', '#fbbf24', '#fcd34d', '#fef3c7'] },
    royal:   { border: '#7c3aed', bg: 'rgba(124, 58, 237, 0.1)', multi: ['#5b21b6', '#7c3aed', '#a78bfa', '#c4b5fd', '#ddd6fe'] },
    crimson: { border: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', multi: ['#b91c1c', '#ef4444', '#f87171', '#fca5a5', '#fee2e2'] },
    slate:   { border: '#64748b', bg: 'rgba(100, 116, 139, 0.1)', multi: ['#1e293b', '#475569', '#94a3b8', '#cbd5e1', '#f1f5f9'] },
    gold:    { border: '#fbbf24', bg: 'rgba(251, 191, 36, 0.1)', multi: ['#92400e', '#d97706', '#fbbf24', '#fde68a', '#fffbeb'] },
    ocean:   { border: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.1)', multi: ['#0369a1', '#0ea5e9', '#7dd3fc', '#bae6fd', '#f0f9ff'] },
    mint:    { border: '#2dd4bf', bg: 'rgba(45, 212, 191, 0.1)', multi: ['#0f766e', '#2dd4bf', '#99f6e4', '#ccfbf1', '#f0fdfa'] },
    rose:    { border: '#f43f5e', bg: 'rgba(244, 63, 94, 0.1)', multi: ['#9f1239', '#f43f5e', '#fb7185', '#fecdd3', '#fff1f2'] }
};

/**
 * 1. Chart Entry Point
 */
function createProfessionalCharts(result) {
    if (!result || !result.data) return;
    
    console.log("📊 Chart Engine Syncing...");
    globalChartData = result; 
    
    // Auto-populate selectors for Pivot/Dashboard axis
    populatePivotSelectors(result.schema);
    
    // Refresh the visuals
    refreshBICharts();
}

/**
 * 2. Update Chart Style & Logic (Core Engine)
 */
function refreshBICharts() {
    if (!globalChartData || !globalChartData.data) return;

    const canvas = document.getElementById('mainAnalyticsChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // UI Inputs
    const rawType = document.getElementById('chartTypeSelect')?.value || 'bar';
    const themeKey = document.getElementById('chartColorSelect')?.value || 'default';
    const cornerRadius = parseInt(document.getElementById('setting-radius')?.value || "12");
    
    // Data Inputs (X and Y Axis)
    const dimAttr = document.getElementById('xAxisInput')?.value || globalChartData.schema.dimensions[0];
    const measAttr = document.getElementById('yAxisInput')?.value || globalChartData.schema.measures[0];

    const theme = ColorThemes[themeKey] || ColorThemes.default;

    if (biChartInstance) biChartInstance.destroy();

    // Chart Type Normalization
    let chartType = rawType;
    if (chartType === 'column') chartType = 'bar';
    if (chartType === 'area') chartType = 'line';
    if (chartType === 'donut') chartType = 'doughnut';

    // Slice data for performance (First 15 records)
    const labels = globalChartData.data.slice(0, 15).map(row => row[dimAttr]);
    const values = globalChartData.data.slice(0, 15).map(row => row[measAttr]);

    const isCircular = ['pie', 'doughnut', 'polarArea'].includes(chartType);
    
    // Create Professional Gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, theme.border);
    gradient.addColorStop(1, theme.bg);

    biChartInstance = new Chart(ctx, {
        type: chartType,
        data: {
            labels: labels,
            datasets: [{
                label: measAttr.replace(/_/g, ' '),
                data: values,
                backgroundColor: isCircular ? theme.multi : gradient,
                borderColor: theme.border,
                borderWidth: (chartType === 'line') ? 4 : 2,
                borderRadius: (chartType === 'bar') ? cornerRadius : 0, 
                fill: (rawType === 'area' || chartType === 'line'), 
                tension: 0.4, // Professional smooth curves
                pointRadius: (chartType === 'line') ? 5 : 0,
                pointBackgroundColor: theme.border
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { 
                    display: isCircular, 
                    position: 'bottom',
                    labels: { font: { family: 'Inter', size: 12 } } 
                },
                tooltip: {
                    backgroundColor: '#1e293b',
                    titleFont: { size: 14, weight: 'bold' },
                    padding: 12,
                    cornerRadius: 8
                }
            },
            scales: isCircular ? {} : {
                x: { grid: { display: false } },
                y: { 
                    beginAtZero: true, 
                    grid: { color: 'rgba(0,0,0,0.05)' },
                    ticks: { callback: (v) => v.toLocaleString() } 
                }
            }
        }
    });
}

/**
 * 3. Pivot Engine Functionalitiy
 */
function populatePivotSelectors(schema) {
    const xSel = document.getElementById('xAxisInput');
    const ySel = document.getElementById('yAxisInput');
    
    if (xSel && ySel) {
        // Clear existing
        xSel.innerHTML = ""; ySel.innerHTML = "";
        
        schema.dimensions.forEach(d => {
            xSel.options.add(new Option(d, d));
        });
        schema.measures.forEach(m => {
            ySel.options.add(new Option(m, m));
        });
    }
}

/**
 * 4. Export Functionalities
 */
function exportToExcel() {
    if (!globalChartData) return alert("❌ No data available for export.");
    const ws = XLSX.utils.json_to_sheet(globalChartData.data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "GeniusBI_Analytics");
    XLSX.writeFile(wb, "Executive_Report.xlsx");
}

async function exportDashboardToPDF() {
    const { jsPDF } = window.jspdf;
    const area = document.getElementById('capture-area');
    if (!area) return;
    
    const canvas = await html2canvas(area, { scale: 2 }); // Scale 2 for high definition
    const imgData = canvas.toDataURL('image/png');
    const doc = new jsPDF('l', 'mm', 'a4');
    
    doc.setFontSize(18);
    doc.setTextColor(40);
    doc.text("GeniusBI Intelligence Report", 15, 15);
    
    doc.addImage(imgData, 'PNG', 10, 25, 277, 150);
    doc.save('GeniusBI_Analytics_Dashboard.pdf');
}

/**
 * 5. Global Listeners for Chart Interaction
 */
document.addEventListener('DOMContentLoaded', () => {
    // Re-draw chart whenever axis or style changes
    ['chartTypeSelect', 'chartColorSelect', 'xAxisInput', 'yAxisInput'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', refreshBICharts);
    });
});