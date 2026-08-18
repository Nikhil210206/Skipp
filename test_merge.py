def merge_cookies(cookie_str: str, new_headers: list[str] | None) -> str:
    cookies = {}
    if cookie_str:
        for part in cookie_str.split(';'):
            part = part.strip()
            if '=' in part:
                k, v = part.split('=', 1)
                cookies[k] = v
    if new_headers:
        for header in new_headers:
            main_part = header.split(';')[0].strip()
            if '=' in main_part:
                k, v = main_part.split('=', 1)
                cookies[k] = v
    return '; '.join([f"{k}={v}" for k, v in cookies.items()])

c_str = "JSESSIONID=123; TS0001=abc"
new_h = ["JSESSIONID=456.worker1; Path=/", "TS0001=def; Path=/"]
print(merge_cookies(c_str, new_h))
