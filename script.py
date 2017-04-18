#!/usr/bin/python

import sqlite3
import click
import atexit

DB_NAME = 'full.db'

### Database population

def setdb(db):
    global conn
    global c
    conn = sqlite3.connect(db)
    c = conn.cursor()


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
    os.system('env FLASK_APP=server.py FLASK_DEBUG=1 flask run')

if __name__ == "__main__":
    main()
