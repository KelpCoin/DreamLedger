import sys
import os
sys.path.insert(0, os.path.dirname(__file__))
from env_loader import load_env_file
load_env_file(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))
import os
from notion_client import Client

key = os.environ.get("NOTION_API_KEY")
db = os.environ.get("NOTION_DATABASE_ID")

if not key:
    raise Exception("Missing NOTION_API_KEY")

if not db:
    raise Exception("Missing NOTION_DATABASE_ID")

notion = Client(auth=key)

result = notion.data_sources.query(
    database_id=db,
    page_size=1
)

print("NOTION CONNECTION PASS")
print("Pages returned:", len(result.get("results", [])))


