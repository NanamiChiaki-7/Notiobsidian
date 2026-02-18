# app/routes/main.py
from flask import Blueprint, render_template, request, redirect, url_for, session, jsonify
from app import db
from app.models.page import Page, DailyLog, Variable
from app.utils.helpers import parse_content_meta, extract_calendar_events, extract_notices
from datetime import datetime, date
import json

bp = Blueprint('main', __name__)

@bp.route('/')
def index():
    if 'logged_in' not in session:
        return redirect(url_for('auth.login'))
    
    first = Page.query.first()
    if not first:
        from app.utils.helpers import init_db_data
        init_db_data()
        first = Page.query.first()
    return redirect(url_for('main.view_page', page_id=first.id))

@bp.route('/p/<int:page_id>')
def view_page(page_id):
    if 'logged_in' not in session:
        return redirect(url_for('auth.login'))
    
    pages = Page.query.order_by(Page.created_at).all()
    current_page = db.session.get(Page, page_id)
    if not current_page:
        return redirect(url_for('main.index'))
    
    nodes, edges, page_tags_map = parse_content_meta(pages)
    cal_events = extract_calendar_events()
    global_notices = extract_notices()
    
    # 获取所有定义的变量供前端选择
    all_vars = Variable.query.all()
    vars_json = json.dumps([{
        'name': v.name, 
        'display_name': v.display_name, 
        'unit': v.unit
    } for v in all_vars])
    
    context = {
        'pages': pages,
        'current_page': current_page,
        'graph_data': json.dumps({'nodes': nodes, 'edges': edges}),
        'graph_config': current_page.graph_config if current_page.page_type == 'graph' else '{}',
        'all_files_meta': json.dumps(nodes),
        'calendar_events': json.dumps(cal_events),
        'global_notices': json.dumps(global_notices),
        'all_variables': vars_json,
    }

    if current_page.page_type == 'calendar':
        context['calendar_events'] = json.dumps(extract_calendar_events())

    if current_page.page_type == 'tracker':
        target_date_str = request.args.get('date', date.today().strftime('%Y-%m-%d'))
        try:
            target_date = datetime.strptime(target_date_str, '%Y-%m-%d').date()
        except:
            target_date = date.today()
        log = DailyLog.query.filter_by(date=target_date).first()
        context['tracker_date'] = target_date_str
        context['tracker_content'] = log.content if log else ""

    return render_template('index.html', **context)