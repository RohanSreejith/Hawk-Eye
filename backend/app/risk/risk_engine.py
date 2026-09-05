from typing import Dict, Any, Tuple

class RiskEngine:
    """
    Transparent heuristic safety risk scoring engine for construction sites.
    Normalized score 0 - 100:
      - LOW: 0 - 24
      - MEDIUM: 25 - 49
      - HIGH: 50 - 74
      - CRITICAL: 75 - 100
    Clearly designated as a deterministic prototype heuristic for auditable decision making.
    """

    # Baseline hazard severity weight (1.0 to 3.0)
    EVENT_SEVERITY_WEIGHTS = {
        "no_helmet": 1.4,
        "no_vest": 1.2,
        "no_gloves": 1.0,
        "no_boots": 1.2,
        "no_eye_protection": 1.1,
        "no_harness": 2.6,                # Fall hazard is high fatality risk
        "compound_ppe_violation": 2.2,    # Multiple PPE violations simultaneously
        "vehicle_person_proximity": 2.8,  # Struck-by heavy equipment
        "zone_breach": 2.5,               # Unauthorized entry into high hazard envelope
    }

    # Zone context risk multipliers (0.8 to 1.6)
    ZONE_RISK_MULTIPLIERS = {
        "Main Gate": 0.9,
        "Material Storage": 1.0,
        "Loading Zone": 1.3,
        "Floor 1": 1.4,
        "Floor 2": 1.5,
        "Crane Area": 1.6,
        "Excavation Area": 1.5,
    }

    @classmethod
    def calculate_risk(
        cls,
        event_type: str,
        zone: str,
        proximity_factor: float = 1.0,     # 1.0 normal, up to 2.0 when very close (<1m)
        persistence_seconds: float = 1.0,  # condition duration
        exposed_workers_count: int = 1,
        vehicle_involved: bool = False
    ) -> Tuple[int, str, Dict[str, Any]]:
        """
        Computes composite risk score and assigns severity tier.
        Returns: (score_0_to_100, severity_tier, breakdown_dict)
        """
        base_weight = cls.EVENT_SEVERITY_WEIGHTS.get(event_type, 1.2)
        zone_mult = cls.ZONE_RISK_MULTIPLIERS.get(zone, 1.0)
        
        # Proximity weight: closer distance = higher risk
        prox_mult = max(0.8, min(2.0, proximity_factor))
        
        # Persistence weight: longer exposure = higher probability of accident
        persist_mult = min(1.6, 1.0 + (persistence_seconds * 0.15))
        
        # Exposure count: more workers exposed increases collective hazard
        exposure_mult = min(1.5, 1.0 + ((exposed_workers_count - 1) * 0.2))
        
        # Vehicle presence multiplier
        vehicle_mult = 1.3 if vehicle_involved else 1.0
        
        # Composite heuristic calculation
        raw_score = 15.0 * (base_weight * zone_mult * prox_mult * persist_mult * exposure_mult * vehicle_mult)
        
        # Normalize and clamp to 0 - 100
        score = int(max(5, min(100, round(raw_score))))
        
        # Categorize into standard safety tiers
        if score < 25:
            severity = "low"
        elif score < 50:
            severity = "warning"
        elif score < 75:
            severity = "high"
        else:
            severity = "critical"
            
        breakdown = {
            "formula": "severity_weight * zone_context * proximity * persistence * exposure * vehicle",
            "base_weight": base_weight,
            "zone_multiplier": zone_mult,
            "proximity_factor": round(prox_mult, 2),
            "persistence_factor": round(persist_mult, 2),
            "exposure_count": exposed_workers_count,
            "score": score,
            "severity": severity,
            "heuristic_type": "Deterministic Industrial Safety Heuristic (v1.0)"
        }
        
        return score, severity, breakdown

risk_engine = RiskEngine()
