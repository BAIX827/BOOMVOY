"""Verify a BOOMVOY illustration ZIP using only Python's standard library."""
import argparse
import hashlib
import json
import zipfile
from pathlib import Path, PurePosixPath

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('archive', type=Path)
args = parser.parse_args()
sidecar = args.archive.with_suffix('.zip.sha256')
if sidecar.exists():
    expected = sidecar.read_text(encoding='ascii').split()[0]
    assert hashlib.sha256(args.archive.read_bytes()).hexdigest() == expected, 'Archive SHA-256 mismatch'
with zipfile.ZipFile(args.archive) as bundle:
    assert bundle.testzip() is None, 'ZIP CRC verification failed'
    for name in bundle.namelist():
        path = PurePosixPath(name)
        assert not path.is_absolute() and '..' not in path.parts and ':' not in name and '\\' not in name, 'Unsafe archive path'
    inventory = json.loads(bundle.read('docs/illustration-assets.json'))
    checked = 0
    for asset in inventory['assets']:
        for kind in ['master', 'web', 'web480']:
            record = asset[kind]
            content = bundle.read(record['path'])
            assert len(content) == record['bytes'], f"Size mismatch: {record['path']}"
            assert hashlib.sha256(content).hexdigest() == record['sha256'], f"SHA-256 mismatch: {record['path']}"
            checked += 1
print(f'Verified {len(inventory["assets"])} assets / {checked} image files; archive structure and checksums passed.')
