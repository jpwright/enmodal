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