import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User

router = APIRouter(prefix="/api/users", tags=["users"])


class UserResponse(BaseModel):
    id: str
    name: str
    email: str | None
    fiscal_year: str

    model_config = {"from_attributes": True}


class UserCreate(BaseModel):
    name: str
    email: str | None = None
    fiscal_year: str = "2025/26"


class UserUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    fiscal_year: str | None = None


def _to_response(u: User) -> UserResponse:
    return UserResponse(id=str(u.id), name=u.name, email=u.email, fiscal_year=u.fiscal_year)


@router.get("/", response_model=list[UserResponse])
async def list_users(db: AsyncSession = Depends(get_db)):
    stmt = select(User).order_by(User.name)
    result = await db.execute(stmt)
    return [_to_response(u) for u in result.scalars().all()]


@router.post("/", response_model=UserResponse, status_code=201)
async def create_user(user: UserCreate, db: AsyncSession = Depends(get_db)):
    entry = User(name=user.name, email=user.email, fiscal_year=user.fiscal_year)
    db.add(entry)
    await db.flush()
    await db.refresh(entry)
    return _to_response(entry)


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(user_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(User).where(User.id == uuid.UUID(user_id))
    result = await db.execute(stmt)
    u = result.scalar_one_or_none()
    if u is None:
        raise HTTPException(status_code=404, detail="User not found")
    return _to_response(u)


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(user_id: str, update: UserUpdate, db: AsyncSession = Depends(get_db)):
    stmt = select(User).where(User.id == uuid.UUID(user_id))
    result = await db.execute(stmt)
    u = result.scalar_one_or_none()
    if u is None:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(u, field, value)

    await db.flush()
    await db.refresh(u)
    return _to_response(u)


@router.delete("/{user_id}", status_code=204)
async def delete_user(user_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(User).where(User.id == uuid.UUID(user_id))
    result = await db.execute(stmt)
    u = result.scalar_one_or_none()
    if u is None:
        raise HTTPException(status_code=404, detail="User not found")
    await db.delete(u)
    await db.flush()
