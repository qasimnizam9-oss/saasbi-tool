// main.js - Navigation
function switchView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.getElementById(viewId).classList.remove('hidden');
    
    document.querySelectorAll('.sidebar li').forEach(li => li.classList.remove('active'));
    event.currentTarget.classList.add('active');
}

document.getElementById('themeToggle').addEventListener('click', () => {
    document.body.classList.toggle('dark-theme');
});

// uploader.js - Communication
async function handleUpload() {
    const file = document.getElementById('filePicker').files[0];
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/process', { method: 'POST', body: formData });
    const result = await res.json();

    if (result.status === "success") {
        window.dataCache = result; // Store globally for charts
        alert("AI Analysis Complete: Data Cleaned and Mapped.");
        renderRelationships(result.schema);
        switchView('dashboard');
        initCharts(result);
    }
}