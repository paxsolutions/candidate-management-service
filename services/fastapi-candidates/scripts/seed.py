"""Seed the candidates table with sample data for local development."""

import asyncio
import random
from datetime import datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.models import Base, Candidate

FIRST_NAMES = [
    "Alice",
    "Bob",
    "Charlie",
    "Diana",
    "Erik",
    "Fiona",
    "George",
    "Hannah",
    "Ivan",
    "Julia",
    "Kevin",
    "Laura",
    "Mike",
    "Nina",
    "Oscar",
    "Patricia",
    "Quincy",
    "Rachel",
    "Sam",
    "Tina",
]

LAST_NAMES = [
    "Anderson",
    "Brown",
    "Clark",
    "Davis",
    "Evans",
    "Foster",
    "Garcia",
    "Harris",
    "Ingram",
    "Jones",
    "King",
    "Lee",
    "Martinez",
    "Nelson",
    "Owens",
    "Patel",
    "Quinn",
    "Roberts",
    "Smith",
    "Taylor",
]

STATES = [
    "California",
    "New York",
    "Texas",
    "Florida",
    "Illinois",
    "Pennsylvania",
    "Ohio",
    "Georgia",
    "North Carolina",
    "Michigan",
]

FAVOURITES = [
    "Engineering",
    "Design",
    "Marketing",
    "Sales",
    "Support",
    "Product",
    "Finance",
    "Operations",
    "HR",
    "Legal",
]


def _random_candidate(i: int) -> Candidate:
    first = random.choice(FIRST_NAMES)
    last = random.choice(LAST_NAMES)
    state = random.choice(STATES)
    fav = random.choice(FAVOURITES)
    created = datetime.utcnow() - timedelta(days=random.randint(1, 365))

    return Candidate(
        id=i,
        first_name=first,
        last_name=last,
        email=f"{first.lower()}.{last.lower()}@example.com",
        phone_number=f"555-{random.randint(1000, 9999)}",
        state=state,
        favourite=fav,
        create_time=created,
        notes=f"Sample notes for {first} {last}.",
        upload_file="",
        upload_photo="",
    )


async def seed(count: int = 50) -> None:
    """Insert `count` random candidates into the database."""
    engine = create_async_engine(settings.database_url, echo=False)
    session_factory = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with session_factory() as session:
        for i in range(1, count + 1):
            session.add(_random_candidate(i))
        await session.commit()
        print(f"Seeded {count} candidates.")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
