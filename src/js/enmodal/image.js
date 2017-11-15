function save_svg(canvas, callback) {
    var draw = SVG('svg-drawing').size(2000,2000);
    
    enmodal.transit_interface.preview_clear();
    
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
	image.onload = function() {
	    ctx.drawImage(image, 0, 0);
	    callback();
	};
	image.src = d;
	//var link = $('<a href="'+d+'" download="enmodal-'+enmodal.session_id+'.png" style="display:none;"></a>').appendTo('body');
    //link[0].click();
}

function create_image(callback) {
	var center = _leaflet_map.getCenter();
	var zoom = _leaflet_map.getZoom();
	$("#map").css("height", 2000);
	$("#map").css("width", 2000);
	_leaflet_map.invalidateSize();
	_leaflet_map.setView(center, zoom);
	$("#map").hide();
	leafletImage(_leaflet_map, function(err, canvas) {
	    //var dimensions = _leaflet_map.getSize();
	    save_svg(canvas, function() {
	    	callback(canvas);
			$("#map").css("height", "");
			$("#map").css("width", "");
	    	$("#map").show();
			_leaflet_map.invalidateSize();
	    });
	});
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

function save_pdf() {
	create_image(function(canvas) {
		var pdf = new jsPDF({
			orientation: 'landscape',
			unit: 'in',
			format: [12, 12]
		});
		pdf.addImage(canvas.toDataURL("image/jpeg", 1.0), 'JPEG', 0, 0);
		pdf.save('enmodal-'+enmodal.session_id+'.pdf');
    	var ctx = canvas.getContext("2d");
    	ctx.clearRect(0, 0, canvas.width, canvas.height);
    	document.getElementById('canvas').getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
	});
}