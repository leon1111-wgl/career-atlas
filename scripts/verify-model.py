"""Verify every hosted model byte before deployment (no network or credentials)."""
import hashlib,json,pathlib,sys
root=pathlib.Path(__file__).resolve().parents[1]
manifest=json.loads((root/'web/model-manifest.json').read_text())
folder=pathlib.Path(sys.argv[1])
entries=manifest['files']
for item in entries:
    path=folder/item['path']
    if not path.is_file():raise SystemExit(f'Missing model file: {path.name}')
    body=path.read_bytes()
    if len(body)!=item['bytes'] or hashlib.sha256(body).hexdigest()!=item['sha256']:raise SystemExit(f'Model integrity mismatch: {path.name}')
print(f'Verified {len(entries)} pinned model files')
