import cv2
import numpy as np
from typing import Dict, List, Tuple, Any


class PPEDetectionEngine:
    """
    Comprehensive Construction Multi-PPE Detection Engine.

    When the specialist PPE model (ppe_model.pt) is loaded, results from
    it are used directly — it directly classifies helmet/vest/gloves/etc.

    Color-heuristic analysis is used only as a fallback when the model
    is unavailable (e.g. first boot, model not downloaded).

    PPE Classes from specialist model:
      0: Gloves
      1: Vest
      2: goggles
      3: helmet
      4: mask
      5: safety_shoe
    """

    @staticmethod
    def analyze_head_roi(person_crop: np.ndarray) -> bool:
        """
        FALLBACK: Analyzes the upper 22% of the person crop for hard-hat colors.
        Used only when the specialist PPE model is not available.
        """
        if person_crop.size == 0:
            return True
        h, w = person_crop.shape[:2]
        head_roi = person_crop[0:int(h * 0.22), :]
        if head_roi.size == 0:
            return True

        hsv = cv2.cvtColor(head_roi, cv2.COLOR_BGR2HSV)

        # Color masks for common construction helmet pigments
        mask_yellow = cv2.inRange(hsv, np.array([15, 70, 70]),  np.array([35, 255, 255]))
        mask_orange = cv2.inRange(hsv, np.array([5,  80, 80]),  np.array([15, 255, 255]))
        mask_white  = cv2.inRange(hsv, np.array([0,  0,  180]), np.array([180, 30, 255]))
        mask_blue   = cv2.inRange(hsv, np.array([95, 80, 80]),  np.array([130, 255, 255]))

        combined = mask_yellow | mask_orange | mask_white | mask_blue
        ratio = np.count_nonzero(combined) / (head_roi.shape[0] * head_roi.shape[1] + 1e-5)
        return ratio > 0.12

    @staticmethod
    def analyze_torso_roi(person_crop: np.ndarray) -> bool:
        """
        FALLBACK: Analyzes the torso region (20%-65%) for high-visibility vest pigments.
        """
        if person_crop.size == 0:
            return True
        h, w = person_crop.shape[:2]
        torso_roi = person_crop[int(h * 0.20):int(h * 0.65), :]
        if torso_roi.size == 0:
            return True

        hsv = cv2.cvtColor(torso_roi, cv2.COLOR_BGR2HSV)
        mask_hivis_yellow = cv2.inRange(hsv, np.array([25, 90,  90]),  np.array([45, 255, 255]))
        mask_hivis_orange = cv2.inRange(hsv, np.array([5,  110, 110]), np.array([20, 255, 255]))

        vest_mask = mask_hivis_yellow | mask_hivis_orange
        ratio = np.count_nonzero(vest_mask) / (torso_roi.shape[0] * torso_roi.shape[1] + 1e-5)
        return ratio > 0.14

    @classmethod
    def evaluate_worker_ppe(
        cls,
        frame: np.ndarray,
        person_bbox: Dict[str, float],
        zone_name: str = "Standard",
        required_ppe: List[str] = None,
        ppe_detections: List[Dict] = None   # from PPESpecialistModel.detect_ppe()
    ) -> Dict[str, Any]:
        """
        Full evaluation of worker PPE against site and zone-specific safety mandates.

        Priority:
          1. Use specialist PPE model detections if provided (accurate, class-based).
          2. Fall back to color-heuristic analysis if model results are unavailable.
        """
        if required_ppe is None:
            required_ppe = ["helmet", "vest"]

        h_img, w_img = frame.shape[:2]
        x1 = max(0, int(person_bbox["x1"]))
        y1 = max(0, int(person_bbox["y1"]))
        x2 = min(w_img, int(person_bbox["x2"]))
        y2 = min(h_img, int(person_bbox["y2"]))
        crop = frame[y1:y2, x1:x2] if (x2 > x1 and y2 > y1) else np.zeros((10, 10, 3), dtype=np.uint8)

        if ppe_detections is not None:
            # === PATH 1: Use specialist model results ===
            from app.cv.detector import model_manager
            ppe_spec = model_manager.get_ppe_model()
            found = ppe_spec.check_person_ppe(person_bbox, ppe_detections)
            has_helmet        = found.get("has_helmet", True)
            has_vest          = found.get("has_vest", True)
            has_gloves        = found.get("has_gloves", True)
            has_eye_protection = found.get("has_eye_protection", True)
            has_boots         = found.get("has_boots", True)
            has_harness       = True
        else:
            # === PATH 2: Color-heuristic fallback ===
            has_helmet        = cls.analyze_head_roi(crop)
            has_vest          = cls.analyze_torso_roi(crop)
            has_gloves        = True
            has_eye_protection = True
            has_boots         = True
            has_harness       = True

        # Zone-specific overrides
        is_height_zone   = any(k in zone_name.lower() for k in ["floor", "crane", "scaffold", "height"])
        is_material_zone = any(k in zone_name.lower() for k in ["material", "loading", "fabrication", "cut"])

        if is_height_zone and "harness" in required_ppe:
            has_harness = has_vest and (crop.shape[0] > 60)

        # Collect active violations
        violations = []
        if "helmet"         in required_ppe and not has_helmet:         violations.append("no_helmet")
        if "vest"           in required_ppe and not has_vest:           violations.append("no_vest")
        if "harness"        in required_ppe and not has_harness:        violations.append("no_harness")
        if "gloves"         in required_ppe and not has_gloves:         violations.append("no_gloves")
        if "boots"          in required_ppe and not has_boots:          violations.append("no_boots")
        if "eye_protection" in required_ppe and not has_eye_protection: violations.append("no_eye_protection")

        compound = len(violations) >= 2
        primary_violation = None
        if compound:
            primary_violation = "compound_ppe_violation"
        elif len(violations) == 1:
            primary_violation = violations[0]

        return {
            "has_helmet":         has_helmet,
            "has_vest":           has_vest,
            "has_harness":        has_harness,
            "has_gloves":         has_gloves,
            "has_boots":          has_boots,
            "has_eye_protection": has_eye_protection,
            "violations":         violations,
            "is_compliant":       len(violations) == 0,
            "is_compound":        compound,
            "primary_violation":  primary_violation
        }


ppe_engine = PPEDetectionEngine()
