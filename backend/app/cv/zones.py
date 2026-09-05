from typing import List, Dict, Tuple

class DangerZoneEngine:
    """
    Evaluates whether entity coordinates (centroids or feet coordinates)
    fall inside restricted construction site polygons.
    """

    @staticmethod
    def point_in_polygon(x: float, y: float, polygon: List[Dict[str, float]]) -> bool:
        """
        Ray-casting algorithm to test if point (x, y) is inside polygon.
        Coordinates are normalized (0.0 to 1.0).
        """
        n = len(polygon)
        if n < 3:
            return False

        inside = False
        p1x = polygon[0]["x"]
        p1y = polygon[0]["y"]

        for i in range(n + 1):
            p2x = polygon[i % n]["x"]
            p2y = polygon[i % n]["y"]

            if y > min(p1y, p2y):
                if y <= max(p1y, p2y):
                    if x <= max(p1x, p2x):
                        if p1y != p2y:
                            xinters = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                        if p1x == p2x or x <= xinters:
                            inside = not inside
            p1x, p1y = p2x, p2y

        return inside

    @classmethod
    def check_zone_breaches(
        cls,
        person_foot_x: float,
        person_foot_y: float,
        zones: List[Dict]
    ) -> List[Dict]:
        """
        Checks if person's location breaches any restricted or critical zones.
        """
        breaches = []
        for zone in zones:
            if zone.get("type") in ["restricted", "crane", "excavation", "height"]:
                polygon = zone.get("polygon", [])
                if cls.point_in_polygon(person_foot_x, person_foot_y, polygon):
                    breaches.append(zone)
        return breaches

zone_engine = DangerZoneEngine()
