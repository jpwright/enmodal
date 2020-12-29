import TransitSettings
import TransitGIS
import TransitModel
import json

from geopy.distance import great_circle

class Map(object):
    """A Map contains a collection of Services, everything needed for a single Transit session.

    Attributes:
        services: An array of Services.
    """

    def __init__(self, sid):
        self.sid = sid
        self.services = []
        self.sidf_state = 0
        self.settings = TransitSettings.Settings()
        self.model = TransitModel.Model(None, None)

    def add_service(self, s):
        self.services.append(s)
        
    def get_service_by_name(self, name):
        for service in self.services:
            if service.name == name:
                return service
        return None
        
    def get_service_by_id(self, sid):
        for service in self.services:
            if service.sid == sid:
                return service
        return None

    def get_service_by_gtfs_id(self, gtfs_id):
        for service in self.services:
            if service.gtfs_id == gtfs_id:
                return service
        if len(self.services) > 0:
            return self.services[0]
        return None
        
    def get_line_by_gtfs_id(self, gtfs_id):
        for service in self.services:
            l = service.get_line_by_gtfs_id(gtfs_id)
            if l is not None:
                return l
        return None

    def create_sid(self):
        self.sidf_state += 1
        return self.sidf_state
    
    def regenerate_all_ids(self):
        sid_map = {}
        
        for service in self.services:
            sid_map[service.sid] = self.create_sid()
            service.sid = sid_map[service.sid]
            for station in service.stations:
                sid_map[station.sid] = self.create_sid()
                station.sid = sid_map[station.sid]
            for line in service.lines:
                sid_map[line.sid] = self.create_sid()
                line.sid = sid_map[line.sid]
                for stop in line.stops:
                    sid_map[stop.sid] = self.create_sid()
                    stop.sid = sid_map[stop.sid]
                    stop.station_id = sid_map[stop.station_id]
                for edge in line.edges:
                    sid_map[edge.sid] = self.create_sid()
                    edge.sid = sid_map[edge.sid]
                    edge_stop_ids = []
                    for stop_id in edge.stop_ids:
                        edge_stop_ids.append(sid_map[stop_id])
                    edge.stop_ids = edge_stop_ids
            for transfer in service.transfers:
                sid_map[transfer.sid] = self.create_sid()
                transfer.sid = sid_map[transfer.sid]
                transfer_station_ids = []
                for station_id in transfer.station_ids:
                    transfer_station_ids.append(sid_map[station_id])
                transfer.station_ids = transfer_station_ids

        for station_pair in self.settings.station_pairs:
            station_pair.station_ids = [sid_map[station_pair.station_ids[0]], sid_map[station_pair.station_ids[1]]]

        #print sid_map

    def valid_station_pair(self, sp):
        valid = False
        for service in self.services:
            if (service.has_station_id(sp.station_ids[0]) and service.has_station_id(sp.station_ids[1])):
                valid = True
        return valid

    def to_json(self):
        return json.dumps(self, default=lambda o: o.__dict__, sort_keys=True)

    def from_json(self, j):
        self.sidf_state = int(j['sidf_state'])
        self.services = []
        for service in j['services']:
            s = Service(service['sid'], service['name'])
            s.from_json(service)
            # ignore services that are empty
            if len(s.lines) > 0 or len(s.stations) > 0:
                self.add_service(s)
        self.settings = TransitSettings.Settings()
        if 'settings' in j:
            try:
                self.settings.from_json(j['settings'])
                # purge invalid stationpairs
                purged = [x for x in self.settings.station_pairs if self.valid_station_pair(x)]
                self.settings.station_pairs = purged
            except:
                print("invalid settings!")
                pass
        

class Station(object):
    """A Station is a physical location consisting of one or more Stops.

    Attributes:
        name: A string representing the Station's name.
        location: A [lat, lng] pair describing the Station's physical location.
        streets: An array of strings containing nearby street names.
        neighborhood: The name of the neighborhood the Station is in, if applicable.
        locality: The name of the city or town the Station is in.
        region: The name of the state the Station is in.
        gids_in_range: An array of dggrid hexagons near this Station.
        stop_walking_times: A 2-dimensional array containing the walking times between each Stop.
    """

    def __init__(self, sid, name, location):
        self.sid = sid

        self.name = name
        self.location = [float(location[0]), float(location[1])]

        self.streets = []
        self.neighborhood = ""
        self.locality = ""
        self.region = ""
        self.hexagons = []
        self.hexagons_known = False
        self.stop_walking_times = []

        self.gtfs_id = None
        
    def set_hexagons(self, hexagons):
        self.hexagons = hexagons
        self.hexagons_known = True
        
    def clear_hexagons(self):
        self.hexagons_in_range = []
        self.hexagons_known = False

    def to_json(self):
        return json.dumps(self, default=lambda o: o.__dict__, sort_keys=True, indent=4)

    def from_json(self, j):
        if 'name' in j:
            self.name = j['name']
        self.location = [float(j['location'][0]), float(j['location'][1])]
        if 'streets' in j:
            self.streets = j['streets']
        if 'neighborhood' in j:
            self.neighborhood = j['neighborhood']
        if 'locality' in j:
            self.locality = j['locality']
        if 'region' in j:
            self.region = j['region']
        if 'hexagons_known' in j:
            self.hexagons_known = j['hexagons_known']
            if self.hexagons_known and 'hexagons' in j:
                hexagons = []
                for h in j['hexagons']:
                    hexagon = TransitGIS.Hexagon(int(h['gid']), h['geo_hex'], int(h['population']), int(h['employment']))
                    hexagons.append(hexagon)
                self.set_hexagons(hexagons)
        if 'stop_walking_times' in j:
            self.stop_walking_times = j['stop_walking_times']

class Stop(object):
    """A Stop represents a location at which a Line can stop.

    Attributes:
        station: The ID of the Station this stop is contained within.
    """

    def __init__(self, sid, station_id):
        self.sid = sid
        self.station_id = station_id
        self.gtfs_id = None

    def to_json(self):
        return json.dumps(self, default=lambda o: o.__dict__, sort_keys=True, indent=4)

    def from_json(self, j):
        self.station_id = int(j['station_id'])

class Line(object):
    """A Line represents a transit service. It consists of Stops connected by Edges.

    Attributes:
        name: A string representing the Line's name.
        stops: An array of Stops on this Line.
        edges: An array of Edges on this Line.
    """

    def __init__(self, sid, name):
        self.sid = sid
        self.name = name
        self.full_name = name
        self.color_bg = ""
        self.color_fg = ""

        self.stops = []
        self.edges = []

        self.gtfs_id = None

    def add_stop(self, stop):
        self.stops.append(stop)

    def remove_stop(self, stop):
        self.stops.remove(stop)

    def add_edge(self, edge):
        self.edges.append(edge)

    def remove_edge(self, edge):
        self.edges.remove(edge)
        
    def has_edge(self, edge):
        if edge in self.edges:
            return True
        else:
            return False
        
    def get_stop_by_id(self, stop_id):
        for stop in self.stops:
            if stop.sid == stop_id:
                return stop
        return None
        
    def has_station(self, s):
        for stop in self.stops:
            if stop.station_id == s.sid:
                return True
        return False
        
    def get_stop_from_station(self, s):
        for stop in self.stops:
            if stop.station_id == s.sid:
                return stop
        return None

    def has_edge_for_stops(self, stops):
        for edge in self.edges:
            match = True
            for stop in stops:
                if not edge.has_stop(stop):
                    match = False
            if match:
                return edge
        return None

    def edges_for_stop(self, stop):
        edges = []
        for edge in self.edges:
            if edge.has_stop(stop):
                edges.append(edge)
        return edges

    def edge_count_for_stop(self, stop):
        return len(self.edges_for_stop(stop))

    def neighbors(self, stop):
        # Returns all neighbors of the input stop.

        neighbors = []
        for i in range(0, len(self.edges)):
            edge = self.edges[i]
            if (edge.stop_ids[0] == stop.sid):
                neighbors.append(edge.stop_ids[1])
            if (edge.stop_ids[1] == stop.sid):
                neighbors.append(edge.stop_ids[0])
        
        return neighbors

    def paths_between_stops(self, stop_1, stop_2):
        
        dfs_stops = []
        dfs_paths = []
        visited = {}
        starter = stop_1

        # recursive DFS to find all the paths
        def dfs(v, target, l):
            # print "dfs v="+str(v.sid)+" t="+str(target.sid)
            # Add new stop
            dfs_stops.append(v)
            if v == target:
                dfs_paths.append(dfs_stops[:])
            else:
                visited[v.sid] = 1
                neighbors = l.neighbors(v)
                #print "neighbors for stop "+str(v.sid)
                #print neighbors
                for i in range(0, len(neighbors)):
                    if (neighbors[i] not in visited):
                        w = l.get_stop_by_id(neighbors[i])
                        dfs(w, target, l)
                
            dfs_stops.remove(v)
        
        dfs(stop_1, stop_2, self)

        return dfs_paths

    def condense(self):
        # Remove all loops.
        edges_removed = 1

        while edges_removed > 0:
            edges_to_remove = []
            for edge in self.edges:
                s1 = self.get_stop_by_id(edge.stop_ids[0])
                s2 = self.get_stop_by_id(edge.stop_ids[1])
                paths = self.paths_between_stops(s1, s2)
                #print "Between stops: " + str(s1.sid) + " and " + str(s2.sid)
                #print path
                if len(paths) > 1:
                    edges_to_remove.append(edge)

            for edge in edges_to_remove:
                self.edges.remove(edge)

            edges_removed = len(edges_to_remove)


    def to_json(self):
        return json.dumps(self, default=lambda o: o.__dict__, sort_keys=True, indent=4)

    def from_json(self, j, station_ids):
        self.name = j['name']
        self.full_name = j['full_name']
        self.color_bg = j['color_bg']
        self.color_fg = j['color_fg']
        self.stops = []
        stop_ids = []
        for stop in j['stops']:
            s = Stop(stop['sid'], stop['station_id'])
            s.from_json(stop)
            if int(stop['station_id']) in station_ids:
                self.add_stop(s)
                stop_ids.append(s.sid)
            else:
                print("bad stop")
                print(stop)
        self.edges = []
        for edge in j['edges']:
            if int(edge['stop_ids'][0]) in stop_ids and int(edge['stop_ids'][1]) in stop_ids:
                e = Edge(edge['sid'], edge['stop_ids'])
                e.from_json(edge)
                self.add_edge(e)
            else:
                print("bad edge on line "+self.name)
                print(edge)

class Edge(object):
    """An Edge is a connection between two Stops.

    Attributes:
        stops: An array (of size 2) containing the Stops connected by this Edge.
    """

    def __init__(self, sid, stop_ids):
        self.sid = sid
        self.stop_ids = []
        for stop_id in stop_ids:
            self.stop_ids.append(int(stop_id))
        
    def has_stop(self, stop):
        if stop.sid in self.stop_ids:
            return True
        else:
            return False
        
    def other_stop_id(self, stop):
        if not self.has_stop(stop):
            return None
        if self.stop_ids[0] == stop.sid:
            return self.stop_ids[1]
        if self.stop_ids[1] == stop.sid:
            return self.stop_ids[0]
        return None

    def to_json(self):
        return json.dumps(self, default=lambda o: o.__dict__, sort_keys=True, indent=4)

    def from_json(self, j):
        self.stop_ids = [int(j['stop_ids'][0]), int(j['stop_ids'][1])]

class Transfer(object):
    """A Transfer is a connection between two Stations.

    Attributes:
        stops: An array (of size 2) containing the Stations connected by this Transfer.
    """

    def __init__(self, sid, station_ids):
        self.sid = sid
        self.station_ids = station_ids
        
    def to_json(self):
        return json.dumps(self, default=lambda o: o.__dict__, sort_keys=True, indent=4)

    def from_json(self, j):
        self.station_ids = [int(j['station_ids'][0]), int(j['station_ids'][1])]

class Service(object):
    """A Service is a collection of Lines; most analogous to a single mode within a transit agency.

    Attributes:
        name: A string representing the Service's name.
        lines: An array of Lines within this Service.
    """

    def __init__(self, sid, name):
        self.sid = sid
        self.name = name
        self.lines = []
        self.stations = []
        self.transfers = []
        self.mode = ""

        self.gtfs_id = None

    def add_line(self, l):
        self.lines.append(l)
        
    def get_line_by_full_name(self, name):
        for line in self.lines:
            if line.full_name == name:
                return line
        return None

    def get_line_by_gtfs_id(self, gtfs_id):
        for line in self.lines:
            if line.gtfs_id == gtfs_id:
                return line
        return None

    def add_station(self, s):
        self.stations.append(s)

    def remove_station(self, s):
        for line in self.lines:
            stop = line.get_stop_from_station(s)
            if stop is not None:
                edges = line.edges_for_stop(stop)
                for edge in edges:
                    line.remove_edge(edge)
                line.remove_stop(stop)
        self.stations.remove(s)

    def has_station(self, i):
        for station in self.stations:
            if station.sid == i:
                return True
        return False
    
    def has_station_id(self, sid):
        for station in self.stations:
            if station.sid == sid:
                return True
        return False

    def get_station_by_id(self, sid):
        for station in self.stations:
            if station.sid == sid:
                return station
        return None

    def get_station_by_location(self, location):
        for station in self.stations:
            if station.location == location:
                return station
        return None

    def add_transfer(self, t):
        self.transfers.append(t)
        
    def remove_transfer(self, t):
        self.transfers.remove(t)

    def station_edge_count(self, station):
        ec = 0
        for line in self.lines:
            stop = line.get_stop_from_station(station)
            if stop is not None:
                ec += line.edge_count_for_stop(stop)
        return ec
    
    def get_stop_neighbors(self, line, stop):
        neighbors = {}
        for edge in line.edges:
            if edge.has_stop(stop):
                neighbor_id = edge.other_stop_id(stop)
                neighbor = line.get_stop_by_id(neighbor_id)
                neighbors[neighbor] = self.edge_length(edge)
        return neighbors
    
    def station_neighbors(self, s):
        neighbors = {}
        for line in self.lines:
            if line.has_station(s):
                stop = line.get_stop_from_station(s)
                stop_neighbors = self.get_stop_neighbors(line, stop)
                for neighbor in stop_neighbors:
                    neighbor_station = self.get_station_by_id(neighbor.station_id)
                    if neighbor_station not in neighbors:
                        neighbors[neighbor_station] = stop_neighbors[neighbor]
        return neighbors

    def edge_length(self, edge):
        stop_ids = edge.stop_ids
        for line in self.lines:
            if line.has_edge(edge):
                station_a = self.find_station(line.get_stop_by_id(stop_ids[0]).station_id)
                station_b = self.find_station(line.get_stop_by_id(stop_ids[1]).station_id)
                return great_circle((station_a.location[0], station_a.location[1]), (station_b.location[0], station_b.location[1])).miles
        return None
                

    def to_json(self):
        return json.dumps(self, default=lambda o: o.__dict__, sort_keys=True, indent=4)

    def from_json(self, j):
        self.name = j['name']
        self.stations = []
        station_ids = []
        for station in j['stations']:
            # Possible for the station name to be missing, if we are deserializing during geolocation!
            if 'name' in station:
                station_name = station['name']
            else:
                station_name = 'undefined'
                
            s = Station(station['sid'], station_name, station['location'])
            s.from_json(station)
            self.add_station(s)
            station_ids.append(s.sid)
        for line in j['lines']:
            l = Line(line['sid'], line['name'])
            l.from_json(line, station_ids)
            self.add_line(l)
        if 'transfers' in j:
            for transfer in j['transfers']:
                t = Transfer(transfer['sid'], transfer['station_ids'])
                t.from_json(transfer)
                self.add_transfer(t)
        if 'mode' in j:
            self.mode = j['mode']
        else:
            self.mode = "heavy_rail"
