from abc import ABC, abstractmethod
from typing import Dict, Any

class NotificationProvider(ABC):
    @abstractmethod
    async def send_alert(self, incident: Dict[str, Any]) -> bool:
        pass
