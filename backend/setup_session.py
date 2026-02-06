#!/usr/bin/env python3
"""
Interactive script for first-time Telegram authentication.

Run this script once to create the Telethon session file.
It will prompt for your phone number and the verification code
sent by Telegram.

Usage:
    python setup_session.py
"""

import asyncio
import sys
import os

# Add parent directory to path so we can import from app
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.config import settings


async def main() -> None:
    """Run the interactive Telegram authentication flow."""
    from telethon import TelegramClient

    api_id = settings.TELEGRAM_API_ID
    api_hash = settings.TELEGRAM_API_HASH
    session_name = settings.TELEGRAM_SESSION_NAME

    print("=" * 60)
    print("  Spy Affiliation Trading - Telegram Session Setup")
    print("=" * 60)
    print()
    print(f"  API ID:       {api_id}")
    print(f"  API Hash:     {api_hash[:8]}...{api_hash[-4:]}")
    print(f"  Session Name: {session_name}")
    print()
    print("  This script will create a Telegram session file.")
    print("  You will be prompted for your phone number and")
    print("  the verification code sent by Telegram.")
    print()
    print("=" * 60)
    print()

    client = TelegramClient(session_name, api_id, api_hash)

    try:
        # client.start() handles the full auth flow interactively:
        # - Prompts for phone number
        # - Sends verification code
        # - Prompts for the code
        # - Prompts for 2FA password if enabled
        await client.start()

        me = await client.get_me()

        print()
        print("=" * 60)
        print("  Authentication successful!")
        print()
        print(f"  Logged in as: {me.first_name} {me.last_name or ''}")
        print(f"  Username:     @{me.username or 'N/A'}")
        print(f"  Phone:        {me.phone}")
        print(f"  User ID:      {me.id}")
        print()
        print(f"  Session file: {session_name}.session")
        print()
        print("  You can now start the backend server.")
        print("  The session file will be used for authentication.")
        print("=" * 60)

    except Exception as e:
        print()
        print(f"  ERROR: Authentication failed: {e}")
        print()
        print("  Please check your API ID and API Hash,")
        print("  and make sure your phone number is correct.")
        print()
        sys.exit(1)

    finally:
        await client.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
