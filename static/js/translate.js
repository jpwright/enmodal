/**
 * Takes any GeoJSON object and translate all of its coordinates
 * by using a provided tranlate function. The translate function
 * is executed for each coord.
 *
 * @module turf/translate
 * @param {GeoJSON} input
 * @returns {GeoJSON} output
 * @example
 * var oslo = turf.point([10.730584859848022, 59.91620379962411]);
 * //move
 * var move = function(p) {
 *   return [p[0] - 5,40575087070465, p[1] + -0,475149008230737]
 * }
 * var bergen = turf.translate(oslo, move); 
 */

module.exports = translate;

function translate(_, translator) {
    // ensure that we don't modify features in-place and changes to the
    // output do not change the previous feature, including changes to nested
    // properties.
    var input = JSON.parse(JSON.stringify(_));

    switch (input.type) {
        case 'FeatureCollection':
            for (var i = 0; i < input.features.length; i++)
                translateGeometry(input.features[i].geometry, translator);
            return input;
        case 'Feature':
            translateGeometry(input.geometry, translator);
            return input;
        default:
            translateGeometry(input, translator);
            return input;
    }
}

function translateGeometry(geometry, translator) {
    var coords = geometry.coordinates;
    switch(geometry.type) {
      case 'Point':
        geometry.coordinates = translator(geometry.coordinates);
        break;
      case 'LineString':
      case 'MultiPoint':
        translate1(coords, translator);
        break;
      case 'Polygon':
      case 'MultiLineString':
        translate2(coords, translator);
        break;
      case 'MultiPolygon':
        translate3(coords, translator);
        break;
      case 'GeometryCollection':
        geometry.geometries.forEach(function(each) {
          translateGeometry(each, translator);
        }); 
        break;
    }
}


function translate1(coords, translator) {
  for(var i = 0; i < coords.length; i++) {
    coords[i] = translator(coords[i]);
  };
}

function translate2(coords, translator) {
  for(var i = 0; i < coords.length; i++)
    for(var j = 0; j < coords[i].length; j++) {
      coords[i][j] = translator(coords[i][j]);
    };
}

function translate3(coords, translator) {
  for(var i = 0; i < coords.length; i++)
    for(var j = 0; j < coords[i].length; j++)
      for(var k = 0; k < coords[i][j].length; k++) {
        coords[i][j][k] = translator(coords[i][j][k]);
      };
}
