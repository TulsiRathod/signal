"""Pydantic request/response models.

Kept in a single module for easy scanning given the assignment scope.
"""
from datetime import datetime

from pydantic import BaseModel, ConfigDict


# ----------------------------- Auth -----------------------------
class RequestOTP(BaseModel):
    phone: str


class VerifyOTP(BaseModel):
    phone: str
    otp: str


class CompleteProfile(BaseModel):
    display_name: str
    avatar_url: str | None = None
    username: str | None = None
    about: str | None = None


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    is_new_user: bool
    user: "UserOut"


# ----------------------------- Users -----------------------------
class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    phone: str
    username: str | None
    display_name: str
    avatar_url: str | None
    about: str
    is_online: bool
    last_seen: datetime


class UserUpdate(BaseModel):
    display_name: str | None = None
    username: str | None = None
    avatar_url: str | None = None
    about: str | None = None


# --------------------------- Contacts ---------------------------
class ContactCreate(BaseModel):
    phone: str | None = None
    user_id: int | None = None
    nickname: str | None = None


class ContactOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nickname: str | None
    contact_user: UserOut


# ------------------------- Conversations -------------------------
class ConversationCreate(BaseModel):
    type: str = "direct"  # direct | group
    member_ids: list[int] = []
    name: str | None = None
    avatar_url: str | None = None


class MemberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    role: str
    user: UserOut


class ReactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    emoji: str
    user_id: int


class AttachmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    url: str
    type: str
    filename: str | None
    size: int | None


class ReplyPreview(BaseModel):
    id: int
    sender_id: int
    content: str
    type: str


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    conversation_id: int
    sender_id: int
    content: str
    type: str
    status: str
    reply_to_id: int | None
    disappear_after: int | None
    is_deleted: bool
    edited_at: datetime | None
    created_at: datetime
    reactions: list[ReactionOut] = []
    attachments: list[AttachmentOut] = []
    reply_to: ReplyPreview | None = None
    read_by: list[int] = []  # user ids who have read this message


class ConversationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    type: str
    name: str | None
    avatar_url: str | None
    created_by: int | None
    updated_at: datetime
    disappear_seconds: int | None = None
    members: list[MemberOut] = []
    last_message: MessageOut | None = None
    unread_count: int = 0


class SetDisappearing(BaseModel):
    seconds: int | None = None  # None or 0 turns it off


class AttachmentIn(BaseModel):
    url: str
    type: str = "image"
    filename: str | None = None
    size: int | None = None


class MessageCreate(BaseModel):
    conversation_id: int
    content: str = ""
    type: str = "text"
    reply_to_id: int | None = None
    disappear_after: int | None = None
    attachments: list[AttachmentIn] = []


class ReactionCreate(BaseModel):
    emoji: str


class AddMembers(BaseModel):
    user_ids: list[int]


Token.model_rebuild()
