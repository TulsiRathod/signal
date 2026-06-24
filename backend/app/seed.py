"""Seed the database with demo users, conversations and messages.

Run with:  python -m app.seed
This DROPS and recreates all tables, then inserts a ready-to-demo dataset.
All users share the mocked OTP (123456); log in with any phone below.
"""
import asyncio
from datetime import datetime, timedelta, timezone

from app.database import AsyncSessionLocal, Base, engine
from app.models import (
    Conversation,
    ConversationMember,
    Message,
    MessageReceipt,
    Reaction,
    User,
)

NOW = datetime.now(timezone.utc)


def ago(minutes: int = 0, hours: int = 0, days: int = 0) -> datetime:
    return NOW - timedelta(minutes=minutes, hours=hours, days=days)


USERS = [
    ("+15550000001", "alice", "Alice Johnson", "Hey there! I'm using Signal."),
    ("+15550000002", "bob", "Bob Martinez", "Available"),
    ("+15550000003", "carol", "Carol Singh", "At the gym 💪"),
    ("+15550000004", "dave", "Dave Chen", "Working from home"),
    ("+15550000005", "erin", "Erin O'Neil", "Travelling ✈️"),
    ("+15550000006", "frank", "Frank Müller", "Coffee enthusiast ☕"),
]


async def seed() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        users: dict[str, User] = {}
        for phone, username, name, about in USERS:
            u = User(
                phone=phone,
                username=username,
                display_name=name,
                about=about,
                is_online=False,
                last_seen=ago(minutes=username.__len__() * 7),
            )
            db.add(u)
            users[username] = u
        await db.flush()

        async def direct(a: User, b: User) -> Conversation:
            conv = Conversation(type="direct", created_by=a.id, updated_at=NOW)
            db.add(conv)
            await db.flush()
            db.add_all(
                [
                    ConversationMember(conversation_id=conv.id, user_id=a.id),
                    ConversationMember(conversation_id=conv.id, user_id=b.id),
                ]
            )
            return conv

        async def group(name: str, admin: User, members: list[User]) -> Conversation:
            conv = Conversation(
                type="group", name=name, created_by=admin.id, updated_at=NOW
            )
            db.add(conv)
            await db.flush()
            db.add(
                ConversationMember(
                    conversation_id=conv.id, user_id=admin.id, role="admin"
                )
            )
            for m in members:
                db.add(
                    ConversationMember(conversation_id=conv.id, user_id=m.id)
                )
            return conv

        last_msg_holder: dict[int, datetime] = {}

        def msg(
            conv: Conversation,
            sender: User,
            text: str,
            when: datetime,
            status: str = "read",
            readers: list[User] | None = None,
        ) -> Message:
            m = Message(
                conversation_id=conv.id,
                sender_id=sender.id,
                content=text,
                status=status,
                created_at=when,
            )
            db.add(m)
            last_msg_holder[conv.id] = when
            return m

        # --- Direct conversations ---
        ab = await direct(users["alice"], users["bob"])
        ac = await direct(users["alice"], users["carol"])
        bd = await direct(users["bob"], users["dave"])
        af = await direct(users["alice"], users["frank"])
        await db.flush()

        ab_msgs = [
            msg(ab, users["bob"], "Hey Alice! Did you get the project files?", ago(hours=5)),
            msg(ab, users["alice"], "Yes, just downloaded them. Thanks!", ago(hours=4, minutes=58)),
            msg(ab, users["bob"], "Great. Let me know if anything's missing 🙂", ago(hours=4, minutes=50)),
            msg(ab, users["alice"], "Will do. Reviewing now.", ago(hours=4, minutes=30)),
            msg(ab, users["bob"], "Want to hop on a quick call later?", ago(minutes=20), status="delivered"),
        ]

        ac_msgs = [
            msg(ac, users["carol"], "Lunch tomorrow? 🥗", ago(days=1, hours=2)),
            msg(ac, users["alice"], "Absolutely! 12:30 at the usual place?", ago(days=1, hours=1)),
            msg(ac, users["carol"], "Perfect, see you then!", ago(days=1)),
        ]

        bd_msgs = [
            msg(bd, users["dave"], "Pushed the fix to staging.", ago(hours=8)),
            msg(bd, users["bob"], "Nice, testing it now.", ago(hours=7, minutes=45)),
        ]

        af_msgs = [
            msg(af, users["frank"], "Coffee this weekend? ☕", ago(minutes=8), status="sent"),
        ]

        # --- Group conversations ---
        trip = await group(
            "Weekend Trip 🏔️",
            users["alice"],
            [users["bob"], users["carol"], users["dave"]],
        )
        design = await group(
            "Design Team",
            users["carol"],
            [users["erin"], users["frank"], users["alice"]],
        )
        await db.flush()

        msg(trip, users["alice"], "Created the group for our mountain trip!", ago(days=2))
        msg(trip, users["bob"], "Can't wait 🎉", ago(days=1, hours=20))
        msg(trip, users["carol"], "I'll book the cabin tonight.", ago(days=1, hours=18))
        msg(trip, users["dave"], "I can drive — room for 3.", ago(days=1, hours=10))
        trip_last = msg(trip, users["alice"], "Amazing, thanks Dave! 🚗", ago(hours=2))

        msg(design, users["carol"], "New mockups are in Figma.", ago(hours=6))
        msg(design, users["erin"], "Looking now 👀", ago(hours=5, minutes=50))
        msg(design, users["frank"], "Love the new color palette!", ago(hours=5, minutes=30))
        design_last = msg(design, users["alice"], "Agreed, the blue really pops.", ago(minutes=45), status="delivered")

        await db.flush()

        # A couple of reactions for flavor.
        db.add(Reaction(message_id=trip_last.id, user_id=users["bob"].id, emoji="❤️"))
        db.add(Reaction(message_id=trip_last.id, user_id=users["carol"].id, emoji="👍"))
        db.add(Reaction(message_id=design_last.id, user_id=users["frank"].id, emoji="🔥"))

        # Read receipts for the read direct messages (Alice has read Bob's chat).
        for m in ab_msgs[:-1]:
            if m.sender_id == users["bob"].id:
                db.add(
                    MessageReceipt(
                        message_id=m.id, user_id=users["alice"].id, status="read"
                    )
                )

        # Set each conversation's updated_at to its last message time.
        for conv in (ab, ac, bd, af, trip, design):
            conv.updated_at = last_msg_holder.get(conv.id, NOW)

        await db.commit()

    print("Seed complete!")
    print("Users (OTP for all = 123456):")
    for phone, username, name, _ in USERS:
        print(f"  {name:<16} {phone}  (@{username})")


if __name__ == "__main__":
    asyncio.run(seed())
