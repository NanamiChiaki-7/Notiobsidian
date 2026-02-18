// static/js/websocket.js - 完整修复版

class WebSocketClient {
    constructor() {
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = Infinity;
        this.reconnectDelay = 1000;
        this.isConnected = false;
        this.messageHandlers = new Map();
        this.notificationHandlers = new Set();
        
        // 已发送通知的去重缓存
        this.sentNotifications = new Set();
        this.maxCacheSize = 100;
        
        this.connect();
        this.setupNotificationPermission();
        this.setupGlobalSync();
    }
    
    connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        console.log('🔌 WebSocket 连接中:', wsUrl);
        
        try {
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('✅ WebSocket 连接成功');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.reconnectDelay = 1000;
                this.startPing();
                this.trigger('connected');
                this.syncAllNotices();
            };
            
            this.ws.onmessage = (e) => {
                try {
                    const data = JSON.parse(e.data);
                    this.handleMessage(data);
                } catch (err) {
                    console.error('❌ 解析消息失败:', err);
                }
            };
            
            this.ws.onclose = () => {
                console.log('🔌 WebSocket 连接关闭');
                this.isConnected = false;
                this.ws = null;
                this.trigger('disconnected');
                this.reconnect();
            };
            
            this.ws.onerror = (error) => {
                console.error('❌ WebSocket 错误:', error);
                this.trigger('error', error);
            };
            
        } catch (error) {
            console.error('❌ WebSocket 创建失败:', error);
            this.reconnect();
        }
    }
    
    // ========== 修复1：添加 startPing 方法 ==========
    startPing() {
        setInterval(() => {
            if (this.isConnected && this.ws) {
                this.send({ type: 'ping' });
            }
        }, 30000);
    }
    
    // ========== 修复2：添加 setupGlobalSync 方法 ==========
    setupGlobalSync() {
        // 监听 globalNotices 的变化
        if (window.globalNotices) {
            const originalPush = Array.prototype.push;
            Array.prototype.push = function(...items) {
                const result = originalPush.apply(this, items);
                if (this === window.globalNotices && window.wsClient?.isConnected) {
                    window.wsClient.send({
                        type: 'new_notices',
                        notices: items
                    });
                }
                return result;
            };
        }
        
        // 每30秒自动同步一次
        setInterval(() => {
            if (this.isConnected) {
                this.syncAllNotices();
            }
        }, 30000);
    }
    
    // ========== 修复3：添加 handleMessage 方法 ==========
    handleMessage(data) {
        switch (data.type) {
            case 'connected':
                console.log('✅ WebSocket 认证成功');
                break;
                
            case 'notification':
                this.handleNotification(data.data);
                break;
                
            case 'pong':
                // ping响应，忽略
                break;
                
            default:
                console.log('📨 收到消息:', data);
        }
        
        this.trigger('message', data);
    }
    
    // ========== 修复4：添加 syncAllNotices 方法 ==========
    syncAllNotices() {
        if (!this.isConnected) return;
        
        if (window.globalNotices && window.globalNotices.length > 0) {
            this.send({
                type: 'sync_notices',
                notices: window.globalNotices
            });
            console.log(`📤 同步 ${window.globalNotices.length} 条通知到服务器`);
        }
        
        if (window.calendarEvents && window.calendarEvents.length > 0) {
            this.send({
                type: 'sync_events',
                events: window.calendarEvents
            });
        }
    }
    
    // ========== 修复5：添加 send 方法 ==========
    send(data) {
        if (this.isConnected && this.ws) {
            this.ws.send(JSON.stringify(data));
        } else {
            console.warn('⚠️ WebSocket 未连接，无法发送消息');
        }
    }
    
    // ========== 修复6：添加 reconnect 方法 ==========
    reconnect() {
        this.reconnectAttempts++;
        const delay = Math.min(this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1), 30000);
        
        console.log(`🔄 ${Math.round(delay)}ms 后尝试重连 (${this.reconnectAttempts})`);
        
        setTimeout(() => {
            if (!this.isConnected) {
                console.log('🔄 正在重连...');
                this.connect();
            }
        }, delay);
    }
    
    // ========== 修复7：添加 trigger 方法 ==========
    trigger(event, data) {
        if (this.messageHandlers.has(event)) {
            this.messageHandlers.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (err) {
                    console.error(`❌ 处理器失败 (${event}):`, err);
                }
            });
        }
    }
    
    // ========== 修复8：添加 on/off 方法 ==========
    on(event, callback) {
        if (!this.messageHandlers.has(event)) {
            this.messageHandlers.set(event, new Set());
        }
        this.messageHandlers.get(event).add(callback);
    }
    
    off(event, callback) {
        if (this.messageHandlers.has(event)) {
            this.messageHandlers.get(event).delete(callback);
        }
    }
    
    // ========== 通知去重方法 ==========
    isNotificationDuplicate(notification) {
        const id = notification.id || 
                  `${notification.title}-${notification.body}-${notification.timestamp}`;
        
        if (this.sentNotifications.has(id)) {
            return true;
        }
        
        this.sentNotifications.add(id);
        
        if (this.sentNotifications.size > this.maxCacheSize) {
            const iterator = this.sentNotifications.values();
            this.sentNotifications.delete(iterator.next().value);
        }
        
        return false;
    }
    
    // ========== 处理通知 ==========
    handleNotification(notification) {
        if (this.isNotificationDuplicate(notification)) {
            console.log('⏭️ 重复通知已跳过:', notification.title);
            return;
        }
        
        console.log('📨 收到通知:', notification);
        
        this.notificationHandlers.forEach(handler => {
            try {
                handler(notification);
            } catch (err) {
                console.error('❌ 通知处理器失败:', err);
            }
        });
        
        this.showNotification(notification);
        
        if (!document.hidden) {
            this.showInPageNotification(notification);
        }
    }
    
    // ========== 通知权限 ==========
    async setupNotificationPermission() {
        if (!('Notification' in window)) {
            console.warn('⚠️ 浏览器不支持通知');
            return;
        }
        
        if (Notification.permission === 'default') {
            const permission = await Notification.requestPermission();
            console.log('🔔 通知权限:', permission);
        }
    }
    
    // ========== 系统通知 ==========
    showNotification(notification) {
        if (Notification.permission === 'granted') {
            new Notification(notification.title, {
                body: notification.body,
                icon: '/static/favicon.ico',
                badge: '/static/favicon.ico',
                tag: notification.id || Date.now(),
                requireInteraction: false,
                silent: false
            });
        }
    }
    
    // ========== 页面内通知 ==========
    showInPageNotification(notification) {
        let container = document.getElementById('ws-notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'ws-notification-container';
            container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 9999;
                max-width: 350px;
            `;
            document.body.appendChild(container);
        }
        
        const notif = document.createElement('div');
        notif.style.cssText = `
            background: white;
            border-left: 4px solid #6366f1;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            padding: 16px;
            margin-bottom: 10px;
            animation: slideIn 0.3s ease;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: start;
            justify-content: space-between;
        `;
        
        notif.onmouseenter = () => {
            notif.style.transform = 'translateX(-2px)';
            notif.style.boxShadow = '0 6px 16px rgba(0,0,0,0.2)';
        };
        
        notif.onmouseleave = () => {
            notif.style.transform = 'none';
            notif.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        };
        
        notif.onclick = (e) => {
            if (e.target.tagName !== 'BUTTON' && notification.url) {
                window.location.href = notification.url;
            }
        };
        
        const content = document.createElement('div');
        content.style.flex = '1';
        content.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 6px; color: #1f2937;">${notification.title}</div>
            <div style="font-size: 13px; color: #6b7280;">${notification.body}</div>
            <div style="font-size: 11px; color: #9ca3af; margin-top: 8px;">
                ${new Date().toLocaleTimeString()}
            </div>
        `;
        
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '×';
        closeBtn.style.cssText = `
            background: none;
            border: none;
            color: #9ca3af;
            font-size: 20px;
            cursor: pointer;
            padding: 0 4px;
            margin-left: 12px;
            transition: color 0.2s;
        `;
        closeBtn.onmouseenter = () => { closeBtn.style.color = '#ef4444'; };
        closeBtn.onmouseleave = () => { closeBtn.style.color = '#9ca3af'; };
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            notif.remove();
        };
        
        notif.appendChild(content);
        notif.appendChild(closeBtn);
        container.appendChild(notif);
        
        setTimeout(() => {
            if (notif.parentNode) {
                notif.style.animation = 'slideOut 0.3s ease';
                setTimeout(() => notif.remove(), 300);
            }
        }, 3000);
    }
    
    // ========== 通知处理器注册 ==========
    onNotification(handler) {
        this.notificationHandlers.add(handler);
        return () => this.notificationHandlers.delete(handler);
    }
}

// ========== 全局单例 ==========
window.wsClient = new WebSocketClient();

// ========== 添加CSS动画 ==========
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            opacity: 0;
            transform: translateX(100px);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
    
    @keyframes slideOut {
        from {
            opacity: 1;
            transform: translateX(0);
        }
        to {
            opacity: 0;
            transform: translateX(100px);
        }
    }
`;
document.head.appendChild(style);

console.log('✅ WebSocket客户端已初始化');