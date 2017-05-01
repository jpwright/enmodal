// Important global variables.
var NS_session;
var NS_map;
var NS_service;
var NS_interface;
var NS_data;
var NS_id = new IdFactory();
var NS_id_sp = new IdFactory();

function new_game() {
    console.log("creating new game");
    var initial_lines = [
        new Line(0, 'A')
    ];
    // Initialize server
    $.ajax({ url: "session",
        async: false,
        dataType: 'json',
        success: function(data, status) {
            NS_session = data["private_key"];
            window.history.pushState("", "", "?id="+NS_session);
            update_share_urls(data["public_key"], data["private_key"]);
        }
    });

    // Initialize map
    $.ajax({ url: "map-info?i="+NS_session,
        async: false,
        dataType: 'json',
        success: function(data, status) {
            NS_map = new Map();
            NS_map.sid = data["sid"];
        }
    });

    // Initialize service
    var NS_service = new Service("MTA");
    $.ajax({ url: "service-add?i="+NS_session+"&name="+NS_service.name+"&service-id="+NS_service.sid.toString(),
        async: false,
        dataType: 'json',
        success: function(data, status) {
            NS_map.add_service(NS_service);
            NS_interface.active_service = NS_map.primary_service();
            NS_interface.active_line = NS_map.primary_service().lines[0];
        }
    });
}

function sync_with_server(get_ridership) {
    $.ajax({ url: "session-push?i="+NS_session,
        async: true,
        type: "POST",
        data: LZString.compressToUTF16(NS_map.to_json()),
        dataType: 'text',
        success: function(data, status) {
            console.log("push done");
            for (var i = 0; i < NS_interface.station_pairs.length; i++) {
                if (NS_interface.station_pairs[i].user_modified) {
                    NS_interface.sync_station_pair_info(NS_interface.station_pairs[i]);
                }
            }
            $.ajax({ url: "session-save?i="+NS_session,
                async: true,
                dataType: 'json',
                success: function(data, status) {
                    $("#save-message").fadeIn().delay(2000).fadeOut();
                }
            });
            if (get_ridership) {
                NS_interface.get_ridership();
            }
        }
    });
}

function update_share_urls(public_key, private_key) {
    console.log(location.origin);
    
    $("#share-link-public input").val(location.origin+"/?id="+public_key);
    $("#share-link-private input").val(location.origin+"/?id="+private_key);
}

function initialize_game_state() {

    // Create leaflet map
    var map = L.map('map', {
        fullscreenControl: true,
        attributionControl: false
    }).setView([40.713, -74.006], 13);

    L.tileLayer('http://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
            attribution: '',
            maxZoom: 16,
            minZoom: 12
    }).addTo(map);

    map.on('click', handle_map_click);

    // Initialize interface
    NS_interface = new TransitUI(map);
    NS_data = new TransitDataLayers(map);

    var session_id = get_url_parameter("id");

    if (session_id != null) {
        PRELOADED_SESSION = true;
        // Initialize session and map
        $.ajax({ url: "session-load?i="+session_id,
            async: false,
            success: function(data, status) {
                
                console.log(data);
                var j = JSON.parse(data);
                console.log(j);
                if (j["error"] != undefined) {
                    new_game();
                } else {
                    var jdata = JSON.parse(j.data);
                    console.log(jdata);
                    NS_session = j.private_key;
                    window.history.pushState("", "", "?id="+NS_session);
                    update_share_urls(j.public_key, j.private_key);
                    
                    NS_map = new Map();
                    NS_map.sid = jdata.sid;
                    NS_map.from_json(jdata);

                    NS_interface.active_service = NS_map.primary_service();
                    NS_interface.active_line = NS_map.primary_service().lines[0];
                    NS_interface.update_line_selector(NS_interface.active_line.sid);
                    NS_interface.update_line_editor();
                    NS_interface.refresh_line_editor();
                    NS_interface.update_line_diagram();
                    for (var i = 0; i < NS_map.primary_service().stations.length; i++) {
                        var station = NS_map.primary_service().stations[i];
                        NS_interface.create_station_marker(station);
                    }
                    for (var i = 0; i < NS_map.primary_service().lines.length; i++) {
                        var line = NS_map.primary_service().lines[i];
                        NS_interface.update_edge_paths(line);
                    }
                    for (var i = 0; i < NS_map.primary_service().lines.length; i++) {
                        var line = NS_map.primary_service().lines[i];
                        NS_interface.draw_line(line, false, false);
                    }

                    // use user settings where appropriate
                    var user_settings = jdata.settings;
                    for (var i = 0; i < user_settings.station_pairs.length; i++) {
                        var sp = user_settings.station_pairs[i];
                        var station_1 = NS_map.primary_service().get_station_by_id(sp.station_ids[0]);
                        var station_2 = NS_map.primary_service().get_station_by_id(sp.station_ids[1]);
                        var sp_real = NS_interface.get_station_pair(station_1, station_2);
                        if (sp_real != null) {
                            var ucp = sp.user_control_points;
                            sp_real[0].set_user_control_points([new BezierControlPoint(ucp[0][0], ucp[0][1]), new BezierControlPoint(ucp[1][0], ucp[1][1])]);
                        }
                    }

                    for (var i = 0; i < NS_map.primary_service().lines.length; i++) {
                        var line = NS_map.primary_service().lines[i];
                        NS_interface.draw_line(line, false, true);
                    }
                    NS_interface.station_marker_layer.bringToFront();
                    NS_interface.map.closePopup();
                    NS_interface.get_ridership();
                    $("#starter-city-picker").hide();
                    $("#starter").hide();
                }
            }
        });
    } else {
        new_game();
    }

}

// Main

var HEADLESS_MODE = false;
var PRELOADED_SESSION = false;
var CUSTOM_CITY_NAME = "";

initialize_game_state();

$(function() {

    // Event handlers
    $(document).on('click', '.station-delete', delete_station_event);
    $(document).on('click', '.station-transfer', transfer_station_event);
    $(document).on('click', '.station-build', build_to_station_event);
    $(document).on('click', '.subway-deletable', function() {
        var id = $(this).attr('id');
        console.log(id);
        var id_comps = id.split('.');
        NS_interface.remove_line_from_station(parseInt(id_comps[0]), parseInt(id_comps[1]));
    });
    $(document).on('click', '.station-name', function() {
        var text = $(this).text();
        var sn = $(this);
        $(this).text('');
        $('<textarea class="station-name-edit"></textarea>').appendTo($(this)).val(text).select().blur(

        function() {
            var newText = $(this).val();
            $(this).parent().text(newText).find('textarea').remove();
            var station_id = sn.attr('id').replace('station-', '');
            var station = NS_interface.active_service.get_station_by_id(station_id);
            station.name = newText;
            NS_interface.update_line_diagram();
            NS_interface.sync_station_info(station);
            NS_interface.get_station_marker_by_station(station).update_tooltip();
        });
    });
    $(document).on('click', '.subway-clickable', function() {
        line_select_click_handler($(this));
        return false;
    });
    $(document).on('click', '.route-diagram-stop-info', function() {
        var sn = $(this);
        var station_id = sn.attr('id').replace('station-', '');
        var station = NS_interface.active_service.get_station_by_id(station_id);
        var station_marker = NS_interface.get_station_marker_by_station(station);
        station_marker.generate_popup();
        station_marker.marker.openPopup();
        NS_interface.map.panTo(station_marker.marker.getLatLng());
    });

    /*setInterval(function(){
        // Initialize service
        $.ajax({ url: "session-save",
            async: false,
            dataType: 'json',
            success: function(data, status) {
            }
        });
    }, 10000);*/

    $('#custom-line-name').keyup(function() {
        NS_interface.update_line_editor();
        NS_interface.line_editor_save();
    });
    $("#line-selector-new").click(function() {
        NS_interface.line_selector_new();
    });

    $(document).on("click", ".line-selector-option", function(e) {
        NS_interface.update_line_selector(parseInt(e.target.id));
    });

    $("#custom-line-save").click(function() {
        NS_interface.line_editor_save();
    });

    // UI edits

    $(".subway-hidden").hide();
    //$("#custom-line-options").hide();
    $("#custom-lines").hide();

    // Starter screen
    $("#game-start-scratch").click(function() {
        $("#starter-city-picker").hide();
        $("#starter").hide();
    });

    /*var input = document.getElementById('pac-input');
    var autocomplete = new google.maps.places.Autocomplete(input, {types: ["(cities)"]});
    autocomplete.addListener('place_changed', function() {
        var place = autocomplete.getPlace();

        CUSTOM_CITY_NAME = place.name;

        var place_lat = place.geometry.location.lat();
        var place_lng = place.geometry.location.lng();
        NS_interface.map.panTo(L.latLng(place_lat, place_lng));
    });*/
    $("#city-picker-input").autocomplete({
        source: function(request, response) {
            $.ajax({
                url: "http://search.mapzen.com/v1/autocomplete?api_key=mapzen-t6h4cff&layers=locality&text="+request.term,
                dataType: "json",
                success: function( data ) {
                    response($.map(data.features, function(item) {
                        if (item.properties.country_a == "USA") {
                            return {
                                label : item.properties.locality + ", " + item.properties.region_a,
                                value : item.geometry
                            };
                        }
                    }));
                }
            });
        },
        select: function (event, ui) {
            $("#city-picker-input").val(ui.item.label);
            NS_interface.map.panTo(L.latLng(ui.item.value.coordinates[1], ui.item.value.coordinates[0]));
            return false;
        },
        minLength: 3
    });
    $("#city-picker-input").attr('autocomplete', 'on');

    // Color pickers
    $("#color-picker-bg").spectrum({
        color: "#808183",
        showInput: true,
        className: "full-spectrum",
        showInitial: true,
        maxSelectionSize: 10,
        preferredFormat: "hex",
        change: function(color) {
            NS_interface.update_line_editor();
            NS_interface.line_editor_save();
        }
    });
    $("#color-picker-fg").spectrum({
        color: "#FFF",
        showInput: true,
        className: "full-spectrum",
        showInitial: true,
        maxSelectionSize: 10,
        preferredFormat: "hex",
        change: function(color) {
            NS_interface.update_line_editor();
            NS_interface.line_editor_save();
        }
    });
    if (NS_interface.active_line != null) NS_interface.refresh_line_editor();

    // Tool selector
    $("#tool-station").addClass("game-button-active");

    $("#tool-station").click(function(e) {
        if (NS_interface.active_tool != "station") {
            $(".tool-button").removeClass("game-button-active");
            $("#tool-station").addClass("game-button-active");

            $("#option-section-lines").show();
            $("#option-section-route").show();
            $("#option-section-visual").hide();
            $("#option-section-data").hide();

            NS_interface.preview_path_layer.clearLayers();
            NS_interface.bezier_layer.clearLayers();
            //NS_interface.hexagons = {};
            //NS_interface.data_layer.clearLayers();
            NS_interface.active_tool = "station";
        }
    });
    $("#tool-line").click(function(e) {
        if (NS_interface.active_tool != "line") {
            $(".tool-button").removeClass("game-button-active");
            $("#tool-line").addClass("game-button-active");

            $("#option-section-lines").hide();
            $("#option-section-route").hide();
            $("#option-section-visual").show();
            $("#option-section-data").hide();

            NS_interface.preview_path_layer.clearLayers();
            NS_interface.station_for_bezier_edits = null;
            NS_interface.moving_station_marker = null;
            NS_interface.hexagons = {};
            NS_interface.data_layer.clearLayers();
            NS_interface.active_tool = "line";
        }
    });
    $("#tool-data").click(function(e) {
        if (NS_interface.active_tool != "data") {
            $(".tool-button").removeClass("game-button-active");
            $("#tool-data").addClass("game-button-active");

            $("#option-section-lines").hide();
            $("#option-section-route").hide();
            $("#option-section-visual").hide();
            $("#option-section-data").show();

            NS_interface.preview_path_layer.clearLayers();
            NS_interface.bezier_layer.clearLayers();
            NS_interface.active_tool = "data";
        }
    });
    $(".data-layer-selector").click(function(e) {
        if (!$(this).hasClass("data-layer-selected")) {
            $(".data-layer-selector").removeClass("data-layer-selected");
            $(this).addClass("data-layer-selected");
            if ($(this).attr('id') == "data-layer-population") {
                NS_interface.get_hexagons();
                NS_interface.map.addLayer(NS_interface.data_layer);
            }
        } else {
            $(".data-layer-selector").removeClass("data-layer-selected");
            NS_interface.map.removeLayer(NS_interface.data_layer);
        }
    });

    $("#tool-save").click(function(e) {
        sync_with_server(false);
    });

    $("#tool-share").click(function(e) {
        $("#starter-share").show();
        $("#starter").show();
    });
    
    $("#share-ok").click(function(e) {
        $("#starter-share").hide();
        $("#starter").hide();
    });
    
    new Clipboard('.share-link-copy-button');
});