import hashlib
import json
import subprocess
from pathlib import Path

before = 'CFEFF8EABEC9E9461C782971E7DD43471690C09D5C58C74D586BE2E3B017720D'
current = Path('index.html').read_bytes()
after = hashlib.sha256(current).hexdigest().upper()
original = subprocess.check_output(['git', 'show', 'main:index.html'])
record = {'file': 'index.html', 'sha256_before': before, 'sha256_after': after,
          'hashes_equal': before == after, 'bytes_equal_to_main': current == original}
Path('test-results/preservation.json').write_text(json.dumps(record, indent=2), encoding='utf-8')
print(json.dumps(record, indent=2))
assert record['hashes_equal'] and record['bytes_equal_to_main']
