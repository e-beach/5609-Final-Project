#!/usr/bin/python

# Idea: The browser will have the data loaded in the format and we will expose functions

# [ ] create database
# [ ] view data in browser using d3
# [ ] run an interesting sql query in python
# [ ] view the results graphed in d3

# The visualization will allow the user to see multuple tags defined over time.
# View python2 vs python3 over time, like google trends, but with stack overflow tags

import sqlite3
import click
from flask import Flask, jsonify, render_template

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/data')
def data():
    data = [list(row) for row in science()]
    print(data)
    return jsonify(results=data)

conn = sqlite3.connect('stack_overflow.db')
c = conn.cursor()



def create_db():
    try:
        c.execute('drop table POSTS')
    except sqlite3.OperationalError:
        # table did not exist
        pass
    c.execute('create table POSTS (tags Text, cdate date)')



def insert_xml(data):
    for tag, cdate in data:
        cmd = 'insert into POSTS (tags, cdate) values ("%s", "%s")' % (tag, cdate)
        c.execute(cmd)
        conn.commit()


def soup(f):
    from bs4 import BeautifulSoup
    lines = open(f).read()
    soup = BeautifulSoup(lines, 'html.parser')
    for i, post in enumerate(soup.find_all('row')):
        try:
            tags = post['tags']
            cdate = post['creationdate']
            yield tags, cdate
        except KeyError:
            pass


def science():
    return c.execute('''
            select ddate, count(*)
                from (select tags, date(cdate) as ddate from POSTS)
                where tags like "%java%"
            group by ddate
        ''')


@click.group()
def main():
    pass

@main.command(help='recreate the database from an xml file')
@click.argument('xml_file')
def recreate(xml_file):
    create_db()
    insert_xml(soup(xml_file))

@main.command()
def myquery():
    print('querying...')
    for row in c.execute('''
        select tags from POSTS where tags like "%java%"
    '''):
        print(row)


@main.command()
def showdb():
    for row in c.execute('''select * from POSTS order by cdate'''):
        print(row)


@main.command()
def server():
    import os
    os.system('env FLASK_APP=script.py FLASK_DEBUG=1 Flask run')

if __name__ == "__main__":
    main()
