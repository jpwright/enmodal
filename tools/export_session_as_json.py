import ConfigParser
import psycopg2
import psycopg2.extras
import os
import argparse
import json

def main():
    parser = argparse.ArgumentParser(description='Export a session as JSON.')
    parser.add_argument('id', help='session id')
    args = parser.parse_args()

    config = ConfigParser.RawConfigParser()
    config.read(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'settings.cfg')))

    SESSIONS_HOST = config.get('sessions', 'host')
    SESSIONS_PORT = config.get('sessions', 'port')
    SESSIONS_DBNAME = config.get('sessions', 'dbname')
    SESSIONS_USER = config.get('sessions', 'user')
    SESSIONS_PASSWORD = config.get('sessions', 'password')
    SESSIONS_CONN_STRING = "host='"+SESSIONS_HOST+"' port='"+SESSIONS_PORT+"' dbname='"+SESSIONS_DBNAME+"' user='"+SESSIONS_USER+"' password='"+SESSIONS_PASSWORD+"'"
    SESSIONS_SECRET_KEY_PUBLIC = int(config.get('sessions', 'secret_key_public'), 16)
    SESSIONS_SECRET_KEY_PRIVATE = int(config.get('sessions', 'secret_key_private'), 16)

    # print the connection string we will use to connect
    print "Connecting to database\n	->%s" % (SESSIONS_CONN_STRING)

    conn = psycopg2.connect(SESSIONS_CONN_STRING)
    cursor = conn.cursor()

    public_id = int(args.id, 16) ^ SESSIONS_SECRET_KEY_PUBLIC
    print public_id
    query = "SELECT updated, data from sessions WHERE id=%d;" % (public_id)
    print query
    cursor.execute(query)

    row = cursor.fetchone()
    print "id: %d, updated: %s, data: %s" % (public_id, row[0], row[1])
    outfile = open(args.id+".json", "w")
    outfile.write(json.dumps(row[1]))
    outfile.close()

    conn.commit()

    cursor.close()
    conn.close()
    
if __name__ == "__main__":
    main()