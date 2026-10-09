import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent.parent))

from backend.app.database.sqlite import SessionLocal, Facility, PurchaseOrderDB, Metric

def seed():
    db = SessionLocal()
    if db.query(Facility).count() > 0:
        return
    
    t1 = "tenant_1"
    t2 = "tenant_2"
    
    facs = [
        Facility(id="fac_1", tenant_id=t1, name="Alpha Logistics 3PL"),
        Facility(id="fac_2", tenant_id=t1, name="Beta Warehouse"),
        Facility(id="fac_3", tenant_id=t2, name="Gamma Cross-dock")
    ]
    db.bulk_save_objects(facs)
    
    pos = [
        PurchaseOrderDB(po_id="PO-9001", tenant_id=t1, sku="BLUE-BOTTLE-001", expected_quantity=24, expected_cartons=2),
        PurchaseOrderDB(po_id="PO-9002", tenant_id=t1, sku="RED-BOTTLE-002", expected_quantity=12, expected_cartons=1),
        PurchaseOrderDB(po_id="PO-9003", tenant_id=t1, sku="GREEN-BOTTLE-003", expected_quantity=48, expected_cartons=4),
        PurchaseOrderDB(po_id="PO-9004", tenant_id=t1, sku="BLUE-BOTTLE-001", expected_quantity=24, expected_cartons=2),
        PurchaseOrderDB(po_id="PO-9005", tenant_id=t1, sku="RED-BOTTLE-002", expected_quantity=12, expected_cartons=1),
        PurchaseOrderDB(po_id="PO-9006", tenant_id=t2, sku="TENT-01", expected_quantity=5, expected_cartons=5),
        PurchaseOrderDB(po_id="PO-9007", tenant_id=t2, sku="TENT-02", expected_quantity=10, expected_cartons=10),
        PurchaseOrderDB(po_id="PO-9008", tenant_id=t2, sku="CHAIR-01", expected_quantity=20, expected_cartons=10),
        PurchaseOrderDB(po_id="PO-9009", tenant_id=t2, sku="CHAIR-02", expected_quantity=40, expected_cartons=20),
        PurchaseOrderDB(po_id="PO-9010", tenant_id=t2, sku="TABLE-01", expected_quantity=2, expected_cartons=2),
    ]
    db.bulk_save_objects(pos)
    
    metrics = [
        Metric(tenant_id=t1, pass_count=100, fail_count=10, uncertain_count=5, avg_latency=1.2),
        Metric(tenant_id=t2, pass_count=50, fail_count=5, uncertain_count=2, avg_latency=1.5),
    ]
    db.bulk_save_objects(metrics)
    
    db.commit()
    db.close()

if __name__ == "__main__":
    seed()
    print("Database seeded.")
