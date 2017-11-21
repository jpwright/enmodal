class Sidebar {
    constructor() {
        
    }
    
    add_to_line_selector(line) {
        // Add a line to the line selector dropdown.
        $("#dropdown-line-menu").prepend("<li class=\"line-selector-item\"><a class=\"line-selector-option\" transit-line-id=\""+line.sid.toString()+"\" href=\"#\"> <div class=\"subway-line-long\" style=\"background-color: "+line.color_bg+"; color: "+line.color_fg+";\"><div class=\"content\">"+line.name+"</div></div> "+line.full_name+"</a></li>");
    }

    new_line_name() {
        // Generate a new line name, based on used names.
        // Letters A-Z are 0-25. Numbers 1-infinity start at 26

        var used_names = [];
        for (var i = 0; i < enmodal.transit_interface.active_service.lines.length; i++) {
            var line = enmodal.transit_interface.active_service.lines[i];
            if (line.name.length == 1) {
                if (isNaN(line.name)) {
                    used_names[line.name.charCodeAt(0) - 65] = 1;
                } else {
                    used_names[parseInt(line.name) + 25] = 1;
                }
            }
        }
        for (i = 0; i < used_names.length; i++) {
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

        var color = this.random_color();
        line.color_bg = color.bg_hex();
        line.color_fg = color.fg_hex();

        //console.log(line);
        if (INC_UPDATES) {
            var params = $.param({
                i: enmodal.session_id,
                service_id: enmodal.transit_interface.active_service.sid,
                name: line.name,
                full_name: line.full_name,
                color_bg: line.color_bg,
                color_fg: line.color_fg,
                line_id: line.sid 
            });
            $.ajax({ url: "line_add?"+params,
                async: ASYNC_REQUIRED,
                dataType: 'json',
                success: function(data, status) {
                }
            });
        }
        enmodal.transit_interface.active_service.add_line(line);
        this.add_to_line_selector(line);
        this.update_line_selector(line.sid);
        enmodal.transit_interface.preview_clear();
        return line;
    }
    
    clear_line_selector() {
        enmodal.transit_interface.active_line = null;
        $("#dropdown-line-menu li.line-selector-item").remove();
        $("#dropdown-line-button").html("Select a line... <span class=\"caret\"></span>");
        $('#custom-line-name').removeClass('issue');
        $('#custom-line-error').text('');

        $("#custom-line-name").val("");
        $("#custom-line-options #color-picker-bg").spectrum("set", "#808183");
        $("#custom-line-options #color-picker-fg").spectrum("set", "#FFF");
        this.update_line_editor();
        this.update_line_diagram();
    }

    update_line_selector(id) {
        // Update system state based on line selector click.
        var line = enmodal.transit_interface.active_service.get_line_by_id(id);
        enmodal.transit_interface.active_line = line;

        $("#dropdown-line-button").html("<div class=\"subway-line-long\" style=\"background-color: "+line.color_bg+"; color: "+line.color_fg+";\"><div class=\"content\">"+line.name+"</div></div> "+line.full_name+" <span class=\"caret\"></span>");

        $('#custom-line-name').removeClass('issue');
        $('#custom-line-error').text('');

        $("#custom-line-name").val(line.name);
        $("#custom-line-options #color-picker-bg").spectrum("set", line.color_bg);
        $("#custom-line-options #color-picker-fg").spectrum("set", line.color_fg);
        this.update_line_editor();
        this.update_line_diagram();
        enmodal.transit_interface.preview_clear();
    }

    update_line_editor() {
        var line_name = $("#custom-line-name").val();
        if (line_name !== undefined) line_name = line_name.substring(0, 40);
        $("#custom-line-marker-content").text(line_name);

        var line_color_bg = $("#color-picker-bg").val();
        $('#custom-line-marker').css('background-color', line_color_bg);

        var line_color_fg = $("#color-picker-fg").val();
        $('#custom-line-marker').css('color', line_color_fg);
    }

    refresh_line_editor() {
        $(".line-selector-item").remove();
        for (var i = 0; i < enmodal.transit_interface.active_service.lines.length; i++) {
            var line = enmodal.transit_interface.active_service.lines[i];
            $("#dropdown-line-menu").prepend("<li class=\"line-selector-item\"><a class=\"line-selector-option\" transit-line-id=\""+line.sid.toString()+"\" href=\"#\"> <div class=\"subway-line-long\" style=\"background-color: "+line.color_bg+"; color: "+line.color_fg+";\"><div class=\"content\">"+line.name+"</div></div> "+line.full_name+"</a></li>");
        }
        if (enmodal.transit_interface.active_line !== null) {
            $("#custom-line-options #color-picker-bg").spectrum("set", enmodal.transit_interface.active_line.color_bg);
            $("#custom-line-options #color-picker-fg").spectrum("set", enmodal.transit_interface.active_line.color_fg);
        } else {
            $("#custom-line-options #color-picker-bg").spectrum("set", DEFAULT_LINE_BG);
            $("#custom-line-options #color-picker-fg").spectrum("set", DEFAULT_LINE_FG);
        }
    }

    line_editor_save() {
        var line = enmodal.transit_interface.active_line;

        var custom_line_name = $("#custom-line-name").val();
        if (custom_line_name !== undefined) custom_line_name = custom_line_name.substring(0, 40);
        var custom_line_color_bg = $("#custom-line-options #color-picker-bg").val();
        var custom_line_color_fg = $("#custom-line-options #color-picker-fg").val();
        var issue = false;

        if (custom_line_name.length === 0) {
            $('#custom-line-name').addClass('issue');
            $('#custom-line-error').text('Enter a name.');
            issue = true;
        }

        if (!issue) {
            line.name = custom_line_name;
            line.color_bg = custom_line_color_bg;
            line.color_fg = custom_line_color_fg;

            $('#custom-line-name').removeClass('issue');
            $('#custom-line-css-bg').removeClass('issue');
            $('#custom-line-css-text').removeClass('issue');
            $('#custom-line-error').text('');

            this.update_line_selector(line.sid);
            $("a[transit-line-id='"+line.sid.toString()+"']").html("<div class=\"subway-line-long\" style=\"background-color: "+line.color_bg+"; color: "+line.color_fg+";\"><div class=\"content\">"+line.name+"</div></div> "+line.full_name);
            enmodal.transit_interface.draw_line(line, false, true, enmodal.transit_interface.layers.active.line_paths, true, enmodal.transit_interface.active_service);
        } else {
            $("#option-section-lines").animate({scrollTop: $('#option-section-lines').prop('scrollHeight')}, 1000);
        }
    }
    
    update_line_diagram() {
        var line = enmodal.transit_interface.active_line;
        
        if (line === null) {
            $("#route-diagram").empty();
            return;
        }
        if (line.stops.length === 0) {
            $("#route-diagram").empty();
            return;
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


            for (j = start_index; j < stop_group.length; j++) {
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
                var connecting_lines = [];
                for (var k = 0; k < enmodal.transit_interface.active_service.lines.length; k++) {
                    if (enmodal.transit_interface.active_service.lines[k].sid != line.sid) {
                        if (enmodal.transit_interface.active_service.lines[k].has_station(stop.station)) {
                            connecting_lines.push(enmodal.transit_interface.active_service.lines[k]);
                        }
                    }
                }
                for (k = 0; k < enmodal.transit_interface.active_service.transfers.length; k++) {
                    if (enmodal.transit_interface.active_service.transfers[k].has_station(stop.station)) {
                        var transfer_stations = enmodal.transit_interface.active_service.transfers[k].stations;
                        for (var l = 0; l < transfer_stations.length; l++) {
                            if (transfer_stations[l] != stop.station) {
                                var transfer_station_lines = enmodal.transit_interface.active_service.station_lines(transfer_stations[l]);
                                for (var m = 0; m < transfer_station_lines.length; m++) {
                                    if (connecting_lines.indexOf(transfer_station_lines[m]) == -1) {
                                        connecting_lines.push(transfer_station_lines[m]);
                                    }
                                }
                            }
                        }
                    }
                }
                for (k = 0; k < connecting_lines.length; k++) {
                    stop_connectors.append('<div class="subway-line-long subway-line-mini subway-line-marker-diagram" style="font-size: 1em; background-color: '+connecting_lines[k].color_bg+'; color: '+connecting_lines[k].color_fg+';"><div class="content">'+connecting_lines[k].name+'</div></div>');
                }

                // Store the stop index.
                stop_position[stop.sid] = stop_index;
                stop_index += 1;
            }
        }
    }
    
    add_to_service_selector(service) {
        // Add a service to the service selector dropdown.
        $("#dropdown-service-menu").prepend("<li class=\"service-selector-item\"><a class=\"service-selector-option\" transit-service-id=\""+service.sid.toString()+"\" href=\"#\">"+service.name+"</a></li>");

    }

    service_selector_new() {
        var service = new Service("Service");

        //console.log(line);
        if (INC_UPDATES) {
            var params = $.param({
                i: enmodal.session_id,
                service_id: service.sid,
                name: service.name
            });
            $.ajax({ url: "service_add?"+params,
                async: ASYNC_REQUIRED,
                dataType: 'json',
                success: function(data, status) {
                }
            });
        }
        enmodal.transit_map.add_service(service);
        this.add_to_service_selector(service);
        this.update_service_selector(service.sid, true);
        enmodal.transit_interface.active_line = null;
        this.clear_line_selector();
        enmodal.transit_interface.preview_clear();
        
        enmodal.transit_interface.draw_service(service, enmodal.transit_interface.layers.active, true, true);
        
        return service;
    }

    update_service_selector(id, draw) {
        // Update system state based on service selector click.
        var service = enmodal.transit_map.get_service_by_id(id);
        enmodal.transit_interface.active_service = service;

        $("#dropdown-service-button").html(service.name+" <span class=\"caret\"></span>");

        $('#custom-service-name').removeClass('issue');
        $('#custom-service-error').text('');

        $("#custom-service-name").val(service.name);
        
        $(".service-mode-button").removeClass("active");
        if (service.mode == "heavy_rail") {
            $("#service-option-heavy-rail").addClass("active");
        }
        if (service.mode == "light_rail") {
            $("#service-option-light-rail").addClass("active");
        }
        if (service.mode == "bus") {
            $("#service-option-bus").addClass("active");
        }
        
        if (service.lines.length > 0) {
            this.update_line_selector(service.lines[0].sid);
            enmodal.transit_interface.active_line = service.lines[0];
        } else {
            this.clear_line_selector();
            enmodal.transit_interface.active_line = null;
        }
        enmodal.transit_interface.preview_clear();
        
        if (draw) enmodal.transit_interface.draw_service(service, enmodal.transit_interface.layers.active, true, true);
        
        this.update_line_editor();
        this.refresh_line_editor();
        this.update_line_diagram();
        
        enmodal.leaflet_map.closePopup();
    }

    refresh_service_editor() {
        $(".service-selector-item").remove();
        for (var i = 0; i < enmodal.transit_map.services.length; i++) {
            var service = enmodal.transit_map.services[i];
            $("#dropdown-service-menu").prepend("<li class=\"service-selector-item\"><a class=\"service-selector-option\" transit-service-id=\""+service.sid+"\" href=\"#\">"+service.name+"</a></li>");
        }
    }

    service_editor_save() {
        var service = enmodal.transit_interface.active_service;
        
        var custom_service_name = $("#custom-service-name").val().substring(0, 20);
        var issue = false;

        if (custom_service_name.length === 0) {
            $('#custom-service-name').addClass('issue');
            $('#custom-service-error').text('Enter a name.');
            issue = true;
        }
        if (!issue) {
            service.name = custom_service_name;

            $('#custom-service-name').removeClass('issue');
            $('#custom-service-css-bg').removeClass('issue');
            $('#custom-service-css-text').removeClass('issue');
            $('#custom-service-error').text('');

            this.update_service_selector(service.sid, false);
            $("a[transit-service-id='"+service.sid+"']").html(service.name);
        } else {
            $("#option-section-services").animate({scrollTop: $('#option-section-services').prop('scrollHeight')}, 1000);
        }
    }
}