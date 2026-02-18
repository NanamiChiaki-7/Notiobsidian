// static/js/graph.js
// Graph view logic - Complete version with emoji|| support

if (window.pageType === 'graph') {
    const container = document.getElementById('mynetwork');
    const cabinet = document.getElementById('cabinet-content');
    const ctxMenu = document.getElementById('context-menu');
    
    let network = null;
    let graphNodes = new vis.DataSet();
    let graphEdges = new vis.DataSet();
    
    // State management
    let savedIds = window.graphConfig?.visible_ids || [];
    const nodesInGraph = new Set(savedIds);
    
    let cabinetSort = 'tag';
    let selectedNodeId = null;

    // ========== Global icon cleaning function (compatibility) ==========
    window.getDisplayIcon = window.getDisplayIcon || function(icon) {
        if (!icon) return '📄';
        if (icon.includes('||')) {
            return icon.split('||')[0];
        }
        return icon;
    };
    window.getCleanIcon = window.getDisplayIcon; // Alias

    // ========== Vis.js initialization ==========
    const options = {
        nodes: { 
            shape: 'dot', 
            size: 15, 
            font: { size: 12, face: 'Inter', color: '#37352f' },
            color: { 
                background: '#ffffff', 
                border: '#6366f1', 
                highlight: { background: '#6366f1', border: '#4338ca' } 
            },
            borderWidth: 2
        },
        edges: { 
            width: 2, 
            color: { color: '#1e1b4b', opacity: 0.3 }, 
            arrows: { to: { enabled: true, scaleFactor: 0.5 } },
            smooth: { type: 'continuous' }
        },
        physics: { 
            forceAtlas2Based: { 
                gravitationalConstant: -50, 
                centralGravity: 0.01, 
                springLength: 100 
            },
            solver: 'forceAtlas2Based',
            stabilization: false
        },
        interaction: { 
            hover: true, 
            multiselect: true 
        }
    };

    network = new vis.Network(container, { nodes: graphNodes, edges: graphEdges }, options);

    // ========== Core rendering logic ==========
    function refreshGraphData() {
        graphNodes.clear();
        graphEdges.clear();

        // Add nodes - using cleaned icons
        nodesInGraph.forEach(id => {
            const p = window.allPagesData.find(x => x.id === id);
            if(p) {
                const displayIcon = window.getDisplayIcon(p.icon);
                graphNodes.add({ 
                    id: p.id, 
                    label: `${displayIcon} ${p.title}` 
                });
            }
        });

        // Calculate edges
        nodesInGraph.forEach(sourceId => {
            const sourcePage = window.allPagesData.find(x => x.id === sourceId);
            if(!sourcePage) return;

            const links = window.getLinks(sourcePage.content);
            links.forEach(linkTitle => {
                const targetPage = window.allPagesData.find(x => x.title === linkTitle);
                if(targetPage && nodesInGraph.has(targetPage.id)) {
                    try {
                        graphEdges.add({ from: sourceId, to: targetPage.id });
                    } catch(e) {
                        // Ignore duplicate edges
                    }
                }
            });
        });
        
        saveCurrentState();
    }

    // ========== State persistence ==========
    function saveCurrentState() {
        const payload = { visible_ids: Array.from(nodesInGraph) };
        fetch(`/api/page/${window.pageId}/save_graph`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        }).catch(err => console.error('Failed to save graph state:', err));
    }

    // ========== Interaction logic ==========
    window.addNodeToGraph = (id) => {
        if(nodesInGraph.has(id)) return;
        nodesInGraph.add(id);
        refreshGraphData();
        renderCabinet();
    };

    function removeNodeFromGraph(id) {
        nodesInGraph.delete(id);
        refreshGraphData();
        renderCabinet();
    }
    
    window.resetGraph = () => {
        if(!confirm("Are you sure you want to clear the canvas? All nodes will return to the file cabinet (documents will not be deleted).")) return;
        nodesInGraph.clear();
        refreshGraphData();
        renderCabinet();
    };

    // Drag & drop logic
    container.ondragover = (e) => e.preventDefault();
    container.ondrop = (e) => {
        e.preventDefault();
        const pid = parseInt(e.dataTransfer.getData("pageId"));
        if(pid) addNodeToGraph(pid);
    };

    // ========== Context menu logic ==========
    network.on("oncontext", function (params) {
        params.event.preventDefault();
        const nodeId = this.getNodeAt(params.pointer.DOM);
        
        if (nodeId) {
            selectedNodeId = nodeId;
            ctxMenu.style.display = 'block';
            ctxMenu.style.left = params.pointer.DOM.x + container.offsetLeft + 'px';
            ctxMenu.style.top = params.pointer.DOM.y + 'px';
        } else {
            ctxMenu.style.display = 'none';
        }
    });

    document.addEventListener('click', () => ctxMenu.style.display = 'none');
    network.on("click", () => ctxMenu.style.display = 'none');
    network.on("dragStart", () => ctxMenu.style.display = 'none');

    window.handleMenuAction = async (action) => {
        if (!selectedNodeId) return;
        const page = window.allPagesData.find(p => p.id === selectedNodeId);
        
        if (action === 'hide') {
            removeNodeFromGraph(selectedNodeId);
        } else if (action === 'goto') {
            window.location.href = `/p/${selectedNodeId}`;
        } else if (action === 'connect') {
            const targetName = prompt(`Connect [${page.title}] to which page? (Enter title)`);
            if(targetName) {
                try {
                    const res = await fetch(`/api/graph/connect`, {
                        method: 'POST', 
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ source_id: selectedNodeId, target_title: targetName })
                    });
                    const data = await res.json();
                    if(data.status === 'success') {
                        page.content = data.content;
                        const targetP = window.allPagesData.find(p => p.title === targetName);
                        if(targetP && nodesInGraph.has(targetP.id)) refreshGraphData();
                        else alert("Connection established. Drag the target page into the graph to see the link.");
                    } else {
                        alert("Connection failed. Please check if the page title is correct.");
                    }
                } catch(err) {
                    console.error('Connection failed:', err);
                    alert("Connection failed. Please try again later.");
                }
            }
        } else if (action === 'disconnect') {
            const existingLinks = window.getLinks(page.content);
            if(existingLinks.length === 0) {
                alert("This page currently has no outgoing links.");
                return;
            }
            const listStr = existingLinks.join(', ');
            const targetName = prompt(`Disconnect from which page?\nCurrent connections: ${listStr}`, existingLinks[0]);
            
            if(targetName) {
                try {
                    const res = await fetch(`/api/graph/disconnect`, {
                        method: 'POST', 
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ source_id: selectedNodeId, target_title: targetName })
                    });
                    const data = await res.json();
                    if(data.status === 'success') {
                        page.content = data.content;
                        refreshGraphData();
                    }
                } catch(err) {
                    console.error('Disconnect failed:', err);
                    alert("Disconnect failed. Please try again later.");
                }
            }
        }
        ctxMenu.style.display = 'none';
    };

    // ========== File cabinet rendering (complete version) ==========
    window.setCabinetSort = (s) => { 
        cabinetSort = s; 
        renderCabinet(); 
    };
    
    window.renderCabinet = () => {
        const search = document.getElementById('cabinet-search').value.toLowerCase();
        cabinet.innerHTML = '';
        
        // Filter: not in graph + title matches search
        const availablePages = window.allPagesData.filter(p => 
            !nodesInGraph.has(p.id) && p.title.toLowerCase().includes(search)
        );

        if(cabinetSort === 'name') {
            // Sort by name
            availablePages.sort((a,b) => a.title.localeCompare(b.title));
            availablePages.forEach(p => appendCabinetItem(p));
        } else {
            // Group by tags
            const grouped = {};
            const untagged = [];
            
            availablePages.forEach(p => {
                const tags = [];
                const regex = /\[\[(?![@])([^\]]+?)\]\]/g;
                let match;
                while ((match = regex.exec(p.content)) !== null) tags.push(match[1]);
                
                if(tags.length === 0) {
                    untagged.push(p);
                } else {
                    tags.forEach(t => { 
                        if(!grouped[t]) grouped[t] = []; 
                        if(!grouped[t].find(x => x.id === p.id)) grouped[t].push(p); 
                    });
                }
            });
            
            // Render tagged groups
            for(const [tag, items] of Object.entries(grouped)) {
                cabinet.innerHTML += `<div class="cabinet-section-title"># ${tag}</div>`;
                items.forEach(p => appendCabinetItem(p));
            }
            
            // Render untagged group
            if(untagged.length > 0) {
                cabinet.innerHTML += `<div class="cabinet-section-title">Untagged</div>`;
                untagged.forEach(p => appendCabinetItem(p));
            }
        }
    };
    
    // ========== File cabinet item rendering (icon cleaning core) ==========
    function appendCabinetItem(p) {
        const el = document.createElement('div');
        el.className = 'cabinet-item';
        el.draggable = true;
        
        // Core fix: clean icon, remove || suffix
        const displayIcon = window.getDisplayIcon(p.icon);
        
        el.innerText = `${displayIcon} ${p.title}`;
        
        // Drag events
        el.ondragstart = (e) => {
            e.dataTransfer.setData("pageId", p.id);
            el.classList.add('dragging');
        };
        el.ondragend = (e) => el.classList.remove('dragging');
        
        // Click to add to graph
        el.onclick = () => addNodeToGraph(p.id);
        
        cabinet.appendChild(el);
    }

    // ========== File cabinet drag & drop ==========
    window.allowDrop = (e) => e.preventDefault();
    
    window.dropToCabinet = (e) => {
        e.preventDefault();
        // Function to drag from graph back to cabinet
        const pid = parseInt(e.dataTransfer.getData("pageId"));
        if(pid && nodesInGraph.has(pid)) {
            removeNodeFromGraph(pid);
        }
    };

    // ========== Real-time search filter ==========
    // Bind search event
    document.addEventListener('DOMContentLoaded', () => {
        const searchInput = document.getElementById('cabinet-search');
        if (searchInput) {
            searchInput.addEventListener('input', renderCabinet);
        }
    });

    // ========== Initialize ==========
    refreshGraphData();
    renderCabinet();

    // ========== Listen for data updates ==========
    // When global page data changes, refresh graph and cabinet
    window.addEventListener('pagesDataUpdated', () => {
        refreshGraphData();
        renderCabinet();
    });

}