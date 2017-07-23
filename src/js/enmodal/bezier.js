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