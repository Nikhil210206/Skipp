import asyncio
from backend.core.student_portal_client import init_login_session, submit_login_and_fetch
from backend.models.schemas import SPLoginRequest

async def test():
    print("Init session...")
    init_data = await init_login_session()
    print("Got cookies:", init_data.cookies)
    
    req_data = SPLoginRequest(
        username="nb6938",
        password="Password123",
        captcha="WRONGX",
        cookies=init_data.cookies,
        random_delim=init_data.random_delim,
        domain_field=init_data.domain_field,
        captcha_field=init_data.captcha_field
    )
    
    try:
        await submit_login_and_fetch(req_data)
    except Exception as e:
        print("Error:", repr(e))

asyncio.run(test())
