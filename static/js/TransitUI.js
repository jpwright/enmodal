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
        this.pane_station_markers = this.map.createPane("inactiveStationMarkerPane");
        //this.pane_station_markers.style.zIndex = 8000;
        
        this.layers = {
            active: {
                line_paths: L.featureGroup(),
                transfers: L.featureGroup(),
                station_markers: L.featureGroup({pane: "stationMarkerPane"}),
            },
            inactive: {
                line_paths: L.featureGroup(),
                transfers: L.featureGroup(),
                station_markers: L.featureGroup({pane: "inactiveStationMarkerPane"}),
            },
            preview: L.featureGroup(),
            data: L.featureGroup(),
        };
            
        //this.layers.active.line_paths = L.featureGroup();
        //this.transfer_layer = L.featureGroup();
        //this.layers.active.station_markers = L.featureGroup({pane: "stationMarkerPane"});
        //this.layers.preview = L.featureGroup();
        //this.bezier_layer = L.featureGroup();
        //this.data_layer = L.featureGroup();
        
        this.hexagons = {}; // Indexed by hexagon gid
        this.chroma_scale = chroma.scale('YlGnBu');

        
        this.map.addLayer(this.layers.data);
        this.map.addLayer(this.layers.active.line_paths);
        this.map.addLayer(this.layers.active.transfers);
        this.map.addLayer(this.layers.active.station_markers);
        this.map.addLayer(this.layers.inactive.line_paths);
        this.map.addLayer(this.layers.inactive.transfers);
        this.map.addLayer(this.layers.inactive.station_markers);
        this.map.addLayer(this.layers.preview);

        this.map.on('mouseup', () => {
            this.map.dragging.enable();
            this.map.removeEventListener('mousemove');
            this.preview_paths_enabled = true;
            this.map.on('mousemove', function(e) {
                enmodal.transit_interface.preview_handler(e);
            });
            if (this.moving_station_marker != null) {
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
                enmodal.sidebar.update_line_diagram();
            }
        });

        this.map.on('mousemove', function(e) {
            enmodal.transit_interface.preview_handler(e);
        });

        this.map.on('moveend', function(e) {
            if (enmodal.transit_interface.hexagon_layer != "none") {
                if (enmodal.transit_interface.map.getZoom() >= MIN_ZOOM_FOR_HEXAGONS) {
                    enmodal.transit_interface.get_hexagons(false);
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
    
    // Draw all stations and lines of a service onto a particular layer
    draw_service(service, layer) {
        for (var i = 0; i < service.stations.length; i++) {
            var station = service.stations[i];
            this.create_station_marker(station, layer.station_markers);
        }
        for (var i = 0; i < service.lines.length; i++) {
            var line = service.lines[i];
            this.draw_line(line, false, false, layer.line_paths);
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

    create_station_marker(station, layer) {
        var station_marker = new StationMarker(station);

        this.station_markers.push(station_marker);

        station_marker.marker.on('click', function(e) {
            station_marker.marker.closeTooltip();
            // Disable new station creation.
            enmodal.transit_interface.map.off('click', handle_map_click);
            setTimeout(function() {
                enmodal.transit_interface.map.on('click', handle_map_click);
            }, 1000);

            // Update popup.
            station_marker.generate_popup();

        });

        station_marker.marker.on('mousedown', function (event) {
            //L.DomEvent.stop(event);
            enmodal.transit_interface.preview_paths_enabled = false;
            enmodal.transit_interface.preview_clear();
            enmodal.transit_interface.map.dragging.disable();
            let {lat: circleStartingLat, lng: circleStartingLng} = station_marker.marker._latlng;
            let {lat: mouseStartingLat, lng: mouseStartingLng} = event.latlng;

            enmodal.transit_interface.map.on('mousemove', event => {
                if (enmodal.transit_interface.active_tool == "station") {
                    if (enmodal.transit_interface.moving_station_marker == null) {
                        enmodal.transit_interface.moving_station_marker = station_marker;
                    }
                    let {lat: mouseNewLat, lng: mouseNewLng} = event.latlng;
                    let latDifference = mouseStartingLat - mouseNewLat;
                    let lngDifference = mouseStartingLng - mouseNewLng;

                    let center = [circleStartingLat-latDifference, circleStartingLng-lngDifference];
                    station_marker.marker.setLatLng(center);
                    station_marker.marker.closeTooltip();
                    enmodal.transit_interface.map.closePopup();
                    station_marker.station.move_to(center[0], center[1]);

                    //var lines = enmodal.transit_interface.active_service.station_lines(station_marker.station);
                    var lines = enmodal.transit_interface.lines_for_station_by_station_pair(station_marker.station);
                    var station_pairs_to_draw = [];
                    for (var i = 0; i < lines.length; i++) {
                        // Re-draw lines (but don't render)
                        enmodal.transit_interface.draw_line(lines[i], true, false, enmodal.transit_interface.layers.active.line_paths);
                        var station_pairs = enmodal.transit_interface.get_station_pairs_for_line(lines[i]);
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
                    enmodal.transit_interface.draw_transfers();
                    // Find distance to other stations
                    if (ALLOW_STATION_MERGING) {
                        var mergeable = false;
                        var m_px = enmodal.transit_interface.map.latLngToLayerPoint(L.latLng(center[0], center[1]));
                        for (var i = 0; i < enmodal.transit_interface.active_service.stations.length; i++) {
                            var station = enmodal.transit_interface.active_service.stations[i];
                            var s_px = enmodal.transit_interface.map.latLngToLayerPoint(L.latLng(station.location[0], station.location[1]));
                            var d = m_px.distanceTo(s_px);
                            if (station.sid != station_marker.station.sid) {
                                if (d < STATION_MERGE_THRESHOLD) {
                                    enmodal.transit_interface.get_station_marker_by_station(station).show_merge();
                                    enmodal.transit_interface.get_station_marker_by_station(station).marker.bringToFront();
                                    enmodal.transit_interface.station_to_merge = station;
                                    mergeable = true;
                                } else {
                                    enmodal.transit_interface.get_station_marker_by_station(station).clear_merge();
                                }
                            }
                        }
                        if (!mergeable) enmodal.transit_interface.station_to_merge = null;
                    }
                }
            });
        });

        station_marker.marker.addTo(layer);
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
                best_edges[i].sid = enmodal.id_factory.id();
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
                    var params = $.param({
                        i: enmodal.session_id,
                        service_id: this.active_service.sid,
                        line_id: line.sid,
                        edge_id: edges_to_remove[i].sid
                    });
                    $.ajax({ url: "edge_remove?"+params,
                        async: ASYNC_REQUIRED,
                        dataType: 'json',
                        success: function(data, status) {
                        }
                    });
                }
            }
        }
        
        // Sync with server
        var params = $.param({
            i: enmodal.session_id,
            service_id: this.active_service.sid,
            station_id: station.sid,
            lat: lat,
            lng: lng
        });
        $.ajax({ url: "station_add?"+params,
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
                var station_marker = enmodal.transit_interface.get_station_marker_by_station(station);
                station_marker.generate_popup();
                station_marker.update_tooltip();
                enmodal.sidebar.update_line_diagram();
                
                var params = $.param({
                    i: enmodal.session_id,
                    service_id: enmodal.transit_interface.active_service.sid,
                    line_id: line.sid,
                    station_id: station.sid,
                    stop_id: stop.sid
                });
                if (INC_UPDATES) {
                    $.ajax({ url: "stop_add?"+params,
                        async: false,
                        dataType: 'json',
                        success: function(data, status) {
                            for (var i = 0; i < best_edges.length; i++) {
                                var params = $.param({
                                    i: enmodal.session_id,
                                    service_id: enmodal.transit_interface.active_service.sid,
                                    line_id: line.sid,
                                    stop_1_id: best_edges[i].stops[0].sid,
                                    stop_2_id: best_edges[i].stops[1].sid,
                                    edge_id: best_edges[i].sid
                                });
                                $.ajax({ url: "edge_add?"+params,
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

        this.create_station_marker(station, this.layers.active.station_markers);
        
        for (var i = 0; i < lines_to_draw.length; i++) {
            this.draw_line(lines_to_draw[i], false, true);
        }
        
        this.purge_station_pairs();
        this.get_ridership();
        enmodal.sidebar.update_line_diagram();
        
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
                        var params = $.param({
                            i: enmodal.session_id,
                            service_id: this.active_service.sid,
                            line_id: line.sid,
                            station_id: station_to_keep.sid,
                            stop_id: stop.sid
                        });
                        $.ajax({ url: "stop_update_station?"+params,
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
            this.draw_line(lines[i], false, true, this.layers.active.line_paths);
        }
    }

    update_station_info(station) {
        // Sync with server
        var lat = station.location[0];
        var lng = station.location[1];

        var params = $.param({
            i: enmodal.session_id,
            lat: lat,
            lng: lng
        });
        $.ajax({ url: "lat_lng_info?"+params,
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
                    enmodal.transit_interface.sync_station_info(station);
                }
            }
        });
        
    }

    sync_station_info(station) {
        var params = $.param({
            i: enmodal.session_id,
            service_id: this.active_service.sid,
            station_id: station.sid,
            name: station.name,
            location: station.location[0].toString()+","+station.location[1].toString(),
            neighborhood: station.neighborhood
        });
        $.ajax({ url: "station_update?"+params,
            async: ASYNC_REQUIRED,
            dataType: 'json',
            success: function(data, status) {
                enmodal.transit_interface.get_ridership();
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
                best_edges[i].sid = _id_factory.id();
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
                    var params = $.param({
                        i: enmodal.session_id,
                        service_id: this.active_service.sid,
                        line_id: this.active_line.sid,
                        edge_id: edges_to_remove[i].sid
                    });
                    $.ajax({ url: "edge_remove?"+params,
                        async: ASYNC_REQUIRED,
                        dataType: 'json',
                        success: function(data, status) {
                        }
                    });
                }
            }
        }
        
        
        if (INC_UPDATES) {
            var params = $.param({
                i: enmodal.session_id,
                service_id: this.active_service.sid,
                line_id: this.active_line.sid,
                station_id: station.sid,
                stop_id: stop.sid
            });
            $.ajax({ url: "stop_add?"+params,
                async: ASYNC_REQUIRED,
                dataType: 'json',
                success: function(data, status) {
                    for (var i = 0; i < best_edges.length; i++) {
                        var params = $.param({
                            i: enmodal.session_id,
                            service_id: enmodal.transit_interface.active_service.sid,
                            line_id: enmodal.transit_interface.active_line.sid,
                            stop_1_id: best_edges[i].stops[0].sid,
                            stop_2_id: best_edges[i].stops[1].sid,
                            edge_id: best_edges[i].sid
                        });
                        $.ajax({ url: "edge_add?"+params,
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
            this.draw_line(lines_to_draw[i], false, true, this.layers.active.line_paths);
        }
        
        this.purge_station_pairs();
        
        this.get_ridership();
        enmodal.sidebar.update_line_diagram();

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
                        var params = $.param({
                            i: enmodal.session_id,
                            service_id: this.active_service.sid,
                            line_id: this.active_line.sid,
                            stop_id: stop.sid
                        });
                        $.ajax({ url: "stop_remove?"+params,
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
                        var params = $.param({
                            i: enmodal.session_id,
                            service_id: this.active_service.sid,
                            line_id: this.active_line.sid,
                            edge_id: edge.sid
                        });
                        if (INC_UPDATES) {
                            $.ajax({ url: "edge_remove?"+params,
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
                                    var params = $.param({
                                        i: enmodal.session_id,
                                        service_id: this.active_service.sid,
                                        line_id: this.active_line.sid,
                                        stop_1_id: new_edge.stops[0].sid,
                                        stop_2_id: new_edge.stops[1].sid,
                                        edge_id: new_edge.sid
                                    });
                                    $.ajax({ url: "edge_add?"+params,
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
                                var params = $.param({
                                    i: enmodal.session_id,
                                    service_id: this.active_service.sid,
                                    line_id: line.sid,
                                    stop_1_id: best_edges[i].stops[0].sid,
                                    stop_2_id: best_edges[i].stops[1].sid,
                                    edge_id: best_edges[i].sid
                                });
                                $.ajax({ url: "edge_add?"+params,
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
                                var params = $.param({
                                    i: enmodal.session_id,
                                    service_id: this.active_service.sid,
                                    line_id: line.sid,
                                    edge_id: edges_to_remove[i].sid
                                });
                                $.ajax({ url: "edge_remove?"+params,
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
                            var params = $.param({
                                i: enmodal.session_id,
                                service_id: this.active_service.sid,
                                line_id: line.sid,
                                edge_id: edge.sid
                            });
                            $.ajax({ url: "edge_remove?"+params,
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
                    var params = $.param({
                        i: enmodal.session_id,
                        service_id: this.active_service.sid,
                        station_id: station.sid
                    });
                    $.ajax({ url: "station_remove?"+params,
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
                this.layers.active.station_markers.removeLayer(station_marker.marker);
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
            this.draw_line(impacted_lines[i], false, true, this.layers.active.line_paths);
        }
        //this.layers.active.station_markers.bringToFront();

        this.get_ridership();
        enmodal.sidebar.update_line_diagram();

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
                var params = $.param({
                    i: enmodal.session_id,
                    service_id: this.active_service.sid,
                    line_id: line.sid,
                    stop_id: stop.sid
                });
                $.ajax({ url: "stop_remove?"+params,
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
                        var params = $.param({
                            i: enmodal.session_id,
                            service_id: this.active_service.sid,
                            line_id: line.sid,
                            edge_id: edge.sid
                        });
                        $.ajax({ url: "edge_remove?"+params,
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
                            var params = $.param({
                                i: enmodal.session_id,
                                service_id: this.active_service.sid,
                                line_id: line.sid,
                                stop_1_id: new_edge.stops[0].sid,
                                stop_2_id: new_edge.stops[1].sid,
                                edge_id: new_edge.sid
                            });
                            $.ajax({ url: "edge_add?"+params,
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
                            var params = $.param({
                                i: enmodal.session_id,
                                service_id: this.active_service.sid,
                                line_id: line.sid,
                                stop_1_id: best_edges[i].stops[0].sid,
                                stop_2_id: best_edges[i].stops[1].sid,
                                edge_id: best_edges[i].sid
                            });
                            $.ajax({ url: "edge_add?"+params,
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
                            var params = $.param({
                                i: enmodal.session_id,
                                service_id: this.active_service.sid,
                                line_id: line.sid,
                                edge_id: edges_to_remove[i].sid
                            });
                            $.ajax({ url: "edge_remove?"+params,
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
            this.draw_line(impacted_lines[i], false, true, this.layers.active.line_paths);
        }
        // Refresh the marker
        this.get_station_marker_by_station(station).generate_popup();

        this.get_ridership();
        enmodal.sidebar.update_line_diagram();

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
     * layer : layer on which to draw
     **/
    draw_line(line, mm, render, layer) {
        //console.log("draw line "+line.name);
        
        if (line.sid in this.line_paths) {
            var line_path = this.line_paths[line.sid];
        } else {
            var line_path = new LinePath();
            this.line_paths[line.sid] = line_path;
        }

        // Remove existing edge paths.
        for (var i = 0; i < line_path.edge_paths.length; i++) {
            this.layers.active.line_paths.removeLayer(line_path.edge_paths[i].path);
        }
        
        // Clear all station pairs.
        for (var i = 0; i < this.station_pairs.length; i++) {
            if (this.station_pairs[i].has_line(line)) {
                this.station_pairs[i].clear_spline_segment_for_line(line);
                //this.station_pairs[i].clear_spline_segments();
                this.station_pairs[i].generate_paths(layer);
                //this.station_pairs[i].undraw(layer);
                if (render) this.station_pairs[i].draw(layer);
            }
        }
        
        var station_pairs_to_draw = [];

        if (line.stops.length > 1) {
            //this.update_edge_paths(line);
            //this.tweak_line_path(line);
            var station_drawmap = enmodal.transit_interface.active_service.station_drawmap(line);
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
                        var station_pair = new StationPair([station_1, station_2], this.layers.active.line_paths);
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
                    var lss = new LineSplineSegment(line, sss, station_pair_polarity);
                    station_pair.add_line_spline_segment(lss);
                    
                    station_pair.generate_paths(layer);
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
                station_pairs_to_draw[i].draw(layer);
                if (mm) station_pairs_to_draw[i].draw_pins(layer);
            }
        }
    }
    
    draw_transfers() {
        this.layers.active.transfers.clearLayers();
        for (var i = 0; i < enmodal.transit_interface.active_service.transfers.length; i++) {
            this.draw_transfer(enmodal.transit_interface.active_service.transfers[i]);
        }
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
        this.layers.active.transfers.addLayer(path);
    }
    
    draw_transfers_for_station(station) {
        this.transfer_layer.clearLayers();
        for (var i = 0; i < enmodal.transit_interface.active_service.transfers.length; i++) {
            if (enmodal.transit_interface.active_service.transfers[i].has_station(station)) {
                this.draw_transfer(enmodal.transit_interface.active_service.transfers[i]);
            }
        }
        // Bring station layer to front.
        //this.layers.active.station_markers.bringToFront();
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
        this.layers.active.line_paths.removeLayer(edge_path.path);
        edge_path.regenerate_path();
        this.layers.active.line_paths.addLayer(edge_path.path);
    }

    refresh_edge_paths(line) {
        //console.log("refresh edge paths for line "+line.name);
        var line_path = this.line_paths[line.sid];
        // Remove existing edge paths.
        for (var i = 0; i < line_path.edge_paths.length; i++) {
            this.layers.active.line_paths.removeLayer(line_path.edge_paths[i].path);
        }

        // Draw new edge paths.
        for (var j = 0; j < line_path.edge_paths.length; j++) {
            line_path.edge_paths[j].regenerate_path();
            var path = line_path.edge_paths[j].path;
            this.layers.active.line_paths.addLayer(path);
        }
        // Bring station layer to front.
        //this.layers.active.station_markers.bringToFront();
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
                    this.layers.preview.addLayer(l);
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
            this.layers.preview.addLayer(l);
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
        for (var i = 0; i < enmodal.transit_interface.active_service.stations.length; i++) {
            var station = enmodal.transit_interface.active_service.stations[i];
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
                this.layers.preview.addLayer(m);
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
                this.layers.preview.addLayer(edge_path.path);
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
        this.layers.preview.addLayer(path);
        // Bring station layer to front.
        //this.layers.active.station_markers.bringToFront();
    }

    preview_clear() {
        // Remove existing preview paths.
        this.layers.preview.clearLayers();

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

    get_ridership() {
        var params = $.param({
            i: enmodal.session_id
        });
        $.ajax({ url: "transit_model?"+params,
            async: ASYNC_REQUIRED,
            dataType: 'json',
            success: function(data, status) {
                //console.log(data);
                for (var i in data) {
                    var ridership = data[i];
                    var station = enmodal.transit_interface.active_service.get_station_by_id(parseInt(i));
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
            if (this.hexagon_bounds.contains(initial_bounds) && enmodal.transit_interface.map.getZoom() == this.hexagon_zoom) {
                do_it = false;
            }
        }
        if(enmodal.transit_interface.map.getZoom() < MIN_ZOOM) do_it = false;
        var request_num = enmodal.transit_interface.data_layer_request_num;
        if (force) do_it = true;
        
        if (do_it) {
            this.hexagon_bounds = bounds;
            this.hexagon_zoom = enmodal.transit_interface.map.getZoom();
            var params = $.param({
                i: enmodal.session_id,
                lat_min: bounds.getSouth(),
                lat_max: bounds.getNorth(),
                lng_min: bounds.getWest(),
                lng_max: bounds.getEast()
            });
            $.ajax({ url: "get_hexagons?"+params,
                async: ASYNC_REQUIRED,
                dataType: 'text',
                success: function(data_zip, status) {
                    var data = JSON.parse(data_zip);
                    //enmodal.transit_interface.data_layer.clearLayers();
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
                    enmodal.transit_interface.chroma_scale.domain([min_population, max_population], 7, 'quantiles');
                    for (var i = 0; i < data.length; i++) {
                        var hexagon = data[i];
                        var population = hexagon["population"];
                        var opacity = 0.7;
                        var color = enmodal.transit_interface.chroma_scale(population).hex();
                        if (hexagon["gid"] in enmodal.transit_interface.hexagons) {
                            var h = enmodal.transit_interface.hexagons[hexagon["gid"]];
                            if (h.color != color) {
                                h.color = color;
                                h.update_style();
                            }
                        } else {
                            var h = new Hexagon(hexagon["gid"], hexagon["geo"], color, opacity);
                            enmodal.transit_interface.hexagons[hexagon["gid"]] = h;
                            if (initial_bounds.contains(h.poly.getBounds())) {
                                h.draw();
                            }
                        }
                    }
                    */
                    var num_breaks = 8;
                    var breaks = quantiles(data, num_breaks, enmodal.transit_interface.hexagon_layer);
                    var scale = enmodal.transit_interface.hexagon_scales[enmodal.transit_interface.hexagon_layer];
                    $("#scale-boxes").empty();
                    for (var i = 0; i < num_breaks; i++) {
                        $("#scale-boxes").append('<div class="scale-box" style="background-color: '+scale((num_breaks-i)/num_breaks).hex()+' "></div>');
                    }
                    $("#scale-low").text("0");
                    $("#scale-mid").text(Math.round(breaks[Math.round((num_breaks-1)/2)]/DGGRID_AREA).toString());
                    $("#scale-high").text(Math.round(breaks[0]/DGGRID_AREA).toString());
                    $("#scale-units").html(enmodal.transit_interface.hexagon_units[enmodal.transit_interface.hexagon_layer]);
                    $("#scale").show();
                    
                    enmodal.transit_interface.layers.data.clearLayers();
                    /**/
                    if (enmodal.leaflet_map.getZoom() < 14) {
                        enmodal.transit_interface.layers.data.addLayer(L.vectorGrid.slicer(data, {
                            vectorTileLayerStyles: {
                                sliced: function(properties, zoom) {
                                    var property = 0;
                                    if (enmodal.transit_interface.hexagon_layer == "population") property = properties.population;
                                    if (enmodal.transit_interface.hexagon_layer == "employment") property = properties.employment;
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
                        enmodal.transit_interface.layers.data.addLayer(L.geoJson(data, {style: function(feature) {
                            var property = 0;
                            if (enmodal.transit_interface.hexagon_layer == "population") property = feature.properties.population;
                            if (enmodal.transit_interface.hexagon_layer == "employment") property = feature.properties.employment;
                            return {
                                fillColor: populationColor(property, breaks, scale),
                                weight: 0,
                                opacity: 1,
                                color: 'white',
                                fillOpacity: 0.35
                            };
                        }}));
                    }
                    enmodal.transit_interface.layers.active.line_paths.bringToFront();
                    //enmodal.transit_interface.layers.active.station_markers.bringToFront();
                    enmodal.leaflet_map.setMinZoom(MIN_ZOOM);
                }
            });
        }
    }
    
    settings() {
        var station_pair_json = this.station_pairs;
        return {"station_pairs": station_pair_json};
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


function delete_station_event(e) {
    var station_id = parseInt($(this).attr('transit-station-id'));
    enmodal.transit_interface.remove_station(station_id);
}

function transfer_station_event(e) {
    var station_id = $(this).attr('id').replace('transfer-', '');
    enmodal.transit_interface.active_transfer_station = enmodal.transit_interface.active_service.get_station_by_id(station_id);
    enmodal.transit_interface.active_tool = "transfer";
}

function build_to_station_event(e) {
    var station_id = $(this).attr('id');
    enmodal.transit_interface.add_stop_to_station(station_id);
}