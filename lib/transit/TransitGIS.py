import psycopg2
import psycopg2.extras

import requests
import json
import re
import os

import Transit
import ConfigParser

config = ConfigParser.RawConfigParser()
config.read(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'settings.cfg')))
DGGRID_HOST = config.get('dggrid', 'host')
DGGRID_PORT = config.get('dggrid', 'port')
DGGRID_DBNAME = config.get('dggrid', 'dbname')
DGGRID_USER = config.get('dggrid', 'user')
DGGRID_PASSWORD = config.get('dggrid', 'password')
DGGRID_CONN_STRING = "host='"+DGGRID_HOST+"' port='"+DGGRID_PORT+"' dbname='"+DGGRID_DBNAME+"' user='"+DGGRID_USER+"' password='"+DGGRID_PASSWORD+"'"

class HexagonRegion(object):
    
    def __init__(self):
        self.hexagons = []
        
    def add_hexagon(self, h):
        self.hexagons.append(h)
        
    def has_hexagon(self, h):
        if h in self.hexagons:
            return True
        else:
            return False
        
    def num_hexagons(self):
        return len(self.hexagons)
    
    def get_hexagon_by_gid(self, gid):
        for h in self.hexagons:
            if h.gid == gid:
                return h
        return None
    
    def geojson(self):
        features = []
        for hexagon in self.hexagons:
            features.append({"type": "Feature", "geometry": hexagon.geo, "properties": {"population": hexagon.population, "employment": hexagon.employment}})
        return {"type": "FeatureCollection", "features": features}
    
    def to_json(self):
        return json.dumps(self, default=lambda o: o.__dict__, sort_keys=True)

class Hexagon(object):
    
    def __init__(self, gid, geo, population, employment):
        self.gid = gid
        self.geo = geo
        self.population = population
        self.employment = employment
        
    def center(self):
        lat = 0
        lng = 0
        for coordinate in self.geo["coordinates"][0]:
            lat += coordinate[1]
            lng += coordinate[0]
            
        lat = lat / len(self.geo["coordinates"][0])
        lng = lng / len(self.geo["coordinates"][0])
        
        return (lat, lng)
        
    def to_json(self):
        return json.dumps(self, default=lambda o: o.__dict__, sort_keys=True)
    
class BoundingBox(object):
    
    def __init__(self):
        self.min_lat = 0
        self.max_lat = 0
        self.min_lng = 0
        self.max_lng = 0
        
    def set_bounds(self, min_lat, max_lat, min_lng, max_lng):
        self.min_lat = min_lat
        self.max_lat = max_lat
        self.min_lng = min_lng
        self.max_lng = max_lng
        
    def set_from_map(self, m):
        min_lat_set = False
        max_lat_set = False
        min_lng_set = False
        max_lng_set = False
    
        for s in m.services:
            stations = s.stations
            for station in stations:
                if not min_lat_set or station.location[0] < self.min_lat:
                    self.min_lat = station.location[0]
                    min_lat_set = True
                if not max_lat_set or station.location[0] > self.max_lat:
                    self.max_lat = station.location[0]
                    max_lat_set = True
                if not min_lng_set or station.location[1] < self.min_lng:
                    self.min_lng = station.location[1]
                    min_lng_set = True
                if not max_lng_set or station.location[1] > self.max_lng:
                    self.max_lng = station.location[1]
                    max_lng_set = True

def hexagons_bb(bb):

    conn = psycopg2.connect(DGGRID_CONN_STRING)
    cursor = conn.cursor('cursor_unique_name', cursor_factory=psycopg2.extras.DictCursor)
     
    query = "SELECT gid, ST_AsGeoJSON(geo), population, employment FROM dggrid WHERE ST_CoveredBy(geo, ST_MakeEnvelope("+str(bb.min_lng)+", "+str(bb.min_lat)+", "+str(bb.max_lng)+", "+str(bb.max_lat)+")) LIMIT 10000"
    print query
    cursor.execute(query)
    #cursor.execute("SELECT gid FROM dggrid WHERE ST_DWithin(geo, 'POINT("+lng+" "+lat+")', 0.01) LIMIT 1000;")
    #cursor.execute("SELECT * FROM dggrid ORDER BY geo <-> st_setsrid(st_makepoint("+lng+","+lat+"),4326) LIMIT 100;")

    region = HexagonRegion()
    for row in cursor:
        region.add_hexagon(Hexagon(int(row[0]), json.loads(row[1]), int(row[2]), int(row[3])))
    cursor.close()
    conn.close()
    
    return region

def station_constructor(sid, lat, lng):
    
    MAPZEN_API_KEY = "mapzen-t6h4cff"
    mapzen_uri = "https://search.mapzen.com/v1/reverse?api_key="+MAPZEN_API_KEY+"&point.lat="+lat+"&point.lon="+lng+"&size=1&layers=address"
    
    geocode = requests.get(mapzen_uri)
    geocode_content = json.loads(geocode.content)
    
    name = ""
    streets = []
    neighborhood = ""
    locality = ""
    region = ""
    
    if (len(geocode_content["features"]) < 1):
        # Flag an error?
        print "Error in reverse geocoding"
    else:
        properties = geocode_content["features"][0]["properties"]
        
        has_street = False
        has_locality = False
        has_neighborhood = False
        
        if ("street" in properties):
            streets = [properties["street"]]
            has_street = True
        if ("locality" in properties):
            locality = properties["locality"]
            has_locality = True
        if ("borough" in properties):
            locality = properties["borough"]
            has_locality = True
        if ("neighbourhood" in properties):
            neighborhood = properties["neighbourhood"]
            has_neighborhood = True
        
        if (has_street):
            name = properties["street"]
        elif (has_neighborhood):
            name = properties["neighbourhood"]
        elif (has_locality):
            name = properties["locality"]
        else:
            name = "Station"
        if len(name) <= 1:
            name = "Station"
    
        name = re.sub(r'(\w+\s)\b(Street)\b', r'\1St', name)
        name = re.sub(r'(\w+\s)\b(Road)\b', r'\1Rd', name)
        name = re.sub(r'(\w+\s)\b(Drive)\b', r'\1Dr', name)
        name = re.sub(r'(\w+\s)\b(Avenue)\b', r'\1Av', name)
        name = re.sub(r'(\w+\s)\b(Lane)\b', r'\1Ln', name)
        name = re.sub(r'(\w+\s)\b(Boulevard)\b', r'\1Blvd', name)
    
    s = Transit.Station(sid, name, [lat, lng])
    s.streets = streets
    s.neighborhood = neighborhood
    s.locality = locality
    s.region = region
    
    return s
