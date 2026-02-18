// static/js/sidebar-simple.js

class SimpleSidebar {
    constructor() {
        this.container = document.querySelector('.space-y-1');
        this.pages = window.allPagesData || [];
        this.sortMode = 'custom'; // custom, recent, name
        this.searchTerm = '';
        
        this.init();
        this.loadState();
    }
    
    // Load state from localStorage
    loadState() {
        const saved = localStorage.getItem('simpleSidebarState');
        if (saved) {
            const state = JSON.parse(saved);
            this.sortMode = state.sortMode || 'custom';
        }
    }
    
    // Save state
    saveState() {
        localStorage.setItem('simpleSidebarState', JSON.stringify({
            sortMode: this.sortMode
        }));
    }
    
    // Initialize
    init() {
        this.renderControls();
        this.renderList();
        this.bindEvents();
    }
    
    // Render control bar (compact)
    renderControls() {
        // Remove old controls if any
        const oldControls = document.getElementById('sidebar-controls');
        if (oldControls) oldControls.remove();
        
        const controlsHtml = `
            <div id="sidebar-controls" class="px-3 py-2 border-b flex items-center gap-2">
                <!-- Search box -->
                <div class="relative flex-1">
                    <input type="text" 
                           id="sidebar-search" 
                           placeholder="Search pages..." 
                           class="w-full text-xs border rounded pl-7 pr-2 py-1.5 bg-gray-50 focus:bg-white focus:outline-none focus:border-indigo-400"
                           value="${this.searchTerm}">
                    <i class="fas fa-search absolute left-2 top-2 text-gray-400 text-xs"></i>
                    ${this.searchTerm ? `
                        <button id="clear-search" class="absolute right-2 top-2 text-gray-400 hover:text-gray-600">
                            <i class="fas fa-times text-xs"></i>
                        </button>
                    ` : ''}
                </div>
                
                <!-- Sort button (small icon) -->
                <div class="relative" id="sort-menu-container">
                    <button id="sort-button" class="p-1.5 hover:bg-gray-200 rounded text-gray-600" title="Sort options">
                        <i class="fas fa-sort-amount-down text-sm"></i>
                    </button>
                    
                    <!-- Sort dropdown menu -->
                    <div id="sort-menu" class="absolute right-0 mt-1 w-32 bg-white border rounded shadow-lg hidden z-50">
                        <div class="py-1">
                            <button class="sort-option w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 flex items-center gap-2 ${this.sortMode === 'custom' ? 'bg-indigo-50 text-indigo-600' : ''}" data-sort="custom">
                                <i class="fas fa-star ${this.sortMode === 'custom' ? 'text-yellow-400' : 'text-gray-300'}"></i>
                                Pinned First
                            </button>
                            <button class="sort-option w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 flex items-center gap-2 ${this.sortMode === 'recent' ? 'bg-indigo-50 text-indigo-600' : ''}" data-sort="recent">
                                <i class="far fa-clock"></i>
                                Recently Modified
                            </button>
                            <button class="sort-option w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 flex items-center gap-2 ${this.sortMode === 'name' ? 'bg-indigo-50 text-indigo-600' : ''}" data-sort="name">
                                <i class="fas fa-font"></i>
                                By Name
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Insert at top of sidebar
        this.container.insertAdjacentHTML('beforebegin', controlsHtml);
    }
    
    // Render list
    renderList() {
        // Apply search and sort
        const filteredPages = this.filterAndSortPages();
        
        if (filteredPages.length === 0) {
            this.container.innerHTML = '<div class="text-center text-gray-400 text-xs py-8">No matching pages found</div>';
            return;
        }
        
        // Group by pinned status
        const pinnedPages = filteredPages.filter(p => p.is_pinned);
        const normalPages = filteredPages.filter(p => !p.is_pinned);
        
        let html = '';
        
        // Pinned section
        if (pinnedPages.length > 0) {
            html += '<div class="px-2 py-1 text-[10px] text-gray-400 font-bold uppercase tracking-wider">Pinned</div>';
            html += this.renderPageList(pinnedPages);
            if (normalPages.length > 0) {
                html += '<div class="border-t border-gray-100 my-2"></div>';
            }
        }
        
        // Regular pages section
        if (normalPages.length > 0) {
            html += '<div class="px-2 py-1 text-[10px] text-gray-400 font-bold uppercase tracking-wider">All Pages</div>';
            html += this.renderPageList(normalPages);
        }
        
        this.container.innerHTML = html;
        
        // Re-bind pin events
        document.querySelectorAll('.pin-toggle').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const pageId = parseInt(btn.dataset.pageId);
                this.togglePin(pageId);
            });
        });
    }
    
    // Render page list
    renderPageList(pages) {
        return pages.map(page => `
            <div class="group flex items-center justify-between px-2 py-1.5 rounded hover:bg-gray-100 cursor-pointer transition-colors" 
                 data-page-id="${page.id}">
                <a href="/p/${page.id}" class="flex-1 flex items-center space-x-2 truncate">
                    <span class="text-base">${this.getCleanIcon(page.icon)}</span>
                    <span class="truncate text-sm ${page.is_pinned ? 'font-medium' : ''}">${page.title}</span>
                </a>
                
                <!-- Pin button + Delete button -->
                <div class="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button class="pin-toggle text-gray-400 hover:text-yellow-500 px-1.5 py-1" 
                            data-page-id="${page.id}"
                            title="${page.is_pinned ? 'Unpin' : 'Pin'}">
                        <i class="fas fa-star ${page.is_pinned ? 'text-yellow-400' : 'text-gray-300'}"></i>
                    </button>
                    <button onclick="deletePage(${page.id})" 
                            class="text-gray-400 hover:text-red-500 px-1.5 py-1"
                            title="Delete">
                        <i class="fas fa-trash-alt text-xs"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }
    
    // Filter and sort pages
    filterAndSortPages() {
        let pages = [...this.pages];
        
        // Search filter
        if (this.searchTerm) {
            const term = this.searchTerm.toLowerCase();
            pages = pages.filter(p => 
                p.title.toLowerCase().includes(term) || 
                (p.content && p.content.toLowerCase().includes(term))
            );
        }
        
        // Sort
        pages.sort((a, b) => {
            // First by pinned status (pinned first)
            if (a.is_pinned && !b.is_pinned) return -1;
            if (!a.is_pinned && b.is_pinned) return 1;
            
            // Then by selected sort mode
            switch(this.sortMode) {
                case 'recent':
                    // Use updated_at if available, otherwise created_at
                    const dateA = new Date(a.updated_at || a.created_at || 0);
                    const dateB = new Date(b.updated_at || b.created_at || 0);
                    return dateB - dateA; // Newest first
                    
                case 'name':
                    return a.title.localeCompare(b.title);
                    
                case 'custom':
                default:
                    // Custom sort (by ID or other)
                    return (a.sort_order || a.id) - (b.sort_order || b.id);
            }
        });
        
        return pages;
    }
    
    // Bind events
    bindEvents() {
        // Search input
        const searchInput = document.getElementById('sidebar-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchTerm = e.target.value;
                this.renderList();
            });
        }
        
        // Clear search
        const clearBtn = document.getElementById('clear-search');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.searchTerm = '';
                const searchInput = document.getElementById('sidebar-search');
                if (searchInput) searchInput.value = '';
                this.renderList();
            });
        }
        
        // Sort button
        const sortBtn = document.getElementById('sort-button');
        const sortMenu = document.getElementById('sort-menu');
        
        if (sortBtn && sortMenu) {
            sortBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                sortMenu.classList.toggle('hidden');
            });
            
            // Click outside to close menu
            document.addEventListener('click', (e) => {
                if (!sortMenu.contains(e.target) && !sortBtn.contains(e.target)) {
                    sortMenu.classList.add('hidden');
                }
            });
            
            // Sort option click
            document.querySelectorAll('.sort-option').forEach(option => {
                option.addEventListener('click', (e) => {
                    const sort = option.dataset.sort;
                    this.sortMode = sort;
                    this.saveState();
                    
                    // Update button style
                    document.querySelectorAll('.sort-option').forEach(opt => {
                        opt.classList.remove('bg-indigo-50', 'text-indigo-600');
                    });
                    option.classList.add('bg-indigo-50', 'text-indigo-600');
                    
                    // Close menu
                    sortMenu.classList.add('hidden');
                    
                    // Re-render
                    this.renderList();
                });
            });
        }
    }
    
    // Toggle pin status
    async togglePin(pageId) {
        try {
            const res = await fetch(`/api/sidebar/toggle_pin/${pageId}`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'}
            });
            const data = await res.json();
            
            if (data.status === 'success') {
                // Update local data
                const page = this.pages.find(p => p.id === pageId);
                if (page) {
                    page.is_pinned = data.is_pinned;
                }
                
                // Re-render
                this.renderList();
            }
        } catch (err) {
            console.error('Pin failed:', err);
            alert('Operation failed, please try again');
        }
    }
    
    // Get clean icon (remove || suffix)
    getCleanIcon(icon) {
        if (!icon) return '📄';
        return icon.includes('||') ? icon.split('||')[0] : icon;
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Ensure page data is loaded
    if (window.allPagesData) {
        window.sidebar = new SimpleSidebar();
    } else {
        // Wait for data to load
        const checkData = setInterval(() => {
            if (window.allPagesData) {
                clearInterval(checkData);
                window.sidebar = new SimpleSidebar();
            }
        }, 100);
    }
});