import psycopg2
import psycopg2.extras
import sendgrid
import os
from sendgrid.helpers.mail import *
import base64
import json
import datetime
import ConfigParser
import random
import string
import bcrypt

config = ConfigParser.RawConfigParser()
config.read(os.path.abspath(os.path.join(os.path.dirname(__file__), 'settings.cfg')))
PORT = int(config.get('flask', 'port'))

SESSIONS_HOST = config.get('sessions', 'host')
SESSIONS_PORT = config.get('sessions', 'port')
SESSIONS_DBNAME = config.get('sessions', 'dbname')
SESSIONS_USER = config.get('sessions', 'user')
SESSIONS_PASSWORD = config.get('sessions', 'password')
SESSIONS_CONN_STRING = "host='"+SESSIONS_HOST+"' port='"+SESSIONS_PORT+"' dbname='"+SESSIONS_DBNAME+"' user='"+SESSIONS_USER+"' password='"+SESSIONS_PASSWORD+"'"
SESSIONS_SECRET_KEY_PUBLIC = int(config.get('sessions', 'secret_key_public'), 16)
SESSIONS_SECRET_KEY_PRIVATE = int(config.get('sessions', 'secret_key_private'), 16)
SESSION_EXPIRATION_TIME = int(config.get('sessions', 'expiration_time'))

SENDGRID_API_KEY = config.get('email', 'sendgrid_api_key')
ENMODAL_DOMAIN = config.get('flask', 'domain')

def send_registration_emails():
    conn = psycopg2.connect(SESSIONS_CONN_STRING)
    cursor = conn.cursor()
    cursor.execute("SELECT id, email, password_hash, first_name, last_name FROM pending_registrations WHERE email_sent = %s", [False])
    
    rows = cursor.fetchall()
    
    sg = sendgrid.SendGridAPIClient(apikey=SENDGRID_API_KEY)
    
    for row in rows:
        id = row[0]
        email = row[1]
        password_hash = row[2]
        first_name = row[3]
        last_name = row[4]
        
        from_email = Email("registration@enmodal.co")
        to_email = Email(email)
        subject = "enmodal: confirm your registration"
        
        encode_content = {"i":str(id), "p":password_hash, "t":datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
        encoded = base64.b64encode(json.dumps(encode_content))

        registration_link = ENMODAL_DOMAIN + "/confirm-registration?e=" + encoded
        
        body = "<p><h3>Hi "+first_name+",</h3></p>"
        body += "<p>You (or someone using your email address) recently registered for an account at <a href=\"http://enmodal.co\">enmodal.co</a>.</p>"
        body += "<p>If that was you, please click this link to complete registration:</p>"
        body += "<p><a href=\""+registration_link+"\">"+registration_link+"</a></p>"
        body += "<p>This link is valid for the next 24 hours. If you need to generate a new registration link, simply attempt to log in using this email address and click \"Resend confirmation email\".</p>"
        body += "<p>If this wasn't you, simply ignore this email.</p>"
        body += "<p>- enmodal registration robot</p>"
        
        content = Content("text/html", body)
        mail = Mail(from_email, subject, to_email, content)
        response = sg.client.mail.send.post(request_body=mail.get())
        
        cursor.execute("UPDATE pending_registrations SET email_sent = %s WHERE id = %s", (True, id))
        conn.commit()
            
def gen_random_string(char_set, length):
    if not hasattr(gen_random_string, "rng"):
        gen_random_string.rng = random.SystemRandom() # Create a static variable
    return ''.join([ gen_random_string.rng.choice(char_set) for _ in xrange(length) ])

def reset_passwords():
    conn = psycopg2.connect(SESSIONS_CONN_STRING)
    cursor = conn.cursor()
    cursor.execute("SELECT id, email, password_hash, first_name, last_name FROM users WHERE password_reset = %s", [True])
    
    rows = cursor.fetchall()
    
    sg = sendgrid.SendGridAPIClient(apikey=SENDGRID_API_KEY)
    
    for row in rows:
        id = row[0]
        email = row[1]
        password_hash = row[2]
        first_name = row[3]
        last_name = row[4]
        
        from_email = Email("registration@enmodal.co")
        to_email = Email(email)
        subject = "enmodal: password reset"
        
        password_charset = string.ascii_letters + string.digits
        new_password = gen_random_string(password_charset, 32)
        password_hash = bcrypt.hashpw(new_password, bcrypt.gensalt())

        body = "<p><h3>Hi "+first_name+",</h3></p>"
        body += "<p>We received a request to reset the password for your account at <a href=\"http://enmodal.co\">enmodal.co</a>.</p>"
        body += "<p>Your temporary password is:</p>"
        body += "<p><strong>"+new_password+"</strong></p>"
        body += "<p>We recommend that you <a href=\"http://app.enmodal.co/user\">log in</a> with your new password and change it as soon as possible.</p>"
        body += "<p>- enmodal account management robot</p>"
        
        content = Content("text/html", body)
        mail = Mail(from_email, subject, to_email, content)
        response = sg.client.mail.send.post(request_body=mail.get())
        
        cursor.execute("UPDATE users SET password_hash = %s, password_reset = %s WHERE id = %s", (password_hash, False, id))
        conn.commit()
        
if __name__ == "__main__":
    send_registration_emails()
    reset_passwords()