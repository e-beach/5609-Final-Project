#!/usr/bin/python

import sqlite3
import atexit
import json
from flask import Flask, jsonify, render_template, request, send_from_directory

DB_NAME = 'full.db'
CACHE_FILE = 'cache.json'

### Flask Server

app = Flask(__name__)
conn = sqlite3.connect(DB_NAME)  #('stack_overflow.db')
c = conn.cursor()

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
    cache.save()
    return result_list


class Cache(object):
    def __init__(self):
        try:
            self.data = json.load(open(CACHE_FILE, 'r'))
        except (IOError, ValueError):
            self.data = {}

    def __call__(self, tag, begin_date, end_date, results=None):
        key = repr( (tag, begin_date, end_date) )
        if results is None:
            return self.data[key]
        else:
            self.data[key] = results

    def save(self):
        json.dump(self.data, open(CACHE_FILE, 'w+'))

cache = Cache()
