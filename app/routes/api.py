# app/routes/api.py
from flask import Blueprint, request, jsonify, url_for, session
from app import db
from app.models.page import Page, DailyLog, Variable, VariableValue
from datetime import datetime, timedelta
from werkzeug.utils import secure_filename
import json
import re
import os
from icalendar import Calendar as ICalCalendar, Event as ICalEvent

bp = Blueprint('api', __name__, url_prefix='/api')

# ========== 页面管理 ==========
@bp.route('/page/create', methods=['POST'])
def create_page():
    if 'logged_in' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    p_type = request.json.get('type', 'doc')
    icon_map = {'doc': '📄', 'calendar': '🗓️', 'tracker': '⏱️', 'graph': '🕸️'}
    title_map = {'doc': 'new file', 'calendar': 'calendar', 'tracker': 'tracker', 'graph': 'relation-graph'}
    
    new_page = Page(
        title=title_map.get(p_type, 'Page'),
        icon=icon_map.get(p_type, '📄'),
        page_type=p_type
    )
    db.session.add(new_page)
    db.session.commit()
    return jsonify({'id': new_page.id, 'status': 'success'})

@bp.route('/page/<int:page_id>/update', methods=['POST'])
def update_page(page_id):
    if 'logged_in' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    page = db.session.get(Page, page_id)
    if not page:
        return jsonify({'error': 'Page not found'}), 404
        
    data = request.json
    
    if 'title' in data: 
        page.title = data['title']
    
    if 'icon' in data:
        page.icon = data['icon']
        # 如果图标包含 '||'，自动清空封面（隐藏模式）
        if '||' in data['icon']:
            page.cover = ''
            print(f"🔒 页面 {page_id} 进入隐藏模式，图标: {data['icon']}，封面已清除")
    
    if 'cover' in data: 
        page.cover = data['cover']
    
    if 'content' in data: 
        page.content = data['content']
        # 触发变量提取逻辑
        process_page_variables(page)
        
    if 'graph_config' in data:
        if isinstance(data['graph_config'], dict):
            page.graph_config = json.dumps(data['graph_config'])
        else:
            page.graph_config = data['graph_config']

    db.session.commit()
    return jsonify({'status': 'success'})

@bp.route('/page/<int:page_id>/delete', methods=['POST'])
def delete_page(page_id):
    if 'logged_in' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    page = db.session.get(Page, page_id)
    if page:
        db.session.delete(page)
        db.session.commit()
        return jsonify({'status': 'success'})
    return jsonify({'error': 'Not found'}), 404

# ========== 核心逻辑：变量提取器 ==========
def process_page_variables(page):
    """
    从页面内容中提取 {{calc|var_name: expression}}
    并更新 VariableValue 表
    """
    content = page.content or ""
    
    # 1. 查找所有 calc 标签: {{calc|calc_cost: 100+20}}
    # 格式: {{calc | 变量名 : 表达式}}
    pattern = r'\{\{calc\|(calc_\w+):([0-9\.\+\-\*\/\(\)\s]+)\}\}'
    matches = re.findall(pattern, content)
    
    # 2. 准备数据容器 { 'calc_cost': 120.0, 'calc_weight': 60.0 }
    extracted_data = {}
    
    for var_name, expression in matches:
        try:
            # 简单的安全计算，仅允许基础数学运算
            # 注意：eval 在生产环境有风险，但在个人工具且限制了 regex 字符集的情况下尚可
            # 更好的做法是使用 simpleeval 库
            value = float(eval(expression, {"__builtins__": None}, {}))
            
            if var_name in extracted_data:
                extracted_data[var_name] += value
            else:
                extracted_data[var_name] = value
        except Exception as e:
            print(f"Calculation error for {var_name} in page {page.id}: {e}")
            continue

    # 3. 更新数据库
    # 先清除该页面所有的旧变量值记录（覆盖更新模式）
    VariableValue.query.filter_by(page_id=page.id).delete()
    
    # 写入新记录
    for var_name, total_value in extracted_data.items():
        # 检查变量是否已定义，如果未定义，是否要自动创建？
        # 策略：必须先在管理面板创建变量，否则忽略（防止拼写错误产生垃圾数据）
        # 或者：为了方便，这里先只处理已存在的变量
        var_def = Variable.query.filter_by(name=var_name).first()
        
        if var_def:
            new_val = VariableValue(
                variable_id=var_def.id,
                page_id=page.id,
                value=total_value
            )
            db.session.add(new_val)
    
    # 注意：这里不需要 commit，因为外层 update_page 会统一 commit

# ========== 变量管理接口 ==========
@bp.route('/vars/list', methods=['GET'])
def list_variables():
    if 'logged_in' not in session: 
        return jsonify([]), 401
    vars = Variable.query.all()
    return jsonify([{
        'id': v.id,
        'name': v.name,
        'display_name': v.display_name or v.name,
        'unit': v.unit,
        'color': v.color
    } for v in vars])

@bp.route('/vars/create', methods=['POST'])
def create_variable():
    if 'logged_in' not in session: 
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    name = data.get('name')
    
    # 强制加盐前缀
    if not name.startswith('calc_'):
        name = 'calc_' + name
        
    if Variable.query.filter_by(name=name).first():
        return jsonify({'error': 'Variable already exists'}), 400
        
    new_var = Variable(
        name=name,
        display_name=data.get('display_name', name),
        unit=data.get('unit', ''),
        color=data.get('color', '#4F46E5'),
        chart_type=data.get('chart_type', 'line')
    )
    db.session.add(new_var)
    db.session.commit()
    return jsonify({'status': 'success', 'name': new_var.name})



# ========== 文件上传 ==========
@bp.route('/upload', methods=['POST'])
def upload_file():
    if 'logged_in' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
        
    if file:
        filename = secure_filename(file.filename)
        # 简单的时间戳重命名防止覆盖
        filename = f"{int(datetime.now().timestamp())}_{filename}"
        upload_folder = os.path.join('static', 'uploads')
        if not os.path.exists(upload_folder):
            os.makedirs(upload_folder)
            
        file.save(os.path.join(upload_folder, filename))
        return jsonify({'url': url_for('static', filename=f'uploads/{filename}')})
    
    return jsonify({'error': 'Unknown error'}), 500


# ========== 图谱管理 ==========
@bp.route('/graph/connect', methods=['POST'])
def graph_connect():
    if 'logged_in' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    data = request.json
    source_id = data.get('source_id')
    target_title = data.get('target_title')
    
    page = db.session.get(Page, source_id)
    if not page or not target_title:
        return jsonify({'error': 'Invalid data'}), 400
    
    if f"[[@{target_title}]]" not in page.content:
        page.content = (page.content or "") + f"\n\n[[@{target_title}]]"
        db.session.commit()
        
    return jsonify({'status': 'success', 'content': page.content})

@bp.route('/graph/disconnect', methods=['POST'])
def graph_disconnect():
    if 'logged_in' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    data = request.json
    source_id = data.get('source_id')
    target_title = data.get('target_title')
    
    page = db.session.get(Page, source_id)
    if not page:
        return jsonify({'error': 'Page not found'}), 404
    
    pattern = re.compile(rf'\[\[@{re.escape(target_title)}\]\]')
    page.content = pattern.sub('', page.content)
    db.session.commit()
    
    return jsonify({'status': 'success', 'content': page.content})

@bp.route('/page/<int:page_id>/save_graph', methods=['POST'])
def save_graph_config(page_id):
    if 'logged_in' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    page = db.session.get(Page, page_id)
    page.graph_config = json.dumps(request.json)
    db.session.commit()
    return jsonify({'status': 'success'})

# ========== 日历导入导出 ==========
@bp.route('/calendar/import', methods=['POST'])
def import_ics():
    if 'logged_in' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    if 'file' not in request.files:
        return jsonify({'error': 'No file'}), 400
    file = request.files['file']
    
    try:
        cal = ICalCalendar.from_ical(file.read())
        content_lines = ["# Imported Calendar Events\n"]
        
        for component in cal.walk():
            if component.name == "VEVENT":
                summary = component.get('summary')
                dtstart = component.get('dtstart').dt
                
                if isinstance(dtstart, datetime):
                    d_str = dtstart.strftime('%Y.%m.%d')
                    t_str = dtstart.strftime('%H:%M')
                    line = f"@{d_str} {t_str} [{summary}]"
                else:
                    d_str = dtstart.strftime('%Y.%m.%d')
                    line = f"@{d_str} [{summary}]"
                
                content_lines.append(line)
        
        new_page = Page(
            title=f"Imported-{datetime.now().strftime('%m%d')}",
            page_type="doc",
            icon="📥",
            content="\n\n".join(content_lines)
        )
        db.session.add(new_page)
        db.session.commit()
        
        return jsonify({'status': 'success', 'page_id': new_page.id})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/calendar/export')
def export_ics():
    if 'logged_in' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    from app.utils.helpers import extract_calendar_events
    from flask import make_response
    
    events = extract_calendar_events()
    cal = ICalCalendar()
    cal.add('prodid', '-//Nation Pro Calendar//mxm.dk//')
    cal.add('version', '2.0')
    
    for e in events:
        event = ICalEvent()
        event.add('summary', f"{e['title']} (from {e['source_page']})")
        
        start_str = f"{e['date']} {e.get('start', '00:00')}"
        dt_start = datetime.strptime(start_str, '%Y-%m-%d %H:%M')
        event.add('dtstart', dt_start)
        
        if e.get('end'):
            end_str = f"{e['date']} {e.get('end')}"
            dt_end = datetime.strptime(end_str, '%Y-%m-%d %H:%M')
            event.add('dtend', dt_end)
        else:
            event.add('dtend', dt_start + timedelta(hours=1))
            
        cal.add_component(event)
        
    response = make_response(cal.to_ical())
    response.headers["Content-Disposition"] = "attachment; filename=calendar.ics"
    response.headers["Content-Type"] = "text/calendar"
    return response
    
#=====================自定义变量============================
@bp.route('/vars/<int:var_id>/stats', methods=['GET'])
def get_variable_stats(var_id):
    """
    获取变量的统计数据，用于前端绘图
    返回:
    1. timeline: 按日期聚合的总值 (折线图)
    2. distribution: 按页面聚合的总值 (饼图)
    """
    if 'logged_in' not in session: return jsonify({'error': 'Unauthorized'}), 401
    
    var = db.session.get(Variable, var_id)
    if not var: return jsonify({'error': 'Variable not found'}), 404
    
    # 1. 获取所有记录
    values = VariableValue.query.filter_by(variable_id=var_id).all()
    
    # 2. 聚合逻辑 - 时间轴 (Line Chart)
    # 按更新日期的 "YYYY-MM-DD" 聚合
    timeline_map = {}
    
    # 3. 聚合逻辑 - 分布 (Pie Chart)
    # 按页面标题聚合
    dist_map = {}
    
    for v in values:
        # 时间聚合
        date_str = v.updated_at.strftime('%Y-%m-%d')
        if date_str not in timeline_map: timeline_map[date_str] = 0
        timeline_map[date_str] += v.value
        
        # 分布聚合
        page_title = v.page.title if v.page else "Unknown"
        if page_title not in dist_map: dist_map[page_title] = 0
        dist_map[page_title] += v.value
        
    # 排序并格式化
    sorted_dates = sorted(timeline_map.keys())
    timeline_data = {
        'labels': sorted_dates,
        'values': [timeline_map[d] for d in sorted_dates]
    }
    
    # 饼图数据 (取前10个来源，其他的合并为 Others)
    sorted_dist = sorted(dist_map.items(), key=lambda x: x[1], reverse=True)
    pie_labels = [x[0] for x in sorted_dist[:10]]
    pie_values = [x[1] for x in sorted_dist[:10]]
    
    if len(sorted_dist) > 10:
        others_val = sum([x[1] for x in sorted_dist[10:]])
        pie_labels.append('Others')
        pie_values.append(others_val)
        
    return jsonify({
        'variable': {
            'name': var.display_name,
            'unit': var.unit,
            'color': var.color
        },
        'timeline': timeline_data,
        'distribution': {'labels': pie_labels, 'values': pie_values}
    })
    
@bp.route('/vars/<int:var_id>/delete', methods=['POST'])
def delete_variable(var_id):
    """
    删除变量及其关联的所有数值记录
    """
    if 'logged_in' not in session: return jsonify({'error': 'Unauthorized'}), 401
    
    var = db.session.get(Variable, var_id)
    if not var:
        return jsonify({'error': 'Variable not found'}), 404
        
    try:
        # 由于在 models 中可能没有设置 cascade delete，我们手动清理关联数据
        VariableValue.query.filter_by(variable_id=var_id).delete()
        db.session.delete(var)
        db.session.commit()
        return jsonify({'status': 'success'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

#========侧边栏管理==========
@bp.route('/sidebar/toggle_pin/<int:page_id>', methods=['POST'])
def toggle_pin(page_id):
    """切换置顶状态"""
    if 'logged_in' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    page = db.session.get(Page, page_id)
    if page:
        page.is_pinned = not page.is_pinned
        db.session.commit()
        return jsonify({
            'status': 'success', 
            'is_pinned': page.is_pinned
        })
    return jsonify({'error': 'Page not found'}), 404
    
#=======tracker=======
# app/routes/api.py - 添加 tracker 相关接口

@bp.route('/tracker/day', methods=['GET'])
def get_tracker_day():
    """获取指定日期的追踪数据"""
    if 'logged_in' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    date_str = request.args.get('date')
    if not date_str:
        return jsonify({'error': 'Date required'}), 400
    
    try:
        target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
    except:
        return jsonify({'error': 'Invalid date'}), 400
    
    log = DailyLog.query.filter_by(date=target_date).first()
    
    return jsonify({
        'date': date_str,
        'content': log.content if log else '{}'
    })

@bp.route('/tracker/save', methods=['POST'])
def save_tracker_data():
    """保存追踪数据（时间和日记）"""
    if 'logged_in' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    data = request.json
    date_str = data.get('date')
    time_data = data.get('time_data', {})
    diary = data.get('diary', '')
    
    try:
        target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
    except:
        return jsonify({'error': 'Invalid date'}), 400
    
    # 合并数据为JSON
    content = json.dumps({
        'time_data': time_data,
        'diary': diary
    }, ensure_ascii=False)
    
    # 保存到数据库
    log = DailyLog.query.filter_by(date=target_date).first()
    if not log:
        log = DailyLog(date=target_date)
        db.session.add(log)
    
    log.content = content
    db.session.commit()
    
    return jsonify({'status': 'success'})