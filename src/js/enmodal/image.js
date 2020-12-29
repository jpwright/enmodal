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


    canvgv2(document.getElementById('canvas'), draw.svg());
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
		    	ctx.fillText("created with enmodal -- http://enmodal.io", 1988, 1988);
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