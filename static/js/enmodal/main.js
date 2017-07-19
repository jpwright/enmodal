// Create global variables and start the session

var _leaflet_map = init_leaflet_map();
var _id_factory = new IdFactory();
var enmodal = {
    session_id: get_url_parameter("id"),
    sidebar: new Sidebar(),
    sharing: new Sharing(),
    leaflet_map: _leaflet_map,
    transit_map: new Map(),
    transit_interface: new TransitUI(_leaflet_map),
    transit_data: new TransitDataLayers(_leaflet_map),
    id_factory: _id_factory,
};

if (enmodal.session_id != null) {
    session_load();
} else {
    session_new();
}

function handle_map_click(e) {
    if (enmodal.transit_interface.active_line != null && enmodal.transit_interface.active_tool == "station") {
        var pp = enmodal.transit_interface.pin_projection(e.latlng.lat, e.latlng.lng);
        if (!pp[0]) {
            enmodal.transit_interface.add_new_station(e.latlng.lat, e.latlng.lng);
        } else {
            var sp = enmodal.transit_interface.get_station_pair_by_sp_id(pp[2]);
            sp.add_pin(pp[1].x, pp[1].y);
        }
    }
    if (enmodal.transit_interface.active_tool == "transfer") {
        enmodal.transit_interface.active_tool = "station";
        enmodal.transit_interface.preview_clear();
    }
}

function init_leaflet_map() {
    // Create leaflet map
    var map = L.map('map', {
        fullscreenControl: true,
        attributionControl: false
    }).setView([40.713, -74.006], START_ZOOM);

    L.tileLayer('http://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
        attribution: '',
        maxZoom: MAX_ZOOM,
        minZoom: MIN_ZOOM
    }).addTo(map);
    
    map.on('click', handle_map_click);

    return map;
}

function init_document() {
    
    // Event handlers
    $(document).on('click', '.station-delete', delete_station_event);
    $(document).on('click', '.station-transfer', transfer_station_event);
    $(document).on('click', '.station-build', build_to_station_event);
    $(document).on('click', '.subway-deletable', function() {
        var line_id = parseInt($(this).attr('transit-line-id'));
        var station_id = parseInt($(this).attr('transit-station-id'));
        enmodal.transit_interface.remove_line_from_station(station_id, line_id);
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
            var station = enmodal.transit_interface.active_service.get_station_by_id(station_id);
            station.name = newText;
            enmodal.sidebar.update_line_diagram();
            enmodal.transit_interface.sync_station_info(station);
            enmodal.transit_interface.get_station_marker_by_station(station).update_tooltip();
        });
    });
    $(document).on('click', '.subway-clickable', function() {
        line_select_click_handler($(this));
        return false;
    });
    $(document).on('click', '.route-diagram-stop-info', function() {
        var sn = $(this);
        var station_id = sn.attr('id').replace('station-', '');
        var station = enmodal.transit_interface.active_service.get_station_by_id(station_id);
        var station_marker = enmodal.transit_interface.get_station_marker_by_station(station);
        station_marker.generate_popup();
        station_marker.marker.openPopup();
        enmodal.leaflet_map.panTo(station_marker.marker.getLatLng());
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
        enmodal.sidebar.update_line_editor();
        enmodal.sidebar.line_editor_save();
    });
    $("#line-selector-new").click(function() {
        enmodal.sidebar.line_selector_new();
    });

    $(document).on("click", ".line-selector-option", function(e) {
        enmodal.sidebar.update_line_selector(parseInt(e.currentTarget.getAttribute("transit-line-id")));
    });
    
    $('#custom-service-name').keyup(function() {
        enmodal.sidebar.service_editor_save();
    });
    $("#service-selector-new").click(function() {
        enmodal.sidebar.service_selector_new();
    });

    $(document).on("click", ".service-selector-option", function(e) {
        enmodal.sidebar.update_service_selector(parseInt(e.currentTarget.getAttribute("transit-service-id")));
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
        enmodal.transit_interface.map.panTo(L.latLng(place_lat, place_lng));
    });*/
    $("#city-picker-input").autocomplete({
        source: function(request, response) {
            if (is_latlng(request.term)) {
                var ll = get_latlng(request.term);
                enmodal.leaflet_map.panTo(L.latLng(ll[0],ll[1]));
            } else {
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
            }
        },
        select: function (event, ui) {
            $("#city-picker-input").val(ui.item.label);
            enmodal.transit_interface.map.panTo(L.latLng(ui.item.value.coordinates[1], ui.item.value.coordinates[0]));
            return false;
        },
        minLength: 3
    });
    //$("#city-picker-input").attr('autocomplete', 'on');

    // Color pickers
    $("#custom-line-options #color-picker-bg").spectrum({
        color: "#808183",
        showInput: true,
        className: "full-spectrum",
        showInitial: true,
        maxSelectionSize: 10,
        preferredFormat: "hex",
        change: function(color) {
            enmodal.sidebar.update_line_editor();
            enmodal.sidebar.line_editor_save();
        }
    });
    $("#custom-line-options #color-picker-fg").spectrum({
        color: "#FFF",
        showInput: true,
        className: "full-spectrum",
        showInitial: true,
        maxSelectionSize: 10,
        preferredFormat: "hex",
        change: function(color) {
            enmodal.sidebar.update_line_editor();
            enmodal.sidebar.line_editor_save();
        }
    });
    if (enmodal.transit_interface.active_line != null) enmodal.sidebar.refresh_line_editor();

    // Tool selector
    $("#tool-station").addClass("game-button-active");

    $("#tool-station").click(function(e) {
        if (enmodal.transit_interface.active_tool != "station") {
            $(".tool-button").removeClass("game-button-active");
            $("#tool-station").addClass("game-button-active");

            $("#option-section-lines").show();
            $("#option-section-route").show();
            $("#option-section-visual").hide();
            $("#option-section-data").hide();

            enmodal.transit_interface.layers.preview.clearLayers();
            //enmodal.transit_interface.hexagons = {};
            //enmodal.transit_interface.data_layer.clearLayers();
            enmodal.transit_interface.active_tool = "station";
        }
    });
    $("#tool-data").click(function(e) {
        if (enmodal.transit_interface.active_tool != "data") {
            $(".tool-button").removeClass("game-button-active");
            $("#tool-data").addClass("game-button-active");

            $("#option-section-lines").hide();
            $("#option-section-route").hide();
            $("#option-section-visual").hide();
            $("#option-section-data").show();

            enmodal.transit_interface.layers.preview.clearLayers();
            enmodal.transit_interface.active_tool = "data";
        }
    });
    $(".data-layer-selector").click(function(e) {
        if (!$(this).hasClass("data-layer-selected")) {
            $(".data-layer-selector").removeClass("data-layer-selected");
            $(this).addClass("data-layer-selected");
            if ($(this).attr('id') == "data-layer-population") {
                enmodal.transit_interface.hexagon_layer = "population";
                enmodal.transit_interface.get_hexagons(true);
            }
            if ($(this).attr('id') == "data-layer-employment") {
                enmodal.transit_interface.hexagon_layer = "employment";
                enmodal.transit_interface.get_hexagons(true);
            }
            if ($(this).attr('id') == "data-layer-ridership") {
                enmodal.transit_interface.hexagon_layer = "none";
                enmodal.transit_interface.data_layer.clearLayers();
                var min_ridership = -1;
                var max_ridership = 0;
                for (var i = 0; i < enmodal.transit_interface.active_service.stations.length; i++) {
                    var station = enmodal.transit_interface.active_service.stations[i];
                    var ridership = station.ridership;
                    if (ridership > max_ridership) max_ridership = ridership;
                    if (ridership < min_ridership || min_ridership == -1) min_ridership = ridership;
                }
                for (var i = 0; i < enmodal.transit_interface.active_service.stations.length; i++) {
                    var station = enmodal.transit_interface.active_service.stations[i];
                    var ridership = station.ridership;
                    var r = 39.0*(ridership-min_ridership)/(max_ridership-min_ridership) + 1;
                    enmodal.transit_interface.data_layer.addLayer(L.circleMarker(station.location, {color: 'red', radius: r}));
                }
                //enmodal.transit_interface.map.addLayer(enmodal.transit_interface.data_layer);
                $("#scale-boxes").empty();
                for (var i = 0; i < 10; i++) {
                    $("#scale-boxes").append('<div class="scale-box"><div class="scale-inner" style="width: '+((i+1)*2).toString()+'px; height: '+((i+1)*2).toString()+'px; top: '+(20-(i+1)).toString()+'px;"></div>');
                }
                $("#scale-low").text(Math.round(min_ridership));
                $("#scale-mid").text(Math.round((max_ridership-min_ridership)/2 + min_ridership));
                $("#scale-high").text(Math.round(max_ridership));
                $("#scale-units").html("weekday riders");
                $("#scale").show();
            }
        } else {
            enmodal.transit_interface.hexagon_layer = "none";
            $("#scale").hide();
            $(".data-layer-selector").removeClass("data-layer-selected");
            //enmodal.transit_interface.map.removeLayer(enmodal.transit_interface.data_layer);
            enmodal.transit_interface.layers.data.clearLayers();
        }
    });

    $("#tool-save").click(function(e) {
        session_save();
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
}

$(function() {
    init_document();
});