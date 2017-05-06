# Install

sudo apt-get install postgresql postgresql-contrib
sudo apt-get install postgresql-server-dev-9.6
sudo apt-get install postgresql-9.6-postgis-2.3 postgresql-9.6-postgis-scripts

# Flask setup
sudo apt-get install python-setuptools python-dev build-essential
sudo easy_install pip
sudo pip install --upgrade virtualenv

# Set up postgres user: example

#sudo su -
#sudo -u postgres psql postgres
#\password postgres

# create databases
#\ CREATE DATABASE dggrid
#\ CREATE DATABASE sessions

# run db setup tool
source venv/bin/activate
python tools/set_up_db.py

# Install PostGIS extension
sudo -u postgres psql -c "CREATE EXTENSION postgis; CREATE EXTENSION postgis_topology;" dggrid

# Zip up dggrid.gz on local machine
# sudo -u postgres pg_dump dggrid | gzip -9 > dggrid.gz

# After copying over the transit.gz database...
gunzip -c dggrid.gz | sudo -u postgres psql dggrid

# Checking out the tables from psql...
#\connect transit
#\dt
