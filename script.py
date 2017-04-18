#!/usr/bin/python

import sqlite3
import click
import os
import atexit
import json
from flask import Flask, jsonify, render_template, request, send_from_directory


DB_NAME = 'full.db'
CACHE_FILE = 'cache.json'

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
    end_date = request.args.get('end', '3000-01-01')
    data = search_tag(tag, begin_date, end_date)
    return jsonify(results=data)

conn = sqlite3.connect(DB_NAME)  #('stack_overflow.db')
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
# The xml file is ordered by by creation date of the post, so the SQL data is also ordered in this way.
def import_from_xml(f):
    import xml.etree.ElementTree as xml
    data = xml.iterparse(open(f), events=("start", "end"))
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
            root.clear() # delete everything in memory, otherwise Python tries to remember the whole DB

        if (i % 5000 == 0):
            print ('commiting after %d rows' % i)
            conn.commit()

class Cache(object):
    def __init__(self):
        print('initializing cache')
        try:
            self.data = json.load(open(CACHE_FILE, 'r'))
        except (IOError, ValueError):
            print('loaded cache, but no data was found.')
            self.data = {}

    def __call__(self, tag, begin_date, end_date, results=None):
        key = repr( (tag, begin_date, end_date) )
        if results is None:
            return self.data[key]
        else:
            print('actually caching data')
            print('before', self.data)
            self.data[key] = results
            print('after', self.data)

    def save(self):
        print('saving data')
        print(self.data)
        json.dump(self.data, open(CACHE_FILE, 'w+'))

cache = Cache()

@atexit.register
def save():
    cache.save()

# Excludes weekends because few people are programming during the weekend.
# which creates a distracting oscillation in the graphs.
def search_tag(tag, begin_date, end_date):
    try:
        return cache(tag, begin_date, end_date)
    except KeyError:
        pass
    results =  c.execute('''
        select ddate, count(*)
            from (select tags, date(cdate) as ddate from POSTS
                    where cdate > "{begin_date}" and cdate < "{end_date}" and strftime("%w", cdate) not in ("0","6")) 
            where tags like "%{tag}%"
        group by ddate
    '''.format(tag=tag, begin_date=begin_date, end_date=end_date))
    result_list = [list(row) for row in results]
    print('trying to cache data')
    cache(tag, begin_date, end_date, results=result_list)
    return result_list



def setdb(db):
    global conn
    global c
    conn = sqlite3.connect(db)
    c = conn.cursor()

### Command Line Interface

@click.group()
def main():
    pass

@main.command(help='recreate the database from an xml file')
@click.option('--db', default=None)
@click.argument('xml_file')
def recreate(xml_file, db):
    if db:
        setdb(db)
    create_db()
    import_from_xml(xml_file)

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
