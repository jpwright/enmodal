class StationMarker {

    constructor(station) {
        this.station = station;
        this.tooltip_options = {direction: 'top', offset: L.point(0, -5), className: 'station-marker-tooltip'};
        this.marker = this.generate_marker();
        this.popup = L.popup({'className': 'station-popup'});
        this.marker.bindPopup(this.popup);
        this.generate_popup();
    }

    generate_marker() {
        var latlng = L.latLng(this.station.location[0], this.station.location[1]);
        var marker = L.circleMarker(latlng, {draggable: true, color: "black", opacity: 1.0, fillColor: "white", fillOpacity: 1.0, zIndexOffset: 100, pane: "stationMarkerPane"}).setRadius(MARKER_RADIUS_DEFAULT).bindTooltip(this.station.name, this.tooltip_options);
        marker.on('click', function(event) {
            //console.log('marker click');
            if (NS_interface.active_tool == "transfer") {
                marker.unbindPopup();
                var station = NS_interface.get_station_marker_by_marker(marker).station;
                if (station != NS_interface.active_transfer_station) {
                    var station_loc = {
                        "type": "Feature",
                        "properties": {},
                        "geometry": {
                            "type": "Point",
                            "coordinates": [station.location[1], station.location[0]]
                        }
                    };
                    var transfer_loc = {
                        "type": "Feature",
                        "properties": {},
                        "geometry": {
                            "type": "Point",
                            "coordinates": [NS_interface.active_transfer_station.location[1], NS_interface.active_transfer_station.location[0]]
                        }
                    };

                    var distance = turf.distance(station_loc, transfer_loc, "miles");
                    if (distance <= MAX_TRANSFER_DISTANCE_MILES) {
                        // Create the transfer
                        NS_interface.active_service.add_transfer(station, NS_interface.active_transfer_station);
                        NS_interface.draw_transfers();
                    }
                    NS_interface.active_tool = "station";
                    NS_interface.preview_clear();
                }
            }
        });
        return marker;
    }

    generate_popup() {
        var content = '<div class="station-name" id="station-'+this.station.sid.toString()+'">'+this.station.name+'   <i class="fa fa-pencil" style="margin-left: 5px;" aria-hidden="true"></i></div>';
        content += '<div class="station-content"><div class="station-info">'+this.station.neighborhood+'<br />';
        content += '<i class="fa fa-user" aria-hidden="true"></i> <span id="stationriders-'+this.station.sid.toString()+'">';
        if (this.station.ridership == -1) {
            content += '...';
        } else {
            content += Math.round(this.station.ridership).toString();
        }
        content += '</span></div>';
        content += '<div class="station-info subway-lines">';

        var lines = NS_interface.active_service.station_lines(this.station);
        var active_line_is_different = true;
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            content += '<div id="'+this.station.sid.toString()+'.'+line.sid.toString()+'" class="subway-line-long subway-deletable station-popup-line-marker" style="background-color: '+line.color_bg+'; color: '+line.color_fg+';" data-balloon="Remove" data-balloon-pos="down"><div class="content">'+line.name+'</div></div>';
            if (line.sid == NS_interface.active_line.sid) {
                active_line_is_different = false;
            }
        }
        content += ' </div>';



        if (active_line_is_different) {
            content += '<div class="station-content-button station-build line-'+NS_interface.active_line.sid.toString()+'" id="'+this.station.sid.toString()+'">Build <div class="subway-line-long subway-line-mini" style="background-color: '+NS_interface.active_line.color_bg+'; color: '+NS_interface.active_line.color_fg+';"><div class="content">'+NS_interface.active_line.name+'</div></div></div>';
        }

        content += '<div class="station-content-button station-delete ';
        content += '" id="delete-'+this.station.sid.toString()+'">Delete</div>';
        content += '<div class="station-buttons"><div class="station-content-button station-transfer" id="transfer-'+this.station.sid.toString()+'">Transfer</div>';
        content += '</div><div style="clear: both;"></div>';
        content += '</div>';

        this.popup.setContent(content);
        this.popup.update();
        this.marker.bindPopup(this.popup);
    }
    
    update_tooltip() {
        //this.marker.unbindTooltip();
        //this.marker.bindTooltip(this.station.name, this.tooltip_options);
        this.marker.setTooltipContent(this.station.name);
    }

}

class BezierControlPoint {

    constructor(lat, lng) {
        this.lat = lat;
        this.lng = lng;
    }
}

class BezierCenter {
    constructor(lat, lng) {
        this.lat = lat;
        this.lng = lng;
    }
}


class LinePath {

    constructor() {
        this.raw_edge_paths = [];
        this.edge_paths = [];
    }

    get_path_for_edge(edge) {
        for (var i = 0; i < this.edge_paths.length; i++) {
            if (this.edge_paths[i].edge_id == edge.sid) {
                return this.edge_paths[i];
            }
        }
        return null;
    }

    get_raw_path_for_edge(edge) {
        for (var i = 0; i < this.raw_edge_paths.length; i++) {
            if (this.raw_edge_paths[i].edge_id == edge.sid) {
                return this.raw_edge_paths[i];
            }
        }
        return null;
    }
}

class EdgePath {

    constructor(edge_id, stop_points, control_points, offset, color, opacity) {
        this.edge_id = edge_id;
        this.stop_points = stop_points;
        this.control_points = control_points;
        this.custom_control_points = [];
        this.offset = offset;
        this.color = color;
        this.opacity = opacity;
        this.track_width = 6;
        this.path = this.generate_path(this.color, this.opacity);
    }

    generate_path(color, opacity) {
        if (this.control_points.length == 0) {
            var path = L.polyline([L.latLng(this.stop_points[0][0], this.stop_points[0][1]), L.latLng(this.stop_points[1][0], this.stop_points[1][1])], {weight: this.track_width, color: color, opacity: opacity});
        } else if (this.control_points[0].length == 0) {
            var path = L.polyline([L.latLng(this.stop_points[0][0], this.stop_points[0][1]), L.latLng(this.stop_points[1][0], this.stop_points[1][1])], {weight: this.track_width, color: color, opacity: opacity});
        } else {
            var bezier_options = [
                                    'M',
                                    [this.stop_points[0][0], this.stop_points[0][1]]
                                ];
            for (var i = 0; i < this.control_points.length; i++) {
                var new_options = ['C',
                                    [this.control_points[i][0].lng, this.control_points[i][0].lat],
                                    [this.control_points[i][1].lng, this.control_points[i][1].lat],
                                    [this.stop_points[i+1][0], this.stop_points[i+1][1]]
                                ];
                bezier_options.push.apply(bezier_options, new_options);
            }
            var curve_options = {"color": color, "weight": this.track_width, "opacity": opacity, "fill": false, "smoothFactor": 1.0, "offset": this.offset*(this.track_width/2), "clickable": false, "pointer-events": "none", "className": "no-hover"};
            var path = L.curve(bezier_options, curve_options);
        }
        return path;
    }

    regenerate_path() {
        this.path = this.generate_path(this.color, this.opacity);
    }
}

class Pin {
    constructor(location) {
        this.location = location;
        this.sid = NS_id_sp.id();
        this.marker = null;
    }
    
    draw() {
        NS_interface.line_path_layer.addLayer(this.marker);
    }
    
    undraw() {
        NS_interface.line_path_layer.removeLayer(this.marker);
    }
    
    toJSON() {
        return {"sid": this.sid, "location": this.location};
    }
}

class SplineSegment {
    constructor(controls, centers) {
        this.controls = controls;
        this.centers = centers;
    }
}

class LineSplineSegment {
    constructor(line, spline_segments) {
        this.line = line;
        this.spline_segments = spline_segments;
    }
}

class StationPair {
    
    // Two stations associated with an array of LineControlPoints
    constructor(stations) {
        this.sid = NS_id_sp.id();
        this.stations = stations;
        this.line_spline_segments = [];
        this.paths = [];
        this.follow_streets = false;
        this.street_path = null;
        this.pins = [];
        this.draw_counter = 0;
        this.group_sss = null;
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
            if (used_lines[j] == lss_line.line) {
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
                    for (var k = 0; k < ss.centers.length; k++) {
                        centers.push(new BezierCenter(ss.centers[k].lat, ss.centers[k].lng));
                    }
                    // Add controls
                    for (var k = 0; k < ss.controls.length; k++) {
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
                    for (var k = 0; k < ss.controls.length; k++) {
                        a[j].controls[k].lat += ss.controls[k].lat;
                        a[j].controls[k].lng += ss.controls[k].lng;
                    }
                }
            }
        }
        // Divide by number of lines
        for (var j = 0; j < a.length; j++) {
            var s = a[j];
            // Divide centers
            /*for (var k = 0; k < s.centers.length; k++) {
                a[j].centers[k].lat = a[j].centers[k].lat / this.line_spline_segments.length;
                a[j].centers[k].lng = a[j].centers[k].lng / this.line_spline_segments.length;
            }*/
            // Divide controls
            for (var k = 0; k < s.controls.length; k++) {
                a[j].controls[k].lat = a[j].controls[k].lat / this.line_spline_segments.length;
                a[j].controls[k].lng = a[j].controls[k].lng / this.line_spline_segments.length;
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
            if (ss.controls.length == 1) {
                var curve = new Bezier(ss.centers[0].lat, ss.centers[0].lng, ss.controls[0].lat, ss.controls[0].lng, ss.centers[1].lat, ss.centers[1].lng);
            } else {
                var curve = new Bezier(ss.centers[0].lat, ss.centers[0].lng, ss.controls[0].lat, ss.controls[0].lng, ss.controls[1].lat, ss.controls[1].lng, ss.centers[1].lat, ss.centers[1].lng);
            }
            var p = curve.project({x: lat, y: lng});
            if (best_p == null || p.d < min_distance) {
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
            var px_n = NS_interface.map.latLngToLayerPoint(L.latLng(lat, lng));
            var px_p = NS_interface.map.latLngToLayerPoint(L.latLng(pin.location[0], pin.location[1]));
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
        var path;
        if (this.follow_streets) {
            path = this.street_path;
            if (this.increment_draw_counter() || this.street_path == null) {
                $.ajax({ url: "street-path?i="+NS_session+"&service-id="+NS_map.primary_service().sid.toString()+"&station-1-lat="+this.stations[0].location[0].toString()+"&station-1-lng="+this.stations[0].location[1].toString()+"&station-2-lat="+this.stations[1].location[0].toString()+"&station-2-lng="+this.stations[1].location[1].toString(),
                    async: false,
                    dataType: 'json',
                    success: function(data, status) {
                        var ll = [];
                        for (var i = 0; i < data[0].length; i++) {
                            ll.push([data[0][i][1], data[0][i][0]]);
                        }
                        path = L.polyline(ll, {weight: weight, color: color, opacity: opacity, offset: offset*(weight/2)});
                    }
                });
                this.street_path = path;
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
            var curve_options = {"color": color, "weight": weight, "opacity": opacity, "fill": false, "smoothFactor": 1.0, "offset": offset*(weight/2), "clickable": false, "pointer-events": "none", "className": "no-hover"};
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
            if (ss.controls.length == 1) {
                var curve = new Bezier(ss.centers[0].lat, ss.centers[0].lng, ss.controls[0].lat, ss.controls[0].lng, ss.centers[1].lat, ss.centers[1].lng);
            } else {
                var curve = new Bezier(ss.centers[0].lat, ss.centers[0].lng, ss.controls[0].lat, ss.controls[0].lng, ss.controls[1].lat, ss.controls[1].lng, ss.centers[1].lat, ss.centers[1].lng);
            }
            var steps = curve.getLUT(BEZIER_LUT_STEPS);
            
            for (var j = 0; j < steps.length - 1; j++) {
                var dn = NS_interface.map.distance(L.latLng(lat, lng), L.latLng(steps[j].x, steps[j].y));
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
    }
    
    remove_pin(pin) {
        var pin_index = this.pins.indexOf(pin);
        if (pin_index > -1) {
            this.pins.splice(pin_index, 1);
        }
    }
    
    generate_paths() {
        this.undraw_paths();
        this.paths = [];
        for (var i = 0; i < this.line_spline_segments.length; i++) {
            var lss = this.line_spline_segments[i];
            var offset = this.lss_pos_color(lss)*2 - (this.num_lines_color()-1);
            this.paths.push(this.generate_path(lss, lss.line.color_bg, offset, 6, 1.0));
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
            NS_interface.line_path_layer.removeLayer(this.paths[j]);
        }
    }
    
    draw_paths() {
        for (var j = 0; j < this.paths.length; j++) {
            NS_interface.line_path_layer.addLayer(this.paths[j]);
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
            NS_interface.dragging_pin = true;
        });
        m.on('click', function(e) {
            var p = self.get_pin_by_leaflet_id(e.target._leaflet_id);
            console.log('pin click');
            p.undraw();
            self.remove_pin(p);
            var lines = self.lines();
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i];
                NS_interface.draw_line(line, true, true);
            }
            self.draw_pins();
        });
        m.on('dragend', function(e) {
            console.log('dragend pin');
            NS_interface.dragging_pin = false;
        });
        return m;
    }
    
    draw_lines() {
        var lines = this.lines();
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            NS_interface.draw_line(line, true, true);
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
        this.draw_paths();
        // Pin drawing is separate: let main application decide if it's needed
        //this.draw_pins();
    }
    
    toJSON() {
        var station_ids = [];
        for (var i = 0; i < this.stations.length; i++) {
            station_ids.push(this.stations[i].sid);
        }
        var pins = [];
        for (var i = 0; i < this.pins.length; i++) {
            pins.push(this.pins[i].toJSON());
        }
        return {"sid": this.sid, "station_ids": station_ids, "pins": pins};
    }

}    

class LineColor {

    constructor(r, g, b) {
        this.r = r;
        this.g = g;
        this.b = b;
        this.fr = 255;
        this.fg = 255;
        this.fb = 255;
        if ((r + g + b) > (255*3/2)) {
            this.fr = 0;
            this.fg = 0;
            this.fb = 0;
        }
    }

    bg_hex() {
        var rs = ("0" + this.r.toString(16).toUpperCase()).slice(-2);
        var rg = ("0" + this.g.toString(16).toUpperCase()).slice(-2);
        var rb = ("0" + this.b.toString(16).toUpperCase()).slice(-2);
        return "#"+rs+rg+rb;
    }

    fg_hex() {
        var rs = ("0" + this.fr.toString(16).toUpperCase()).slice(-2);
        var rg = ("0" + this.fg.toString(16).toUpperCase()).slice(-2);
        var rb = ("0" + this.fb.toString(16).toUpperCase()).slice(-2);
        return "#"+rs+rg+rb;
    }
}

class Hexagon {
    
    constructor(id, geo, color, opacity) {
        this.sid = id;
        this.geo = geo;
        this.color = color;
        this.opacity = opacity;
        this.style = this.generate_style();
        this.poly = this.generate_poly();
    }
    
    generate_poly() {
        return L.geoJSON(this.geo, {style: this.style});
    }
    
    update_poly() {
        this.poly = this.generate_poly();
    }
    
    generate_style() {
        return {
            color: this.color,
            stroke: false,
            fillOpacity: this.opacity
        };
    }
    
    update_style() {
        this.style = this.generate_style();
        this.poly.setStyle(this.style);
        //this.poly.redraw();
    }
    
    draw() {
        NS_interface.data_layer.addLayer(this.poly);
    }
}