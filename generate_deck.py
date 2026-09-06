import os
import sys
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE

def create_deck(output_path):
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]

    # Theme Colors
    BG_COLOR = RGBColor(248, 250, 252)       # #f8fafc
    CARD_BG = RGBColor(255, 255, 255)        # #ffffff
    PRIMARY_NAVY = RGBColor(30, 58, 138)     # #1e3a8a
    ACCENT_BLUE = RGBColor(37, 99, 235)      # #2563eb
    TEXT_DARK = RGBColor(15, 23, 42)         # #0f172a
    TEXT_MUTED = RGBColor(100, 116, 139)     # #64748b
    BORDER_COLOR = RGBColor(226, 232, 240)   # #e2e8f0
    PILL_BG = RGBColor(239, 246, 255)        # #eff6ff
    RED_ACCENT = RGBColor(220, 38, 38)       # #dc2626
    GREEN_ACCENT = RGBColor(22, 163, 74)     # #16a34a

    def set_slide_background(slide, color):
        bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), Inches(13.333), Inches(7.5))
        bg.fill.solid()
        bg.fill.fore_color.rgb = color
        bg.line.fill.background()
        return bg

    def add_header(slide, category, title, subtitle=None):
        # Header category tag
        tag_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.55), Inches(11.7), Inches(0.4))
        tf_tag = tag_box.text_frame
        tf_tag.word_wrap = True
        tf_tag.margin_left = tf_tag.margin_top = tf_tag.margin_right = tf_tag.margin_bottom = 0
        p_tag = tf_tag.paragraphs[0]
        p_tag.text = category.upper()
        p_tag.font.size = Pt(11)
        p_tag.font.bold = True
        p_tag.font.color.rgb = ACCENT_BLUE
        p_tag.font.name = "Segoe UI"

        # Main Title
        title_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.95), Inches(11.7), Inches(0.7))
        tf_t = title_box.text_frame
        tf_t.word_wrap = True
        tf_t.margin_left = tf_t.margin_top = tf_t.margin_right = tf_t.margin_bottom = 0
        p_t = tf_t.paragraphs[0]
        p_t.text = title
        p_t.font.size = Pt(28)
        p_t.font.bold = True
        p_t.font.color.rgb = TEXT_DARK
        p_t.font.name = "Segoe UI"

        if subtitle:
            sub_box = slide.shapes.add_textbox(Inches(0.8), Inches(1.68), Inches(11.7), Inches(0.4))
            tf_s = sub_box.text_frame
            tf_s.word_wrap = True
            tf_s.margin_left = tf_s.margin_top = tf_s.margin_right = tf_s.margin_bottom = 0
            p_s = tf_s.paragraphs[0]
            p_s.text = subtitle
            p_s.font.size = Pt(13)
            p_s.font.color.rgb = TEXT_MUTED
            p_s.font.name = "Segoe UI"

    def add_card(slide, left, top, width, height, title, points, badge=None, badge_color=ACCENT_BLUE):
        card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
        card.fill.solid()
        card.fill.fore_color.rgb = CARD_BG
        card.line.color.rgb = BORDER_COLOR
        card.line.width = Pt(1)

        tx_box = slide.shapes.add_textbox(left + Inches(0.35), top + Inches(0.3), width - Inches(0.7), height - Inches(0.55))
        tf = tx_box.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0

        # Title
        p0 = tf.paragraphs[0]
        p0.text = title
        p0.font.size = Pt(16)
        p0.font.bold = True
        p0.font.color.rgb = PRIMARY_NAVY
        p0.font.name = "Segoe UI"
        p0.space_after = Pt(14)

        # Bullet points
        for pt in points:
            p = tf.add_paragraph()
            p.text = "•  " + pt
            p.font.size = Pt(13)
            p.font.color.rgb = TEXT_DARK
            p.font.name = "Segoe UI"
            p.space_after = Pt(9)
            p.line_spacing = 1.18

    # =========================================================================
    # SLIDE 0: TITLE SLIDE
    # =========================================================================
    s0 = prs.slides.add_slide(blank_layout)
    set_slide_background(s0, RGBColor(240, 244, 249))

    # Center hero card
    hero_card = s0.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(1.8), Inches(1.3), Inches(9.733), Inches(4.9))
    hero_card.fill.solid()
    hero_card.fill.fore_color.rgb = CARD_BG
    hero_card.line.color.rgb = BORDER_COLOR
    hero_card.line.width = Pt(1.5)

    # Content in hero
    tbox = s0.shapes.add_textbox(Inches(2.4), Inches(1.9), Inches(8.533), Inches(3.8))
    tf0 = tbox.text_frame
    tf0.word_wrap = True

    p = tf0.paragraphs[0]
    p.text = "HAWK"
    p.font.size = Pt(54)
    p.font.bold = True
    p.font.color.rgb = PRIMARY_NAVY
    p.font.name = "Segoe UI"
    p.alignment = PP_ALIGN.CENTER

    p = tf0.add_paragraph()
    p.text = "Autonomous Multi-Agent Industrial Safety & Hazard Anticipation Network"
    p.font.size = Pt(19)
    p.font.bold = True
    p.font.color.rgb = ACCENT_BLUE
    p.font.name = "Segoe UI"
    p.alignment = PP_ALIGN.CENTER
    p.space_after = Pt(20)

    p = tf0.add_paragraph()
    p.text = "Transforming Passive CCTV into Active, Proactive Life-Saving Intervention"
    p.font.size = Pt(14)
    p.font.color.rgb = TEXT_MUTED
    p.font.name = "Segoe UI"
    p.alignment = PP_ALIGN.CENTER
    p.space_after = Pt(28)

    p = tf0.add_paragraph()
    p.text = "Hack-Eye Team Pitch  |  Final Product Demo"
    p.font.size = Pt(12)
    p.font.bold = True
    p.font.color.rgb = TEXT_DARK
    p.font.name = "Segoe UI"
    p.alignment = PP_ALIGN.CENTER

    # =========================================================================
    # SLIDE 1: PROBLEM & USER
    # =========================================================================
    s1 = prs.slides.add_slide(blank_layout)
    set_slide_background(s1, BG_COLOR)
    add_header(s1, "01 / Problem & Target User", "The Preventable Crisis in Industrial Workplace Safety", "Who is hurt, why today's systems fail, and the catastrophic scale of the delay")

    col_w = Inches(3.64)
    top_pos = Inches(2.1)
    card_h = Inches(4.7)

    add_card(s1, Inches(0.8), top_pos, col_w, card_h,
             "The Target User",
             [
                 "HSE Officers & Industrial Site Supervisors managing fast-paced construction yards and high-bay warehouses.",
                 "Floor Workers & Equipment Operators sharing tight, high-risk aisle corridors daily.",
                 "Constantly overwhelmed: responsible for sprawling facilities with dozens of blind corners and fast-moving machinery.",
                 "Facing severe cognitive overload from monitoring multiple disjointed safety protocols simultaneously."
             ])

    add_card(s1, Inches(4.84), top_pos, col_w, card_h,
             "The Core Problem",
             [
                 "Lagging & Reactive: Accidents unfold in 2–3 seconds, while conventional detection happens only after the collision.",
                 "Critical Blindspots: Single cameras cannot see around racking walls or door thresholds.",
                 "Noisy, Distracted Floors: Workers cannot hear approaching forklifts over ambient machinery racket.",
                 "Zero Active Interlock: Current cameras observe disasters unfold but have zero mechanism to physically intervene or warn."
             ])

    add_card(s1, Inches(8.88), top_pos, col_w, card_h,
             "Why It Matters (Scale & Today)",
             [
                 "11,614+ Fatalities in India annually — averaging 38 preventable workplace deaths every single day.",
                 "1,000+ Incidents & ~400 Fatalities in the US annually across warehousing & material handling (OSHA).",
                 "How they deal with it today: Clipboards, manual walkthrough audits, and passive CCTV forensic review after someone is injured.",
                 "Enormous Human & Financial Cost: Billions lost in downtime, worker compensation, and regulatory penalties."
             ])

    # =========================================================================
    # SLIDE 2: VALIDATION & WHAT YOU LEARNED
    # =========================================================================
    s2 = prs.slides.add_slide(blank_layout)
    set_slide_background(s2, BG_COLOR)
    add_header(s2, "02 / Validation & Learning", "Testing Key Assumptions & Our Critical Pivot", "Evidence gathered from real-time testing and how it reshaped our architecture")

    col_w2 = Inches(5.67)
    card_h2 = Inches(4.7)

    add_card(s2, Inches(0.8), top_pos, col_w2, card_h2,
             "Assumptions Tested & Observations",
             [
                 "Assumption 1: Can computer vision alone running in the cloud keep industrial workers safe?",
                 "Testing: Simulated synchronized multi-camera warehouse feeds with fast-moving forklifts and pedestrian crossings.",
                 "Observation: Centralized cloud screens are useless for active floor safety — a supervisor sitting at a desk cannot react in 2 seconds.",
                 "Observation: Latency kills. Sending frames to external cloud APIs took 1.5s–3s, meaning the collision occurred before the alert rendered.",
                 "Measurement: Single-camera detection fails at doorway handoffs — hazards originate outside camera view."
             ])

    add_card(s2, Inches(6.85), top_pos, col_w2, card_h2,
             "What We Learned & The Strategic Pivot",
             [
                 "Initial Idea (Abandoned): Pure passive AI dashboard that generated incident logs and post-event summaries.",
                 "The Pivot (What We Built): Distributed Multi-Agent Network pairing edge vision with physical on-site intervention.",
                 "Pivot 1: Localized Physical Kiosks — Instant strobe lights and targeted voice directives right at the blind corner doorway.",
                 "Pivot 2: Autonomous Machine Interlocks — Directly trigger forklift deceleration and emergency braking before impact.",
                 "Pivot 3: Supervisor Mobile Terminal — Native push notifications with live evidence streaming directly into the supervisor's hand."
             ])

    # =========================================================================
    # SLIDE 3: YOUR SOLUTION
    # =========================================================================
    s3 = prs.slides.add_slide(blank_layout)
    set_slide_background(s3, BG_COLOR)
    add_header(s3, "03 / The HAWK Solution", "HAWK: Proactive Multi-Agent Safety Mesh", "Shifting industrial safety from post-incident analysis to autonomous pre-incident prevention")

    add_card(s3, Inches(0.8), top_pos, col_w, card_h,
             "What HAWK Is",
             [
                 "An Autonomous Multi-Agent Industrial Safety Ecosystem bridging perception, physical reaction, and forensics.",
                 "Multi-Camera Mesh: Seamlessly tracks entities across non-overlapping views (e.g., Exterior Yard to Interior Corridor).",
                 "Edge-Speed Inference: Sub-50ms local computer vision models detecting PPE, vehicle speed, and trajectory convergence.",
                 "End-to-End Coverage: Active across pedestrian proximity, machinery transit, blind doorways, and thermal fire threats."
             ])

    add_card(s3, Inches(4.84), top_pos, col_w, card_h,
             "Core Value Delivered",
             [
                 "3–4 Second Predictive Window: Anticipates trajectory conflicts before physical line-of-sight is established.",
                 "Zero Human Bottleneck: Automated localized voice sirens and forklift deceleration without waiting for human clicks.",
                 "Mobile Empowerment: Supervisors receive prioritized incident dispatches with forensic clips wherever they walk on site.",
                 "Automated OSHA Compliance: Instantly generates regulatory root-cause reports, eliminating hours of paperwork."
             ])

    add_card(s3, Inches(8.88), top_pos, col_w, card_h,
             "Why HAWK Wins Over Alternatives",
             [
                 "Vs. Traditional CCTV: Passive CCTV only documents how someone got hurt; HAWK halts the vehicle before impact.",
                 "Vs. Cloud AI Dashboards: Zero cloud round-trip delay; operates autonomously on edge hardware even during internet dropouts.",
                 "Vs. Wearable RF Tags: Requires zero expensive battery-powered worker tags; utilizes ubiquitous optical infrastructure.",
                 "100% Actionable: Combines acoustic warning, machine intervention, mobile alert, and legal compliance in one loop."
             ])

    # =========================================================================
    # SLIDE 4: WHAT YOU BUILT
    # =========================================================================
    s4 = prs.slides.add_slide(blank_layout)
    set_slide_background(s4, BG_COLOR)
    add_header(s4, "04 / What We Built During The Hackathon", "Full-Stack System Architecture & Real-World Scope", "A complete, functional multi-agent prototype with live edge inference, desktop command, and mobile dispatch")

    add_card(s4, Inches(0.8), top_pos, col_w, card_h,
             "Core Components Built",
             [
                 "Multi-Camera Vision Engine: Dual-stream MJPEG real-time tracking with YOLO PPE & machinery detection.",
                 "HAWK Central Command: Real-time dashboard with zone heatmaps, siren dispatch, live notifications, and incident telemetry.",
                 "Supervisor Mobile App: React Native / Expo mobile application receiving instant push dispatches and live camera streams.",
                 "Safety Kiosk & Interlock Simulator: Real-time audio siren, speech synthesis, and emergency brake actuator loop."
             ])

    add_card(s4, Inches(4.84), top_pos, col_w, card_h,
             "Technical Choices & Challenges",
             [
                 "Decoupled WebSocket Mesh: Asynchronous event engine distributing state across web, mobile, and kiosk in < 20ms.",
                 "Cross-Camera Spatial Tracking: Correlating entities between Camera 1 (outside) and Camera 2 (inside) without ID jitter.",
                 "Dynamic Multi-Agent Telemetry: Perception, Risk, and Response agents collaborating to compute Time-to-Collision.",
                 "Automated LLM Forensics: Integrated Ollama / Analyst Agent generating incident-specific OSHA 1910 root-cause investigations."
             ])

    add_card(s4, Inches(8.88), top_pos, col_w, card_h,
             "Functional vs. Simulated",
             [
                 "100% Functional Today: Real-time dual camera vision inference, mobile push dispatches, sound alarms, telemetry, and forensic generation.",
                 "Simulated Video Feeds: Industrial footage sourced from NVIDIA Omniverse synthetic industrial twin environments.",
                 "Simulated Interlock: CAN-bus forklift mechanical actuator simulated via state protocol rather than physical forklift solenoid.",
                 "Scope Realism: Demonstrated 5 critical site scenarios today out of 10,000+ potential real-world edge cases."
             ])

    # =========================================================================
    # SLIDE 5: RESULTS & WHAT COMES NEXT
    # =========================================================================
    s5 = prs.slides.add_slide(blank_layout)
    set_slide_background(s5, BG_COLOR)
    add_header(s5, "05 / Results & Future Roadmap", "What We Demonstrated & The Path to Production", "Proven viability, remaining challenges, and next milestones for commercial deployment")

    add_card(s5, Inches(0.8), top_pos, col_w, card_h,
             "Proven So Far",
             [
                 "Anticipatory Safety is Viable: Successfully predicted collision vectors 3.5s before blind intersection entry.",
                 "Multi-Channel Warning Works: Synchronous trigger of zone kiosk speaker, forklift brake, and supervisor phone.",
                 "Scenario-Specific Forensics: Dynamic OSHA regulation mapping proven across PPE, Near-Miss, Crash, and Fire.",
                 "Sub-100ms Perception-to-Action loop executed reliably on consumer-grade hardware."
             ])

    add_card(s5, Inches(4.84), top_pos, col_w, card_h,
             "Remaining Uncertainties",
             [
                 "Harsh Environmental Conditions: Performance under heavy dust, lens smudges, low lighting, and heavy rain outdoors.",
                 "Legacy Forklift Integration: Interfacing with heterogeneous machinery (hydraulic vs. electronic drive-by-wire).",
                 "Network Resilience: Ensuring zero-latency mesh communication across massive steel-framed warehouse structures.",
                 "Worker Alarm Fatigue: Balancing threshold sensitivity to prevent desensitization to proximity warnings."
             ])

    add_card(s5, Inches(8.88), top_pos, col_w, card_h,
             "If We Had Another Week & Prod Needs",
             [
                 "Next Week: Deploy on real RTSP IP cameras at an active local loading dock; test physical CAN-bus relay.",
                 "Next Week: Multi-zone geofencing supporting 10+ simultaneous camera angles and automated shift handover reports.",
                 "What Needs to Be True: Dedicated edge hardware (NVIDIA Jetson / On-Prem NVR) for zero external internet reliance.",
                 "What Needs to Be True: Certification under OSHA and ISO 13849 functional safety standards for industrial control."
             ])

    # =========================================================================
    # SLIDE 6: DEMO TRANSITION SLIDE
    # =========================================================================
    s6 = prs.slides.add_slide(blank_layout)
    set_slide_background(s6, PRIMARY_NAVY)

    center_card = s6.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(2.2), Inches(1.8), Inches(8.933), Inches(3.9))
    center_card.fill.solid()
    center_card.fill.fore_color.rgb = CARD_BG
    center_card.line.fill.background()

    tbox6 = s6.shapes.add_textbox(Inches(2.5), Inches(2.2), Inches(8.333), Inches(3.1))
    tf6 = tbox6.text_frame
    tf6.word_wrap = True

    p = tf6.paragraphs[0]
    p.text = "LIVE SYSTEM DEMONSTRATION"
    p.font.size = Pt(14)
    p.font.bold = True
    p.font.color.rgb = ACCENT_BLUE
    p.font.name = "Segoe UI"
    p.alignment = PP_ALIGN.CENTER

    p = tf6.add_paragraph()
    p.text = "Moving on to Product Demo"
    p.font.size = Pt(40)
    p.font.bold = True
    p.font.color.rgb = PRIMARY_NAVY
    p.font.name = "Segoe UI"
    p.alignment = PP_ALIGN.CENTER
    p.space_after = Pt(16)

    p = tf6.add_paragraph()
    p.text = "5-Minute Live Walkthrough: Dual-Camera Spatial Mesh  •  Supervisor Mobile App  •  Autonomous Interlocks  •  LLM Forensics"
    p.font.size = Pt(13)
    p.font.color.rgb = TEXT_MUTED
    p.font.name = "Segoe UI"
    p.alignment = PP_ALIGN.CENTER

    prs.save(output_path)
    print(f"Presentation saved successfully to: {output_path}")

if __name__ == "__main__":
    out_dir = r"c:\Rohan\PersonalProjects\Startathon\Hack-Eye"
    out_file = os.path.join(out_dir, "HAWK_Final_Pitch_Deck.pptx")
    create_deck(out_file)
