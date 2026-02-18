# app/routes/websocket.py
from flask import Blueprint, render_template
from app.websocket import sock

bp = Blueprint('websocket', __name__)

@bp.route('/notification-test')
def notification_test():
    """通知测试页面"""
    return render_template('notification_test.html')