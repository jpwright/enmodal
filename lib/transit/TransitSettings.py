import json
import Transit

class Pin(object):
    
    def __init__(self):
        self.location = []
        
    def to_json(self):
        return json.dumps(self, default=lambda o: o.__dict__, sort_keys=True)
        
    def from_json(self, j):
        self.location = [float(j["location"][0]), float(j["location"][1])]

class StationPair(object):
    
    def __init__(self, station_1, station_2):
        self.station_ids = [station_1, station_2]
        self.pins = []
        
    def has_stations(self, s1, s2):
        if (self.station_ids[0] == s1 and self.station_ids[1] == s2) or (self.station_ids[1] == s1 and self.station_ids[0] == s2):
            return True
        else:
            return False
        
    def add_pin(self, pin):
        self.pins.append(pin)
        
    def set_pins(self, pins):
        self.pins = pins
        
    def to_json(self):
        return json.dumps(self, default=lambda o: o.__dict__, sort_keys=True)
        
    def from_json(self, j):
        self.station_ids = j["station_ids"]
        for pin in j["pins"]:
            p = Pin()
            p.from_json(pin)
            self.add_pin(p)
        

class Settings(object):
    """A Map contains a collection of Services, everything needed for a single Transit session.

    Attributes:
        services: An array of Services.
    """

    def __init__(self):
        self.station_pairs = []

    def config_station_pair(self, s1, s2, pins):
        station_pair_found = False
        for station_pair in self.station_pairs:
            if station_pair.has_stations(s1, s2):
                station_pair_found = True
                station_pair.set_pins(pins)
        if not station_pair_found:
            sp = StationPair(s1, s2)
            sp.set_pins(pins)
            self.station_pairs.append(sp)

    def to_json(self):
        return json.dumps(self, default=lambda o: o.__dict__, sort_keys=True)

    def from_json(self, j):
        self.station_pairs = []
        for station_pair in j['station_pairs']:
            s = StationPair(station_pair['station_ids'][0], station_pair['station_ids'][1])
            s.from_json(station_pair)
            self.station_pairs.append(s)