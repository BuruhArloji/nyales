"""Replay synthetic SELECT traces read-only; instruction count is NOT D1 billing."""
import json
import pathlib
import sqlite3
import sys

db = sqlite3.connect(pathlib.Path(sys.argv[1]).resolve().as_uri() + '?mode=ro', uri=True)
journeys = json.loads(pathlib.Path(sys.argv[2]).read_text(encoding='utf-8'))
output = []
for journey in journeys:
    queries = []
    for query in journey['queries']:
        sql, params = query['sql'], query['params']
        plan = [row[3] for row in db.execute('EXPLAIN QUERY PLAN ' + sql, params)]
        count = [0]

        def progress():
            count[0] += 1
            return 0

        db.set_progress_handler(progress, 1)
        rows = db.execute(sql, params).fetchall()
        db.set_progress_handler(None, 0)
        if len(rows) != query['returned_rows']:
            raise ValueError('Replay result count differs from captured statement')
        queries.append({'sqlite_vm_steps': count[0], 'explain_query_plan': plan})
    output.append(queries)
db.close()
print(json.dumps(output))
