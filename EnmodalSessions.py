import uuid
import os
import sys
import datetime
import json

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'lib', 'transit')))
import Transit

import configparser

config = configparser.RawConfigParser()
config.read(os.path.abspath(os.path.join(os.path.dirname(__file__), 'settings.cfg')))

SESSIONS_HOST = config.get('sessions', 'host')
SESSIONS_PORT = config.get('sessions', 'port')
SESSIONS_DBNAME = config.get('sessions', 'dbname')
SESSIONS_USER = config.get('sessions', 'user')
SESSIONS_PASSWORD = config.get('sessions', 'password')
SESSIONS_CONN_STRING = "host='"+SESSIONS_HOST+"' port='"+SESSIONS_PORT+"' dbname='"+SESSIONS_DBNAME+"' user='"+SESSIONS_USER+"' password='"+SESSIONS_PASSWORD+"'"
SESSIONS_SECRET_KEY_PUBLIC = int(config.get('sessions', 'secret_key_public'), 16)
SESSIONS_SECRET_KEY_PRIVATE = int(config.get('sessions', 'secret_key_private'), 16)
SESSION_EXPIRATION_TIME = int(config.get('sessions', 'expiration_time'))

class EnmodalSessionManager(object):
    def __init__(self):
        self.sessions = []

    def get_by_sid(self, sid):
        for s in self.sessions:
            if s.sid == sid:
                return s
        return None

    def get_by_public_key(self, h):
        for s in self.sessions:
            if s.public_key() == h:
                return s
        return None

    def get_by_private_key(self, h):
        for s in self.sessions:
            if s.private_key() == h:
                return s
        return None

    def get_sid_from_public_key(self, h):
        return h ^ SESSIONS_SECRET_KEY_PUBLIC
    
    def get_sid_from_private_key(self, h):
        return h ^ SESSIONS_SECRET_KEY_PRIVATE

    def add(self, s):
        self.sessions.append(s)
        
        # Whenever we add a new session, check for old ones to remove.
        purged = self.purge()
        print(str(len(self.sessions))+" active sessions, "+str(purged)+" purged.")

    def remove_by_sid(self, sid):
        s = self.get_by_sid(sid)
        if s is not None:
            self.sessions.remove(s)

    def auth_by_key(self, h):
        public_session = self.get_by_public_key(h)
        if public_session is not None:
            public_session.keep_alive()
            a = EnmodalSessionAuthentication(public_session, False)
            return a
        private_session = self.get_by_private_key(h)
        if private_session is not None:
            private_session.keep_alive()
            a = EnmodalSessionAuthentication(private_session, True)
            return a
        return None
    
    def purge(self):
        num_sessions_start = len(self.sessions)
        #for session in self.sessions:
            #if session.is_expired():
                #save_session(session, None, False)
        self.sessions = [x for x in self.sessions if not x.is_expired()]
        return num_sessions_start - len(self.sessions)

class EnmodalSession(object):
    def __init__(self):
        self.sid = uuid.uuid4().int & (1<<63)-1
        self.map = Transit.Map(0)
        self.last_edit_time = datetime.datetime.now()
        
    def public_key(self):
        return self.sid ^ SESSIONS_SECRET_KEY_PUBLIC
    
    def private_key(self):
        return self.sid ^ SESSIONS_SECRET_KEY_PRIVATE

    def keep_alive(self):
        self.last_edit_time = datetime.datetime.now()

    def is_expired(self):
        return (datetime.datetime.now() - self.last_edit_time).total_seconds() > SESSION_EXPIRATION_TIME


class EnmodalSessionAuthentication(object):
    def __init__(self, s, editable):
        self.session = s
        self.editable = editable

    def returnable_key(self):
        if self.editable:
            return '{:16x}'.format(self.session.private_key())
        else:
            return '{:16x}'.format(self.session.public_key())

def check_for_session_errors(h):
    if session_manager.auth_by_key(h) is None:
        print("session auth problem with key "+str(h))
        return json.dumps({"error": "Invalid session"})

    return 0

session_manager = EnmodalSessionManager()
