# app/models/page.py
from app import db
from datetime import datetime

class Page(db.Model):
    __tablename__ = 'page'
    
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), default="无标题")
    icon = db.Column(db.String(20), default="📄")
    cover = db.Column(db.String(200), default="") 
    content = db.Column(db.Text, default="") 
    page_type = db.Column(db.String(20), default="doc") 
    graph_config = db.Column(db.Text, default='{"visible_ids": []}')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    var_values = db.relationship('VariableValue', backref='page', lazy=True, cascade='all, delete-orphan')
    
    is_pinned = db.Column(db.Boolean, default=False)  # 是否置顶

class DailyLog(db.Model):
    __tablename__ = 'daily_log'
    
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, unique=True)
    content = db.Column(db.Text, default="")
    
    
# ========== 新增：变量系统 ==========

class Variable(db.Model):
    """变量定义表：定义有哪些变量可供追踪"""
    __tablename__ = 'variable'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False) # 例如: calc_cost (带前缀)
    display_name = db.Column(db.String(50)) # 例如: 💰 每日开销
    color = db.Column(db.String(20), default="#4F46E5") # 图表颜色
    unit = db.Column(db.String(10), default="") # 单位: 元, kg, h
    chart_type = db.Column(db.String(20), default="line") # line / pie / bar
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # 关联所有的值记录
    values = db.relationship('VariableValue', backref='variable', lazy=True)

class VariableValue(db.Model):
    """变量值表：记录每个页面对该变量贡献了多少值"""
    __tablename__ = 'variable_value'
    
    id = db.Column(db.Integer, primary_key=True)
    variable_id = db.Column(db.Integer, db.ForeignKey('variable.id'), nullable=False)
    page_id = db.Column(db.Integer, db.ForeignKey('page.id'), nullable=False)
    
    # 存储计算后的结果 (例如页面里写了 10*5, 这里存 50.0)
    value = db.Column(db.Float, default=0.0)
    
    # 记录最后更新时间，用于生成时序图
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)