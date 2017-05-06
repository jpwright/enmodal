import ConfigParser
import psycopg2
import psycopg2.extras

config = ConfigParser.RawConfigParser()
config.read(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'settings.cfg')))
DGGRID_HOST = config.get('dggrid', 'host')
DGGRID_PORT = config.get('dggrid', 'port')
DGGRID_DBNAME = config.get('dggrid', 'dbname')
DGGRID_USER = config.get('dggrid', 'user')
DGGRID_PASSWORD = config.get('dggrid', 'password')
DGGRID_CONN_STRING = "host='"+DGGRID_HOST+"' port='"+DGGRID_PORT+"' dbname='"+DGGRID_DBNAME+"' user='"+DGGRID_USER+"' password='"+DGGRID_PASSWORD+"'"
# print the connection string we will use to connect
print "Connecting to database\n	->%s" % (DGGRID_CONN_STRING)

conn = psycopg2.connect(DGGRID_CONN_STRING)
cursor = conn.cursor()
    
query = "CREATE TABLE IF NOT EXISTS dggrid ( \
        id BIGSERIAL PRIMARY KEY, \
        gid bigint UNIQUE, \
        geo geometry, \
        population int, \
        employment int \
    );"
print query
cursor.execute(query)

SESSIONS_HOST = config.get('sessions', 'host')
SESSIONS_PORT = config.get('sessions', 'port')
SESSIONS_DBNAME = config.get('sessions', 'dbname')
SESSIONS_USER = config.get('sessions', 'user')
SESSIONS_PASSWORD = config.get('sessions', 'password')
SESSIONS_CONN_STRING = "host='"+SESSIONS_HOST+"' port='"+SESSIONS_PORT+"' dbname='"+SESSIONS_DBNAME+"' user='"+SESSIONS_USER+"' password='"+SESSIONS_PASSWORD+"'"
# print the connection string we will use to connect
print "Connecting to database\n	->%s" % (SESSIONS_CONN_STRING)

conn = psycopg2.connect(SESSIONS_CONN_STRING)
cursor = conn.cursor()

query = "CREATE TABLE IF NOT EXISTS sessions ( \
        id BIGSERIAL PRIMARY KEY, \
        data jsonb, \
        updated timestamp without time zone \
    );"
print query
cursor.execute(query)

conn.commit()

cursor.close()
conn.close()