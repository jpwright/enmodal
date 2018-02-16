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