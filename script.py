#!/usr/bin/python

import sqlite3
import click
from flask import Flask, jsonify, render_template, request, send_from_directory


### Flask Server

app = Flask(__name__)

@app.route('/js/<path:path>')
def send_js(path):
    return send_from_directory('bower_components', path)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/data')
def data():
    tag = request.args.get('tag')
    begin_date = request.args.get('start', '2000-01-01')
    data = [list(row) for row in search_tag(tag, begin_date)]
    return jsonify(results=data)

conn = sqlite3.connect('stack_overflow.db')  #('stack_overflow.db')
c = conn.cursor()


### Database population

def create_db():
    try:
        c.execute('drop table POSTS')
    except sqlite3.OperationalError:
        # table did not exist
        pass
    c.execute('create table POSTS (tags Text, cdate date)')


# see http://stackoverflow.com/questions/324214/what-is-the-fastest-way-to-parse-large-xml-docs-in-python
def soup(f):
    import xml.etree.ElementTree as xml
    data = xml.iterparse(open(f))
    _, root = data.next()
    for i, eventelem in enumerate(data):
        event, elem = eventelem
        if event == "end":
            try:
                tag = elem.attrib['Tags']
                cdate = elem.attrib['CreationDate']
            except KeyError:
                continue
            cmd = 'insert into POSTS (tags, cdate) values ("%s", "%s")' % (tag, cdate)
            c.execute(cmd)
        if (i % 5000 == 0):
            print ('commiting after %d rows' % i)
            conn.commit()



def search_tag(tag, begin_date):
    return c.execute('''
            select ddate, count(*)
                from (select tags, date(cdate) as ddate from POSTS
                        where cdate > "{begin_date}" and strftime("%w", cdate) not in ("0","6"))
                where tags like "%{tag}%"
            group by ddate
            order by ddate ASC
        '''.format(tag=tag, begin_date=begin_date))


### Command Line Interface

@click.group()
def main():
    pass

@main.command(help='recreate the database from an xml file')
@click.argument('xml_file')
def recreate(xml_file):
    create_db()
    soup(xml_file)

@main.command(help="change this to whatever query you want to execute")
def myquery():
    print('querying...')
    for row in c.execute('''
        select strftime("%w", cdate) from Posts where cdate > '2009-01-01' and strftime("%w", cdate) not in ("0","6")
    '''): # skip the weekends: 0,6 == Saturday or Sunday.
        print(row)


@main.command()
def showdb():
    for row in c.execute('''select * from POSTS order by cdate'''):
        print(row)


@main.command()
def server():
    import os
    os.system('env FLASK_APP=script.py FLASK_DEBUG=1 flask run')

if __name__ == "__main__":
    main()
