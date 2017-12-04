class StationPair {
    
    // Two stations associated with an array of LineControlPoints
    constructor(service, stations, layer) {
        this.sid = _id_factory.id();
        this.service = service;
        this.stations = stations;
        this.line_spline_segments = [];
        this.paths = [];
        this.street_path = null;
        this.street_path_is_valid = false;
        this.pins = [];
        this.draw_counter = 0;
        this.group_sss = null;
        this.layer = layer;
    }
    
    set_layer(layer) {
        this.undraw();
        this.layer = layer;
    }
    
    add_line_spline_segment(lss) {
        this.line_spline_segments.push(lss);
        this.line_spline_segments.sort(function(a,b) {
            return a.line.sid > b.line.sid;
        });
    }
    
    clear_spline_segment_for_line(line) {
        for (var i = this.line_spline_segments.length - 1; i >= 0; i--) {
            var lss = this.line_spline_segments[i];
            if (lss.line == line) {
                this.line_spline_segments.splice(i, 1);
            }
        }
    }
    
    clear_spline_segments() {
        this.line_spline_segments = [];
    }
    
    lines() {
        var lines = [];
        for (var i = 0; i < this.line_spline_segments.length; i++) {
            var lss_line = this.line_spline_segments[i].line;
            if (lines.indexOf(lss_line) == -1) {
                lines.push(lss_line);
            }
        }
        return lines;
    }
    
    has_line(line) {
        for (var i = 0; i < this.line_spline_segments.length; i++) {
            var lss_line = this.line_spline_segments[i].line;
            if (lss_line == line) {
                return true;
            }
        }
        return false;
    }
    
    has_station(station) {
        for (var i = 0; i < this.stations.length; i++) {
            if (this.stations[i].sid == station.sid) {
                return true;
            }
        }
        return false;
    }
    
    num_lines() {
        var used_lines = [];
        for (var i = 0; i < this.line_spline_segments.length; i++) {
            var lss_line = this.line_spline_segments[i].line;
            if (used_lines.indexOf(lss_line) == -1) {
                used_lines.push(lss_line);
            }
        }
        return used_lines.length;
    }
    
    num_lines_color() {
        var ret = 0;
        var used_colors = [];
        for (var i = 0; i < this.line_spline_segments.length; i++) {
            var lss_line = this.line_spline_segments[i].line;
            if (used_colors.indexOf(lss_line.color_bg) == -1) {
                used_colors.push(lss_line.color_bg);
                ret += 1;
            }
        }
        return ret;
    }
    
    ss_pos(ss) {
        var used_lines = [];
        for (var i = 0; i < this.line_spline_segments.length; i++) {
            var lss_line = this.line_spline_segments[i].line;
            if (used_lines.indexOf(lss_line) == -1) {
                used_lines.push(lss_line);
            }
        }
        for (var j = 0; j < used_lines.length; j++) {
            if (used_lines[j] == ss.line) {
                return j;
            }
        }
        return -1;
    }
    
    lss_pos_color(lss) {
        var used_colors = [];
        for (var i = 0; i < this.line_spline_segments.length; i++) {
            var lss_line = this.line_spline_segments[i].line;
            if (used_colors.indexOf(lss_line.color_bg) == -1) {
                used_colors.push(lss_line.color_bg);
            }
        }
        for (var j = 0; j < used_colors.length; j++) {
            if (used_colors[j] == lss.line.color_bg) {
                return j;
            }
        }
        return -1;
    }
    
    average_sss() {
        var a = [];
        var k;
        // Sum all the control points
        for (var i = 0; i < this.line_spline_segments.length; i++) {
            var lss = this.line_spline_segments[i];
            for (var j = 0; j < lss.spline_segments.length; j++) {
                var ss = lss.spline_segments[j];
                if (a.length <= j) {
                    // Gotta do this weirdness to force a deep copy
                    var controls = []; //JSON.parse(JSON.stringify(ss.controls));
                    var centers = []; //JSON.parse(JSON.stringify(ss.centers));
                    // Add centers
                    for (k = 0; k < ss.centers.length; k++) {
                        centers.push(new BezierCenter(ss.centers[k].lat, ss.centers[k].lng));
                    }
                    // Add controls
                    for (k = 0; k < ss.controls.length; k++) {
                        controls.push(new BezierControlPoint(ss.controls[k].lat, ss.controls[k].lng));
                    }
                    a.push(new SplineSegment(controls, centers));
                } else {
                    // Add centers
                    /*for (var k = 0; k < ss.centers.length; k++) {
                        a[j].centers[k].lat += ss.centers[k].lat;
                        a[j].centers[k].lng += ss.centers[k].lng;
                    }*/
                    // Add controls
                    for (k = 0; k < ss.controls.length; k++) {
                        a[j].controls[k].lat += ss.controls[k].lat;
                        a[j].controls[k].lng += ss.controls[k].lng;
                    }
                }
            }
        }
        // Divide by number of lines
        for (i = 0; i < a.length; i++) {
            var s = a[i];
            // Divide centers
            /*for (var k = 0; k < s.centers.length; k++) {
                a[j].centers[k].lat = a[j].centers[k].lat / this.line_spline_segments.length;
                a[j].centers[k].lng = a[j].centers[k].lng / this.line_spline_segments.length;
            }*/
            // Divide controls
            for (k = 0; k < s.controls.length; k++) {
                a[i].controls[k].lat = a[i].controls[k].lat / this.line_spline_segments.length;
                a[i].controls[k].lng = a[i].controls[k].lng / this.line_spline_segments.length;
            }
        }
        this.group_sss = a;
        return a;
    }
    
    project_pin(lat, lng) {
        var sss = this.average_sss();
        var min_distance = -1;
        var best_p = null;
        for (var i = 0; i < sss.length; i++) {
            var ss = sss[i];
            var curve;
            if (ss.controls.length == 1) {
                curve = new Bezier(ss.centers[0].lat, ss.centers[0].lng, ss.controls[0].lat, ss.controls[0].lng, ss.centers[1].lat, ss.centers[1].lng);
            } else {
                curve = new Bezier(ss.centers[0].lat, ss.centers[0].lng, ss.controls[0].lat, ss.controls[0].lng, ss.controls[1].lat, ss.controls[1].lng, ss.centers[1].lat, ss.centers[1].lng);
            }
            var p = curve.project({x: lat, y: lng});
            if (best_p === null || p.d < min_distance) {
                min_distance = p.d;
                best_p = p;
            }
        }
        return best_p;
    }
    
    distance_to_nearest_pin(lat, lng) {
        // TODO calling average_sss a lot, maybe need to cache the result?
        var sss = this.average_sss();
        var min_distance = -1;
        for (var i = 0; i < this.pins.length; i++) {
            var pin = this.pins[i];
            var px_n = enmodal.leaflet_map.latLngToLayerPoint(L.latLng(lat, lng));
            var px_p = enmodal.leaflet_map.latLngToLayerPoint(L.latLng(pin.location[0], pin.location[1]));
            var d = px_n.distanceTo(px_p);
            if (min_distance == -1 || d < min_distance) {
                min_distance = d;
            }
        }
        return min_distance;
    }
        
    
    increment_draw_counter() {
        this.draw_counter = this.draw_counter + 1;
        if (this.draw_counter > FOLLOW_STREET_MOVE_THRESH) {
            this.draw_counter = 0;
            return true;
        } else {
            return false;
        }
    }
    
    generate_path(lss, color, offset, weight, opacity) {  
        var path = null;
        var self = this;
        if (this.service.mode == "bus") {
            if (this.increment_draw_counter() || !this.street_path_is_valid) {
                var params = $.param({
                    i: enmodal.session_id,
                    service_id: enmodal.transit_interface.active_service.sid,
                    station_1_lat: this.stations[0].location[0],
                    station_1_lng: this.stations[0].location[1],
                    station_2_lat: this.stations[1].location[0],
                    station_2_lng: this.stations[1].location[1]
                });
                $.ajax({ url: "street_path?"+params,
                    async: true,
                    dataType: 'json',
                    success: function(data, status) {
                        handle_server_error(data);
                        var ll = [];
                        for (var i = 0; i < data[0].length; i++) {
                            ll.push([data[0][i][1], data[0][i][0]]);
                        }
                        this.street_path = ll;
                        this.street_path_is_valid = true;
                        path = L.polyline(ll, {weight: weight, color: color, opacity: opacity, offset: offset*(weight/2)});
                        self.undraw_paths();
                        self.paths.push(path);
                        self.draw_paths();
                    }
                });
            } else {
                path = L.polyline(self.street_path, {weight: weight, color: color, opacity: opacity, offset: offset*(weight/2)});
            }
        } else {
            var sss = this.average_sss();
            var bezier_options = [];
            for (var i = 0; i < sss.length; i++) {
                var ss = sss[i];
                bezier_options.push('M');
                bezier_options.push([ss.centers[0].lat, ss.centers[0].lng]);
                var new_options = [];
                if (ss.controls.length == 1) {
                    new_options.push('Q');
                }
                if (ss.controls.length == 2) {
                    new_options.push('C');
                }
                for (var j = 0; j < ss.controls.length; j++) {
                    new_options.push([ss.controls[j].lat, ss.controls[j].lng]);
                }
                new_options.push([ss.centers[1].lat, ss.centers[1].lng]);
                bezier_options.push.apply(bezier_options, new_options);
            }
            var o = offset*(weight/2);
            //if (lss.reverse) o = o*-1;
            var curve_options = {"color": color, "weight": weight, "opacity": opacity, "fill": false, "smoothFactor": 1.0, "offset": o, "clickable": false, "pointer-events": "none", "className": "no-hover"};
            path = L.curve(bezier_options, curve_options);
        }
        return path;
    }
    
    add_pin(lat, lng) {
        // Find the best spot in the pin order
        var sss = this.average_sss();
        var new_distance = -1;
        var new_pt = null;
        for (var i = 0; i < sss.length; i++) {
            var ss = sss[i];
            var curve;
            if (ss.controls.length == 1) {
                curve = new Bezier(ss.centers[0].lat, ss.centers[0].lng, ss.controls[0].lat, ss.controls[0].lng, ss.centers[1].lat, ss.centers[1].lng);
            } else {
                curve = new Bezier(ss.centers[0].lat, ss.centers[0].lng, ss.controls[0].lat, ss.controls[0].lng, ss.controls[1].lat, ss.controls[1].lng, ss.centers[1].lat, ss.centers[1].lng);
            }
            var steps = curve.getLUT(BEZIER_LUT_STEPS);
            
            for (var j = 0; j < steps.length - 1; j++) {
                var dn = enmodal.leaflet_map.distance(L.latLng(lat, lng), L.latLng(steps[j].x, steps[j].y));
                if (new_distance == -1 || dn < new_distance) {
                    new_pt = j + (i*BEZIER_LUT_STEPS);
                    new_distance = dn;
                }
            }
        }
        
        var new_pin = new Pin([lat, lng]);
        this.generate_pin_marker(new_pin);
        var splice_point = Math.floor(new_pt/BEZIER_LUT_STEPS);
        this.pins.splice(splice_point, 0, new_pin);
        this.draw_lines();

        push_undo_buffer();
    }
    
    remove_pin(pin) {
        var pin_index = this.pins.indexOf(pin);
        if (pin_index > -1) {
            this.pins.splice(pin_index, 1);
        }

        push_undo_buffer();
    }
    
    generate_paths(active) {
        this.undraw_paths();
        this.paths = [];
        var opacity = 1.0;
        if (!active) opacity = INACTIVE_OPACITY / this.num_lines();
        for (var i = 0; i < this.line_spline_segments.length; i++) {
            var lss = this.line_spline_segments[i];
            var offset = this.lss_pos_color(lss)*2 - (this.num_lines_color()-1);
            var path = this.generate_path(lss, lss.line.color_bg, offset, TRACK_WIDTH, opacity);
            if (path !== null) this.paths.push(path);
            // for debug only
            //this.draw_paths();
            if (DEBUG_BEZIER_CONTROLS) {
                for (var j = 0; j < lss.spline_segments.length; j++) {
                    var ss = lss.spline_segments[j];
                    for (var k = 0; k < ss.controls.length; k++) {
                        var color = "#000";
                        if (k > 0) color = "#fff";
                        this.paths.push(L.circleMarker([ss.controls[k].lat, ss.controls[k].lng], {color: color, opacity: 0.75, fillColor: lss.line.color_bg, fillOpacity: 1.0, radius: 4}));
                        this.paths.push(L.polyline([[ss.controls[k].lat, ss.controls[k].lng], [ss.centers[k].lat, ss.centers[k].lng]], {color: "#aaa", opacity: 0.75}));
                    }
                }
            }
        }
    }
    
    undraw_paths() {
        for (var j = 0; j < this.paths.length; j++) {
            this.layer.removeLayer(this.paths[j]);
        }
    }
    
    draw_paths() {
        for (var j = 0; j < this.paths.length; j++) {
            this.layer.addLayer(this.paths[j]);
        }
    }
    
    undraw_pins() {
        for (var j = 0; j < this.pins.length; j++) {
            this.pins[j].undraw();
        }
    }
    
    get_pin_by_leaflet_id(leaflet_id) {
        for (var j = 0; j < this.pins.length; j++) {
            if (this.pins[j].marker._leaflet_id == leaflet_id) {
                return this.pins[j];
            }
        }
        return null;
    }
    
    generate_pin_marker(pin) {
        var m = L.marker([pin.location[0], pin.location[1]], {draggable: true, icon: PIN_ICON});
        m.id = "pin-"+pin.sid.toString();
        pin.marker = m;
        var self = this;
        m.on('drag', function(e) {
            var p = self.get_pin_by_leaflet_id(e.target._leaflet_id);
            p.location = [e.latlng.lat, e.latlng.lng];
            self.draw_lines();
            enmodal.transit_interface.dragging_pin = true;
        });
        m.on('click', function(e) {
            var p = self.get_pin_by_leaflet_id(e.target._leaflet_id);
            p.undraw();
            self.remove_pin(p);
            var lines = self.lines();
            var active = self.service == enmodal.transit_interface.active_service;
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i];
                enmodal.transit_interface.draw_line(line, true, true, self.layer, active, self.service);
            }
            self.draw_pins();
        });
        m.on('dragend', function(e) {
            enmodal.transit_interface.dragging_pin = false;
            push_undo_buffer();
        });
        return m;
    }
    
    draw_lines() {
        var lines = this.lines();
        var active = this.service == enmodal.transit_interface.active_service;
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            enmodal.transit_interface.draw_line(line, true, true, this.layer, active, this.service);
        }
    }
    
    draw_pins() {
        for (var j = 0; j < this.pins.length; j++) {
            this.pins[j].draw();
        }
    }
    
    undraw() {
        this.undraw_paths();
        this.undraw_pins();
    }
    
    draw() {
        try {
            this.draw_paths();
        } catch(err) {
            console.log("Error drawing paths!");
            console.log(this.sss);
        }
        // Pin drawing is separate: let main application decide if it's needed
        //this.draw_pins();
    }
    
    toJSON() {
        var station_ids = [];
        for (var i = 0; i < this.stations.length; i++) {
            station_ids.push(this.stations[i].sid);
        }
        var pins = [];
        for (i = 0; i < this.pins.length; i++) {
            pins.push(this.pins[i].toJSON());
        }
        return {"sid": this.sid, "station_ids": station_ids, "pins": pins};
    }

}    