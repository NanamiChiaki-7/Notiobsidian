// static/js/calendar.js
// Global calendar view logic

if (window.pageType === 'calendar') {
    // Internal state
    let viewDate = new Date();
    const urlParams = new URLSearchParams(window.location.search);
    let currentViewMode = urlParams.get('view') || 'month';
    let selectedDay = urlParams.get('date') || new Date().toISOString().split('T')[0];

    // DOM elements
    const grid = document.getElementById('calendar-view');
    const titleEl = document.getElementById('calendar-title');
    const weekHeader = document.getElementById('calendar-week-header');
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    // ===== Public API =====
    window.switchToDayView = (dateStr) => {
        currentViewMode = 'day';
        selectedDay = dateStr;
        
        const url = new URL(window.location);
        url.searchParams.set('view', 'day');
        url.searchParams.set('date', dateStr);
        window.history.pushState({}, '', url);
        window.renderCalendar();
    };

    window.backToMonth = () => {
        currentViewMode = 'month';
        
        const url = new URL(window.location);
        url.searchParams.delete('view');
        url.searchParams.delete('date');
        window.history.pushState({}, '', url);
        window.renderCalendar();
    };

    window.moveCalendarMonth = (dir) => {
        viewDate.setMonth(viewDate.getMonth() + dir);
        renderMonthView();
    };

    window.resetCalendarToToday = () => {
        viewDate = new Date();
        currentViewMode = 'month';
        
        const url = new URL(window.location);
        url.searchParams.delete('view');
        url.searchParams.delete('date');
        window.history.pushState({}, '', url);
        renderMonthView();
    };

    window.triggerIcsUpload = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.ics';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const formData = new FormData();
            formData.append('file', file);
            
            try {
                const res = await fetch(`/api/calendar/import`, { method: 'POST', body: formData });
                const d = await res.json();
                if (d.status === 'success') {
                    alert('Import successful!');
                    location.reload();
                } else {
                    alert('Import failed: ' + d.error);
                }
            } catch (err) { 
                console.error(err); 
            }
        };
        input.click();
    };

    window.renderCalendar = () => {
        if (currentViewMode === 'day') {
            renderDayView();
        } else {
            renderMonthView();
        }
    };

    // ===== Private render functions =====
    function renderMonthView() {
        if (!grid) return;
        
        grid.className = 'calendar-grid bg-gray-100';
        weekHeader.classList.remove('hidden');
        grid.innerHTML = '';

        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        titleEl.innerText = `${monthNames[month]} ${year}`;
        updateHeaderControls('month');

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDay = firstDay.getDay();
        const totalDays = lastDay.getDate();
        const todayStr = new Date().toISOString().split('T')[0];

        // Fill empty cells at month start
        for (let i = startDay; i > 0; i--) {
            grid.innerHTML += `<div class="calendar-cell bg-gray-50/50 opacity-40 border border-gray-100"></div>`;
        }

        // Render date cells
        for (let day = 1; day <= totalDays; day++) {
            const currentStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const events = window.calendarEvents.filter(e => e.date === currentStr);
            
            let html = '';
            events.slice(0, 3).forEach(e => {
                html += `<div class="bg-indigo-50 text-indigo-700 text-[9px] font-bold rounded px-1 mb-1 truncate">
                            ${e.start || ''} ${e.title}
                         </div>`;
            });
            if (events.length > 3) html += `<div class="text-[9px] text-gray-400 pl-1">+ ${events.length - 3} more</div>`;

            grid.innerHTML += `
                <div class="calendar-cell border-gray-100 border p-1 min-h-[100px] ${currentStr === todayStr ? 'today bg-blue-50/30' : 'bg-white'} hover:bg-orange-50/50 cursor-pointer transition-colors" 
                     onclick="window.switchToDayView('${currentStr}')">
                    <div class="text-right text-[10px] font-black mb-1 ${currentStr === todayStr ? 'text-blue-600' : 'text-gray-400'}">${day}</div>
                    <div class="overflow-y-auto max-h-[75px]">${html}</div>
                </div>`;
        }
    }

    function renderDayView() {
        if (!grid) return;
        
        grid.className = 'flex flex-col bg-white min-h-[500px] border border-gray-200 rounded-lg overflow-hidden';
        weekHeader.classList.add('hidden');
        titleEl.innerText = `${selectedDay} Schedule Details`;
        updateHeaderControls('day');

        const dayEvents = window.calendarEvents.filter(e => e.date === selectedDay);
        dayEvents.sort((a, b) => (a.start || '00:00').localeCompare(b.start || '00:00'));

        let contentHtml = `<div class="flex-1 p-6 relative">`;
        
        if (dayEvents.length === 0) {
            contentHtml += `<div class="text-center py-20 text-gray-300">No events today</div>`;
        } else {
            contentHtml += `<div class="absolute left-20 top-6 bottom-6 w-0.5 bg-gray-100"></div>`;
            dayEvents.forEach(e => {
                contentHtml += `
                    <div class="flex items-start mb-6 group cursor-pointer relative z-10" onclick="location.href='/p/${e.id}'">
                        <div class="w-20 text-xs font-mono font-bold text-gray-400 text-right pr-6 pt-1">${e.start || 'All day'}</div>
                        <div class="flex-1 bg-white border border-l-4 border-l-indigo-500 border-gray-100 p-4 rounded shadow-sm hover:shadow-md transition-all">
                            <div class="font-bold text-gray-800 text-sm">${e.title}</div>
                            <div class="text-[10px] text-gray-400 mt-1">From: ${e.source_page || 'Unknown'}</div>
                        </div>
                    </div>`;
            });
        }
        contentHtml += `</div>`;
        grid.innerHTML = contentHtml;
    }

    function updateHeaderControls(mode) {
        const container = document.getElementById('calendar-controls');
        if (!container) return;
        
        if (mode === 'day') {
            container.innerHTML = `
                <button onclick="window.backToMonth()" class="px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 rounded text-[10px] font-black text-gray-600 uppercase">
                    <i class="fas fa-arrow-left mr-2"></i> Back to Month
                </button>`;
        } else {
            container.innerHTML = `
                <button onclick="window.triggerIcsUpload()" class="p-1.5 hover:bg-gray-200 rounded text-gray-500"><i class="fas fa-file-import"></i></button>
                <a href="/api/calendar/export" target="_blank" class="p-1.5 hover:bg-gray-200 rounded text-gray-500"><i class="fas fa-file-export"></i></a>
                <div class="w-[1px] h-3 bg-gray-200 mx-1"></div>
                <button onclick="window.moveCalendarMonth(-1)" class="p-1.5 hover:bg-gray-200 rounded text-gray-600 text-xs">◀</button>
                <button onclick="window.resetCalendarToToday()" class="px-2 py-1 hover:bg-gray-200 rounded text-[10px] font-black">TODAY</button>
                <button onclick="window.moveCalendarMonth(1)" class="p-1.5 hover:bg-gray-200 rounded text-gray-600 text-xs">▶</button>`;
        }
    }

    // Initial render
    window.renderCalendar();
}