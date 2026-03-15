# Giai đoạn 4: Marketing và Thu hút Người tham dự

## Tổng quan

**Ưu tiên:** CAO ⚠️
**Trạng thái:** ⏳ Chưa bắt đầu
**Mục tiêu:** Xây dựng chiến lược marketing đa kênh để thu hút 30-80 người tham dự/sự kiện consistently

## Context

- **Target markets:** Startups, freelancers, students, professionals, digital nomads
- **Geographic focus:** Cầu Giấy, Đống Đa, Ba Đình, Hà Nội (primarily)
- **Marketing channels:** Social media, email, word-of-mouth, partnerships
- **Conversion goal:** Registration → Attendance → Membership

## Key Insights

### Vietnamese event marketing landscape (2025-2026)

**Platform effectiveness:**
1. **Facebook Groups** (Most effective): Hanoi Startup, Freelancer Vietnam groups
2. **TikTok** (Growing fast): Event teasers, behind-the-scenes content
3. **Instagram** (Visual branding): Event photos, community vibes
4. **LinkedIn** (Professional audience): Corporate partnerships, speakers
5. **Email newsletters** (Retention): Past attendees, member base

**Pricing psychology in Vietnam:**
- Early bird discount (30-40% off) drives urgency
- "Mua chung" deals (group discount) effective
- Free taster sessions convert to paid events well
- Students respond to "valid student ID" discounts

### What works for event marketing in Hanoi

**Successful tactics:**
1. **Speaker leverage:** Big name speakers draw crowds
2. **Community partnerships:** Cross-promote with other communities
3. **FOMO marketing:** "Only 5 early bird tickets left"
4. **Social proof:** "Join 200+ professionals who attended last month"
5. **Location convenience:** Emphasize accessibility, parking
6. **Visual content:** High-quality photos/videos from past events

**What doesn't work:**
1. Generic corporate-speak copy
2. No clear value proposition ("What's in it for me?")
3. Last-minute promotion (< 2 weeks before)
4. Ignoring follow-up with no-shows
5. No social proof/testimonials

## Requirements

### Functional Requirements
1. Multi-channel marketing strategy (6+ channels)
2. Content calendar cho mỗi event (6 weeks out)
3. Email capture và nurturing system
4. Conversion funnel tracking
5. Community building tactics

### Non-functional Requirements
1. Authentic community voice (không corporate)
2. Consistent brand experience
3. Culturally appropriate messaging
4. Measurable ROI per channel

## Architecture - Marketing Funnel

```
┌─────────────────────────────────────────────────────────────┐
│ AWARENESS (Reach: 10,000+ people/month)                    │
├─────────────────────────────────────────────────────────────┤
│ Channels:                                                   │
│ • Facebook Groups (Hanoi Startup, etc.)                    │
│ • TikTok event teasers                                     │
│ • Instagram Reels (behind-the-scenes)                      │
│ • Partner community cross-promotions                       │
│ • Speaker social media shares                              │
│ • Google Ads (search "networking events hanoi")            │
│ • LinkedIn event posts                                     │
│                                                             │
│ Metrics: Impressions, Reach, Engagement Rate               │
├─────────────────────────────────────────────────────────────┤
│ INTEREST (Email capture: 500+ leads/month)                 │
├─────────────────────────────────────────────────────────────┤
│ Tactics:                                                    │
│ • Eventbrite registration page (email capture)             │
│ • "Join waitlist" for next event                           │
│ • Free community newsletter signup                         │
│ • Lead magnet: "Networking Tips PDF"                       │
│ • Social media link-in-bio to landing page                 │
│                                                             │
│ Metrics: Email subscribers, Waitlist signups, Landing page  │
│   conversions                                               │
├─────────────────────────────────────────────────────────────┤
│ CONSIDERATION (Registration: 50+ people/event)             │
├─────────────────────────────────────────────────────────────┤
│ Tactics:                                                    │
│ • Email sequence: Save the date → Early bird → Last chance │
│ • Retargeting ads (website visitors)                       │
│ • Direct messages to warm leads                            │
│ • Partner email blasts (exchange)                          │
│ • Speaker announcement posts                               │
│                                                             │
│ Metrics: Click-through rate, Registration conversion,      │
│   Ticket sales                                              │
├─────────────────────────────────────────────────────────────┤
│ INTENT (Payment/Commitment: 30-80 paid tickets)            │
├─────────────────────────────────────────────────────────────┤
│ Tactics:                                                    │
│ • Limited early bird tickets (create urgency)              │
│ • Scarcity messaging ("Only 5 tickets left")               │
│ • Payment flexibility (bank transfer, e-wallet)            │
│ • Reminder emails (1 week, 1 day before)                   │
│                                                             │
│ Metrics: Payment completion rate, Abandoned cart recovery   │
├─────────────────────────────────────────────────────────────┤
│ ATTENDANCE (Show-up rate: 70-80%)                          │
├─────────────────────────────────────────────────────────────┤
│ Tactics:                                                    │
│ • Multiple reminder channels (email, SMS, Zalo)            │
│ • Weather contingency plans                                │
│ • Easy check-in process                                    │
│ │ • "Can't make it? Transfer your ticket" policy          │
│                                                             │
│ Metrics: Show-up rate, No-show rate, Check-in time         │
├─────────────────────────────────────────────────────────────┤
│ RETENTION (Repeat attendance: 40%+ return)                 │
├─────────────────────────────────────────────────────────────┤
│ Tactics:                                                    │
│ • Post-event email with photos + feedback request          │
│ • Exclusive discounts for next event                       │
│ • Community Facebook group (ongoing engagement)            │
│ • Member spotlight features                                │
│                                                             │
│ Metrics: Repeat attendance rate, Email open rate, Community │
│   group engagement                                          │
├─────────────────────────────────────────────────────────────┤
│ CONVERSION (Membership: 8%+ of attendees)                  │
├─────────────────────────────────────────────────────────────┤
│ Tactics:                                                    │
│ • Event-only membership offers                             │
│ • Trial coworing pass incentives                           │
│ • Personal outreach to high-engagement attendees           │
│ • Success stories ("From attendee to member")              │
│                                                             │
│ Metrics: Conversion rate, Time to conversion, LTV          │
└─────────────────────────────────────────────────────────────┘
```

## Architecture - Marketing Channels & Tactics

### Channel 1: Facebook & Instagram (Primary)

**Content Types:**

```markdown
📅 6 WEEKS BEFORE EVENT

[POST 1] Event Announcement
Type: Carousel album (5 slides)
Content:
- Slide 1: Event name + date + hook
- Slide 2: Speaker intro + photo
- Slide 3: What you'll learn (bullet points)
- Slide 4: Who should attend
- Slide 5: Early bird CTA (price + deadline)

Caption:
🚀 EXCITING NEWS! [Event Name] is coming to Sol Cafe this [Month]!

Join us for an evening of [brief description] featuring [Speaker Name],
[Speaker title] who [achievement].

🎯 Perfect for: [Target audience 1], [Target audience 2], [Target audience 3]

📅 When: [Date] | 📍 Where: Sol Cafe Coworking, 181 TQV
💰 Early bird: 150K (first 20 tickets) → Regular: 250K

Link in bio to register! 🎫

#HanoiEvents #Networking #CoworkingHanoi #[Theme]

[Expected reach: 2,000-5,000 | Expected engagement: 100-300]

---

[POST 2] Speaker Reveal (1 week later)
Type: Video interview (30-60 seconds) or photo carousel
Content:
- Behind-the-scenes clip with speaker
- Quick teaser of what they'll share
- Personal story snippet

Caption:
🎤 SPEAKER REVEAL: Meet [Speaker Name]!

We're thrilled to have [Name] join us for [Event Name]!

In this exclusive session, [Name] will share:
✅ [Key takeaway 1]
✅ [Key takeaway 2]
✅ [Key takeaway 3]

[Name]'s background: [2-3 sentence bio]

Early bird tickets are going fast! Grab yours now 👇
[Link]

#SpeakerSpotlight #[EventName] #HanoiCommunity

[Expected reach: 1,500-3,000 | Expected engagement: 80-200]

---

📅 4 WEEKS BEFORE EVENT

[POST 3] "Why Attend?" Value Proposition
Type: Reel/Video (15-30 seconds) or testimonial graphics
Content:
- Quick visual of past event vibes
- 3 reasons to attend
- Fear of missing out element

Caption:
🤔 WHY ATTEND [Event Name]?

Here's what past attendees say:
"[Testimonial quote from previous event]" - [Name]

You'll walk away with:
🎯 Actionable strategies you can implement immediately
💼 New connections with [number]+ like-minded professionals
🚀 Fresh inspiration to [achieve goal]

Early bird pricing ends in [X] days! Don't miss out.
[Link]

[Expected reach: 2,000-4,000 | Expected engagement: 100-250]

---

📅 2 WEEKS BEFORE EVENT

[POST 4] Last Chance for Early Bird
Type: Urgency-driven graphic + countdown
Content:
- "Only X early bird tickets left"
- Countdown timer graphic
- Price comparison (early bird vs regular)

Caption:
⏰ LAST CHANCE! Early bird pricing ends in [X] days!

Regular price: 250K 💸
Early bird: 150K 💰 (save 40%)

[Number] early bird tickets already claimed. Only [X] left!

Secure your spot now before prices go up:
[Link]

Don't wait - these always sell out! 🔥

[Expected reach: 2,500-5,000 | Expected engagement: 150-400]

---

📅 1 WEEK BEFORE EVENT

[POST 5] "Who's Coming?" Social Proof
Type: Photo carousel of attendees/companies
Content:
- Logos/headshots of registered attendees
- "Join X professionals from these companies"
- Diversity showcase (industries, roles)

Caption:
🎉 WHO'S JOINING US FOR [Event Name]?

We've got an amazing group signing up! Here's a sneak peek:

🏢 From companies like: [List 5-7 companies/organizations]
👥 Professionals in: [Industries/roles]
🎯 Looking to: [Goals - connect, learn, grow]

Current attendees: [Number]
Spots remaining: [Number]

Will YOU be there? Last chance to register:
[Link]

[Expected reach: 2,000-4,000 | Expected engagement: 120-300]

---

📅 2 DAYS BEFORE EVENT

[POST 6] Final Reminder
Type: Simple urgency graphic
Content:
- Event details (date, time, location)
- "Registration closes in 48 hours"
- What to bring/wear

Caption:
⚡ FINAL CALL! [Event Name] is THIS [Day of Week]!

Are you ready to [exciting outcome]?

📅 Date: [Date]
⏰ Time: [Time]
📍 Location: Sol Cafe Coworking, 181 Trần Quốc Vượng

✨ What to expect:
[3 bullet points on agenda highlights]

Registration closes in 48 hours!
[Link]

See you there! 👋

[Expected reach: 1,500-3,000 | Expected engagement: 80-200]

---

📅 DAY OF EVENT

[POST 7] "Happening Now" (Morning of)
Type: Quick photo/setup shot
Content:
- Venue setup photo
- "We're ready for you!"
- Last minute reminder

Caption:
🎊 WE'RE LIVE! [Event Name] starts in [X] hours!

The team is setting up and getting excited. Can't wait to see
everyone who registered!

If you haven't checked in yet, remember to bring your ticket.
Walk-ins welcome if space allows!

See you soon at Sol Cafe! 🚀

[Event hashtag]

[Expected reach: 1,000-2,000 | Expected engagement: 60-150]

---

📅 DAY AFTER EVENT

[POST 8] Thank You + Recap
Type: Album of event photos (15-20 photos)
Content:
- Highlights from the event
- Speaker moments
- Networking shots
- Group photos

Caption:
🎉 WHAT A NIGHT! Thank you to everyone who joined [Event Name]!

Highlights from yesterday:
✨ [Number] amazing attendees
✨ [Speaker Name] shared incredible insights
✨ So many great conversations and connections made
✨ [Fun fact or memorable moment]

Missed this one? Don't worry - our next event is [Date]!
Mark your calendars and join the waitlist:
[Link]

📸 Photos by [Photographer credit]

Until next time! 👋

#HanoiNetworking #SolCafeCommunity #[EventName]

[Expected reach: 3,000-6,000 | Expected engagement: 200-500]

---

📅 1 WEEK AFTER EVENT

[POST 9] Testimonial/Quote Card
Type: Graphic with attendee quote
Content:
- Photo of attendee + quote
- "Why I attended" story

Caption:
💬 WHAT ATTENDEES ARE SAYING

"[Full testimonial quote]"
- [Name], [Job Title] at [Company]

Why they came: [Reason]
What they gained: [Outcome]
Will they return? [Answer]

Join the community for the next event!
[Link]

[Expected reach: 1,500-3,000 | Expected engagement: 100-250]
```

**Instagram Stories Strategy (Daily for 2 weeks before event):**

```
Day 1: "Save the date" graphic
Day 2: Speaker intro (photo + facts)
Day 3: "Did you know?" industry stat
Day 4: Poll: "What's your biggest [topic] challenge?"
Day 5: Countdown: "7 days to go!"
Day 6: Behind-the-scenes: Planning the event
Day 7: Q&A sticker: "Ask the speaker anything!"
Day 8: testimonial from past event
Day 9: "Who should attend?" checklist
Day 10: Flash sale: "5 tickets left at early bird price!"
Day 11: Venue tour (video)
Day 12: "What to expect" agenda preview
Day 13: Countdown: "1 day to go!"
Day 14: "See you tomorrow!" reminder
Day 15 (day after): Event recap highlights
```

### Channel 2: TikTok (Awareness & Viral Potential)

**Content Strategy:**

```markdown
[VIDEO 1] Event Announcement (6 weeks before)
Hook: "POV: You're tired of awkward networking events 😬"
Content: Show relatable networking pain points → transition to Sol Cafe events
CTA: "Join [Number]+ professionals at our next event! Link in bio."
Length: 30-45 seconds
Trending sound: Yes

[VIDEO 2] Day-in-the-Life: Freelancer/Startup Founder (4 weeks before)
Hook: "What a [Freelancer/Founder] in Hanoi actually does all day"
Content: Show work day → evening networking event as highlight
CTA: "Community is everything. Join us at next event!"
Length: 60 seconds
Trending sound: Yes

[VIDEO 3] Speaker Teaser (3 weeks before)
Hook: "This founder went from [struggle] to [success] in [time]"
Content: Quick story about speaker → plug event
CTA: "Hear their full story at our event! Link in bio."
Length: 45-60 seconds
Trending sound: Yes

[VIDEO 4] Behind-the-Scenes Event Setup (2 days before)
Hook: "POV: Setting up the best networking event in Hanoi 🚀"
Content: Timelapse of setup + energy building
CTA: "Last chance to grab tickets! Link in bio."
Length: 15-30 seconds
Trending sound: Yes

[VIDEO 5] Event Recap (day after)
Hook: "Last night was INSANE 🤯 [Number] people, [X] hours of networking"
Content: Event highlights, testimonials, energy
CTA: "Don't miss the next one! Join waitlist in bio."
Length: 45-60 seconds
Trending sound: Yes

[VIDEO 6] Educational Value (ongoing)
Hook: "The #1 mistake professionals make when networking [mistake]"
Content: Quick tip → mention we teach this at events
CTA: "Want more tips like this? Join our community!"
Length: 30-45 seconds
Trending sound: Yes
```

### Channel 3: Email Marketing (Nurturing & Conversion)

**Email Sequence:**

```
┌─────────────────────────────────────────────────────────────┐
│ EMAIL 1: Save the Date (6 weeks before)                    │
├─────────────────────────────────────────────────────────────┤
│ Subject: You're invited: [Event Name] 🚀                   │
│                                                             │
│ Hi [Name],                                                  │
│                                                             │
│ Mark your calendars! [Event Name] is coming to Sol Cafe     │
│ on [Date], and we'd love for you to join us.               │
│                                                             │
│ WHAT TO EXPECT:                                             │
│ • [Benefit 1 - learn/connect/grow]                         │
│ • [Benefit 2]                                              │
│ • [Benefit 3]                                              │
│                                                             │
│ FEATURING:                                                  │
│ [Speaker Name], [Speaker Title]                            │
│ [Brief 2-line bio + achievement]                           │
│                                                             │
│ EARLY BIRD PRICING:                                         │
│ First 20 tickets: 150K (save 40%)                          │
│ Regular price: 250K                                         │
│                                                             │
│ [Button: Grab Early Bird Ticket]                           │
│                                                             │
│ Spots are limited - secure yours now!                      │
│                                                             │
│ See you there,                                             │
│ The Sol Cafe Team                                           │
├─────────────────────────────────────────────────────────────┤
│ EMAIL 2: Speaker Deep Dive (4 weeks before)                │
├─────────────────────────────────────────────────────────────┤
│ Subject: Meet [Speaker Name]: From [struggle] to success  │
│                                                             │
│ Hi [Name],                                                  │
│                                                             │
│ I wanted to share more about our upcoming speaker at        │
│ [Event Name] - [Speaker Name].                             │
│                                                             │
│ [Speaker's story - struggle → journey → success]           │
│                                                             │
│ At the event, [Name] will share:                           │
│ • [Learning 1]                                              │
│ • [Learning 2]                                              │
│ • [Learning 3]                                              │
│                                                             │
│ This is perfect for you if:                                │
│ ✓ [Condition 1]                                             │
│ ✓ [Condition 2]                                             │
│                                                             │
│ [Number] early bird tickets remaining.                     │
│ [Button: Register Now]                                      │
│                                                             │
│ Best,                                                       │
│ [Your Name]                                                 │
├─────────────────────────────────────────────────────────────┤
│ EMAIL 3: Last Chance Early Bird (2 weeks before)           │
├─────────────────────────────────────────────────────────────┤
│ Subject: ⏰ 48 hours left for 40% off!                     │
│                                                             │
│ Hi [Name],                                                  │
│                                                             │
│ Just a quick reminder - early bird pricing for             │
│ [Event Name] ends in 48 hours!                             │
│                                                             │
│ AFTER SUNDAY:                                               │
│ Regular price: 250K                                         │
│                                                             │
│ RIGHT NOW:                                                  │
│ Early bird: 150K (save 100K!)                              │
│                                                             │
│ [Button: Get Early Bird Price]                             │
│                                                             │
│ We've already got [Number] people registered -            │
│ will you be joining them?                                   │
│                                                             │
│ Hope to see you there!                                     │
│                                                             │
│ P.S. If the price is a barrier, reply to this email -       │
│ we have a few community spots available.                   │
├─────────────────────────────────────────────────────────────┤
│ EMAIL 4: Who's Coming? (1 week before)                     │
├─────────────────────────────────────────────────────────────┤
│ Subject: You're in good company at [Event Name] 🤝         │
│                                                             │
│ Hi [Name],                                                  │
│                                                             │
│ I'm excited about the group shaping up for                 │
│ [Event Name]!                                              │
│                                                             │
│ Here's a sneak peek at who's joining us:                   │
│                                                             │
│ FROM COMPANIES LIKE:                                       │
│ [Company 1], [Company 2], [Company 3], [Company 4]        │
│                                                             │
│ PROFESSIONALS IN:                                          │
│ [Industry 1], [Industry 2], [Industry 3]                   │
│                                                             │
│ GOALS PEOPLE ARE WORKING ON:                               │
│ "Looking for co-founder"                                   │
│ "Scaling my freelance business"                            │
│ "Transitioning to tech"                                    │
│                                                             │
│ Current attendees: [Number]                                 │
│ Spots remaining: [Number]                                  │
│                                                             │
│ [Button: Join This Amazing Group]                          │
│                                                             │
│ See you on [Day of Week]!                                  │
│                                                             │
│ [Your Name]                                                 │
├─────────────────────────────────────────────────────────────┤
│ EMAIL 5: Day Before Reminder                               │
├─────────────────────────────────────────────────────────────┤
│ Subject: See you tomorrow! 📅 [Event Name]                 │
│                                                             │
│ Hi [Name],                                                  │
│                                                             │
│ We're all set up for [Event Name] tomorrow -              │
│ can't wait to see you!                                     │
│                                                             │
│ QUICK DETAILS:                                             │
│ 📅 When: [Date]                                             │
│ ⏰ Time: [Time] (check-in starts 30 min early)             │
│ 📍 Where: Sol Cafe Coworking, 181 Trần Quốc Vượng         │
│                                                             │
│ WHAT TO BRING:                                             │
│ • Your ticket (digital or printed)                         │
│ • Business cards (if you have them)                        │
│ • Lots of questions!                                       │
│                                                             │
│ PARKING:                                                   │
│ Free parking available [location details]                  │
│                                                             │
│ See you tomorrow!                                          │
│                                                             │
│ P.S. If you can't make it, please let us know -            │
│ we have a waiting list.                                    │
├─────────────────────────────────────────────────────────────┤
│ EMAIL 6: Day After Thank You                              │
├─────────────────────────────────────────────────────────────┤
│ Subject: Thank you + Photos! 📸 [Event Name]               │
│                                                             │
│ Hi [Name],                                                  │
│                                                             │
│ Thank you so much for joining us at [Event Name]!         │
│                                                             │
│ We had such an amazing time with [Number] professionals    │
│ from diverse industries. Here are some highlights:          │
│                                                             │
│ ✨ [Highlight 1]                                            │
│ ✨ [Highlight 2]                                            │
│ ✨ [Highlight 3]                                            │
│                                                             │
│ PHOTOS FROM THE EVENT:                                     │
│ [Link to photo album or attach 3-5 best photos]            │
│                                                             │
│ WE'D LOVE YOUR FEEDBACK:                                   │
│ [Link to 3-question feedback form]                         │
│ (Takes 2 minutes, helps us improve)                        │
│                                                             │
│ UPCOMING EVENTS:                                           │
│ [Date]: [Next Event Name]                                  │
│ [Date]: [Event After Next]                                 │
│                                                             │
│ SPECIAL OFFER:                                             │
│ As a thank you for attending, here's [X]% off your        │
│ next event ticket:                                         │
│ [Code: ATTENDEE20]                                         │
│                                                             │
│ Hope to see you again soon!                                │
│                                                             │
│ Best,                                                       │
│ The Sol Cafe Team                                           │
├─────────────────────────────────────────────────────────────┤
│ EMAIL 7: Monthly Newsletter (2 weeks after)                │
├─────────────────────────────────────────────────────────────┤
│ Subject: What's happening at Sol Cafe this [Month]        │
│                                                             │
│ [Monthly newsletter format with:]                          │
│ • Recap of last event                                      │
│ • Upcoming events preview                                  │
│ • Community spotlight (member story)                       │
│ • Coworking tips/resources                                 │
│ • Special offers                                           │
│                                                             │
│ Goal: Keep community engaged between events                │
└─────────────────────────────────────────────────────────────┘
```

### Channel 4: Partner Communities (Cross-Promotion)

**Target Communities:**

```markdown
ONLINE COMMUNITIES:

1. Facebook Groups (Engagement Strategy)
   ┌────────────────────────────────────────────────────┐
   │ Hanoi Startup Community (50K+ members)             │
   │ Strategy: Share value first, promote later         │
   │ • Post: "5 Lessons from [topic] (Free PDF)"        │
   │ • Comment: Helpful answers, build reputation       │
   │ • Then: "We're hosting an event on this topic"     │
   └────────────────────────────────────────────────────┘

   Similar groups:
   - Freelancers Vietnam (20K+ members)
   - Digital Nomads Vietnam (5K+ members)
   - Hanoi Tech Meetup (10K+ members)
   - UX/UI Design Vietnam (15K+ members)
   - Content Creators Vietnam (8K+ members)

2. LinkedIn Groups & Pages
   ┌────────────────────────────────────────────────────┐
   │ Strategy: More professional, business-focused      │
   │ • Share: Speaker expertise, event value            │
   │ • Tag: Speaker company, partner organizations       │
   │ • Format: Professional event announcement          │
   └────────────────────────────────────────────────────┘

3. University Student Groups
   ┌────────────────────────────────────────────────────┐
   │ Target: Student Facebook groups, Discord servers   │
   │ • ĐH Quốc gia Hanoi                               │
   │ • Bách Khoa Alumni Network                        │
   │ • Ngoại Thương Business Club                      │
   │ • FPT University Student Community                │
   │                                                     │
   │ Strategy: Student discount, career focus           │
   └────────────────────────────────────────────────────┘

OFFLINE COMMUNITY PARTNERSHIPS:

1. Other Event Organizers
   ┌────────────────────────────────────────────────────┐
   │ Cross-Promotion Agreement:                         │
   │ • We promote their event to our list               │
   │ • They promote our event to their list             │
   │ • No cost, pure value exchange                     │
   │                                                     │
   │ Potential partners:                                │
   │ - Tech Meetups (AI, Web3, Dev communities)         │
   │ - Design workshops                                 │
   │ - Startup pitch competitions                       │
   │ - Professional training providers                  │
   └────────────────────────────────────────────────────┘

2. Coworking Spaces (Non-competing locations)
   ┌────────────────────────────────────────────────────┐
   │ Strategic Partners:                                │
   │ • Toong (premium, different segment)               │
   │ • Spaces in different districts (Tay Ho, Dong Da) │
   │ • Niche spaces (women-only, creator-focused)       │
   │                                                     │
   │ Collaboration:                                    │
   │ - Joint events (rotate venues)                     │
   │ - Member exchange (free day passes)                │
   │ - Cross-promotion to member bases                  │
   └────────────────────────────────────────────────────┘

3. Educational Institutions
   ┌────────────────────────────────────────────────────┐
   │ Partnership Opportunities:                         │
   │ • Guest speaking at universities                   │
   │ • Student internship fair partnerships             │
   │ • Alumni event collaborations                      │
   │                                                     │
   │ Target Schools:                                    │
   │ - FPT Polytechnic                                  │
   │ - Hanoi University                                 │
   │ - National Economics University                    │
   │ - Foreign Trade University                         │
   └────────────────────────────────────────────────────┘
```

### Channel 5: Speaker Amplification

**Speaker Activation Strategy:**

```markdown
PRE-EVENT (Speaker Promotion):

📧 TO SPEAKER (4 weeks before):
"Hi [Speaker Name], we're excited to have you speak at [Event]!

To maximize impact, we'd love your help spreading the word.
Here's what we've prepared for you:

📱 SOCIAL MEDIA KIT:
- Pre-written posts (Facebook/LinkedIn/TikTok)
- Event graphics with your photo
- Speaker intro video snippet (if available)

📧 EMAIL BLURB:
[Short paragraph they can forward to their network]

🎯 TARGET AUDIENCE:
[Who they should personally invite]

Can you:
1. Share 1-2 posts on social media?
2. Email your network (we can provide template)?
3. Tag 5-10 people who'd benefit?

Let me know if you need anything customized!"

SPEAKER EXPECTATIONS (Set in agreement):
✅ 1 social media post (choice of platform)
✅ Email to their personal network (optional)
✅ 3-5 personal invitations to key people

INCENTIVES FOR SPEAKERS:
- Extended brand exposure (we tag them in all posts)
- Access to attendee email list (opt-in only)
- Free professional photos from event
- Priority for future collaboration

DURING EVENT:
- Mention speaker's social handles
- Encourage live posting/tweeting with event hashtag
- Photo ops with speaker

POST-EVENT:
- Tag speaker in all recap content
- Provide speaker performance metrics (photos, engagement)
- Ask for testimonial about their experience
```

### Channel 6: Word-of-Mouth & Referrals

**Referral Program:**

```markdown
"BRING A FRIEND" PROGRAM:

For every friend you refer who attends:
🎁 You get: 50K VND discount on next event
🎁 They get: 50K VND discount on their first event

HOW IT WORKS:
1. You register for event
2. Get unique referral link/code
3. Share with friends
4. Both get discount when they attend
5. Unlimited referrals (attend for free with 5 referrals!)

TRACKING:
- Unique referral link per attendee
- Dashboard showing referrals earned
- Automatic discount code generation

EXAMPLE:
"Refer 5 friends → Your next event is FREE!"
```

**Community Ambassador Program:**

```markdown
SOL CAFE AMBASSADORS:

Who: Highly engaged community members
Benefits:
🎟️ Free events (attend all 12 events)
👕 Exclusive swag (t-shirt, tote bag)
📚 Priority access to special events
💼 Featured on our website

Responsibilities:
✅ Promote events in your networks (social media, word-of-mouth)
✅ Welcome new attendees at events
✅ Collect feedback and share insights
✅ Host 1 table topic per event

Application:
[Google Form - select 5-10 ambassadors]

Term: 6 months (renewable based on engagement)
```

## Related Code Files

### Files to Create
- `areas/marketing/content-calendar-2026.xlsx` - 12-month content calendar
- `areas/marketing/email-templates.md` - All email templates
- `areas/marketing/social-media-assets/` - Folder for graphics
- `areas/marketing/sponsorship-deck.pdf` - Sponsorship deck (also Phase 3)
- `areas/marketing/partner-outreach-list.xlsx` - Partner contact management
- `areas/marketing/referral-tracking-system.md` - Referral program setup

### Files to Modify
- (None - new system)

## Implementation Steps

1. ✅ **Create content calendar:** Map out 12 months of posts
2. ✅ **Design social media templates:** Event graphics, testimonials, quotes
3. ✅ **Set up email marketing system:** Mailchimp/SendGrid/MailerLite
4. ✅ **Build event registration:** Eventbrite hoặc custom Typeform + payment
5. ✅ **Create tracking sheet:** Monitor all channels performance
6. ✅ **Research 30+ communities/groups:** For cross-promotion
7. ✅ **Draft partnership outreach emails:** For community collaborations
8. ✅ **Set up referral program:** Technical implementation
9. ✅ **Create welcome sequence:** For new email subscribers
10. ✅ **Test all funnels:** From awareness → registration → attendance

## Todo List

- [ ] Create 12-month social media content calendar (Vietnamese)
- [ ] Design 10 reusable social media templates
- [ ] Set up email marketing platform (Mailchimp/SendGrid)
- [ ] Create all 7 email templates (Vietnamese)
- [ ] Set up Eventbrite hoặc Typeform + payment gateway
- [ ] Create Facebook/Instagram/TikTok accounts (if needed)
- [ ] Research and list 50 Facebook groups to engage with
- [ ] Draft partnership outreach email template
- [ ] Create referral program landing page/rules
- [ ] Set up UTM tracking for all marketing channels
- [ ] Create attendee feedback form (Google Forms)
- [ ] Design speaker media kit (graphics + templates)
- [ ] Write first month's content (all channels)
- [ ] Test registration flow end-to-end

## Success Criteria

- [ ] Content calendar complete for 12 months
- [ ] All email templates created and tested
- [ ] Registration system live and processing payments
- [ ] Social media accounts active with first content posted
- [ ] 50+ communities/groups identified for engagement
- [ ] Referral program technical setup complete
- [ ] Tracking dashboard created (Google Sheets or analytics)
- [ ] Partnership outreach emails sent to 20+ potential partners
- [ ] First event registration page live
- [ ] Test registration with 5-10 people (friends/team)

## Risk Assessment

### Risk 1: Low registration numbers (< 20 people)
- **Mitigation:** Aggressive early bird pricing, personal outreach, speaker promotion
- **Backup Plan:** Extend early bird, offer group discounts, pivot to free event
- **Severity:** High

### Risk 2: High no-show rate (> 30%)
- **Mitigation:** Multiple reminders, easy transfer policy, deposit system
- **Backup Plan:** Overbook by 20%, maintain waitlist
- **Severity:** Medium

### Risk 3: Marketing channels ineffective (low ROI)
- **Mitigation:** Track UTM parameters, A/B test messages, pivot budget
- **Backup Plan:** Focus on word-of-mouth and partnerships
- **Severity:** Medium

### Risk 4: Speaker doesn't promote event
- **Mitigation:** Set expectations early, provide ready-made content
- **Backup Plan:** Promote heavily ourselves, leverage other channels
- **Severity:** Low

### Risk 5: Platform dependency (Eventbrite down, Facebook blocked)
- **Mitigation:** Have backup platforms, direct registration option
- **Backup Plan:** Google Form + bank transfer backup
- **Severity:** Low

## Security Considerations

- **Data privacy:** Email marketing compliant với Vietnam's Personal Data Protection Law
- **Payment security:** Use trusted payment gateways (Momo, bank transfer with confirmation)
- **Scam prevention:** Warn attendees about fake ticket sales

## Next Steps

1. Execute marketing setup (accounts, templates, systems)
2. Begin content creation for first event
3. Move to **Phase 5: Kịch bản chi tiết** cho event execution
4. Parallel: Start partner outreach and speaker coordination

---

**Giai đoạn tiếp theo:** [Phase 5 - Kịch bản chi tiết sự kiện](./phase-05-detailed-event-script-timeline.md)
