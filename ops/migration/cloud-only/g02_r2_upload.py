"""G02: upload private source backups to account-owned R2; read back every byte.
No database import, no public artifact, no customer data in CI output."""
import hashlib
import json
import os
import re
import sys
import tempfile
from pathlib import Path
import boto3
from botocore.config import Config

FILES = ('source.dump','source-inventory.json','restore-list.txt')

def sha(path):
    d=hashlib.sha256()
    with open(path,'rb') as f:
        for chunk in iter(lambda:f.read(1048576),b''):
            d.update(chunk)
    return d.hexdigest()

def main(root,run_id):
    root=Path(root)
    if not re.fullmatch(r'[0-9]+',run_id):
        raise ValueError('Invalid run id')
    endpoint=os.environ['R2_ENDPOINT'].rstrip('/')
    bucket=os.environ['R2_BUCKET']
    if not endpoint.startswith('https://') or not re.fullmatch(r'[a-z0-9][a-z0-9.-]{2,62}',bucket):
        raise ValueError('Unacceptable PRIVATE R2 target')
    client=boto3.client('s3',endpoint_url=endpoint,region_name='auto',
        aws_access_key_id=os.environ['R2_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['R2_SECRET_ACCESS_KEY'],
        config=Config(signature_version='s3v4',s3={'addressing_style':'path'}))
    key_prefix='dreamledger-private-source-g02/'+run_id
    proof={'schema':'beck/g02-r2-private-backup/v1','run_id':run_id,
           'status':'SOURCE_BACKUP_READBACK_VERIFIED',
           'source_project_ref':os.environ['G02_SOURCE_PROJECT_REF'],
           'neon_imported':False,'production_migrated':False,
           'verified_revenue':False,'private_files':[]}
    for name in FILES:
        path=root/name
        if not path.is_file() or path.stat().st_size==0:
            raise RuntimeError('Expected nonempty backup file missing: '+name)
        expected=sha(path)
        key=key_prefix+'/'+name
        client.upload_file(str(path),bucket,key,ExtraArgs={'Metadata':{'sha256':expected}})
        with tempfile.NamedTemporaryFile() as tmp:
            client.download_file(bucket,key,tmp.name)
            actual=sha(tmp.name)
        if actual!=expected:
            raise RuntimeError('R2 read-back hash mismatch: '+name)
        proof['private_files'].append({'name':name,'bytes':path.stat().st_size,
                                      'sha256':expected,'r2_readback':'PASS'})
    # The R2 manifest is PRIVATE. Do not print keys, bucket or SQL/table names.
    payload=json.dumps(proof,sort_keys=True).encode('utf-8')
    client.put_object(Bucket=bucket,Key=key_prefix+'/manifest.json',Body=payload,
                      ContentType='application/json')
    recheck=client.get_object(Bucket=bucket,Key=key_prefix+'/manifest.json')['Body'].read()
    if recheck!=payload:
        raise RuntimeError('R2 manifest readback mismatch')
    print('G02_PRIVATE_R2_READBACK=PASS; FILES='+str(len(FILES)))
    print('G02_NO_PRODUCTION_MUTATIONS=PASS; DATA_NOT_IMPORTED')
if __name__=='__main__':
    if len(sys.argv)!=3:
        raise SystemExit('usage: g02_r2_upload.py PRIVATE_SOURCE_DIRECTORY RUN_ID')
    main(sys.argv[1],sys.argv[2])
