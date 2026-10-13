import hashlib
import json
import subprocess
from pathlib import Path

before = 'CFEFF8EABEC9E9461C782971E7DD43471690C09D5C58C74D586BE2E3B017720D'
current = Path('index.html').read_bytes()
after = hashlib.sha256(current).hexdigest().upper()
main_blob = subprocess.check_output(['git', 'rev-parse', 'main:index.html'], text=True).strip()
working_blob = subprocess.check_output(['git', 'hash-object', '--path=index.html', 'index.html'], text=True).strip()
record = {'file': 'index.html', 'sha256_before': before, 'sha256_after': after,
          'hashes_equal': before == after, 'git_blob_main': main_blob,
          'git_blob_working': working_blob, 'git_content_equal_to_main': working_blob == main_blob,
          'note': 'Working file SHA-256 proves byte preservation; Git comparison applies configured CRLF/LF normalization.'}
Path('test-results/preservation.json').write_text(json.dumps(record, indent=2), encoding='utf-8')
print(json.dumps(record, indent=2))
assert record['hashes_equal'] and record['git_content_equal_to_main']
