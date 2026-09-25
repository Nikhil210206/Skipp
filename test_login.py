import asyncio
from backend.services.sp_auto import auto_login_and_fetch
import os

print(auto_login_and_fetch("ab1234", "dummy_password"))
