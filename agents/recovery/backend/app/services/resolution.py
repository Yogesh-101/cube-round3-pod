from typing import Optional, List
from sqlalchemy.orm import Session
from app.models.entities import Charge, Order, Shipment
from app.schemas.entities import EntityResolutionInfo

class EntityResolutionService:
    @staticmethod
    def resolve_charge(db: Session, charge: Charge) -> EntityResolutionInfo:
        """
        Deterministically resolves the entity hierarchy:
        charge -> shipment -> order -> SKU
        
        Rules:
        - Uses IDs first
        - Fallback only when exactly 1 deterministic candidate exists
        - NEVER guesses
        - If unable to link reliably, marks unresolved safely
        """
        unit_id = getattr(charge, "unit_id", None)
        shipment_id = charge.shipment_id
        order_id = charge.order_id
        sku = charge.sku
        notes: List[str] = []
        path_elements = [f"charge({charge.charge_id})"]

        if unit_id:
            path_elements.append(f"unit({unit_id})")
            notes.append(f"Official Cube unit identifier: '{unit_id}'")

        # Step 1: Check shipment_id
        if shipment_id:
            path_elements.append(f"shipment({shipment_id})")
            shipment_records = db.query(Shipment).filter(Shipment.shipment_id == shipment_id).all()
            if shipment_records:
                notes.append(f"Found shipment record for ID '{shipment_id}'")
                
                # Check if we can infer or confirm order_id
                shipment_orders = list({s.order_id for s in shipment_records if s.order_id})
                if not order_id and shipment_orders:
                    if len(shipment_orders) == 1:
                        order_id = shipment_orders[0]
                        notes.append(f"Deterministically resolved order_id '{order_id}' from shipment")
                    else:
                        notes.append(f"Ambiguous: shipment spans multiple orders ({shipment_orders}), cannot guess")
                elif order_id and shipment_orders:
                    if order_id in shipment_orders:
                        notes.append(f"Confirmed order_id '{order_id}' matches shipment")
                    else:
                        notes.append(f"Warning: charge order_id '{order_id}' does not match shipment orders ({shipment_orders})")

                # Check if we can infer or confirm SKU
                shipment_skus = list({s.sku for s in shipment_records if s.sku})
                if not sku and shipment_skus:
                    if len(shipment_skus) == 1:
                        sku = shipment_skus[0]
                        notes.append(f"Deterministically resolved SKU '{sku}' from shipment")
                    else:
                        notes.append(f"Ambiguous: shipment contains multiple SKUs ({shipment_skus}), cannot guess")
                elif sku and shipment_skus:
                    if sku in shipment_skus:
                        notes.append(f"Confirmed SKU '{sku}' present in shipment")
                    else:
                        notes.append(f"Warning: charge SKU '{sku}' not found in shipment SKUs ({shipment_skus})")
            else:
                notes.append(f"Shipment ID '{shipment_id}' referenced by charge not found in database")
        
        # Step 2: Fallback if shipment_id is missing, but order_id is present
        elif order_id:
            notes.append(f"Charge missing shipment_id, attempting safe resolution via order_id '{order_id}'")
            candidate_shipments = db.query(Shipment).filter(Shipment.order_id == order_id).all()
            if sku:
                # Filter candidates by SKU
                candidate_shipments = [s for s in candidate_shipments if s.sku == sku]
            
            unique_shipment_ids = list({s.shipment_id for s in candidate_shipments if s.shipment_id})
            if len(unique_shipment_ids) == 1:
                shipment_id = unique_shipment_ids[0]
                notes.append(f"Deterministically resolved unique shipment_id '{shipment_id}' for order '{order_id}'")
                path_elements.append(f"shipment({shipment_id})")
            elif len(unique_shipment_ids) > 1:
                notes.append(f"Cannot resolve shipment: multiple candidates found {unique_shipment_ids}, guessing forbidden")
            else:
                notes.append(f"No shipment found for order_id '{order_id}'")
        else:
            if not unit_id:
                notes.append("Charge has neither shipment_id nor order_id; safe entity resolution not possible")

        # Step 3: Check order
        if order_id:
            path_elements.append(f"order({order_id})")
            order_records = db.query(Order).filter(Order.order_id == order_id).all()
            if order_records:
                notes.append(f"Found order record for ID '{order_id}'")
                order_skus = list({o.sku for o in order_records if o.sku})
                if not sku and order_skus:
                    if len(order_skus) == 1:
                        sku = order_skus[0]
                        notes.append(f"Deterministically resolved SKU '{sku}' from order")
            else:
                notes.append(f"Order ID '{order_id}' not found in database")

        if sku:
            path_elements.append(f"sku({sku})")

        # Step 4: Determine resolution status
        if shipment_id and order_id and sku:
            resolution_status = "RESOLVED"
        elif (shipment_id or order_id) and sku:
            # If inbound defect fee or inventory adjustment where order is not applicable, but unit and shipment are known
            resolution_status = "RESOLVED" if unit_id else "PARTIALLY_RESOLVED"
        elif shipment_id or order_id or unit_id:
            resolution_status = "PARTIALLY_RESOLVED"
        else:
            resolution_status = "UNRESOLVED"

        resolution_path = " -> ".join(path_elements)

        return EntityResolutionInfo(
            charge_id=charge.charge_id,
            shipment_id=shipment_id,
            order_id=order_id,
            sku=sku,
            unit_id=unit_id,
            resolution_status=resolution_status,
            resolution_path=resolution_path,
            notes=notes
        )
