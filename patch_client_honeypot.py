import re
with open("backend/core/student_portal_client.py", "r") as f:
    content = f.read()

# 1. Update init_login_session
old_init = """        captcha_field = re.search(r"captchaFieldName\s*=\s*'([^']+)'", html).group(1)
        random_delim = re.search(r"randomDelimiter\s*=\s*'([^']+)'", html).group(1)"""
new_init = """        captcha_field = re.search(r"captchaFieldName\s*=\s*'([^']+)'", html).group(1)
        random_delim = re.search(r"randomDelimiter\s*=\s*'([^']+)'", html).group(1)
        
        honeypot_match = re.search(r'id="(ph_[a-f0-9]+)"', html)
        if not honeypot_match:
            print("WARNING: Could not extract honeypot field name! Using default ph_cf19b370")
            honeypot_field = "ph_cf19b370"
        else:
            honeypot_field = honeypot_match.group(1)
"""
content = content.replace(old_init, new_init)

old_return = """        return StudentPortalCaptchaResponse(
            session_cookie=session_cookie,
            domain_field=domain_field,
            captcha_field=captcha_field,
            random_delim=random_delim,
            captcha_base64=b64_captcha
        )"""
new_return = """        return StudentPortalCaptchaResponse(
            session_cookie=session_cookie,
            domain_field=domain_field,
            captcha_field=captcha_field,
            random_delim=random_delim,
            honeypot_field=honeypot_field,
            captcha_base64=b64_captcha
        )"""
content = content.replace(old_return, new_return)

# 2. Update submit_login_and_fetch
old_form = """    form_data = {
        'username': req_data.username,
        'password': req_data.password,
        'captcha': req_data.captcha,
        req_data.domain_field: domain_value,
        req_data.captcha_field: captcha_trap_value,
        'telemetryPayload': telemetry_payload
    }"""
new_form = """    form_data = {
        'username': req_data.username,
        'password': req_data.password,
        'captcha': req_data.captcha,
        req_data.domain_field: domain_value,
        req_data.captcha_field: captcha_trap_value,
        req_data.honeypot_field: '',
        'fpPayload': '',
        'fpToken': '',
        'telemetryPayload': telemetry_payload
    }"""
content = content.replace(old_form, new_form)

with open("backend/core/student_portal_client.py", "w") as f:
    f.write(content)
