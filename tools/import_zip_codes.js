var jsonfile = require('jsonfile');
var turf = require('turf');
var ProgressBar = require('progress');
var pg = require('pg');
var argv = require("minimist")(process.argv.slice(2));
var parse = require('csv-parse');
var fs = require('fs');
var wellknown = require('wellknown');

var settings = {
    "d": "/media/jason/e/projects/subway/data/2010-shapefiles/tl_2010_56_zcta510/tl2010_56_zcta510.geojson",
    "e": "../data/2012 county business patterns/zbp12totals.txt"
};

for (var key in argv) {
    if (key in settings) {
        settings[key] = argv[key];
    }
}

var ZIP_FILE = settings["d"];
var CBP_FILE = settings["e"];

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
var zips_queried = 0;
var num_zips = 0;

pool.connect(function(err, client, done) {
    if (err) {
        return console.error('error fetching client from pool', err);
    }

    client.query('CREATE TABLE IF NOT EXISTS zip_code ( \
        id BIGSERIAL PRIMARY KEY, \
        zip bigint UNIQUE, \
        geo geometry, \
        employment int \
    );', function(err, result) {
        //done();

        if (err) {
            return console.error('error running query', err);
        } else {

            jsonfile.readFile(ZIP_FILE, function(zip_err, zip_data) {
                if (zip_err) {
                    return console.error('error loading ZIP file', zip_err);
                }
                console.log('Loaded ZIP file '+ZIP_FILE);
                console.log(zip_data.features.length + " total zip codes");
                num_zips = zip_data.features.length;
                var bar = new ProgressBar('  processing [:bar] :percent :etas', {
                    complete: '=',
                    incomplete: ' ',
                    width: 100,
                    total: zip_data.features.length
                });
                
                var zip_to_population = {};
                fs.readFile(CBP_FILE, function (cbp_err, cbp_data) {
                    parse(cbp_data, {delimiter: ','}, function(csv_err, rows) {
                        for (var i = 1; i < rows.length; i++) {
                            zip_to_population[parseInt(rows[i][0])] = parseInt(rows[i][4]);
                        }
                        
                        for (var j = 0; j < zip_data.features.length; j++) {

                            var feature = zip_data.features[j];
                            var zip = feature.properties.ZCTA5CE10;
                            var employment = zip_to_population[parseInt(zip)];
                            

                            /*var wkt = 'POLYGON((';
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
                            }*/
                            var wkt = wellknown.stringify(feature.geometry);
                                    
                            var s_zip = JSON.parse(JSON.stringify(zip));
                            var s_employment = JSON.parse(JSON.stringify(Math.round(employment)));
                            var s_wkt = JSON.parse(JSON.stringify(wkt));
                            
                            //console.log(s_zip+": employment "+s_employment+", wkt "+s_wkt);
                            
                            db_sync(client, s_zip, s_employment, s_wkt);

                            bar.tick();

                        }
                    })
                })
 
            }); // jsonfile (dggrid)
        }
    });



});

function db_sync(client, s_zip, s_employment, s_wkt) {
    var sel_result = client.query("SELECT id FROM zip_code WHERE zip="+s_zip+";", function(sel_err, sel_result) {

        
        if (sel_err) {
            console.error('error running query', sel_err);
        }
        
        if (sel_result.rows.length >= 1) {
            client.query("UPDATE zip_code \
                SET employment = "+s_employment+" WHERE zip = "+s_zip+";", function(psd_err, psd_result) {
                
                if (psd_err) {
                    console.error('error running query', psd_err);
                }
            });
        } else {
        
            client.query("INSERT INTO zip_code (zip, geo, employment) \
                VALUES("+s_zip+", ST_GeomFromText('"+s_wkt+"'), "+s_employment+");", function(psd_err, psd_result) {
                
                if (psd_err) {
                    console.error('error running query', psd_err);
                    console.log(s_wkt);
                }
            });
            
        }
        zips_queried += 1;
        if (zips_queried == num_zips) {
            //process.exit();
        }
        
    });
}

pool.on('error', function (err, client) {
  console.error('idle client error', err.message, err.stack)
})
