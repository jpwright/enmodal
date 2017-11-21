class Map {
    /*
     * A Map contains a collection of Services, everything needed for a single Transit session.
     *
     * Attributes:
     *  services: An array of Services.
     */

    constructor() {
        this.sid = _id_factory.id();
        this.services = [];
    }

    add_service(s) {
        this.services.push(s);
    }

    primary_service() {
        return this.services[0];
    }
    
    get_service_by_id(id) {
        for (var i = 0; i < this.services.length; i++) {
            if (this.services[i].sid == id) return this.services[i];
        }
        return null;
    }
    
    // Check all services for a station
    get_station_by_id(id) {
        for (var i = 0; i < this.services.length; i++) {
            var station = this.services[i].get_station_by_id(id);
            if (station !== null) return station;
        }
        return null;
    }
    
    geographic_bounds() {
        var lat_min = 0.0;
        var lat_min_set = false;
        var lat_max = 0.0;
        var lat_max_set = false;
        var lng_min = 0.0;
        var lng_min_set = false;
        var lng_max = 0.0;
        var lng_max_set = false;
        var num_stations = 0;

        for (var i = 0; i < this.services.length; i++) {
            for (var j = 0; j < this.services[i].stations.length; j++) {
                var station = this.services[i].stations[j];
                num_stations += 1;
                if (!lat_min_set || station.location[0] < lat_min) {
                    lat_min = station.location[0];
                    lat_min_set = true;
                }
                if (!lat_max_set || station.location[0] > lat_max) {
                    lat_max = station.location[0];
                    lat_max_set = true;
                }
                if (!lng_min_set || station.location[1] < lng_min) {
                    lng_min = station.location[1];
                    lng_min_set = true;
                }
                if (!lng_max_set || station.location[1] > lng_max) {
                    lng_max = station.location[1];
                    lng_max_set = true;
                }
            }
        }
        if (num_stations === 0) return null;
        
        var bounds = L.latLngBounds(L.latLng(lat_min, lng_min), L.latLng(lat_max, lng_max));
        return bounds;
    }

    to_json() {
        return JSON.stringify(this);
    }

    from_json(j) {
        this.sid = j.sid;
        this.services = [];
        for (var i = 0; i < j.services.length; i++) {
            var s = new Service(j.services[i].name);
            s.sid = j.services[i].sid;
            s.from_json(j.services[i]);
            this.add_service(s);
        }
    }
}

class Station {
    /*
     * A Station is a physical location consisting of one or more Stops.
     *
     * Attributes:
     *  name: A string representing the Station's name.
     *  location: A [lat, lng] pair describing the Station's physical location.
     *  streets: An array of strings containing nearby street names.
     *  neighborhood: The name of the neighborhood the Station is in, if applicable.
     *  locality: The name of the city or town the Station is in.
     *  region: The name of the state the Station is in.
     */

    constructor(name, location, preview) {
        if (preview === undefined || preview === false) {
            this.sid = _id_factory.id();
        } else {
            this.sid = 0;
        }
        this.name = name;
        this.location = location;
        this.streets = [];
        this.neighborhood = "";
        this.locality = "";
        this.region = "";
        this.ridership = -1;
    }

    move_to(lat, lng) {
        this.location = [lat, lng];
    }

    to_json() {
        return JSON.stringify(this);
    }

    from_json(j) {
        this.sid = j.sid;
        this.name = j.name;
        this.location = [parseFloat(j.location[0]), parseFloat(j.location[1])];
        this.streets = j.streets;
        this.neighborhood = j.neighborhood;
        this.locality = j.locality;
        this.region = j.region;
    }
}

class Stop {
    /*
     * A Stop represents a location at which a Line can stop.
     *
     * Attributes:
     *  station: The Station this stop is contained within.
     */

    constructor(station, preview) {
        if (preview === undefined || preview === false) {
            this.sid = _id_factory.id();
        } else {
            this.sid = 0;
        }
        this.station = station;
    }

    toJSON() {
        return {"sid": this.sid, "station_id": this.station.sid};
        //return JSON.stringify(this);
    }

    from_json(j, service) {
        this.sid = j.sid;
        this.station = service.get_station_by_id(j.station_id);
        if (this.station === undefined) {
            console.log(j);
        }
    }
}

class Line {
    /*
     * A Line represents a transit service. It consists of Stops connected by Edges.
     *
     * Attributes:
     *  name: A string representing the Line's name.
     *  long_name: A string representing the Line's full name.
     *  color_bg: Hex code for the Line's background color.
     *  color_fg: Hex code for the Line's foreground color.
     *  group_id: A unique identifier, used for grouping Lines when drawing.
     *  stops: An array of Stops on this Line.
     *  edges: An array of Edges on this Line.
     */

    constructor(name) {
        this.sid = _id_factory.id();
        this.name = name;
        this.full_name = name;
        this.color_bg = "#000000";
        this.color_fg = "#FFFFFF";
        this.group_id = 0;
        this.stops = [];
        this.edges = [];
    }

    add_stop(stop) {
        this.stops.push(stop);
    }

    remove_stop(stop) {
        var stop_index = this.stops.indexOf(stop);
        if (stop_index > -1) {
            this.stops.splice(stop_index, 1);
        }
    }

    has_stop(stop) {
        for (var i = 0; i < this.stops.length; i++) {
            if (this.stops[i].sid == stop.sid) {
                return true;
            }
        }
        return false;
    }

    get_stop_by_id(id) {
        for (var i = 0; i < this.stops.length; i++) {
            if (this.stops[i].sid == id) {
                return this.stops[i];
            }
        }
        return null;
    }

    get_stops_by_station(station) {
        var stops = [];
        for (var i = 0; i < this.stops.length; i++) {
            if (this.stops[i].station.sid == station.sid) {
                stops.push(this.stops[i]);
            }
        }
        return stops;
    }

    has_station(station) {
        for (var i = 0; i < this.stops.length; i++) {
            if (this.stops[i].station.sid == station.sid) {
                return true;
            }
        }
        return false;
    }

    add_edge(edge) {
        this.edges.push(edge);
    }

    remove_edge(edge) {
        var edge_index = this.edges.indexOf(edge);
        if (edge_index > -1) {
            this.edges.splice(edge_index, 1);
        }
    }
    
    has_edge(edge) {
        for (var i = 0; i < this.edges.length; i++) {
            if (this.edges[i].sid == edge.sid) {
                return true;
            }
        }
        return false;
    }

    get_edge_by_id(id) {
        for (var i = 0; i < this.edges.length; i++) {
            if (this.edges[i].sid == id) {
                return this.edges[i];
            }
        }
        return null;
    }

    get_edge_by_stops(stops) {
        for (var i = 0; i < this.edges.length; i++) {
            if (this.edges[i].compare_stops(stops)) {
                return this.edges[i];
            }
        }
        return null;
    }

    length() {
        var distance = 0.0;
        for (var i = 0; i < this.edges.length; i++) {
            distance += this.edges[i].length();
        }
        return distance;
    }

    neighbors(stop) {
        // Returns all neighbors of the input stop.

        var neighbors = [];
        for (var i = 0; i < this.edges.length; i++) {
            var edge = this.edges[i];
            if (edge.stops[0].sid == stop.sid) {
                neighbors.push(edge.stops[1]);
            }
            if (edge.stops[1].sid == stop.sid) {
                neighbors.push(edge.stops[0]);
            }
        }
        return neighbors;
    }

    dijkstra(source) {
        // Returns a 2D array containing the distance between
        // a source stop and all other stops.

        var distance = {};
        var visited = {};

        for (var i = 0; i < this.stops.length; i++) {
            distance[this.stops[i].sid] = 0;
            visited[this.stops[i].sid] = 0;
        }

        distance[source.sid] = 0;
        visited[source.sid] = 1;

        // TODO optimize this iterator...
        for (i = 0; i < this.stops.length; i++) {
            var neighbors = this.neighbors(this.stops[i]);
            for (var j = 0; j < neighbors.length; j++) {
                var alt = distance[this.stops[i].sid] + 1;
                if (alt < distance[neighbors[j].sid] || !visited[neighbors[j].sid]) {
                    distance[neighbors[j].sid] = alt;
                    visited[neighbors[j].sid] = 1;
                }
            }
        }

        return distance;
    }

    center_stop() {
        // This function returns the Jordan center of the line, i.e.
        // the set of stops where the greatest distance to all other
        // stops is minimized.

        var best_length = -1;
        var center_stops = [];

        for (var i = 0; i < this.stops.length; i++) {
            var stop = this.stops[i];
            var djikstra = this.dijkstra(stop);
            var sum_distance = 0;
            for (var j in djikstra) {
                sum_distance += djikstra[j];
            }
            if (sum_distance < best_length || best_length == -1) {
                best_length = sum_distance;
                center_stops = [stop];
            }
            else if (sum_distance == best_length) {
                center_stops.push(stop);
            }
        }

        return center_stops;
    }

    outer_stops() {
        // This returns the set of stops connected by only one edge.

        var outer_stops = [];
        var inner_stops = [];

        // If we don't have any stops, we don't have any outer stops.
        if (this.stops.length === 0) {
            return [];
        }

        // If we only have one stop, it's the only outer stop.
        if (this.stops.length == 1) {
            return [this.stops[0]];
        }

        // Otherwise, we should probably have at least one edge to work with.
        for (var i = 0; i < this.edges.length; i++) {
            var edge = this.edges[i];
            for (var j = 0; j < edge.stops.length; j++) {
                var stop = edge.stops[j];
                var outer_stop_index = outer_stops.indexOf(stop);
                var inner_stop_index = inner_stops.indexOf(stop);

                if (inner_stop_index == -1 && outer_stop_index == -1) {
                    // First time encountering this stop
                    outer_stops.push(stop);
                }
                if (inner_stop_index == -1 && outer_stop_index > -1) {
                    // Second time encountering this stop
                    outer_stops.splice(outer_stop_index, 1);
                    inner_stops.push(stop);
                }
            }
        }
        
        // If we still have no outer stops (maybe a loop in the line) just give the first stop.
        if (outer_stops.length === 0) return [this.stops[0]];

        return outer_stops;
    }
    
    path_between_stops(stop_1, stop_2) {
        
        var dfs_stops = [];
        var dfs_path = [];
        var dfs_path_found = false;
        var visited = {};

        var max_depth = 10;

        // recursive DFS to find all the paths
        function dfs(v, target, l) {
            //console.log("DFS: node "+v.station.name);

            // Add new stop.
            dfs_stops.push(v);
            if (v == target) {
                dfs_path_found = true;
                dfs_path = dfs_stops;
            }

            visited[v.sid] = 1;
            var neighbors = l.neighbors(v);
            for (var i = 0; i < neighbors.length; i++) {
                var w = neighbors[i];
                if (!visited[w.sid] && !dfs_path_found) {
                    dfs(w, target, l);
                }
            }
            if (!dfs_path_found) {
                var v_i = dfs_stops.indexOf(v);
                dfs_stops.splice(v_i, 1);
            }
        }
        
        dfs(stop_1, stop_2, this);
        return dfs_path_found;
    }

    overlapping_stops(stop) {
        for (var i = 0; i < this.stops.length; i++) {
            if (stop.station.sid == this.stops[i].station.sid) {
                return this.stops[i];
            }
        }
        return null;
    }
    
    remove_self_edges() {
        var edges_removed = [];
        for (var l = 0; l < this.edges.length; l++) {
            var edge = this.edges[l];
            if (edge.stops[0].sid == edge.stops[1].sid) {
                edges_removed.push(edge);
                this.remove_edge(edge);
            }
        }
        return edges_removed;
    }
    
    remove_duplicate_edges() {
        var edges_removed = [];
        for (var i = 0; i < this.edges.length; i++) {
            var edge = this.edges[i];
            for (var j = 0; j < this.edges.length; j++) {
                var edge_c = this.edges[j];
                if (edge != edge_c && edge.compare_stops(edge_c.stops)) {
                    if (edges_removed.indexOf(edge) == -1) edges_removed.push(edge);
                }
            }
        }
        for (i = 0; i < edges_removed.length; i++) {
            this.remove_edge(edges_removed[i]);
        }
        return edges_removed;
    }

    toJSON() {
        var stops_json = [];
        for (var i = 0; i < this.stops.length; i++) {
            //stops_json.push(this.stops[i].sid);
            stops_json.push(this.stops[i]);
        }
        return {"sid": this.sid, "name": this.name, "full_name": this.full_name, "color_bg": this.color_bg, "color_fg": this.color_fg, "group_id": this.group_id, "stops": stops_json, "edges": this.edges};
        //return JSON.stringify(this);
    }

    from_json(j, service) {
        this.sid = j.sid;
        this.name = j.name;
        this.full_name = j.full_name;
        this.color_bg = j.color_bg;
        this.color_fg = j.color_fg;
        this.stops = [];
        for (var i = 0; i < j.stops.length; i++) {
            var s = new Stop(service.get_station_by_id(j.stops[i].station_id));
            s.sid = j.stops[i].sid;
            s.from_json(j.stops[i], service);
            this.add_stop(s);
        }
        this.edges = [];
        for (i = 0; i < j.edges.length; i++) {
            var e = new Edge([]);
            e.sid = j.edges[i].sid;
            e.from_json(j.edges[i], this);
            this.add_edge(e);
        }
    }
}

class Edge {
    /*
     * An Edge is a connection between two Stops.
     *
     * Attributes:
     *  stops: An array (of size 2) containing the Stops connected by this Edge.
     *  path: An EdgePath used to represent this edge.
     */

    constructor(stops, preview) {
        if (preview === undefined || preview === false) {
            this.sid = _id_factory.id();
        } else {
            this.sid = 0;
        }
        this.stops = stops;
        this.path = null;
    }

    length() {
        var location_0 = this.stops[0].station.location;
        var location_1 = this.stops[1].station.location;
        var latlng_0 = L.latLng(location_0[0], location_0[1]);
        var latlng_1 = L.latLng(location_1[0], location_1[1]);

        return latlng_0.distanceTo(latlng_1);
    }

    has_stop(stop) {
        if (this.stops[0].sid == stop.sid || this.stops[1].sid == stop.sid) {
            return true;
        } else {
            return false;
        }
    }
    
    has_station(station) {
        if (this.stops[0].station.sid == station.sid || this.stops[1].station.sid == station.sid) {
            return true;
        } else {
            return false;
        }
    }

    compare_stops(s) {
        if (s[0].sid == this.stops[0].sid && s[1].sid == this.stops[1].sid) return 1;
        if (s[0].sid == this.stops[1].sid && s[1].sid == this.stops[0].sid) return 2;
        return 0;
    }

    toJSON() {
        return {"sid": this.sid, "stop_ids": [this.stops[0].sid, this.stops[1].sid]};
    }

    from_json(j, line) {
        this.sid = j.sid;
        this.stops = [];
        for (var i = 0; i < j.stop_ids.length; i++) {
            this.stops.push(line.get_stop_by_id(j.stop_ids[i]));
        }
    }
}

class Transfer {
    /*
     * A Transfer represents an in-system connection between two Stations.
     *
     * Attributes:
     *  stations: array of connected Stations
     */
    constructor(stations) {
        this.sid = _id_factory.id();
        this.stations = stations;
    }
    
    has_station(station) {
        if (this.stations.indexOf(station) > -1) {
            return true;
        } else {
            return false;
        }
    }
    
    toJSON() {
        return {"sid": this.sid, "station_ids": [this.stations[0].sid, this.stations[1].sid]};
    }

    from_json(j, service) {
        this.sid = j.sid;
        this.stations = [];
        for (var i = 0; i < j.station_ids.length; i++) {
            this.stations.push(service.get_station_by_id(j.station_ids[i]));
        }
    }
}

class Service {
    /*
     * A Service is a collection of Lines; most analogous to a single mode within a transit agency.
     *
     * Attributes:
     *  name: A string representing the Service's name.
     *  lines: An array of Lines within this Service.
     */

    constructor(name) {
        this.sid = _id_factory.id();
        this.name = name;
        this.lines = [];
        this.stations = [];
        this.transfers = [];
        this.mode = "";
    }

    add_line(l) {
        this.lines.push(l);
    }

    get_line_by_id(id) {
        for (var i = 0; i < this.lines.length; i++) {
            if (this.lines[i].sid == id) {
                return this.lines[i];
            }
        }
        return null;
    }

    get_line_by_stop(stop) {
        for (var i = 0; i < this.lines.length; i++) {
            if (this.lines[i].has_stop(stop)) {
                return this.lines[i];
            }
        }
        return null;
    }
    
    has_edge_for_stations(station_1, station_2) {
        for (var i = 0; i < this.lines.length; i++) {
            var stops_1 = this.lines[i].get_stops_by_station(station_1);
            var stops_2 = this.lines[i].get_stops_by_station(station_2);
            for (var j = 0; j < stops_1.length; j++) {
                for (var k = 0; k < stops_2.length; k++) {
                    var edge = this.lines[i].get_edge_by_stops([stops_1[j], stops_2[k]]);
                    if (edge !== null) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    add_station(s) {
        this.stations.push(s);
    }

    get_station_by_id(id) {
        for (var i = 0; i < this.stations.length; i++) {
            if (this.stations[i].sid == id) {
                return this.stations[i];
            }
        }
        return null;
    }

    station_lines(station) {
        var lines = [];

        for (var i = 0; i < this.lines.length; i++) {
            var line = this.lines[i];
            for (var j = 0; j < line.stops.length; j++) {
                var stop = line.stops[j];
                if (stop.station.sid == station.sid && lines.indexOf(line) == -1) {
                    lines.push(line);
                }
            }
        }
        return lines;
    }
    
    station_is_end_of_line(station) {
        var station_lines = this.station_lines(station);
        for (var j = 0; j < station_lines.length; j++) {
            var station_line = station_lines[j];
            var outer_stops = station_line.outer_stops();
            for (var k = 0; k < outer_stops.length; k++) {
                var outer_stop = outer_stops[k];
                if (outer_stop.station == station) return true;
            }
        }
        return false;
    }
    
    choose_drawmap(drawmaps, l, visited) {
        for (var k = 0; k < drawmaps.length; k++) {
            var drawmap = drawmaps[k];
            // Only want drawmaps on a different line.
            if (drawmap.line != l) {
                // We only want to add one drawmap.
                // They should be sorted such that the shortest drawmap for each line is available first.
                
                // Check to make sure the inside of this drawmap doesn't pass through any stations we've already visited.
                // Don't count the first or last stop.
                var station_repeat = false;
                for (var m = 1; m < drawmap.stops.length-1; m++) {
                    var station = drawmap.stops[m].station;
                    if (visited[station.sid]) station_repeat = true;
                }
                if (!station_repeat) {
                    return drawmap;
                }
            }
        }
        return null;
    }
    
    station_drawmap(line) {
        var outer_stops = line.outer_stops();
        var start_stop = outer_stops[0];
        
        var dfs_stops = [[]];
        var dfs_branch = [];

        var max_depth = 10;
        
        function visited_in_branch(v, branch) {
            for (var j = 0; j < branch.length; j++) {
                var s = branch[j];
                if (v.station.sid == s.sid) return true;
            }
            return false;
        }
        
        var visited = {};
        var visited_edge_sids = [];

        function dfs(v, sv, l, a) {
            
            //console.log(v.station.name);
            visited[v.station.sid] = 1;
            // Add new stop.
            dfs_stops[dfs_stops.length-1].push(v.station);
            a += 1;

            var neighbors = line.neighbors(v);
            var new_neighbor_count = 0;
            
            dfs_branch = dfs_stops[dfs_stops.length-1];
            var last_in_branch = dfs_branch[dfs_branch.length-2];
            var current_branch_length = dfs_branch.length;
            
            var branch_count = 0;
            for (var i = 0; i < neighbors.length; i++) {
                
                var w = neighbors[i];
                var e = line.get_edge_by_stops([v,w]);
                if (visited_edge_sids.indexOf(e.sid) == -1) {
                //if (!visited_in_branch(w, dfs_branch)) {
                //if (!visited[w.station.sid]) {
                    // Get the drawmaps for the current stop pair.
                    visited_edge_sids.push(e.sid);
                    
                    if (new_neighbor_count > 0) {
                        //console.log("second neighbor. branch_count="+branch_count.toString());
                        // Expand the DFS arrays to start a new path.
                        //console.log("current branch length: "+current_branch_length.toString());
                        dfs_stops.push(dfs_branch.slice(0, current_branch_length));
                        branch_count = 0;
                    }
                    var drawmaps = sv.drawmaps(v, w, l);
                    var target = dfs_stops[dfs_stops.length-1];
                    var drawmap = sv.choose_drawmap(drawmaps, l, visited);
                    if (drawmap !== null) {
                        for (var j = 1; j < drawmap.stops.length - 1; j++) {
                            target.push(drawmap.stops[j].station);
                            a += 1;
                        }
                    }
                    var ret = dfs(w, sv, l, branch_count);
                    //console.log("ret: "+ret.toString());
                    a += ret;
                    branch_count += ret;
                    new_neighbor_count += 1;
                    
                }
            }
            return a;
        }
        
        if (start_stop !== null) {
            dfs(start_stop, this, line, 0);
        }
        
        // Check for loops at the end of branches
        for (var i = 0; i < dfs_stops.length; i++) {
            var branch = dfs_stops[i];
            var branch_stop_start = line.get_stops_by_station(branch[0])[0];
            var branch_stop_end = line.get_stops_by_station(branch[branch.length-1])[0];
            var edge = line.get_edge_by_stops([branch_stop_start, branch_stop_end]);
            if (edge !== null && visited_edge_sids.indexOf(edge.sid) == -1) {
                var drawmaps = this.drawmaps(branch_stop_end, branch_stop_start, line);
                var br_visited = {};
                for (var j = 0; j < branch.length; j++) {
                    br_visited[branch[j].sid] = 1;
                }
                var drawmap = this.choose_drawmap(drawmaps, line, br_visited);
                if (drawmap !== null) {
                    for (j = 1; j < drawmap.stops.length; j++) {
                        branch.push(drawmap.stops[j].station);
                    }
                } else {
                    branch.push(branch_stop_start.station);
                }
            }
        }
        
        return dfs_stops;
    }

    drawmaps(stop_1, stop_2, line) {
        // For stop 1 and 2 connected by line,
        // return an array of additional stops to draw the line through.

        var dfs_stops = [[]];
        var dfs_branch = [];
        var visited = {};
        var visited_edge_sids = [];

        var max_depth = 10;

        // TODO rewrite this
        // add a target. Find all paths from start to finish
        /*function dfs(v, o, t, sv, l, a) {
            
            //console.log(v.station.name);
            visited[v.sid] = 1;
            // Add new stop.
            dfs_stops[dfs_stops.length-1].push(v);
            a += 1;

            var neighbors = l.neighbors(v);
            var new_neighbor_count = 0;
            
            dfs_branch = dfs_stops[dfs_stops.length-1];
            var last_in_branch = dfs_branch[dfs_branch.length-2];
            var current_branch_length = dfs_branch.length;
            
            var branch_count = 0;
            for (var i = 0; i < neighbors.length; i++) {
                
                var w = neighbors[i];
                var e = l.get_edge_by_stops([v,w]);
                if (visited_edge_sids.indexOf(e.sid) == -1) {
                //if (!visited_in_branch(w, dfs_branch)) {
                //if (!visited[w.station.sid]) {
                    // Get the drawmaps for the current stop pair.
                    visited_edge_sids.push(e.sid);
                    
                    if (w.sid == t.sid) {
                        //console.log("second neighbor. branch_count="+branch_count.toString());
                        // Expand the DFS arrays to start a new path.
                        //console.log("current branch length: "+current_branch_length.toString());
                        dfs_stops.push(dfs_branch.slice(0, current_branch_length));
                        branch_count = 0;
                        w = o;
                    }
                    var ret = dfs(w, o, t, sv, l, branch_count);
                    //console.log("ret: "+ret.toString());
                    a += ret;
                    branch_count += ret;
                    new_neighbor_count += 1;
                    
                }
            }
            return a;
        }*/
        function dfs(v, sv, l, a) {
            
            //console.log(v.station.name);
            visited[v.sid] = 1;
            // Add new stop.
            dfs_stops[dfs_stops.length-1].push(v);
            a += 1;

            var neighbors = l.neighbors(v);
            var new_neighbor_count = 0;
            
            dfs_branch = dfs_stops[dfs_stops.length-1];
            var last_in_branch = dfs_branch[dfs_branch.length-2];
            var current_branch_length = dfs_branch.length;
            
            var branch_count = 0;
            for (var i = 0; i < neighbors.length; i++) {
                
                var w = neighbors[i];
                var e = l.get_edge_by_stops([v,w]);
                if (visited_edge_sids.indexOf(e.sid) == -1) {
                //if (!visited_in_branch(w, dfs_branch)) {
                //if (!visited[w.station.sid]) {
                    // Get the drawmaps for the current stop pair.
                    visited_edge_sids.push(e.sid);
                    
                    if (new_neighbor_count > 0) {
                        //console.log("second neighbor. branch_count="+branch_count.toString());
                        // Expand the DFS arrays to start a new path.
                        //console.log("current branch length: "+current_branch_length.toString());
                        dfs_stops.push(dfs_branch.slice(0, current_branch_length));
                        branch_count = 0;
                    }
                    var ret = dfs(w, sv, l, branch_count);
                    //console.log("ret: "+ret.toString());
                    a += ret;
                    branch_count += ret;
                    new_neighbor_count += 1;
                    
                }
            }
            return a;
        }

        var lines_to_check = this.station_lines(stop_1.station);
        var drawmaps = [new Drawmap(line, [stop_1, stop_2])];

        for (var i = 0; i < lines_to_check.length; i++) {
            var line_to_check = lines_to_check[i];
            if (line_to_check.sid != line.sid) {
                // Check if both stops are on this line.
                var stop_1_overlap = line_to_check.overlapping_stops(stop_1);
                var stop_2_overlap = line_to_check.overlapping_stops(stop_2);

                if (stop_1_overlap !== null && stop_2_overlap !== null) {
                    // Initialize visited stops.
                    visited = {};
                    var visited_stops_count = 0;
                    for (var j = 0; j < line_to_check.stops.length; j++) {
                        visited[line_to_check.stops[j].sid] = 0;
                    }
                    // Initialize DFS variables.
                    dfs_stops = [[]];
                    dfs_branch = [];
                    visited_edge_sids = [];
                    dfs(stop_1_overlap, this, line_to_check, 0);
                    //dfs(stop_1_overlap, stop_1_overlap, stop_2_overlap, this, line_to_check, 0);
                    for (j = 0; j < dfs_stops.length; j++) {
                        var branch = dfs_stops[j];
                        var stop_2_index = branch.indexOf(stop_2_overlap);
                        if (stop_2_index != -1) {
                            branch.length = stop_2_index+1;
                            drawmaps.push(new Drawmap(line_to_check, branch));
                        }
                    }
                }
            }
        }

        var line_sid_to_shortest_drawmap_length = {};
        for (i = 0; i < drawmaps.length; i++) {
            var drawmap = drawmaps[i];
            var sid = drawmap.line.sid;
            if (!(sid in line_sid_to_shortest_drawmap_length)) {
                line_sid_to_shortest_drawmap_length[sid] = drawmap.stops.length;
            } else if (line_sid_to_shortest_drawmap_length[sid] > drawmap.stops.length) {
                line_sid_to_shortest_drawmap_length[sid] = drawmap.stops.length;
            }
        }
        // In-place sort by line
        drawmaps.sort(function(a,b) {
            if (a.line.sid != b.line.sid) {
                return (line_sid_to_shortest_drawmap_length[a.line.sid] < line_sid_to_shortest_drawmap_length[b.line.sid]);
                //return (line_sid_to_shortest_drawmap_length[a.line.sid] > line_sid_to_shortest_drawmap_length[b.line.sid]);
            } else {
                return (a.stops.length > b.stops.length);
            }
        });

        return drawmaps;

    }
    
    /**
     * Add transfer between stations station_1 and station_2.
     */
    add_transfer(station_1, station_2) {
        for (var i = this.transfers.length - 1; i >= 0; i--) {
            var transfer = this.transfers[i];
            if (transfer.has_station(station_1) && transfer.has_station(station_2)) {
                this.transfers.splice(i, 1);
            }
        }
        if (station_1 != station_2) {
            this.transfers.push(new Transfer([station_1, station_2]));
        }
    }
    
    /**
     * Remove all transfers that contain a station.
     * Returns true if any transfers removed, else false.
     */
    remove_transfers_for_station(station) {
        var num_removed = 0;
        for (var i = this.transfers.length - 1; i >= 0; i--) {
            var transfer = this.transfers[i];
            if (transfer.has_station(station)) {
                this.transfers.splice(i, 1);
                num_removed += 1;
            }
        }
        if ((num_removed) > 0) {
            return true;
        } else {
            return false;
        }
    }
    
    /**
     * Removes all transfers longer than the input threshold.
     * Returns true if any transfers removed, else false.
     */
    remove_transfers_above_length(length) {
        var num_removed = 0;
        for (var i = this.transfers.length - 1; i >= 0; i--) {
            var transfer = this.transfers[i];
            if (station_distance(transfer.stations[0], transfer.stations[1]) > length) {
                this.transfers.splice(i, 1);
                num_removed += 1;
            }
        }
        if ((num_removed) > 0) {
            return true;
        } else {
            return false;
        }
    }

    to_json() {
        return JSON.stringify(this);
    }

    from_json(j) {
        this.sid = j.sid;
        this.name = j.name;
        this.mode = j.mode;
        this.stations = [];
        for (var i = 0; i < j.stations.length; i++) {
            var s = new Station(j.stations[i].name, j.stations[i].location);
            s.sid = j.stations[i].sid;
            s.from_json(j.stations[i]);
            this.add_station(s);
        }
        this.lines = [];
        for (i = 0; i < j.lines.length; i++) {
            var l = new Line(j.lines[i].name);
            l.sid = j.lines[i].sid;
            l.from_json(j.lines[i], this);
            this.add_line(l);
        }
        this.transfers = [];
        if (j.transfers !== null) {
            for (i = 0; i < j.transfers.length; i++) {
                var t = new Transfer([]);
                t.from_json(j.transfers[i], this);
                this.transfers.push(t);
            }
        }
    }
}

class Drawmap {
    /*
     * A Drawmap is a collection of Lines and Stops.
     *
     * Attributes:
     *  line: The Line this drawmap follows.
     *  stops: The Stops on this drawmap.
     */

    constructor(line, stops) {
        this.line = line;
        this.stops = stops;
    }
}

class IdFactory {
    /*
     * Generates unique object IDs.
     */
    constructor() {
        this.current_id = 0;
    }

    id() {
        var return_id = this.current_id;
        this.current_id += 1;
        return return_id;
    }
}
