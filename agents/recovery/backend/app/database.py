from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.config import settings

# If SQLite, ensure foreign keys and thread safety
is_sqlite = settings.DATABASE_URL.startswith("sqlite")
connect_args = {"check_same_thread": False} if is_sqlite else {}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    echo=False
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    import app.models  # Ensure all models are registered
    Base.metadata.create_all(bind=engine)

    # Lightweight schema migration for SQLite
    if is_sqlite:
        from sqlalchemy import text
        with engine.connect() as conn:
            try:
                # Check charges table columns
                res = conn.execute(text("PRAGMA table_info(charges)")).fetchall()
                cols = {r[1] for r in res}
                if cols and "unit_id" not in cols:
                    conn.execute(text("ALTER TABLE charges ADD COLUMN unit_id VARCHAR(100)"))
                if cols and "source_dataset" not in cols:
                    conn.execute(text("ALTER TABLE charges ADD COLUMN source_dataset VARCHAR(50) DEFAULT 'internal' NOT NULL"))

                # Check evidence table columns
                res_ev = conn.execute(text("PRAGMA table_info(evidence)")).fetchall()
                ev_cols = {r[1] for r in res_ev}
                if ev_cols and "unit_id" not in ev_cols:
                    conn.execute(text("ALTER TABLE evidence ADD COLUMN unit_id VARCHAR(100)"))
                if ev_cols and "source_dataset" not in ev_cols:
                    conn.execute(text("ALTER TABLE evidence ADD COLUMN source_dataset VARCHAR(50) DEFAULT 'internal' NOT NULL"))
                conn.commit()
            except Exception:
                pass
