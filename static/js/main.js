// static/js/main.js
// 核心应用逻辑 - 页面渲染、交互、数据操作

// ========== 全局初始化 ==========
(function initGlobals() {
    window.mdPreview = document.getElementById('markdown-preview');
    window.mdSource = document.getElementById('markdown-source');
    
    if (typeof window.calendarEvents === 'undefined') window.calendarEvents = [];
    if (typeof window.globalNotices === 'undefined') window.globalNotices = [];
    if (typeof window.allVariables === 'undefined') window.allVariables = [];
    
        // 初始化侧边栏管理器（如果是首页且有页面数据）
    if (window.allPagesData?.length > 0) {
        import('./sidebar.js').then(() => {
            window.sidebar = new SidebarManager();
        });
    }
    
    // 初始化文件上传控件
    initFileUpload();

    // 初始化分析模块入口
    initAnalyticsEntry();
    
    // 加载变量数据
    loadVariables();
})();

// ========== 加载变量数据 ==========
async function loadVariables() {
    try {
        const res = await fetch('/api/vars/list');
        const vars = await res.json();
        window.allVariables = vars;
        //console.log('📊 变量数据已加载', vars);
        
        // 关键修复：变量加载完成后重新渲染
        if (window.pageType === 'doc') {
            window.renderMarkdown();
            //console.log('🔄 变量加载后重新渲染');
        }
        
        // 触发自定义事件，让其他模块也能监听
        window.dispatchEvent(new CustomEvent('variablesLoaded', { 
            detail: vars 
        }));
        
    } catch (err) {
        console.error('加载变量失败:', err);
    }
}

// ========== 注入分析面板入口 ==========
function initAnalyticsEntry() {
    // 检查是否已经有按钮了
    if (document.getElementById('analytics-entry-btn')) return;

    // 创建一个浮动的"数据控制台"按钮
    const btn = document.createElement('button');
    btn.id = 'analytics-entry-btn';
    btn.className = 'fixed bottom-6 right-6 bg-indigo-600 text-white p-3 rounded-full shadow-lg hover:bg-indigo-700 transition z-40 flex items-center gap-2 group';
    btn.innerHTML = `
        <i class="fas fa-chart-pie"></i>
        <span class="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-in-out whitespace-nowrap text-sm font-bold">数据面板</span>
    `;
    
    btn.onclick = () => {
        if (window.Analytics) {
            window.Analytics.openPanel();
        } else {
            alert('Analytics module not loaded.');
        }
    };

    document.body.appendChild(btn);
}

// ========== 文件上传模块 ==========
function initFileUpload() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);
    window.fileInput = fileInput;
}

window.triggerMediaUpload = function(type) {
    window.fileInput.accept = type === 'image' ? 'image/*' : 'video/*';
    window.fileInput.onchange = (e) => handleFileUpload(e.target.files[0], type);
    window.fileInput.click();
};

async function handleFileUpload(file, type) {
    if(!file) return;
    
    const formData = new FormData();
    formData.append('file', file);

    try {
        const res = await fetch(`/api/upload`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        
        if (data.url) {
            const regex = new RegExp(`\\{\\{${type}\\|?\\s*\\}\\}`, 'i');
            
            if (window.mdSource?.value.match(regex)) {
                window.mdSource.value = window.mdSource.value.replace(regex, `{{${type}|${data.url}}}`);
            } else {
                window.mdSource.value += `\n{{${type}|${data.url}}}`;
            }
            
            saveContent(window.mdSource.value);
            renderMarkdown();
        } else {
            alert('Upload failed: ' + (data.error || 'Unknown error'));
        }
    } catch (err) {
        console.error(err);
        alert('Upload failed.');
    } finally {
        window.fileInput.value = '';
    }
}

// ========== Markdown 渲染模块 ==========
window.renderMarkdown = function() {
    if(window.mdPreview && window.mdSource && typeof marked !== 'undefined') {
        window.mdPreview.innerHTML = marked.parse(window.mdSource.value);
        
    }
};

window.toggleEditMode = function() {
    if (!window.mdPreview || !window.mdSource) return;
    
    window.mdPreview.classList.toggle('hidden');
    window.mdSource.classList.toggle('hidden');
    const btn = document.getElementById('edit-toggle');
    
    if (!window.mdSource.classList.contains('hidden')) {
        window.mdSource.focus();
        if(btn) btn.innerText = "Preview Mode";
    } else {
        renderMarkdown();
        if(btn) btn.innerText = "Edit Mode";
    }
};

// ========== 页面数据操作 ==========
let saveTimer;
window.saveContent = function(val) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        if (window.pageId) {
            fetch(`/api/page/${window.pageId}/update`, {
                method: 'POST', 
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({content: val})
            }).catch(err => console.error('Save failed:', err));
        }
    }, 800);
};

window.saveMeta = function() {
    const title = document.getElementById('title')?.value;
    if (title && window.pageId) {
        fetch(`/api/page/${window.pageId}/update`, { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({title}) 
        }).catch(err => console.error('Save meta failed:', err));
    }
};

window.changeCover = function(cls) {
    if (window.pageId) {
        fetch(`/api/page/${window.pageId}/update`, { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({cover: cls}) 
        }).then(() => location.reload());
    }
};

window.updateIcon = async function() {
    const currentIcon = document.getElementById('current-icon-display')?.innerText || "📄";
    
    const newIcon = prompt(
        "Enter Emoji Icon\n\n" +
        "• Normal mode: 📄 Document\n" +
        "• Hidden mode: 📦|| Archive (hide cover and icon)\n" +
        "• Examples: 🔒||private, 📁||archive, 🏷️||tag\n\n" +
        "Current icon:", 
        currentIcon
    );
    
    if (!newIcon || !window.pageId) return;
    
    try {
        await fetch(`/api/page/${window.pageId}/update`, { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({icon: newIcon}) 
        });
        
        if (newIcon.includes('||')) {
            await fetch(`/api/page/${window.pageId}/update`, { 
                method: 'POST', 
                headers: {'Content-Type': 'application/json'}, 
                body: JSON.stringify({cover: ''}) 
            });
        }
        
        location.reload();
    } catch (err) {
        console.error('❌ 更新图标失败:', err);
    }
};

window.createPage = async function(type) {
    try {
        const res = await fetch(`/api/page/create`, { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({type}) 
        });
        const d = await res.json();
        if(d.status === 'success') location.href = `/p/${d.id}`;
    } catch (err) {
        console.error('Create page failed:', err);
    }
};

window.deletePage = function(id) {
    if(confirm("Delete this page?")) {
        fetch(`/api/page/${id}/delete`, {method:'POST'})
            .then(() => location.href = `/`)
            .catch(err => console.error('Delete failed:', err));
    }
};


// ========== Notice 交互逻辑 ==========
window.toggleNoticeInput = function(id) {
    const type = document.getElementById(`cond-type-${id}`)?.value;
    const input = document.getElementById(`cond-val-${id}`);
    if (!input) return;
    
    if(type === 'daily') input.placeholder = "09:00";
    if(type === 'weekly') input.placeholder = "Mon 09:00";
    if(type === 'interval') input.placeholder = "1h (or 30m)";
    if(type === 'time') input.placeholder = "2026-02-18 14:00";
};

window.saveNotice = function(id) {
    const type = document.getElementById(`cond-type-${id}`)?.value;
    let val = document.getElementById(`cond-val-${id}`)?.value;
    const text = document.getElementById(`content-${id}`)?.value;
    
    if(!val || !text) return alert("请填写完整");
    
    let conditionStr = val;
    if(type !== 'time' && !val.includes(type)) conditionStr = `${type} ${val}`;
    if(type === 'interval') conditionStr = `every ${val}`;

    const regex = /\{\{notice\}\}/;
    const newBlock = `{{notice|${conditionStr}|${text}}}`;
    
    if (window.mdSource?.value.match(regex)) {
        window.mdSource.value = window.mdSource.value.replace(regex, newBlock);
        
        if (!window.globalNotices) window.globalNotices = [];
        window.globalNotices.push({
            condition: conditionStr,
            content: text,
            source_page: document.getElementById('title')?.value || '当前页面',
            page_id: window.pageId
        });
        
        saveContent(window.mdSource.value);
        renderMarkdown();
    }
};

// ========== Calc 组件插入逻辑 ==========
window.insertCalc = function(id) {
    const varSelect = document.getElementById(`calc-var-${id}`);
    const valInput = document.getElementById(`calc-val-${id}`);
    
    const varName = varSelect ? varSelect.value : "";
    const val = valInput ? valInput.value : "";
    
    if (!varName) return alert("请选择变量");
    if (!val) return alert("请输入数值");
    
    const tag = `{{calc|${varName}:${val}}}`;
    const sourceEditor = document.getElementById('markdown-source');
    
    if (sourceEditor) {
        if (sourceEditor.value.includes('{{calc}}')) {
            sourceEditor.value = sourceEditor.value.replace('{{calc}}', tag);
        } else {
            sourceEditor.value += `\n${tag}`;
        }
        sourceEditor.dispatchEvent(new Event('input'));
        saveContent(sourceEditor.value);
    }
    
    const builder = document.getElementById(`calc-b-${id}`);
    if (builder) builder.remove();
};

// ========== 变量相关辅助函数 ==========
window.getVariableName = function(varCode) {
    if (!window.allVariables || window.allVariables.length === 0) return varCode;
    const v = window.allVariables.find(x => x.name === varCode);
    return v ? v.display_name : varCode;
};

window.getVariableUnit = function(varCode) {
    if (!window.allVariables || window.allVariables.length === 0) return "";
    const v = window.allVariables.find(x => x.name === varCode);
    return v ? v.unit : "";
};

// ========== Emoji|| 格式解析器 ==========
(function initEmojiPipeVisibility() {
    const iconElement = document.getElementById('current-icon-display');
    const coverArea = document.getElementById('cover-area');
    const pageIconWrapper = document.querySelector('.page-icon-wrapper');
    const pageHeader = document.querySelector('.page-header-wrapper');
    const addCoverBtn = document.querySelector('button[onclick*="changeCover"]');
    
    if (!iconElement) return;
    
    const iconText = iconElement.innerText.trim();
    const emojiPipePattern = /^(\p{Emoji}+\|\|).*$/u;
    const isHiddenMode = emojiPipePattern.test(iconText);
    
    if (isHiddenMode) {
        
        if (coverArea) coverArea.style.display = 'none';
        if (pageIconWrapper) pageIconWrapper.style.display = 'none';
        if (pageHeader) {
            pageHeader.style.paddingTop = '0';
            pageHeader.style.marginTop = '0';
        }
        if (addCoverBtn) addCoverBtn.style.display = 'none';
    }
})();

// ========== 辅助函数 ==========
window.isHiddenMode = function(iconString) {
    if (!iconString) return false;
    const emojiPipePattern = /^(\p{Emoji}+\|\|).*$/u;
    return emojiPipePattern.test(iconString);
};

window.getCleanIcon = function(iconString) {
    if (!iconString) return '📄';
    return iconString.replace(/\|\|.*$/, '');
};

// ========== 页面类型分发 ==========
if (window.pageType === 'doc') {
    if (typeof marked !== 'undefined') {
        renderMarkdown();
    } else {
        document.addEventListener('DOMContentLoaded', function() {
            if (typeof marked !== 'undefined') renderMarkdown();
        });
    }
}

// ========== 监听编辑器输入 ==========
document.addEventListener('DOMContentLoaded', function() {
    const source = document.getElementById('markdown-source');
    if (source) {
        source.addEventListener('input', function(e) {
            saveContent(e.target.value);
            renderMarkdown();
        });
    }
});

//==========TO DO组件=================
window.toggleTodoStatus = function(checkboxElement) {
    const todoItem = checkboxElement.closest('.todo-item');
    if (!todoItem) return;
    
    const container = todoItem.closest('.todo-container');
    const index = parseInt(todoItem.dataset.index);
    const currentStatus = todoItem.dataset.status;
    
    // 循环切换状态: pending -> done -> cancelled -> pending
    let newStatus;
    if (currentStatus === 'pending') newStatus = 'done';
    else if (currentStatus === 'done') newStatus = 'cancelled';
    else newStatus = 'pending';
    
    // 更新 DOM
    updateTodoItemDOM(todoItem, newStatus);
    
    // 更新容器数据并保存
    updateTodoContainerData(container, index, newStatus);
    
    // 保存到数据库
    saveTodoChanges(container);
    
    // 通过 WebSocket 广播（如果有）
    if (window.wsClient) {
        window.wsClient.send({
            type: 'todo_update',
            containerId: container.id,
            index: index,
            status: newStatus
        });
    }
};

// 更新单个待办项的 DOM
function updateTodoItemDOM(todoItem, newStatus) {
    // 更新状态类
    todoItem.classList.remove('todo-item-pending', 'todo-item-done', 'todo-item-cancelled');
    todoItem.classList.add(`todo-item-${newStatus}`);
    
    // 更新状态图标
    const checkbox = todoItem.querySelector('.todo-checkbox');
    const statusIcon = newStatus === 'done' ? '✓' : (newStatus === 'cancelled' ? '×' : '○');
    checkbox.textContent = statusIcon;
    
    // 更新 dataset
    todoItem.dataset.status = newStatus;
}

// 更新容器内的原始数据
function updateTodoContainerData(container, index, newStatus) {
    const rawContent = decodeURIComponent(container.dataset.raw);
    const lines = rawContent.split('\n');
    
    // 更新对应行的状态标记
    const line = lines[index];
    if (line) {
        const statusChar = newStatus === 'done' ? '✓' : (newStatus === 'cancelled' ? '×' : ' ');
        lines[index] = line.replace(/\[[ \u2713\u00D7]\]/, `[${statusChar}]`);
    }
    
    // 更新容器的 raw 数据
    container.dataset.raw = encodeURIComponent(lines.join('\n'));
}

// 保存 TODO 变更到数据库
function saveTodoChanges(container) {
    if (!window.pageId || !window.mdSource) return;
    
    const rawContent = decodeURIComponent(container.dataset.raw);
    const todoBlock = `{{TODO}}\n${rawContent}\n{{/TODO}}`;
    
    // 查找并替换编辑器中的 TODO 块
    const editorContent = window.mdSource.value;
    const todoRegex = /\{\{TODO\}\}\n[\s\S]*?\n\{\{\/TODO\}\}/;
    
    if (editorContent.match(todoRegex)) {
        window.mdSource.value = editorContent.replace(todoRegex, todoBlock);
    }
    
    // 触发保存
    window.saveContent(window.mdSource.value);
    
    // 重新渲染（可选）
    if (window.pageType === 'doc') {
        window.renderMarkdown();
    }
}

// 跳转到日期（日历页面）
window.goToDate = function(dateStr) {
    const calPage = window.allPagesData?.find(p => p.page_type === 'calendar');
    if (calPage) {
        window.location.href = `/p/${calPage.id}?view=day&date=${dateStr}`;
    }
};

// 从编辑器插入新的 TODO 块
window.insertTodoBlock = function() {
    if (!window.mdSource) return;
    
    const today = new Date().toISOString().split('T')[0];
    const template = `{{TODO}}
- [ ] 新的任务 @${today}
- [ ] 另一个任务
- [✓] 已完成的任务
{{/TODO}}`;
    
    const editor = window.mdSource;
    if (editor.value.includes('{{TODO}}')) {
        editor.value = editor.value.replace(/\{\{TODO\}\}\n[\s\S]*?\n\{\{\/TODO\}\}/, template);
    } else {
        editor.value += `\n\n${template}`;
    }
    
    editor.dispatchEvent(new Event('input'));
    window.saveContent(editor.value);
    window.renderMarkdown();
};