import os

print("Checking Notion setup")
print("")

if os.path.exists(".env"):
    with open(".env","r",encoding="utf-8") as f:
        for line in f:
            if line.startswith("NOTION_"):
                key=line.split("=",1)[0]
                print(key+"=FOUND")
else:
    print(".env missing")

print("")
print("Required:")
print("NOTION_API_KEY")
print("NOTION_PARENT_PAGE_ID")
print("")

