# app/socket.py
from flask_sock import Sock

# 单独创建sock实例，避免循环导入
sock = Sock()