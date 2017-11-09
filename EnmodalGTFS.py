from flask import Flask, Blueprint, request, url_for, send_from_directory
from werkzeug.utils import secure_filename
import sys
import os
import csv
import zipfile

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__))))
from EnmodalSessions import *
from EnmodalMap import *

from lzstring import LZString
import json

import psycopg2
import psycopg2.extras

import ConfigParser
config = ConfigParser.RawConfigParser()
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
        file.save(os.path.join(UPLOAD_FOLDER, filename))
        return json.dumps({"result": "OK", "message": url_for('enmodal_gtfs.uploaded_file', filename=filename)})
    else:
        return json.dumps({"result": "error", "message": "Bad file."})

AGENCY_PROPERTIES = ['agency_id', 'agency_name']
ROUTE_PROPERTIES = ['route_id', 'route_short_name', 'route_long_name', 'route_color', 'route_text_color']

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

    agency_file = open(os.path.join(zip_folder_location, 'agency.txt'), 'rb')
    agency_reader = csv.DictReader(agency_file)
    stops_file = open(os.path.join(zip_folder_location, 'stops.txt'), 'rb')
    stops_reader = csv.DictReader(stops_file)
    routes_file = open(os.path.join(zip_folder_location, 'routes.txt'), 'rb')
    routes_reader = csv.DictReader(routes_file)
    trips_file = open(os.path.join(zip_folder_location, 'trips.txt'), 'rb')
    trips_reader = csv.DictReader(trips_file)
    stop_times_file = open(os.path.join(zip_folder_location, 'stop_times.txt'), 'rb')
    stop_times_reader = csv.DictReader(stop_times_file)

    agencies = []
    for agency in agency_reader:
        a = {}
        for agency_property in AGENCY_PROPERTIES:
            if agency_property in agency:
                a[agency_property] = agency[agency_property]
        a['routes'] = []
        if 'agency_id' not in a:
            a['agency_id'] = a['agency_name']
        agencies.append(a)

    for route in routes_reader:
        agency = agencies[0]
        if 'agency_id' in route:
            agency_id = route['agency_id']
            results = filter(lambda a: a['agency_id'] == agency_id, agencies)
            if len(results) > 0:
                agency = results[0]

        r = {}
        for route_property in ROUTE_PROPERTIES:
            if route_property in route:
                r[route_property] = route[route_property]

        color_bg = "AAAAAA"
        if 'route_color' in r:
            if len(r['route_color']) > 0:
                color_bg = r['route_color']
        r['color_bg'] = "#"+color_bg
        
        color_fg = "FFFFFF"
        if 'route_text_color' in r:
            if len(r['route_text_color']) > 0:
                color_fg = r['route_text_color']
        r['color_fg'] = "#"+color_fg

        agency['routes'].append(r)

    for agency in agencies:
        agency['routes'] = sorted(agency['routes'], key=lambda k: k['route_long_name'])

    agencies = sorted(agencies, key=lambda k: k['agency_name'])

    return json.dumps(agencies)

        
@enmodal_gtfs.route('/gtfs_import')
def route_session_load():
    h = int(request.args.get('i'), 16)
    e = check_for_session_errors(h)
    if e:
        return e
    
    a = session_manager.auth_by_key(h)
    m = a.session.map
    m.regenerate_all_ids()

    agency_file = open('data/gtfs/santacruz/agency.txt', 'rb')
    agency_reader = csv.DictReader(agency_file)
    stops_file = open('data/gtfs/santacruz/stops.txt', 'rb')
    stops_reader = csv.DictReader(stops_file)
    routes_file = open('data/gtfs/santacruz/routes.txt', 'rb')
    routes_reader = csv.DictReader(routes_file)
    trips_file = open('data/gtfs/santacruz/trips.txt', 'rb')
    trips_reader = csv.DictReader(trips_file)
    stop_times_file = open('data/gtfs/santacruz/stop_times.txt', 'rb')
    stop_times_reader = csv.DictReader(stop_times_file)
    
    print "Reading agency"
    agency_id_to_service_id = {}
    primary_agency_id = None
    primary_service_id = None
    for agency in agency_reader:
        print "Agency: " + agency['agency_name']
        service = m.get_service_by_name(agency['agency_name'])
        if service is None:
            print "Not found, adding"
            service = Transit.Service(m.create_sid(), agency['agency_name'])
            m.add_service(service)
        
        if 'agency_id' in agency:
            agency_id = agency['agency_id']
        else:
            agency_id = agency['agency_name']
        agency_id_to_service_id[agency_id] = service.sid
        if primary_agency_id is None:
            primary_agency_id = agency_id
        if primary_service_id is None:
            primary_service_id = service.sid
    
    print agency_id_to_service_id
    
    print "Reading stops"
    stops = {}
    for stop in stops_reader:
        stops[stop['stop_id']] = stop
    
    print "Reading trips"
    route_id_to_trip_id = {}
    for trip in trips_reader:
        route_id = trip['route_id']
        if route_id in route_id_to_trip_id:
            route_id_to_trip_id[route_id].append(trip['trip_id'])
        else:
            route_id_to_trip_id[route_id] = [trip['trip_id']]
            
    print "Reading stop times"
    trip_id_to_stop_ids = {}
    for stop_time in stop_times_reader:
        trip_id = stop_time['trip_id']
        if trip_id in trip_id_to_stop_ids:
            trip_id_to_stop_ids[trip_id].append(stop_time['stop_id'])
        else:
            trip_id_to_stop_ids[trip_id] = [stop_time['stop_id']]
    
    stops_to_station_ids = {}
    
    print "Reading routes"
    for route in routes_reader:
        #print(route['route_long_name'])
        
        # Only use routes with at least 1 trip
        if route['route_id'] in route_id_to_trip_id:
            # For now just use the first trip
            trip_id = route_id_to_trip_id[route['route_id']][0]
            
            trip_stops = trip_id_to_stop_ids[trip_id]
            #print(str(len(trip_stops))+" stops")
            
            if 'agency_id' in route:
                agency_id = route['agency_id']
            else:
                agency_id = primary_agency_id
                
            # Ideally this is populated and can convert agency to service
            if agency_id in agency_id_to_service_id:
                service_id = agency_id_to_service_id[agency_id]
            # If not use primary service
            else:
                service_id = primary_service_id
            
            service = m.get_service_by_id(service_id)
            
            line_name = route['route_short_name']
            if len(line_name) == 0:
                line_name = "Line"
            line_full_name = route['route_long_name']
            if len(line_full_name) == 0:
                line_full_name = line_name
            if line_name == "Line":
                line_name = line_full_name
            
            line = service.get_line_by_full_name(line_full_name)
            if line is None:
                line = Transit.Line(m.create_sid(), line_name)
                service.add_line(line)
            line.name = line_name
            line.full_name = line_full_name
            
            # Set colors
            color_bg = "AAAAAA"
            if 'route_color' in route:
                if len(route['route_color']) > 0:
                    color_bg = route['route_color']
            line.color_bg = "#"+color_bg
            
            color_fg = "FFFFFF"
            if 'route_text_color' in route:
                if len(route['route_text_color']) > 0:
                    color_fg = route['route_text_color']
            line.color_fg = "#"+color_fg
            
            last_stop_id = None
            for stop_id in trip_stops:
                if stop_id in stops_to_station_ids:
                    station_id = stops_to_station_ids[stop_id]
                    station = service.get_station_by_id(station_id)
                else:
                    stop = stops[stop_id]
                    lat = float(stop['stop_lat'])
                    lng = float(stop['stop_lon'])
                    station = service.get_station_by_location([lat, lng])
                    if station is None:
                        station = Transit.Station(m.create_sid(), stop['stop_name'], [lat, lng])
                        service.add_station(station)
                    station.name = stop['stop_name']
                    stops_to_station_ids['stop_id'] = station.sid
                
                stop = Transit.Stop(m.create_sid(), station.sid)
                line.add_stop(stop)
                
                if last_stop_id is not None:
                    edge = Transit.Edge(m.create_sid(), [stop.sid, last_stop_id])
                    line.add_edge(edge)
                last_stop_id = stop.sid
                
    a.session.map = m
    save_session(a.session, 0, True)
    
    
    stops_file.close()
    routes_file.close()
    trips_file.close()
    stop_times_file.close()
    
    return json.dumps({"result": "OK"})