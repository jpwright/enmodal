import configparser
import psycopg2
import psycopg2.extras
import os

config = configparser.RawConfigParser()
config.read(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'settings.cfg')))

SESSIONS_HOST = config.get('sessions', 'host')
SESSIONS_PORT = config.get('sessions', 'port')
SESSIONS_DBNAME = config.get('sessions', 'dbname')
SESSIONS_USER = config.get('sessions', 'user')
SESSIONS_PASSWORD = config.get('sessions', 'password')
SESSIONS_CONN_STRING = "host='"+SESSIONS_HOST+"' port='"+SESSIONS_PORT+"' dbname='"+SESSIONS_DBNAME+"' user='"+SESSIONS_USER+"' password='"+SESSIONS_PASSWORD+"'"
# print the connection string we will use to connect
print("Connecting to database\n	->%s" % (SESSIONS_CONN_STRING))

conn = psycopg2.connect(SESSIONS_CONN_STRING)
cursor = conn.cursor()

query = "CREATE TABLE IF NOT EXISTS sessions (id BIGSERIAL PRIMARY KEY, data jsonb, updated timestamp without time zone, owner_id int, title text);"
#print query
cursor.execute(query)


conn.commit()

cursor.close()
conn.close()