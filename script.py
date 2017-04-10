#!/usr/bin/python

import sqlite3
import click
from flask import Flask, jsonify, render_template, request


### Flask Server

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/data')
def data():
    tag = request.args.get('tag')
    begin_date = request.args.get('start', '2000-01-01')
    data = [list(row) for row in search_tag(tag, begin_date)]
    return jsonify(results=data)

conn = sqlite3.connect('stack_overflow.db')
c = conn.cursor()


### Database population

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


def search_tag(tag, begin_date):
    return c.execute('''
            select ddate, count(*)
                from (select tags, date(cdate) as ddate from POSTS
                        where cdate > "{begin_date}")
                where tags like "%{tag}%"
            group by ddate
        '''.format(tag=tag, begin_date=begin_date))


### Command Line Interface

@click.group()
def main():
    pass

@main.command(help='recreate the database from an xml file')
@click.argument('xml_file')
def recreate(xml_file):
    create_db()
    insert_xml(soup(xml_file))

@main.command(help="change this to whatever query you want to execute")
def myquery():
    print('querying...')
    for row in c.execute('''
        select * from Posts where cdate < '2008-08-20'
    '''):
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
