import json
import os
import httpx
from datetime import datetime, timezone
from typing import Dict, Any, Optional

SETTINGS_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "supervisor_settings.json")

DEFAULT_SETTINGS = {
    "supervisor_name": "Vikram Sharma",
    "supervisor_role": "Chief EHS Safety Steward",
    "phone_number": "+91 98765 43210",
    "delivery_channel": "sms", # "sms", "whatsapp", "webhook"
    "twilio_account_sid": "",
    "twilio_auth_token": "",
    "twilio_from_number": "",
    "webhook_url": "",
    "alert_on_warning": True,
    "alert_on_critical": True
}

class SettingsService:
    def __init__(self):
        self.settings = self._load()

    def _load(self) -> Dict[str, Any]:
        if os.path.exists(SETTINGS_FILE):
            try:
                with open(SETTINGS_FILE, "r") as f:
                    data = json.load(f)
                    merged = DEFAULT_SETTINGS.copy()
                    merged.update(data)
                    return merged
            except Exception as e:
                print(f"[SETTINGS ERROR] Failed loading settings: {e}")
        return DEFAULT_SETTINGS.copy()

    def save(self, new_settings: Dict[str, Any]) -> Dict[str, Any]:
        self.settings.update(new_settings)
        try:
            with open(SETTINGS_FILE, "w") as f:
                json.dump(self.settings, f, indent=2)
            print(f"[SETTINGS] Updated supervisor settings for: {self.settings.get('supervisor_name')} ({self.settings.get('phone_number')})")
        except Exception as e:
            print(f"[SETTINGS ERROR] Failed saving settings: {e}")
        return self.settings

    def get(self) -> Dict[str, Any]:
        return self.settings

    async def send_supervisor_alert(self, incident: Dict[str, Any]) -> Dict[str, Any]:
        """
        Sends an active SMS/alert to the configured supervisor phone number.
        If Twilio credentials are configured, dispatches real cellular SMS.
        Otherwise logs and records the active dispatch payload.
        """
        phone = self.settings.get("phone_number", "+91 98765 43210")
        supervisor = self.settings.get("supervisor_name", "Supervisor")
        event_type = incident.get("event_type", "Safety Hazard").replace("_", " ").title()
        zone = incident.get("zone", "Loading Zone")
        risk_score = incident.get("risk_score", 85)
        severity = incident.get("severity", "HIGH").upper()
        action = incident.get("recommended_action", "Clear hazard zone.")

        sms_body = (
            f"🚨 HACK-EYE SAFETY ESCALATION 🚨\n"
            f"Supervisor: {supervisor}\n"
            f"Alert: {event_type} [{severity}]\n"
            f"Zone: {zone}\n"
            f"Risk Index: {risk_score}/100\n"
            f"Mandated Action: {action}\n"
            f"Timestamp: {datetime.now().strftime('%H:%M:%S')}"
        )

        sid = self.settings.get("twilio_account_sid")
        token = self.settings.get("twilio_auth_token")
        from_num = self.settings.get("twilio_from_number")

        dispatched_real_sms = False
        dispatch_status = "sent"
        dispatch_message = f"Alert dispatched to {supervisor} at {phone}"

        if sid and token and from_num:
            try:
                url = f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"
                async with httpx.AsyncClient(timeout=6.0) as client:
                    resp = await client.post(
                        url,
                        data={
                            "To": phone,
                            "From": from_num,
                            "Body": sms_body
                        },
                        auth=(sid, token)
                    )
                    if resp.status_code in [200, 201]:
                        dispatched_real_sms = True
                        dispatch_message = f"Real SMS successfully delivered via Twilio to {phone}"
                    else:
                        dispatch_message = f"Twilio returned {resp.status_code}: {resp.text}"
            except Exception as e:
                dispatch_message = f"SMS gateway error: {e}"

        print(f"[SUPERVISOR ALERT] To: {supervisor} ({phone}) | Message:\n{sms_body}")

        return {
            "success": True,
            "supervisor": supervisor,
            "phone_number": phone,
            "dispatched_real_sms": dispatched_real_sms,
            "message": dispatch_message,
            "sms_body": sms_body,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

settings_service = SettingsService()
