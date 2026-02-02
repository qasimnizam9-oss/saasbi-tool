/**
 * GeniusBI Pivot Controller
 * Processes raw data into executive summary tables
 */

/**
 * 1. Populate Pivot Selectors
 * Dynamically fills dropdowns based on the uploaded file's structure.
 */
function populatePivotSelectors(schema) {
    const rowSelect = document.getElementById('pivot-row-select');
    const valSelect = document.getElementById('pivot-val-select');
    
    if (!rowSelect || !valSelect) {
        console.error("Pivot selectors not found in HTML. Check IDs: pivot-row-select and pivot-val-select");
        return;
    }

    // Reset with professional placeholders
    rowSelect.innerHTML = '<option value="" disabled selected>Select Category (e.g. Region)</option>';
    valSelect.innerHTML = '<option value="" disabled selected>Select Value (e.g. Revenue)</option>';

    // Add Dimensions (Categorical text columns)
    if (schema && schema.dimensions) {
        schema.dimensions.forEach(col => {
            const opt = new Option(col, col);
            rowSelect.add(opt);
        });
    }
    
    // Add Measures (Numerical columns)
    if (schema && schema.measures) {
        schema.measures.forEach(col => {
            const opt = new Option(col, col);
            valSelect.add(opt);
        });
    }

    // Auto-select first available options to show data immediately
    if (window.AppData && window.AppData.data) {
        if (rowSelect.options.length > 1) rowSelect.selectedIndex = 1;
        if (valSelect.options.length > 1) valSelect.selectedIndex = 1;
        generatePivot();
    }
}

/**
 * 2. Generate Pivot Logic
 * Groups data by the selected category and performs the math.
 */
function generatePivot() {
    const data = window.AppData ? window.AppData.data : null;
    
    if (!data || data.length === 0) {
        console.warn("Pivot attempted but no data found in window.AppData");
        return; 
    }

    const rowKey = document.getElementById('pivot-row-select').value;
    const valKey = document.getElementById('pivot-val-select').value;
    const aggType = document.getElementById('pivot-agg')?.value || 'sum';

    if (!rowKey || !valKey) return;

    // Execution: Grouping and Aggregation with Data Cleaning
    const summary = data.reduce((acc, curr) => {
        const group = (!curr[rowKey] && curr[rowKey] !== 0) ? "Undefined" : curr[rowKey];
        
        // CLEANING: Handle currency symbols ($), commas (,), or percentages (%)
        let rawVal = curr[valKey];
        if (typeof rawVal === 'string') {
            rawVal = rawVal.replace(/[$,%]/g, '').trim();
        }
        const val = parseFloat(rawVal) || 0;
        
        if (!acc[group]) {
            acc[group] = { 
                sum: 0, 
                count: 0, 
                min: val, 
                max: val 
            };
        }
        
        acc[group].sum += val;
        acc[group].count += 1;
        acc[group].min = Math.min(acc[group].min, val);
        acc[group].max = Math.max(acc[group].max, val);
        
        return acc;
    }, {});

    renderPivotTable(rowKey, valKey, summary, aggType);
}

/**
 * 3. Render Executive Table
 * Enhanced for Scannability and Theme Compatibility
 */
function renderPivotTable(rowKey, valKey, summary, aggType) {
    const container = document.getElementById('pivot-table-output');
    if (!container) return;
    
    const labelRow = rowKey.toUpperCase().replace(/_/g, ' ');
    const labelVal = `${aggType.toUpperCase()} OF ${valKey.toUpperCase().replace(/_/g, ' ')}`;

    let html = `
        <div class="pro-table-wrapper" style="max-height: 550px; overflow-y: auto;">
            <table class="pro-table">
                <thead style="position: sticky; top: 0; z-index: 10; background: var(--bg-card);">
                    <tr>
                        <th>${labelRow}</th>
                        <th style="text-align: right;">${labelVal}</th>
                    </tr>
                </thead>
                <tbody>`;
    
    // Alphabetical sort for organized reporting
    const sortedKeys = Object.keys(summary).sort();

    sortedKeys.forEach(key => {
        const stats = summary[key];
        let displayVal = 0;

        switch(aggType) {
            case 'mean':
            case 'average':
                displayVal = stats.sum / stats.count;
                break;
            case 'count':
                displayVal = stats.count;
                break;
            case 'min':
                displayVal = stats.min;
                break;
            case 'max':
                displayVal = stats.max;
                break;
            default: // Sum
                displayVal = stats.sum;
        }
        
        html += `
            <tr>
                <td><strong>${key}</strong></td>
                <td style="font-family: 'JetBrains Mono', monospace; color: var(--accent); text-align: right; font-weight: 600;">
                    ${displayVal.toLocaleString(undefined, {
                        minimumFractionDigits: aggType === 'count' ? 0 : 2, 
                        maximumFractionDigits: 2
                    })}
                </td>
            </tr>`;
    });
    
    // Grand Total Calculation
    const totalStats = Object.values(summary).reduce((t, s) => ({
        sum: t.sum + s.sum,
        count: t.count + s.count
    }), { sum: 0, count: 0 });

    let finalTotal = (aggType === 'count') ? totalStats.count : totalStats.sum;
    if (aggType === 'mean' || aggType === 'average') finalTotal = totalStats.sum / totalStats.count;

    html += `
                <tr style="background: var(--bg-main); border-top: 2px solid var(--border); position: sticky; bottom: 0;">
                    <td><strong>GRAND TOTAL</strong></td>
                    <td style="text-align: right; font-weight: 800; color: var(--text-main);">
                        ${finalTotal.toLocaleString(undefined, {
                            minimumFractionDigits: aggType === 'count' ? 0 : 2,
                            maximumFractionDigits: 2
                        })}
                    </td>
                </tr>
            </tbody>
        </table>
    </div>`;

    container.innerHTML = html;
}

/**
 * 4. Executive Export
 */
function exportPivotToExcel() {
    const table = document.querySelector("#pivot-table-output table");
    if (!table) {
        alert("Nothing to export! Please generate a pivot table first.");
        return;
    }

    let csvContent = "";
    const rows = table.querySelectorAll("tr");

    rows.forEach(row => {
        const rowData = Array.from(row.querySelectorAll("td, th"))
            .map(cell => {
                let text = cell.innerText.replace(/,/g, '');
                return `"${text.replace(/"/g, '""')}"`;
            })
            .join(",");
        csvContent += rowData + "\r\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const fileName = `GeniusBI_Pivot_${new Date().toISOString().slice(0,10)}.csv`;
    
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}