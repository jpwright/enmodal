from flask import Flask, render_template, request, after_this_request, escape
from flask_login import LoginManager, UserMixin, current_user, login_required, login_user, logout_user

import psycopg2
import psycopg2.extras
import bcrypt
from email_validator import validate_email, EmailNotValidError

import requests
import json
import re
import os
import uuid
import datetime
from lzstring import LZString
import zlib
from cStringIO import StringIO as IO
import gzip
import functools
import gc
import base64
import threading
import multiprocessing
import time

import cherrypy
from paste.translogger import TransLogger

import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'lib', 'transit')))
import Transit
import TransitGIS
import TransitModel
import TransitSettings
from user_manager import *

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

app = Flask(__name__, static_folder='dist', template_folder='dist', static_url_path='/static')
app.secret_key = config.get('flask', 'secret_key')
login_manager = LoginManager()
login_manager.init_app(app)

class User(UserMixin):
    def __init__(self, id):
        self.id = id
        self.email = None
        self.first_name = None
        self.last_name = None
        conn = psycopg2.connect(SESSIONS_CONN_STRING)
        cursor = conn.cursor()
        cursor.execute("SELECT email, first_name, last_name FROM users WHERE id = %s LIMIT 1", [id])
        if (cursor.rowcount > 0):
            row = cursor.fetchone()
            self.email = str(row[0])
            self.first_name = str(row[1])
            self.last_name = str(row[2])
            
            sdt = datetime.datetime.now()
            cursor.execute("UPDATE users SET last_login = %s WHERE id = %s", (sdt, id))
            conn.commit()
        
            

class SessionManager(object):
    def __init__(self):
        self.sessions = []

    def get_by_sid(self, sid):
        for s in self.sessions:
            if s.sid == sid:
                return s
        return None

    def get_by_public_key(self, h):
        for s in self.sessions:
            if s.public_key() == h:
                return s
        return None

    def get_by_private_key(self, h):
        for s in self.sessions:
            if s.private_key() == h:
                return s
        return None

    def get_sid_from_public_key(self, h):
        return h ^ SESSIONS_SECRET_KEY_PUBLIC
    
    def get_sid_from_private_key(self, h):
        return h ^ SESSIONS_SECRET_KEY_PRIVATE

    def add(self, s):
        self.sessions.append(s)
        
        # Whenever we add a new session, check for old ones to remove.
        purged = self.purge()
        print str(len(self.sessions))+" active sessions, "+str(purged)+" purged."

    def remove_by_sid(self, sid):
        s = self.get_by_sid(sid)
        if s is not None:
            self.sessions.remove(s)

    def auth_by_key(self, h):
        public_session = self.get_by_public_key(h)
        if public_session is not None:
            public_session.keep_alive()
            a = SessionAuthentication(public_session, False)
            return a
        private_session = self.get_by_private_key(h)
        if private_session is not None:
            private_session.keep_alive()
            a = SessionAuthentication(private_session, True)
            return a
        return None
    
    def purge(self):
        num_sessions_start = len(self.sessions)
        for session in self.sessions:
            if session.is_expired():
                save_session(session, None, False)
        self.sessions = [x for x in self.sessions if not x.is_expired()]
        gc.collect()
        return num_sessions_start - len(self.sessions)

class Session(object):
    def __init__(self):
        self.sid = uuid.uuid4().int & (1<<63)-1
        self.map = Transit.Map(0)
        self.last_edit_time = datetime.datetime.now()
        
    def public_key(self):
        return self.sid ^ SESSIONS_SECRET_KEY_PUBLIC
    
    def private_key(self):
        return self.sid ^ SESSIONS_SECRET_KEY_PRIVATE

    def keep_alive(self):
        self.last_edit_time = datetime.datetime.now()

    def is_expired(self):
        return (datetime.datetime.now() - self.last_edit_time).total_seconds() > SESSION_EXPIRATION_TIME

session_manager = SessionManager()

class SessionAuthentication(object):
    def __init__(self, s, editable):
        self.session = s
        self.editable = editable

    def returnable_key(self):
        if self.editable:
            return '{:16x}'.format(self.session.private_key())
        else:
            return '{:16x}'.format(self.session.public_key())

def gzipped(f):
    @functools.wraps(f)
    def view_func(*args, **kwargs):
        @after_this_request
        def zipper(response):
            accept_encoding = request.headers.get('Accept-Encoding', '')

            if 'gzip' not in accept_encoding.lower():
                return response

            response.direct_passthrough = False

            if (response.status_code < 200 or
                response.status_code >= 300 or
                'Content-Encoding' in response.headers):
                return response
            gzip_buffer = IO()
            gzip_file = gzip.GzipFile(mode='wb', 
                                      fileobj=gzip_buffer)
            gzip_file.write(response.data)
            gzip_file.close()

            response.data = gzip_buffer.getvalue()
            response.headers['Content-Encoding'] = 'gzip'
            response.headers['Vary'] = 'Accept-Encoding'
            response.headers['Content-Length'] = len(response.data)

            return response

        return f(*args, **kwargs)

    return view_func

@app.route('/')
def route_main():
    return render_template('app.html')

@app.route('/view')
def view():
    return render_template('view.html')

@app.route('/user')
@login_required
def user():
    return render_template('user.html')

@app.route('/user-maps')
@login_required
def user_maps():
    conn = psycopg2.connect(SESSIONS_CONN_STRING)
    cursor = conn.cursor()
    cursor.execute("SELECT id, title FROM sessions WHERE owner_id = %s ORDER BY id", [current_user.id])
    rows = cursor.fetchall()
    maps = []
    for row in rows:
        mid = row[0]
        title = row[1]
        if title == None:
            title = "Map"
        url = "/?id="+'{:16x}'.format(mid^SESSIONS_SECRET_KEY_PRIVATE)
        maps.append({"id":str(mid), "url":url, "title":title})
    
    return json.dumps({"maps": maps})


@login_manager.unauthorized_handler
def unauthorized():
    # do stuff
    return render_template('unauthorized.html')

@app.route('/login', methods=['POST'])
def login():
    email = request.form['email']
    password = str(request.form['password']).encode('utf-8')
    
    remember = False
    if 'remember' in request.form:
        remember = True

    conn = psycopg2.connect(SESSIONS_CONN_STRING)
    cursor = conn.cursor()
    cursor.execute("SELECT id, password_hash FROM users WHERE email = %s LIMIT 1", [email])
    if (cursor.rowcount > 0):
        row = cursor.fetchone()
        id = int(row[0])
        password_hash = str(row[1]).encode('utf-8')
        if bcrypt.checkpw(password, password_hash):
            user = User(id)
            login_user(user, remember=remember)
            return json.dumps({"result": "OK", "email": email})
        
    else:
        # Do not validate on password_hash.
        # User might not remember password. Better to allow people to resend validation emails then send password reset links to unverified emails.
        cursor.execute("SELECT id FROM pending_registrations WHERE email = %s LIMIT 1", [email])
        if (cursor.rowcount > 0):
            return json.dumps({"result": "FAIL", "message": "pending registration"})
        
    return json.dumps({"result": "FAIL", "message": "not registered"})

@app.route('/change-password', methods=['POST'])
@login_required
def change_password():
    old_password = str(request.form['old_password']).encode('utf-8')
    password = str(request.form['password']).encode('utf-8')
    confirm_password = str(request.form['confirm_password']).encode('utf-8')

    if len(password) < 8:
        return json.dumps({"result": "FAIL", "message": "Password must be at least 8 characters long.", "fields": ["change-password-password"]})

    if password != confirm_password:
        return json.dumps({"result": "FAIL", "message": "Please check that you entered the same password twice.", "fields": ["change-password-password", "change-password-confirm-password"]})

    conn = psycopg2.connect(SESSIONS_CONN_STRING)
    cursor = conn.cursor()
    cursor.execute("SELECT password_hash FROM users WHERE id = %s LIMIT 1", [current_user.id])
    if (cursor.rowcount > 0):
        row = cursor.fetchone()
        password_hash = str(row[0]).encode('utf-8')
        if bcrypt.checkpw(old_password, password_hash):
            new_password_hash = bcrypt.hashpw(password, bcrypt.gensalt())
            if (password_hash == new_password_hash):
                return json.dumps({"result": "FAIL", "message": "New password can't be the same as your old password.", "fields": ["change-password-password"]})
            else:
                cursor.execute("UPDATE users SET password_hash = %s WHERE id = %s", (new_password_hash, current_user.id))
                conn.commit()
                return json.dumps({"result": "OK"})
        else:
            return json.dumps({"result": "FAIL", "message": "Your old password is incorrect. Please try again.", "fields": ["change-password-old-password"]})
        
    return json.dumps({"result": "FAIL", "message": "There was a problem processing your password change request. Please try again later.", "fields": []})

@app.route('/reset-password', methods=['POST'])
def reset_password():
    email = request.form['email']

    try:
        v = validate_email(email)
        email = v["email"] #replace with normalized form
    except EmailNotValidError as e:
        return json.dumps({"result": "FAIL", "message": "Please enter a valid email address.", "fields": ["login-email"]})

    conn = psycopg2.connect(SESSIONS_CONN_STRING)
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE email = %s LIMIT 1", [email])
    if (cursor.rowcount > 0):
        row = cursor.fetchone()
        id = int(row[0])
        cursor.execute("UPDATE users SET password_reset = %s WHERE id = %s", (True, id))
        conn.commit()
        t = threading.Thread(target=reset_passwords)
        t.start()
        
    return json.dumps({"result": "OK", "email": email})

@app.route('/confirm-registration')
def confirm_registration():
    e = request.args.get('e')
    d = base64.b64decode(e)
    
    r = json.loads(d)
    print r
    try:
        id = r['i']
        password_hash = r['p']
        dt_s = r['t']
        
        print "id: "+str(id)
        print "password_hash: "+str(password_hash)
        
        dt = datetime.datetime.strptime(dt_s, '%Y-%m-%d %H:%M:%S')
        
        print "datetime: "+str(dt)
        
        sdt = datetime.datetime.now()
        
        delta = (sdt - dt).total_seconds()
        if delta > 60*60*24:
            print "time mismatch"
            return render_template('registration_fail.html')
        
        conn = psycopg2.connect(SESSIONS_CONN_STRING)
        cursor = conn.cursor()
        cursor.execute("SELECT email, password_hash, first_name, last_name FROM pending_registrations WHERE id = %s LIMIT 1", [id])
        if (cursor.rowcount > 0):
            row = cursor.fetchone()
            if password_hash == row[1]:
                # Password matches! Create this user.
                # But first check if the user already exists
                cursor.execute("SELECT * FROM users WHERE email = %s LIMIT 1", [row[0]])
                if (cursor.rowcount > 0):
                    # Just display the confirmation message so they don't freak out.
                    return render_template('registration_confirm.html')
                else:
                    sdt = datetime.datetime.now()
                    cursor.execute("INSERT INTO users (email, password_hash, first_name, last_name, created) VALUES (%s, %s, %s, %s, %s)", (row[0], row[1], row[2], row[3], sdt))
                    cursor.execute("DELETE FROM pending_registrations WHERE id = %s", [id])
                    conn.commit()
                    # Go ahead and log them in.
                    cursor.execute("SELECT id FROM users WHERE email = %s LIMIT 1", [row[0]])
                    row = cursor.fetchone()
                    user = User(row[0])
                    login_user(user)
                    return render_template('registration_confirm.html')
            else:
                print "password hash mismatch"
                return render_template('registration_fail.html')
        else:
            print "id not in pending_registrations"
            return render_template('registration_fail.html')
    except:
        return render_template('registration_fail.html')
    

@app.route('/resend-registration', methods=['POST'])
def resend_registration():
    email = request.form['email']

    conn = psycopg2.connect(SESSIONS_CONN_STRING)
    cursor = conn.cursor()
    cursor.execute("UPDATE pending_registrations SET email_sent = %s WHERE email = %s", (False, email))
    conn.commit()
    t = threading.Thread(target=send_registration_emails)
    t.start()
    
    return json.dumps({"result": "OK", "email": email})

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return json.dumps({"result": "OK"})

@app.route('/register', methods=['POST'])
def register():
    email = request.form['email']
    first_name = request.form['first_name']
    last_name = request.form['last_name']
    password = str(request.form['password']).encode('utf-8')
    confirm_password = str(request.form['confirm_password']).encode('utf-8')
    
    if len(first_name) < 1 or len(last_name) < 1:
        return json.dumps({"result": "FAIL", "message": "Please enter a first and last name.", "fields": ["register-first-name", "register-last-name"]})

    try:
        v = validate_email(email)
        email = v["email"] #replace with normalized form
    except EmailNotValidError as e:
        return json.dumps({"result": "FAIL", "message": "Please enter a valid email address.", "fields": ["register-email"]})

    if len(password) < 8:
        return json.dumps({"result": "FAIL", "message": "Password must be at least 8 characters long.", "fields": ["register-password"]})

    if password != confirm_password:
        return json.dumps({"result": "FAIL", "message": "Please check that you entered the same password twice.", "fields": ["register-password", "register-confirm-password"]})
    
    conn = psycopg2.connect(SESSIONS_CONN_STRING)
    cursor = conn.cursor()
    cursor.execute("SELECT id, password_hash FROM users WHERE email = %s LIMIT 1", [email])
    if (cursor.rowcount > 0):
        return json.dumps({"result": "FAIL", "message": "That email address is already in use.", "fields": ["register-email"]})
    else:
        password_hash = bcrypt.hashpw(password, bcrypt.gensalt())
        sdt = datetime.datetime.now()
        cursor.execute("INSERT INTO pending_registrations (email, password_hash, first_name, last_name, created, email_sent) VALUES (%s, %s, %s, %s, %s, %s)", (email, password_hash, first_name, last_name, sdt, False))
        conn.commit()
        t = threading.Thread(target=send_registration_emails)
        t.start()
        cursor.execute("SELECT id FROM pending_registrations WHERE email = %s LIMIT 1", [email])
        if (cursor.rowcount > 0):
            row = cursor.fetchone()
            #id = int(row[0])
            #user = User(id)
            #login_user(user)
        else:
            return json.dumps({"result": "FAIL", "message": "There was a problem processing your registration. Please try again later.", "fields": []})
        
    return json.dumps({"result": "OK", "email": email})

@app.route('/map_name')
@login_required
def map_name():
    h = int(request.args.get('i'), 16)
    e = check_for_session_errors(h)
    if e:
        return e

    name = str(request.args.get('name'))
    
    a = session_manager.auth_by_key(h)
    
    conn = psycopg2.connect(SESSIONS_CONN_STRING)
    cursor = conn.cursor()
    cursor.execute("SELECT owner_id FROM sessions WHERE id = '%s' LIMIT 1", [a.session.sid])
    if (cursor.rowcount > 0):
        row = cursor.fetchone()
        if (int(row[0]) != int(current_user.id)):
            return json.dumps({"result": "FAIL", "message": "Wrong user"})
        
    cursor.execute("UPDATE sessions SET title = %s WHERE id = %s", (name, a.session.sid))
    conn.commit()
    
    return json.dumps({"result": "OK"})
    

@app.route('/session')
def route_session_status():
    s = Session()
    session_manager.add(s)
    a = session_manager.auth_by_key(s.private_key())

    return_obj = {"is_private": a.editable, "public_key": '{:16x}'.format(a.session.public_key())}
    if a.editable:
        return_obj["private_key"] = '{:16x}'.format(a.session.private_key())
    del a
    return json.dumps(return_obj)

@app.route('/session_links')
def route_session_links():

    return json.dumps({})

def save_session(s, user_id, take_snapshot):
    sid = s.sid
    print "saving with sid "+str(sid)
    sdata = str(s.map.to_json())
    sdt = datetime.datetime.now()

    conn = psycopg2.connect(SESSIONS_CONN_STRING)
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM sessions WHERE id = '%s' LIMIT 1", [sid])
    if (cursor.rowcount > 0):
        cursor.execute("UPDATE sessions SET data = %s, updated = %s WHERE id = %s", (sdata, sdt, sid))
    else:
        cursor.execute("INSERT INTO sessions (id, data, updated) VALUES (%s, %s, %s)", (sid, sdata, sdt))
    if user_id != None:
        cursor.execute("UPDATE sessions SET owner_id = %s WHERE id = %s", (user_id, sid))
        
    conn.commit()
    
    if take_snapshot:
        session_token = '{:16x}'.format(s.private_key())
        screenshot_cmd = 'node '+os.path.abspath(os.path.join(os.path.dirname(__file__), 'tools', 'screenshot.js'))+' --url "http://localhost:'+str(PORT)+"/view?id="+session_token+'" --output '+os.path.abspath(os.path.join(os.path.dirname(__file__), 'dist', 'img', 'map-screenshots/'+str(sid)+'.png'))+' &'
        print screenshot_cmd
        os.system(screenshot_cmd)

@app.route('/session_save')
def route_session_save():
    if current_user.is_anonymous:
        return json.dumps({"result": "FAIL", "message": "Anonymous user"})
    
    h = int(request.args.get('i'), 16)
    e = check_for_session_errors(h)
    if e:
        return e

    a = session_manager.auth_by_key(h)
    
    conn = psycopg2.connect(SESSIONS_CONN_STRING)
    cursor = conn.cursor()
    cursor.execute("SELECT owner_id FROM sessions WHERE id = '%s' LIMIT 1", [a.session.sid])
    if (cursor.rowcount > 0):
        row = cursor.fetchone()
        if row[0] is not None:
            if (int(row[0]) != int(current_user.id)):
                return json.dumps({"result": "FAIL", "message": "Wrong user"})

    if a.editable:
        save_session(a.session, current_user.id, True)
        del a
        return json.dumps({"result": "OK"})
    else:
        del a
        return json.dumps({"result": "FAIL", "message": "Non-editable session"})

@app.route('/session_load')
def route_session_load():
    h = int(request.args.get('i'), 16)

    conn = psycopg2.connect(SESSIONS_CONN_STRING)
    cursor = conn.cursor()

    is_private = False
    sid = session_manager.get_sid_from_public_key(h)
    #print "public guess: "+str(sid)
    cursor.execute("SELECT data, title FROM sessions WHERE id = '%s' LIMIT 1", [sid])
    if (cursor.rowcount == 0):
        sid = session_manager.get_sid_from_private_key(h)
        #print "private guess: "+str(sid)
        cursor.execute("SELECT data, title FROM sessions WHERE id = '%s' LIMIT 1", [sid])
        is_private = True
    if (cursor.rowcount == 0):
        return json.dumps({"error": "Invalid ID"})

    print sid
    row = cursor.fetchone()
    sdata = row[0]
    title = row[1]
    m = Transit.Map(0)
    m.from_json(sdata)
    m.sidf_state = 0
    m.regenerate_all_ids()
    
    if not is_private:
        s = Session()
        session_manager.add(s)
        s.map = m
    else:
        s = session_manager.get_by_sid(sid)
        if s is None:
            s = Session()
            s.sid = sid
            s.map = m
            session_manager.add(s)
        else:
            s.map = m
    
    a = session_manager.auth_by_key(s.private_key())
    return_obj = {"public_key": '{:16x}'.format(a.session.public_key()), "is_private": a.editable, "title": title, "data": m.to_json()}
    if a.editable:
        return_obj["private_key"] = '{:16x}'.format(a.session.private_key())
    del a
    return json.dumps(return_obj)

@app.route('/session_push', methods=['GET', 'POST'])
def route_session_push():
    h = int(request.args.get('i'), 16)
    e = check_for_session_errors(h)
    if e:
        return e

    print 'received session push'
    data = request.get_data()
    charset = request.mimetype_params.get('charset') or 'UTF-8'
    jd = LZString().decompressFromUTF16(data.decode(charset, 'utf-16'))
    print 'decompressed session push'
    jdl = json.loads(jd)
    d = jdl['map']
    #print d
    d['sidf_state'] = 0
    m = Transit.Map(0)
    m.from_json(d)
    m.sidf_state = 0
    
    # Copy old map
    om = session_manager.auth_by_key(h).session.map
    
    # Save new map
    session_manager.auth_by_key(h).session.map = m
    
    # Save gids
    for service in om.services:
        for station in service.stations:
            if station.gids_known:
                for service_n in m.services:
                    for station_n in service_n.stations:
                        if station.location == station_n.location:
                            station_n.set_gids(station.gids_in_range)
    
    # Copy user settings
    # TODO clean this up!
    settings = jdl['settings']
    m.settings.from_json(settings)

    return json.dumps({"result": "OK"})


@app.route('/station_add')
def route_station_add():
    h = int(request.args.get('i'), 16)
    e = check_for_session_errors(h)
    if e:
        return e

    service_id = request.args.get('service_id')

    lat = request.args.get('lat')
    lng = request.args.get('lng')
    station_id = request.args.get('station_id')
    m = session_manager.auth_by_key(h).session.map

    for service in m.services:
        if service_id == str(service.sid):
            station = TransitGIS.station_constructor(int(station_id), lat, lng)
            service.add_station(station)
            return station.to_json()

    return json.dumps({"error": "Invalid ID"})

@app.route('/lat_lng_info')
def route_lat_lng_info():
    h = int(request.args.get('i'), 16)
    e = check_for_session_errors(h)
    if e:
        return e

    lat = request.args.get('lat')
    lng = request.args.get('lng')

    station = TransitGIS.station_constructor(0, lat, lng)
    return station.to_json()

@app.route('/station_remove')
def route_station_remove():
    h = int(request.args.get('i'), 16)
    e = check_for_session_errors(h)
    if e:
        return e

    service_id = request.args.get('service_id')
    station_id = request.args.get('station_id')

    m = session_manager.auth_by_key(h).session.map
    for s in m.services:
        if service_id == str(s.sid):

            # Look for matching station.
            for station in s.stations:
                if station_id == str(station.sid):
                    s.remove_station(station)
                    return station.to_json()

    return json.dumps({"error": "Invalid ID"})

@app.route('/station_update')
def route_station_update():
    h = int(request.args.get('i'), 16)
    e = check_for_session_errors(h)
    if e:
        return e

    service_id = request.args.get('service_id')
    station_id = request.args.get('station_id')
    name = request.args.get('name')
    location = request.args.get('location')
    streets = request.args.get('streets')
    neighborhood = request.args.get('neighborhood')
    locality = request.args.get('locality')
    region = request.args.get('region')

    m = session_manager.auth_by_key(h).session.map
    for s in m.services:
        if service_id == str(s.sid):

            # Look for matching station.
            for station in s.stations:
                if station_id == str(station.sid):
                    if name != None:
                        station.name = name
                    if location != None:
                        location_comps = location.split(',')
                        station.location = [float(location_comps[0]), float(location_comps[1])]
                        station.clear_gids()
                    if streets != None:
                        street_comps = streets.split(',')
                        station.streets = street_comps
                    if neighborhood != None:
                        station.neighborhood = neighborhood
                    if locality != None:
                        station.locality = locality
                    if region != None:
                        station.region = region

    return json.dumps({"error": "Invalid ID"})

@app.route('/transfer_add')
def route_transfer_add():
    h = int(request.args.get('i'), 16)
    e = check_for_session_errors(h)
    if e:
        return e

    service_id = request.args.get('service_id')
    station_1_id = request.args.get('station_1_id')
    station_2_id = request.args.get('station_2_id')

@app.route('/stop_add')
def route_stop_add():
    h = int(request.args.get('i'), 16)
    e = check_for_session_errors(h)
    if e:
        return e

    service_id = request.args.get('service_id')
    line_id = request.args.get('line_id')
    station_id = request.args.get('station_id')
    stop_id = request.args.get('stop_id')

    m = session_manager.auth_by_key(h).session.map
    for service in m.services:
        if service_id == str(service.sid):
            line_exists = False
            for line in service.lines:
                if line_id == str(line.sid):
                    line_exists = True
                    line_to_use = line

            if (line_exists):
                if service.has_station(int(station_id)):
                    station = service.find_station(int(station_id))
                    stop = Transit.Stop(int(stop_id), station.sid)
                    line_to_use.add_stop(stop)
                    return stop.to_json()


    return json.dumps({"error": "Invalid ID"})

@app.route('/stop_remove')
def route_stop_remove():
    h = int(request.args.get('i'), 16)
    e = check_for_session_errors(h)
    if e:
        return e

    service_id = request.args.get('service_id')
    line_id = request.args.get('line_id')
    stop_id = request.args.get('stop_id')

    m = session_manager.auth_by_key(h).session.map
    for s in m.services:
        if service_id == str(s.sid):

            # Look for matching line.
            for line in s.lines:
                if line_id == str(line.sid):
                    for stop in line.stops:
                        if stop_id == str(stop.sid):
                            line.remove_stop(stop)
                            return stop.to_json()

    return json.dumps({"error": "Invalid ID"})

@app.route('/stop_update_station')
def route_stop_update_station():
    h = int(request.args.get('i'), 16)
    e = check_for_session_errors(h)
    if e:
        return e

    service_id = request.args.get('service_id')
    line_id = request.args.get('line_id')
    station_id = request.args.get('station_id')
    stop_id = request.args.get('stop_id')

    m = session_manager.auth_by_key(h).session.map
    for s in m.services:
        if int(service_id) == s.sid:
            # Look for matching line.
            for line in s.lines:
                if int(line_id) == line.sid:
                    if s.has_station(int(station_id)):
                        station = s.find_station(int(station_id))
                    for stop in line.stops:
                        if int(stop_id) == stop.sid:
                            stop.station_id = int(station_id)
                            return stop.to_json()

    return json.dumps({"error": "Invalid ID"})

@app.route('/line_add')
def route_line_add():
    h = int(request.args.get('i'), 16)
    e = check_for_session_errors(h)
    if e:
        return e

    name = request.args.get('name')
    full_name = request.args.get('full_name')
    color_bg = request.args.get('color_bg')
    color_fg = request.args.get('color_fg')

    service_id = request.args.get('service_id')
    line_id = request.args.get('line_id')

    m = session_manager.auth_by_key(h).session.map
    line = Transit.Line(int(line_id), name)
    line.full_name = full_name
    line.color_bg = color_bg
    line.color_fg = color_fg

    for service in m.services:
        if service_id == str(service.sid):
            service.add_line(line)
            return line.to_json()

    return json.dumps({"error": "Invalid ID"})

@app.route('/line_update')
def route_line_update():
    h = int(request.args.get('i'), 16)
    e = check_for_session_errors(h)
    if e:
        return e

    service_id = request.args.get('service_id')
    line_id = request.args.get('line_id')
    name = request.args.get('name')
    full_name = request.args.get('full_name')
    color_bg = request.args.get('color_bg')
    color_fg = request.args.get('color_fg')

    m = session_manager.auth_by_key(h).session.map
    for s in m.services:
        if service_id == str(s.sid):

            # Look for matching line.
            for line in s.lines:
                if line_id == str(line.sid):
                    if name != None:
                        line.name = name
                    if full_name != None:
                        line.full_name = full_name
                    if color_bg != None:
                        line.color_bg = color_bg
                    if color_fg != None:
                        line.color_fg = color_fg


    return json.dumps({"error": "Invalid ID"})

@app.route('/line_info')
def route_line_info():
    h = int(request.args.get('i'), 16)
    e = check_for_session_errors(h)
    if e:
        return e

    line_id = request.args.get('line_id')
    line_name = request.args.get('line_name')

    sid = request.args.get('id')
    m = session_manager.auth_by_key(h).session.map
    for s in m.services:
        for l in s.lines:
            if line_id == str(l.sid) or line_name == l.name:
                return s.line_to_json(l)

    return json.dumps({"error": "Invalid ID"})

@app.route('/edge_add')
def route_edge_add():
    h = int(request.args.get('i'), 16)
    e = check_for_session_errors(h)
    if e:
        return e

    service_id = request.args.get('service_id')
    line_id = request.args.get('line_id')
    stop_1_id = request.args.get('stop_1_id')
    stop_2_id = request.args.get('stop_2_id')
    edge_id = request.args.get('edge_id')

    if (stop_1_id == stop_2_id):
        return json.dumps({"error": "Duplicate Stop IDs"})

    m = session_manager.auth_by_key(h).session.map
    for s in m.services:
        if service_id == str(s.sid):

            # Look for matching line.
            line_exists = False
            for line in s.lines:
                if line_id == str(line.sid):
                    line_exists = True
                    line_to_use = line

            # Look for matching stops.
            stops_found = 0
            if (line_exists):
                for stop in line_to_use.stops:
                    if stop_1_id == str(stop.sid):
                        stop_1 = stop
                        stops_found += 1
                    if stop_2_id == str(stop.sid):
                        stop_2 = stop
                        stops_found += 1
            else:
                return json.dumps({"error": "Line Not Found"})

            # Add the edge.
            if (stops_found == 2):
                edge = Transit.Edge(int(edge_id), [stop_1_id, stop_2_id])
                line_to_use.add_edge(edge)
                return edge.to_json()
            else:
                return json.dumps({"error": "Stops Not Found"})

    return json.dumps({"error": "Invalid ID"})

@app.route('/edge_remove')
def route_edge_remove():
    h = int(request.args.get('i'), 16)
    e = check_for_session_errors(h)
    if e:
        return e

    service_id = request.args.get('service_id')
    line_id = request.args.get('line_id')
    edge_id = request.args.get('edge_id')

    m = session_manager.auth_by_key(h).session.map
    for s in m.services:
        if service_id == str(s.sid):

            # Look for matching line.
            for line in s.lines:
                if line_id == str(line.sid):
                    for edge in line.edges:
                        if edge_id == str(edge.sid):
                            line.remove_edge(edge)
                            return edge.to_json()

    return json.dumps({"error": "Invalid ID"})

@app.route('/service_add')
def route_service_add():
    h = int(request.args.get('i'), 16)
    e = check_for_session_errors(h)
    if e:
        return e

    name = request.args.get('name')
    service_id = request.args.get('service_id')

    m = session_manager.auth_by_key(h).session.map
    service = Transit.Service(int(service_id), name)
    m.add_service(service)

    return service.to_json()

@app.route('/service_info')
def route_service_info():
    h = int(request.args.get('i'), 16)
    e = check_for_session_errors(h)
    if e:
        return e

    service_id = request.args.get('id')
    m = session_manager.auth_by_key(h).session.map
    for s in m.services:
        if service_id == str(s.sid):
            return s.to_json()

    return json.dumps({"error": "Invalid ID"})

@app.route('/map_info')
def route_map_info():
    h = int(request.args.get('i'), 16)
    e = check_for_session_errors(h)
    if e:
        return e

    m = session_manager.auth_by_key(h).session.map
    return m.to_json()

@app.route('/graphviz')
def route_graphviz():
    return app.send_static_file('graphviz.html')

@app.route('/get_hexagons')
@gzipped
def route_get_hexagons():
    h = int(request.args.get('i'), 16)
    e = check_for_session_errors(h)
    if e:
        return e

    lat_min = float(request.args.get('lat_min'))
    lng_min = float(request.args.get('lng_min'))
    lat_max = float(request.args.get('lat_max'))
    lng_max = float(request.args.get('lng_max'))
    
    #bb = TransitGIS.BoundingBox(m)
    bb = TransitGIS.BoundingBox()
    bb.set_bounds(lat_min, lat_max, lng_min, lng_max)

    hexagons = TransitGIS.hexagons_bb(bb)
    #encoded = geobuf.encode(hexagons.geojson())
    #zlib_compress = zlib.compressobj(-1, zlib.DEFLATED, -zlib.MAX_WBITS)
    #encoded = zlib_compress.compress(json.dumps(hexagons.geojson())) + zlib_compress.flush()
    #print "Compressing..."
    #encoded = LZString().compressToUTF16(json.dumps(hexagons.geojson()))
    #print "Compression done"
    #return encoded
    return json.dumps(hexagons.geojson())

@app.route('/transit_model')
def route_transit_model():
    h = int(request.args.get('i'), 16)
    e = check_for_session_errors(h)
    if e:
        return e

    m = session_manager.auth_by_key(h).session.map
    model = TransitModel.map_analysis(m)

    return model.ridership_json()

@app.route('/clear_settings')
def route_clear_settings():
    h = int(request.args.get('i'), 16)
    e = check_for_session_errors(h)
    if e:
        return e

    m = session_manager.auth_by_key(h).session.map
    m.settings = TransitSettings.Settings()

@app.route('/street_path')
def route_street_path():
    h = int(request.args.get('i'), 16)
    e = check_for_session_errors(h)
    if e:
        return e

    service_id = request.args.get('service_id')
    station_1_lat = float(request.args.get('station_1_lat'))
    station_1_lng = float(request.args.get('station_1_lng'))
    station_2_lat = float(request.args.get('station_2_lat'))
    station_2_lng = float(request.args.get('station_2_lng'))
    
    return json.dumps(TransitGIS.valhalla_route(station_1_lat, station_1_lng, station_2_lat, station_2_lng))


def check_for_session_errors(h):
    if session_manager.auth_by_key(h) is None:
        print("session auth problem with key "+str(h))
        return json.dumps({"error": "Invalid session"})

    return 0

@login_manager.user_loader
def load_user(user_id):
    return User(user_id)

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
    run_server()
