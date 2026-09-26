import sys
import asyncio
from services.sp_auto import auto_login_and_fetch

att, marks, tt = auto_login_and_fetch('nb6938', 'dummy_password') # Wait, I don't have the password.
