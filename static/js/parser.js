// static/js/parser.js
// Markdown扩展解析器 - 完整版：包含所有组件

// ===== 首先定义辅助函数（必须在 marked.use 之前） =====

// 媒体上传占位符渲染
window.renderUploadPlaceholder = function(type) {
    const icon = type === 'image' ? 'fa-image' : 'fa-video';
    const text = type === 'image' ? 'Upload Image' : 'Upload Video';
    return `
        <div class="media-placeholder" onclick="window.triggerMediaUpload('${type}')">
            <i class="fas ${icon}"></i>
            <span>${text}</span>
            <span class="text-xs mt-1 text-gray-400">>Click to select file</span>
        </div>
    `;
};

// Notice 构建器渲染
window.renderNoticeBuilder = function() {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    return `
        <div class="notice-builder" id="nb-${id}">
            <div class="text-xs font-bold text-gray-400 mb-2 uppercase"> New Reminder <div>
            <select id="cond-type-${id}" class="mb-2 w-full text-xs border p-1 bg-gray-50 rounded" onchange="window.toggleNoticeInput('${id}')">
                <option value="time">Specific time (YYYY-MM-DD HH:MM)</option>
                <option value="daily">Daily (HH:MM)</option>
                <option value="weekly">Weekly (Mon HH:MM)</option>
                <option value="interval">Interval (every X hours/minutes)</option>
            </select>
            <input type="text" id="cond-val-${id}" placeholder="2026-02-18 14:00" class="mb-2 w-full text-xs border p-1 rounded">
            <input type="text" id="content-${id}" placeholder="Reminder content..." class="mb-2 w-full text-xs border p-1 rounded">
            <button onclick="window.saveNotice('${id}')" class="bg-indigo-600 text-white text-xs px-3 py-1.5 rounded hover:bg-indigo-700 transition w-full font-bold">
                Insert Reminder
            </button>
        </div>
    `;
};

// Calc 构建器渲染
window.renderCalcBuilder = function() {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    
    const hasData = window.allVariables && window.allVariables.length > 0;
    
    let optionsHtml = '<option value="">-- Select variable--</option>';
    if (hasData) {
        window.allVariables.forEach(v => {
            optionsHtml += `<option value="${v.name}">${v.display_name} (${v.unit || ''})</option>`;
        });
    } else {
        optionsHtml = '<option value="" disabled selected> Loading variables...</option>';
        // 轮询直到变量加载
        const retryTimer = setInterval(() => {
            const el = document.getElementById(`calc-var-${id}`);
            if (el && window.allVariables && window.allVariables.length > 0) {
                let newOptions = '<option value="">-- Select variable --</option>';
                window.allVariables.forEach(v => {
                    newOptions += `<option value="${v.name}">${v.display_name} (${v.unit || ''})</option>`;
                });
                el.innerHTML = newOptions;
                clearInterval(retryTimer);
            }
        }, 500);
        setTimeout(() => clearInterval(retryTimer), 5000);
    }

    return `
        <div class="calc-builder" id="calc-b-${id}">
            <div class="calc-builder-header">
                <span>📊 Data Collection Point</span>
            </div>
            <div class="calc-builder-body">
                <select id="calc-var-${id}" class="calc-builder-select">
                    ${optionsHtml}
                </select>
                <input type="text" id="calc-val-${id}" placeholder="var (70/100+20)" class="calc-builder-input">
            </div>
            <button onclick="window.insertCalc('${id}')" class="calc-builder-btn">
                Confirm Insert
            </button>
        </div>
    `;
};

// 插入 Calc 组件
window.insertCalc = function(id) {
    const varSelect = document.getElementById(`calc-var-${id}`);
    const valInput = document.getElementById(`calc-val-${id}`);
    
    const varName = varSelect ? varSelect.value : "";
    const val = valInput ? valInput.value : "";
    
    if (!varName) return alert("chose var");
    if (!val) return alert("input var");
    
    const tag = `{{calc|${varName}:${val}}}`;
    const sourceEditor = document.getElementById('markdown-source');
    
    if (sourceEditor) {
        if (sourceEditor.value.includes('{{calc}}')) {
            sourceEditor.value = sourceEditor.value.replace('{{calc}}', tag);
        } else {
            sourceEditor.value += `\n${tag}`;
        }
        sourceEditor.dispatchEvent(new Event('input'));
        if (typeof window.saveContent === 'function') {
            window.saveContent(sourceEditor.value);
        }
    }
    
    const builder = document.getElementById(`calc-b-${id}`);
    if (builder) builder.remove();
};
// TO DO组件
// 解析待办项
function parseTodoItems(content) {
    const lines = content.split('\n');
    const items = [];
    const regex = /^-\s+\[([ \u2713\u00D7])\]\s+(.*?)(?:\s+@(\d{4}[.\-]\d{2}[.\-]\d{2}(?:\s+\d{1,2}:\d{2})?))?(?:\s+\[\[@([^\]]+?)\]\])?$/;
    
    lines.forEach(line => {
        const match = regex.exec(line.trim());
        if (match) {
            const statusChar = match[1];
            let status = 'pending';
            if (statusChar === '✓' || statusChar === 'x') status = 'done';
            else if (statusChar === '×') status = 'cancelled';
            
            items.push({
                status: status,
                text: match[2].trim(),
                time: match[3] ? match[3].replace(/\./g, '-') : null,
                link: match[4] || null,
                raw: line
            });
        }
    });
    return items;
}

// 渲染待办列表
function renderTodoList(items, rawContent) {
    const id = 'todo-' + Date.now() + Math.random().toString(36).substr(2, 9);
    
    let html = `<div class="todo-container" id="${id}" data-raw="${encodeURIComponent(rawContent)}">`;
    
    items.forEach((item, index) => {
        const statusIcon = item.status === 'done' ? '✓' : (item.status === 'cancelled' ? '×' : '○');
        const statusClass = `todo-item-${item.status}`;
        
        html += `<div class="todo-item ${statusClass}" data-index="${index}" data-status="${item.status}">`;
        html += `<span class="todo-checkbox" onclick="window.toggleTodoStatus(this)">${statusIcon}</span>`;
        html += `<span class="todo-text">${item.text}</span>`;
        
        if (item.time) {
            const dateStr = item.time.replace(/-/g, '.');
            html += ` <a href="#" onclick="window.goToDate('${item.time}')" class="todo-time">📅 ${dateStr}</a>`;
        }
        
        if (item.link) {
            const targetPage = window.allPagesData?.find(p => p.title.trim() === item.link.trim());
            const href = targetPage ? `/p/${targetPage.id}` : '#';
            const cls = targetPage ? 'todo-link' : 'todo-link missing';
            html += ` <a href="${href}" class="${cls}" onclick="event.stopPropagation()">[[@${item.link}]]</a>`;
        }
        
        html += `</div>`;
    });
    
    html += `</div>`;
    return html;
}


// 从内容中提取页面链接
window.getLinks = function(content) {
    const links = [];
    const regex = /\[\[@([^\]]+?)\]\]/g;
    let match;
    while ((match = regex.exec(content)) !== null) links.push(match[1]);
    return links;
};

// ===== 然后注册 marked 扩展 =====
if (typeof marked !== 'undefined') {
    marked.use({
        extensions: [
            // 1. Tags: [[xxx]]
            {
                name: 'tag',
                level: 'inline',
                start(src) { return src.match(/\[\[(?![@])/)?.index; },
                tokenizer(src) {
                    const rule = /^\[\[([^@\]]+?)\]\]/;
                    const match = rule.exec(src);
                    if (match) {
                        return { 
                            type: 'tag', 
                            raw: match[0], 
                            text: match[1] 
                        };
                    }
                },
                renderer(token) {
                    return `<span class="notion-tag">#${token.text}</span>`;
                }
            },
            
            // 2. Page Links: [[@PageName]]
            {
                name: 'pageLink',
                level: 'inline',
                start(src) { return src.match(/\[\[@/)?.index; },
                tokenizer(src) {
                    const rule = /^\[\[@([^\]]+?)\]\]/;
                    const match = rule.exec(src);
                    if (match) {
                        return { 
                            type: 'pageLink', 
                            raw: match[0], 
                            text: match[1] 
                        };
                    }
                },
                renderer(token) {
                    const targetPage = window.allPagesData?.find(p => p.title.trim() === token.text.trim());
                    const href = targetPage ? `/p/${targetPage.id}` : '#';
                    const cls = targetPage ? 'notion-link' : 'text-red-400 line-through';
                    const title = targetPage ? `jump to ${token.text}` : 'Page does not exist';
                    return `<a href="${href}" class="${cls}" title="${title}">@${token.text}</a>`;
                }
            },
            
            // 3. Time Links: @YYYY.MM.DD HH:MM
            {
                name: 'timeLink',
                level: 'inline',
                start(src) { return src.match(/@\d{4}[.\-]/)?.index; },
                tokenizer(src) {
                    const rule = /^@(\d{4}[.\-]\d{2}[.\-]\d{2})(?:\s+(\d{1,2}:\d{2})(?:-(\d{1,2}:\d{2}))?)?/;
                    const match = rule.exec(src);
                    if (match) {
                        return { 
                            type: 'timeLink', 
                            raw: match[0], 
                            date: match[1].replace(/\./g, '-'),
                            time: match[2],
                            endTime: match[3]
                        };
                    }
                },
                renderer(token) {
                    const calPage = window.allPagesData?.find(p => p.page_type === 'calendar');
                    const href = calPage ? `/p/${calPage.id}?view=day&date=${token.date}` : '#';
                    const timeStr = token.time ? ` ${token.time}${token.endTime ? '-'+token.endTime : ''}` : '';
                    return `<a href="${href}" class="text-orange-500 font-mono font-bold hover:underline bg-orange-50 px-1 rounded">📅 ${token.date}${timeStr}</a>`;
                }
            },
            // TO DO组件
            {
                name: 'todoComponent',
                level: 'block',  // 块级元素
                start(src) { return src.match(/\{\{TODO\}\}/)?.index; },
                tokenizer(src) {
                    const rule = /^\{\{TODO\}\}\n([\s\S]*?)\n\{\{\/TODO\}\}/;
                    const match = rule.exec(src);
                    if (match) {
                        // 解析内部的待办项
                        const items = parseTodoItems(match[1]);
                        return {
                            type: 'todoComponent',
                            raw: match[0],
                            items: items,
                            text: match[1]
                        };
                    }
                },
                renderer(token) {
                    return renderTodoList(token.items, token.text);
                }
            },
            // 4. Notice 组件 (必须放在通用组件之前)
            {
                name: 'noticeComponent',
                level: 'inline',
                start(src) { return src.match(/\{\{notice/)?.index; },
                tokenizer(src) {
                    const rule = /^\{\{notice(?:\|(.*?)\|(.*?))?\}\}/;
                    const match = rule.exec(src);
                    if (match) {
                        return {
                            type: 'noticeComponent',
                            raw: match[0],
                            condition: match[1] || '',
                            content: match[2] || ''
                        };
                    }
                },
                renderer(token) {
                    if (!token.condition) {
                        // 空 {{notice}} 显示构建器
                        return window.renderNoticeBuilder();
                    } else {
                        // 有参数的显示提醒块
                        return `
                            <div class="notice-block">
                                <div class="notice-icon"><i class="fas fa-bell"></i></div>
                                <div class="notice-body">
                                    <div class="notice-cond">${token.condition}</div>
                                    <div class="notice-text">${token.content}</div>
                                </div>
                            </div>
                        `;
                    }
                }
            },
            
            // 5. Calc 组件
            {
                name: 'calcComponent',
                level: 'inline',
                start(src) { return src.match(/\{\{calc/)?.index; },
                tokenizer(src) {
                    const rule = /^\{\{calc(?:\|(.*?))?\}\}/;
                    const match = rule.exec(src);
                    if (match) {
                        const content = match[1] || "";
                        let varName = "";
                        let expression = "";
                        
                        if (content.includes(':')) {
                            const parts = content.split(':');
                            varName = parts[0].trim();
                            expression = parts.slice(1).join(':').trim();
                        }

                        return {
                            type: 'calcComponent',
                            raw: match[0],
                            isEmpty: !content,
                            varName: varName,
                            expression: expression
                        };
                    }
                },
                renderer(token) {
                    if (token.isEmpty) {
                        // 空 {{calc}} 显示构建器
                        return window.renderCalcBuilder();
                    } else {
                        // 有参数的显示计算块
                        const displayName = (typeof window.getVariableName === 'function') 
                            ? window.getVariableName(token.varName) 
                            : token.varName;
                        
                        const unit = (typeof window.getVariableUnit === 'function')
                            ? window.getVariableUnit(token.varName)
                            : '';
                        
                        // 尝试计算结果
                        let result = '?';
                        try {
                            const calculated = eval(token.expression);
                            result = typeof calculated === 'number' ? calculated.toFixed(2) : calculated;
                        } catch (e) {
                            // 忽略计算错误
                        }
                        
                        return `
                            <span class="calc-chip" data-var="${token.varName}" data-expr="${token.expression}">
                                <span class="calc-chip-var">${displayName}</span>
                                <span class="calc-chip-result">${result} ${unit}</span>
                            </span>
                        `;
                    }
                }
            },
            
            // 6. 通用组件 (image/video/list) - 放在最后
            {
                name: 'component',
                level: 'inline',
                start(src) { return src.match(/\{\{(?:image|video)/)?.index; },  // 修改这里
                tokenizer(src) {
                    const rule = /^\{\{(image|video)(?:\|(.*?))?\}\}/;  // 修改这里
                    const match = rule.exec(src);
                    if (match) {
                        return { 
                            type: 'component', 
                            raw: match[0], 
                            compType: match[1], 
                            value: match[2] || '' 
                        };
                    }
                },
                renderer(token) {
                    if (token.value) {
                        // 有路径的直接显示
                        return token.compType === 'image' 
                            ? `<img src="${token.value}" class="max-w-full rounded-lg my-2" alt="image">`
                            : `<video src="${token.value}" controls class="max-w-full rounded-lg my-2"></video>`;
                    } else {
                        // 显示上传占位符
                        return window.renderUploadPlaceholder(token.compType);
                    }
                }
            }
        ]
    });
    
    console.log('✅ Markdown 解析器加载完成，包含所有组件');
} else {
    console.error('❌ marked 未加载');
}