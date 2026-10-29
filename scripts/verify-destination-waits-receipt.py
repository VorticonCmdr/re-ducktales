"""Validate a historical focused milestone receipt; this is not fresh campaign acceptance."""
import hashlib, io, json, pathlib, subprocess, sys, tarfile, zipfile

manifest_path = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'reference/destination-waits-integration.json')
def require(path):
    try:
        return pathlib.Path(path).read_bytes()
    except FileNotFoundError:
        raise RuntimeError(f'SETUP: missing destination-waits receipt artifact {path}') from None

def sha(data):
    return hashlib.sha256(data).hexdigest()

m = json.loads(require(manifest_path))
assert m['completed'] is True
assert m['sourceFileCount'] == 558
assert m['expected'] == {'unitCases': 123, 'browserCases': 4, 'skipped': 0, 'nativeInputReads': 10, 'nativePictures': 4}
assert sha(require('reference/build.json')) == m['buildManifestSha256']
assert len(m['artifacts']) == m['artifactCount'] > 10
for role, artifact in m['artifacts'].items():
    data = require(artifact['path'])
    assert len(data) == artifact['bytes'], f'Truncated {role}'
    assert sha(data) == artifact['sha256'], f'Corrupt {role}'

def load(role):
    return require(m['artifacts'][role]['path'])

runner = json.loads(load('runner-status.json'))
assert runner['completed'] is True
assert runner['sourceCommit'] == m['sourceCommit']
commands = [
    ('focused', ['npm','run','verify:destination-waits']),
    ('native', ['npm','run','verify:destination']),
    ('native-video', ['npm','run','verify:destination-video']),
    ('campaign', ['npm','run','verify:campaign']),
    ('departure', ['npm','run','verify:departure']),
    ('atomic', ['npm','run','verify:atomic']),
    ('build', ['npm','run','build','--','--outDir','/private/tmp/destination-waits-committed-build']),
]
assert runner['steps'] == [{'name': name, 'command': cmd, 'exitCode': 0} for name, cmd in commands]
source = json.loads(load('source-revision.json'))
assert source['commit'] == m['sourceCommit']
assert len(source['files']) == 558
assert sha(load('sources.zip')) == source['archiveSha256']
archive = subprocess.check_output(['git','archive','--format=tar',m['sourceCommit']])
with tarfile.open(fileobj=io.BytesIO(archive)) as git, zipfile.ZipFile(io.BytesIO(load('sources.zip'))) as saved:
    files = {entry.name: git.extractfile(entry).read() for entry in git if entry.isfile()}
    assert set(files) == set(source['files']) == set(saved.namelist())
    for name, data in files.items():
        assert sha(data) == source['files'][name], f'Git source {name}'
        assert saved.read(name) == data, f'Archived source {name}'

focused = load('focused.log').decode()
for marker in ['tests 123', 'pass 123', 'fail 0', 'skipped 0', '4 passed', 'omitted real Right make rejected']:
    assert marker in focused, f'Missing focused result {marker}'
assert json.loads(load('browser/.last-run.json')) == {'status':'passed','failedTests':[]}
negative = load('browser-negative/omit-right.log').decode()
for marker in ['Required Right make selects flight', '1 failed']:
    assert marker in negative
for marker in ['TimeoutError', 'Test timeout', 'SETUP:', 'No tests found']:
    assert marker not in negative
for name, marker in [('native.log','5 carried original'), ('native-video.log','29 stable owned CPU snapshots'), ('campaign.log','35 carried original'), ('departure.log','2 negative controls rejected'), ('atomic.log','negative controls passed'), ('build.log','built in')]:
    assert marker in load(name).decode(), f'Missing result {name}'
print('Destination wait receipt:558 exact archived Git files;123 units,4 real browser cases,missing-input control,original comparisons and build passed. Historical focused evidence,not whole-campaign acceptance.')
