with open("backend/main.py", "r") as f:
    content = f.read()

old_block = """    if sp_looks_signed_out(att_html):
        raise _fail("""

new_block = """    if sp_looks_signed_out(att_html):
        print(f"DEBUG: Session expired trigger! att_html length: {len(att_html)}", flush=True)
        with open("expired_att.html", "w") as f:
            f.write(att_html)
        raise _fail("""

content = content.replace(old_block, new_block)

with open("backend/main.py", "w") as f:
    f.write(content)
