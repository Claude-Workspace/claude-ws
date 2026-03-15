# Giai đoạn 2: Format và Quy trình Sự kiện

## Tổng quan

**Ưu tiên:** CAO ⚠️
**Trạng thái:** ⏳ Chưa bắt đầu
**Mục tiêu:** Định hình cấu trúc chuẩn cho tất cả sự kiện, đảm bảo consistency và quality

## Context

- **Thời lượng:** 2.5 - 3 giờ/sự kiện
- **Frequency:** Monthly (1 lần/tháng)
- **Capacity:** 30-100 người tùy theme
- **Venue:** Sol Cafe Coworking, 181 Trần Quốc Vượng, Cầu Giấy
- **Team needed:** 1 MC + 1 coordinator + 1 support staff

## Key Insights

### Lessons learned từ other networking events

**What works:**
1. **Structured networking** thay vì "free-for-all" chaos
2. **Ice-breaker activities** giúp người mới đỡ awkward
3. **Time-boxed segments** giữ energy high
4. **Name tags với conversation starters** encourage interaction
5. **Follow-up system** để maintain momentum

**What doesn't work:**
1. Panels quá dài (người tham dự buồn ngủ)
2. Networking không có hướng dẫn (người introvert đứng lẻ loi)
3. Start late (disrespect người đến đúng giờ)
4. Không có food/drink (người đói/buồn muốn về sớm)
5. Speaker chỉ talk không có interaction

### Best practice format từ các event series thành công

| Event Series | Format | Duration | Key Feature |
|--------------|--------|----------|-------------|
| Startup Grind | Fireside chat + Q&A + networking | 2.5h | Personal founder stories |
| Creative Mornings | Breakfast + 20min talk + networking | 2h | Morning energy |
| Tech Talks | 2-3 short talks + demo + networking | 3h | Technical depth |
| Meetup.com events | 6min speed dating + open networking | 2h | Structured interaction |

## Requirements

### Functional Requirements
1. Format phải scalable (dễ adjust cho 30-100 người)
2. Có sections cho learning, sharing, networking
3. Balance giữa structured và organic networking
4. Fun và engaging, không awkward
5. Dễ implement với team nhỏ (2-3 người)

### Non-functional Requirements
1. Consistency across all 12 events
2. Brand-aligned (friendly, accessible, community-driven)
3. Culturally appropriate cho Vietnamese context
4. Flexible để customize cho từng theme

## Architecture - Standard Event Format

### Timeline Overview (2.5 - 3 hours)

```
┌─────────────────────────────────────────────────────────┐
│  Registration & Warm-up (30 min)                        │
│  ├─ Check-in + name tags                                │
│  ├─ Welcome drink/snack                                 │
│  └─ Ice-breaker: "Find someone who..." bingo            │
├─────────────────────────────────────────────────────────┤
│  Opening & Introduction (15 min)                        │
│  ├─ MC welcome (5 min)                                  │
│  ├─ Sol Cafe introduction (5 min)                       │
│  └─ Event agenda overview (5 min)                       │
├─────────────────────────────────────────────────────────┤
│  Main Content - Panel/Speaker (45 min)                  │
│  ├─ Speaker presentation (25-30 min)                    │
│  ├─ Q&A session (10-15 min)                             │
│  └─ Audience interaction (5 min)                        │
├─────────────────────────────────────────────────────────┤
│  Structured Networking (45 min)                         │
│  ├─ Speed networking (6 min x 3 rounds)                 │
│  ├─ Themed break-out groups (optional)                  │
│  └─ Open networking time                                │
├─────────────────────────────────────────────────────────┤
│  Community Announcements (10 min)                       │
│  ├─ Attendee shoutouts (job offers, looking for...)     │
│  ├─ Upcoming events preview                             │
│  └─ Sol Cafe promotions                                 │
├─────────────────────────────────────────────────────────┤
│  Lucky Draw & Closing (20 min)                          │
│  ├─ Lucky draw prizes (10 min)                          │
│  ├─ Photo session (5 min)                               │
│  └─ Thank you & call-to-action (5 min)                  │
└─────────────────────────────────────────────────────────┘
```

### Detailed Format Breakdown

#### 1. Registration & Warm-up (30 min)

**Setup:**
- Check-in table với QR code check-in
- Name tags color-coded by industry/interest:
  - 🔵 Blue: Tech/Startup
  - 🟢 Green: Creative/Design
  - 🟡 Yellow: Business/Finance
  - 🔴 Red: Student/Academic
  - ⚪ White: Other/Open to connect
- Welcome station:
  - Signature drink của Sol Cafe (ví dụ: "Sol Mule")
  - Light snacks (finger food, không dơ tay)
  - Event program one-pager

**Ice-breaker Activity: "Networking Bingo"**
```
BINGO CARD (9 squares)
┌─────────────────┬─────────────────┬─────────────────┐
│ Find someone    │ Find someone    │ Find someone    │
│ who works in    │ who has a side  │ who speaks 3+   │
│ a startup       │ hustle          │ languages       │
├─────────────────┼─────────────────┼─────────────────┤
│ Find someone    │ Find someone    │ Find someone    │
│ who is a        │ who has worked  │ who has lived   │
│ freelancer      │ remotely        │ abroad          │
├─────────────────┼─────────────────┼─────────────────┤
│ Find someone    │ Find someone    │ Find someone    │
│ who is          │ who has         │ who wants to    │
│ learning AI     │ a podcast       │ start a         │
│                 │                 │ business        │
└─────────────────┴─────────────────┴─────────────────┘
```

**Completion:** First 5 people complete bingo → small prize

#### 2. Opening & Introduction (15 min)

**MC Script Template:**
```markdown
[5 min] Welcome
- "Chào mừng mọi người đến với [Event Name]!"
- "Mình là [Name], MC của buổi hôm nay"
- House rules brief (respect, participate, have fun)

[5 min] Sol Cafe Intro
- "Về Sol Cafe Coworking" (30 sec elevator pitch)
- "Tại sao chúng tôi tổ chức events này"
- "Các benefits khi trở thành member"

[5 min] Agenda Overview
- "Hôm nay chúng ta sẽ có 3 phần chính"
- "Speaker: [Name] sẽ chia sẻ về [Topic]"
- "Networking session với format thú vị"
- "Lucky draw với prizes worth [Total value]"
```

#### 3. Main Content - Panel/Speaker (45 min)

**Format Options (flexible by theme):**

| Format | Best For | Duration | Pros | Cons |
|--------|----------|----------|------|------|
| Fireside Chat | Personal stories | 30min | Intimate, engaging | Need skilled interviewer |
| Solo Presentation | Knowledge sharing | 30min | Focused, clear | One-way communication |
| Panel Discussion | Multiple perspectives | 45min | Diverse views | Hard to manage time |
| Workshop | Hands-on learning | 45min | Interactive | Need materials |
| Pitch Competition | Startup themes | 60min | Exciting | Time-consuming |

**Speaker Guidelines:**
- Content requirements:
  - 80% value, 20% self-promotion
  - Include stories, not just theory
  - Actionable takeaways
  - Interactive elements (polls, questions)
- Logistics:
  - Lapel mic hoặc handheld mic
  - Presentation clicker
  - Backup laptop with slides
  - Water for speaker

#### 4. Structured Networking (45 min)

**Option A: Speed Networking (Recommended cho 30-50 người)**

```python
# Speed Networking Algorithm
rounds = 3
duration_per_round = 6  # minutes
questions = [
    "What brings you here today?",
    "What's a project you're excited about?",
    "What's one thing you'd like to learn?",
    "How can I help you or who should you meet?"
]

# Setup
# - Chairs in 2 rows facing each other
# - Inner circle rotates, outer circle stays
# - Bell/gong signals rotation

# Flow
for round in range(rounds):
    play_music()  # Background music
    wait(duration_per_round)
    play_transition_sound()
    inner_circle_rotate()
```

**Option B: Themed Break-out Groups (Recommended cho 50+ người)**

```markdown
Station 1: "Startup Corner" (Founders, Co-founders, Investors)
Station 2: "Freelancer Hub" (Designers, Developers, Writers)
Station 3: "Career Growth" (Job seekers, HR, Mentors)
Station 4: "Open Networking" (Anyone)

Rotate every 10 minutes → 3 rotations total
```

**Option C: Conversation Starter Cards (Dành cho introverts)**

```
Card examples:
┌─────────────────────────────────────┐
│ ❓ What's your "why"?               │
│ (Why do you do what you do?)        │
├─────────────────────────────────────┤
│ 🚀 What's a risk you took that     │
│    paid off?                        │
├─────────────────────────────────────┤
│ 💡 What's a book/podcast that      │
│    changed your perspective?        │
├─────────────────────────────────────┤
│ 🎯 What's your goal for the next   │
│    3 months?                        │
└─────────────────────────────────────┘
```

#### 5. Community Announcements (10 min)

**Format:** "Shout-out Board" + "Opportunities Corner"

```markdown
SHOUT-OUT BOARD (Pre-written on whiteboard)
┌─────────────────────────────────────┐
│ 📢 JOB OPPORTUNITIES                │
│ [Company] hiring [Role]             │
│ Contact: [Name]                     │
├─────────────────────────────────────┤
│ 🤝 LOOKING FOR                      │
│ Co-founder for [Idea]               │
│ Contact: [Name]                     │
├─────────────────────────────────────┤
│ 🎉 CONGRATULATIONS                  │
│ [Name] just launched [Product]!     │
├─────────────────────────────────────┤
│ 📅 UPCOMING EVENTS                  │
│ [Date]: [Next Event Name]           │
└─────────────────────────────────────┘
```

**Live Shout-outs:**
- 2-3 phút: People stand up, 20-second pitch
- Example: "Mình là Nam, đang tìm co-founder cho edtech startup. Nếu bạn interested, find mình sau event!"

**Sol Cafe Announcements:**
- Upcoming events preview
- Special promotions (event-only deals)
- Membership benefits highlight

#### 6. Lucky Draw & Closing (20 min)

**Lucky Draw Mechanics:**
```
Entry Requirements:
✅ Checked in (registered)
✅ Participated in networking (stamp on name tag)
✅ Joined mailing list (optional)

Prizes Tier:
🥇 Grand Prize (1): 1-month free coworking pass (worth 2,000,000 VND)
🥈 Second Prize (3): 1-week free coworking pass (worth 500,000 VND each)
🥉 Third Prize (5): Drink vouchers (worth 50,000 VND each)
🏅 Special Prize: 1-on-1 coffee with speaker
```

**Selection Process:**
- Random name generator (Display on screen)
- Winner must be present
- Photo op với winner

**Closing Script:**
```markdown
[5 min] Thank you & Recap
- "Cảm ơn mọi người đã đến hôm nay!"
- Recap highlights: "Chúng ta đã học được..."
- Highlight connections made (stories nếu có)

[5 min] Call-to-Action
- "Join our community: [Link]"
- "Next event: [Date] - [Theme]"
- "Special offer: Event-only [Discount]% for new memberships"
- "Fill out feedback form: [QR Code]"

Photo Session:
- Group photo (everyone)
- Casual photos (can stay back to network more)
```

## Related Code Files

### Files to Create
- `areas/operations/event-checklist.md` - Checklist for event day
- `areas/operations/mc-script-template.md` - Full MC script template
- `areas/operations/networking-activities.md` - Ice-breaker activities library
- `areas/operations/event-budget-template.md` - Budget template
- `areas/operations/vendor-contact-list.md` - Vendors (catering, AV, etc.)

### Files to Modify
- (None - đây là new system)

## Implementation Steps

1. ✅ **Validate format:** Test với team内部 và 5-10 community members
2. ✅ **Create run-of-show:** Detailed minute-by-minute plan
3. ✅ **Build materials kit:** Name tags, bingo cards, signage
4. ✅ **Train MC:** Develop MC skills hoặc hire professional
5. ✅ **Setup systems:** Check-in system, email collection, lucky draw
6. ✅ **Pilot event:** Run first event with feedback collection

## Todo List

- [ ] Create detailed MC script template (Vietnamese)
- [ ] Design name tag template with color coding
- [ ] Create networking bingo card design
- [ ] Build event check-in system (Google Forms hoặc Typeform)
- [ ] Create email capture mechanism
- [ ] Source/create lucky draw software hoặc hardware
- [ ] Train MC hoặc book professional MC
- [ ] Create event day checklist (setup, during, breakdown)
- [ ] Test timeline với mock event (2 hours)
- [ ] Create feedback form template

## Success Criteria

- [ ] Format validated với 10+ potential attendees
- [ ] MC script complete in Vietnamese
- [ ] All materials designed and ready to print
- [ ] Event checklist covers all scenarios
- [ ] Team trained on procedures
- [ ] Pilot event scheduled

## Risk Assessment

### Risk 1: Timeline overrun (người tham dự phải về sớm)
- **Mitigation:** Strict timekeeping, MC trained to cut short nếu cần
- **Backup Plan:** Pre-defined sections to skip if running late
- **Severity:** Medium

### Risk 2: Awkward networking silence
- **Mitigation:** Music background, MC facilitation, conversation starters
- **Backup Plan:** MC jump in to seed conversations
- **Severity:** Medium

### Risk 3: Speaker no-show hoặc late
- **Mitigation:** Have backup speaker hoặc pre-recorded video
- **Backup Plan:** MC extended Q&A với audience
- **Severity:** High

### Risk 4: AV equipment failure
- **Mitigation:** Test equipment 1 hour before, have backup
- **Backup Plan:** Run without slides, use whiteboard
- **Severity:** Medium

### Risk 5: Low attendance (< 20 people)
- **Mitigation:** Aggressive marketing, personal outreach
- **Backup Plan:** More intimate format, circle discussion
- **Severity:** Low

## Security Considerations

- **Data privacy:** Email capture compliant với Vietnam's data laws
- **Venue safety:** Emergency exits, first aid kit
- **Harassment policy:** Code of conduct cho attendees

## Next Steps

1. Move to **Phase 3: Ngân sách và tài trợ** để determine financial viability
2. Parallel: Begin creating materials và systems
3. Start outreach cho potential speakers

---

**Giai đoạn tiếp theo:** [Phase 3 - Ngân sách và tài trợ](./phase-03-budget-and-sponsorship.md)
