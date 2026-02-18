# app/routes/auth.py
from flask import Blueprint, render_template, request, redirect, url_for, session

bp = Blueprint('auth', __name__)

USER_CREDENTIALS = {"username": "admin", "password": "PASSWORD"}
#此处密码写在死编码里 只为了防小爬虫 如果想达到多用户部署和注重安全性 请使用HASH#
#change your password when you setup!#


@bp.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        if request.form.get('password') == USER_CREDENTIALS['password']:
            session['logged_in'] = True
            return redirect(url_for('main.index'))
    return render_template('login.html')

@bp.route('/logout')
def logout():
    session.pop('logged_in', None)
    return redirect(url_for('auth.login'))