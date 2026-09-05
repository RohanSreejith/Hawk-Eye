from typing import Dict, Any
from app.notifications.base import NotificationProvider
from app.services.settings_service import settings_service

class DemoNotificationProvider(NotificationProvider):
    """
    Active Supervisor Mobile and SMS Notification Dispatcher.
    Dispatches alerts to the configured supervisor name and phone number.
    """
    async def send_alert(self, incident: Dict[str, Any]) -> bool:
        result = await settings_service.send_supervisor_alert(incident)
        return result.get("success", True)

class NotificationRouter:
    def __init__(self):
        from app.notifications.telegram import TelegramNotificationProvider
        self.telegram = TelegramNotificationProvider()
        self.demo = DemoNotificationProvider()

    async def dispatch_alert(self, incident: Dict[str, Any]) -> Dict[str, bool]:
        results = {}
        if self.telegram.is_configured:
            results["telegram"] = await self.telegram.send_alert(incident)
        else:
            results["telegram"] = False

        results["supervisor_sms"] = await self.demo.send_alert(incident)
        return results

notification_router = NotificationRouter()
