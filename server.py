# Flask and plugins
from flask import Flask, render_template, request, after_this_request
from flask_login import LoginManager, UserMixin, current_user, login_required, login_user, logout_user

# enmodal libraries
import os
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__))))
from EnmodalCore import enmodal
from EnmodalMap import enmodal_map
from EnmodalSessions import *
from EnmodalGTFS import enmodal_gtfs

# psycopg2
import psycopg2
import psycopg2.extras

# misc
import uuid
import json

# config
import configparser
config = configparser.RawConfigParser()
config.read(os.path.abspath(os.path.join(os.path.dirname(__file__), 'settings.cfg')))
PORT_HTTP = int(config.get('flask', 'port_http'))
SESSIONS_HOST = config.get('sessions', 'host')
SESSIONS_PORT = config.get('sessions', 'port')
SESSIONS_DBNAME = config.get('sessions', 'dbname')
SESSIONS_USER = config.get('sessions', 'user')
SESSIONS_PASSWORD = config.get('sessions', 'password')
SESSIONS_CONN_STRING = "host='"+SESSIONS_HOST+"' port='"+SESSIONS_PORT+"' dbname='"+SESSIONS_DBNAME+"' user='"+SESSIONS_USER+"' password='"+SESSIONS_PASSWORD+"'"
SESSIONS_SECRET_KEY_PUBLIC = int(config.get('sessions', 'secret_key_public'), 16)
SESSIONS_SECRET_KEY_PRIVATE = int(config.get('sessions', 'secret_key_private'), 16)
SESSION_EXPIRATION_TIME = int(config.get('sessions', 'expiration_time'))
UPLOAD_FOLDER = config.get('flask', 'upload_folder')
SCREENSHOT_FOLDER = config.get('flask', 'screenshot_folder')

# set up app object
application = Flask(__name__, static_folder='dist', template_folder='dist', static_url_path='/static')
application.register_blueprint(enmodal)
application.secret_key = config.get('flask', 'secret_key')

login_manager = LoginManager()
login_manager.init_app(application)

application.register_blueprint(enmodal_map)
application.register_blueprint(enmodal_gtfs)

@login_manager.user_loader
def load_user(user):
    return User.get(user)
    
@application.route('/session')
def route_session_status():
    s = EnmodalSession()
    session_manager.add(s)
    a = session_manager.auth_by_key(s.private_key())

    return_obj = {"is_private": a.editable, "public_key": '{:16x}'.format(a.session.public_key())}
    if a.editable:
        return_obj["private_key"] = '{:16x}'.format(a.session.private_key())
    del a
    return json.dumps(return_obj)

def run_server():
    application.run(port = PORT_HTTP)

if __name__ == "__main__":

    if not os.path.isdir(UPLOAD_FOLDER):
        os.mkdir(UPLOAD_FOLDER)
    if not os.path.isdir(UPLOAD_FOLDER):
        os.mkdir(UPLOAD_FOLDER)

    run_server()
