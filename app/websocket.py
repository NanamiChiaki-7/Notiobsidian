# app/websocket.py
from threading import Lock, Timer
from datetime import datetime, timedelta
import json
import re
import sqlite3
import os

# 从socket模块导入sock实例
from app.socket import sock

clients = set()
clients_lock = Lock()
check_timer = None

# 存储所有活动的通知
active_notices = []
active_events = []

# 通知缓存，用于去重
sent_notifications_cache = set()
max_cache_size = 100

# 直接使用数据库路径
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'nation_pro_v3.db')

class NotificationChecker:
    def __init__(self):
        self.interval = 1  # 1秒检查一次
        self.running = True
        self.start()
    
    def start(self):
        """启动定时检查"""
        self.check()
    
    def get_db_connection(self):
        """直接获取数据库连接"""
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        return conn
    
    def extract_calendar_events(self):
        """直接从数据库提取日历事件"""
        events = []
        try:
            conn = self.get_db_connection()
            cursor = conn.cursor()
            
            cursor.execute('SELECT id, title, content FROM page')
            pages = cursor.fetchall()
            
            pattern = r'@(\d{4}[.\-]\d{2}[.\-]\d{2})(?:\s+(\d{1,2}:\d{2})(?:-(\d{1,2}:\d{2}))?)?\s*\[(.*?)(?:\|(.*?))?\]'
            
            for page in pages:
                content = page['content'] or ''
                matches = re.findall(pattern, content)
                
                for date_str, start_time, end_time, event_name, reminder_rule in matches:
                    clean_date = date_str.replace('.', '-')
                    events.append({
                        'id': page['id'],
                        'title': event_name,
                        'date': clean_date,
                        'start': start_time if start_time else None,
                        'end': end_time if end_time else None,
                        'source_page': page['title'],
                        'reminder': reminder_rule.strip() if reminder_rule else None
                    })
            
            conn.close()
        except Exception:
            pass
        
        return events
    
    def extract_notices(self):
        """直接从数据库提取通知"""
        notices = []
        try:
            conn = self.get_db_connection()
            cursor = conn.cursor()
            
            cursor.execute('SELECT id, title, content FROM page')
            pages = cursor.fetchall()
            
            pattern = r'\{\{notice\|(.*?)\|(.*?)\}\}'
            
            for page in pages:
                content = page['content'] or ''
                matches = re.findall(pattern, content)
                
                for condition, content_text in matches:
                    notices.append({
                        'page_id': page['id'],
                        'source_page': page['title'],
                        'condition': condition.strip(),
                        'content': content_text.strip()
                    })
            
            conn.close()
        except Exception:
            pass
        
        return notices
    
    def check(self):
        """检查所有提醒"""
        if not self.running:
            return
        
        try:
            now = datetime.now()
            
            # 1. 检查日历事件 - 合并数据库和实时同步的
            db_events = self.extract_calendar_events()
            all_events = db_events + active_events
            
            for evt in all_events:
                if not evt.get('reminder'):
                    continue
                    
                try:
                    event_time = datetime.strptime(f"{evt['date']} {evt['start']}", '%Y-%m-%d %H:%M')
                    offset = self.parse_duration(evt['reminder'])
                    trigger_time = event_time - timedelta(milliseconds=offset)
                    
                    if trigger_time <= now < event_time:
                        broadcast_notification(
                            title=f"📅 {evt['title']}",
                            body=f"将在 {evt['reminder']} 后开始",
                            url=f"/p/{evt['id']}"
                        )
                except Exception:
                    pass
            
            # 2. 检查Notice组件 - 合并数据库和实时同步的
            db_notices = self.extract_notices()
            all_notices = db_notices + active_notices
            
            for notice in all_notices:
                try:
                    if self.check_condition(notice['condition'], now):
                        broadcast_notification(
                            title=f"🔔 {notice['content']}",
                            body=f"来自: {notice.get('source_page', '系统')}",
                            url=f"/p/{notice['page_id']}"
                        )
                except Exception:
                    pass
                    
        except Exception:
            pass
        
        # 继续下一次检查
        if self.running:
            global check_timer
            check_timer = Timer(self.interval, self.check)
            check_timer.daemon = True
            check_timer.start()
    
    def stop(self):
        """停止检查"""
        self.running = False
        global check_timer
        if check_timer:
            check_timer.cancel()
            check_timer = None
    
    def parse_duration(self, str_duration):
        """解析持续时间"""
        if not str_duration or not isinstance(str_duration, str):
            return 0
        
        str_duration = str_duration.strip().lower()
        match = re.match(r'^(\d+(?:\.\d+)?)\s*([dhms])?', str_duration)
        if not match:
            return 0
        
        num = float(match.group(1))
        unit = match.group(2) or 'm'
        
        multipliers = {'d': 86400000, 'h': 3600000, 'm': 60000, 's': 1000}
        return int(num * multipliers.get(unit, 60000))
    
    def check_condition(self, cond, now):
        """检查条件"""
        if not cond or not now:
            return False
        
        # 格式化时间
        year = now.year
        month = str(now.month).zfill(2)
        day = str(now.day).zfill(2)
        hours = str(now.hour).zfill(2)
        minutes = str(now.minute).zfill(2)
        seconds = str(now.second).zfill(2)
        
        current_time = f"{hours}:{minutes}"
        current_time_with_seconds = f"{hours}:{minutes}:{seconds}"
        current_full = f"{year}-{month}-{day} {hours}:{minutes}"
        current_full_with_seconds = f"{year}-{month}-{day} {hours}:{minutes}:{seconds}"
        
        # 绝对时间
        if cond in [current_full, f"time {current_full}", current_full_with_seconds, f"time {current_full_with_seconds}"]:
            return True
        
        # 每日重复
        if cond.startswith('daily '):
            time_part = cond[6:].strip()
            if time_part == current_time_with_seconds:
                return True
            if time_part == current_time and seconds == '00':
                return True
        
        # 间隔重复 - 灵活版本
        if cond.startswith('every '):
            interval = cond[6:].strip()
            
            # 秒级: every 5s, every 10s, every 30s
            sec_match = re.match(r'^(\d+)s$', interval)
            if sec_match:
                interval_sec = int(sec_match.group(1))
                if int(seconds) % interval_sec == 0:
                    return True
            
            # 分钟级: every 1m, every 5m, every 15m
            min_match = re.match(r'^(\d+)m$', interval)
            if min_match:
                interval_min = int(min_match.group(1))
                if int(minutes) % interval_min == 0 and seconds == '00':
                    return True
            
            # 小时级: every 1h, every 2h, every 6h
            hour_match = re.match(r'^(\d+)h$', interval)
            if hour_match:
                interval_hour = int(hour_match.group(1))
                if int(hours) % interval_hour == 0 and minutes == '00' and seconds == '00':
                    return True
        
        return False

# 全局通知管理器
notification_checker = NotificationChecker()

@sock.route('/ws')
def websocket_handler(ws):
    """WebSocket连接处理"""
    client_id = id(ws)
    
    with clients_lock:
        clients.add(ws)
    
    # 发送连接成功消息
    ws.send(json.dumps({
        'type': 'connected',
        'message': 'WebSocket连接成功',
        'timestamp': datetime.now().isoformat()
    }))
    
    try:
        while True:
            message = ws.receive()
            if message:
                try:
                    data = json.loads(message)
                    handle_client_message(ws, data)
                except Exception:
                    pass
    except Exception:
        pass
    finally:
        with clients_lock:
            clients.remove(ws)

def handle_client_message(ws, data):
    """处理客户端发送的消息"""
    global active_notices, active_events, sent_notifications_cache
    
    msg_type = data.get('type')
    
    if msg_type == 'ping':
        ws.send(json.dumps({'type': 'pong'}))
        
    elif msg_type == 'sync_notices':
        new_notices = data.get('notices', [])
        active_notices.extend(new_notices)
        notification_checker.check()
        
    elif msg_type == 'sync_events':
        new_events = data.get('events', [])
        active_events.extend(new_events)
        
    elif msg_type == 'new_notices':
        new_notices = data.get('notices', [])
        active_notices.extend(new_notices)
        notification_checker.check()
        
    elif msg_type == 'new_notice':
        notice = data.get('data', {})
        if notice:
            active_notices.append(notice)
            notification_checker.check()
    
    else:
        pass

def broadcast_notification(title, body, url=None):
    """广播通知给所有客户端"""
    if not clients:
        return
    
    # 生成通知ID用于去重
    notification_id = f"{title}_{body}_{datetime.now().strftime('%Y%m%d%H%M')}"
    
    # 每分钟只发一次相同通知
    global sent_notifications_cache
    if notification_id in sent_notifications_cache:
        return
    
    # 添加到缓存
    sent_notifications_cache.add(notification_id)
    if len(sent_notifications_cache) > max_cache_size:
        sent_notifications_cache.pop()
    
    data = {
        'type': 'notification',
        'data': {
            'title': title,
            'body': body,
            'url': url,
            'timestamp': datetime.now().isoformat(),
            'id': notification_id
        }
    }
    
    with clients_lock:
        disconnected = set()
        for ws in clients:
            try:
                ws.send(json.dumps(data))
            except Exception:
                disconnected.add(ws)
        
        for ws in disconnected:
            clients.remove(ws)