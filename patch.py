with open("backend/main.py", "r") as f:
    content = f.read()

old_block = """    except StudentPortalClientError as e:
        msg = str(e)
        if "Invalid captcha" in msg:"""

new_block = """    except StudentPortalClientError as e:
        msg = str(e)
        import sys
        print(f"DEBUG_LOGIN_ERROR: {msg}", file=sys.stderr)
        if "Invalid captcha" in msg:"""

content = content.replace(old_block, new_block)

old_block2 = """        raise _fail(401, "login_failed", msg)

    if sp_looks_signed_out(att_html):"""

new_block2 = """        raise _fail(401, "login_failed", msg)
    except Exception as e:
        import sys, traceback
        traceback.print_exc()
        print(f"DEBUG_UNHANDLED_ERROR: {e}", file=sys.stderr)
        raise _fail(500, "internal_error", str(e))

    if sp_looks_signed_out(att_html):"""

content = content.replace(old_block2, new_block2)

with open("backend/main.py", "w") as f:
    f.write(content)
