from sqlalchemy import create_engine, Column, Integer, String, Boolean, Float
from sqlalchemy.orm import declarative_base, sessionmaker

SQLALCHEMY_DATABASE_URL = "sqlite:///./sql_app.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class Facility(Base):
    __tablename__ = "facilities"
    id = Column(String, primary_key=True, index=True)
    tenant_id = Column(String, index=True)
    name = Column(String)

class PurchaseOrderDB(Base):
    __tablename__ = "purchase_orders"
    po_id = Column(String, primary_key=True, index=True)
    tenant_id = Column(String, index=True)
    sku = Column(String)
    expected_quantity = Column(Integer)
    expected_cartons = Column(Integer)

class Metric(Base):
    __tablename__ = "metrics"
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, index=True)
    pass_count = Column(Integer, default=0)
    fail_count = Column(Integer, default=0)
    uncertain_count = Column(Integer, default=0)
    avg_latency = Column(Float, default=0.0)

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
