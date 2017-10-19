# enmodal

[![Support via Gratipay](https://cdn.rawgit.com/gratipay/gratipay-badge/2.3.0/dist/gratipay.png)](https://gratipay.com/enmodal/)

enmodal is a browser-based service for transit planning and analysis. users can quickly mockup transit services (or “scenario plan” modifications to real-world systems) in their browser. enmodal runs server-side modeling algorithms to analyze the impact of different service modifications, using population and employment data.

## Set up

This guide is written for Ubuntu (16.04.2). enmodal is not tested on other platforms, though it may be possible to get it running.

### Clone this repo

    git clone https://github.com/jpwright/enmodal.git && cd enmodal

### Create config file

Copy `settings.cfg.example` to `settings.cfg` and edit fields to appropriate values.
    
### Set up Python

    sudo apt-get install python-setuptools python-dev build-essential
    sudo easy_install pip
    sudo pip install --upgrade virtualenv
    
### Install virtualenv and set up Python requirements

    pip install virtualenv
    virtualenv venv
    source venv/bin/activate
    pip install -r requirements.txt

### Install Postgres (9.6) and PostGIS (2.3)

    sudo add-apt-repository "deb http://apt.postgresql.org/pub/repos/apt/ xenial-pgdg main"
    wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
    sudo apt-get update
    sudo apt-get install postgresql-9.6
    sudo apt-get install postgresql-server-dev-9.6
    sudo apt-get install postgresql-9.6-postgis-2.3 postgresql-9.6-postgis-scripts

### Set up Postgres user

    sudo su -
    sudo -u postgres psql postgres
    \password postgres

### Run database setup tool

    python tools/set_up_db.py

### Install PostGIS extensions

    sudo -u postgres psql -c "CREATE EXTENSION postgis; CREATE EXTENSION postgis_topology;" dggrid

### Set up Valhalla

Note: best to follow the [Valhalla setup guide](https://github.com/valhalla/valhalla/)

    sudo add-apt-repository -y ppa:valhalla-core/valhalla
    sudo apt-get update
    sudo apt-get install -y valhalla-bin
    cd valhalla
    valhalla_route_service valhalla.json 1 &
    
### Install NPM and grunt

    sudo apt-get install nodejs-legacy npm
    npm install grunt grunt-contrib-jshint grunt-contrib-watch grunt-contrib-copy grunt-contrib-concat grunt-contrib-uglify --save-dev
    sudo npm install -g grunt-cli
    sudo npm install
    grunt --force
    
## Populating dggrid database

I generated the dggrid database (which contains the hexagonal bins of population and employment data), but the process to do this is extremely cumbersome, not yet documented, and took like weeks of CPU time.

If you want to attempt this anyway, contact me (<jpwright0@gmail.com>) for assistance.

If you want to use the data but not bother with that lengthy generation process, contact me and I can transfer a very large zip file of the database.
