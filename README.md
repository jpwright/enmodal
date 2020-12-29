# enmodal

enmodal is a browser-based service for transit planning and analysis. users can quickly mockup transit services (or “scenario plan” modifications to real-world systems) in their browser. enmodal runs server-side modeling algorithms to analyze the impact of different service modifications, using population and employment data.

## Set up

Skip to: [Windows](#windows), [Mac](#mac), [Ubuntu](#ubuntu)

### Windows

#### Clone this repo

Download this repository as a ZIP file (see Download options above) and unzip to a directory called `enmodal`. Alternatively, install [Git](https://git-scm.com/) and clone the repository:

    git clone https://github.com/jpwright/enmodal.git

#### Set up PostgreSQL

Install [PostgreSQL](https://www.postgresql.org) with [PostGIS](http://postgis.net/windows_downloads/) functionality. I recommend following [this tutorial](www.bostongis.com/PrinterFriendly.aspx?content_name=postgis_tut01).

Make note of the password you set for the admin (`postgres`) account.

#### Create config file

Copy `settings.cfg.example` to a new file called `settings.cfg`, and open that file for editing. Most fields can be left at their default values, except:

- Set the `sessions` database password based on whatever you chose in the previous step.
- If you want support for reverse geocoding, you'll need to set up an account with either [Mapbox](https://www.mapbox.com/developers/) or [Google](https://developers.google.com/maps/documentation/javascript/get-api-key) and supply an API key. (The Mapzen API is no longer functional.)

#### Set up Python

Install [Python 3.8](https://www.python.org/) using the Windows installer, or other distribution of your choice.

*Make sure to select "Add Python to system PATH" when installing.*

#### Install virtualenv and set up Python requirements

Open Command Prompt and navigate to the `enmodal` directory. (If you are unfamiliar with navigating directories in Command Prompt, an easy way to do this is to open the `enmodal` directory in Explorer, then in the field that shows you the folder path, type `cmd` and hit Enter.)

Run the following commands to set up the Python environment:

    python -m pip install virtualenv
    python -m venv venv
    venv\Scripts\activate.bat
    python -m pip install -r requirements.txt

Leave Command Prompt open as you'll need it future steps.

#### Create database

In your Command Prompt window:

    "C:\Program Files\PostgreSQL\10\bin\createdb" -U postgres sessions

Use the password you set during PostgreSQL installation when requested.

#### Run database setup tool

In the same Command Prompt window, run:

    python tools\set_up_db.py

#### Start the server

    python server.py

#### Open your browser

Navigate to `http://localhost:5050` in your browser and get started!

### Mac

#### Clone this repo

Download this repository as a ZIP file (see Download options above) and unzip to a directory called `enmodal`. Alternatively, install [Git](https://git-scm.com/) and clone the repository:

    git clone https://github.com/jpwright/enmodal.git
    
#### Set up Python

Open up a Terminal, navigate to the directory in which you unzipped enmodal (recommend [this tutorial](https://learn.co/lessons/bash-navigation-osx) if navigating through directories in Terminal is unfamiliar to you), and run the following commands:

    sudo easy_install pip
    sudo pip install virtualenv
    
#### Install virtualenv and set up Python requirements

    python -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt

#### Install PostgreSQL and PostGIS

Recommend using [Postgres.app](http://postgresapp.com/) to accomplish this.

Install Postgres.app and open the application. Click "Initialize" then "Start" to start the Postgres server. Double click on any of the databases shown in the window.

A terminal window should appear. Run these commands:

    CREATE DATABASE sessions;

#### Create config file

Copy `settings.cfg.example` to a new file called `settings.cfg`. Most fields can be left at their default values, except:

- Set the `sessions` `user` to your macOS username (this is the default value if you used Postgres.app)
- Set the `sessions` `password` to be blank (this is the default value if you used Postgres.app)
- If you want support for reverse geocoding, you'll need to set up an account with either [Mapbox](https://www.mapbox.com/developers/) or [Google](https://developers.google.com/maps/documentation/javascript/get-api-key) and supply an API key. (The Mapzen API is no longer functional.)

#### Run database setup tool

In your original Terminal window:

    python tools/set_up_db.py

#### Start the server

    python server.py

#### Open your browser

Navigate to `http://localhost:5050` in your browser and get started!

### Ubuntu

#### Clone this repo

    git clone https://github.com/jpwright/enmodal.git && cd enmodal
    
#### Set up essential tools

    sudo apt-get install python3-setuptools python3-dev python3-pip python3-psycopg2 python3-wheel postgresql-12 postgresql-server-dev-12 build-essential wget nodejs node-grunt-cli npm
    
#### Install virtualenv and set up Python requirements

    python3 -m venv venv
    source venv/bin/activate
    pip3 install -r requirements.txt

#### Set up PostgreSQL user

    sudo -u postgres psql postgres

Then within the `psql` command:

    \password postgres

Set a password and use it in your `settings.cfg` file below.

Create the database:

    CREATE DATABASE sessions;

Quit psql with Ctrl+D.

#### Create config file

Copy `settings.cfg.example` to a new file called `settings.cfg`. Most fields can be left at their default values, except:

- Set the `sessions` database password based on whatever you chose in the previous step.
- If you want support for reverse geocoding, you'll need to set up an account with either [Mapbox](https://www.mapbox.com/developers/) or [Google](https://developers.google.com/maps/documentation/javascript/get-api-key) and supply an API key. (The Mapzen API is no longer functional.)

#### Run database setup tool

    python3 tools/set_up_db.py

#### Install NPM and grunt

    npm install grunt grunt-contrib-jshint grunt-contrib-watch grunt-contrib-copy grunt-contrib-concat grunt-contrib-uglify --save-dev
    sudo npm install -g grunt-cli
    sudo npm install
    grunt --force

#### Start the server

    python server.py

#### Open your browser

Navigate to `http://localhost:5050` in your browser and get started!

## Populating dggrid database

Generating the dggrid database (which contains the hexagonal bins of population and employment data) is cumbersome and not yet documented. A copy of the database will eventually be made available for download. The scripts to generate the database yourself are in the `tools` directory.