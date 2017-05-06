var jsonfile = require('jsonfile');
var turf = require('turf');
var ProgressBar = require('progress');
var pg = require('pg');
var argv = require("minimist")(process.argv.slice(2));
var parse = require('csv-parse/lib/sync');
var fs = require('fs');
var wellknown = require('wellknown');

var config = {
    user: 'postgres',
    database: 'transit',
    password: 'nostrand',
    host: 'localhost',
    port: 5432,
    max: 10,
    idleTimeoutMillis: 100000000
};

var pool = new pg.Pool(config);
var dggrids_processed = 0;

pool.connect(function(err, client, done) {
    if (err) {
        return console.error('error fetching client from pool', err);
    } else {
        var sel_result = client.query("SELECT id, gid, ST_AsText(geo) FROM dggrid WHERE id > 4000000 ORDER BY id ASC LIMIT 500000;", function(sel_err, sel_result) {
            if (sel_err) {
                console.error('error running query', sel_err);
            }
            var bar = new ProgressBar('  processing [:bar] :percent :etas', {
                complete: '=',
                incomplete: ' ',
                width: 100,
                total: sel_result.rows.length
            });

            console.log(sel_result.rows.length.toString() + " dggrids found.");
            for (var i = 0; i < sel_result.rows.length; i++) {
                var row = sel_result.rows[i];
                db_sync(client, bar, row);
            }
        });
    }
});

function db_sync(client, bar, row) {
    
    var dggrid_geo = row.st_astext;
    var dggrid_gid = row.gid;
    var dggrid_obj = wellknown.parse(dggrid_geo);
    var dggrid_centroid = turf.centroid(dggrid_obj);
    var wkt = wellknown.stringify(dggrid_centroid);
    /*
    var wkt = 'POLYGON((';
    for (var i = 0; i < feature["geometry"]["coordinates"][0].length; i++) {
        var coordinate = feature["geometry"]["coordinates"][0][i];
        wkt += coordinate[0];
        wkt += ' ';
        wkt += coordinate[1];
        if (i < feature["geometry"]["coordinates"][0].length - 1) {
            wkt += ', ';
        } else {
            wkt += '))';
        }
    }
    */
    
    client.query("INSERT INTO dgpt (gid, geo) VALUES("+dggrid_gid+", ST_GeomFromText('"+wkt+"'));", function(psd_err, psd_result) {
        if (psd_err) {
            console.error('error running query', psd_err);
        }
    });
    bar.tick();
}

pool.on('error', function (err, client) {
  console.error('idle client error', err.message, err.stack)
});