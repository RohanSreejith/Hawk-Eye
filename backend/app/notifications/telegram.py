import httpx
from typing import Dict, Any
from app.config import settings
from app.notifications.base import NotificationProvider

class TelegramNotificationProvider(NotificationProvider):
    def __init__(self, token: str = settings.TELEGRAM_BOT_TOKEN, chat_id: str = settings.TELEGRAM_CHAT_ID):
        self.token = token
        self.chat_id = chat_id
        self.is_configured = bool(token and chat_id)

    async def send_alert(self, incident: Dict[str, Any]) -> bool:
        if not self.is_configured:
            return False

        message = (
            f"🚨 *SAHAYI HIGH-RISK SAFETY INCIDENT*\n\n"
            f"*Incident:* {incident.get('event_type', '').replace('_', ' ').title()}\n"
            f"*Location:* {incident.get('site_id', 'SITE_01')} — {incident.get('zone', 'Zone')}\n"
            f"*Camera:* {incident.get('camera_id', '')}\n"
            f"*Time:* {incident.get('timestamp', '')}\n"
            f"*Risk Score:* {incident.get('risk_score', 0)} / 100 ({incident.get('severity', '').upper()})\n"
            f"*Confidence:* {int(incident.get('confidence', 0.9) * 100)}%\n\n"
            f"*Recommended Action:*\n⚠️ {incident.get('recommended_action', 'Take caution.')}\n\n"
            f"*AI Summary:* {incident.get('ai_summary', '')}\n\n"
            f"🔗 Open Mobile Incident Dispatch: http://localhost:5173/mobile"
        )

        url = f"https://api.telegram.org/bot{self.token}/sendMessage"
        payload = {
            "chat_id": self.chat_id,
            "text": message,
            "parse_mode": "Markdown"
        }

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.post(url, json=payload)
                return res.status_code == 200
        except Exception as e:
            print(f"[TELEGRAM ERROR] Failed to send alert: {e}")
            return False
