from flask import Flask, render_template, request, after_this_request, escape, Blueprint

import psycopg2
import psycopg2.extras
import bcrypt

import requests
import json
import re
import os
import datetime
from lzstring import LZString
import gzip
from io import StringIO as IO
import functools
import gc
import base64
import threading
import multiprocessing
import time

import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'lib', 'transit')))
import Transit
import TransitGIS
import TransitModel
import TransitSettings
from EnmodalMap import enmodal_map
from EnmodalSessions import *

import configparser

config = configparser.RawConfigParser()
config.read(os.path.abspath(os.path.join(os.path.dirname(__file__), 'settings.cfg')))
PORT = int(config.get('flask', 'port_http'))

SESSIONS_HOST = config.get('sessions', 'host')
SESSIONS_PORT = config.get('sessions', 'port')
SESSIONS_DBNAME = config.get('sessions', 'dbname')
SESSIONS_USER = config.get('sessions', 'user')
SESSIONS_PASSWORD = config.get('sessions', 'password')
SESSIONS_CONN_STRING = "host='"+SESSIONS_HOST+"' port='"+SESSIONS_PORT+"' dbname='"+SESSIONS_DBNAME+"' user='"+SESSIONS_USER+"' password='"+SESSIONS_PASSWORD+"'"
SESSIONS_SECRET_KEY_PUBLIC = int(config.get('sessions', 'secret_key_public'), 16)
SESSIONS_SECRET_KEY_PRIVATE = int(config.get('sessions', 'secret_key_private'), 16)
SESSION_EXPIRATION_TIME = int(config.get('sessions', 'expiration_time'))

enmodal = Blueprint('enmodal', __name__)

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

@enmodal.route('/')
def route_main():
    return render_template('app.html')

@enmodal.route('/view')
def view():
    return render_template('view.html')

@enmodal.route('/station_add')
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

@enmodal.route('/lat_lng_info')
def route_lat_lng_info():
    h = int(request.args.get('i'), 16)
    e = check_for_session_errors(h)
    if e:
        return e

    lat = request.args.get('lat')
    lng = request.args.get('lng')

    station = TransitGIS.station_constructor(0, lat, lng)
    return station.to_json()

@enmodal.route('/station_remove')
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

@enmodal.route('/station_update')
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
                        station.clear_hexagons()
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

@enmodal.route('/transfer_add')
def route_transfer_add():
    h = int(request.args.get('i'), 16)
    e = check_for_session_errors(h)
    if e:
        return e

    service_id = request.args.get('service_id')
    station_1_id = request.args.get('station_1_id')
    station_2_id = request.args.get('station_2_id')

@enmodal.route('/stop_add')
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
                    station = service.get_station_by_id(int(station_id))
                    stop = Transit.Stop(int(stop_id), station.sid)
                    line_to_use.add_stop(stop)
                    return stop.to_json()


    return json.dumps({"error": "Invalid ID"})

@enmodal.route('/stop_remove')
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

@enmodal.route('/stop_update_station')
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
                        station = s.get_station_by_id(int(station_id))
                    for stop in line.stops:
                        if int(stop_id) == stop.sid:
                            stop.station_id = int(station_id)
                            return stop.to_json()

    return json.dumps({"error": "Invalid ID"})

@enmodal.route('/line_add')
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

@enmodal.route('/line_update')
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

@enmodal.route('/line_info')
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

@enmodal.route('/edge_add')
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

@enmodal.route('/edge_remove')
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

@enmodal.route('/service_add')
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

@enmodal.route('/service_info')
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

@enmodal.route('/map_info')
def route_map_info():
    h = int(request.args.get('i'), 16)
    e = check_for_session_errors(h)
    if e:
        return e

    m = session_manager.auth_by_key(h).session.map
    return m.to_json()

@enmodal.route('/graphviz')
def route_graphviz():
    return render_template('graphviz.html')

@enmodal.route('/get_hexagons')
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

@enmodal.route('/transit_model')
def route_transit_model():
    h = int(request.args.get('i'), 16)
    e = check_for_session_errors(h)
    if e:
        return e

    m = session_manager.auth_by_key(h).session.map
    model = TransitModel.map_analysis(m)

    return model.ridership_json()

@enmodal.route('/clear_settings')
def route_clear_settings():
    h = int(request.args.get('i'), 16)
    e = check_for_session_errors(h)
    if e:
        return e

    m = session_manager.auth_by_key(h).session.map
    m.settings = TransitSettings.Settings()

@enmodal.route('/street_path')
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

def run_server():
    # Enable WSGI access logging via Paste
    app_logged = TransLogger(enmodal)

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
