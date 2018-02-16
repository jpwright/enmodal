/*! enmodal - v0.1.0 - 2018-02-15
* http://enmodal.co/
* Copyright (c) 2018 Jason Wright; Licensed MIT */
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
class Pin {
    constructor(location) {
        this.location = location;
        this.sid = _id_factory.id();
        this.marker = null;
    }
    
    draw() {
        enmodal.transit_interface.layers.active.line_paths.addLayer(this.marker);
    }
    
    undraw() {
        enmodal.transit_interface.layers.active.line_paths.removeLayer(this.marker);
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
    constructor(line, spline_segments, reverse) {
        this.line = line;
        this.spline_segments = spline_segments;
        this.reverse = reverse;
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
class DataLayers {
    
    constructor() {
        this.active = null;
        this.hexagon_bounds = null;
        this.hexagon_zoom = null;
    }
    
    draw_layer_population(force) {
        this.active = "population";
        this.get_hexagons(force);
    }
    
    draw_layer_employment(force) {
        this.active = "employment";
        this.get_hexagons(force);
    }
    
    draw_layer_ridership() {
        var min_ridership = -1;
        var max_ridership = 0;
        var station, ridership;
        for (var i = 0; i < enmodal.transit_interface.active_service.stations.length; i++) {
            station = enmodal.transit_interface.active_service.stations[i];
            ridership = station.ridership;
            if (ridership > max_ridership) max_ridership = ridership;
            if (ridership < min_ridership || min_ridership == -1) min_ridership = ridership;
        }
        for (i = 0; i < enmodal.transit_interface.active_service.stations.length; i++) {
            station = enmodal.transit_interface.active_service.stations[i];
            ridership = station.ridership;
            var r = 39.0*(ridership-min_ridership)/(max_ridership-min_ridership) + 1;
            enmodal.transit_interface.layers.data.addLayer(L.circleMarker(station.location, {color: 'red', radius: r}));
        }
        //enmodal.transit_interface.map.addLayer(enmodal.transit_interface.data_layer);
        $("#scale-boxes").empty();
        for (i = 0; i < 10; i++) {
            $("#scale-boxes").append('<div class="scale-box"><div class="scale-inner" style="width: '+((i+1)*2).toString()+'px; height: '+((i+1)*2).toString()+'px; top: '+(20-(i+1)).toString()+'px;"></div>');
        }
        $("#scale-low").text(Math.round(min_ridership));
        $("#scale-mid").text(Math.round((max_ridership-min_ridership)/2 + min_ridership));
        $("#scale-high").text(Math.round(max_ridership));
        $("#scale-units").html("weekday riders");
        $("#scale").show();
    }
    
    draw_active_layer(force) {
        if (this.active == "population") this.draw_layer_population(force);
        if (this.active == "employment") this.draw_layer_employment(force);
        if (this.active == "ridership") this.draw_layer_ridership();
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
                    if (station !== null) {
                        station.ridership = ridership;
                        $("#stationriders-"+station.sid.toString()).text(Math.round(station.ridership).toString());
                    }
                }
            }
        });
    }
    
    quantiles(geojson, num_breaks, feature_name) {
        var property_array = [];
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

    population_color(d, breaks, scale) {
        var num_breaks = breaks.length - 1;
        for (var i = 0; i < num_breaks; i++) {
            if (d >= breaks[i]) return scale(i/num_breaks).hex();
        }
        return scale[num_breaks-1];
    }
    
    get_hexagons(force) {
        var initial_bounds = enmodal.leaflet_map.getBounds();
        var bounds = initial_bounds.pad(0.5); // Pad for maximum scrollability
        
        var do_it = true;
        if (this.hexagon_bounds !== null && this.hexagon_zoom !== null) {
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
                    
                    var num_breaks = 8;
                    var breaks = enmodal.data.quantiles(data, num_breaks, enmodal.data.active);
                    var scale = HEXAGON_SCALES[enmodal.data.active];
                    $("#scale-boxes").empty();
                    for (var i = 0; i < num_breaks; i++) {
                        $("#scale-boxes").append('<div class="scale-box" style="background-color: '+scale((num_breaks-i)/num_breaks).hex()+' "></div>');
                    }
                    $("#scale-low").text("0");
                    $("#scale-mid").text(Math.round(breaks[Math.round((num_breaks-1)/2)]/DGGRID_AREA).toString());
                    $("#scale-high").text(Math.round(breaks[0]/DGGRID_AREA).toString());
                    $("#scale-units").html(HEXAGON_UNITS[enmodal.data.active]);
                    $("#scale").show();
                    
                    enmodal.transit_interface.layers.data.clearLayers();

                    if (enmodal.leaflet_map.getZoom() < 14) {
                        enmodal.transit_interface.layers.data.addLayer(L.vectorGrid.slicer(data, {
                            vectorTileLayerStyles: {
                                sliced: function(properties, zoom) {
                                    var property = 0;
                                    if (enmodal.data.active == "population") property = properties.population;
                                    if (enmodal.data.active == "employment") property = properties.employment;
                                    return {
                                        fillColor: enmodal.data.population_color(property, breaks, scale),
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
                            if (enmodal.data.active == "population") property = feature.properties.population;
                            if (enmodal.data.active == "employment") property = feature.properties.employment;
                            return {
                                fillColor: enmodal.data.population_color(property, breaks, scale),
                                weight: 0,
                                opacity: 1,
                                color: 'white',
                                fillOpacity: 0.35
                            };
                        }}));
                    }
                    enmodal.transit_interface.layers.active.line_paths.bringToFront();
                    enmodal.leaflet_map.setMinZoom(MIN_ZOOM);
                }
            });
        }
    }
    
    hide_layers() {
        this.active = null;
        enmodal.transit_interface.layers.data.clearLayers();
    }
    
}
// Vue components

Vue.component('modal-city-picker', {
    template: '#template-modal-city-picker',
    props: {
        visible: {type: Boolean, default: true}
    },
});

Vue.component('modal-pro-gate', {
    template: '#template-modal-pro-gate',
    props: {
        visible: {type: Boolean, default: true}
    },
});

Vue.component('modal-exporting-pdf', {
    template: '#template-modal-exporting-pdf',
    props: {
        visible: {type: Boolean, default: true}
    },
});

Vue.component('modal-sharing', {
    template: '#template-modal-sharing',
    props: {
        visible: {type: Boolean, default: true}
    },
});

Vue.component('modal-session-expired', {
    template: '#template-modal-session-expired',
    props: {
        visible: {type: Boolean, default: true}
    },
});

Vue.component('collapse-caret', {
    template: '#template-collapse-caret',
    props: {
        visible: {type: Boolean, default: true},
        dataTargetProp: "",
        dataTargetValue: "",
    },
    methods: {
      reset() {
        this.collapsed = false;
      },
      collapse() {
        console.log(this.dataTargetProp);
        console.log(this.dataTargetValue);
        if (this.collapsed) {
          this.collapsed = false;
          $("["+this.dataTargetProp+"='"+this.dataTargetValue+"']").show();
        } else {
          this.collapsed = true;
          $("["+this.dataTargetProp+"='"+this.dataTargetValue+"']").hide();
        }
      },
    },
    mounted() {
      this.reset();
    },
});


Vue.component('button-import-gtfs', {
  template: '#template-button-import-gtfs',
    props: {
        visible: {type: Boolean, default: true}
    },
});

Vue.component('button-import-json', {
  template: '#template-button-import-json',
    props: {
        visible: {type: Boolean, default: true}
    },
});

Vue.component('button-sharing', {
  template: '#template-button-sharing',
    props: {
        visible: {type: Boolean, default: true}
    },
});

Vue.component('button-export-pdf', {
  template: '#template-button-export-pdf',
    props: {
        visible: {type: Boolean, default: true}
    },
    methods: {
      exportPdf: function() {
        app.modal = 'exporting-pdf';
        save_pdf(function() {
          app.modal = 'none';
        });
      }
    }
});

Vue.component('button-export-json', {
  template: '#template-button-export-json',
    props: {
        visible: {type: Boolean, default: true}
    },
    methods: {
      exportJson: function() {
        save_json(function() {});
      }
    }
});

Vue.component('button-basemap-style', {
  template: '#template-button-basemap-style',
    props: {
        visible: {type: Boolean, default: true}
    },
    methods: {
      setBasemap: function(basemap) {
        if (basemap != app.basemapStyle) {
          set_basemap_style(basemap);
          set_basemap_labels(basemap, app.basemapLabels);
          app.basemapStyle = basemap;
        }
      }
    }
});

Vue.component('button-basemap-labels', {
  template: '#template-button-basemap-labels',
    props: {
        visible: {type: Boolean, default: true}
    },
    methods: {
      setLabels: function(s) {
        if (s != app.basemapLabels) {
          set_basemap_labels(app.basemapStyle, s);
          app.basemapLabels = s;
        }
      }
    }
});

const STATUS_INITIAL = 0, STATUS_SAVING = 1, STATUS_ANALYZING = 2, STATUS_SUCCESS = 3, STATUS_FAILED = 4, STATUS_IMPORTING = 5;

Vue.component('modal-gtfs-import', {
    template: '#template-modal-gtfs-import',
    props: {
        visible: {type: Boolean, default: true},
        uploadFieldName: 'gtfs',
        fileCount: 0,
    },
    computed: {
      isInitial() {
        return app.upload_status === STATUS_INITIAL;
      },
      isSaving() {
        return app.upload_status === STATUS_SAVING;
      },
      isAnalyzing() {
        return app.upload_status === STATUS_ANALYZING;
      },
      isSuccess() {
        return app.upload_status === STATUS_SUCCESS;
      },
      isFailed() {
        return app.upload_status === STATUS_FAILED;
      },
      isImporting() {
        return app.upload_status === STATUS_IMPORTING;
      },
      gtfsImportMap() {
        return app.gtfsImportMap;
      }
    },
    methods: {
      reset: function() {
        // reset form to initial state
        this.uploadedFiles = [];
        this.uploadError = null;
        this.gtfsImportMap = null;
      },
      upload: function(formData, onSuccess, onError) {
        var params = $.param({
            i: enmodal.session_id
        });
        $.ajax({ url: "gtfs_upload?"+params,
            async: true,
            data: formData,
            cache: false,
            contentType: false,
            processData: false,
            method: 'POST',
            success: function(data){
              onSuccess([]);
            }
        });
      },
      save: function(formData) {
        // upload data to the server
        app.upload_status = STATUS_SAVING;

        this.upload(formData, function(x) {
            this.uploadedFiles = [].concat(x);
            app.upload_status = STATUS_ANALYZING;
            var params = $.param({
                i: enmodal.session_id
            });
            $.ajax({ url: "gtfs_analyze?"+params,
              async: true,
              dataType: 'json',
              success: function(data, status) {
                app.upload_status = STATUS_SUCCESS;
                app.gtfsImportMap = data;
                console.log(data);
              }
            });

          }, function(err) {
            this.uploadError = err.response;
            app.upload_status = STATUS_FAILED;
          });
      },
      filesChange: function(fieldName, fileList) {
        // handle file changes
        const formData = new FormData();

        if (!fileList.length) return;

        // append the files to FormData
        Array
          .from(Array(fileList.length).keys())
          .map(x => {
            formData.append(fieldName, fileList[x], fileList[x].name);
          });

        // save it
        this.save(formData);
      },
      // These methods use jQuery hacks for now until component includes checkbox state
      toggleAgency: function(agency) {
        var agencyState = $("input:checkbox.agency[data-agency-id='"+agency+"']").prop("checked");
        var checkBoxes = $("input:checkbox.route[data-agency-id='"+agency+"']");
        checkBoxes.prop("checked", agencyState);
      },
      selectAll: function() {
        console.log("select all");
        $("input:checkbox.agency").prop('checked', true);
        $("input:checkbox.route").prop('checked', true);
      },
      selectNone: function() {
        console.log("select none");
        $("input:checkbox.agency").prop('checked', false);
        $("input:checkbox.route").prop('checked', false);
      },
      start: function() {
        console.log("importing");
        app.upload_status = STATUS_IMPORTING;

        var services = [];
        var lines = [];

        $("input:checkbox.route").each(function() {
          var state = $(this).prop("checked");
          if (state) {
            var agency = $(this).attr("data-agency-id");
            var route = $(this).attr("data-route-id");
            if (services.indexOf(agency) == -1) {
              services.push(agency);
            }
            if (lines.indexOf(route) == -1) {
              lines.push(route);
            }
          }
        });

        console.log(services);
        console.log(lines);

        var params = $.param({
            i: enmodal.session_id
        });
        var data = {
          "services": services,
          "lines": lines
        };
        $.ajax({ url: "gtfs_import?"+params,
          async: true,
          data: JSON.stringify(data),
          dataType: 'json',
          contentType: "application/json",
          method: 'POST',
          success: function(data, status) {
            app.modal = 'none';
            handle_map_data(data);
          }
        });
      },
    },
    mounted() {
      this.reset();
    },
});

Vue.component('modal-json-import', {
    template: '#template-modal-json-import',
    props: {
        visible: {type: Boolean, default: true},
        uploadFieldName: 'json',
        fileCount: 0,
    },
    computed: {
      isInitial() {
        return app.json_import_status === STATUS_INITIAL;
      },
      isSaving() {
        return app.json_import_status === STATUS_SAVING;
      },
      isSuccess() {
        return app.json_import_status === STATUS_SUCCESS;
      },
      isFailed() {
        return app.json_import_status === STATUS_FAILED;
      }
    },
    methods: {
      reset: function() {
        // reset form to initial state
        this.uploadedFiles = [];
        this.uploadError = null;
        this.jsonImportMap = null;
      },
      upload: function(formData, onSuccess, onError) {
      },
      save: function(file) {
        console.log("importing");
        app.json_import_status = STATUS_SAVING;

        var reader = new FileReader();
        reader.onload = (function(theFile) {
            return function(e) {
                // Render thumbnail.
                var data = JSON.parse(e.target.result);
                var jdata = data.map;
                jdata.settings = data.settings;
                handle_map_data(jdata);
                app.json_import_status = STATUS_INITIAL;
                app.modal = 'none';
            };
        })(file);

        var d = reader.readAsText(file);
      },
      filesChange: function(fieldName, fileList) {
        // handle file changes
        const formData = new FormData();

        if (!fileList.length) return;

        // save it
        this.save(fileList[0]);
      },
    },
    mounted() {
      this.reset();
    },
});

var app = new Vue({
    el: '#app',
    data: {
      modal: 'city-picker',
      upload_status: STATUS_INITIAL,
      json_import_status: STATUS_INITIAL,
      gtfsImportMap: null,
      basemapStyle: 'DarkGray',
      basemapLabels: true
    }
});
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
        this.track_width = TRACK_WIDTH;
        this.path = this.generate_path(this.color, this.opacity);
    }

    generate_path(color, opacity) {
        var path;
        if (this.control_points.length === 0) {
            path = L.polyline([L.latLng(this.stop_points[0][0], this.stop_points[0][1]), L.latLng(this.stop_points[1][0], this.stop_points[1][1])], {weight: this.track_width, color: color, opacity: opacity});
        } else if (this.control_points[0].length === 0) {
            path = L.polyline([L.latLng(this.stop_points[0][0], this.stop_points[0][1]), L.latLng(this.stop_points[1][0], this.stop_points[1][1])], {weight: this.track_width, color: color, opacity: opacity});
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
            path = L.curve(bezier_options, curve_options);
        }
        return path;
    }

    regenerate_path() {
        this.path = this.generate_path(this.color, this.opacity);
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
var OUTPUT_WIDTH_PX = 2000;
var OUTPUT_HEIGHT_PX = 2000;
var OUTPUT_DPI = 72;
var OUTPUT_WIDTH_PT = OUTPUT_WIDTH_PX * (0.75);
var OUTPUT_HEIGHT_PT = OUTPUT_HEIGHT_PX * (0.75);

function save_svg(canvas, callback) {
    var draw = SVG('svg-drawing').size(OUTPUT_HEIGHT_PX,OUTPUT_WIDTH_PX);
    
    var svg_overlay = $("div.leaflet-overlay-pane svg").html();
    var svg_markers = $("div.leaflet-stationMarker-pane svg").html();
    
    draw.svg(svg_overlay);
    draw.svg(svg_markers);
    
    var b64 = btoa(draw.svg());
    //var link = $('<a href="data:image/svg+xml;base64,\n'+b64+'" download="enmodal-'+enmodal.session_id+'.svg" style="display:none;"></a>').appendTo('body');
    //link[0].click();


    canvg(document.getElementById('canvas'), draw.svg());
    var d = document.getElementById('canvas').toDataURL("image/png");
    $('#svg-drawing').empty();

    var ctx = canvas.getContext("2d");

	var image = new Image();

	var pixel_bounds = _leaflet_map.getPixelBounds();
	var pixel_origin = _leaflet_map.getPixelOrigin();
	var placement_x = pixel_origin.x - pixel_bounds.min.x;
	var placement_y = pixel_origin.y - pixel_bounds.min.y;

	image.onload = function() {
	    ctx.drawImage(image, placement_x, placement_y);
	    callback(ctx);
	};
	image.src = d;
	//var link = $('<a href="'+d+'" download="enmodal-'+enmodal.session_id+'.png" style="display:none;"></a>').appendTo('body');
    //link[0].click();
}

function create_image(callback) {

	var center = _leaflet_map.getCenter();
	var zoom = _leaflet_map.getZoom();

	$("#map").css("height", OUTPUT_HEIGHT_PX);
	$("#map").css("width", OUTPUT_WIDTH_PX);
	_leaflet_map.invalidateSize();

    enmodal.transit_interface.preview_clear();
    var bounds = enmodal.transit_map.geographic_bounds();
    if (bounds !== null) _leaflet_map.fitBounds(bounds);

	//_leaflet_map.setView(center, zoom);

	$("#map").hide();
	setTimeout(function() {
		leafletImage(_leaflet_map, function(err, canvas) {
		    //var dimensions = _leaflet_map.getSize();
		    save_svg(canvas, function(ctx) {
		    	// Add enmodal footer
		    	ctx.fillStyle = 'rgba(0,0,0,0.75)';
		    	ctx.fillRect(0, 1964, 2000, 36);
		    	ctx.font = '12px sans-serif';
		    	ctx.fillStyle = 'white';
		    	if (enmodal.map_name !== null) {
		    		ctx.fillText(enmodal.map_name, 12, 1988);
		    	}
		    	ctx.textAlign = 'right';
		    	ctx.fillText("created with enmodal -- http://enmodal.co", 1988, 1988);
		    	callback(canvas);
		    });
		});
	}, 1000);
}

function save_image() {
	create_image(function(canvas) {
		var link = $('<a href="'+canvas.toDataURL("image/png")+'" download="enmodal-'+enmodal.session_id+'.png" style="display:none;"></a>').appendTo('body');
    	link[0].click();
    	var ctx = canvas.getContext("2d");
    	ctx.clearRect(0, 0, canvas.width, canvas.height);
    	document.getElementById('canvas').getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
	});
}

function save_pdf(callback) {
	create_image(function(canvas) {
		var pdf = new jsPDF({
			orientation: 'landscape',
			unit: 'pt',
			format: [OUTPUT_WIDTH_PT, OUTPUT_HEIGHT_PT]
		});
		pdf.addImage(canvas.toDataURL("image/jpeg", 1.0), 'JPEG', 0, 0);
		pdf.save('enmodal-'+enmodal.session_id+'.pdf');
    	var ctx = canvas.getContext("2d");
    	ctx.clearRect(0, 0, canvas.width, canvas.height);
    	document.getElementById('canvas').getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
		$("#map").css("height", "");
		$("#map").css("width", "");
    	$("#map").show();
		_leaflet_map.invalidateSize();
		callback();
	});
}
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
            basemap: null,
            basemapLabels: null,
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
            if (this.moving_station_marker !== null) {
                if (this.station_to_merge !== null) {
                    this.merge_stations(this.moving_station_marker.station, this.station_to_merge);
                    //this.get_station_marker_by_station(this.station_to_merge).clear_merge();
                    this.station_to_merge = null;
                } else {
                    this.update_station_info(this.moving_station_marker.station);
                    this.moving_station_marker.update_tooltip();
                    this.moving_station_marker.generate_popup();
                    this.moving_station_marker.marker.openPopup();
                }
                if (this.active_service.mode == "bus") {
                    // draw lines
                    var lines = this.active_service.station_lines(this.moving_station_marker.station);
                    for (var i = 0; i < lines.length; i++) {
                        // force an update
                        var station_pairs = enmodal.transit_interface.get_station_pairs_for_line(lines[i]);
                        for (var j = 0; j < station_pairs.length; j++) {
                            station_pairs[j].undraw_paths();
                            station_pairs[j].paths = [];
                            station_pairs[j].street_path_is_valid = false;
                        }
                        this.draw_line(lines[i], false, true, this.layers.active.line_paths, true, this.active_service);
                    }
                }
                this.moving_station_marker = null;
                this.purge_bad_transfers();
                enmodal.sidebar.update_line_diagram();

                push_undo_buffer();
            }
        });

        this.map.on('mousemove', function(e) {
            enmodal.transit_interface.preview_handler(e);
        });

        this.map.on('moveend', function(e) {
            enmodal.data.draw_active_layer(false);
            /*
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
            */
        });
    }

    draw_map() {
        this.layers.active.station_markers.clearLayers();
        this.layers.active.line_paths.clearLayers();
        this.layers.inactive.station_markers.clearLayers();
        this.layers.inactive.line_paths.clearLayers();

        this.station_markers = [];
        this.purge_station_pairs();

        for (var i = 0; i < enmodal.transit_map.services.length; i++) {
            var service = enmodal.transit_map.services[i];
            var layer;
            if (service == enmodal.transit_interface.active_service) {
                layer = enmodal.transit_interface.layers.active;
            } else {
                layer = enmodal.transit_interface.layers.inactive;
            }
            enmodal.transit_interface.draw_service(service, layer, true, true);
            for (var j = 0; j < service.stations.length; j++) {
                var station = service.stations[j];
                // Update popup.
                var station_marker = enmodal.transit_interface.get_station_marker_by_station(station);
                station_marker.generate_popup();
                station_marker.update_tooltip();
            }
        }
    }
    
    // Draw all stations and lines of a service onto a particular layer
    draw_service(service, layer, active, clear) {
        if (clear) {
            // Clear layer
            layer.station_markers.clearLayers();
            this.station_markers = [];
            layer.line_paths.clearLayers();
            this.layers.inactive.station_markers.clearLayers();
            this.layers.inactive.line_paths.clearLayers();
        }
        var i;
        // Hide other services
        if (active) {
            for (i = 0; i < enmodal.transit_map.services.length; i++) {
                if (enmodal.transit_map.services[i].sid != service.sid) {
                    this.draw_service(enmodal.transit_map.services[i], this.layers.inactive, false, false);
                }
            }
        }
        for (i = 0; i < service.stations.length; i++) {
            var station = service.stations[i];
            this.create_station_marker(station, layer.station_markers, active, false);
        }
        for (i = 0; i < service.lines.length; i++) {
            var line = service.lines[i];
            this.draw_line(line, false, true, layer.line_paths, active, service);
        }
    }

    get_insertion_result(line, stop) {

        // Calculate edge reconfiguration
        var best_edges = [];
        var edges_to_remove = [];
        var best_line_distance = -1;

        var base_length = line.length();
        var temp_length;

        // Iterate twice through all stops on the line.
        for (var i = 0; i < line.stops.length; i++) {
            for (var j = 0; j < line.stops.length; j++) {

                // Only calculate if the stops are different and not the one we just added
                if ((i != j) && (line.stops[i].sid != stop.sid) && (line.stops[j].sid != stop.sid)) {

                    var existing_stops = [line.stops[i], line.stops[j]];

                    var temp_edge_1 = new Edge([stop, line.stops[i]], true);
                    var temp_edge_2 = new Edge([stop, line.stops[j]], true);

                    temp_length = base_length + temp_edge_1.length() + temp_edge_2.length();

                    // Subtract any existing edges between the i- and j- stops
                    var temp_edge_to_remove = null;
                    for (var k = 0; k < line.edges.length; k++) {
                        if (line.edges[k].compare_stops(existing_stops)) {
                            temp_length -= line.edges[k].length();
                            temp_edge_to_remove = line.edges[k];
                        }
                    }

                    if (temp_length < best_line_distance || best_edges.length === 0) {
                        best_line_distance = temp_length;
                        best_edges = [temp_edge_1, temp_edge_2];
                        edges_to_remove = [temp_edge_to_remove];
                    }

                }
            }

            // Compare with the null case for j
            if (line.stops[i].sid != stop.sid) {
                var temp_edge = new Edge([stop, line.stops[i]], true);
                temp_length = base_length + temp_edge.length();

                if (temp_length < best_line_distance || best_edges.length === 0) {
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

    create_station_marker(station, layer, active, open_popup) {
        var station_marker = new StationMarker(station, active);

        if (active) {
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
                        if (enmodal.transit_interface.moving_station_marker === null) {
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
                            enmodal.transit_interface.draw_line(lines[i], true, false, enmodal.transit_interface.layers.active.line_paths, true, enmodal.transit_interface.active_service);
                            var station_pairs = enmodal.transit_interface.get_station_pairs_for_line(lines[i]);
                            for (var j = 0; j < station_pairs.length; j++) {
                                if (!(station_pairs[j] in station_pairs_to_draw)) {
                                    station_pairs_to_draw.push(station_pairs[j]);
                                }
                            }
                        }
                        // Render all station pairs
                        for (i = 0; i < station_pairs_to_draw.length; i++) {
                            station_pairs_to_draw[i].draw();
                        }
                        enmodal.transit_interface.draw_transfers();
                        // Find distance to other stations
                        if (ALLOW_STATION_MERGING) {
                            var mergeable = false;
                            var m_px = enmodal.transit_interface.map.latLngToLayerPoint(L.latLng(center[0], center[1]));
                            if (enmodal.transit_interface.active_service.station_is_end_of_line(station_marker.station)) {
                                for (i = 0; i < enmodal.transit_interface.active_service.stations.length; i++) {
                                    var station = enmodal.transit_interface.active_service.stations[i];
                                    var s_px = enmodal.transit_interface.map.latLngToLayerPoint(L.latLng(station.location[0], station.location[1]));
                                    var d = m_px.distanceTo(s_px);
                                    if (station.sid != station_marker.station.sid) {
                                        // Target is different from the moving station.
                                        if (d < STATION_MERGE_THRESHOLD) {
                                            // Target is within range.
                                            if (enmodal.transit_interface.active_service.station_is_end_of_line(station)) {
                                                // Target is end of a line.
                                                enmodal.transit_interface.get_station_marker_by_station(station).show_merge();
                                                enmodal.transit_interface.get_station_marker_by_station(station).marker.bringToFront();
                                                enmodal.transit_interface.station_to_merge = station;
                                                mergeable = true;
                                            }
                                        } else {
                                            enmodal.transit_interface.get_station_marker_by_station(station).clear_merge();
                                        }
                                    }
                                }
                                if (!mergeable) enmodal.transit_interface.station_to_merge = null;
                            }
                        }
                    }
                });
            });
        }
        var station_marker_found = false;
        
        for (var i = 0; i < this.station_markers.length; i++) {
            if (station == this.station_markers[i].station) {
                this.station_markers[i] = station_marker;
                station_marker_found = true;
            }
        }
        if (!station_marker_found) this.station_markers.push(station_marker);
        station_marker.marker.addTo(layer);
        if (open_popup) station_marker.marker.openPopup();
        return station_marker;
    }
    
    get_station_marker_by_station(station) {
        for (var i = 0; i < this.station_markers.length; i++) {
            if (station.sid == this.station_markers[i].station.sid) {
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
        var params;
        var i, j, k, l;

        // If the line has more than 1 stop, we'll need to reconfigure edges
        if (line.stops.length > 1) {
            var delta = this.get_insertion_result(line, stop);
            best_edges = delta.add;
            var edges_to_remove = delta.remove;

            for (i = 0; i < best_edges.length; i++) {
                // Give it a real ID
                best_edges[i].sid = enmodal.id_factory.id();
                line.add_edge(best_edges[i]);
                
                // Add any impacted lines
                for (j = 0; j < best_edges[i].stops.length; j++) {
                    var station_pairs = this.get_station_pairs(best_edges[i].stops[j].station);
                    for (k = 0; k < station_pairs.length; k++) {
                        var sp_line_lss = station_pairs[k][0].line_spline_segments;
                        for (l = 0; l < sp_line_lss.length; l++) {
                            var lss_line = sp_line_lss[l].line;
                            if (lines_to_draw.indexOf(lss_line) == -1) {
                                lines_to_draw.push(lss_line);
                            }
                        }
                    }
                }
            }
            for (i = 0; i < edges_to_remove.length; i++) {
                for (j = 0; j < edges_to_remove[i].stops.length; j++) {
                    var affected_station = edges_to_remove[i].stops[j].station;
                    var station_lines = this.active_service.station_lines(affected_station);
                    for (k = 0; k < station_lines.length; k++) {
                        if (lines_to_draw.indexOf(station_lines[k]) == -1) {
                            lines_to_draw.push(station_lines[k]);
                        }
                    }
                }
                line.remove_edge(edges_to_remove[i]);
                if (INC_UPDATES) {
                    params = $.param({
                        i: enmodal.session_id,
                        service_id: this.active_service.sid,
                        line_id: line.sid,
                        edge_id: edges_to_remove[i].sid
                    });
                    $.ajax({ url: "edge_remove?"+params,
                        async: ASYNC_REQUIRED,
                        dataType: 'json',
                        success: check_server_error
                    });
                }
            }
        }
        
        // Sync with server
        params = $.param({
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
                check_server_error(data);
                station.name = data.name;
                if ("locality" in data) {
                    station.locality = data.locality;
                }
                if ("neighborhood" in data) {
                    station.neighborhood = data.neighborhood;
                }
                if ("region" in data) {
                    station.region = data.region;
                }
                // Update popup.
                var station_marker = enmodal.transit_interface.get_station_marker_by_station(station);
                station_marker.generate_popup();
                station_marker.update_tooltip();
                enmodal.sidebar.update_line_diagram();
                
                params = $.param({
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
                            check_server_error(data);
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
                                    success: check_server_error
                                });
                            }
                        }
                    });
                }
            }
        });

        var station_marker = this.create_station_marker(station, this.layers.active.station_markers, true, true);
        
        for (i = 0; i < lines_to_draw.length; i++) {
            this.draw_line(lines_to_draw[i], false, true, this.layers.active.line_paths, true, this.active_service);
        }
        
        this.purge_station_pairs();
        enmodal.data.get_ridership();
        enmodal.sidebar.update_line_diagram();
        
        push_undo_buffer();

        return station;
    }
    
    clean_edges(line) {
        // Check for self-edges
        var edge;
        var edges_removed = line.remove_self_edges();
        var params;
        for (var j = 0; j < edges_removed.length; j++) {
            edge = edges_removed[j];
            if (INC_UPDATES) {
                params = $.param({
                    i: enmodal.session_id,
                    service_id: this.active_service.sid,
                    line_id: line.sid,
                    edge_id: edge.sid
                });
                $.ajax({ url: "edge_remove?"+params,
                    async: ASYNC_REQUIRED,
                    dataType: 'json',
                    success: check_server_error
                });
            }
        }
        // Check for duplicate edges
        edges_removed = line.remove_duplicate_edges();
        for (j = 0; j < edges_removed.length; j++) {
            edge = edges_removed[j];
            if (INC_UPDATES) {
                params = $.param({
                    i: enmodal.session_id,
                    service_id: this.active_service.sid,
                    line_id: line.sid,
                    edge_id: edge.sid
                });
                $.ajax({ url: "edge_remove?"+params,
                    async: ASYNC_REQUIRED,
                    dataType: 'json',
                    success: check_server_error
                });
            }
        }
    }
    
    add_edge(service, line, edge) {
        line.add_edge(edge);
        if (INC_UPDATES) {
            var params = $.param({
                i: enmodal.session_id,
                service_id: service.sid,
                line_id: line.sid,
                stop_1_id: edge.stops[0].sid,
                stop_2_id: edge.stops[1].sid,
                edge_id: edge.sid
            });
            $.ajax({ url: "edge_add?"+params,
                async: ASYNC_REQUIRED,
                dataType: 'json',
                success: function(data, status) {
                    check_server_error(data);
                }
            });
        }
    }
    
    merge_stations(station_to_remove, station_to_keep) {
        // For all lines
        for (var i = 0; i < this.active_service.lines.length; i++) {
            var line = this.active_service.lines[i];
            // Find relevant stops
            var stop_to_remove = null;
            var stop_to_keep = null;
            for (var j = 0; j < line.stops.length; j++) {
                var stop = line.stops[j];
                if (stop.station.sid == station_to_remove.sid) {
                    stop_to_remove = stop;
                }
                if (stop.station.sid == station_to_keep.sid) {
                    stop_to_keep = stop;
                }
            }
            // If stop to remove exists but not stop to keep 
            // TODO FIX this!!
            /*
            if (stop_to_remove != null && stop_to_keep == null) {
                // Create a stop on the station to keep
                var new_stop = new Stop(station_to_keep, false);
                line.add_stop(new_stop);
                if (INC_UPDATES) {
                    var params = $.param({
                        i: enmodal.session_id,
                        service_id: this.active_service.sid,
                        line_id: line.sid,
                        station_id: station_to_keep.sid,
                        stop_id: new_stop.sid
                    });
                    var line_to_use = line;
                    var stop_1_to_use = stop_to_remove;
                    var stop_2_to_use = new_stop;
                    $.ajax({ url: "stop_add?"+params,
                        async: ASYNC_REQUIRED,
                        dataType: 'json',
                        success: function(data, status) {
                            // Connect with an edge
                            var new_edge = new Edge([stop_1_to_use, stop_2_to_use]);
                            enmodal.transit_interface.add_edge(enmodal.transit_interface.active_service, line_to_use, new_edge);
                            enmodal.transit_interface.clean_edges(line_to_use);
                        }
                    });
                }
            }
            */
            
            // If both stops exists on this line
            if (stop_to_remove !== null && stop_to_keep !== null) {
                // Connect with an edge
                var new_edge = new Edge([stop_to_remove, stop_to_keep]);
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
                        success: check_server_error
                    });
                }
            }
            
            this.clean_edges(line);
            
        }
        
        // remove station with forced closure
        this.remove_station(station_to_remove.sid, true);
        
        
        // draw lines
        var lines = this.active_service.station_lines(station_to_keep);
        for (i = 0; i < lines.length; i++) {
            this.draw_line(lines[i], false, true, this.layers.active.line_paths, true, this.active_service);
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
                check_server_error(data);
                station.name = data.name;
                if ("locality" in data) {
                    station.locality = data.locality;
                }
                if ("neighborhood" in data) {
                    station.neighborhood = data.neighborhood;
                }
                if ("region" in data) {
                    station.region = data.region;
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
                check_server_error(data);
                enmodal.data.get_ridership();
            }
        });
    }

    add_stop_to_station(id) {

        var station = this.active_service.get_station_by_id(id);

        if (station === null) return;

        var stop = new Stop(station);

        this.active_line.add_stop(stop);
        
        var lines_to_draw = [this.active_line];
        var best_edges = [];
        var i, j, k;
        var params;
        var affected_station, station_lines;
        
        // If the line has more than 1 stop, we'll need to reconfigure edges
        if (this.active_line.stops.length > 1) {
            var delta = this.get_insertion_result(this.active_line, stop);
            best_edges = delta.add;
            var edges_to_remove = delta.remove;

            for (i = 0; i < best_edges.length; i++) {
                best_edges[i].sid = _id_factory.id();
                for (j = 0; j < best_edges[i].stops.length; j++) {
                    affected_station = best_edges[i].stops[j].station;
                    station_lines = this.active_service.station_lines(affected_station);
                    for (k = 0; k < station_lines.length; k++) {
                        if (lines_to_draw.indexOf(station_lines[k]) == -1) {
                            lines_to_draw.push(station_lines[k]);
                        }
                    }
                }
                this.active_line.add_edge(best_edges[i]);
            }
            for (i = 0; i < edges_to_remove.length; i++) {
                for (j = 0; j < edges_to_remove[i].stops.length; j++) {
                    affected_station = edges_to_remove[i].stops[j].station;
                    station_lines = this.active_service.station_lines(affected_station);
                    for (k = 0; k < station_lines.length; k++) {
                        if (lines_to_draw.indexOf(station_lines[k]) == -1) {
                            lines_to_draw.push(station_lines[k]);
                        }
                    }
                }
                this.active_line.remove_edge(edges_to_remove[i]);
                if (INC_UPDATES) {
                    params = $.param({
                        i: enmodal.session_id,
                        service_id: this.active_service.sid,
                        line_id: this.active_line.sid,
                        edge_id: edges_to_remove[i].sid
                    });
                    $.ajax({ url: "edge_remove?"+params,
                        async: ASYNC_REQUIRED,
                        dataType: 'json',
                        success: check_server_error
                    });
                }
            }
        }
        
        
        if (INC_UPDATES) {
            params = $.param({
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
                            success: check_server_error
                        });
                    }
                }
            });
        }

        
        for (i = 0; i < this.station_markers.length; i++)  {
            if (this.station_markers[i].station.sid == station.sid) {
                this.station_markers[i].generate_popup();
            }
        }

        for (i = 0; i < lines_to_draw.length; i++) {
            this.draw_line(lines_to_draw[i], false, true, this.layers.active.line_paths, true, this.active_service);
        }
        
        this.purge_station_pairs();
        
        enmodal.data.get_ridership();
        enmodal.sidebar.update_line_diagram();

        push_undo_buffer();

    }

    remove_station(id, force_closure) {

        var impacted_lines = [];
        var impacted_stops = [];

        var i, j, k, l, m, n;
        var line, edge, stop;
        var params;

        // Remove all stops that use this station.
        for (i = 0; i < this.active_service.lines.length; i++) {
            line = this.active_service.lines[i];
            for (j = 0; j < line.stops.length; j++) {
                stop = line.stops[j];
                if (stop.station.sid == id) {
                    // Found a match. Remove the stop
                    impacted_stops.push(stop);
                    line.stops.splice(j, 1);

                    if (INC_UPDATES) {
                        params = $.param({
                            i: enmodal.session_id,
                            service_id: this.active_service.sid,
                            line_id: line.sid,
                            stop_id: stop.sid
                        });
                        $.ajax({ url: "stop_remove?"+params,
                            async: ASYNC_REQUIRED,
                            dataType: 'json',
                            success: check_server_error
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

        for (i = 0; i < impacted_lines.length; i++) {
            line = impacted_lines[i];
            var impacted_edges = [];
            for (j = 0; j < line.edges.length; j++) {
                edge = line.edges[j];
                for (k = 0; k < impacted_stops.length; k++) {
                    if (edge.has_stop(impacted_stops[k])) {
                        impacted_edges.push(edge);
                        // Add any impacted lines
                        for (l = 0; l < edge.stops.length; l++) {
                            var station_pairs = this.get_station_pairs(edge.stops[l].station);
                            for (m = 0; m < station_pairs.length; m++) {
                                var sp_line_lss = station_pairs[m][0].line_spline_segments;
                                for (n = 0; n < sp_line_lss.length; n++) {
                                    var sp_line = sp_line_lss[n].line;
                                    if (impacted_lines.indexOf(sp_line) == -1) {
                                        impacted_lines.push(sp_line);
                                    }
                                }
                            }
                        }
                        line.remove_edge(edge);
                        params = $.param({
                            i: enmodal.session_id,
                            service_id: this.active_service.sid,
                            line_id: line.sid,
                            edge_id: edge.sid
                        });
                        if (INC_UPDATES) {
                            $.ajax({ url: "edge_remove?"+params,
                                async: ASYNC_REQUIRED,
                                dataType: 'json',
                                success: check_server_error
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
                for (l = 0; l < impacted_edges.length; l++) {
                    edge = impacted_edges[l];
                    if (edge.sid != central_edge.sid) {
                        var spoke_stop = edge.stops[0];
                        if (spoke_stop.station.sid == id) {
                            spoke_stop = edge.stops[1];
                        }
                        if (spoke_stop.sid != central_stop.sid) {
                            if (!line.path_between_stops(spoke_stop, central_stop) || force_closure) {
                                var new_edge = new Edge([central_stop, spoke_stop]);
                                line.add_edge(new_edge);
                                if (INC_UPDATES) {
                                    params = $.param({
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
                                        success: check_server_error
                                    });
                                }
                            }
                        }
                    }
                }

                // Check for orphaned stops
                for (l = 0; l < line.stops.length; l++) {
                    stop = line.stops[l];
                    var is_orphan = true;
                    for (m = 0; m < line.edges.length; m++) {
                        edge = line.edges[m];
                        if (edge.has_stop(stop)) {
                            is_orphan = false;
                        }
                    }
                    if (is_orphan) {
                        var delta = this.get_insertion_result(line, stop);
                        var best_edges = delta.add;
                        var edges_to_remove = delta.remove;

                        for (m = 0; m < best_edges.length; m++) {
                            best_edges[m].sid = NS_id.id();
                            line.add_edge(best_edges[m]);
                            if (INC_UPDATES) {
                                params = $.param({
                                    i: enmodal.session_id,
                                    service_id: this.active_service.sid,
                                    line_id: line.sid,
                                    stop_1_id: best_edges[m].stops[0].sid,
                                    stop_2_id: best_edges[m].stops[1].sid,
                                    edge_id: best_edges[m].sid
                                });
                                $.ajax({ url: "edge_add?"+params,
                                    async: ASYNC_REQUIRED,
                                    dataType: 'json',
                                    success: check_server_error
                                });
                            }
                        }
                        for (m = 0; m < edges_to_remove.length; m++) {
                            line.remove_edge(edges_to_remove[m]);
                            if (INC_UPDATES) {
                                params = $.param({
                                    i: enmodal.session_id,
                                    service_id: this.active_service.sid,
                                    line_id: line.sid,
                                    edge_id: edges_to_remove[m].sid
                                });
                                $.ajax({ url: "edge_remove?"+params,
                                    async: ASYNC_REQUIRED,
                                    dataType: 'json',
                                    success: check_server_error
                                });
                            }
                        }
                    }
                }
                
                this.clean_edges(line);
            }
        }


        // Remove this station.
        for (i = 0; i < this.active_service.stations.length; i++) {
            var station = this.active_service.stations[i];
            if (station.sid == id) {
                this.active_service.stations.splice(i, 1);
                if (INC_UPDATES) {
                    params = $.param({
                        i: enmodal.session_id,
                        service_id: this.active_service.sid,
                        station_id: station.sid
                    });
                    $.ajax({ url: "station_remove?"+params,
                        async: ASYNC_REQUIRED,
                        dataType: 'json',
                        success: check_server_error
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
        for (i = 0; i < this.station_markers.length; i++) {
            var station_marker = this.station_markers[i];
            if (station_marker.station.sid == id) {
                this.layers.active.station_markers.removeLayer(station_marker.marker);
                this.station_markers.splice(i, 1);
            }
        }
        
        // Remove all StationPairs that have this station.
        
        for (i = this.station_pairs.length - 1; i >= 0; i--) {
            var station_pair = this.station_pairs[i];
            if (station_pair.stations[0].sid == id || station_pair.stations[1].sid == id) {
                this.station_pairs[i].undraw();
                this.station_pairs.splice(i, 1);
            }
        }

        // Redraw all impacted lines.
        for (i = 0; i < impacted_lines.length; i++) {
            this.draw_line(impacted_lines[i], false, true, this.layers.active.line_paths, true, this.active_service);
        }
        //this.layers.active.station_markers.bringToFront();

        enmodal.data.get_ridership();
        enmodal.sidebar.update_line_diagram();

        push_undo_buffer();

    }
    
    remove_line_from_station(station_id, line_id) {

        var line = this.active_service.get_line_by_id(line_id);
        var edge;
        var stop;
        var station = this.active_service.get_station_by_id(station_id);
        var stops = line.get_stops_by_station(station);
        var impacted_lines = this.active_service.station_lines(station);
        var impacted_edges;

        var i, j, k, l, m;
        var params;

        if (impacted_lines.length == 1) {
            this.remove_station(station_id, false);
            return 0;
        }
        
        for (i = 0; i < stops.length; i++) {
            stop = stops[i];
            line.remove_stop(stop);
            
            if (INC_UPDATES) {
                params = $.param({
                    i: enmodal.session_id,
                    service_id: this.active_service.sid,
                    line_id: line.sid,
                    stop_id: stop.sid
                });
                $.ajax({ url: "stop_remove?"+params,
                    async: ASYNC_REQUIRED,
                    dataType: 'json',
                    success: check_server_error
                });
            }

            // Remove all edges that use this station.

            impacted_edges = [];
            for (j = 0; j < line.edges.length; j++) {
                edge = line.edges[j];
                if (edge.has_stop(stop)) {
                    impacted_edges.push(edge);
                    line.remove_edge(edge);
                    if (INC_UPDATES) {
                        params = $.param({
                            i: enmodal.session_id,
                            service_id: this.active_service.sid,
                            line_id: line.sid,
                            edge_id: edge.sid
                        });
                        $.ajax({ url: "edge_remove?"+params,
                            async: ASYNC_REQUIRED,
                            dataType: 'json',
                            success: check_server_error
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
            for (l = 0; l < impacted_edges.length; l++) {
                edge = impacted_edges[l];
                if (edge.sid != central_edge.sid) {
                    var spoke_stop = edge.stops[0];
                    if (spoke_stop.station.sid == station_id) {
                        spoke_stop = edge.stops[1];
                    } 
                    if (spoke_stop.sid != central_stop.sid) {
                        var new_edge = new Edge([central_stop, spoke_stop]);
                        line.add_edge(new_edge);
                        if (INC_UPDATES) {
                            params = $.param({
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
                                success: check_server_error
                            });
                        }
                    }
                }
            }

            // Check for orphaned stops
            for (l = 0; l < line.stops.length; l++) {
                stop = line.stops[l];
                var is_orphan = true;
                for (m = 0; m < line.edges.length; m++) {
                    edge = line.edges[m];
                    if (edge.has_stop(stop)) {
                        is_orphan = false;
                    }
                }
                if (is_orphan) {
                    var delta = this.get_insertion_result(line, stop);
                    var best_edges = delta.add;
                    var edges_to_remove = delta.remove;

                    for (i = 0; i < best_edges.length; i++) {
                        best_edges[i].sid = NS_id.id();
                        line.add_edge(best_edges[i]);
                        if (INC_UPDATES) {
                            params = $.param({
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
                                success: check_server_error
                            });
                        }
                    }
                    for (i = 0; i < edges_to_remove.length; i++) {
                        line.remove_edge(edges_to_remove[i]);
                        if (INC_UPDATES) {
                            params = $.param({
                                i: enmodal.session_id,
                                service_id: this.active_service.sid,
                                line_id: line.sid,
                                edge_id: edges_to_remove[i].sid
                            });
                            $.ajax({ url: "edge_remove?"+params,
                                async: ASYNC_REQUIRED,
                                dataType: 'json',
                                success: check_server_error
                            });
                        }
                    }
                }
            }
        }

        // Redraw all impacted lines.
        for (i = 0; i < impacted_lines.length; i++) {
            this.draw_line(impacted_lines[i], false, true, this.layers.active.line_paths, true, this.active_service);
        }
        // Refresh the marker
        this.get_station_marker_by_station(station).generate_popup();

        enmodal.data.get_ridership();
        enmodal.sidebar.update_line_diagram();

        push_undo_buffer();

    }
    
    update_station_markers(line) {
        for (var i = 0; i < line.stops.length; i++) {
            var station = line.stops[i].station;
            var station_marker = this.get_station_marker_by_station(station);
            var num_colors = num_unique_colors(this.active_service.station_lines(station));
            station_marker.set_radius(Math.max(num_colors, 2) * 2.5);
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
                return [station_pair, 0];
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
     * mm : true if this is being called from a mousemove event
     * render : true if the station_pairs should actually be rendered (or just updated)
     * layer : layer on which to draw
     * active : true if the line is part of an active service
     * service : service the line is part of
     **/
    draw_line(line, mm, render, layer, active, service) {
        //console.log("draw line "+line.name);
        var i, j, k;
        var station_1, station_2, station_pair, spr, station_pair_polarity;

        var line_path;
        if (line.sid in this.line_paths) {
            line_path = this.line_paths[line.sid];
        } else {
            line_path = new LinePath();
            this.line_paths[line.sid] = line_path;
        }

        // Remove existing edge paths.
        for (i = 0; i < line_path.edge_paths.length; i++) {
            this.layers.active.line_paths.removeLayer(line_path.edge_paths[i].path);
        }
        
        // Clear all station pairs.
        for (i = 0; i < this.station_pairs.length; i++) {
            if (this.station_pairs[i].has_line(line)) {
                this.station_pairs[i].clear_spline_segment_for_line(line);
                //this.station_pairs[i].clear_spline_segments();
                this.station_pairs[i].generate_paths(active);
                //this.station_pairs[i].undraw(layer);
                if (render) this.station_pairs[i].draw(layer);
            }
        }
        
        var station_pairs_to_draw = [];

        if (line.stops.length > 1) {
            //this.update_edge_paths(line);
            //this.tweak_line_path(line);
            var station_drawmap = service.station_drawmap(line);
            //console.log(station_drawmap);
            for (i = 0; i < station_drawmap.length; i++) {
                var branch = station_drawmap[i];
                var branch_coordinates = [];
                var station_id_to_branch_coordinates = {};
                // Convert branch to coordinates
                var coordinate_index = 0;
                for (j = 0; j < branch.length; j++) {
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
                        station_1 = branch[j];
                        station_2 = branch[j+1];
                        if (this.has_station_pair(station_1, station_2)) {
                            spr = this.get_station_pair(station_1, station_2);
                            station_pair = spr[0];
                            // Push pins.
                            var pins_to_push = [];
                            for (k = 0; k < station_pair.pins.length; k++) {
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
                
                for (j = 0; j < branch.length - 1; j++) {
                    station_1 = branch[j];
                    station_2 = branch[j+1];
                    
                    if (this.has_station_pair(station_1, station_2)) {
                        spr = this.get_station_pair(station_1, station_2);
                        station_pair = spr[0];
                        station_pair_polarity = spr[1];
                    } else {
                        station_pair = new StationPair(service, [station_1, station_2], this.layers.active.line_paths);
                        this.station_pairs.push(station_pair);
                        station_pair_polarity = 0;
                    }
                    var bci = station_id_to_branch_coordinates[station_1.sid][0];
                    var bci_end = station_id_to_branch_coordinates[station_2.sid][0];
                    
                    var sss = [];
                    for (k = 0; k < bci_end-bci; k++) {
                        if (bci+k+1 <= spline.centers.length) {
                            var centers = [];
                            var controls = [];
                            centers.push(new BezierCenter(branch_coordinates[bci+k].x, branch_coordinates[bci+k].y));
                            if (station_pair_polarity === 0) {
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
                    
                    station_pair.generate_paths(active);
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
            for (i = 0; i < station_pairs_to_draw.length; i++) {
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
            options.dashArray = '10,10';
            options.opacity = TRANSFER_PREVIEW_OPACITY;
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
            if (this.active_service.get_station_by_id(station_pair.stations[0].sid) === null || 
                this.active_service.get_station_by_id(station_pair.stations[1].sid) === null ||
                this.active_service.has_edge_for_stations(station_pair.stations[0], station_pair.stations[1]) === false ||
                station_pair.lines().length === 0) {
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
        var p, p_px, d, l;
        for (var j = 0; j < this.station_pairs.length; j++) {
            var station_pair = this.station_pairs[j];
            if (station_pair.service == this.active_service) {
                p = station_pair.project_pin(lat, lng);
                if (p !== null) {
                    if (best_p === null || p.d < best_distance) {
                        best_p = p;
                        best_distance = p.d;
                        best_sid = station_pair.sid;
                        best_station_pair = station_pair;
                    }
                    d = m_px.distanceTo(this.map.latLngToLayerPoint(L.latLng(p.x, p.y)));
                    if (d < PIN_DISTANCE_TO_SHOW_PINS) {
                        sids_for_showing_pins.push(station_pair.sid);
                    }
                    
                    if (DEBUG_PIN_PROJECTIONS) {
                        var weight = 1;
                        if (d < PIN_DISTANCE_TO_SHOW_PINS) weight = 2;
                        l = L.polyline([L.latLng([p.x, p.y]), L.latLng(lat, lng)], {weight: weight, color: '#00f'});
                        this.layers.preview.addLayer(l);
                    }
                }
            }
        }
            
        var show_pin_icon = false;
        if (best_p !== null) {
            // Convert best_p distance to pixels
            m_px = this.map.latLngToLayerPoint(L.latLng(lat, lng));
            p_px = this.map.latLngToLayerPoint(L.latLng(best_p.x, best_p.y));
            d = m_px.distanceTo(p_px);
            show_pin_icon = d < PIN_DISTANCE_MIN;
        }
        if (DEBUG_PIN_PROJECTIONS && best_p !== null) {
            l = L.polyline([L.latLng([best_p.x, best_p.y]), L.latLng(lat, lng)], {weight: 1, color: '#f00'});
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

        var i, j;
        var station;
        
        // Find nearest station?

        // Find the nearest station
        var m_px = this.map.latLngToLayerPoint(L.latLng(lat, lng));
        var best_distance = 0;
        var best_station = null;
        for (i = 0; i < enmodal.transit_interface.active_service.stations.length; i++) {
            station = enmodal.transit_interface.active_service.stations[i];
            var distance = m_px.distanceTo(this.map.latLngToLayerPoint(L.latLng(station.location[0], station.location[1])));

            if (best_distance > distance || best_station === null) {
                best_station = station;
                best_distance = distance;
            }
        }
        
        // Project onto curve?
        var pin_projection = this.pin_projection(lat, lng);
        //console.log(pin_projection);
        
        if (!this.dragging_pin) {
            if (pin_projection[0] && best_distance > PIN_DISTANCE_FROM_STATION_MIN) {
                var m = L.marker([pin_projection[1].x, pin_projection[1].y], {icon: PIN_ICON});
                m.id = "pin-preview";
                this.preview_line_pin_marker = m;
                this.layers.preview.addLayer(m);
            } else {
                // Create dummy station and stop
                station = new Station("preview", [lat, lng], true);
                var stop = new Stop(station, true);

                // Get the EdgeDelta from this new stop
                var delta = this.get_insertion_result(line, stop);

                // Draw the edge path
                for (j = 0; j < delta.add.length; j++) {
                    var edge = delta.add[j];

                    var stop_points = [[edge.stops[0].station.location[0], edge.stops[0].station.location[1]], [edge.stops[1].station.location[0], edge.stops[1].station.location[1]]];
                    var edge_path = new EdgePath(edge.sid, stop_points, [], [], line.color_bg, 0.2);

                    this.preview_paths.push(edge_path);
                    this.layers.preview.addLayer(edge_path.path);
                }
            }
        }
        
        // Show pins for station pairs
        //var station_pairs = this.get_station_pairs_for_line(line);
        for (j = 0; j < this.station_pairs.length; j++) {
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
                if (this.active_line !== null) {
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
    
    settings() {
        var station_pair_json = this.station_pairs;
        return {"station_pairs": station_pair_json};
    }
}

function sortNumber(a,b) {
    return a - b;
}

class LineDelta {

    constructor(add, remove) {
        this.add = add;
        this.remove = remove;
    }

}

function push_undo_buffer() {
    if (_undo_index < _undo_buffer.length - 1) {
        _undo_buffer.splice(_undo_index, _undo_buffer.length - _undo_index - 1);
    }
    if (_undo_buffer.length == UNDO_BUFFER_SIZE) {
        _undo_buffer.splice(0, 1);
    }

    var map_json = enmodal.transit_map.to_json();
    var m = JSON.parse(map_json);
    m.settings = enmodal.transit_interface.settings();

    var j = JSON.stringify(m);

    _undo_buffer.push(j);
    _undo_index = _undo_buffer.length - 1;
}

function undo() {
    if (_undo_index === null) {
        _undo_index = _undo_buffer.length;
    }
    if (_undo_index <= 0) return;

    _undo_index -= 1;

    var j = _undo_buffer[_undo_index];

    var jdata = JSON.parse(j);
    handle_map_data(jdata);
}

function redo() {
    if (_undo_index === null) return;
    if (_undo_index >=  _undo_buffer.length - 1) return;

    _undo_index += 1;

    var j = _undo_buffer[_undo_index];

    var jdata = JSON.parse(j);
    handle_map_data(jdata);
}

function check_server_error(data) {
    if ("error" in data) {
        console.log(data.error);
        if (data.error == "Invalid session") {
            app.modal = 'session-expired';
            setTimeout(function() {
                location.reload();
            }, 5000);
        }
    }
}

function delete_station_event(e) {
    var station_id = parseInt($(this).attr('transit-station-id'));
    enmodal.transit_interface.remove_station(station_id, false);
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
class StationMarker {

    constructor(station, active) {
        this.station = station;
        this.active = active;
        this.tooltip_options = {direction: 'top', offset: L.point(0, -5), className: 'station-marker-tooltip'};
        this.marker = this.generate_marker();
        this.popup = L.popup({'className': 'station-popup'});
        this.merge_pending = false;
        this.marker.bindPopup(this.popup);
        this.radius = MARKER_RADIUS_DEFAULT;
        this.generate_popup();
    }

    generate_marker() {
        var latlng = L.latLng(this.station.location[0], this.station.location[1]);
        var opacity = 1.0;
        if (!this.active) opacity = INACTIVE_OPACITY;
        var marker = L.circleMarker(latlng, {draggable: true, color: "black", opacity: opacity, fillColor: "white", fillOpacity: opacity, zIndexOffset: 100, pane: "stationMarkerPane"}).setRadius(this.radius).bindTooltip(this.station.name, this.tooltip_options);
        if (this.active) {
            marker.on('click', function(event) {
                if (enmodal.transit_interface.active_tool == "transfer") {
                    marker.unbindPopup();
                    var station = enmodal.transit_interface.get_station_marker_by_marker(marker).station;
                    if (station != enmodal.transit_interface.active_transfer_station) {
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
                                "coordinates": [enmodal.transit_interface.active_transfer_station.location[1], enmodal.transit_interface.active_transfer_station.location[0]]
                            }
                        };

                        var distance = turf.distance(station_loc, transfer_loc, "miles");
                        if (distance <= MAX_TRANSFER_DISTANCE_MILES) {
                            // Create the transfer
                            enmodal.transit_interface.active_service.add_transfer(station, enmodal.transit_interface.active_transfer_station);
                            enmodal.transit_interface.draw_transfers();
                        }
                        enmodal.transit_interface.active_tool = "station";
                        enmodal.transit_interface.preview_clear();
                    }
                }
            });
        }
        return marker;
    }
    
    set_radius(r) {
        this.radius = r;
        this.marker.setRadius(r);
    }
    
    show_merge() {
        this.marker.setRadius(this.radius + MARKER_MERGE_DELTA);
        this.merge_pending = true;
    }
    
    clear_merge() {
        if (this.merge_pending) {
            this.marker.setRadius(this.radius);
            this.merge_pending = false;
        }
    }

    generate_popup() {
        var content = '<div class="station-name" id="station-'+this.station.sid.toString()+'" data-balloon="Click to rename" data-balloon-pos="left">'+this.station.name;
        content += '   <i class="fa fa-pencil" style="margin-left: 5px;" aria-hidden="true"></i>';
        content += '</div>';
        content += '<div class="station-content"><div class="station-info">'+this.station.neighborhood+'<br />';
        content += '<i class="fa fa-user" aria-hidden="true"></i> <span id="stationriders-'+this.station.sid.toString()+'">';
        if (this.station.ridership == -1) {
            content += '...';
        } else {
            content += Math.round(this.station.ridership).toString();
        }
        content += '</span></div>';
        content += '<div class="station-info subway-lines">';

        var lines = enmodal.transit_interface.active_service.station_lines(this.station);
        var active_line_is_different = true;
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            content += '<div transit-station-id="'+this.station.sid.toString()+'" transit-line-id="'+line.sid.toString()+'" class="subway-line-long subway-deletable station-popup-line-marker" style="background-color: '+line.color_bg+'; color: '+line.color_fg+';" data-balloon="Remove" data-balloon-pos="down"><div class="content">'+line.name+'</div></div>';
            if (line.sid == enmodal.transit_interface.active_line.sid) {
                active_line_is_different = false;
            }
        }
        if (enmodal.transit_interface.active_line === null) active_line_is_different = false;
        content += ' </div>';

        if (active_line_is_different) {
            content += '<div class="station-content-button station-build line-'+enmodal.transit_interface.active_line.sid.toString()+'" id="'+this.station.sid.toString()+'">Build <div class="subway-line-long subway-line-mini" style="background-color: '+enmodal.transit_interface.active_line.color_bg+'; color: '+enmodal.transit_interface.active_line.color_fg+';"><div class="content">'+enmodal.transit_interface.active_line.name+'</div></div></div>';
        }

        content += '<div class="station-content-button station-delete" transit-station-id="'+this.station.sid.toString()+'">Delete</div>';
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
function session_new() {
    // Initialize server
    $.ajax({ url: "session",
        async: false,
        dataType: 'json',
        success: function(data, status) {
            enmodal.public_key = data.public_key;
            enmodal.session_id = data.private_key;
            window.history.pushState("", "", "?id="+enmodal.session_id);
            enmodal.sharing.update(data.public_key, data.private_key);
        }
    });
        
    // Initialize service
    var service = new Service("MTA");
    service.mode = "heavy_rail";
    enmodal.transit_map.add_service(service);
    enmodal.transit_interface.active_service = service;
    enmodal.sidebar.update_service_selector(enmodal.transit_interface.active_service.sid);
    enmodal.sidebar.refresh_service_editor();
    var params = $.param({
        i: enmodal.session_id,
        service_id: service.sid,
        name: service.name
    });
    $.ajax({ url: "service_add?"+params,
        async: false,
        dataType: 'json',
        success: function(data, status) {
        }
    });
}

function handle_map_data(jdata) {
    console.log(jdata);
    
    enmodal.transit_interface.station_pairs = [];

    enmodal.transit_map.sid = jdata.sid;
    enmodal.transit_map.from_json(jdata);
    
    if (enmodal.transit_map.services.length === 0) {
        session_new();
    } else {

        enmodal.transit_interface.active_service = enmodal.transit_map.primary_service();
        enmodal.transit_interface.active_line = enmodal.transit_map.primary_service().lines[0];
        enmodal.sidebar.update_service_selector(enmodal.transit_interface.active_service.sid, true);
        enmodal.sidebar.refresh_service_editor();
        enmodal.sidebar.update_line_selector(enmodal.transit_interface.active_line.sid);
        enmodal.sidebar.update_line_editor();
        enmodal.sidebar.refresh_line_editor();
        enmodal.sidebar.update_line_diagram();
        
        // Updating service selector is enough to draw the service.
        //enmodal.transit_interface.draw_service(enmodal.transit_interface.active_service, enmodal.transit_interface.layers.active, true, true);

        // use user settings where appropriate
        var user_settings = jdata.settings;
        for (var i = 0; i < user_settings.station_pairs.length; i++) {
            var sp = user_settings.station_pairs[i];
            var station_1 = enmodal.transit_map.get_station_by_id(sp.station_ids[0]);
            var station_2 = enmodal.transit_map.get_station_by_id(sp.station_ids[1]);
            var sp_real = enmodal.transit_interface.get_station_pair(station_1, station_2);
            if (sp_real !== null) {
                for (var j = 0; j < sp.pins.length; j++) {
                    sp_real[0].add_pin(sp.pins[j].location[0], sp.pins[j].location[1]);
                }
            }
        }
        
        enmodal.transit_interface.draw_transfers();
        //enmodal.transit_interface.map.closePopup();
        var bounds = enmodal.transit_map.geographic_bounds();
        if (bounds !== null) enmodal.leaflet_map.fitBounds(bounds);
        enmodal.data.get_ridership();
    }
}

function session_load() {
    // Initialize session and map
    var params = $.param({
        i: enmodal.session_id
    });
    $.ajax({ url: "session_load?"+params,
        async: false,
        success: function(data, status) {
            
            //console.log(data);
            var j = JSON.parse(data);
            //console.log(j);
            if (j.error !== undefined) {
                session_new();
            } else {
                var jdata = JSON.parse(j.data);
                handle_map_data(jdata);
                
                window.history.pushState("", "", "?id="+enmodal.session_id);
                enmodal.public_key = j.public_key;
                enmodal.session_id = j.private_key;
                if (j.title !== null) {
                    $("#map-title-inner").html(j.title + '  <i class="fa fa-pencil" style="margin-left: 5px;" aria-hidden="true"></i>');
                    enmodal.map_name = j.title;
                }
                
                $("#starter-city-picker").hide();
                $("#starter").hide();
                $("#options").show();
            }
        }
    });

}

function session_save() {
    var params = $.param({
        i: enmodal.session_id
    });
    $("#tool-save").html('<i class="fa fa-spinner fa-spin fa-1x fa-fw"></i>');
    $.ajax({ url: "session_push?"+params,
        async: true,
        type: "POST",
        data: LZString.compressToUTF16(session_json()),
        dataType: 'text',
        success: function(data, status) {
            var params = $.param({
                i: enmodal.session_id
            });
            $.ajax({ url: "session_save?"+params,
                async: true,
                dataType: 'json',
                success: function(data, status) {
                    if (data.result == "OK") {
                        $("#tool-save").html('Save');
                        $("#tool-save").attr('data-balloon', 'Saved!');
                        $("#tool-save").attr('data-balloon-visible','');
                        setTimeout(function() {
                            $("#tool-save").removeAttr('data-balloon');
                            $("#tool-save").removeAttr('data-balloon-visible');
                        }, 3000);
                    } else if (data.message == "Anonymous user") {
                        $("#tool-save").html('Save');
                        $("#tool-save").attr('data-balloon', 'You must be logged in to save.');
                        $("#tool-save").attr('data-balloon-visible','');
                        setTimeout(function() {
                            $("#tool-save").removeAttr('data-balloon');
                            $("#tool-save").removeAttr('data-balloon-visible');
                        }, 3000);
                    } else {
                        $("#tool-save").html('Save');
                        $("#tool-save").attr('data-balloon', 'Error saving. Please try again later.');
                        $("#tool-save").attr('data-balloon-visible','');
                        setTimeout(function() {
                            $("#tool-save").removeAttr('data-balloon');
                            $("#tool-save").removeAttr('data-balloon-visible');
                        }, 3000);
                    }
                }
            });
        }
    });
}

function session_json() {
    var ret = {
        "map": enmodal.transit_map,
        "settings": enmodal.transit_interface.settings()
    };
    return JSON.stringify(ret);
}
// Game version
var GAME_VERSION = 0.13;

// Send incremental updates to server?
var INC_UPDATES = true;

// Used to set async parameter for all server requests.
var ASYNC_REQUIRED = true;
var ASYNC_OPTIONAL = false;

// Drawing parameters
var CURVE_THRESHOLD = 0.005; // Max overshoot from curve momentum.
var MARKER_RADIUS_DEFAULT = 4.0;
var MARKER_RADIUS_LARGE = 8.0;
var MARKER_RADIUS_HUGE = 12.0;
var MARKER_MERGE_DELTA = 4.0;
var STATION_MARKER_LARGE_THRESHOLD = 3; // Number of groups needed to force a large station marker
var STATION_MARKER_HUGE_THRESHOLD = 4;
var STATION_MARKER_SCALE_THRESHOLD = 6;
var TRACK_WIDTH = 4.0;
var TRACK_OFFSET = 4.0;
var TRANSFER_WIDTH = 3.0;
var TRANSFER_PREVIEW_OPACITY = 0.75;
var MAX_TRANSFER_DISTANCE_MILES = 0.25;

var USE_CURVED_TRACKS = true;
var CURVE_OVERSHOOT = 0.5;
var BEZIER_SHARPNESS = 0.4;

var DGGRID_AREA = 0.0733633;
var MAX_ZOOM = 16;
var MIN_ZOOM = 6;
var START_ZOOM = 13;

var MIN_ZOOM_FOR_HEXAGONS = 13;

var DEBUG_MODE = false;

// Map rendering parameters
var SHARED_STRETCH_THRESHOLD = 8; // Max number of "local" stations in a shared stretch.

var TRANSFER_BUTTON_DEFAULT = "Start Transfer";
var TRANSFER_BUTTON_START = "Click a station";
var TRANSFER_BUTTON_END = "Click another station";

// Instructions for calculate_ridership function
var RIDERSHIP_ADD = 0;
var RIDERSHIP_NOCHANGE = 1;
var RIDERSHIP_DELETE = 2;

// Custom lines
var CUSTOM_LINE_FIRST_INDEX = 97;

var FOLLOW_STREET_MOVE_THRESH = 500;

var PIN_DISTANCE_MIN = 16;
var PIN_DISTANCE_FROM_STATION_MIN = 8;
var PIN_DISTANCE_TO_SHOW_PINS = 100;
var PIN_DISTANCE_FROM_EXISTING_PIN_MIN = 40;

var INACTIVE_OPACITY = 0.25;

var BEZIER_LUT_STEPS = 100;

var STATION_MERGE_THRESHOLD = 8;
var ALLOW_STATION_MERGING = true;
var SERVICE_MODES_ENABLED = false;

var PIN_ICON = L.icon({
    iconUrl: 'static/img/pin.png',
    iconSize: [30, 25],
    iconAnchor: [15, 25]
});

var DEFAULT_LINE_BG = "#808183";
var DEFAULT_LINE_FG = "#FFF";

HEXAGON_SCALES = {
    "population": chroma.scale('YlGnBu').domain([1,0]),
    "employment": chroma.scale('YlOrRd').domain([1,0])
};
HEXAGON_UNITS = {
    "population": "persons / mile<sup>2</sup>",
    "employment": "jobs /  mile<sup>2</sup>"
};

var DEBUG_BEZIER_CONTROLS = false;
var DEBUG_PIN_PROJECTIONS = false;

var GTFS_ENABLED = true;

var UNDO_BUFFER_SIZE = 20;
class Sharing {
    constructor() {
    }
    
    update(public_key, private_key) {
        console.log(location.origin);
        $("#share-link-public input").val(location.origin+"/?id="+public_key);
        $("#share-link-private input").val(location.origin+"/?id="+private_key);
    }
}
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

function get_url_parameter(param) {
    var vars = {};
    window.location.href.replace( location.hash, '' ).replace(
            /[?&]+([^=&]+)=?([^&]*)?/gi, // regexp
            function( m, key, value ) { // callback
                    vars[key] = value !== undefined ? value : '';
            }
    );

    if (param) {
        return vars[param] ? vars[param].replace(/\#$/, '') : null;
    }
    return vars;
}

function num_unique_colors(lines) {
    var ret = 0;
    var used_colors = [];
    for (var i = 0; i < lines.length; i++) {
        if (used_colors.indexOf(lines[i].color_bg) == -1) {
            used_colors.push(lines[i].color_bg);
            ret += 1;
        }
    }
    return ret;
}

function station_distance(station_1, station_2) {
    var s1 = {
        "type": "Feature",
        "properties": {},
        "geometry": {
            "type": "Point",
            "coordinates": [station_1.location[1], station_1.location[0]]
        }
    };
    var s2 = {
        "type": "Feature",
        "properties": {},
        "geometry": {
            "type": "Point",
            "coordinates": [station_2.location[1], station_2.location[0]]
        }
    };

    return turf.distance(s1, s2, "miles");
}

function is_latlng(s) {
    return /^(\-)?[0-9]{0,3}.[0-9]*,(\ )?(\-)?[0-9]{0,3}.[0-9]*$/.test(s);
}

function get_latlng(s) {
    var c = s.split(",");
    return [parseFloat(c[0]), parseFloat(c[1])];
}

function save_json() {
    var json = session_json();
    var blob = new Blob([json], {type: "text/plain;charset=utf-8"});
    saveAs(blob, "enmodal.json");
}