function handle_map_click(e) {
    if (enmodal.transit_interface.active_line !== null && enmodal.transit_interface.active_tool == "station") {
        var pp = enmodal.transit_interface.pin_projection(e.latlng.lat, e.latlng.lng);
        if (!pp[0]) {
            enmodal.transit_interface.add_new_station(e.latlng.lat, e.latlng.lng);
        } else {
            var sp = enmodal.transit_interface.get_station_pair_by_sp_id(pp[2]);
            sp.add_pin(pp[1].x, pp[1].y);
        }
    }
    if (enmodal.transit_interface.active_line === null && enmodal.transit_interface.active_tool == "station") {
        L.popup().setLatLng(e.latlng).setContent("Create a line to start building").openOn(enmodal.leaflet_map);
    }
    if (enmodal.transit_interface.active_tool == "transfer") {
        enmodal.transit_interface.active_tool = "station";
        enmodal.transit_interface.preview_clear();
    }
}

function set_basemap_style(basemap) {
    if (enmodal.transit_interface.basemap) {
        _leaflet_map.removeLayer(enmodal.transit_interface.basemap);
    }
    enmodal.transit_interface.basemap = L.esri.basemapLayer(basemap);
    _leaflet_map.addLayer(enmodal.transit_interface.basemap);

    var basemap_options = {
        'DarkGray': {
            'opacity': 1.0,
            'background_color': '#474749'
        },
        'Gray': {
            'opacity': 1.0,
            'background_color': '#e8e8e8'
        },
        'Imagery': {
            'opacity': 0.4,
            'background_color': '#474749'
        },
        'Oceans': {
            'opacity': 1.0,
            'background_color': '#f1eedd'
        }
    };

    if (basemap in basemap_options) {
        var options = basemap_options[basemap];
        $("#map.leaflet-container").css('background-color', options.background_color);
        _leaflet_map.getPane('tilePane').style.opacity = options.opacity;
    }
}

function set_basemap_labels(basemap, s) {

    if (enmodal.transit_interface.basemapLabels) {
        _leaflet_map.removeLayer(enmodal.transit_interface.basemapLabels);
    }
    if (s) {
        enmodal.transit_interface.basemapLabels = L.esri.basemapLayer(basemap + 'Labels');
        _leaflet_map.addLayer(enmodal.transit_interface.basemapLabels);
    }
}

function init_leaflet_map() {
    // Create leaflet map
    var map = L.map('map', {
        fullscreenControl: true,
        attributionControl: false,
    }).setView([40.713, -74.006], START_ZOOM);

    /*L.tileLayer('http://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
        attribution: '',
        maxZoom: MAX_ZOOM,
        minZoom: MIN_ZOOM
    }).addTo(map);*/
    
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
        if ($(this).has("input").length === 0) {
            var text = $(this).text();
            var sn = $(this);
            $(this).text('');
            $('<input type="text" class="station-name-edit enm-editable"></textarea>').appendTo($(this)).val(text).select().blur(

            function() {
                var newText = $(this).val();
                $(this).parent().html(newText+'  <i class="fa fa-pencil" style="margin-left: 5px;" aria-hidden="true"></i>').find('input').remove();
                var station_id = sn.attr('id').replace('station-', '');
                var station = enmodal.transit_interface.active_service.get_station_by_id(station_id);
                station.name = newText;
                enmodal.sidebar.update_line_diagram();
                enmodal.transit_interface.sync_station_info(station);
                enmodal.transit_interface.get_station_marker_by_station(station).update_tooltip();
            }).keyup(function(e) {
                if (e.keyCode == 13) {
                    this.blur();
                }
            });
        }
    });
    $(document).on('click', '.subway-clickable', function() {
        line_select_click_handler($(this));
        return false;
    });
    $(document).on('click', '.route-diagram-stop-info', function() {
        var sn = $(this);
        var station_id = sn.attr('id').replace('station-', '');
        var station = enmodal.transit_map.get_station_by_id(station_id);
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
    
    if (SERVICE_MODES_ENABLED) {
        $(".service-mode-button").click(function() {
            var sn = $(this);
            var mode = sn.attr('transit-service-mode');
            enmodal.transit_interface.active_service.mode = mode;
            enmodal.sidebar.update_service_selector(enmodal.transit_interface.active_service.sid, true);
        });
    }

    $(document).on("click", ".service-selector-option", function(e) {
        enmodal.sidebar.update_service_selector(parseInt(e.currentTarget.getAttribute("transit-service-id")), true);
    });

    // UI edits

    $(".subway-hidden").hide();
    //$("#custom-line-options").hide();
    $("#custom-lines").hide();

    // Starter screen
    $("#game-start-scratch").click(function() {
        $("#starter-city-picker").hide();
        $("#starter").hide();
        $("#options").show();
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
        color: DEFAULT_LINE_BG,
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
        color: DEFAULT_LINE_FG,
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
    if (enmodal.transit_interface.active_line !== null) enmodal.sidebar.refresh_line_editor();

    // Tool selector

    $("#tool-station").click(function(e) {
        if (enmodal.transit_interface.active_tool != "station") {
            enmodal.transit_interface.layers.preview.clearLayers();
            enmodal.transit_interface.active_tool = "station";
        }
    });
    $("#tool-data").click(function(e) {
        if (enmodal.transit_interface.active_tool != "data") {
            enmodal.transit_interface.layers.preview.clearLayers();
            enmodal.transit_interface.active_tool = "data";
        }
    });
    $(".data-layer-selector").click(function(e) {
        if (!$(this).hasClass("data-layer-selected")) {
            $(".data-layer-selector").removeClass("data-layer-selected");
            $(this).addClass("data-layer-selected");
            if ($(this).attr('id') == "data-layer-population") {
                enmodal.data.hide_layers();
                enmodal.data.draw_layer_population(true);
            }
            if ($(this).attr('id') == "data-layer-employment") {
                enmodal.data.hide_layers();
                enmodal.data.draw_layer_employment(true);
            }
            if ($(this).attr('id') == "data-layer-ridership") {
                enmodal.data.hide_layers();
                enmodal.data.draw_layer_ridership();
            }
        } else {
            enmodal.data.active = null;
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
    
    // Map name editor
    $(document).on('click', '#map-title-inner', function() {
        if ($(this).has("input").length === 0) {
            var text = $(this).text().trim();
            var sn = $(this);
            $(this).text('');
            $('<input type="text" class="map-title-edit enm-editable"></input>').appendTo($(this)).val(text).select().blur(
            function() {
                var newText = $(this).val();
                $(this).parent().html(newText + '  <i class="fa fa-pencil" style="margin-left: 5px;" aria-hidden="true"></i>').find('input').remove();
                var params = $.param({
                    i: enmodal.session_id,
                    name: newText
                });
                $.ajax({ url: "map_name?"+params,
                    async: false,
                    dataType: 'json',
                    success: function(data, status) {
                        enmodal.map_name = newText;
                    }
                });
            }).keyup(function(e) {
                if (e.keyCode == 13) {
                    this.blur();
                }
            });
        }
    });

    // Ctrl+key handlers
    $(document).keydown(function(e) {
        console.log("keydown");
        if (e.which === 89 && e.ctrlKey) {
            console.log("ctrl+y");
            redo();
        }
        else if (e.which === 90 && e.ctrlKey) {
            console.log("ctrl+z");
            undo();
        }          
    });
    
    new Clipboard('.share-link-copy-button');
}

// Globals.
var _id_factory;
var _leaflet_map;
var enmodal;
var _undo_buffer = [];
var _undo_index = null;

$(function() {
    // Create global variables and start the session
    _id_factory = new IdFactory();
    _leaflet_map = init_leaflet_map();
    enmodal = {
        public_key: null,
        session_id: get_url_parameter("id"),
        sidebar: new Sidebar(),
        sharing: new Sharing(),
        leaflet_map: _leaflet_map,
        transit_map: new Map(),
        transit_interface: new TransitUI(_leaflet_map),
        map_name: null,
        data: new DataLayers(),
        id_factory: _id_factory,
    };
    $("a#share").click(function() {
        enmodal.sharing.update(enmodal.public_key, enmodal.session_id);
    });
    set_basemap_style('DarkGray');
    set_basemap_labels('DarkGray', true);
    init_document();
    if (enmodal.session_id !== null) {
        session_load();
    } else if (window.location.pathname != "/view") {
        session_new();
    }
    push_undo_buffer();
});