// 全局变量
let mindmapData = {
    id: "root",
    text: "中心主题",
    color: "#3498db",
    children: []
};
let selectedNode = null;
let svg = null;
let container = null;
let nodeCounter = 0;
let zoom = null;
let clickPosition = { x: 0, y: 0 }; // 存储右键点击的坐标
let contextMenuNode = null; // 存储右键点击的节点
let dragging = false; // 添加拖拽状态标志
let nodeMap = new Map(); // 用于存储节点引用和位置数据

// DOM元素
const mindmapContainer = document.getElementById('mindmap-container');
const addNodeBtn = document.getElementById('add-node');
const deleteNodeBtn = document.getElementById('delete-node');
const nodeColorInput = document.getElementById('node-color');
const exportPngBtn = document.getElementById('export-png');
const saveMapBtn = document.getElementById('save-map');
const loadMapBtn = document.getElementById('load-map');
const clearMapBtn = document.getElementById('clear-map');
const nodeEditor = document.getElementById('node-editor');
const nodeTextArea = document.getElementById('node-text');
const editNodeColorInput = document.getElementById('edit-node-color');
const saveNodeBtn = document.getElementById('save-node');
const fileModal = document.getElementById('file-modal');
const fileNameInput = document.getElementById('file-name');
const loadFileSection = document.getElementById('load-file-section');
const loadFileInput = document.getElementById('load-file');
const confirmFileActionBtn = document.getElementById('confirm-file-action');
const fileModalTitle = document.getElementById('file-modal-title');
const closeBtns = document.querySelectorAll('.close');
const contextMenu = document.getElementById('context-menu');
const addNodeHereBtn = document.getElementById('add-node-here');
const editNodeContextBtn = document.getElementById('edit-node-context');
const deleteNodeContextBtn = document.getElementById('delete-node-context');

// 初始化思维导图
function initMindmap() {
    // 清除现有的SVG内容
    mindmapContainer.innerHTML = '';
    
    // 创建SVG元素
    svg = d3.select('#mindmap-container')
        .append('svg')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('class', 'mindmap-svg');
    
    // 创建容器群组，用于缩放和平移
    container = svg.append('g')
        .attr('class', 'container');
    
    // 添加缩放和平移功能
    zoom = d3.zoom()
        .scaleExtent([0.1, 3])
        .on('zoom', (event) => {
            container.attr('transform', event.transform);
        });
    
    svg.call(zoom);
    
    // 初始居中
    const svgRect = svg.node().getBoundingClientRect();
    const initialTransform = d3.zoomIdentity
        .translate(svgRect.width / 2, svgRect.height / 2);
    
    svg.call(zoom.transform, initialTransform);
    
    // 渲染思维导图
    renderMindmap();
}

// 渲染思维导图
function renderMindmap() {
    // 清空容器和节点映射
    container.selectAll('*').remove();
    nodeMap.clear();
    
    // 创建自定义布局
    const layout = createMindmapLayout(mindmapData);
    
    // 绘制连接线
    drawLinks(layout.links);
    
    // 绘制节点
    drawNodes(layout.nodes);
}

// 创建思维导图布局
function createMindmapLayout(data) {
    const nodes = [];
    const links = [];
    
    // 设置根节点位置
    data.x = data.x !== undefined ? data.x : 0;
    data.y = data.y !== undefined ? data.y : 0;
    data.depth = 0;
    nodes.push(data);
    
    // 递归布局子节点
    function layoutNode(node, depth, index, parentX, parentY, isLeft = false) {
        // 如果节点已经有自定义位置，则使用它
        if (node.x === undefined || node.y === undefined) {
            // 设置子节点的相对位置
            const verticalSpacing = 80;
            const horizontalSpacing = 200;
            
            // 每层子节点的垂直位置
            node.depth = depth;
            node.x = isLeft ? parentX - horizontalSpacing : parentX + horizontalSpacing;
            
            // 计算垂直位置以避免重叠
            if (index === 0) {
                node.y = parentY;
            } else {
                // 基于前一个节点的位置
                const prevSibling = nodes[nodes.length - 1];
                node.y = prevSibling.y + verticalSpacing;
            }
        }
        
        // 存储节点引用到nodeMap
        nodeMap.set(node.id, node);
        
        nodes.push(node);
        
        // 添加连接线
        links.push({
            source: { x: parentX, y: parentY },
            target: { x: node.x, y: node.y }
        });
        
        // 递归处理子节点
        if (node.children && node.children.length > 0) {
            node.children.forEach((child, i) => {
                layoutNode(child, depth + 1, i, node.x, node.y, isLeft);
            });
        }
    }
    
    // 布局右侧子节点
    if (data.children && data.children.length > 0) {
        const rightChildren = data.children.slice(0, Math.ceil(data.children.length / 2));
        const leftChildren = data.children.slice(Math.ceil(data.children.length / 2));
        
        rightChildren.forEach((child, i) => {
            layoutNode(child, 1, i, data.x, data.y, false);
        });
        
        leftChildren.forEach((child, i) => {
            layoutNode(child, 1, i, data.x, data.y, true);
        });
    }
    
    // 存储根节点引用到nodeMap
    nodeMap.set(data.id, data);
    
    return { nodes, links };
}

// 绘制连接线
function drawLinks(links) {
    container.selectAll('.link')
        .data(links)
        .enter()
        .append('path')
        .attr('class', 'link')
        .attr('d', d => {
            const dx = d.target.x - d.source.x;
            const dy = d.target.y - d.source.y;
            const dr = Math.sqrt(dx * dx + dy * dy);
            return `M${d.source.x},${d.source.y}C${d.source.x + dr/3},${d.source.y} ${d.target.x - dr/3},${d.target.y} ${d.target.x},${d.target.y}`;
        });
}

// 绘制节点
function drawNodes(nodes) {
    // 创建拖拽行为
    const drag = d3.drag()
        .on('start', function(event, d) {
            // 选择节点并标记拖拽开始
            selectNode(d);
            d3.select(this).classed('dragging', true);
            dragging = true;
            
            // 阻止事件冒泡以防止触发缩放/平移
            if (event.sourceEvent) event.sourceEvent.stopPropagation();
        })
        .on('drag', function(event, d) {
            // 直接更新节点位置
            d.x += event.dx;
            d.y += event.dy;
            
            // 更新节点在DOM中的位置
            d3.select(this).attr('transform', `translate(${d.x}, ${d.y})`);
            
            // 如果有子节点，更新它们的位置
            updateChildPositions(d, event.dx, event.dy);
            
            // 立即重绘所有连接线，不等待下一次刷新
            updateConnectionsImmediate();
        })
        .on('end', function(event, d) {
            // 清除拖拽状态
            d3.select(this).classed('dragging', false);
            dragging = false;
            
            // 确保所有连接线都正确更新
            updateConnectionsImmediate();
        });

    // 创建节点
    const nodeGroups = container.selectAll('.node')
        .data(nodes)
        .enter()
        .append('g')
        .attr('class', d => `node ${d.id === (selectedNode ? selectedNode.id : null) ? 'selected-node' : ''}`)
        .attr('id', d => `node-${d.id}`)
        .attr('transform', d => `translate(${d.x}, ${d.y})`)
        .call(drag);  // 应用拖拽行为
    
    // 添加节点背景矩形
    nodeGroups.append('rect')
        .attr('class', 'node-rect node-handle')
        .attr('width', d => Math.max(100, d.text.length * 10))
        .attr('height', 40)
        .attr('x', d => -Math.max(100, d.text.length * 10) / 2)
        .attr('y', -20)
        .attr('fill', d => d.color || '#3498db')
        .attr('stroke', d => d3.color(d.color || '#3498db').darker(0.5));
    
    // 添加节点文本
    nodeGroups.append('text')
        .attr('class', 'node-text')
        .text(d => d.text)
        .attr('dy', 5);
    
    // 添加事件监听器 - 使用函数来防止this的问题
    nodeGroups.on('click', function(event, d) {
        if (!dragging) {
            event.stopPropagation();
            selectNode(d);
        }
    });
    
    nodeGroups.on('dblclick', function(event, d) {
        event.stopPropagation();
        selectNode(d);
        
        // 创建一个临时文本输入框用于直接编辑
        const node = d3.select(this);
        const nodeRect = node.select('rect').node().getBBox();
        const nodeText = node.select('text');
        const currentText = d.text;
        
        // 隐藏文本
        nodeText.style('display', 'none');
        
        // 创建文本输入框
        const foreignObject = node.append('foreignObject')
            .attr('width', Math.max(150, nodeRect.width))
            .attr('height', 40)
            .attr('x', -Math.max(150, nodeRect.width) / 2)
            .attr('y', -20);
            
        const textInput = foreignObject.append('xhtml:input')
            .attr('type', 'text')
            .attr('value', currentText)
            .style('width', '100%')
            .style('height', '100%')
            .style('font-size', '14px')
            .style('border', '1px solid #ccc')
            .style('padding', '5px')
            .style('box-sizing', 'border-box')
            .style('background-color', d.color || '#3498db')
            .style('color', '#fff')
            .style('text-align', 'center');
        
        // 自动聚焦到输入框
        textInput.node().focus();
        textInput.node().select();
        
        // 处理输入框失去焦点或按下Enter键时保存编辑
        textInput.on('blur', function() {
            saveInlineEdit(node, nodeText, foreignObject, d, this.value);
        }).on('keydown', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                saveInlineEdit(node, nodeText, foreignObject, d, this.value);
            } else if (event.key === 'Escape') {
                event.preventDefault();
                cancelInlineEdit(node, nodeText, foreignObject);
            }
        });
    });
    
    nodeGroups.on('contextmenu', function(event, d) {
        event.preventDefault();
        selectNode(d);
        contextMenuNode = d;
        showContextMenu(event.pageX, event.pageY, true);
    });
}

// 更新子节点位置
function updateChildPositions(node, dx, dy) {
    if (!node.children || node.children.length === 0) return;
    
    // 递归更新所有子节点的位置
    function updateChildren(childNode, deltaX, deltaY) {
        // 直接更新子节点的位置属性
        childNode.x += deltaX;
        childNode.y += deltaY;
        
        // 更新子节点在DOM中的位置
        const childElement = container.select(`#node-${childNode.id}`);
        if (!childElement.empty()) {
            childElement.attr('transform', `translate(${childNode.x}, ${childNode.y})`);
        }
        
        // 递归处理孙节点
        if (childNode.children && childNode.children.length > 0) {
            childNode.children.forEach(grandchild => {
                updateChildren(grandchild, deltaX, deltaY);
            });
        }
    }
    
    // 更新每个直接子节点
    node.children.forEach(child => {
        updateChildren(child, dx, dy);
    });
}

// 标准的连接线更新函数 - 用于正常渲染
function updateConnections() {
    // 重新生成连接线数据
    const links = [];
    
    function collectLinks(node) {
        if (!node.children) return;
        
        node.children.forEach(child => {
            links.push({
                source: { x: node.x, y: node.y },
                target: { x: child.x, y: child.y }
            });
            
            collectLinks(child);
        });
    }
    
    collectLinks(mindmapData);
    
    // 更新所有连接线
    container.selectAll('.link')
        .data(links)
        .attr('d', d => {
            const dx = d.target.x - d.source.x;
            const dy = d.target.y - d.source.y;
            const dr = Math.sqrt(dx * dx + dy * dy);
            return `M${d.source.x},${d.source.y}C${d.source.x + dr/3},${d.source.y} ${d.target.x - dr/3},${d.target.y} ${d.target.x},${d.target.y}`;
        });
}

// 立即更新连接线 - 优化的版本用于拖拽时
function updateConnectionsImmediate() {
    // 清除之前的连接线
    container.selectAll('.link').remove();
    
    // 创建新的连接线
    const links = [];
    
    function collectLinksRecursive(node) {
        if (!node.children || node.children.length === 0) return;
        
        node.children.forEach(child => {
            // 确保子节点的位置是最新的
            links.push({
                source: { x: node.x, y: node.y },
                target: { x: child.x, y: child.y }
            });
            
            // 递归处理子节点的子节点
            collectLinksRecursive(child);
        });
    }
    
    // 从根节点开始收集所有连接线
    collectLinksRecursive(mindmapData);
    
    // 绘制所有连接线
    container.selectAll('.link')
        .data(links)
        .enter()
        .append('path')
        .attr('class', 'link')
        .attr('d', d => {
            const dx = d.target.x - d.source.x;
            const dy = d.target.y - d.source.y;
            const dr = Math.sqrt(dx * dx + dy * dy);
            return `M${d.source.x},${d.source.y}C${d.source.x + dr/3},${d.source.y} ${d.target.x - dr/3},${d.target.y} ${d.target.x},${d.target.y}`;
        });
}

// 处理画布右键菜单
function handleCanvasContextMenu(event) {
    // 阻止默认右键菜单
    event.preventDefault();
    
    // 如果点击在节点上，不处理
    if (event.target.closest('.node')) return;
    
    // 清除节点选择，因为是在空白处点击
    contextMenuNode = null;
    
    // 获取点击位置相对于SVG的坐标
    const svgRect = svg.node().getBoundingClientRect();
    const transform = d3.zoomTransform(svg.node());
    
    // 计算实际坐标（考虑缩放和平移）
    clickPosition.x = (event.clientX - svgRect.left - transform.x) / transform.k;
    clickPosition.y = (event.clientY - svgRect.top - transform.y) / transform.k;
    
    // 显示右键菜单
    showContextMenu(event.pageX, event.pageY, false);
}

// 显示右键菜单
function showContextMenu(x, y, isNode) {
    // 设置菜单位置
    contextMenu.style.left = `${x}px`;
    contextMenu.style.top = `${y}px`;
    contextMenu.style.display = 'block';
    
    // 根据点击位置（节点或空白处）显示/隐藏菜单项
    editNodeContextBtn.style.display = isNode ? 'flex' : 'none';
    deleteNodeContextBtn.style.display = isNode ? 'flex' : 'none';
}

// 隐藏右键菜单
function hideContextMenu() {
    contextMenu.style.display = 'none';
}

// 从右键菜单添加节点
function addNodeFromContextMenu() {
    if (contextMenuNode) {
        // 如果右键点击的是节点，添加子节点
        selectedNode = contextMenuNode;
        addChildNode();
    } else {
        // 如果右键点击的是空白处，添加到根节点或创建新的独立节点
        addNodeAtPosition(clickPosition.x, clickPosition.y);
    }
    
    // 隐藏右键菜单
    hideContextMenu();
}

// 在指定位置添加节点
function addNodeAtPosition(x, y) {
    nodeCounter++;
    
    // 创建新节点
    const newNode = {
        id: `node-${Date.now()}-${nodeCounter}`,
        text: '新节点',
        color: nodeColorInput.value,
        children: [],
        x: x,
        y: y
    };
    
    // 添加到根节点的子节点
    if (!mindmapData.children) {
        mindmapData.children = [];
    }
    
    mindmapData.children.push(newNode);
    
    // 重新渲染思维导图
    renderMindmap();
    
    // 选择新创建的节点
    selectNode(newNode);
}

// 选择节点
function selectNode(node) {
    selectedNode = node;
    
    // 更新节点选中状态样式
    container.selectAll('.node').classed('selected-node', false);
    container.select(`#node-${node.id}`).classed('selected-node', true);
    
    // 更新颜色选择器为当前节点颜色
    nodeColorInput.value = node.color || '#3498db';
}

// 取消选择节点
function deselectNode() {
    if (!dragging) {
        selectedNode = null;
        container.selectAll('.node').classed('selected-node', false);
    }
}

// 添加子节点
function addChildNode() {
    if (!selectedNode) {
        alert('请先选择一个节点');
        return;
    }
    
    nodeCounter++;
    
    // 如果节点没有children数组，添加一个
    if (!selectedNode.children) {
        selectedNode.children = [];
    }
    
    // 计算新节点位置 - 在父节点右侧
    const parentX = selectedNode.x;
    const parentY = selectedNode.y;
    const siblingCount = selectedNode.children.length;
    
    // 创建新节点
    const newNode = {
        id: `node-${Date.now()}-${nodeCounter}`,
        text: '新节点',
        color: nodeColorInput.value,
        children: [],
        // 新节点位置 - 水平偏移，垂直根据兄弟节点数量偏移
        x: parentX + 200,
        y: parentY + siblingCount * 80
    };
    
    // 添加到选中节点的子节点
    selectedNode.children.push(newNode);
    
    // 重新渲染思维导图
    renderMindmap();
    
    // 选择新创建的节点
    selectNode(newNode);
}

// 删除选中节点
function deleteSelectedNode() {
    if (!selectedNode || selectedNode.id === 'root') {
        alert('不能删除根节点或未选择节点');
        return;
    }
    
    // 递归寻找并删除节点
    function findAndRemoveNode(parent, nodeId) {
        if (!parent.children) return false;
        
        for (let i = 0; i < parent.children.length; i++) {
            if (parent.children[i].id === nodeId) {
                parent.children.splice(i, 1);
                return true;
            }
            
            if (findAndRemoveNode(parent.children[i], nodeId)) {
                return true;
            }
        }
        
        return false;
    }
    
    findAndRemoveNode(mindmapData, selectedNode.id);
    
    // 取消选择并重新渲染
    deselectNode();
    renderMindmap();
    
    // 如果是通过右键菜单删除，隐藏右键菜单
    hideContextMenu();
}

// 改变节点颜色
function changeNodeColor(color) {
    if (!selectedNode) {
        alert('请先选择一个节点');
        return;
    }
    
    selectedNode.color = color;
    
    // 直接更新节点颜色，而不是重新渲染
    container.select(`#node-${selectedNode.id}`)
        .select('.node-rect')
        .attr('fill', color)
        .attr('stroke', d3.color(color).darker(0.5));
}

// 打开节点编辑弹窗
function openNodeEditor() {
    if (!selectedNode) {
        alert('请先选择一个节点');
        return;
    }
    
    nodeTextArea.value = selectedNode.text;
    editNodeColorInput.value = selectedNode.color || '#3498db';
    
    nodeEditor.style.display = 'block';
    
    // 如果是通过右键菜单打开，隐藏右键菜单
    hideContextMenu();
}

// 保存节点编辑
function saveNodeEdit() {
    if (!selectedNode) return;
    
    const oldText = selectedNode.text;
    selectedNode.text = nodeTextArea.value;
    selectedNode.color = editNodeColorInput.value;
    
    // 选择当前节点进行更新
    const nodeSelection = container.select(`#node-${selectedNode.id}`);
    
    // 更新文本
    nodeSelection.select('.node-text')
        .text(selectedNode.text);
    
    // 更新矩形宽度和位置
    const rectWidth = Math.max(100, selectedNode.text.length * 10);
    nodeSelection.select('.node-rect')
        .attr('width', rectWidth)
        .attr('x', -rectWidth / 2)
        .attr('fill', selectedNode.color)
        .attr('stroke', d3.color(selectedNode.color).darker(0.5));
    
    // 只有在文本长度变化时才重新渲染
    if (oldText.length !== selectedNode.text.length) {
        renderMindmap();
    }
    
    nodeEditor.style.display = 'none';
}

// 导出思维导图为PNG
function exportAsPNG() {
    // 临时移除缩放和平移，以获得完整视图
    const transform = container.attr('transform');
    container.attr('transform', null);
    
    // 获取SVG元素
    const svgElement = document.querySelector('.mindmap-svg');
    
    // 使用html2canvas捕获SVG内容为图像
    html2canvas(svgElement, {
        backgroundColor: 'white',
        scale: 2,
        logging: false
    }).then(canvas => {
        // 恢复缩放和平移
        container.attr('transform', transform);
        
        // 将Canvas转换为图像URL
        const imgURL = canvas.toDataURL('image/png');
        
        // 创建下载链接
        const downloadLink = document.createElement('a');
        downloadLink.href = imgURL;
        downloadLink.download = '思维导图.png';
        
        // 触发下载
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
    });
}

// 打开保存文件弹窗
function openSaveFileModal() {
    fileModalTitle.textContent = '保存思维导图';
    loadFileSection.style.display = 'none';
    fileNameInput.value = '我的思维导图';
    fileModal.style.display = 'block';
}

// 打开加载文件弹窗
function openLoadFileModal() {
    fileModalTitle.textContent = '加载思维导图';
    loadFileSection.style.display = 'block';
    fileModal.style.display = 'block';
}

// 保存思维导图
function saveMindmap() {
    const fileName = fileNameInput.value || '我的思维导图';
    
    // 创建JSON数据
    const jsonData = JSON.stringify(mindmapData);
    
    // 创建Blob对象
    const blob = new Blob([jsonData], { type: 'application/json' });
    
    // 创建下载链接
    const downloadLink = document.createElement('a');
    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.download = `${fileName}.json`;
    
    // 触发下载
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    
    // 关闭弹窗
    fileModal.style.display = 'none';
}

// 加载思维导图
function loadMindmap() {
    const fileInput = loadFileInput;
    const file = fileInput.files[0];
    
    if (!file) {
        alert('请选择一个文件');
        return;
    }
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const jsonData = JSON.parse(e.target.result);
            mindmapData = jsonData;
            renderMindmap();
            fileModal.style.display = 'none';
        } catch (error) {
            alert('文件格式错误，请选择有效的思维导图文件');
        }
    };
    
    reader.readAsText(file);
}

// 清空画布，重新开始
function clearCanvas() {
    if (confirm('确定要清空画布吗？这将删除所有节点。')) {
        mindmapData = {
            id: "root",
            text: "中心主题",
            color: "#3498db",
            children: []
        };
        deselectNode();
        renderMindmap();
    }
}

// 关闭弹窗
function closeModal(modal) {
    modal.style.display = 'none';
}

// 处理文件操作确认
function handleFileAction() {
    if (fileModalTitle.textContent.includes('保存')) {
        saveMindmap();
    } else {
        loadMindmap();
    }
}

// 事件监听器
function setupEventListeners() {
    // 添加节点按钮
    addNodeBtn.addEventListener('click', addChildNode);
    
    // 删除节点按钮
    deleteNodeBtn.addEventListener('click', deleteSelectedNode);
    
    // 颜色选择器
    nodeColorInput.addEventListener('change', () => changeNodeColor(nodeColorInput.value));
    
    // 导出PNG按钮
    exportPngBtn.addEventListener('click', exportAsPNG);
    
    // 保存思维导图按钮
    saveMapBtn.addEventListener('click', openSaveFileModal);
    
    // 加载思维导图按钮
    loadMapBtn.addEventListener('click', openLoadFileModal);
    
    // 清空画布按钮
    clearMapBtn.addEventListener('click', clearCanvas);
    
    // 保存节点编辑按钮
    saveNodeBtn.addEventListener('click', saveNodeEdit);
    
    // 确认文件操作按钮
    confirmFileActionBtn.addEventListener('click', handleFileAction);
    
    // 在画布空白处点击取消选择节点
    svg.on('click', (event) => {
        if (!dragging) {
            deselectNode();
        }
    });
    
    // 关闭按钮
    closeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            closeModal(btn.closest('.modal'));
        });
    });
    
    // 点击弹窗外部关闭弹窗
    window.addEventListener('click', (event) => {
        if (event.target === nodeEditor) {
            closeModal(nodeEditor);
        }
        if (event.target === fileModal) {
            closeModal(fileModal);
        }
    });
    
    // 右键菜单事件监听器
    svg.node().addEventListener('contextmenu', handleCanvasContextMenu);
    
    // 右键菜单项点击事件
    addNodeHereBtn.addEventListener('click', addNodeFromContextMenu);
    editNodeContextBtn.addEventListener('click', openNodeEditor);
    deleteNodeContextBtn.addEventListener('click', deleteSelectedNode);
    
    // 点击其他地方关闭右键菜单
    document.addEventListener('click', hideContextMenu);
    
    // 按ESC键关闭右键菜单
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            hideContextMenu();
        }
    });
}

// 初始化应用
function init() {
    initMindmap();
    setupEventListeners();
}

// 当页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init);

// 保存内联编辑
function saveInlineEdit(node, nodeText, foreignObject, nodeData, newText) {
    // 删除输入框
    foreignObject.remove();
    
    // 更新节点数据和显示
    nodeData.text = newText;
    
    // 更新文本
    nodeText.text(newText).style('display', null);
    
    // 更新矩形宽度和位置
    const rectWidth = Math.max(100, newText.length * 10);
    node.select('.node-rect')
        .attr('width', rectWidth)
        .attr('x', -rectWidth / 2);
    
    // 更新连接线
    updateConnectionsImmediate();
}

// 取消内联编辑
function cancelInlineEdit(node, nodeText, foreignObject) {
    // 删除输入框
    foreignObject.remove();
    
    // 恢复显示原始文本
    nodeText.style('display', null);
} 