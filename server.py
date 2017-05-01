from flask import Flask, render_template, request, session, escape

import psycopg2
import psycopg2.extras

import requests
import json
import re
import os
import uuid
import datetime
from lzstring import LZString

import sys
sys.path.append(os.path.abspath('lib/transit'))
import Transit
import TransitGIS
import TransitModel
import TransitSettings

import ConfigParser

app = Flask(__name__, static_url_path='/static')
app.secret_key = 'F12Yr58j4zX T~Y%C!efJ]Gxe/,?KT'

config = ConfigParser.RawConfigParser()
config.read('settings.cfg')
SESSIONS_SECRET_KEY_PUBLIC = int(config.get('sessions', 'secret_key_public'), 16)
SESSIONS_SECRET_KEY_PRIVATE = int(config.get('sessions', 'secret_key_private'), 16)
SESSION_EXPIRATION_TIME = int(config.get('sessions', 'expiration_time'))

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

    def remove_by_sid(self, sid):
        s = self.get_by_sid(sid)
        if s is not None:
            self.sessions.remove(s)

    def auth_by_key(self, h):
        public_session = self.get_by_public_key(h)
        if public_session is not None:
            a = SessionAuthentication(public_session, False)
            return a
        private_session = self.get_by_private_key(h)
        if private_session is not None:
            a = SessionAuthentication(private_session, True)
            return a
        return None

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
        return (datetime.datetime.now() - self.last_edit_time) > SESSION_EXPIRATION_TIME

class SessionAuthentication(object):
    def __init__(self, s, editable):
        self.session = s
        self.editable = editable

    def returnable_key(self):
        if self.editable:
            return '{:16x}'.format(self.session.private_key())
        else:
            return '{:16x}'.format(self.session.public_key())

session_manager = SessionManager()

@app.route('/')
def route_main():
    return app.send_static_file('index.html')

@app.route('/session')
def route_session_status():
    s = Session()
    session_manager.add(s)
    a = session_manager.auth_by_key(s.private_key())

    return_obj = {"is_private": a.editable, "public_key": '{:16x}'.format(a.session.public_key())}
    if a.editable:
        return_obj["private_key"] = '{:16x}'.format(a.session.private_key())
    return json.dumps(return_obj)

@app.route('/session-links')
def route_session_links():

    return json.dumps({})

@app.route('/session-save')
def route_session_save():
    h = int(request.args.get('i'), 16)
    e = check_for_session_errors(h)
    if e:
        return e

    config = ConfigParser.RawConfigParser()
    config.read('settings.cfg')
    host = config.get('sessions', 'host')
    port = config.get('sessions', 'port')
    dbname = config.get('sessions', 'dbname')
    user = config.get('sessions', 'user')
    password = config.get('sessions', 'password')
    conn_string = "host='"+host+"' port='"+port+"' dbname='"+dbname+"' user='"+user+"' password='"+password+"'"

    conn = psycopg2.connect(conn_string)
    cursor = conn.cursor()

    a = session_manager.auth_by_key(h)
    if a.editable:
        sid = a.session.sid
        print "saving with sid "+str(sid)
        sdata = a.session.map.to_json().replace("'", "''")
        sdt = datetime.datetime.now()

        cursor.execute("SELECT id FROM sessions WHERE id = %s LIMIT 1" % (sid))
        if (cursor.rowcount > 0):
            cursor.execute("UPDATE sessions SET data = '%s', updated = '%s' WHERE id = %s" % (sdata, sdt, sid))
        else:
            cursor.execute("INSERT INTO sessions (id, data, updated) VALUES (%s, '%s', '%s')" % (sid, sdata, sdt))

        conn.commit()

        return json.dumps({"result": "OK"})
    else:
        return json.dumps({"error": "Non-editable session"})

@app.route('/session-load')
def route_session_load():
    h = int(request.args.get('i'), 16)

    config = ConfigParser.RawConfigParser()
    config.read('settings.cfg')
    host = config.get('sessions', 'host')
    port = config.get('sessions', 'port')
    dbname = config.get('sessions', 'dbname')
    user = config.get('sessions', 'user')
    password = config.get('sessions', 'password')
    conn_string = "host='"+host+"' port='"+port+"' dbname='"+dbname+"' user='"+user+"' password='"+password+"'"

    conn = psycopg2.connect(conn_string)
    cursor = conn.cursor()

    is_private = False
    sid = session_manager.get_sid_from_public_key(h)
    #print "public guess: "+str(sid)
    cursor.execute("SELECT data FROM sessions WHERE id = %s LIMIT 1" % (sid))
    if (cursor.rowcount == 0):
        sid = session_manager.get_sid_from_private_key(h)
        #print "private guess: "+str(sid)
        cursor.execute("SELECT data FROM sessions WHERE id = %s LIMIT 1" % (sid))
        is_private = True
    if (cursor.rowcount == 0):
        return json.dumps({"error": "Invalid ID"})

    row = cursor.fetchone()
    sdata = row[0]
    m = Transit.Map(0)
    m.from_json(sdata)
    m.sidf_state = 0
    m.regenerate_all_ids()
    
    if not is_private:
        print "generating new session."
        s = Session()
        session_manager.add(s)
        s.map = m
    else:
        print "looking for private session."
        s = session_manager.get_by_sid(sid)
        if s is None:
            print "generating new private session."
            s = Session()
            s.sid = sid
            s.map = m
            session_manager.add(s)
    
    a = session_manager.auth_by_key(s.private_key())
    print a

    print "returning id "+str(session['id'])
    return_obj = {"public_key": '{:16x}'.format(a.session.public_key()), "is_private": a.editable, "data": m.to_json().replace("'", "''")}
    if a.editable:
        return_obj["private_key"] = '{:16x}'.format(a.session.private_key())
    return json.dumps(return_obj)

@app.route('/session-push', methods=['GET', 'POST'])
def route_session_push():
    h = int(request.args.get('i'), 16)
    e = check_for_session_errors(h)
    if e:
        return e

    data = request.get_data()
    charset = request.mimetype_params.get('charset') or 'UTF-8'
    jd = LZString().decompressFromUTF16(data.decode(charset, 'utf-16'))
    d = json.loads(jd)
    #print d
    d['sidf_state'] = 0
    m = Transit.Map(0)
    m.from_json(d)
    m.sidf_state = 0
    session_manager.auth_by_key(h).session.map = m

    return json.dumps({"result": "OK"})


@app.route('/station-add')
def route_station_add():
    h = int(request.args.get('i'), 16)
    e = check_for_session_errors(h)
    if e:
        return e

    service_id = request.args.get('service-id')

    lat = request.args.get('lat')
    lng = request.args.get('lng')
    station_id = request.args.get('station-id')
    m = session_manager.auth_by_key(h).session.map

    for service in m.services:
        if service_id == str(service.sid):
            station = TransitGIS.station_constructor(int(station_id), lat, lng)
            service.add_station(station)
            return station.to_json()

    return json.dumps({"error": "Invalid ID"})

@app.route('/lat-lng-info')
def route_lat_lng_info():
    h = int(request.args.get('i'), 16)
    e = check_for_session_errors(h)
    if e:
        return e

    lat = request.args.get('lat')
    lng = request.args.get('lng')

    station = TransitGIS.station_constructor(0, lat, lng)
    return station.to_json()

@app.route('/station-remove')
def route_station_remove():
    h = int(request.args.get('i'), 16)
    e = check_for_session_errors(h)
    if e:
        return e

    service_id = request.args.get('service-id')
    station_id = request.args.get('station-id')

    m = session_manager.auth_by_key(h).session.map
    for s in m.services:
        if service_id == str(s.sid):

            # Look for matching station.
            for station in s.stations:
                if station_id == str(station.sid):
                    s.remove_station(station)
                    return station.to_json()

    return json.dumps({"error": "Invalid ID"})

@app.route('/station-update')
def route_station_update():
    h = int(request.args.get('i'), 16)
    e = check_for_session_errors(h)
    if e:
        return e

    service_id = request.args.get('service-id')
    station_id = request.args.get('station-id')
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


@app.route('/stop-add')
def route_stop_add():
    h = int(request.args.get('i'), 16)
    e = check_for_session_errors(h)
    if e:
        return e

    service_id = request.args.get('service-id')
    line_id = request.args.get('line-id')
    station_id = request.args.get('station-id')
    stop_id = request.args.get('stop-id')

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

@app.route('/stop-remove')
def route_stop_remove():
    h = int(request.args.get('i'), 16)
    e = check_for_session_errors(h)
    if e:
        return e

    service_id = request.args.get('service-id')
    line_id = request.args.get('line-id')
    stop_id = request.args.get('stop-id')

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

@app.route('/line-add')
def route_line_add():
    h = int(request.args.get('i'), 16)
    e = check_for_session_errors(h)
    if e:
        return e

    name = request.args.get('name')
    full_name = request.args.get('full-name')
    color_bg = request.args.get('color-bg')
    color_fg = request.args.get('color-fg')

    service_id = request.args.get('service-id')
    line_id = request.args.get('line-id')

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

@app.route('/line-update')
def route_line_update():
    h = int(request.args.get('i'), 16)
    e = check_for_session_errors(h)
    if e:
        return e

    service_id = request.args.get('service-id')
    line_id = request.args.get('line-id')
    name = request.args.get('name')
    full_name = request.args.get('full-name')
    color_bg = request.args.get('color-bg')
    color_fg = request.args.get('color-fg')

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

@app.route('/line-info')
def route_line_info():
    h = int(request.args.get('i'), 16)
    e = check_for_session_errors(h)
    if e:
        return e

    line_id = request.args.get('line-id')
    line_name = request.args.get('line-name')

    sid = request.args.get('id')
    m = session_manager.auth_by_key(h).session.map
    for s in m.services:
        for l in s.lines:
            if line_id == str(l.sid) or line_name == l.name:
                return s.line_to_json(l)

    return json.dumps({"error": "Invalid ID"})

@app.route('/edge-add')
def route_edge_add():
    h = int(request.args.get('i'), 16)
    e = check_for_session_errors(h)
    if e:
        return e

    service_id = request.args.get('service-id')
    line_id = request.args.get('line-id')
    stop_1_id = request.args.get('stop-1-id')
    stop_2_id = request.args.get('stop-2-id')
    edge_id = request.args.get('edge-id')

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

            # Add the edge.
            if (stops_found == 2):
                edge = Transit.Edge(int(edge_id), [stop_1_id, stop_2_id])
                line_to_use.add_edge(edge)
                return edge.to_json()

    return json.dumps({"error": "Invalid ID"})

@app.route('/edge-remove')
def route_edge_remove():
    h = int(request.args.get('i'), 16)
    e = check_for_session_errors(h)
    if e:
        return e

    service_id = request.args.get('service-id')
    line_id = request.args.get('line-id')
    edge_id = request.args.get('edge-id')

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

@app.route('/service-add')
def route_service_add():
    h = int(request.args.get('i'), 16)
    e = check_for_session_errors(h)
    if e:
        return e

    name = request.args.get('name')
    service_id = request.args.get('service-id')

    m = session_manager.auth_by_key(h).session.map
    service = Transit.Service(int(service_id), name)
    m.add_service(service)

    return service.to_json()

@app.route('/service-info')
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

@app.route('/map-info')
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

@app.route('/hexagons')
def route_hexagons():

    lat = request.args.get('lat')
    lng = request.args.get('lng')
    distance = request.args.get('distance')

    hexagons = TransitGIS.hexagons(lat, lng, distance)

    return json.dumps(hexagons)

@app.route('/get-hexagons')
def route_get_hexagons():
    h = int(request.args.get('i'), 16)
    e = check_for_session_errors(h)
    if e:
        return e

    m = session_manager.auth_by_key(h).session.map
    bb = TransitGIS.BoundingBox(m)
    bb.min_lat -= 0.2;
    bb.max_lat += 0.2;
    bb.min_lng -= 0.2;
    bb.max_lng += 0.2;

    hexagons = TransitGIS.hexagons_bb(bb)
    return hexagons.to_json()

@app.route('/transit-model')
def route_transit_model():
    h = int(request.args.get('i'), 16)
    e = check_for_session_errors(h)
    if e:
        return e

    m = session_manager.auth_by_key(h).session.map
    model = TransitModel.map_analysis(m)

    return model.to_json()

@app.route('/clear-settings')
def route_clear_settings():
    h = int(request.args.get('i'), 16)
    e = check_for_session_errors(h)
    if e:
        return e

    m = session_manager.auth_by_key(h).session.map
    m.settings = TransitSettings.Settings()

@app.route('/station-pair-info')
def route_station_pair_info():
    h = int(request.args.get('i'), 16)
    e = check_for_session_errors(h)
    if e:
        return e

    service_id = request.args.get('service-id')
    station_id_1 = int(request.args.get('station-id-1'))
    station_id_2 = int(request.args.get('station-id-2'))
    ucp_0_lat = float(request.args.get('ucp-0-lat'))
    ucp_0_lng = float(request.args.get('ucp-0-lng'))
    ucp_1_lat = float(request.args.get('ucp-1-lat'))
    ucp_1_lng = float(request.args.get('ucp-1-lng'))

    # Check that both stations exist
    stations_found = 0
    stations = []

    m = session_manager.auth_by_key(h).session.map
    for s in m.services:
        if service_id == str(s.sid):
            # Look for matching station.
            for station in s.stations:
                if (station_id_1 == station.sid) or (station_id_2 == station.sid):
                    stations_found += 1
                    stations.append(station)

    #if stations_found != 2:
        #return json.dumps({"error": "Invalid ID"})

    m.settings.set_user_control_points(station_id_1, station_id_2, ucp_0_lat, ucp_0_lng, ucp_1_lat, ucp_1_lng)

    return json.dumps({"result": "OK"})

def check_for_session_errors(h):
    if session_manager.auth_by_key(h) is None:
        return json.dumps({"error": "Invalid session"})

    return 0

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5050, threaded=True)
