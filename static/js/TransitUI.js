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
        this.hexagon_bounds = null;
        this.hexagon_zoom = null;
        this.data_layer_request_num = 0;
        this.preview_paths_enabled = true;

        this.nearest_station_to_mouse = null;
        this.station_for_bezier_edits = null;
        this.moving_station_marker = null; // Station marker being dragged
        this.station_to_merge = null; // Station to be merged with when moving station marker is released
        
        this.dragging_pin = false;
        this.station_pair_id_move_count_map = {};
        
        this.preview_line_pin_marker = null;

        this.active_transfer_station = null;
        
        this.pane_station_markers = this.map.createPane("stationMarkerPane");
        //this.pane_station_markers.style.zIndex = 8000;
        
        this.line_path_layer = L.featureGroup();
        this.transfer_layer = L.featureGroup();
        this.station_marker_layer = L.featureGroup({pane: "stationMarkerPane"});
        this.preview_path_layer = L.featureGroup();
        this.bezier_layer = L.featureGroup();
        this.data_layer = L.featureGroup();
        
        this.hexagons = {}; // Indexed by hexagon gid
        this.chroma_scale = chroma.scale('YlGnBu');

        
        this.map.addLayer(this.data_layer);
        this.map.addLayer(this.line_path_layer);
        this.map.addLayer(this.preview_path_layer);
        this.map.addLayer(this.transfer_layer);
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
                if (this.station_to_merge != null) {
                    this.merge_stations(this.moving_station_marker.station, this.station_to_merge);
                    //this.get_station_marker_by_station(this.station_to_merge).clear_merge();
                    this.station_to_merge = null;
                } else {
                    this.update_station_info(this.moving_station_marker.station);
                    this.moving_station_marker.update_tooltip();
                    this.moving_station_marker.generate_popup();
                    this.moving_station_marker.marker.openPopup();
                }
                this.moving_station_marker = null;
                this.purge_bad_transfers();
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
                if (NS_interface.map.getZoom() >= MIN_ZOOM_FOR_HEXAGONS) {
                    NS_interface.get_hexagons(false);
                } else {
                    $("#scale-boxes").empty();
                    $("#scale-low").text("");
                    $("#scale-mid").text("Zoom in to see data");
                    $("#scale-high").text("");
                    $("#scale-units").text("");
                    $("#scale").show();
                }
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

        //console.log(line);
        if (INC_UPDATES) {
            $.ajax({ url: "line-add?i="+NS_session+"&service-id="+NS_map.primary_service().sid.toString()+"&name="+encodeURIComponent(line.name)+"&full-name="+encodeURIComponent(line.full_name)+"&color-bg="+encodeURIComponent(line.color_bg)+"&color-fg="+encodeURIComponent(line.color_fg)+"&line-id="+line.sid.toString(),
                async: ASYNC_REQUIRED,
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
        return line;
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
            this.draw_line(line, false, true);
            
            if (INC_UPDATES) {
                /*$.ajax({ url: "line-update?i="+NS_session+"&service-id="+NS_map.primary_service().sid.toString()+"&line-id="+line.sid.toString()+"&name="+encodeURIComponent(line.name)+"&full-name="+encodeURIComponent(line.full_name)+"&color-bg="+encodeURIComponent(line.color_bg)+"&color-fg="+encodeURIComponent(line.color_fg),
                    async: ASYNC_REQUIRED,
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
                    station_marker.marker.closeTooltip();
                    NS_interface.map.closePopup();
                    station_marker.station.move_to(center[0], center[1]);

                    //var lines = NS_interface.active_service.station_lines(station_marker.station);
                    var lines = NS_interface.lines_for_station_by_station_pair(station_marker.station);
                    var station_pairs_to_draw = [];
                    for (var i = 0; i < lines.length; i++) {
                        // Re-draw lines (but don't render)
                        NS_interface.draw_line(lines[i], true, false);
                        var station_pairs = NS_interface.get_station_pairs_for_line(lines[i]);
                        for (var j = 0; j < station_pairs.length; j++) {
                            if (!(station_pairs[j] in station_pairs_to_draw)) {
                                station_pairs_to_draw.push(station_pairs[j]);
                            }
                        }
                    }
                    // Render all station pairs
                    for (var i = 0; i < station_pairs_to_draw.length; i++) {
                        station_pairs_to_draw[i].draw();
                    }
                    NS_interface.draw_transfers();
                    // Find distance to other stations
                    if (ALLOW_STATION_MERGING) {
                        var mergeable = false;
                        var m_px = NS_interface.map.latLngToLayerPoint(L.latLng(center[0], center[1]));
                        for (var i = 0; i < NS_interface.active_service.stations.length; i++) {
                            var station = NS_interface.active_service.stations[i];
                            var s_px = NS_interface.map.latLngToLayerPoint(L.latLng(station.location[0], station.location[1]));
                            var d = m_px.distanceTo(s_px);
                            if (station.sid != station_marker.station.sid) {
                                if (d < STATION_MERGE_THRESHOLD) {
                                    NS_interface.get_station_marker_by_station(station).show_merge();
                                    NS_interface.get_station_marker_by_station(station).marker.bringToFront();
                                    NS_interface.station_to_merge = station;
                                    mergeable = true;
                                } else {
                                    NS_interface.get_station_marker_by_station(station).clear_merge();
                                }
                            }
                        }
                        if (!mergeable) NS_interface.station_to_merge = null;
                    }
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

        var station = new Station("...", [lat, lng]);
        var stop;
        var line = this.active_line;
        
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
                        var sp_line_lss = station_pairs[k][0].line_spline_segments;
                        for (var l = 0; l < sp_line_lss.length; l++) {
                            var lss_line = sp_line_lss[l].line;
                            if (lines_to_draw.indexOf(lss_line) == -1) {
                                lines_to_draw.push(lss_line);
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
                        async: ASYNC_REQUIRED,
                        dataType: 'json',
                        success: function(data, status) {
                        }
                    });
                }
            }
        }
        
        // Sync with server
        $.ajax({ url: "station-add?i="+NS_session+"&service-id="+this.active_service.sid.toString()+"&station-id="+station.sid.toString()+"&lat="+lat+"&lng="+lng,
            async: ASYNC_REQUIRED,
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
                // Update popup.
                var station_marker = NS_interface.get_station_marker_by_station(station);
                station_marker.generate_popup();
                station_marker.update_tooltip();
                NS_interface.update_line_diagram();
                
                if (INC_UPDATES) {
                    $.ajax({ url: "stop-add?i="+NS_session+"&service-id="+NS_interface.active_service.sid.toString()+"&line-id="+line.sid.toString()+"&station-id="+station.sid.toString()+"&stop-id="+stop.sid.toString(),
                        async: false,
                        dataType: 'json',
                        success: function(data, status) {
                            for (var i = 0; i < best_edges.length; i++) {
                                $.ajax({ url: "edge-add?i="+NS_session+"&service-id="+NS_interface.active_service.sid.toString()+"&line-id="+line.sid.toString()+"&stop-1-id="+best_edges[i].stops[0].sid+"&stop-2-id="+best_edges[i].stops[1].sid+"&edge-id="+best_edges[i].sid.toString(),
                                    async: ASYNC_REQUIRED,
                                    dataType: 'json',
                                    success: function(data, status) {
                                    }
                                });
                            }
                        }
                    });
                }
            }
        });

        this.create_station_marker(station);
        
        for (var i = 0; i < lines_to_draw.length; i++) {
            this.draw_line(lines_to_draw[i], false, true);
        }
        
        this.purge_station_pairs();
        this.get_ridership();
        this.update_line_diagram();
        
        return station;
    }
    
    merge_stations(station_to_remove, station_to_keep) {
        // For all lines
        for (var i = 0; i < this.active_service.lines.length; i++) {
            var line = this.active_service.lines[i];
            // find all stops with this station
            for (var j = 0; j < line.stops.length; j++) {
                var stop = line.stops[j];
                if (stop.station.sid == station_to_remove.sid) {
                    // change the stop's station to the new one
                    stop.station = station_to_keep;
                    if (INC_UPDATES) {
                        $.ajax({ url: "stop-update-station?i="+NS_session+"&service-id="+this.active_service.sid.toString()+"&line-id="+line.sid.toString()+"&station-id="+station_to_keep.sid.toString()+"&stop-id="+stop.sid.toString(),
                            async: ASYNC_REQUIRED,
                            dataType: 'json',
                            success: function(data, status) {
                            }
                        });
                    }
                }
            }
        }
        // remove station
        this.remove_station(station_to_remove.sid);
        // draw lines
        var lines = this.active_service.station_lines(station_to_keep);
        for (var i = 0; i < lines.length; i++) {
            this.draw_line(lines[i], false, true);
        }
    }

    update_station_info(station) {
        // Sync with server
        var lat = station.location[0];
        var lng = station.location[1];

        $.ajax({ url: "lat-lng-info?i="+NS_session+"&lat="+lat+"&lng="+lng,
            async: ASYNC_OPTIONAL,
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
            async: ASYNC_REQUIRED,
            dataType: 'json',
            success: function(data, status) {
                NS_interface.get_ridership();
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
                        async: ASYNC_REQUIRED,
                        dataType: 'json',
                        success: function(data, status) {
                        }
                    });
                }
            }
        }
        
        
        if (INC_UPDATES) {
            $.ajax({ url: "stop-add?i="+NS_session+"&service-id="+this.active_service.sid.toString()+"&line-id="+this.active_line.sid.toString()+"&station-id="+station.sid.toString()+"&stop-id="+stop.sid.toString(),
                async: ASYNC_REQUIRED,
                dataType: 'json',
                success: function(data, status) {
                    for (var i = 0; i < best_edges.length; i++) {
                        $.ajax({ url: "edge-add?i="+NS_session+"&service-id="+NS_interface.active_service.sid.toString()+"&line-id="+NS_interface.active_line.sid.toString()+"&stop-1-id="+best_edges[i].stops[0].sid.toString()+"&stop-2-id="+best_edges[i].stops[1].sid.toString()+"&edge-id="+best_edges[i].sid.toString(),
                            async: ASYNC_REQUIRED,
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
        
        this.purge_station_pairs();
        //this.station_marker_layer.bringToFront();
        
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
                            async: ASYNC_REQUIRED,
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
                                var sp_line_lss = station_pairs[m][0].line_spline_segments;
                                for (var n = 0; n < sp_line_lss.length; n++) {
                                    var sp_line = sp_line_lss[n].line;
                                    if (impacted_lines.indexOf(sp_line) == -1) {
                                        impacted_lines.push(sp_line);
                                    }
                                }
                            }
                        }
                        line.remove_edge(edge);
                        if (INC_UPDATES) {
                            $.ajax({ url: "edge-remove?i="+NS_session+"&service-id="+NS_interface.active_service.sid.toString()+"&line-id="+line.sid.toString()+"&edge-id="+edge.sid.toString(),
                                async: ASYNC_REQUIRED,
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
                            if (!line.path_between_stops(spoke_stop, central_stop)) {
                                var new_edge = new Edge([central_stop, spoke_stop]);
                                line.add_edge(new_edge);
                                if (INC_UPDATES) {
                                    $.ajax({ url: "edge-add?i="+NS_session+"&service-id="+NS_interface.active_service.sid.toString()+"&line-id="+line.sid.toString()+"&stop-1-id="+new_edge.stops[0].sid.toString()+"&stop-2-id="+new_edge.stops[1].sid.toString()+"&edge-id="+new_edge.sid.toString(),
                                        async: ASYNC_REQUIRED,
                                        dataType: 'json',
                                        success: function(data, status) {
                                        }
                                    });
                                }
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
                                    async: ASYNC_REQUIRED,
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
                                    async: ASYNC_REQUIRED,
                                    dataType: 'json',
                                    success: function(data, status) {
                                    }
                                });
                            }
                        }
                    }
                }
                
                // Check for self-edges
                for (var l = 0; l < line.edges.length; l++) {
                    var edge = line.edges[l];
                    if (edge.stops[0].sid == edge.stops[1].sid) {
                        line.remove_edge(edge);
                        if (INC_UPDATES) {
                            $.ajax({ url: "edge-remove?i="+NS_session+"&service-id="+NS_interface.active_service.sid.toString()+"&line-id="+line.sid.toString()+"&edge-id="+edge.sid.toString(),
                                async: ASYNC_REQUIRED,
                                dataType: 'json',
                                success: function(data, status) {
                                }
                            });
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
                        async: ASYNC_REQUIRED,
                        dataType: 'json',
                        success: function(data, status) {

                        }
                    });
                }
        
                // Remove transfers.
                var removed = this.active_service.remove_transfers_for_station(station);
                if (removed) {
                    this.draw_transfers();
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
        //this.station_marker_layer.bringToFront();

        this.get_ridership();
        this.update_line_diagram();

    }
    
    remove_line_from_station(station_id, line_id) {

        var line = this.active_service.get_line_by_id(line_id);
        var station = this.active_service.get_station_by_id(station_id);
        var stops = line.get_stops_by_station(station);
        var impacted_lines = this.active_service.station_lines(station);
        
        if (impacted_lines.length == 1) {
            this.remove_station(station_id);
            return 0;
        }
        
        for (var i = 0; i < stops.length; i++) {
            var stop = stops[i];
            line.remove_stop(stop);
            
            if (INC_UPDATES) {
                $.ajax({ url: "stop-remove?i="+NS_session+"&service-id="+NS_interface.active_service.sid.toString()+"&line-id="+line.sid.toString()+"&stop-id="+stop.sid.toString(),
                    async: ASYNC_REQUIRED,
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
                            async: ASYNC_REQUIRED,
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
            // If we picked the stop we're removing... pick a different one.
            if (central_stop.station.sid == station_id) {
                central_stop = central_edge.stops[1];
            }

            // Add new edges
            for (var l = 0; l < impacted_edges.length; l++) {
                var edge = impacted_edges[l];
                if (edge.sid != central_edge.sid) {
                    var spoke_stop = edge.stops[0];
                    if (spoke_stop.station.sid == station_id) {
                        spoke_stop = edge.stops[1];
                    } 
                    if (spoke_stop.sid != central_stop.sid) {
                        var new_edge = new Edge([central_stop, spoke_stop]);
                        line.add_edge(new_edge);
                        if (INC_UPDATES) {
                            $.ajax({ url: "edge-add?i="+NS_session+"&service-id="+NS_interface.active_service.sid.toString()+"&line-id="+line.sid.toString()+"&stop-1-id="+new_edge.stops[0].sid.toString()+"&stop-2-id="+new_edge.stops[1].sid.toString()+"&edge-id="+new_edge.sid.toString(),
                                async: ASYNC_REQUIRED,
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
                                async: ASYNC_REQUIRED,
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
                                async: ASYNC_REQUIRED,
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
        
        //this.station_marker_layer.bringToFront();

        this.get_ridership();
        this.update_line_diagram();

    }
    /*
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
    */
    
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
    
    get_station_pairs_for_line(line) {
        var station_pairs = [];
        var station_drawmap = this.active_service.station_drawmap(line);
        //console.log(station_drawmap);
        for (var i = 0; i < station_drawmap.length; i++) {
            var branch = station_drawmap[i];
            // Convert branch to coordinates
            for (var j = 0; j < branch.length - 1; j++) {
                // Check for station pair.
                var station_1 = branch[j];
                var station_2 = branch[j+1];
                if (this.has_station_pair(station_1, station_2)) {
                    var spr = this.get_station_pair(station_1, station_2);
                    var station_pair = spr[0];
                    station_pairs.push(station_pair);
                }
            }
        }
        return station_pairs;
    }

    /**
     * Draw a line.
     * line : line to draw
     * mm : if this is being called from a mousemove event
     * render : if the station_pairs should actually be rendered (or just updated)
     **/
    draw_line(line, mm, render) {
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
                this.station_pairs[i].clear_spline_segment_for_line(line);
                //this.station_pairs[i].clear_spline_segments();
                this.station_pairs[i].generate_paths();
                if (render) this.station_pairs[i].draw();
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
                var station_id_to_branch_coordinates = {};
                // Convert branch to coordinates
                var coordinate_index = 0;
                for (var j = 0; j < branch.length; j++) {
                    // Push the station location.
                    branch_coordinates.push({"x": branch[j].location[0], "y": branch[j].location[1]});
                    if (!(branch[j].sid in station_id_to_branch_coordinates)) {
                        station_id_to_branch_coordinates[branch[j].sid] = [coordinate_index];
                    } else {
                        station_id_to_branch_coordinates[branch[j].sid].push(coordinate_index);
                    }
                    coordinate_index += 1;
                    if (j < branch.length - 1) {
                        // Check for station pair.
                        var station_1 = branch[j];
                        var station_2 = branch[j+1];
                        if (this.has_station_pair(station_1, station_2)) {
                            var spr = this.get_station_pair(station_1, station_2);
                            var station_pair = spr[0];
                            // Push pins.
                            var pins_to_push = [];
                            for (var k = 0; k < station_pair.pins.length; k++) {
                                pins_to_push.push({"x": station_pair.pins[k].location[0], "y": station_pair.pins[k].location[1]});
                                //branch_coordinates.push({"x": station_pair.pins[k].location[0], "y": station_pair.pins[k].location[1]});
                                coordinate_index += 1;
                            }
                            if (spr[1]) {
                                pins_to_push = pins_to_push.reverse();
                            }
                            branch_coordinates.push.apply(branch_coordinates, pins_to_push);
                        }
                    }
                }
                var spline = new BezierSpline({points: branch_coordinates, sharpness: BEZIER_SHARPNESS, duration: 2});
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
                        this.station_pairs.push(station_pair);
                        var station_pair_polarity = 0;
                    }
                    var bci = station_id_to_branch_coordinates[station_1.sid][0];
                    var bci_end = station_id_to_branch_coordinates[station_2.sid][0];
                    
                    var sss = [];
                    for (var k = 0; k < bci_end-bci; k++) {
                        if (bci+k+1 <= spline.centers.length) {
                            var centers = [];
                            var controls = [];
                            centers.push(new BezierCenter(branch_coordinates[bci+k].x, branch_coordinates[bci+k].y));
                            if (station_pair_polarity == 0) {
                                controls.push(new BezierControlPoint(spline.controls[bci+k][1].x, spline.controls[bci+k][1].y));
                                controls.push(new BezierControlPoint(spline.controls[bci+k+1][0].x, spline.controls[bci+k+1][0].y));
                            } else {
                                controls.push(new BezierControlPoint(spline.controls[bci+k][1].x, spline.controls[bci+k][1].y));
                                controls.push(new BezierControlPoint(spline.controls[bci+k+1][0].x, spline.controls[bci+k+1][0].y));
                            }
                            centers.push(new BezierCenter(branch_coordinates[bci+k+1].x, branch_coordinates[bci+k+1].y));
                            if (station_pair_polarity == 1) {
                                centers = centers.reverse();
                                controls = controls.reverse();
                            }
                            var ss = new SplineSegment(controls, centers);
                            sss.push(ss);
                        }
                        
                    }
                    if (station_pair_polarity == 1) {
                        sss = sss.reverse();
                    }
                    var lss = new LineSplineSegment(line, sss);
                    station_pair.add_line_spline_segment(lss);
                    
                    station_pair.generate_paths();
                    station_pairs_to_draw.push(station_pair);
                    
                    // Remove start index from station_id map
                    station_id_to_branch_coordinates[station_1.sid].splice(0, 1);
                    
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
                if (mm) station_pairs_to_draw[i].draw_pins();
            }
        }
    }
    
    draw_transfers() {
        this.transfer_layer.clearLayers();
        for (var i = 0; i < NS_interface.active_service.transfers.length; i++) {
            this.draw_transfer(NS_interface.active_service.transfers[i]);
        }
        // Bring station layer to front.
        //this.station_marker_layer.bringToFront();
    }
    
    draw_transfer(transfer) {
        var station_1 = transfer.stations[0];
        var station_2 = transfer.stations[1];
        var options = {weight: TRANSFER_WIDTH, color: 'black', opacity: 1.0};
        if (station_distance(station_1, station_2) > MAX_TRANSFER_DISTANCE_MILES) {
            options["dashArray"] = '10,10';
            options["opacity"] = TRANSFER_PREVIEW_OPACITY;
        }
        var path = L.polyline([L.latLng(station_1.location), L.latLng(station_2.location)], options);
        this.transfer_layer.addLayer(path);
    }
    
    draw_transfers_for_station(station) {
        this.transfer_layer.clearLayers();
        for (var i = 0; i < NS_interface.active_service.transfers.length; i++) {
            if (NS_interface.active_service.transfers[i].has_station(station)) {
                this.draw_transfer(NS_interface.active_service.transfers[i]);
            }
        }
        // Bring station layer to front.
        //this.station_marker_layer.bringToFront();
    }
    
    purge_bad_transfers() {
        var removed = this.active_service.remove_transfers_above_length(MAX_TRANSFER_DISTANCE_MILES);
        if (removed > 0) {
            this.draw_transfers();
        }
    }
    
    purge_station_pairs() {
        for (var i = this.station_pairs.length - 1; i >= 0; i--) {
            var station_pair = this.station_pairs[i];
            if (this.active_service.get_station_by_id(station_pair.stations[0].sid) == null || 
                this.active_service.get_station_by_id(station_pair.stations[1].sid) == null ||
                this.active_service.has_edge_for_stations(station_pair.stations[0], station_pair.stations[1]) == false ||
                station_pair.lines().length == 0) {
                station_pair.undraw_pins();
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
        //this.station_marker_layer.bringToFront();
    }
    
    pin_projection(lat, lng) {
        var m_px = this.map.latLngToLayerPoint(L.latLng(lat, lng));
        var best_p = null;
        var best_distance = -1;
        var best_station_pair = null;
        var best_sid = -1;
        var sids_for_showing_pins = [];
        for (var j = 0; j < this.station_pairs.length; j++) {
            var station_pair = this.station_pairs[j];
            var p = station_pair.project_pin(lat, lng);
            if (p != null) {
                if (best_p == null || p.d < best_distance) {
                    best_p = p;
                    best_distance = p.d;
                    best_sid = station_pair.sid;
                    best_station_pair = station_pair;
                }
                var d = m_px.distanceTo(this.map.latLngToLayerPoint(L.latLng(p.x, p.y)));
                if (d < PIN_DISTANCE_TO_SHOW_PINS) {
                    sids_for_showing_pins.push(station_pair.sid);
                }
                
                if (DEBUG_PIN_PROJECTIONS) {
                    var weight = 1;
                    if (d < PIN_DISTANCE_TO_SHOW_PINS) weight = 2;
                    var l = L.polyline([L.latLng([p.x, p.y]), L.latLng(lat, lng)], {weight: weight, color: '#00f'});
                    this.preview_path_layer.addLayer(l);
                }
        }
        }
            
        var show_pin_icon = false;
        if (best_p != null) {
            // Convert best_p distance to pixels
            var m_px = this.map.latLngToLayerPoint(L.latLng(lat, lng));
            var p_px = this.map.latLngToLayerPoint(L.latLng(best_p.x, best_p.y));
            var d = m_px.distanceTo(p_px);
            show_pin_icon = d < PIN_DISTANCE_MIN;
        }
        if (DEBUG_PIN_PROJECTIONS && best_p != null) {
            var l = L.polyline([L.latLng([best_p.x, best_p.y]), L.latLng(lat, lng)], {weight: 1, color: '#f00'});
            this.preview_path_layer.addLayer(l);
        }
        if (show_pin_icon) {
            var nearest_pin_distance = best_station_pair.distance_to_nearest_pin(lat, lng);
            //console.log(nearest_pin_distance);
            if (nearest_pin_distance > -1 && nearest_pin_distance < PIN_DISTANCE_FROM_EXISTING_PIN_MIN) show_pin_icon = false;
        }
        return [show_pin_icon, best_p, best_sid, sids_for_showing_pins];
    }

    preview_line(line, lat, lng) {
        this.preview_clear();
        
        // Find nearest station?

        // Find the nearest station
        var m_px = this.map.latLngToLayerPoint(L.latLng(lat, lng));
        var best_distance = 0;
        var best_station = null;
        for (var i = 0; i < NS_interface.active_service.stations.length; i++) {
            var station = NS_interface.active_service.stations[i];
            var distance = m_px.distanceTo(this.map.latLngToLayerPoint(L.latLng(station.location[0], station.location[1])));

            if (best_distance > distance || best_station == null) {
                best_station = station;
                best_distance = distance;
            }
        }
        
        // Project onto curve?
        var pin_projection = this.pin_projection(lat, lng);
        //console.log(pin_projection);
        
        if (pin_projection[0] && best_distance > PIN_DISTANCE_FROM_STATION_MIN) {
            if (!this.dragging_pin) {
                var m = L.marker([pin_projection[1].x, pin_projection[1].y], {icon: PIN_ICON});
                m.id = "pin-preview";
                this.preview_line_pin_marker = m;
                this.preview_path_layer.addLayer(m);
            }
        } else {
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
        }
        
        // Show pins for station pairs
        //var station_pairs = this.get_station_pairs_for_line(line);
        for (var j = 0; j < this.station_pairs.length; j++) {
            var station_pair = this.station_pairs[j];
            if (pin_projection[3].indexOf(station_pair.sid) > -1) {
                station_pair.draw_pins();
            } else {
                station_pair.undraw_pins();
            }
        }
    }
    
    preview_transfer(lat, lng) {
        this.preview_clear();
        var station_loc = {
            "type": "Feature",
            "properties": {},
            "geometry": {
                "type": "Point",
                "coordinates": [this.active_transfer_station.location[1], this.active_transfer_station.location[0]]
            }
        };
        var mouse_loc = {
            "type": "Feature",
            "properties": {},
            "geometry": {
                "type": "Point",
                "coordinates": [lng, lat]
            }
        };
        var station_mouse_line = {
            "type": "Feature",
            "properties": {},
            "geometry": {
                "type": "LineString",
                "coordinates": [[this.active_transfer_station.location[1], this.active_transfer_station.location[0]], [lng, lat]]
            }
        };
        
        var chunk = turf.lineChunk(station_mouse_line, MAX_TRANSFER_DISTANCE_MILES, 'miles');

        var distance = turf.distance(station_loc, mouse_loc, "miles");

        var path = L.polyline([L.latLng(chunk.features[0].geometry.coordinates[1][1], chunk.features[0].geometry.coordinates[1][0]), L.latLng(this.active_transfer_station.location[0], this.active_transfer_station.location[1])], {weight: TRANSFER_WIDTH, color: 'black', opacity: TRANSFER_PREVIEW_OPACITY});
        this.preview_path_layer.addLayer(path);
        // Bring station layer to front.
        //this.station_marker_layer.bringToFront();
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
            if (this.active_tool == "transfer") {
                this.preview_transfer(e.latlng.lat, e.latlng.lng);
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
                var connecting_lines = []
                for (var k = 0; k < this.active_service.lines.length; k++) {
                    if (this.active_service.lines[k].sid != line.sid) {
                        if (this.active_service.lines[k].has_station(stop.station)) {
                            connecting_lines.push(this.active_service.lines[k]);
                        }
                    }
                }
                for (var k = 0; k < this.active_service.transfers.length; k++) {
                    if (this.active_service.transfers[k].has_station(stop.station)) {
                        var transfer_stations = this.active_service.transfers[k].stations;
                        for (var l = 0; l < transfer_stations.length; l++) {
                            if (transfer_stations[l] != stop.station) {
                                var transfer_station_lines = this.active_service.station_lines(transfer_stations[l]);
                                for (var m = 0; m < transfer_station_lines.length; m++) {
                                    if (connecting_lines.indexOf(transfer_station_lines[m]) == -1) {
                                        connecting_lines.push(transfer_station_lines[m]);
                                    }
                                }
                            }
                        }
                    }
                }
                for (var k = 0; k < connecting_lines.length; k++) {
                    stop_connectors.append('<div class="subway-line-long subway-line-mini subway-line-marker-diagram" style="font-size: 1em; background-color: '+connecting_lines[k].color_bg+'; color: '+connecting_lines[k].color_fg+';"><div class="content">'+connecting_lines[k].name+'</div></div>');
                }

                // Store the stop index.
                stop_position[stop.sid] = stop_index;
                stop_index += 1;
            }
        }

    }

    get_ridership() {
        $.ajax({ url: "transit-model?i="+NS_session,
            async: ASYNC_REQUIRED,
            dataType: 'json',
            success: function(data, status) {
                //console.log(data);
                for (var i in data) {
                    var ridership = data[i];
                    var station = NS_interface.active_service.get_station_by_id(parseInt(i));
                    station.ridership = ridership;
                    $("#stationriders-"+station.sid.toString()).text(Math.round(station.ridership).toString());
                }
            }
        });
    }
    
    get_hexagons(force) {
        var initial_bounds = this.map.getBounds();
        var bounds = initial_bounds.pad(0.5); // Pad for maximum scrollability
        
        var do_it = true;
        if (this.hexagon_bounds != null && this.hexagon_zoom != null) {
            if (this.hexagon_bounds.contains(initial_bounds) && NS_interface.map.getZoom() == this.hexagon_zoom) {
                do_it = false;
            }
        }
        if(NS_interface.map.getZoom() < MIN_ZOOM) do_it = false;
        var request_num = NS_interface.data_layer_request_num;
        if (force) do_it = true;
        
        if (do_it) {
            this.hexagon_bounds = bounds;
            this.hexagon_zoom = NS_interface.map.getZoom();
            $.ajax({ url: "get-hexagons?i="+NS_session+"&lat-min="+bounds.getSouth().toString()+"&lat-max="+bounds.getNorth().toString()+"&lng-min="+bounds.getWest().toString()+"&lng-max="+bounds.getEast().toString(),
                async: ASYNC_REQUIRED,
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
                    var num_breaks = 8;
                    var breaks = quantiles(data, num_breaks, NS_interface.hexagon_layer);
                    var scale = NS_interface.hexagon_scales[NS_interface.hexagon_layer];
                    $("#scale-boxes").empty();
                    for (var i = 0; i < num_breaks; i++) {
                        $("#scale-boxes").append('<div class="scale-box" style="background-color: '+scale((num_breaks-i)/num_breaks).hex()+' "></div>');
                    }
                    $("#scale-low").text("0");
                    $("#scale-mid").text(Math.round(breaks[Math.round((num_breaks-1)/2)]/DGGRID_AREA).toString());
                    $("#scale-high").text(Math.round(breaks[0]/DGGRID_AREA).toString());
                    $("#scale-units").html(NS_interface.hexagon_units[NS_interface.hexagon_layer]);
                    $("#scale").show();
                    
                    NS_interface.data_layer.clearLayers();
                    /**/
                    if (NS_interface.map.getZoom() < 14) {
                        NS_interface.data_layer.addLayer(L.vectorGrid.slicer(data, {
                            vectorTileLayerStyles: {
                                sliced: function(properties, zoom) {
                                    var property = 0;
                                    if (NS_interface.hexagon_layer == "population") property = properties.population;
                                    if (NS_interface.hexagon_layer == "employment") property = properties.employment;
                                    return {
                                        fillColor: populationColor(property, breaks, scale),
                                        fill: true,
                                        weight: 0,
                                        opacity: 1,
                                        color: 'white',
                                        fillOpacity: 0.35
                                    };
                                }
                            }
                        }));
                    } else {
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
                    }
                    NS_interface.line_path_layer.bringToFront();
                    //NS_interface.station_marker_layer.bringToFront();
                    NS_interface.map.setMinZoom(MIN_ZOOM);
                }
            });
        }
    }
    
    settings() {
        var station_pair_json = this.station_pairs;
        return {"station_pairs": station_pair_json};
    }
    
    sync_json() {
        var ret = {
            "map": NS_map,
            "settings": this.settings()
        }
        return JSON.stringify(ret);
    }

    load_session(session_id) {

    }

}

function sortNumber(a,b) {
    return a - b;
}

function quantiles(geojson, num_breaks, feature_name) {
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
        var pp = NS_interface.pin_projection(e.latlng.lat, e.latlng.lng);
        if (!pp[0]) {
            NS_interface.add_new_station(e.latlng.lat, e.latlng.lng);
        } else {
            console.log("adding pin");
            var sp = NS_interface.get_station_pair_by_sp_id(pp[2]);
            sp.add_pin(pp[1].x, pp[1].y);
        }
    }
    if (NS_interface.active_tool == "transfer") {
        NS_interface.active_tool = "station";
        NS_interface.preview_clear();
    }
}


function delete_station_event(e) {
    var station_id = $(this).attr('id').replace('delete-', '');
    NS_interface.remove_station(station_id);
}

function transfer_station_event(e) {
    var station_id = $(this).attr('id').replace('transfer-', '');
    NS_interface.active_transfer_station = NS_interface.active_service.get_station_by_id(station_id);
    NS_interface.active_tool = "transfer";
}

function build_to_station_event(e) {
    var station_id = $(this).attr('id');
    NS_interface.add_stop_to_station(station_id);
}