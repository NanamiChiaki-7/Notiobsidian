# app/__init__.py
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from app.socket import sock  # 从socket模块导入
import os

db = SQLAlchemy()

def create_app():
    app = Flask(__name__, 
                static_folder='../static',
                template_folder='../templates')
    
    app.secret_key = os.environ.get('SECRET_KEY', 'nation_secret_key')
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///nation_pro_v3.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['UPLOAD_FOLDER'] = os.path.join('static', 'uploads')
    
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    
    db.init_app(app)
    
    # 初始化WebSocket
    sock.init_app(app)
    
    # 注册蓝图
    from app.routes import main, api, auth
    app.register_blueprint(main.bp)
    app.register_blueprint(api.bp)
    app.register_blueprint(auth.bp)
    
    # 导入WebSocket路由（确保在sock.init_app之后）
    from app import websocket  # 这会注册websocket_handler
    
    # 创建数据库表
    with app.app_context():
        db.create_all()
        from app.utils.helpers import init_db_data
        from app.models.page import Page
        if not Page.query.first():
            init_db_data()
    
    return app