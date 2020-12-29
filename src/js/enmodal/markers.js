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
        //var marker = L.circleMarker(latlng, {draggable: true, color: "black", opacity: opacity, fillColor: "white", fillOpacity: opacity, zIndexOffset: 100, pane: "stationMarkerPane"}).bindTooltip(this.station.name, this.tooltip_options);
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
        /*
        content += '<div class="station-content"><div class="station-info">'+this.station.neighborhood+'<br />';
        content += '<i class="fa fa-user" aria-hidden="true"></i> <span id="stationriders-'+this.station.sid.toString()+'">';
        if (this.station.ridership == -1) {
            content += '...';
        } else {
            content += Math.round(this.station.ridership).toString();
        }
        content += '</span></div>';
        */
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