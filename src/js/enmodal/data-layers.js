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
        // Disabled
        /*
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
        */
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