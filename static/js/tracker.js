// static/js/tracker.js

(function() {
    if (window.pageType !== 'tracker') return;
    
    console.log('📊 Tracker page initializing...');
    
    // ========== Global State ==========
    function getLocalDate() {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    // Parse URL parameter or use local date
    const urlDate = new URLSearchParams(window.location.search).get('date');
    window.currentDate = urlDate || getLocalDate();
    
    window.trackerData = {
        time_data: {},
        diary: ""
    };
    window.chartInstance = null;
    window.isEditing = false;
    
    // ========== Initialize ==========
    async function init() {
        await loadData();
        renderUI();
        bindEvents();
    }
    
    // ========== Load Data ==========
    async function loadData() {
        try {
            const res = await fetch(`/api/tracker/day?date=${window.currentDate}`);
            const data = await res.json();
            
            if (data.content) {
                try {
                    const parsed = JSON.parse(data.content);
                    window.trackerData = {
                        time_data: parsed.time_data || {},
                        diary: parsed.diary || ""
                    };
                } catch {
                    window.trackerData = {
                        time_data: {},
                        diary: data.content
                    };
                }
            }
        } catch (err) {
            console.error('❌ Load failed:', err);
        }
    }
    
    // ========== Render UI ==========
    function renderUI() {
        renderDateDisplay();
        renderTimeEntries();
        renderDiary();
        updateStats();
        renderChart();
    }
    
    function renderDateDisplay() {
        const dateDisplay = document.getElementById('tracker-date-display');
        const datePicker = document.getElementById('tracker-date-picker');
        
        if (dateDisplay) {
            const [year, month, day] = window.currentDate.split('-');
            dateDisplay.innerText = `${year} ${month} ${day}`;
        }
        if (datePicker) datePicker.value = window.currentDate;
    }
    
    function renderTimeEntries() {
        const list = document.getElementById('time-entries-list');
        if (!list) return;
        
        list.innerHTML = '';
        
        Object.entries(window.trackerData.time_data).forEach(([activity, hours]) => {
            const div = document.createElement('div');
            div.className = 'flex justify-between items-center bg-white border border-gray-100 p-3 rounded-lg hover:bg-gray-50 group';
            div.innerHTML = `
                <span class="font-medium text-gray-700">${activity}</span>
                <div class="flex items-center space-x-3">
                    <span class="text-indigo-600 font-bold">${hours}h</span>
                    <button class="delete-btn text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" data-activity="${activity}">
                        <i class="fas fa-times text-xs"></i>
                    </button>
                </div>
            `;
            
            div.querySelector('.delete-btn').onclick = () => deleteActivity(activity);
            list.appendChild(div);
        });
    }
    
    function renderDiary() {
        const container = document.getElementById('diary-container');
        if (!container) return;
        
        if (window.isEditing) {
            // Edit mode
            if (!document.getElementById('diary-textarea')) {
                const textarea = document.createElement('textarea');
                textarea.id = 'diary-textarea';
                textarea.rows = 12;
                textarea.className = 'w-full min-h-[200px] p-3 border border-indigo-200 rounded-lg focus:outline-none focus:border-indigo-400 font-mono text-sm';
                textarea.value = window.trackerData.diary;
                container.innerHTML = '';
                container.appendChild(textarea);
                textarea.focus();
                
                textarea.oninput = () => {
                    window.trackerData.diary = textarea.value;
                    updateSaveStatus('Unsaved');
                };
            }
        } else {
            // Preview mode - use marked for rendering
            if (typeof marked !== 'undefined') {
                container.innerHTML = marked.parse(window.trackerData.diary || '*No journal entries yet*');
            } else {
                container.innerText = window.trackerData.diary || 'No journal entries';
            }
        }
        
        // Update edit button text
        const editBtn = document.getElementById('diary-edit-btn');
        if (editBtn) {
            editBtn.innerHTML = window.isEditing ? '💾 Save' : '✏️ Edit';
        }
    }
    
    // ========== Toggle Edit Mode ==========
    window.toggleDiaryEdit = function() {
        if (window.isEditing) {
            // Save and exit edit
            window.isEditing = false;
            renderDiary();
            saveData();
        } else {
            // Enter edit
            window.isEditing = true;
            renderDiary();
        }
    };
    
    // ========== Update Save Status ==========
    function updateSaveStatus(status) {
        const statusEl = document.getElementById('diary-save-status');
        if (statusEl) statusEl.innerText = status;
    }
    
    // ========== Save Data ==========
    async function saveData() {
        updateSaveStatus('Saving...');
        
        try {
            const res = await fetch('/api/tracker/save', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    date: window.currentDate,
                    time_data: window.trackerData.time_data,
                    diary: window.trackerData.diary
                })
            });
            
            const data = await res.json();
            if (data.status === 'success') {
                updateSaveStatus('Saved');
            }
        } catch (err) {
            console.error('❌ Save failed:', err);
            updateSaveStatus('Save failed');
        }
    }
    
    // ========== Add Activity ==========
    window.addTimeEntry = function() {
        const actInput = document.getElementById('input-activity');
        const hrsInput = document.getElementById('input-hours');
        
        const act = actInput?.value.trim();
        const hrs = parseFloat(hrsInput?.value);
        
        if (!act) return alert('Please enter activity name');
        if (isNaN(hrs) || hrs <= 0) return alert('Please enter valid hours');
        
        window.trackerData.time_data[act] = (window.trackerData.time_data[act] || 0) + hrs;
        
        actInput.value = '';
        hrsInput.value = '';
        
        renderTimeEntries();
        updateStats();
        renderChart();
        saveData();
    };
    
    // ========== Delete Activity ==========
    function deleteActivity(activity) {
        if (!confirm(`Delete "${activity}"?`)) return;
        delete window.trackerData.time_data[activity];
        renderTimeEntries();
        updateStats();
        renderChart();
        saveData();
    }
    
    // ========== Update Stats ==========
    function updateStats() {
        const total = Object.values(window.trackerData.time_data).reduce((a, b) => a + b, 0);
        const totalEl = document.getElementById('total-tracked');
        const unknownEl = document.getElementById('total-unknown');
        
        if (totalEl) totalEl.innerText = total.toFixed(1) + 'h';
        if (unknownEl) unknownEl.innerText = Math.max(0, 24 - total).toFixed(1) + 'h';
    }
    
    // ========== Render Chart ==========
    function renderChart() {
        const ctx = document.getElementById('dayChart')?.getContext('2d');
        if (!ctx) return;
        
        if (window.chartInstance) window.chartInstance.destroy();
        
        const total = Object.values(window.trackerData.time_data).reduce((a, b) => a + b, 0);
        const unknown = Math.max(0, 24 - total);
        
        window.chartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: [...Object.keys(window.trackerData.time_data), "Unknown"],
                datasets: [{
                    data: [...Object.values(window.trackerData.time_data), unknown],
                    backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#f3f4f6']
                }]
            },
            options: {
                cutout: '70%',
                responsive: true,
                plugins: { legend: { display: false } }
            }
        });
    }
    
    // ========== Insert Diary Template ==========
    window.insertDiaryTemplate = function(type) {
        // If not in edit mode, enter edit mode first
        if (!window.isEditing) {
            window.isEditing = true;
            renderDiary();
        }
        
        // Wait a bit for DOM update then insert template
        setTimeout(() => {
            const textarea = document.getElementById('diary-textarea');
            if (!textarea) return;
            
            let template = '';
            switch(type) {
                case 'gratitude':
                    template = '\n## Three Gratitudes\n1. \n2. \n3.\n';
                    break;
                case 'review':
                    template = '\n## Daily Review\n**Accomplished**:\n- \n\n**Learned**:\n- \n\n**To Improve**:\n- \n';
                    break;
                case 'plan':
                    template = '\n## Tomorrow\'s Plan\n{{TODO}}\n- [ ] \n- [ ] \n- [ ]\n{{/TODO}}\n';
                    break;
                case 'idea':
                    template = '\n## 💡 Idea\n';
                    break;
            }
            
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            textarea.value = textarea.value.substring(0, start) + template + textarea.value.substring(end);
            window.trackerData.diary = textarea.value;
            textarea.focus();
            updateSaveStatus('Unsaved');
        }, 50);
    };
    
    // ========== Date Navigation ==========
    window.changeDate = async function(offset) {
        const d = new Date(window.currentDate);
        d.setDate(d.getDate() + offset);
        const newDate = d.toISOString().split('T')[0];
        
        await saveData();
        window.location.href = `/p/${window.pageId}?date=${newDate}`;
    };
    
    // ========== Bind Events ==========
    function bindEvents() {
        const datePicker = document.getElementById('tracker-date-picker');
        if (datePicker) {
            datePicker.addEventListener('change', (e) => {
                window.location.href = `/p/${window.pageId}?date=${e.target.value}`;
            });
        }
    }
    
    // Start
    init();
})();