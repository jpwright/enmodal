# Flask and plugins
from flask import Flask, render_template, request, after_this_request
from flask_login import LoginManager, UserMixin, current_user, login_required, login_user, logout_user
from flask_redis import FlaskRedis

# enmodal libraries
import os
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__))))
from EnmodalCore import enmodal
from EnmodalMap import enmodal_map
from EnmodalSessions import *
from EnmodalGTFS import enmodal_gtfs

# cherrypy WSGI
import cherrypy
from paste.translogger import TransLogger

# psycopg2
import psycopg2
import psycopg2.extras

# misc
import uuid
import json

# config
import ConfigParser
config = ConfigParser.RawConfigParser()
config.read(os.path.abspath(os.path.join(os.path.dirname(__file__), 'settings.cfg')))
PORT = int(config.get('flask', 'port'))
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
app = Flask(__name__, static_folder='dist', template_folder='dist', static_url_path='/static')
app.register_blueprint(enmodal)
app.config['REDIS_URL'] = config.get('flask', 'redis_url')
app.secret_key = config.get('flask', 'secret_key')

login_manager = LoginManager()
login_manager.init_app(app)

redis_store = FlaskRedis(app)

app.register_blueprint(enmodal_map)
app.register_blueprint(enmodal_gtfs)

@app.route('/session')
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
    # Enable WSGI access logging via Paste
    app_logged = TransLogger(app)

    # Mount the WSGI callable object (app) on the root directory
    cherrypy.tree.graft(app_logged, '/')

    # Set the configuration of the web server
    cherrypy.config.update({
        'engine.autoreload_on': True,
        'log.screen': True,
        'server.socket_port': PORT,
        'server.socket_host': '0.0.0.0'
    })

    # Start the CherryPy WSGI web server
    cherrypy.engine.start()
    cherrypy.engine.block()

if __name__ == "__main__":

    if not os.path.isdir(UPLOAD_FOLDER):
        os.mkdir(UPLOAD_FOLDER)
    if not os.path.isdir(UPLOAD_FOLDER):
        os.mkdir(UPLOAD_FOLDER)

    run_server()
