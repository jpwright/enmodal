from flask import Flask, Blueprint, request, url_for, send_from_directory
from werkzeug.utils import secure_filename
import sys
import os
import shutil
import codecs
import csv
import zipfile

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__))))
from EnmodalSessions import *
from EnmodalMap import *
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'lib', 'transit')))
import Transit

from lzstring import LZString
import json

import psycopg2
import psycopg2.extras

import configparser
config = configparser.RawConfigParser()
config.read(os.path.abspath(os.path.join(os.path.dirname(__file__), 'settings.cfg')))

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

enmodal_gtfs = Blueprint('enmodal_gtfs', __name__)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ['zip']

@enmodal_gtfs.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

@enmodal_gtfs.route('/gtfs_upload', methods=['POST'])
def route_gtfs_upload():
    h = int(request.args.get('i'), 16)
    e = check_for_session_errors(h)
    if e:
        return e

    print(request.files)

    # check if the post request has the file part
    if 'gtfs' not in request.files:
        return json.dumps({"result": "error", "message": "No file."})
    
    file = request.files['gtfs']
    # if user does not select file, browser also
    # submit a empty part without filename
    if file.filename == '':
        return json.dumps({"result": "error", "message": "No file."})
    
    if file and allowed_file(file.filename):
        filename = secure_filename(request.args.get('i') + ".zip")
        if not os.path.isdir(UPLOAD_FOLDER):
            os.mkdir(UPLOAD_FOLDER)
        file.save(os.path.join(UPLOAD_FOLDER, filename))
        return json.dumps({"result": "OK", "message": url_for('enmodal_gtfs.uploaded_file', filename=filename)})
    else:
        return json.dumps({"result": "error", "message": "Bad file."})

AGENCY_PROPERTIES = ['agency_id', 'agency_name']
ROUTE_PROPERTIES = ['route_id', 'route_short_name', 'route_long_name', 'route_color', 'route_text_color']

def route_to_line(m, route):
    name = "Line"
    full_name = "Line"

    if 'route_short_name' in route:
        name = route['route_short_name']
    if 'route_long_name' in route:
        full_name = route['route_long_name']

    l = Transit.Line(m.create_sid(), name)
    l.full_name = full_name

    if len(l.name) == 0 and len(l.full_name) > 0:
        l.name = l.full_name
    if len(l.full_name) == 0 and len(l.name) > 0:
        l.full_name = l.name

    if 'route_id' in route:
        l.gtfs_id = route['route_id']

    color_bg = "808183"
    if 'route_color' in route:
        if len(route['route_color']) > 0:
            color_bg = route['route_color']
    l.color_bg = "#"+color_bg
    
    color_fg = "FFFFFF"
    if 'route_text_color' in route:
        if len(route['route_text_color']) > 0:
            color_fg = route['route_text_color']
    if 'route_text_color' not in route and 'route_color' in route:
        if len(color_bg) == 6:
            cbc = tuple(int(color_bg[i:i+2], 16) for i in (0, 2, 4))
            if ((cbc[0] + cbc[1] + cbc[2]) > (255*3/2)):
                color_fg = "000000"
        if len(color_bg) == 3:
            cbc = tuple(int(color_bg[i:i+1], 16) for i in (0, 1, 2))
            if ((cbc[0] + cbc[1] + cbc[2]) > (15*3/2)):
                color_fg = "000000"

    l.color_fg = "#"+color_fg
    return l

def stop_to_station(m, stop):
    lat = float(stop['stop_lat'])
    lng = float(stop['stop_lon'])
    name = stop['stop_name']
    name = name.replace(" Underground Station", "")
    station = Transit.Station(m.create_sid(), name, [lat, lng])
    return station

def remove_bom_inplace(path):
    """Removes BOM mark, if it exists, from a file and rewrites it in-place"""
    #https://www.stefangordon.com/remove-bom-mark-from-text-files-in-python/
    buffer_size = 4096
    bom_length = len(codecs.BOM_UTF8)
 
    with open(path, "r+b") as fp:
        chunk = fp.read(buffer_size)
        if chunk.startswith(codecs.BOM_UTF8):
            i = 0
            chunk = chunk[bom_length:]
            while chunk:
                fp.seek(i)
                fp.write(chunk)
                i += len(chunk)
                fp.seek(bom_length, os.SEEK_CUR)
                chunk = fp.read(buffer_size)
            fp.seek(-bom_length, os.SEEK_CUR)
            fp.truncate()

def gtfs_to_simple_map(zip_folder_location):
    m = Transit.Map(0)

    remove_bom_inplace(os.path.join(zip_folder_location, 'agency.txt'))
    agency_file = open(os.path.join(zip_folder_location, 'agency.txt'), 'rb')
    agency_reader = csv.DictReader(agency_file)
    remove_bom_inplace(os.path.join(zip_folder_location, 'routes.txt'))
    routes_file = open(os.path.join(zip_folder_location, 'routes.txt'), 'rb')
    routes_reader = csv.DictReader(routes_file)

    agencies = []
    for agency in agency_reader:
        name = "Service"
        if 'agency_name' in agency:
            name = agency['agency_name']
        s = Transit.Service(m.create_sid(), name)
        if 'agency_id' in agency:
            s.gtfs_id = agency['agency_id']
        else:
            s.gtfs_id = agency['agency_name']

        m.add_service(s)

    for route in routes_reader:
        if 'agency_id' in route:
            s = m.get_service_by_gtfs_id(route['agency_id'])
        else:
            s = m.services[0]

        l = route_to_line(m, route)
        s.add_line(l)

    agency_file.close()
    routes_file.close()

    return m

def contains_sublist(lst, sublst):
    n = len(sublst)
    return any((sublst == lst[i:i+n]) for i in xrange(len(lst)-n+1))

def gtfs_to_full_map(zip_folder_location, import_filter):
    m = Transit.Map(0)

    remove_bom_inplace(os.path.join(zip_folder_location, 'agency.txt'))
    agency_file = open(os.path.join(zip_folder_location, 'agency.txt'), 'rb')
    agency_reader = csv.DictReader(agency_file)
    remove_bom_inplace(os.path.join(zip_folder_location, 'stops.txt'))
    stops_file = open(os.path.join(zip_folder_location, 'stops.txt'), 'rb')
    stops_reader = csv.DictReader(stops_file)
    remove_bom_inplace(os.path.join(zip_folder_location, 'routes.txt'))
    routes_file = open(os.path.join(zip_folder_location, 'routes.txt'), 'rb')
    routes_reader = csv.DictReader(routes_file)
    remove_bom_inplace(os.path.join(zip_folder_location, 'trips.txt'))
    trips_file = open(os.path.join(zip_folder_location, 'trips.txt'), 'rb')
    trips_reader = csv.DictReader(trips_file)
    remove_bom_inplace(os.path.join(zip_folder_location, 'stop_times.txt'))
    stop_times_file = open(os.path.join(zip_folder_location, 'stop_times.txt'), 'rb')
    stop_times_reader = csv.DictReader(stop_times_file)
    
    print("Reading agencies")
    agencies = []
    for agency in agency_reader:
        name = "Service"
        if 'agency_name' in agency:
            name = agency['agency_name']
        s = Transit.Service(m.create_sid(), name)
        if 'agency_id' in agency:
            s.gtfs_id = agency['agency_id']
        else:
            s.gtfs_id = agency['agency_name']

        if (s.gtfs_id in import_filter['services']):
            print("Adding service: "+s.gtfs_id)
            m.add_service(s)

    print("Reading stops")
    stops = {}
    for stop in stops_reader:
        stops[stop['stop_id']] = stop
    
    print("Reading trips")
    route_id_to_trip_id = {}
    trip_id_to_route_id = {}
    for trip in trips_reader:
        route_id = trip['route_id']
        if route_id in import_filter['lines']:
            if route_id in route_id_to_trip_id:
                route_id_to_trip_id[route_id].append(trip['trip_id'])
            else:
                route_id_to_trip_id[route_id] = [trip['trip_id']]
            trip_id_to_route_id[trip['trip_id']] = route_id
            
    print("Reading stop times")
    trip_id_to_stop_ids = {}
    for stop_time in stop_times_reader:
        trip_id = stop_time['trip_id']
        if trip_id in trip_id_to_route_id:
            if trip_id in trip_id_to_stop_ids:
                trip_id_to_stop_ids[trip_id].append(stop_time['stop_id'])
            else:
                trip_id_to_stop_ids[trip_id] = [stop_time['stop_id']]
    
    stops_to_station_ids = {}
    print("Reading routes")
    for route in routes_reader:
        
        # Only use routes with at least 1 trip and not filtered out
        if (route['route_id'] in route_id_to_trip_id) and (route['route_id'] in import_filter['lines']):
            #print "Adding line: "+route['route_id']
            if 'agency_id' in route:
                s = m.get_service_by_gtfs_id(route['agency_id'])
            else:
                s = m.services[0]

            l = route_to_line(m, route)
            s.add_line(l)
            
            trip_ids = route_id_to_trip_id[route['route_id']]
            num_trips_max = 99999
            trip_num = 0

            unique_stop_ids = []

            # Add all the edges.
            for trip_id in trip_ids:
                if trip_num < num_trips_max:
                    trip_stops = trip_id_to_stop_ids[trip_id]
                    #print(str(len(trip_stops))+" stops")

                    previous_stops = []
                    for stop_id in trip_stops:
                        if stop_id in stops_to_station_ids:
                            station_id = stops_to_station_ids[stop_id]
                            station = service.get_station_by_id(station_id)
                        else:
                            tstop = stops[stop_id]
                            lat = float(tstop['stop_lat'])
                            lng = float(tstop['stop_lon'])
                            station = s.get_station_by_location([lat, lng])
                            if station is None:
                                station = stop_to_station(m, tstop)
                                s.add_station(station)
                            stops_to_station_ids['stop_id'] = station.sid
                        
                        if not l.has_station(station):
                            stop = Transit.Stop(m.create_sid(), station.sid)
                            l.add_stop(stop)
                        else:
                            stop = l.get_stop_from_station(station)
                        
                        if len(previous_stops) > 0:
                            edge_exists = l.has_edge_for_stops([stop, previous_stops[-1]])
                            if not edge_exists:
                                edge = Transit.Edge(m.create_sid(), [stop.sid, previous_stops[-1].sid])
                                #print "adding edge between "+station.name+" and "+s.get_station_by_id(previous_stops[-1].station_id).name
                                l.add_edge(edge)

                        previous_stops.append(stop)

                    previous_stop_ids = []
                    for stop in previous_stops:
                        previous_stop_ids.append(stop.sid)

                    if previous_stop_ids not in unique_stop_ids:
                        unique_stop_ids.append(previous_stop_ids)

                trip_num += 1

            #print unique_stop_ids

            # Check each edge to see if it can be removed.
            edges_to_remove = []

            for edge in l.edges:
                s1 = l.get_stop_by_id(edge.stop_ids[0])
                s2 = l.get_stop_by_id(edge.stop_ids[1])

                # We want to remove this edge only if a GTFS trip defines a longer path between the two stops.
                for unique_trip in unique_stop_ids:
                    if s1.sid in unique_trip and s2.sid in unique_trip:
                        s1_index = unique_trip.index(s1.sid)
                        s2_index = unique_trip.index(s2.sid)
                        if (abs(s1_index-s2_index) > 1) and edge not in edges_to_remove:
                            edges_to_remove.append(edge)

            for edge in edges_to_remove:
                l.edges.remove(edge)

    agency_file.close()
    stops_file.close()
    routes_file.close()
    trips_file.close()
    stop_times_file.close()

    # Post-processing:
    # Remove any unused stations
    for service in m.services:
        stations_to_remove = []
        for station in service.stations:
            ec = service.station_edge_count(station)
            if ec == 0:
                if station not in stations_to_remove:
                    stations_to_remove.append(station)
        for station in stations_to_remove:
            service.remove_station(station)

    return m

@enmodal_gtfs.route('/gtfs_analyze')
def route_gtfs_analyze():
    h = int(request.args.get('i'), 16)
    e = check_for_session_errors(h)
    if e:
        return e

    zip_file_location = os.path.join(UPLOAD_FOLDER, request.args.get('i') + ".zip")
    zip_folder_location = os.path.join(UPLOAD_FOLDER, request.args.get('i'))

    zip_ref = zipfile.ZipFile(zip_file_location)
    zip_ref.extractall(zip_folder_location)
    zip_ref.close()

    m = gtfs_to_simple_map(zip_folder_location)

    #agency['routes'] = sorted(agency['routes'], key=lambda k: k['route_long_name'])
    #agencies = sorted(agencies, key=lambda k: k['agency_name'])

    return m.to_json()

        
@enmodal_gtfs.route('/gtfs_import', methods=['POST'])
def route_gtfs_import():
    h = int(request.args.get('i'), 16)
    e = check_for_session_errors(h)
    if e:
        return e
    
    f = request.get_json()
    print(f)

    a = session_manager.auth_by_key(h)
    m = a.session.map
    m.regenerate_all_ids()

    zip_file_location = os.path.join(UPLOAD_FOLDER, request.args.get('i') + ".zip")
    zip_folder_location = os.path.join(UPLOAD_FOLDER, request.args.get('i'))

    m = gtfs_to_full_map(zip_folder_location, f)
                
    a.session.map = m

    os.remove(zip_file_location)
    shutil.rmtree(zip_folder_location)
    
    return m.to_json()