class TransitUI {

    constructor(map) {
        this.active_service = null;
        this.active_line = null;
        this.station_markers = [];
        this.line_paths = {}; // line id :: LinePath
        this.station_pairs = [];
        this.preview_paths = [];
        this.map = map;

        this.active_tool = "station";
        this.hexagon_layer = "none";
        this.hexagon_scales = {
            "population": chroma.scale('YlGnBu').domain([1,0]),
            "employment": chroma.scale('YlOrRd').domain([1,0])
        };
        this.hexagon_units = {
            "population": "persons / mile<sup>2</sup>",
            "employment": "jobs /  mile<sup>2</sup>"
        };
        this.preview_paths_enabled = true;

        this.nearest_station_to_mouse = null;
        this.station_for_bezier_edits = null;
        this.moving_station_marker = null; // Station marker being dragged
        
        this.moving_control_point = null;
        this.moving_control_point_index = null;
        this.moving_control_point_sp_id = null;
        this.moving_opp_control_point = null;
        this.moving_opp_control_point_index = null;
        this.moving_opp_control_point_sp_id = null;

        this.line_path_layer = L.featureGroup();
        this.station_marker_layer = L.featureGroup();
        this.preview_path_layer = L.featureGroup();
        this.bezier_layer = L.featureGroup();
        this.data_layer = L.featureGroup();
        
        this.hexagons = {}; // Indexed by hexagon gid
        this.chroma_scale = chroma.scale('YlGnBu');

        this.map.addLayer(this.data_layer);
        this.map.addLayer(this.line_path_layer);
        this.map.addLayer(this.preview_path_layer);
        this.map.addLayer(this.bezier_layer);
        this.map.addLayer(this.station_marker_layer);

        this.map.on('mouseup', () => {
            this.map.dragging.enable();
            this.map.removeEventListener('mousemove');
            this.preview_paths_enabled = true;
            this.map.on('mousemove', function(e) {
                NS_interface.preview_handler(e);
            });
            if (this.moving_station_marker != null) {
                console.log("updating moving station");
                this.update_station_info(this.moving_station_marker.station);
                this.moving_station_marker.update_tooltip();
                this.moving_station_marker.generate_popup();
                this.moving_station_marker.marker.openPopup();
                this.moving_station_marker = null;
                this.update_line_diagram();
            }
            if (this.moving_control_point != null) {
                console.log("updating moving control point");
                if (INC_UPDATES) {
                    //this.sync_station_pair_info(this.get_station_pair_by_sp_id(this.moving_control_point_sp_id));
                    //this.sync_station_pair_info(this.get_station_pair_by_sp_id(this.moving_opp_control_point_sp_id));
                }
            }
        });

        this.map.on('mousemove', function(e) {
            NS_interface.preview_handler(e);
        });

        this.map.on('moveend', function(e) {
            if (NS_interface.active_tool == "station") {
                //NS_interface.get_ridership();
            }
            if (NS_interface.hexagon_layer != "none") {
                NS_interface.get_hexagons();
            }
        });
    }

    add_to_line_selector(line) {
        // Add a line to the line selector dropdown.

        $("#dropdown-line-menu").prepend("<li class=\"line-selector-item\"><a class=\"line-selector-option\" id=\""+line.sid.toString()+"\" href=\"#\"> <div class=\"subway-line-long\" style=\"background-color: "+line.color_bg+"; color: "+line.color_fg+";\"><div class=\"content\">"+line.name+"</div></div> "+line.full_name+"</a></li>");

    }

    new_line_name() {
        // Generate a new line name, based on used names.
        // Letters A-Z are 0-25. Numbers 1-infinity start at 26

        var used_names = [];
        for (var i = 0; i < this.active_service.lines.length; i++) {
            var line = this.active_service.lines[i];
            if (line.name.length == 1) {
                if (isNaN(line.name)) {
                    used_names[line.name.charCodeAt(0) - 65] = 1;
                } else {
                    used_names[parseInt(line.name) + 25] = 1;
                }
            }
        }
        for (var i = 0; i < used_names.length; i++) {
            if (used_names[i] != 1) {
                if (i < 26) {
                    return String.fromCharCode(65 + i);
                } else {
                    return (i - 25).toString();
                }
            }
        }

        if (used_names.length < 26) {
            return String.fromCharCode(65 + used_names.length);
        } else {
            return (used_names.length - 25).toString();
        }
    }

    random_color() {
        var r = Math.floor(Math.random() * 200);
        var g = Math.floor(Math.random() * 200);
        var b = Math.floor(Math.random() * 200);
        return new LineColor(r, g, b);
    }

    line_selector_new() {
        var line = new Line(this.new_line_name());
        line.full_name = "Line";

        var color = NS_interface.random_color();
        line.color_bg = color.bg_hex();
        line.color_fg = color.fg_hex();

        console.log(line);
        if (INC_UPDATES) {
            $.ajax({ url: "line-add?i="+NS_session+"&service-id="+NS_map.primary_service().sid.toString()+"&name="+encodeURIComponent(line.name)+"&full-name="+encodeURIComponent(line.full_name)+"&color-bg="+encodeURIComponent(line.color_bg)+"&color-fg="+encodeURIComponent(line.color_fg)+"&line-id="+line.sid.toString(),
                async: true,
                dataType: 'json',
                success: function(data, status) {
                    NS_map.primary_service().add_line(line);
                    NS_interface.add_to_line_selector(line);
                    NS_interface.update_line_selector(line.sid);
                }
            });
        } else {
            NS_map.primary_service().add_line(line);
            NS_interface.add_to_line_selector(line);
            NS_interface.update_line_selector(line.sid);
        }
    }

    update_line_selector(id) {
        // Update system state based on line selector click.
        var line = this.active_service.get_line_by_id(id);
        this.active_line = line;

        $("#dropdown-line-button").html("<div class=\"subway-line-long\" style=\"background-color: "+line.color_bg+"; color: "+line.color_fg+";\"><div class=\"content\">"+line.name+"</div></div> "+line.full_name+" <span class=\"caret\"></span>");

        $('#custom-line-name').removeClass('issue');
        $('#custom-line-error').text('');

        $("#custom-line-name").val(line.name);
        $("#color-picker-bg").spectrum("set", line.color_bg);
        $("#color-picker-fg").spectrum("set", line.color_fg);
        NS_interface.update_line_editor();
        NS_interface.update_line_diagram();
    }

    update_line_editor() {
        var line_name = $("#custom-line-name").val().substring(0, 20);
        $("#custom-line-marker-content").text(line_name);

        var line_color_bg = $("#color-picker-bg").val();
        $('#custom-line-marker').css('background-color', line_color_bg);

        var line_color_fg = $("#color-picker-fg").val();
        $('#custom-line-marker').css('color', line_color_fg);
    }

    refresh_line_editor() {
        $(".line-selector-item").remove();
        for (var i = 0; i < this.active_service.lines.length; i++) {
            var line = this.active_service.lines[i];
            $("#dropdown-line-menu").prepend("<li class=\"line-selector-item\"><a class=\"line-selector-option\" id=\""+line.sid+"\" href=\"#\"> <div class=\"subway-line-long\" style=\"background-color: "+line.color_bg+"; color: "+line.color_fg+";\"><div class=\"content\">"+line.name+"</div></div> "+line.full_name+"</a></li>");
        }
        $('#custom-line-marker').css('background-color', this.active_line.color_bg);
        $('#custom-line-marker').css('color', this.active_line.color_fg);
        $("#color-picker-bg").spectrum("set", this.active_line.color_bg);
        $("#color-picker-fg").spectrum("set", this.active_line.color_fg);
    }

    line_editor_save() {
        var line = this.active_line;

        var custom_line_name = $("#custom-line-name").val().substring(0, 20);
        var custom_line_color_bg = $("#color-picker-bg").val();
        var custom_line_color_fg = $("#color-picker-fg").val();
        var issue = false;

        if (custom_line_name.length == 0) {
            $('#custom-line-name').addClass('issue');
            $('#custom-line-error').text('Enter a name.');
            issue = true;
        }

        /*
        if (find_line_by_name(custom_line_name) != null) {
            $('#custom-line-name').addClass('issue');
            $('#custom-line-error').text('Name already in use.');
            issue = true;
        }
        */

        if (!issue) {
            line.name = custom_line_name;
            line.color_bg = custom_line_color_bg;
            line.color_fg = custom_line_color_fg;

            $('#custom-line-name').removeClass('issue');
            $('#custom-line-css-bg').removeClass('issue');
            $('#custom-line-css-text').removeClass('issue');
            $('#custom-line-error').text('');

            this.update_line_selector(line.sid);
            $("#"+line.sid).html("<div class=\"subway-line-long\" style=\"background-color: "+line.color_bg+"; color: "+line.color_fg+";\"><div class=\"content\">"+line.name+"</div></div> "+line.full_name);
            this.draw_line(line, true, true);
            
            if (INC_UPDATES) {
                /*$.ajax({ url: "line-update?i="+NS_session+"&service-id="+NS_map.primary_service().sid.toString()+"&line-id="+line.sid.toString()+"&name="+encodeURIComponent(line.name)+"&full-name="+encodeURIComponent(line.full_name)+"&color-bg="+encodeURIComponent(line.color_bg)+"&color-fg="+encodeURIComponent(line.color_fg),
                    async: true,
                    dataType: 'json',
                    success: function(data, status) {
                    }
                });*/
            }
        } else {
            $("#option-section-lines").animate({scrollTop: $('#option-section-lines').prop('scrollHeight')}, 1000);
        }
    }

    get_insertion_result(line, stop) {

        // Calculate edge reconfiguration
        var best_edges = [];
        var edges_to_remove = [];
        var best_line_distance = -1;

        var base_length = line.length();

        // Iterate twice through all stops on the line.
        for (var i = 0; i < line.stops.length; i++) {
            for (var j = 0; j < line.stops.length; j++) {

                // Only calculate if the stops are different and not the one we just added
                if ((i != j) && (line.stops[i].sid != stop.sid) && (line.stops[j].sid != stop.sid)) {

                    var existing_stops = [line.stops[i], line.stops[j]];

                    var temp_edge_1 = new Edge([stop, line.stops[i]], true);
                    var temp_edge_2 = new Edge([stop, line.stops[j]], true);

                    var temp_length = base_length + temp_edge_1.length() + temp_edge_2.length();

                    // Subtract any existing edges between the i- and j- stops
                    var temp_edge_to_remove = null;
                    for (var k = 0; k < line.edges.length; k++) {
                        if (line.edges[k].compare_stops(existing_stops)) {
                            temp_length -= line.edges[k].length();
                            temp_edge_to_remove = line.edges[k];
                        }
                    }

                    if (temp_length < best_line_distance || best_edges.length == 0) {
                        best_line_distance = temp_length;
                        best_edges = [temp_edge_1, temp_edge_2];
                        edges_to_remove = [temp_edge_to_remove];
                    }

                }
            }

            // Compare with the null case for j
            if (line.stops[i].sid != stop.sid) {
                var temp_edge = new Edge([stop, line.stops[i]], true);
                var temp_length = base_length + temp_edge.length();

                if (temp_length < best_line_distance || best_edges.length == 0) {
                    best_line_distance = temp_length;
                    best_edges = [temp_edge];
                    edges_to_remove = [];
                }
            }

        }
        var delta = new LineDelta(best_edges, edges_to_remove);

        return delta;
    }
    
    lines_for_station_by_station_pair(station) {
        // Returns all lines implicated in any station pairs involving this station
        var lines = [];
        for (var i = 0; i < this.station_pairs.length; i++) {
            if (this.station_pairs[i].has_station(station)) {
                var sp_lines = this.station_pairs[i].lines();
                for (var j = 0; j < sp_lines.length; j++) {
                    if (lines.indexOf(sp_lines[j]) == -1) {
                        lines.push(sp_lines[j]);
                    }
                }
            }
        }
        return lines;
    }

    create_station_marker(station) {
        var station_marker = new StationMarker(station);

        this.station_markers.push(station_marker);

        station_marker.marker.on('click', function(e) {
            station_marker.marker.closeTooltip();
            // Disable new station creation.
            NS_interface.map.off('click', handle_map_click);
            setTimeout(function() {
                NS_interface.map.on('click', handle_map_click);
            }, 1000);

            // Update popup.
            station_marker.generate_popup();

        });

        station_marker.marker.on('mousedown', function (event) {
            //L.DomEvent.stop(event);
            NS_interface.preview_paths_enabled = false;
            NS_interface.preview_clear();
            NS_interface.map.dragging.disable();
            let {lat: circleStartingLat, lng: circleStartingLng} = station_marker.marker._latlng;
            let {lat: mouseStartingLat, lng: mouseStartingLng} = event.latlng;

            NS_interface.map.on('mousemove', event => {
                if (NS_interface.active_tool == "station") {
                    if (NS_interface.moving_station_marker == null) {
                        NS_interface.moving_station_marker = station_marker;
                    }
                    let {lat: mouseNewLat, lng: mouseNewLng} = event.latlng;
                    let latDifference = mouseStartingLat - mouseNewLat;
                    let lngDifference = mouseStartingLng - mouseNewLng;

                    let center = [circleStartingLat-latDifference, circleStartingLng-lngDifference];
                    station_marker.marker.setLatLng(center);
                    station_marker.station.move_to(center[0], center[1]);

                    //var lines = NS_interface.active_service.station_lines(station_marker.station);
                    var lines = NS_interface.lines_for_station_by_station_pair(station_marker.station);
                    for (var i = 0; i < lines.length; i++) {
                        NS_interface.draw_line(lines[i], false, true);
                    }
                    NS_interface.station_marker_layer.bringToFront();
                }
            });
        });

        station_marker.marker.addTo(this.station_marker_layer);
        station_marker.marker.openPopup();
    }
    
    get_station_marker_by_station(station) {
        for (var i = 0; i < this.station_markers.length; i++) {
            if (station == this.station_markers[i].station) {
                return this.station_markers[i];
            }
        }
        return null;
    }
    
    get_station_marker_by_marker(marker) {
        for (var i = 0; i < this.station_markers.length; i++) {
            if (marker == this.station_markers[i].marker) {
                return this.station_markers[i];
            }
        }
        return null;
    }

    add_new_station(lat, lng) {

        var station = new Station("to be named", [lat, lng]);
        var stop;
        var line = this.active_line;
        
        // Sync with server
        // synchronous station-add is mandatory since it gives localized info
        $.ajax({ url: "station-add?i="+NS_session+"&service-id="+this.active_service.sid.toString()+"&station-id="+station.sid.toString()+"&lat="+lat+"&lng="+lng,
            async: false,
            dataType: 'json',
            success: function(data, status) {
                station.name = data["name"];
                if ("locality" in data) {
                    station.locality = data["locality"];
                }
                if ("neighborhood" in data) {
                    station.neighborhood = data["neighborhood"];
                }
                if ("region" in data) {
                    station.region = data["region"];
                }

            }
        });
        stop = new Stop(station);
        this.active_service.add_station(station);
        line.add_stop(stop);
        
        var lines_to_draw = [line];
        var best_edges= [];

        // If the line has more than 1 stop, we'll need to reconfigure edges
        if (line.stops.length > 1) {
            var delta = this.get_insertion_result(line, stop);
            best_edges = delta.add;
            var edges_to_remove = delta.remove;

            for (var i = 0; i < best_edges.length; i++) {
                // Give it a real ID
                best_edges[i].sid = NS_id.id();
                line.add_edge(best_edges[i]);
                
                // Add any impacted lines
                for (var j = 0; j < best_edges[i].stops.length; j++) {
                    var station_pairs = this.get_station_pairs(best_edges[i].stops[j].station);
                    for (var k = 0; k < station_pairs.length; k++) {
                        var sp_line_cps = station_pairs[k][0].line_control_points;
                        for (var l = 0; l < sp_line_cps.length; l++) {
                            var sp_line = sp_line_cps[l].line;
                            if (lines_to_draw.indexOf(sp_line) == -1) {
                                lines_to_draw.push(sp_line);
                            }
                        }
                    }
                }
            }
            for (var i = 0; i < edges_to_remove.length; i++) {
                for (var j = 0; j < edges_to_remove[i].stops.length; j++) {
                    var affected_station = edges_to_remove[i].stops[j].station;
                    var station_lines = this.active_service.station_lines(affected_station);
                    for (var k = 0; k < station_lines.length; k++) {
                        if (lines_to_draw.indexOf(station_lines[k]) == -1) {
                            lines_to_draw.push(station_lines[k]);
                        }
                    }
                }
                line.remove_edge(edges_to_remove[i]);
                if (INC_UPDATES) {
                    $.ajax({ url: "edge-remove?i="+NS_session+"&service-id="+NS_interface.active_service.sid.toString()+"&line-id="+line.sid.toString()+"&edge-id="+edges_to_remove[i].sid.toString(),
                        async: true,
                        dataType: 'json',
                        success: function(data, status) {
                        }
                    });
                }
            }
        }
        
        if (INC_UPDATES) {
            $.ajax({ url: "stop-add?i="+NS_session+"&service-id="+this.active_service.sid.toString()+"&line-id="+line.sid.toString()+"&station-id="+station.sid.toString()+"&stop-id="+stop.sid.toString(),
                async: true,
                dataType: 'json',
                success: function(data, status) {
                    for (var i = 0; i < best_edges.length; i++) {
                        $.ajax({ url: "edge-add?i="+NS_session+"&service-id="+NS_interface.active_service.sid.toString()+"&line-id="+line.sid.toString()+"&stop-1-id="+best_edges[i].stops[0].sid+"&stop-2-id="+best_edges[i].stops[1].sid+"&edge-id="+best_edges[i].sid.toString(),
                            async: true,
                            dataType: 'json',
                            success: function(data, status) {
                            }
                        });
                    }
                }
            });
        }

        this.create_station_marker(station);

        for (var i = 0; i < lines_to_draw.length; i++) {
            this.draw_line(lines_to_draw[i], false, true);
        }
        this.station_marker_layer.bringToFront();
        this.get_ridership();
        this.update_line_diagram();
    }

    update_station_info(station) {
        // Sync with server
        var lat = station.location[0];
        var lng = station.location[1];

        $.ajax({ url: "lat-lng-info?i="+NS_session+"&lat="+lat+"&lng="+lng,
            async: false,
            dataType: 'json',
            success: function(data, status) {

                station.name = data["name"];
                if ("locality" in data) {
                    station.locality = data["locality"];
                }
                if ("neighborhood" in data) {
                    station.neighborhood = data["neighborhood"];
                }
                if ("region" in data) {
                    station.region = data["region"];
                }
                if (INC_UPDATES) {
                    NS_interface.sync_station_info(station);
                }
            }
        });
        
    }

    sync_station_info(station) {
        $.ajax({ url: "station-update?i="+NS_session+"&service-id="+NS_interface.active_service.sid.toString()+"&station-id="+station.sid.toString()+"&name="+encodeURIComponent(station.name)+"&location="+station.location[0].toString()+","+station.location[1].toString()+"&neighborhood="+encodeURIComponent(station.neighborhood),
            async: true,
            dataType: 'json',
            success: function(data, status) {

            }
        });
    }
    
    sync_station_pair_info(station_pair) {
        $.ajax({ url: "station-pair-info?i="+NS_session+"&service-id="+NS_interface.active_service.sid.toString()+"&station-id-1="+station_pair.stations[0].sid.toString()+"&station-id-2="+station_pair.stations[1].sid.toString()+"&ucp-0-lat="+station_pair.user_control_points[0].lat.toString()+"&ucp-0-lng="+station_pair.user_control_points[0].lng.toString()+"&ucp-1-lat="+station_pair.user_control_points[1].lat.toString()+"&ucp-1-lng="+station_pair.user_control_points[1].lng.toString(),
            async: true,
            dataType: 'json',
            success: function(data, status) {
            }
        });
    }

    add_stop_to_station(id) {

        var station = this.active_service.get_station_by_id(id);

        if (station == null) {
            return;
        }

        var stop = new Stop(station);

        this.active_line.add_stop(stop);
        
        var lines_to_draw = [this.active_line];
        var best_edges = [];
        
        // If the line has more than 1 stop, we'll need to reconfigure edges
        if (this.active_line.stops.length > 1) {
            var delta = this.get_insertion_result(this.active_line, stop);
            best_edges = delta.add;
            var edges_to_remove = delta.remove;

            for (var i = 0; i < best_edges.length; i++) {
                best_edges[i].sid = NS_id.id();
                for (var j = 0; j < best_edges[i].stops.length; j++) {
                    var affected_station = best_edges[i].stops[j].station;
                    var station_lines = this.active_service.station_lines(affected_station);
                    for (var k = 0; k < station_lines.length; k++) {
                        if (lines_to_draw.indexOf(station_lines[k]) == -1) {
                            lines_to_draw.push(station_lines[k]);
                        }
                    }
                }
                this.active_line.add_edge(best_edges[i]);
            }
            for (var i = 0; i < edges_to_remove.length; i++) {
                for (var j = 0; j < edges_to_remove[i].stops.length; j++) {
                    var affected_station = edges_to_remove[i].stops[j].station;
                    var station_lines = this.active_service.station_lines(affected_station);
                    for (var k = 0; k < station_lines.length; k++) {
                        if (lines_to_draw.indexOf(station_lines[k]) == -1) {
                            lines_to_draw.push(station_lines[k]);
                        }
                    }
                }
                this.active_line.remove_edge(edges_to_remove[i]);
                if (INC_UPDATES) {
                    $.ajax({ url: "edge-remove?i="+NS_session+"&service-id="+NS_interface.active_service.sid.toString()+"&line-id="+this.active_line.sid.toString()+"&edge-id="+edges_to_remove[i].sid.toString(),
                        async: true,
                        dataType: 'json',
                        success: function(data, status) {
                        }
                    });
                }
            }
        }
        
        
        if (INC_UPDATES) {
            $.ajax({ url: "stop-add?i="+NS_session+"&service-id="+this.active_service.sid.toString()+"&line-id="+this.active_line.sid.toString()+"&station-id="+station.sid.toString()+"&stop-id="+stop.sid.toString(),
                async: true,
                dataType: 'json',
                success: function(data, status) {
                    for (var i = 0; i < best_edges.length; i++) {
                        $.ajax({ url: "edge-add?i="+NS_session+"&service-id="+NS_interface.active_service.sid.toString()+"&line-id="+NS_interface.active_line.sid.toString()+"&stop-1-id="+best_edges[i].stops[0].sid.toString()+"&stop-2-id="+best_edges[i].stops[1].sid.toString()+"&edge-id="+best_edges[i].sid.toString(),
                            async: true,
                            dataType: 'json',
                            success: function(data, status) {
                            }
                        });
                    }
                }
            });
        }

        for (var i = 0; i < this.station_markers.length; i++)  {
            if (this.station_markers[i].station.sid == station.sid) {
                this.station_markers[i].generate_popup();
            }
        }

        for (var i = 0; i < lines_to_draw.length; i++) {
            this.draw_line(lines_to_draw[i], false, true);
        }
        this.station_marker_layer.bringToFront();
        
        this.get_ridership();
        this.update_line_diagram();

    }

    remove_station(id) {

        var impacted_lines = [];
        var impacted_stops = [];

        // Remove all stops that use this station.
        for (var i = 0; i < this.active_service.lines.length; i++) {
            var line = this.active_service.lines[i];
            for (var j = 0; j < line.stops.length; j++) {
                var stop = line.stops[j];
                if (stop.station.sid == id) {
                    // Found a match. Remove the stop
                    impacted_stops.push(stop);
                    line.stops.splice(j, 1);

                    if (INC_UPDATES) {
                        $.ajax({ url: "stop-remove?i="+NS_session+"&service-id="+NS_interface.active_service.sid.toString()+"&line-id="+line.sid.toString()+"&stop-id="+stop.sid.toString(),
                            async: true,
                            dataType: 'json',
                            success: function(data, status) {
                            }
                        });
                    }

                    // Add to impacted lines.
                    if (impacted_lines.indexOf(line) == -1) {
                        impacted_lines.push(line);
                    }

                    // Shift the iterator back one.
                    j -= 1;
                }
            }
        }

        // Remove all edges that use this station.

        for (var i = 0; i < impacted_lines.length; i++) {
            var line = impacted_lines[i];
            var impacted_edges = [];
            for (var j = 0; j < line.edges.length; j++) {
                var edge = line.edges[j];
                for (var k = 0; k < impacted_stops.length; k++) {
                    if (edge.has_stop(impacted_stops[k])) {
                        impacted_edges.push(edge);
                        // Add any impacted lines
                        for (var l = 0; l < edge.stops.length; l++) {
                            var station_pairs = this.get_station_pairs(edge.stops[l].station);
                            for (var m = 0; m < station_pairs.length; m++) {
                                var sp_line_cps = station_pairs[m][0].line_control_points;
                                for (var n = 0; n < sp_line_cps.length; n++) {
                                    var sp_line = sp_line_cps[n].line;
                                    if (impacted_lines.indexOf(sp_line) == -1) {
                                        impacted_lines.push(sp_line);
                                    }
                                }
                            }
                        }
                        line.remove_edge(edge);
                        if (INC_UPDATES) {
                            $.ajax({ url: "edge-remove?i="+NS_session+"&service-id="+NS_interface.active_service.sid.toString()+"&line-id="+line.sid.toString()+"&edge-id="+edge.sid.toString(),
                                async: true,
                                dataType: 'json',
                                success: function(data, status) {
                                }
                            });
                        }
                        j -= 1;
                    }
                }
            }

            // Connect any gaps in the line
            if (impacted_edges.length > 1) {
                // Choose a random stop to connect the other edges to
                var central_edge = impacted_edges[Math.floor(Math.random() * impacted_edges.length)];
                var central_stop = central_edge.stops[0];
                if (central_stop.station.sid == id) {
                    central_stop = central_edge.stops[1];
                }

                // Add new edges
                for (var l = 0; l < impacted_edges.length; l++) {
                    var edge = impacted_edges[l];
                    if (edge.sid != central_edge.sid) {
                        var spoke_stop = edge.stops[0];
                        if (spoke_stop.station.sid == id) {
                            spoke_stop = edge.stops[1];
                        }
                        if (spoke_stop.sid != central_stop.sid) {
                            var new_edge = new Edge([central_stop, spoke_stop]);
                            line.add_edge(new_edge);
                            if (INC_UPDATES) {
                                $.ajax({ url: "edge-add?i="+NS_session+"&service-id="+NS_interface.active_service.sid.toString()+"&line-id="+line.sid.toString()+"&stop-1-id="+new_edge.stops[0].sid.toString()+"&stop-2-id="+new_edge.stops[1].sid.toString()+"&edge-id="+new_edge.sid.toString(),
                                    async: true,
                                    dataType: 'json',
                                    success: function(data, status) {
                                    }
                                });
                            }
                        }
                    }
                }

                // Check for orphaned stops
                for (var l = 0; l < line.stops.length; l++) {
                    var stop = line.stops[l];
                    var is_orphan = true;
                    for (var m = 0; m < line.edges.length; m++) {
                        var edge = line.edges[m];
                        if (edge.has_stop(stop)) {
                            is_orphan = false;
                        }
                    }
                    if (is_orphan) {
                        var delta = this.get_insertion_result(line, stop);
                        var best_edges = delta.add;
                        var edges_to_remove = delta.remove;

                        for (var i = 0; i < best_edges.length; i++) {
                            best_edges[i].sid = NS_id.id();
                            line.add_edge(best_edges[i]);
                            if (INC_UPDATES) {
                                $.ajax({ url: "edge-add?i="+NS_session+"&service-id="+NS_interface.active_service.sid.toString()+"&line-id="+line.sid.toString()+"&stop-1-id="+best_edges[i].stops[0].sid.toString()+"&stop-2-id="+best_edges[i].stops[1].sid.toString()+"&edge-id="+best_edges[i].sid.toString(),
                                    async: true,
                                    dataType: 'json',
                                    success: function(data, status) {
                                    }
                                });
                            }
                        }
                        for (var i = 0; i < edges_to_remove.length; i++) {
                            line.remove_edge(edges_to_remove[i]);
                            if (INC_UPDATES) {
                                $.ajax({ url: "edge-remove?i="+NS_session+"&service-id="+NS_interface.active_service.sid.toString()+"&line-id="+line.sid.toString()+"&edge-id="+edges_to_remove[i].sid.toString(),
                                    async: true,
                                    dataType: 'json',
                                    success: function(data, status) {
                                    }
                                });
                            }
                        }
                    }
                }
            }
        }


        // Remove this station.
        for (var i = 0; i < this.active_service.stations.length; i++) {
            var station = this.active_service.stations[i];
            if (station.sid == id) {
                this.active_service.stations.splice(i, 1);
                if (INC_UPDATES) {
                    $.ajax({ url: "station-remove?i="+NS_session+"&service-id="+NS_interface.active_service.sid.toString()+"&station-id="+station.sid.toString(),
                        async: true,
                        dataType: 'json',
                        success: function(data, status) {

                        }
                    });
                }
            }
        }

        // Remove the station marker.
        for (var i = 0; i < this.station_markers.length; i++) {
            var station_marker = this.station_markers[i];
            if (station_marker.station.sid == id) {
                this.station_marker_layer.removeLayer(station_marker.marker);
                this.station_markers.splice(i, 1);
            }
        }
        
        // Remove all StationPairs that have this station.
        
        for (var i = this.station_pairs.length - 1; i >= 0; i--) {
            var station_pair = this.station_pairs[i];
            if (station_pair.stations[0].sid == id || station_pair.stations[1].sid == id) {
                this.station_pairs[i].undraw();
                this.station_pairs.splice(i, 1);
            }
        }

        // Redraw all impacted lines.
        for (var i = 0; i < impacted_lines.length; i++) {
            this.draw_line(impacted_lines[i], false, true);
        }
        this.station_marker_layer.bringToFront();

        this.get_ridership();
        this.update_line_diagram();

    }
    
    remove_line_from_station(station_id, line_id) {

        var line = this.active_service.get_line_by_id(line_id);
        var station = this.active_service.get_station_by_id(station_id);
        var stop = line.get_stop_by_station(station);
        var impacted_lines = this.active_service.station_lines(station);
        
        if (impacted_lines.length == 1) {
            this.remove_station(station_id);
            return 0;
        }
            
        line.remove_stop(stop);
        
        if (INC_UPDATES) {
            $.ajax({ url: "stop-remove?i="+NS_session+"&service-id="+NS_interface.active_service.sid.toString()+"&line-id="+line.sid.toString()+"&stop-id="+stop.sid.toString(),
                async: true,
                dataType: 'json',
                success: function(data, status) {
                }
            });
        }

        // Remove all edges that use this station.

        var impacted_edges = [];
        for (var j = 0; j < line.edges.length; j++) {
            var edge = line.edges[j];
            if (edge.has_stop(stop)) {
                impacted_edges.push(edge);
                line.remove_edge(edge);
                if (INC_UPDATES) {
                    $.ajax({ url: "edge-remove?i="+NS_session+"&service-id="+NS_interface.active_service.sid.toString()+"&line-id="+line.sid.toString()+"&edge-id="+edge.sid.toString(),
                        async: true,
                        dataType: 'json',
                        success: function(data, status) {
                        }
                    });
                }
                j -= 1;
            }
        }

        // Connect any gaps in the line
        if (impacted_edges.length > 1) {
            // Choose a random stop to connect the other edges to
            var central_edge = impacted_edges[Math.floor(Math.random() * impacted_edges.length)];
            var central_stop = central_edge.stops[0];

            // Add new edges
            for (var l = 0; l < impacted_edges.length; l++) {
                var edge = impacted_edges[l];
                if (edge.sid != central_edge.sid) {
                    var spoke_stop = edge.stops[0];
                    if (spoke_stop.sid != central_stop.sid) {
                        var new_edge = new Edge([central_stop, spoke_stop]);
                        line.add_edge(new_edge);
                        if (INC_UPDATES) {
                            $.ajax({ url: "edge-add?i="+NS_session+"&service-id="+NS_interface.active_service.sid.toString()+"&line-id="+line.sid.toString()+"&stop-1-id="+new_edge.stops[0].sid.toString()+"&stop-2-id="+new_edge.stops[1].sid.toString()+"&edge-id="+new_edge.sid.toString(),
                                async: true,
                                dataType: 'json',
                                success: function(data, status) {
                                }
                            });
                        }
                    }
                }
            }

            // Check for orphaned stops
            for (var l = 0; l < line.stops.length; l++) {
                var stop = line.stops[l];
                var is_orphan = true;
                for (var m = 0; m < line.edges.length; m++) {
                    var edge = line.edges[m];
                    if (edge.has_stop(stop)) {
                        is_orphan = false;
                    }
                }
                if (is_orphan) {
                    var delta = this.get_insertion_result(line, stop);
                    var best_edges = delta.add;
                    var edges_to_remove = delta.remove;

                    for (var i = 0; i < best_edges.length; i++) {
                        best_edges[i].sid = NS_id.id();
                        line.add_edge(best_edges[i]);
                        if (INC_UPDATES) {
                            $.ajax({ url: "edge-add?i="+NS_session+"&service-id="+NS_interface.active_service.sid.toString()+"&line-id="+line.sid.toString()+"&stop-1-id="+best_edges[i].stops[0].sid+"&stop-2-id="+best_edges[i].stops[1].sid+"&edge-id="+best_edges[i].sid.toString(),
                                async: true,
                                dataType: 'json',
                                success: function(data, status) {
                                }
                            });
                        }
                    }
                    for (var i = 0; i < edges_to_remove.length; i++) {
                        line.remove_edge(edges_to_remove[i]);
                        if (INC_UPDATES) {
                            $.ajax({ url: "edge-remove?i="+NS_session+"&service-id="+NS_interface.active_service.sid.toString()+"&line-id="+line.sid.toString()+"&edge-id="+edges_to_remove[i].sid.toString(),
                                async: true,
                                dataType: 'json',
                                success: function(data, status) {
                                }
                            });
                        }
                    }
                }
            }
        }

        // Redraw all impacted lines.
        for (var i = 0; i < impacted_lines.length; i++) {
            this.draw_line(impacted_lines[i], false, true);
        }
        // Refresh the marker
        this.get_station_marker_by_station(station).generate_popup();
        
        this.station_marker_layer.bringToFront();

        this.get_ridership();
        this.update_line_diagram();

    }

    update_edge_paths(line) {
        if (line.sid in this.line_paths) {
            var line_path = this.line_paths[line.sid];
        } else {
            var line_path = new LinePath();
            this.line_paths[line.sid] = line_path;
        }

        // Clear edge paths array.
        line_path.raw_edge_paths = [];

        // Initialize control points array.
        var edge_tentative_control_points = [];
        for (var j = 0; j < line.edges.length; j++) {
            edge_tentative_control_points[j] = [];
        }

        // Get the outer stops.
        var outer_stops = line.outer_stops();
        var active_stop = outer_stops[0];

        // Initialize visited stops.
        var visited = {};
        var visited_stops_count = 0;
        for (var j = 0; j < line.stops.length; j++) {
            visited[line.stops[j].sid] = 0;
        }

        var bezier_coordinates = [[]];
        var bezier_stops = [[]];
        var control_points = {}; // edge.sid :: control_points

        // recursive DFS to find all the paths
        function dfs(v) {
            //console.log("DFS: node "+v.station.name);

            // Add new stop.
            bezier_stops[bezier_stops.length-1].push(v);
            bezier_coordinates[bezier_coordinates.length-1].push({"x": v.station.location[0], "y": v.station.location[1]});

            visited[v.sid] = 1;
            var neighbors = line.neighbors(v);
            var new_neighbor_count = 0;
            for (var i = 0; i < neighbors.length; i++) {
                var w = neighbors[i];
                if (!visited[w.sid]) {
                    if (new_neighbor_count > 0) {
                        // Expand the Bezier arrays to start a new path.
                        bezier_coordinates.push([]);
                        bezier_stops.push([]);
                        bezier_coordinates[bezier_coordinates.length-1].push({"x": v.station.location[0], "y": v.station.location[1]});
                        bezier_stops[bezier_stops.length-1].push(v);
                    }
                    new_neighbor_count += 1;
                    dfs(w);
                }
            }
        }
        
        if (outer_stops.length > 0) {
            dfs(active_stop);
        }

        if (line.edges.length > 0) {
            for (var i = 0; i < bezier_coordinates.length; i++) {

                var spline = new BezierSpline({points: bezier_coordinates[i], sharpness: 0.6});

                for (var j = 1; j < bezier_stops[i].length; j++) {
                    for (var k = 0; k < line.edges.length; k++) {
                        var stops_to_compare = [bezier_stops[i][j-1], bezier_stops[i][j]];
                        var compare_result = line.edges[k].compare_stops(stops_to_compare);
                        if (compare_result) {
                            // Edge matches. Add the control points
                            if (compare_result == 1) {
                                var cp_0 = new BezierControlPoint(spline.controls[j-1][1].y, spline.controls[j-1][1].x);
                                var cp_1 = new BezierControlPoint(spline.controls[j][0].y, spline.controls[j][0].x);
                            } else {
                                var cp_0 = new BezierControlPoint(spline.controls[j][0].y, spline.controls[j][0].x);
                                var cp_1 = new BezierControlPoint(spline.controls[j-1][1].y, spline.controls[j-1][1].x);
                            }
                            control_points[line.edges[k].sid] = [cp_0, cp_1];
                        }
                    }
                }
            }
        }

        // Draw new edge paths.
        for (var j = 0; j < line.edges.length; j++) {
            var edge = line.edges[j];
            var stop_points = [[edge.stops[0].station.location[0], edge.stops[0].station.location[1]], [edge.stops[1].station.location[0], edge.stops[1].station.location[1]]];

            var edge_control_points = [];
            if (edge.sid in control_points) {
                edge_control_points = control_points[edge.sid];
            }
            var raw_edge_path = new EdgePath(edge.sid, stop_points, [edge_control_points], 0, line.color_bg, 1.0);

            line_path.raw_edge_paths.push(raw_edge_path);
        }

    }

    tweak_line_path(line) {
        // Go through each edge of this line,
        // look for shared stretches,
        // and tweak the edge paths to match the shared stretch.

        console.log("TWEAK "+line.name);
        var line_path = this.line_paths[line.sid];
        line_path.edge_paths = [];

        var draw_stops = []
        for (var i = 0; i < line_path.raw_edge_paths.length; i++) {
            // For each "raw" edge,
            // look for related raw edges on other lines.
            var raw_edge_path = line_path.raw_edge_paths[i];
            var edge = line.get_edge_by_id(raw_edge_path.edge_id);
            
            console.log("Base Edge: "+edge.stops[0].station.sid+", "+edge.stops[1].station.sid);
            var base_edge_order = 0;
            if (edge.stops[0].station.sid > edge.stops[1].station.sid) {
                base_edge_order = 1;
            }
            var stops = edge.stops;
            var drawmaps = NS_interface.active_service.drawmap(stops[0], stops[1], line);
            //console.log(drawmaps);
            var drawmap_followed = false;
            
            if (drawmaps.length > 1) {

                // Figure out which drawmap reflects the line we're drawing.
                var current_line_index = 0;
                
                for (var k = 0; k < drawmaps.length; k++) {
                    if (drawmaps[k].line == line) {
                        current_line_index = k;
                    }
                }
                
                // Iterate through the drawmaps.
                for (var k = 0; k < drawmaps.length; k++) {
                    var drawmap = drawmaps[k];
                    var line_path_to_follow = this.line_paths[drawmap.line.sid];
                    var drawmap_edge_order = 0;
                    
                    // Figure out the drawmap edge order
                    if (drawmap.line.sid != line.sid) {
                        if (drawmap.stops.length == 2) {
                            var edge_to_follow = drawmap.line.get_edge_by_stops([drawmap.stops[0], drawmap.stops[1]]);
                            if (edge_to_follow.stops[0].station.sid > edge_to_follow.stops[1].station.sid) {
                                drawmap_edge_order = 1;
                            }
                        } else {
                            var edge_to_follow_1 = drawmap.line.get_edge_by_stops([drawmap.stops[0], drawmap.stops[1]]);
                            var edge_to_follow_2 = drawmap.line.get_edge_by_stops([drawmap.stops[drawmap.stops.length - 2], drawmap.stops[drawmap.stops.length - 1]]);
                            if (edge_to_follow_1.stops[0].station.sid == edge.stops[0].station.sid) {
                                drawmap_edge_order = base_edge_order;
                            } else {
                                if (base_edge_order == 0) {
                                    drawmap_edge_order = 1;
                                }
                            }
                        }
                    }
                    
                    // Follow the first drawmap.
                    if (!drawmap_followed && drawmap.line.sid != line.sid) {
                    
                        drawmap_followed = true;
                        var stop_points = [];
                        var control_points = [];
                        
                        
                        
                        for (var j = 1; j < drawmap.stops.length; j++) {
                            var edge_to_follow = drawmap.line.get_edge_by_stops([drawmap.stops[j-1], drawmap.stops[j]]);
                            var raw_edge_path_to_follow = line_path_to_follow.get_raw_path_for_edge(edge_to_follow);
                            if (j == 1) {
                                stop_points.push.apply(stop_points, [drawmap.stops[j-1].station.location]);
                                //control_points.push.apply(control_points, raw_edge_path_to_follow.control_points);
                            }
                            var compare_result = edge_to_follow.compare_stops([drawmap.stops[j-1], drawmap.stops[j]]);
                            var stop_points_to_add = raw_edge_path_to_follow.stop_points;
                            var control_points_to_add = raw_edge_path_to_follow.control_points;

                            // Edge matches. Add the control points
                            if (compare_result == 2) {
                                // reverse it
                                stop_points_to_add = [stop_points_to_add[1], stop_points_to_add[0]];
                                control_points_to_add = [[control_points_to_add[0][1], control_points_to_add[0][0]]];
                            }
                            stop_points.push.apply(stop_points, [drawmap.stops[j].station.location]);
                            control_points.push.apply(control_points, control_points_to_add);

                            // Set the offset
                            
                            console.log("Edge: "+edge_to_follow.stops[0].station.sid+", "+edge_to_follow.stops[1].station.sid);
                            var edge_path_to_follow = line_path_to_follow.get_path_for_edge(edge_to_follow);
                            edge_path_to_follow.offset = k*2 - (drawmaps.length-1);
                            if (drawmap_edge_order != base_edge_order) {
                                console.log("inverting!");
                                edge_path_to_follow.offset = edge_path_to_follow.offset * -1;
                            }
                            this.regenerate_edge_path(drawmap.line, edge_path_to_follow);
                            console.log("line "+drawmap.line.name+" offset "+edge_path_to_follow.offset);
                            //console.log(edge_path_to_follow);
                        }
                        var edge_path = new EdgePath(edge.sid, stop_points, control_points, current_line_index*2 - (drawmaps.length-1), line.color_bg, 1.0);
                        line_path.edge_paths.push(edge_path);
                        //console.log(edge_path);
                        this.refresh_edge_paths(drawmap.line);
                    // If we already did that, just adjust the remaining drawmaps.
                    } else if (drawmap.line.sid != line.sid) {
                        if (drawmap.stops[0].station.sid > drawmap.stops[drawmap.stops.length - 1].station.sid) {
                            drawmap_edge_order = 1;
                        }
                        
                        for (var j = 1; j < drawmap.stops.length; j++) {
                            // Set the offset
                            var edge_to_follow = drawmap.line.get_edge_by_stops([drawmap.stops[j-1], drawmap.stops[j]]);
                            var edge_path_to_follow = line_path_to_follow.get_path_for_edge(edge_to_follow);
                            console.log("Edge: "+edge_to_follow.stops[0].station.sid+", "+edge_to_follow.stops[1].station.sid);
                            edge_path_to_follow.offset = k*2 - (drawmaps.length-1);
                            if (drawmap_edge_order != base_edge_order) {
                                console.log("inverting!");
                                edge_path_to_follow.offset = edge_path_to_follow.offset * -1;
                            }
                            this.regenerate_edge_path(drawmap.line, edge_path_to_follow);
                            console.log("line "+drawmap.line.name+" offset "+edge_path_to_follow.offset);
                        }
                        this.refresh_edge_paths(drawmap.line);
                    }
                }
            } else {
                var edge_path = new EdgePath(edge.sid, raw_edge_path.stop_points, raw_edge_path.control_points, 0, line.color_bg, 1.0);
                line_path.edge_paths.push(edge_path);
            }
        }
    }
    
    update_station_markers(line) {
        for (var i = 0; i < line.stops.length; i++) {
            var station = line.stops[i].station;
            var station_marker = this.get_station_marker_by_station(station);
            var num_colors = num_unique_colors(this.active_service.station_lines(station));
            station_marker.marker.setRadius(Math.max(num_colors, 2) * 3);
        }
    }
    
    has_station_pair(station_1, station_2) {
        for (var i = 0; i < this.station_pairs.length; i++) {
            var station_pair = this.station_pairs[i];
            if (station_pair.stations[0] == station_1 && station_pair.stations[1] == station_2) {
                return true;
            }
            if (station_pair.stations[0] == station_2 && station_pair.stations[1] == station_1) {
                return true;
            }
        }
        return false;
    }
    
    get_station_pair(station_1, station_2) {
        for (var i = 0; i < this.station_pairs.length; i++) {
            var station_pair = this.station_pairs[i];
            if (station_pair.stations[0] == station_1 && station_pair.stations[1] == station_2) {
                return [station_pair, 0]
            }
            if (station_pair.stations[0] == station_2 && station_pair.stations[1] == station_1) {
                return [station_pair, 1];
            }
        }
        return null;
    }
    
    get_station_pair_by_sp_id(sp_id) {
        for (var i = 0; i < this.station_pairs.length; i++) {
            if (this.station_pairs[i].sid == sp_id) {
                return this.station_pairs[i];
            }
        }
        return null;
    }
    
    get_station_pairs(station) {
        var station_pairs = [];
        for (var i = 0; i < this.station_pairs.length; i++) {
            var station_pair = this.station_pairs[i];
            if (station_pair.stations[0] == station) {
                station_pairs.push([station_pair, 0]);
            }
            if (station_pair.stations[1] == station) {
                station_pairs.push([station_pair, 1]);
            }
        }
        return station_pairs;
    }

    /**
     * Draw a line.
     * line : line to draw
     * btf : true if station_markers should be brought to the front after the finish
     * render : if the station_pairs should actually be rendered (or just updated)
     **/
    draw_line(line, btf, render) {
        //console.log("draw line "+line.name);
        
        if (line.sid in this.line_paths) {
            var line_path = this.line_paths[line.sid];
        } else {
            var line_path = new LinePath();
            this.line_paths[line.sid] = line_path;
        }

        // Remove existing edge paths.
        for (var i = 0; i < line_path.edge_paths.length; i++) {
            this.line_path_layer.removeLayer(line_path.edge_paths[i].path);
        }
        
        // Clear all station pairs.
        for (var i = 0; i < this.station_pairs.length; i++) {
            if (this.station_pairs[i].has_line(line)) {
                this.station_pairs[i].clear_line_control_points(line);
                this.station_pairs[i].generate_paths();
                this.station_pairs[i].draw();
            }
        }
        
        var station_pairs_to_draw = [];

        if (line.stops.length > 1) {
            //this.update_edge_paths(line);
            //this.tweak_line_path(line);
            var station_drawmap = NS_interface.active_service.station_drawmap(line);
            //console.log(station_drawmap);
            for (var i = 0; i < station_drawmap.length; i++) {
                var branch = station_drawmap[i];
                var branch_coordinates = [];
                // Convert branch to coordinates
                for (var j = 0; j < branch.length; j++) {
                    branch_coordinates[j] = {"x": branch[j].location[0], "y": branch[j].location[1]};
                }
                var spline = new BezierSpline({points: branch_coordinates, sharpness: 0.6});
                //console.log(spline);
                
                for (var j = 0; j < branch.length - 1; j++) {
                    var station_1 = branch[j];
                    var station_2 = branch[j+1];
                    
                    if (this.has_station_pair(station_1, station_2)) {
                        var spr = this.get_station_pair(station_1, station_2);
                        var station_pair = spr[0];
                        var station_pair_polarity = spr[1];
                    } else {
                        var station_pair = new StationPair([station_1, station_2]);
                        if (station_1.sid > station_2.sid) {
                            station_pair.draw_inverted = true;
                        }
                        this.station_pairs.push(station_pair);
                        var station_pair_polarity = 0;
                    }
                    if (station_pair_polarity == 0) {
                        station_pair.add_control_points(line, [new BezierControlPoint(spline.controls[j][1].x, spline.controls[j][1].y), new BezierControlPoint(spline.controls[j+1][0].x, spline.controls[j+1][0].y)]);
                    }
                    if (station_pair_polarity == 1) {
                        station_pair.add_control_points(line, [new BezierControlPoint(spline.controls[j+1][0].x, spline.controls[j+1][0].y), new BezierControlPoint(spline.controls[j][1].x, spline.controls[j][1].y)]);
                    }
                    
                    station_pair.generate_paths();
                    station_pairs_to_draw.push(station_pair);
                    
                    // Draw now, for debug only
                    //station_pair.draw();
                }
            }
            
            this.update_station_markers(line);
        }
        if (render) {
            // Draw new station pairs.
            for (var i = 0; i < station_pairs_to_draw.length; i++) {
                station_pairs_to_draw[i].draw();
            }
        }

        // Bring station marker layer to front.
        if (btf) {
            this.station_marker_layer.bringToFront();
        }
    }
    
    purge_station_pairs() {
        for (var i = this.station_pairs.length - 1; i >= 0; i--) {
            var station_pair = this.station_pairs[i];
            if (this.active_service.get_station_by_id(station_pair.stations[0].sid) == null || this.active_service.get_station_by_id(station_pair.stations[1].sid) == null) {
                this.station_pairs.splice(i,1);
            }
        }
    }
    
    /**
     * Traverses the entire map and tries to align station_pairs so that offsets are consistent
     **/
    direct_station_pairs() {
        var marked_ids = [];
    }
    
    regenerate_edge_path(line, edge_path) {
        var line_path = this.line_paths[line.sid];
        this.line_path_layer.removeLayer(edge_path.path);
        edge_path.regenerate_path();
        this.line_path_layer.addLayer(edge_path.path);
    }

    refresh_edge_paths(line) {
        //console.log("refresh edge paths for line "+line.name);
        var line_path = this.line_paths[line.sid];
        // Remove existing edge paths.
        for (var i = 0; i < line_path.edge_paths.length; i++) {
            this.line_path_layer.removeLayer(line_path.edge_paths[i].path);
        }

        // Draw new edge paths.
        for (var j = 0; j < line_path.edge_paths.length; j++) {
            line_path.edge_paths[j].regenerate_path();
            var path = line_path.edge_paths[j].path;
            this.line_path_layer.addLayer(path);
        }
        // Bring station layer to front.
        this.station_marker_layer.bringToFront();
    }

    preview_line(line, lat, lng) {
        this.preview_clear();

        // Create dummy station and stop
        var station = new Station("preview", [lat, lng], true);
        var stop = new Stop(station, true);

        // Get the EdgeDelta from this new stop
        var delta = this.get_insertion_result(line, stop);

        // Draw the edge path
        for (var j = 0; j < delta.add.length; j++) {
            var edge = delta.add[j];

            var stop_points = [[edge.stops[0].station.location[0], edge.stops[0].station.location[1]], [edge.stops[1].station.location[0], edge.stops[1].station.location[1]]];
            var edge_path = new EdgePath(edge.sid, stop_points, [], [], line.color_bg, 0.2);

            this.preview_paths.push(edge_path);
            this.preview_path_layer.addLayer(edge_path.path);
        }

        // Bring station layer to front.
        this.station_marker_layer.bringToFront();
    }

    preview_clear() {
        // Remove existing preview paths.
        this.preview_path_layer.clearLayers();

        // Clear preview paths array.
        this.preview_paths = [];
    }

    preview_handler(e) {
        if (this.preview_paths_enabled) {
            if (this.active_tool == "station") {
                if (this.active_line != null) {
                    this.preview_line(this.active_line, e.latlng.lat, e.latlng.lng);
                }
            }
            if (this.active_tool == "line") {
                if (this.active_line != null) {
                    this.preview_station(e.latlng.lat, e.latlng.lng);
                    //this.preview_station_pair(e.latlng.lat, e.latlng.lng);
                }
            }
        }
    }
    
    draw_bezier_rep_for_station(station) {
        var station_pairs = this.get_station_pairs(station);
        for (var i = 0; i < station_pairs.length; i++) {
            var polyline_latlngs = [];
            if (station_pairs[i][0].stations[0].sid == station.sid) {
                polyline_latlngs.push(station_pairs[i][0].markers()[0].marker.getLatLng());
            }
            if (station_pairs[i][0].stations[1].sid == station.sid) {
                polyline_latlngs.push(station_pairs[i][0].markers()[1].marker.getLatLng());
            }
            polyline_latlngs.push(L.latLng(station.location[0], station.location[1]));
            this.bezier_layer.addLayer(L.polyline(polyline_latlngs, {color: '#A77', weight: 1, dashArray: '4,4'}));
        }
    }
    
    draw_bezier_rep(station_pair, cutoff, locus, use_locus) {
        var polyline_latlngs = [];
        var dir = 1;
        if (station_pair.stations[0].sid == locus.sid || !use_locus) {
            polyline_latlngs.push(L.latLng(station_pair.stations[0].location[0], station_pair.stations[0].location[1]));
            dir = 0;
        }
        var best_pair_markers = station_pair.markers();
        for (var i = 0; i < Math.min(cutoff, best_pair_markers.length); i++) {
            if (dir == 1) {
                polyline_latlngs.push(best_pair_markers[best_pair_markers.length - i - 1].marker.getLatLng());
            } else {
                polyline_latlngs.push(best_pair_markers[i].marker.getLatLng());
            }
        }
        if (cutoff >= best_pair_markers.length || !use_locus) {
            if (station_pair.stations[1].sid == locus.sid) {
                polyline_latlngs.push(L.latLng(station_pair.stations[1].location[0], station_pair.stations[1].location[1]));
            }
        }
        this.bezier_layer.addLayer(L.polyline(polyline_latlngs, {color: 'red', weight: 1, dashArray: '2,2'}));
    }
    /*
    preview_station_pair(lat, lng) {
        this.preview_clear();
        
        var turf_e = {"type": "Feature", "properties": {}, "geometry": { "type": "Point", "coordinates": [lng, lat]}};

        // Find the nearest station_pair
        var best_distance = 0;
        var best_pair = null;
        var best_pair_markers = null;
        for (var i = 0; i < this.station_pairs.length; i++) {
            var pair = this.station_pairs[i];
            var center_lng = (pair.stations[0].location[1] + pair.stations[1].location[1])/2.0;
            var center_lat = (pair.stations[0].location[0] + pair.stations[1].location[0])/2.0;

            var turf_s = {"type": "Feature", "properties": {}, "geometry": { "type": "Point", "coordinates": [center_lng, center_lat]}};
            var distance = turf.distance(turf_e, turf_s, "miles");

            if (best_distance > distance || best_pair == null) {
                best_pair = pair;
                best_distance = distance;
            }
        }
        var marker_index = 0;
        
        if (best_pair != null) {
            // Create pair highlighter
            //var pair_highlight = best_pair.average_path();
            //this.preview_path_layer.addLayer(pair_highlight);
            
            best_pair_markers = best_pair.markers();
            this.draw_bezier_rep(best_pair, 2, best_pair.stations[0], false);
            
            for (var i = 0; i < best_pair_markers.length; i++) {
                best_pair_markers[i].marker.on('click', function(event) {
                    

                });
                best_pair_markers[i].marker.on('mousedown', function (event) {
                    NS_interface.preview_paths_enabled = false;
                    console.log("clicked control point");
                    NS_interface.moving_control_point = this;
                    NS_interface.moving_control_point_index = this.mcp_index;
                    NS_interface.moving_control_point_sp_id = this.sp_id;
            
                    NS_interface.map.dragging.disable();
                    let {lat: circleStartingLat, lng: circleStartingLng} = this._latlng;
                    let {lat: mouseStartingLat, lng: mouseStartingLng} = event.latlng;

                    NS_interface.map.on('mousemove', function(event) {
                        console.log("control point mousemove");
                        let {lat: mouseNewLat, lng: mouseNewLng} = event.latlng;
                        let latDifference = mouseStartingLat - mouseNewLat;
                        let lngDifference = mouseStartingLng - mouseNewLng;

                        let center = [circleStartingLat-latDifference, circleStartingLng-lngDifference];
                        NS_interface.moving_control_point.setLatLng(center);
                        NS_interface.move_control_point(best_pair, NS_interface.moving_control_point_index, center);
                        NS_interface.draw_bezier_rep(best_pair, 2, best_pair.stations[0], false);
                        var lines = best_pair.lines();
                        for (var i = 0; i < lines.length; i++) {
                            NS_interface.draw_line(lines[i], false);
                        }
                        NS_interface.station_marker_layer.bringToFront();
                    });
                });
                this.preview_path_layer.addLayer(best_pair_markers[i].marker);
            }
        }
        
    }
    */
    move_control_point(station_pair, i, location) {
        station_pair.user_control_points[i] = new BezierControlPoint(location[0], location[1]);
        station_pair.user_modified = true;
    }
    
    control_point_reflections(station_pair, index) {
        var returned_points = [];
        // Find reflected station pairs
        for (var i = 0; i < this.station_pairs.length; i++) {
            var candidate_pair = this.station_pairs[i];
            if (candidate_pair.sid != station_pair.sid) {
                if (index == 0) {
                    if (station_pair.stations[0].sid == candidate_pair.stations[0].sid) {
                        returned_points.push(candidate_pair.markers()[0]);
                    }
                    if (station_pair.stations[0].sid == candidate_pair.stations[1].sid) {
                        returned_points.push(candidate_pair.markers()[1]);
                    }
                }
                if (index == 1) {
                    if (station_pair.stations[1].sid == candidate_pair.stations[0].sid) {
                        returned_points.push(candidate_pair.markers()[0]);
                    }
                    if (station_pair.stations[1].sid == candidate_pair.stations[1].sid) {
                        returned_points.push(candidate_pair.markers()[1]);
                    }
                }
            }
        }
        return returned_points;
    }

    preview_station(lat, lng) {
        this.preview_clear();

        var turf_e = {"type": "Feature", "properties": {}, "geometry": { "type": "Point", "coordinates": [lng, lat]}};

        // Find the nearest station
        
        var best_distance = 0;
        var best_station = null;
        for (var i = 0; i < NS_interface.active_service.stations.length; i++) {
            var station = NS_interface.active_service.stations[i];

            var turf_s = {"type": "Feature", "properties": {}, "geometry": { "type": "Point", "coordinates": [station.location[1], station.location[0]]}};
            var distance = turf.distance(turf_e, turf_s, "miles");

            if (best_distance > distance || best_station == null) {
                best_station = station;
                best_distance = distance;
            }
        }

        //console.log(best_station);
        if (best_station != null) {
            
            var station_marker = this.get_station_marker_by_station(best_station);
            
            this.nearest_station_to_mouse = best_station;
            
            // Create station highlighter
            var station_highlight = L.circleMarker([best_station.location[0], best_station.location[1]], {radius: 10, color: "#A77"});
            this.preview_paths.push(station_highlight);
            this.preview_path_layer.addLayer(station_highlight);
            
            // Get station pairs containing this station
            if (this.station_for_bezier_edits == best_station) {
                this.bezier_layer.clearLayers();
                var station_pairs = this.get_station_pairs(best_station);
                for (var i = 0; i < station_pairs.length; i++) {
                    var pair = station_pairs[i][0];
                    this.draw_bezier_rep_for_station(best_station);
                    var pair_highlight = pair.average_path();
                    this.bezier_layer.addLayer(pair_highlight);
                    var markers = pair.markers();
                    for (var j = 0; j < markers.length; j++) {
                        if (j == 0 && pair.stations[0].sid == best_station.sid || j == 1 && pair.stations[1].sid == best_station.sid) {
                            markers[j].marker.on('click', function(e) {
                                //this.station_for_bezier_edits = best_station;
                            });
                            markers[j].marker.on('mousedown', function (event) {
                                NS_interface.preview_paths_enabled = false;
                                NS_interface.moving_control_point = this;
                                NS_interface.moving_control_point_index = this.mcp_index;
                                NS_interface.moving_control_point_sp_id = this.sp_id;
                                
                                var reflections = NS_interface.control_point_reflections(NS_interface.get_station_pair_by_sp_id(this.sp_id), this.mcp_index);
                                if (reflections.length == 1) {
                                    NS_interface.moving_opp_control_point = reflections[0].marker;
                                    NS_interface.moving_opp_control_point_index = reflections[0].sid;
                                    NS_interface.moving_opp_control_point_sp_id = reflections[0].sp_id;
                                } else {
                                    NS_interface.moving_opp_control_point = null;
                                    NS_interface.moving_opp_control_point_index = null;
                                    NS_interface.moving_opp_control_point_sp_id = null;
                                }
                        
                                NS_interface.map.dragging.disable();
                                let {lat: circleStartingLat, lng: circleStartingLng} = this._latlng;
                                let {lat: mouseStartingLat, lng: mouseStartingLng} = event.latlng;

                                NS_interface.map.on('mousemove', function(event) {
                                    let {lat: mouseNewLat, lng: mouseNewLng} = event.latlng;
                                    let latDifference = mouseStartingLat - mouseNewLat;
                                    let lngDifference = mouseStartingLng - mouseNewLng;

                                    let center = [circleStartingLat-latDifference, circleStartingLng-lngDifference];
                                    NS_interface.moving_control_point.setLatLng(center);
                                    var p = NS_interface.get_station_pair_by_sp_id(NS_interface.moving_control_point_sp_id);
                                    NS_interface.move_control_point(p, NS_interface.moving_control_point_index, center);
                                    
                                    if (NS_interface.moving_opp_control_point != null) {
                                        var opp_center_lat = NS_interface.station_for_bezier_edits.location[0]*2 - center[0];
                                        var opp_center_lng = NS_interface.station_for_bezier_edits.location[1]*2 - center[1];
                                        var opp_center = [opp_center_lat, opp_center_lng];
                                        NS_interface.moving_opp_control_point.setLatLng(opp_center);
                                        var p = NS_interface.get_station_pair_by_sp_id(NS_interface.moving_opp_control_point_sp_id);
                                        NS_interface.move_control_point(p, NS_interface.moving_opp_control_point_index, opp_center);
                                    }
                                    
                                    NS_interface.bezier_layer.clearLayers();
                                    NS_interface.draw_bezier_rep_for_station(best_station);
                                    var lines = p.lines();
                                    for (var k = 0; k < lines.length; k++) {
                                        NS_interface.draw_line(lines[k], false, true);
                                    }
                                    NS_interface.station_marker_layer.bringToFront();
                                });
                            });
                            this.bezier_layer.addLayer(markers[j].marker);
                        }
                    }
                }
            }
        }

        // Bring station layer to front.
        this.station_marker_layer.bringToFront();
    }

    update_line_diagram() {
        var line = this.active_line;

        // Get the outer stops.
        var outer_stops = line.outer_stops();
        var active_stop = outer_stops[0];

        // Initialize visited stops.
        var visited = {};
        var visited_stops_count = 0;
        for (var j = 0; j < line.stops.length; j++) {
            visited[line.stops[j].sid] = 0;
        }

        var stop_groups = [[]];
        var branch_pos = [];

        // recursive DFS to find all the paths
        function dfs(v) {
            //console.log("DFS: node "+v.station.name);

            stop_groups[stop_groups.length-1].push(v);

            visited[v.sid] = 1;
            var neighbors = line.neighbors(v);
            var new_neighbor_count = 0;
            for (var i = 0; i < neighbors.length; i++) {
                var w = neighbors[i];
                if (!visited[w.sid]) {
                    if (new_neighbor_count > 0) {
                        // Expand the arrays to start a new path.
                        stop_groups.push([]);
                        stop_groups[stop_groups.length-1].push(v);
                        branch_pos.push(v.sid);
                    }
                    new_neighbor_count += 1;
                    dfs(w);
                }
            }
        }

        if (line.stops.length > 0) {
            dfs(active_stop);
        }

        //console.log(stop_groups);

        $("#route-diagram").empty();

        var stop_index = 0;
        var stop_position = {}; // stop id :: position in route diagram list

        var branch_div = $('<div class="route-diagram-branch"></div>');
        $("#route-diagram").append(branch_div);

        for (var i = 0; i < stop_groups.length; i++) {
            var stop_group = stop_groups[i];

            // For everything past the 1st stop group, it's a branch. Ignore the first stop, it will be redundant.
            var start_index = 0;
            if (i > 0) {
                start_index = 1;
            }


            for (var j = start_index; j < stop_group.length; j++) {
                var stop = stop_group[j];

                // Add a leading connector if this is the start of a branch.
                if (j == start_index+1 && i > 0) {
                    branch_div = $('<div class="route-diagram-branch"></div>');
                    $("#route-diagram").append(branch_div);
                }
                
                if (branch_pos.indexOf(stop.sid) > -1) {
                    branch_div = $('<div class="route-diagram-branch"></div>');
                    $("#route-diagram").append(branch_div);
                    var connector_div = $('<div class="route-diagram-branch-connectors"></div>');
                    branch_div.append(connector_div);
                    connector_div.append('<div class="route-diagram-connector-top-joint" style="background-color: '+line.color_bg+';"></div>');
                    connector_div.append('<div class="route-diagram-connector-branch"><div class="route-diagram-connector-internal" style="background-color: '+line.color_bg+';"></div></div>');
                    connector_div.append('<div class="route-diagram-connector-bottom-joint" style="background-color: '+line.color_bg+';"></div>');
                }

                var stop_div = $('<div class="route-diagram-stop"></div>');
                branch_div.append(stop_div);
                stop_div.append('<div class="route-diagram-station-marker"></div>');

                // Add a trailing connector if this isn't the end of a branch.
                if (j != stop_group.length - 1) {
                    stop_div.append('<div class="route-diagram-connector" style="background-color: '+line.color_bg+'"></div>');
                }
                
                var stop_info_div = $('<div class="route-diagram-stop-info" id="station-'+stop.station.sid.toString()+'"></div>');
                stop_div.append(stop_info_div);
                stop_info_div.append('<div class="route-diagram-stop-name">'+stop.station.name+'</div>');
                
                var stop_connectors = $('<div class="route-diagram-stop-connectors"></div>');
                stop_info_div.append(stop_connectors);
                // Add an empty connector just to make sure each stop row has the height it needs
                stop_connectors.append('<div class="subway-line-long subway-line-mini subway-line-marker-diagram subway-line-marker-diagram-fake" style="font-size: 1em;"><div class="content"></div></div>');
                for (var k = 0; k < this.active_service.lines.length; k++) {
                    if (this.active_service.lines[k].sid != line.sid) {
                        if (this.active_service.lines[k].has_station(stop.station)) {
                            stop_connectors.append('<div class="subway-line-long subway-line-mini subway-line-marker-diagram" style="font-size: 1em; background-color: '+this.active_service.lines[k].color_bg+'; color: '+this.active_service.lines[k].color_fg+';"><div class="content">'+this.active_service.lines[k].name+'</div></div>');
                        }
                    }
                }

                // Store the stop index.
                stop_position[stop.sid] = stop_index;
                stop_index += 1;
            }
        }

    }

    get_ridership() {
        $.ajax({ url: "transit-model?i="+NS_session,
            async: true,
            dataType: 'json',
            success: function(data, status) {
                console.log(data);
                for (var i in data["ridership"]) {
                    var ridership = data["ridership"][i];
                    var station = NS_interface.active_service.get_station_by_id(parseInt(i));
                    station.ridership = ridership;
                    $("#stationriders-"+station.sid.toString()).text(Math.round(station.ridership).toString());
                }
            }
        });
    }
    
    get_hexagons() {
        var initial_bounds = this.map.getBounds();
        var search_bounds = initial_bounds.pad(0.1); // Pad for maximum scrollability
        $.ajax({ url: "get-hexagons?i="+NS_session+"&lat-min="+search_bounds.getSouth().toString()+"&lat-max="+search_bounds.getNorth().toString()+"&lng-min="+search_bounds.getWest().toString()+"&lng-max="+search_bounds.getEast().toString(),
            async: true,
            dataType: 'text',
            success: function(data_zip, status) {
                var data = JSON.parse(data_zip);
                //NS_interface.data_layer.clearLayers();
                /*
                var max_population = 0.0;
                var min_population = -1.0;
                var populations = [];
                for (var i = 0; i < data.length; i++) {
                    var population = data[i]["population"];
                    if (population > max_population) max_population = population;
                    if (population < min_population || min_population == -1.0) min_population = population;
                    populations.push(population);
                }
                NS_interface.chroma_scale.domain([min_population, max_population], 7, 'quantiles');
                for (var i = 0; i < data.length; i++) {
                    var hexagon = data[i];
                    var population = hexagon["population"];
                    var opacity = 0.7;
                    var color = NS_interface.chroma_scale(population).hex();
                    if (hexagon["gid"] in NS_interface.hexagons) {
                        var h = NS_interface.hexagons[hexagon["gid"]];
                        if (h.color != color) {
                            h.color = color;
                            h.update_style();
                        }
                    } else {
                        var h = new Hexagon(hexagon["gid"], hexagon["geo"], color, opacity);
                        NS_interface.hexagons[hexagon["gid"]] = h;
                        if (initial_bounds.contains(h.poly.getBounds())) {
                            h.draw();
                        }
                    }
                }
                */
                NS_interface.data_layer.clearLayers();
                var num_breaks = 8;
                var breaks = quantiles(data, num_breaks, NS_interface.hexagon_layer);
                var scale = NS_interface.hexagon_scales[NS_interface.hexagon_layer];
                $("#scale-boxes").empty();
                for (var i = 0; i < num_breaks; i++) {
                    $("#scale-boxes").append('<div class="scale-box" style="background-color: '+scale((num_breaks-i)/num_breaks).hex()+' "></div>');
                }
                $("#scale-mid").text(Math.round(breaks[Math.round((num_breaks-1)/2)]/DGGRID_AREA).toString());
                $("#scale-high").text(Math.round(breaks[0]/DGGRID_AREA).toString());
                $("#scale-units").html(NS_interface.hexagon_units[NS_interface.hexagon_layer]);
                $("#scale").show();
                NS_interface.data_layer.addLayer(L.geoJson(data, {style: function(feature) {
                    var property = 0;
                    if (NS_interface.hexagon_layer == "population") property = feature.properties.population;
                    if (NS_interface.hexagon_layer == "employment") property = feature.properties.employment;
                    return {
                        fillColor: populationColor(property, breaks, scale),
                        weight: 0,
                        opacity: 1,
                        color: 'white',
                        fillOpacity: 0.35
                    };
                }}));
                NS_interface.line_path_layer.bringToFront();
                NS_interface.station_marker_layer.bringToFront();

            }
        });
    }

    load_session(session_id) {

    }

}

function sortNumber(a,b) {
    return a - b;
}

function quantiles(geojson, num_breaks, feature_name) {
    console.log(geojson);
    var property_array = []
    for (var i = 0; i < geojson.features.length; i++) {
        property_array.push(geojson.features[i].properties[feature_name]);
    }
    property_array.sort(sortNumber);
    var breaks = [];
    var index = property_array.length - 1;
    index -= Math.round(property_array.length/num_breaks);
    for (var j = 0; j <= num_breaks; j++) {
        breaks.push(property_array[index]);
        index -= Math.round(property_array.length/num_breaks);
        if (index < 0) index = 0;
    }
    return breaks;
        
}

function populationColor(d, breaks, scale) {
    var num_breaks = breaks.length - 1;
    for (var i = 0; i < num_breaks; i++) {
        if (d >= breaks[i]) return scale(i/num_breaks).hex();
    }
    return scale[num_breaks-1];
}

class LineDelta {

    constructor(add, remove) {
        this.add = add;
        this.remove = remove;
    }

}

function handle_map_click(e) {
    if (NS_interface.active_line != null && NS_interface.active_tool == "station") {
        NS_interface.add_new_station(e.latlng.lat, e.latlng.lng);
    }
}


function delete_station_event(e) {
    var station_id = $(this).attr('id').replace('delete-', '');
    NS_interface.remove_station(station_id);
}

function transfer_station_event(e) {
    var station_id = $(this).attr('id').replace('transfer-', '');
    var station = N_stations[station_id];

    if (N_transfer_state == 0) {
        N_transfer_origin = station_id;
        N_transfer_state = 1;
    }
}

function build_to_station_event(e) {
    var station_id = $(this).attr('id');
    NS_interface.add_stop_to_station(station_id);
}