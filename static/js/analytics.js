// static/js/analytics.js
// 负责变量管理面板、Chart.js 图表渲染以及为解析器提供变量元数据

// ========== 全局变量缓存与查询工具 ==========
window.allVariables = []; // 用于存放从后端加载的变量定义

// 通知 parser 数据已加载
window.notifyVariablesLoaded = function() {
    console.log('Variable data loaded', window.allVariables);
};

// ========== 初始化与入口 ==========
window.Analytics = {
    modalId: 'analytics-modal',
    chartInstance1: null,
    chartInstance2: null,

    // 打开管理面板
    openPanel: function() {
        this.renderModalStructure();
        this.loadVariablesList();
        document.getElementById(this.modalId).classList.remove('hidden');
    },

    // 关闭面板
    closePanel: function() {
        document.getElementById(this.modalId).classList.add('hidden');
    },

    // 渲染 Modal 的 HTML 结构
    renderModalStructure: function() {
        if (document.getElementById(this.modalId)) return;

        const modalHtml = `
        <div id="${this.modalId}" class="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 hidden backdrop-blur-sm">
            <div class="bg-white rounded-xl shadow-2xl w-full max-w-4xl border-4 border-grey-500 flex flex-col overflow-hidden" style="height: 80vh; max-height: 700px;">
                <!-- Header -->
                <div class="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
                    <h2 class="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <span>📊</span> Variable Console
                    </h2>
                    <button onclick="window.Analytics.closePanel()" class="text-gray-500 hover:text-red-500 text-2xl">&times;</button>
                </div>

                <!-- Body -->
                <div class="flex flex-1 overflow-hidden">
                    <!-- Left: Variable List -->
                    <div class="w-1/3 border-r bg-gray-50 flex flex-col">
                        <div class="p-4 border-b space-y-2">
                            <button onclick="window.Analytics.showCreateForm()" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg font-medium transition shadow-sm">
                                + New Variable
                            </button>
                            <button onclick="window.Analytics.refreshVariables()" class="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 py-1 rounded text-xs font-medium transition">
                                ↻ Refresh List
                            </button>
                        </div>
                        <div id="analytics-var-list" class="flex-1 overflow-y-auto p-2 space-y-2">
                            <div class="text-center text-gray-400 mt-10">loading...</div>
                        </div>
                    </div>

                    <!-- Right: Dashboard -->
                    <div class="w-2/3 p-6 overflow-y-auto bg-white" id="analytics-dashboard">
                        <div class="h-full flex flex-col items-center justify-center text-gray-400">
                            <i class="fas fa-chart-line text-6xl mb-4 text-gray-200"></i>
                            <p>chose var to check</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    // 刷新变量列表
    refreshVariables: function() {
        this.loadVariablesList();
    },

    // 加载变量列表
    loadVariablesList: async function() {
        try {
            const res = await fetch('/api/vars/list');
            const vars = await res.json();
            window.allVariables = vars; // 同步到全局缓存
            
            // 通知 parser 数据已加载
            window.notifyVariablesLoaded();

            const listEl = document.getElementById('analytics-var-list');
            if (!listEl) return;
            
            listEl.innerHTML = '';

            vars.forEach(v => {
                const item = document.createElement('div');
                item.className = 'bg-white p-3 rounded-lg border border-gray-200 hover:border-indigo-400 cursor-pointer shadow-sm transition group relative';
                item.innerHTML = `
                    <div class="flex justify-between items-center" onclick="window.Analytics.loadDashboard(${v.id})">
                        <div>
                            <div class="font-bold text-gray-700 text-sm">${v.display_name || v.name}</div>
                            <div class="text-xs text-gray-400 font-mono">${v.name}</div>
                        </div>
                        <div class="flex items-center gap-2">
                            <div class="w-3 h-3 rounded-full" style="background-color: ${v.color}"></div>
                            <button onclick="event.stopPropagation(); window.insertCalcTemplate('${v.name}')" 
                                    class="text-gray-300 hover:text-indigo-600 p-1 opacity-0 group-hover:opacity-100 transition"
                                    title="insert to page">
                                <i class="fas fa-plus-circle text-xs"></i>
                            </button>
                        </div>
                    </div>
                    <button onclick="window.Analytics.confirmDelete(event, ${v.id}, '${v.display_name || v.name}')" 
                            class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition">
                        <i class="fas fa-trash-alt text-xs"></i>
                    </button>
                `;
                listEl.appendChild(item);
            });
        } catch (e) {
            console.error('加载变量失败:', e);
        }
    },

    // 删除变量确认
    confirmDelete: function(event, varId, displayName) {
        event.stopPropagation();
        const ok = confirm(`Are you sure you want to delete variable "${displayName}"?\nThis will clear all related historical data!`);
        if (!ok) return;

        this.deleteVariable(varId);
    },

    // 删除变量
    deleteVariable: async function(varId) {
        try {
            const res = await fetch(`/api/vars/${varId}/delete`, { method: 'POST' });
            const data = await res.json();
            if (data.status === 'success') {
                const dash = document.getElementById('analytics-dashboard');
                if (dash) {
                    dash.innerHTML = `<div class="h-full flex flex-col items-center justify-center text-gray-400"><p>Variable deleted successfully</p></div>`;
                }
                this.loadVariablesList();
            } else {
                alert('del fail: ' + data.error);
            }
        } catch (e) {
            alert('ask fail');
        }
    },

    // 显示创建表单
    showCreateForm: function() {
        const dash = document.getElementById('analytics-dashboard');
        if (!dash) return;
        
        dash.innerHTML = `
            <div class="max-w-md mx-auto mt-10">
                <h3 class="text-lg font-bold mb-4 border-b pb-2">Create New Variable</h3>
                <div class="space-y-4">
                    <div>
                        <label class="block text-xs font-bold text-gray-500 mb-1">Variable Code (for calculations,)</label>
                        <div class="flex items-center">
                            <span class="bg-gray-100 border border-r-0 rounded-l px-2 py-2 text-gray-500 text-sm">calc_</span>
                            <input type="text" id="new-var-name" class="w-full border rounded-r p-2 text-sm focus:outline-none focus:border-indigo-500" placeholder="money">
                        </div>
                        <p class="text-xs text-gray-400 mt-1">Final variable name: calc_<span id="var-name-preview">money</span></p>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 mb-1">Display Name (e.g., Daily Expenses)</label>
                        <input type="text" id="new-var-display" class="w-full border rounded p-2 text-sm" placeholder="e.g., Daily Expenses">
                    </div>
                    <div class="flex gap-4">
                        <div class="flex-1">
                            <label class="block text-xs font-bold text-gray-500 mb-1">unit</label>
                            <input type="text" id="new-var-unit" class="w-full border rounded p-2 text-sm" placeholder="kg, h">
                        </div>
                        <div class="flex-1">
                            <label class="block text-xs font-bold text-gray-500 mb-1">Chart Color</label>
                            <input type="color" id="new-var-color" class="w-full h-9 border rounded p-1" value="#6366f1">
                        </div>
                    </div>
                    <button onclick="window.Analytics.submitCreate()" class="w-full bg-indigo-600 text-white py-2 rounded font-bold mt-4 hover:bg-indigo-700">Create Variable</button>
                    <button onclick="window.Analytics.loadVariablesList()" class="w-full bg-gray-200 text-gray-700 py-2 rounded font-bold mt-2 hover:bg-gray-300">Cancel</button>
                </div>
            </div>
        `;

        // 实时预览变量名
        const nameInput = document.getElementById('new-var-name');
        const preview = document.getElementById('var-name-preview');
        if (nameInput && preview) {
            nameInput.addEventListener('input', function() {
                preview.textContent = this.value || 'money';
            });
        }
    },

    submitCreate: async function() {
        const nameInput = document.getElementById('new-var-name')?.value;
        const display = document.getElementById('new-var-display')?.value;
        const unit = document.getElementById('new-var-unit')?.value;
        const color = document.getElementById('new-var-color')?.value;

        if (!nameInput) return alert('input var code');

        try {
            const res = await fetch('/api/vars/create', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ 
                    name: nameInput, 
                    display_name: display, 
                    unit, 
                    color 
                })
            });
            const data = await res.json();
            if (data.status === 'success') {
                alert('success');
                this.loadVariablesList();
                this.loadDashboardByName(data.name);
            } else {
                alert(data.error);
            }
        } catch (e) {
            alert('fail');
        }
    },

    loadDashboardByName: function(name) {
        const v = window.allVariables.find(x => x.name === name);
        if (v) this.loadDashboard(v.id);
    },

    loadDashboard: async function(varId) {
        const dash = document.getElementById('analytics-dashboard');
        if (!dash) return;
        
        dash.innerHTML = `<div class="text-center mt-20"><i class="fas fa-spinner fa-spin text-2xl text-indigo-500"></i></div>`;

        try {
            const res = await fetch(`/api/vars/${varId}/stats`);
            const data = await res.json();

            // 获取变量定义
            const varDef = window.allVariables.find(v => v.id === varId) || {};
            
            dash.innerHTML = `
                <div class="space-y-6">
                    <div>
                        <h3 class="text-xl font-bold mb-1 text-gray-800">${data.variable.name}</h3>
                        <div class="flex items-center gap-2 text-sm">
                            <span class="text-gray-500">unit: ${data.variable.unit || 'none'}</span>
                            <span class="w-1 h-1 bg-gray-300 rounded-full"></span>
                            <span class="text-gray-500 font-mono">${varDef.name || ''}</span>
                        </div>
                    </div>
                    
                    <div class="bg-white p-4 rounded-lg shadow-sm border relative" style="height: 300px;">
                        <h4 class="text-sm font-bold text-gray-500 mb-2">📈 Historical Trend</h4>
                        //not working
                        <canvas id="chart-trend"></canvas>
                    </div>

                    <div class="bg-white p-4 rounded-lg shadow-sm border relative" style="height: 300px;">
                        <h4 class="text-sm font-bold text-gray-500 mb-2">🥧 Source Distribution</h4>
                        <div class="h-[250px] flex justify-center">
                            <canvas id="chart-dist"></canvas>
                        </div>
                    </div>

                    <div class="bg-gray-50 p-4 rounded-lg border">
                        <h4 class="text-sm font-bold text-gray-500 mb-2">📋 Data Details</h4>
                        <div class="text-xs space-y-1 max-h-40 overflow-y-auto">
                            ${data.distribution.labels.map((label, idx) => `
                                <div class="flex justify-between items-center py-1 border-b border-gray-100 last:border-0">
                                    <span class="text-gray-600">${label}</span>
                                    <span class="font-mono font-bold text-indigo-600">${data.distribution.values[idx].toFixed(2)} ${data.variable.unit}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;

            this.renderCharts(data);
        } catch (e) {
            console.error('fail loading:', e);
            dash.innerHTML = `<div class="text-red-500 text-center mt-10">fail loading</div>`;
        }
    },

    renderCharts: function(data) {
        // 销毁旧图表
        if (this.chartInstance1) {
            this.chartInstance1.destroy();
            this.chartInstance1 = null;
        }
        if (this.chartInstance2) {
            this.chartInstance2.destroy();
            this.chartInstance2 = null;
        }

        // 渲染趋势图
        const ctx1 = document.getElementById('chart-trend')?.getContext('2d');
        if (ctx1 && data.timeline.labels.length > 0) {
            this.chartInstance1 = new Chart(ctx1, {
                type: 'line',
                data: {
                    labels: data.timeline.labels,
                    datasets: [{
                        label: data.variable.name,
                        data: data.timeline.values,
                        borderColor: data.variable.color || '#6366f1',
                        backgroundColor: (data.variable.color || '#6366f1') + '20',
                        tension: 0.3,
                        fill: true,
                        pointBackgroundColor: data.variable.color || '#6366f1',
                        pointBorderColor: 'white',
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    }]
                },
                options: { 
                    responsive: true, 
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            callbacks: {
                                label: (context) => {
                                    let label = context.dataset.label || '';
                                    if (label) label += ': ';
                                    label += context.parsed.y.toFixed(2) + ' ' + (data.variable.unit || '');
                                    return label;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: {
                                color: '#f3f4f6'
                            }
                        },
                        x: {
                            grid: {
                                display: false
                            }
                        }
                    }
                }
            });
        }

        // 渲染分布图
        const ctx2 = document.getElementById('chart-dist')?.getContext('2d');
        if (ctx2 && data.distribution.labels.length > 0) {
            this.chartInstance2 = new Chart(ctx2, {
                type: 'doughnut',
                data: {
                    labels: data.distribution.labels,
                    datasets: [{
                        data: data.distribution.values,
                        backgroundColor: ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#6b7280'],
                        borderWidth: 0
                    }]
                },
                options: { 
                    responsive: true, 
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                boxWidth: 12,
                                padding: 15,
                                font: {
                                    size: 10
                                }
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: (context) => {
                                    const label = context.label || '';
                                    const value = context.raw || 0;
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const percentage = ((value / total) * 100).toFixed(1);
                                    return `${label}: ${value.toFixed(2)} ${data.variable.unit || ''} (${percentage}%)`;
                                }
                            }
                        }
                    },
                    cutout: '60%'
                }
            });
        }
    }
};

// 页面加载时自动拉取一次变量列表
document.addEventListener('DOMContentLoaded', () => {
    window.Analytics.loadVariablesList();
});

// 监听变量面板按钮
document.addEventListener('DOMContentLoaded', function() {
    const analyticsBtn = document.getElementById('analytics-sidebar-btn');
    if (analyticsBtn) {
        analyticsBtn.onclick = function(e) {
            e.preventDefault();
            window.Analytics.openPanel();
        };
    }
});