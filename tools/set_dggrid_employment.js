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
    }

    client.query('CREATE TABLE IF NOT EXISTS dggrid ( \
        id BIGSERIAL PRIMARY KEY, \
        gid bigint UNIQUE, \
        geo geometry, \
        population int, \
        employment int \
    );', function(err, result) {
        //done();

        if (err) {
            return console.error('error running query', err);
        } else {

            var sel_result = client.query("SELECT id, gid, ST_AsText(geo) FROM dggrid WHERE id > 1700000 ORDER BY id ASC LIMIT 100000;", function(sel_err, sel_result) {
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

                /*if (sel_result.rows.length >= 1) {
                    client.query("UPDATE dggrid SET population = "+s_population+" WHERE gid = "+s_gid+";", function(psd_err, psd_result) {

                        if (psd_err) {
                            console.error('error running query', psd_err);
                        }

                        dggrids_queried += 1;
                        //console.log("Query done for dggrid "+dggrids_queried+" of "+dggrids_with_overlap);
                        if (dggrids_queried == dggrids_with_overlap) {
                            process.exit();
                        }
                    });
                } else {

                    client.query("INSERT INTO dggrid (gid, geo, population) VALUES("+s_gid+", ST_GeomFromText('"+s_wkt+"'), "+s_population+");", function(psd_err, psd_result) {

                        if (psd_err) {
                            console.error('error running query', psd_err);
                        }

                        dggrids_queried += 1;
                        //console.log("Query done for dggrid "+dggrids_queried+" of "+dggrids_with_overlap);
                        if (dggrids_queried == dggrids_with_overlap) {
                            process.exit();
                        }
                    });

                }*/
            });
        }
    });



});

function db_sync(client, bar, row) {
    var query = "SELECT id, ST_AsText(geo), zip, employment FROM zip_code WHERE ST_Intersects(geo, ST_GeomFromText('"+row.st_astext+"'));";
    //console.log(query);
    client.query(query, function(psd_err, psd_result) {
        if (psd_err) {
            console.error('error running query', psd_err);
        }
        var dggrid_geo = row.st_astext;
        var dggrid_gid = row.gid;
        var dggrid_obj = wellknown.parse(dggrid_geo);
        var dggrid_employment = 0.0;
        for (var j = 0; j < psd_result.rows.length; j++) {

            var zip_obj = wellknown.parse(psd_result.rows[j].st_astext);
            var overlap_polygon = turf.intersect(zip_obj, dggrid_obj);
            //console.log(zip_obj.coordinates[0][0])
            //console.log(dggrid_obj.coordinates[0][0]);
            if (overlap_polygon != undefined) {
                //console.log("Overlap between gid "+dggrid_gid.toString()+" and zip code "+ psd_result.rows[j].zip);
                var zip_area = turf.area(zip_obj);
                //console.log("Zip area is "+zip_area.toString());
                var overlap_area = turf.area(overlap_polygon);
                //console.log("Overlap area is "+overlap_area.toString());
                var overlap_percent = overlap_area / zip_area;
                //console.log("Overlap percent between gid "+dggrid_gid.toString()+" and zip code "+ psd_result.rows[j].zip+ " is "+overlap_percent.toString());
                dggrid_employment += overlap_percent * psd_result.rows[j].employment;
            }
        }
        //console.log("Setting gid "+dggrid_gid.toString()+" employment to "+dggrid_employment.toString());

        bar.tick();
        set_employment(client, bar, dggrid_gid, dggrid_employment);
    });
}

function set_employment(client, bar, gid, emp) {

    client.query("UPDATE dggrid \
        SET employment = "+Math.round(emp).toString()+" WHERE gid = "+gid+";", function(psd_err, psd_result) {

        if (psd_err) {
            console.error('error running query', psd_err);
        }
    });
}


pool.on('error', function (err, client) {
  console.error('idle client error', err.message, err.stack)
})
