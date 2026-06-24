"""Aggregate model imports so SQLAlchemy registers all tables.

Importing this package (``from app import models``) is enough to populate
``Base.metadata`` with every table.
"""
from app.models.user import Contact, User
from app.models.conversation import Conversation, ConversationMember
from app.models.message import Attachment, Message, MessageReceipt, Reaction

__all__ = [
    "User",
    "Contact",
    "Conversation",
    "ConversationMember",
    "Message",
    "MessageReceipt",
    "Reaction",
    "Attachment",
]
