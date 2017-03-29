# Idea: The browser will have the data loaded in the format and we will expose functions

# [ ] create database
# [ ] view data in browser using d3
# [ ] run an interesting sql query in python
# [ ] view the results graphed in d3

# The visualization will allow the user to see multuple tags defined over time.
# View python2 vs python3 over time, like google trends, but with stack overflow tags

import sqlite3
conn = sqlite3.connect('stack_overflow.db')
c = conn.cursor()


def create_db():
    c.execute('drop table POSTS')
    c.execute('create table POSTS (tags Text, cdate date)')


def insert_xml():
    for tag, cdate in soup():
        cmd = 'insert into POSTS (tags, cdate) values ("%s", "%s")' % (tag, cdate)
        c.execute(cmd)
        conn.commit()


def soup():
    import sys
    from bs4 import BeautifulSoup
    lines = open(sys.argv[1]).read()
    soup = BeautifulSoup(lines, 'html.parser')
    for i, post  in enumerate(soup.find_all('row')):
        try:
            tags = post['tags']
            cdate = post['creationdate']
            yield tags, cdate
        except KeyError:
            pass


def executed_commands():
    """the commands I have executed to create or modify data in the database"""
    return
    create_db()
    insert_xml()


def science():
    """conduct rigorous scientific experimentation"""
    tag = "java"
    return c.execute('''
            select count(*), ddate
                from (select tags, date(cdate) as ddate from POSTS)
                where tags like "%s"
            group by ddate
        ''' % tag)

from flask import Flask, jsonify, render_template

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html') #format data as javascript array

@app.route('/data')
def data():
    data = [list(row) for row in science()]
    return jsonify(results=data)



