# enmodal

[![Support via Gratipay](https://cdn.rawgit.com/gratipay/gratipay-badge/2.3.0/dist/gratipay.png)](https://gratipay.com/enmodal/)

enmodal is a browser-based service for transit planning and analysis. users can quickly mockup transit services (or “scenario plan” modifications to real-world systems) in their browser. enmodal runs server-side modeling algorithms to analyze the impact of different service modifications, using population and employment data.

## Set up

This guide is written for Ubuntu (16.04.2). enmodal is not tested on other platforms, though it may be possible to get it running.

### Install Postgres and PostGIS

    sudo apt-get install postgresql postgresql-contrib
    sudo apt-get install postgresql-server-dev-9.6
    sudo apt-get install postgresql-9.6-postgis-2.3 postgresql-9.6-postgis-scripts

### Install virtualenv and set up Python requirements

    pip install virtualenv
    virtualenv venv
    source venv/bin/activate
    pip install -r requirements.txt

### Set up Flask

    sudo apt-get install python-setuptools python-dev build-essential
    sudo easy_install pip
    sudo pip install --upgrade virtualenv

### Set up Postgres user

    sudo su -
    sudo -u postgres psql postgres
    \password postgres

### Run database setup tool

    python tools/set_up_db.py

### Install PostGIS extensions

    sudo -u postgres psql -c "CREATE EXTENSION postgis; CREATE EXTENSION postgis_topology;" dggrid

## Populating dggrid database

I generated the dggrid database (which contains the hexagonal bins of population and employment data), but the process to do this is extremely cumbersome, not yet documented, and took like weeks of CPU time.

If you want to attempt this anyway, contact me (<jpwright0@gmail.com>) for assistance.

If you want to use the data but not bother with that lengthy generation process, contact me and I can transfer a very large zip file of the database.
