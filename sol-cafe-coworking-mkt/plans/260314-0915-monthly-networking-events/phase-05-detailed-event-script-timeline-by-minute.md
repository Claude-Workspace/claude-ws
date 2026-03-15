# Giai đoạn 5: Kịch bản Chi tiết Sự kiện (Timeline từng phút)

## Tổng quan

**Ưu tiên:** CAO ⚠️
**Trạng thái:** ⏳ Chưa bắt đầu
**Mục tiêu:** Tạo kịch bản chi tiết cho sự kiện mẫu, đảm bảo mọi thành viên team biết chính xác làm gì vào từng thời điểm

## Context

- **Sự kiện mẫu:** "Startup Meetup - From Idea to MVP" (Tháng 5/2026)
- **Dự kiến:** 50 người tham dự
- **Team:** 1 MC + 1 Coordinator + 1 Support Staff
- **Thời gian:** 18:00 - 21:00 (3 giờ)
- **Venue:** Sol Cafe Coworking, 181 Trần Quốc Vượng

## Key Insights

### Tại sao cần kịch bản chi tiết?

**Problems với ad-hoc events:**
1. Timeline overrun → người tham dự phải về sớm, unhappy
2. Awkward transitions → energy drops, awkward silence
3. Staff không biết làm gì → chaos, unprofessional
4. Equipment không ready → delays, bad impression
5. Speaker không prepared → poor content quality

**Benefits của detailed script:**
1. Predictable experience cho attendees
2. Staff confidence (everyone knows their role)
3. Professional polish (smooth transitions)
4. Crisis ready (backup plans built-in)
5. Replicable (can copy-paste cho future events)

### Best practices từ event professionals

**Golden rules:**
1. **Start on time** → Respect people who arrived on time
2. **End on time** → Respect people's commitments after
3. **Never leave dead air** → Always have transition content ready
4. **Over-communicate with team** → Briefing 30 min before
5. **Test everything twice** → Setup 2 hours before, not 30 min

## Architecture - Complete Event Script

### Pre-Event Setup (14:00 - 17:30)

```
┌─────────────────────────────────────────────────────────────┐
│ 14:00 - 15:30 (1.5 hours before): Venue Setup              │
├─────────────────────────────────────────────────────────────┤
│ RESPONSIBLE: Coordinator + Support Staff + Venue Team      │
│                                                             │
│ TASKS:                                                      │
│ [ ] Arrange chairs/tables (layout confirmation)            │
│     • Style: Cabaret (round tables) or Classroom (rows)    │
│     • Capacity: 50 seats + 10 extra for overflow           │
│     • Position: Facing stage/screen                        │
│                                                             │
│ [ ] AV Equipment Setup                                     │
│     • Projector + screen test                              │
│     • Microphone test (lapel + handheld backup)            │
│     • Speakers/sound system test                           │
│     • Laptop connection (HDMI/USB-C)                       │
│     • Clicker/remote for speaker                           │
│     • Backup laptop with slides loaded                     │
│                                                             │
│ [ ] Registration Table Setup                               │
│     • Table at entrance                                    │
│     • QR code check-in sign                               │
│     • Name tags (pre-printed + blank for walk-ins)         │
│     • Lanyards/markers                                     │
│     • Program one-pagers                                  │
│     • Payment system (for walk-ins)                        │
│                                                             │
│ [ ] F&B Station Setup                                     │
│     • Welcome drink station                                │
│     • Snacks table (finger foods)                          │
│     • Coffee/tea station (self-service)                    │
│     • Water station                                        │
│     • Trash bins visible                                   │
│                                                             │
│ [ ] Decor & Branding                                      │
│     • Event banner/backdrop                               │
│     • Sol Cafe signage                                    │
│     • Sponsor logos (if applicable)                        │
│     • Photo op backdrop (for group photos)                │
│                                                             │
│ [ ] Emergency Prep                                        │
│     • First aid kit accessible                            │
│     • Emergency exits marked                              │
│     • Wifi password visible                               │
│     • Power strips/extension cords                        │
│     • Emergency contact list                              │
├─────────────────────────────────────────────────────────────┤
│ 15:30 - 16:00: Technical Rehearsal                         │
├─────────────────────────────────────────────────────────────┤
│ RESPONSIBLE: MC + Coordinator + Speaker (if available)     │
│                                                             │
│ TASKS:                                                      │
│ [ ] Sound check with MC                                    │
│     • Test mic volume, clarity                            │
│     • Practice opening speech                              │
│                                                             │
│ [ ] Slide test with Speaker                                │
│     • Confirm presentation works                           │
│     • Test font size/readability                          │
│     • Confirm clicker works                                │
│                                                             │
│ [ ] Lighting check                                         │
│     • Stage lighting                                       │
│     • Room lighting (dim during presentation)              │
│                                                             │
│ [ ] Run-through of transitions                             │
│     • Entrance music                                      │
│     • Presentation mode                                   │
│     → Q&A mode                                            │
│     → Networking mode                                     │
├─────────────────────────────────────────────────────────────┤
│ 16:00 - 17:00: Team Briefing + Break                       │
├─────────────────────────────────────────────────────────────┤
│ RESPONSIBLE: All team members                             │
│                                                             │
│ AGENDA:                                                    │
│ 16:00 - 16:15: Run-through of event script                │
│     • Review timeline minute-by-minute                     │
│     • Confirm roles for each section                      │
│     • Clarify handoffs                                     │
│                                                             │
│ 16:15 - 16:30: Role-specific briefing                     │
│     MC:                                                  │
│     - Script review, key phrases, pronunciations          │
│     - Backup plan if speaker no-show                      │
│     - Time management cues                                │
│                                                             │
│     Coordinator:                                         │
│     - Registration flow                                   │
│     - Speaker management                                  │
│     - Crisis response lead                                │
│                                                             │
│     Support Staff:                                        │
│     - F&B replenishment schedule                          │
│     - Photography/videography                             │
│     - Crowd management                                    │
│                                                             │
│ 16:30 - 16:45: Final walk-through                         │
│     • Physical walkthrough of venue                       │
│     • Test all equipment one more time                    │
│     • Confirm supplies (name tags, pens, materials)       │
│                                                             │
│ 16:45 - 17:00: Break + Refresh                            │
│     • Team hydrates, snacks                               │
│     • Change into event attire if needed                  │
│     • Mental preparation                                  │
├─────────────────────────────────────────────────────────────┤
│ 17:00 - 17:45: Final Prep (Registration opens at 17:30)   │
├─────────────────────────────────────────────────────────────┤
│ RESPONSIBLE: All hands on deck                            │
│                                                             │
│ 17:00: Final equipment check                              │
│ [ ] Laptop plugged in, on charger                         │
│ [ ] Microphone batteries fresh                            │
│ [ ] Presentation in presenter mode                        │
│ [ ] Music playlist ready (background + transitions)       │
│ [ ] Name tags organized alphabetically                   │
│                                                             │
│ 17:15: Team positions                                     │
│ [ ] Coordinator at registration table                     │
│ [ ] Support Staff at F&B station                          │
│ [ ] MC backstage/clear                                    │
│                                                             │
│ 17:30: Registration Opens (30 min before event)           │
│ [ ] Smile and greet first arrivals                        │
│ [ ] Check-in process:                                     │
│     • Scan QR code hoặc lookup name                       │
│     • Hand over name tag + lanyard                        │
│     • Give program one-pager                              │
│     • Point to welcome drink                              │
│ [ ] Direct early arrivals to networking area              │
│ [ ] Background music: Lo-fi beats (energizing but chill)  │
└─────────────────────────────────────────────────────────────┘
```

### Event Timeline (18:00 - 21:00)

```
┌─────────────────────────────────────────────────────────────┐
│ 18:00 - 18:30 (30 min): Registration & Warm-up            │
├─────────────────────────────────────────────────────────────┤
│ COORDINATOR:                                               │
│ ✓ Managing check-in queue                                 │
│ ✓ Handling walk-ins (payment if needed)                   │
│ ✓ Distributing name tags (color-coded)                     │
│ ✓ Monitoring attendance numbers                           │
│                                                             │
│ SUPPORT STAFF:                                             │
│ ✓ Replenishing F&B as needed                              │
│ ✓ Encouraging ice-breaker participation                   │
│ ✓ Taking candid photos (people arriving, mingling)        │
│ ✓ Ensuring networking area feels welcoming                │
│                                                             │
│ MC:                                                        │
│ ✓ Mixing with early arrivals                              │
│ ✓ Answering questions                                     │
│ ✓ Gauging room energy                                     │
│ ✓ Mental prep for opening                                 │
│                                                             │
│ BACKGROUND MUSIC:                                         │
│ • Genre: Lo-fi / Chill hop                                │
│ • Volume: Background level (can talk over)               │
│ • Transition cues prepared for when MC starts             │
├─────────────────────────────────────────────────────────────┤
│ 18:30 - 18:45 (15 min): Opening & Introduction            │
├─────────────────────────────────────────────────────────────┤
│ [18:30:00] ATTENTION GRABBER                               │
│                                                             │
│ MC actions:                                                │
│ 1. Fade background music slightly (still audible)         │
│ 2. Move to center stage/front of room                     │
│ 3. Raise hand gesture for attention                       │
│ 4. Wait for 10-15 seconds for room to settle              │
│ 5. Big welcome smile and energy!                          │
│                                                             │
│ MC SCRIPT (Vietnamese):                                    │
│                                                             │
│ "Xin chào mọi người! 👋                                   │
│                                                             │
│ [Pause for reaction and attention]                        │
│                                                             │
│ Chào mừng mọi người đến với Startup Meetup tháng 5,       │
│ chủ đề 'From Idea to MVP' - từ ý tưởng đến sản phẩm!      │
│                                                             │
│ Mình là [MC Name], và hôm nay mình rất vui được dẫn        │
│ chương trình cho buổi networking này.                     │
│                                                             │
│ Trước khi bắt đầu, mình có vài thông báo nhanh:           │
│                                                             │
│ 📱 Về điện thoại: Mời mọi người chế độ rung hoặc           │
│    tĩnh tiếng, nhưng nếu có thể, hãy live story/          │
│    Instagram vì chúng mình muốn lan tỏa energy này!        │
│                                                             │
│ 📸 Chụp ảnh: Tự do chụp ảnh, nhưng hãy tag                 │
│    @solcafecoworking để chúng mình cùng nhìn lại          │
│                                                             │
│ 🤝 Networking: Đừng ngại bắt chuyện - ai ở đây cũng        │
│    muốn kết nối cả!                                       │
│                                                             │
│ 🆘 Emergency: Nếu cần gì, hãy đội staff mặc                │
│    t-shirt Sol Cafe - họ luôn sẵn sàng giúp đỡ.           │
│                                                             │
│ Bây giờ, mình xin giới thiệu sơ về Sol Cafe Coworking."    │
│                                                             │
│ [18:35:00] SOL CAFE INTRODUCTION (5 minutes)               │
│                                                             │
│ "Sol Cafe Coworking không chỉ là nơi làm việc -            │
│ đây là một cộng đồng.                                      │
│                                                             │
│ Chúng mình tin rằng:                                       │
│ ✨ Mọi great idea đều bắt đầu từ một conversation         │
│ ✨ Mọi startup đều cần một community để lớn mạnh          │
│ ✨ Mọi freelancer đều cần không gian để thrive            │
│                                                             │
│ Tại đây, bạn sẽ tìm thấy:                                  │
│ 💼 Không gian làm việc flexible                            │
│ 🤝 Cộng đồng diverse (startup, freelancer, remote)         │
│ 🎉 Events hàng tháng (như hôm nay!)                       │
│ ☕ Cafe ngon để fuel productivity của bạn                 │
│                                                             │
│ Nếu bạn muốn trải nghiệm không gian, mình có một           │
│ offer đặc biệt:                                          │
│                                                             │
│ 🎁 Event-only offer: 20% off tháng đầu tiên khi            │
│    bạn signup hôm nay (đúng hôm nay chỉ!)                 │
│                                                             │
│ Bây giờ, mình xin đi vào agenda buổi hôm nay!"            │
│                                                             │
│ [18:40:00] AGENDA OVERVIEW (3 minutes)                    │
│                                                             │
│ "Trong 2.5 tiếng tới, chúng ta sẽ có 3 phần chính:        │
│                                                             │
│ 📌 PHẦN 1: Chia sẻ từ Founder (30 phút)                   │
│    [Speaker Name] sẽ chia sẻ hành trình từ ý tưởng        │
│    đến MVP - với những lesson learned đắt giá.            │
│                                                             │
│ 📌 PHẦN 2: Networking có chủ đạo (45 phút)                │
│    Không chỉ là 'buôn chuyện' - mình sẽ có speed          │
│    networking với prompt cụ thể để mọi người có           │
│    conversation chất lượng.                               │
│                                                             │
│ 📌 PHẦN 3: Lucky Draw & Chụp ảnh chung (15 phút)          │
│    Prizes worth 5 triệu đồng và chụp ảnh kỷ niệm!        │
│                                                             │
│ Mọi người hóng chờ không? 👀"                             │
│                                                             │
│ [Wait for audience response - cheer!]                     │
│                                                             │
│ "Tuyệt vời! Bây giờ, mình xin mời [Speaker Name]          │
│ lên sân khấu!"                                            │
│                                                             │
│ [18:43:00] TRANSITION TO SPEAKER (2 minutes)              │
│                                                             │
│ MC actions:                                                │
│ 1. Cue coordinator to bring speaker from backstage        │
│ 2. Hand over microphone (smooth handoff)                  │
│ 3. Step back but stay visible (for support)               │
│ 4. Change background music (transition music)             │
│                                                             │
│ MC SCRIPT:                                                 │
│ "[Speaker Name] là [brief bio]. Hôm nay [Name] sẽ         │
│ chia sẻ về [topic]. Xin mời!"                            │
│                                                             │
│ [Applause cue - MC initiates clapping]                    │
│                                                             │
│ SPEAKER INTRO (by MC or speaker self-intro):              │
│ "Cảm ơn [MC Name]. Chào mọi người, mình là [Name]..."    │
├─────────────────────────────────────────────────────────────┤
│ 18:45 - 19:30 (45 min): Speaker Presentation + Q&A       │
├─────────────────────────────────────────────────────────────┤
│ [18:45 - 19:15] SPEAKER PRESENTATION (30 minutes)         │
│                                                             │
│ COORDINATOR:                                               │
│ ✓ Monitor speaker comfort (water, etc.)                  │
│ ✓ Time tracking (subtle cue at 25 min mark)              │
│ ✓ Handle any technical issues immediately                 │
│ ✓ Take photos of speaker presenting                      │
│                                                             │
│ SUPPORT STAFF:                                             │
│ ✓ Capture audience reactions                             │
│ ✓ Ensure room lighting is good for photos                │
│ ✓ Replenish drinks if needed during transition           │
│                                                             │
│ MC:                                                        │
│ ✓ Stay visible but unobtrusive                           │
│ ✓ Be ready for Q&A transition                            │
│ ✓ Monitor audience engagement (if distracted, intervene) │
│                                                             │
│ [19:15 - 19:30] Q&A SESSION (15 minutes)                  │
│                                                             │
│ MC SCRIPT (Vietnamese):                                    │
│ "Cảm ơn [Speaker Name] về phần chia sẻ rất thực tế!       │
│                                                             │
│ Bây giờ là phần Q&A - ai có câu hỏi, xin hãy giơ tay       │
│ hoặc type vào chatbox nếu có!                            │
│                                                             │
│ [Call on 3-4 people from audience]                        │
│                                                             │
│ First question: [Acknowledge person] - [Name], bạn hỏi?  │
│ [Speaker answers]                                         │
│                                                             │
│ [Repeat for 3-4 questions]                                │
│                                                             │
│ Nếu không còn câu hỏi nào khác, mình xin mời mọi người    │
│ dành tràng pháo tay để cảm ơn [Speaker Name] một lần      │
│ nữa!"                                                     │
│                                                             │
│ [Applause]                                                 │
│                                                             │
│ "Nếu bạn muốn kết nối thêm với [Speaker Name], hãy        │
│ tìm [Name] sau sự kiện hoặc add LinkedIn tại..."          │
├─────────────────────────────────────────────────────────────┤
│ 19:30 - 20:15 (45 min): Structured Networking            │
├─────────────────────────────────────────────────────────────┤
│ [19:30:00] TRANSITION TO NETWORKING (2 minutes)           │
│                                                             │
│ MC SCRIPT:                                                 │
│ "Phần presentation rất tuyệt vời - nhưng bây giờ          │
│ là phần quan trọng nhất: NETWORKING! 🤝                   │
│                                                             │
│ Mình biết, networking có thể hơi awkward nếu không         │
│ có structure. Nên hôm nay mình đã chuẩn bị một format      │
│ đặc biệt!                                                 │
│                                                             │
│ Ai ở đây đã từng đi networking event và không biết         │
│ nói gì, đứng một mình? 🙋‍♀️                                │
│                                                             │
│ [Wait for show of hands - laugh!]                         │
│                                                             │
│ Đừng lo - hôm nay sẽ KHÔNG có awkward silence!            │
│                                                             │
│ Format speed networking như sau:                          │
│                                                             │
│ 📋 RULES:                                                  │
│ 1. Mọi người đứng dậy và tìm một partner (hoặc            │
│    mình sẽ random pair nếu bạn lẻ)                        │
│ 2. Mỗi round 6 phút - có timer trên màn hình              │
│ 3. Khi 'ding' - rotate partner (inner circle di chuyển)   │
│ 4. Có prompts để conversation không bị dry                │
│ 5. Sau 3 rounds, open networking tự do                    │
│                                                             │
│ READY? Let's go!"                                         │
│                                                             │
│ [19:32:00] SPEED NETWORKING SETUP (3 minutes)             │
│                                                             │
│ MC actions:                                                │
│ 1. Instruct people to form two rows (inner/outer)         │
│ 2. Distribute conversation prompt cards (if printed)      │
│ 3. Start countdown timer on screen                        │
│ 4. Cue upbeat background music                            │
│                                                             │
│ COORDINATOR:                                               │
│ ✓ Help people find partners if someone is alone          │
│ ✓ Monitor timer and cue "ding" sound at rotations         │
│ ✓ Encourage people to rotate, not stick with same person  │
│                                                             │
│ SUPPORT STAFF:                                             │
│ ✓ Take photos of networking in action                     │
│ ✓ Help with logistics (chairs, space clearing)            │
│                                                             │
│ CONVERSATION PROMPTS (displayed on screen):               │
│                                                             │
│ Round 1 (6 min):                                          │
│ "What brings you here today?"                             │
│ "What's a project you're excited about?"                  │
│                                                             │
│ Round 2 (6 min):                                          │
│ "What's a challenge you're facing right now?"             │
│ "How can I help you or who should you meet?"              │
│                                                             │
│ Round 3 (6 min):                                          │
│ "What's one thing you'd like to learn in the next         │
│  3 months?"                                               │
│ "Let's exchange contacts if we want to stay in touch"     │
│                                                             │
│ [19:50:00] OPEN NETWORKING (25 minutes)                   │
│                                                             │
│ MC SCRIPT:                                                 │
│ "Tuyệt vời! 3 rounds speed networking - hi vọng            │
│ mọi người đã kết nối được với một vài người mới!           │
│                                                             │
│ Bây giờ là open networking cho 25 phút tới.                │
│                                                             │
│ 💡 TIPS cho这段时间:                                        │
│ • Follow up với người bạn có conversation tốt             │
│ • Nhận another drink/snack                                │
│ • Đừng quân exchange contacts! (LinkedIn, Zalo, etc.)     │
│ • Tận dụng thời gian - đây là lúc connections được       │
│   cement!                                                 │
│                                                             │
│ Bên cạnh đó, có một 'Opportunities Corner' ở phía          │
│ sau - nếu bạn đang tuyển người, tìm co-founder,           │
│ hoặc có opportunities khác, hãy viết lên board!           │
│                                                             │
│ Enjoy networking! 🥂"                                     │
│                                                             │
│ MC actions:                                                │
│ 1. Transition music (lounge/jazz vibe)                    │
│ 2. Walk around, encourage interactions                    │
│ 3. Help facilitate introductions if someone looks stuck    │
│ 4. Monitor energy - boost if dropping                     │
│                                                             │
│ COORDINATOR:                                               │
│ ✓ Manage 'Opportunities Corner' board                    │
│ ✓ Help with drink refills                                 │
│ ✓ Keep networking area from getting too crowded           │
│                                                             │
│ SUPPORT STAFF:                                             │
│ ✓ Capture candid networking moments                      │
│ ✓ Record testimonials if people willing                   │
│ ✓ Help with any logistics issues                          │
├─────────────────────────────────────────────────────────────┤
│ 20:15 - 20:35 (20 min): Lucky Draw & Closing              │
├─────────────────────────────────────────────────────────────┤
│ [20:15:00] RECONVENE (5 minutes)                           │
│                                                             │
│ MC actions:                                                │
│ 1. Fade out background music                              │
│ 2. Move to center stage/front                             │
│ 3. Raise hand for attention (or use mic)                 │
│ 4. Wait 10 seconds for room to settle                     │
│                                                             │
│ MC SCRIPT:                                                 │
│ "Xin hãy mọi người hãy quay lại vị trí - mình có           │
│ một phần quan trọng nữa! 🎁                                │
│                                                             │
│ Nhưng trước đó, mình xin dành 2 phút để shout-out          │
│ một vài opportunities trong cộng đồng!"                   │
│                                                             │
│ [20:17:00] COMMUNITY ANNOUNCEMENTS (3 minutes)            │
│                                                             │
│ COORDINATOR:                                               │
│ ✓ Share from 'Opportunities Corner' board                 │
│ ✓ Allow 1-2 live shout-outs (people raise hand)          │
│ ✓ Keep it brief - max 3 announcements                    │
│                                                             │
│ Examples:                                                 │
│ "Team [Company] đang tìm Frontend Developer - interested  │
│  parties hãy find [Name] sau event!"                     │
│                                                             │
│ "[Name] vừa closed funding round cho startup -            │
│  congratulations! 🎉"                                      │
│                                                             │
│ [20:20:00] LUCKY DRAW (10 minutes)                        │
│                                                             │
│ MC SCRIPT:                                                 │
│ "Và bây giờ - MOMENT mọi người đang chờ đợi!               │
│                                                             │
│ LUCKY DRAW! 🎁🎁🎁                                         │
│                                                             │
│ Hôm nay mình có prizes worth tổng cộng 5 triệu đồng!       │
│                                                             │
│ 🥇 GRAND PRIZE: 1 tháng free coworking tại Sol Cafe        │
│    (worth 2 triệu!)                                       │
│                                                             │
│ 🥈 SECOND PRIZE (3 people): 1 tuần free coworking          │
│    (worth 500K each!)                                     │
│                                                             │
│ 🥉 THIRD PRIZE (5 people): Drink vouchers                  │
│    (worth 50K each!)                                      │
│                                                             │
│ Mechanic đơn giản:                                        │
│ Mình sẽ random name trên màn hình - nếu tên bạn            │
│ xuất hiện, HÔ to rõ tên và lên nhận prize!               │
│                                                             │
│ Ready? Let's spin!"                                       │
│                                                             │
│ COORDINATOR:                                               │
│ ✓ Run random name generator (laptop/projector)           │
│ ✓ Announce winners clearly                                │
│ ✓ Verify winner is present (if not, redraw)               │
│ ✓ Hand over prizes                                        │
│ ✓ Coordinate photo ops with winners                      │
│                                                             │
│ SUPPORT STAFF:                                             │
│ ✓ Capture winner reactions (photos/videos)                │
│ ✓ Help organize prize handover                           │
│                                                             │
│ [Draw prizes in order: 3rd → 2nd → Grand]                  │
│                                                             │
│ After Grand Prize:                                         │
│ "Xin chúc mừng [Winner Name]! 🎉                          │
│                                                             │
│ Và xin cảm ơn tất cả mọi người đã đến hôm nay -            │
│ hy vọng mọi người đã học được, kết nối được, và            │
│ có một buổi evening thú vị!"                               │
├─────────────────────────────────────────────────────────────┤
│ 20:35 - 21:00 (25 min): Photo Session & Informal Mingling│
├─────────────────────────────────────────────────────────────┤
│ MC SCRIPT:                                                 │
│ "Trước khi chúng mình kết thúc, mời mọi người              │
│ lên sân khấu cho一张 group photo! 📸"                     │
│                                                             │
│ MC actions:                                                │
│ 1. Lead people to stage/photo area                        │
│ 2. Coordinate group photo (everyone fit in frame)         │
│ 3. Take multiple shots (ensure good one)                  │
│ 4. Encourage informal photos after group shot             │
│                                                             │
│ "Với những ai muốn ở lại networking thêm, mời               │
│ nhé! F&B vẫn còn, music vẫn đang play!                   │
│                                                             │
│ Nhưng trước khi đi, đừng quên:                             │
│ 📝 Fill out feedback form (QR code ở bàn đăng ký)         │
│ 🎁 Grab your special offer (20% off coworking)            │
│ 🤝 Exchange contacts với những người bạn muốn stay         │
│    in touch with                                          │
│ 📅 Save the date cho next event: [Date] - [Theme]!        │
│                                                             │
│ Cảm ơn mọi người rất nhiều! Hẹn gặp lại mọi người         │
│ vào sự kiện tới! 👋❤️"                                     │
│                                                             │
│ [21:00:00] EVENT ENDS (but venue stays open for mingling) │
└─────────────────────────────────────────────────────────────┘
```

### Post-Event (21:00 - 22:00)

```
┌─────────────────────────────────────────────────────────────┐
│ 21:00 - 21:30: Immediate Breakdown                        │
├─────────────────────────────────────────────────────────────┤
│ COORDINATOR:                                               │
│ ✓ Thank speaker (walk them out, get feedback)            │
│ ✓ Collect name tags/reuse for next event                  │
│ ✓ Pack up registration table materials                    │
│ ✓ Count cash/ reconcile payments (if any walk-ins)        │
│                                                             │
│ SUPPORT STAFF:                                             │
│ ✓ Clear F&B station                                       │
│ ✓ Wipe down tables                                        │
│ ✓ Trash/recycle                                           │
│ ✓ Reset furniture (if needed)                             │
│                                                             │
│ MC:                                                        │
│ ✓ Thank team members personally                           │
│ ✓ Quick debrief: What went well? What to improve?        │
│ ✓ Check social media for tagged posts                     │
│ ✓ Engage with attendee posts/stories                      │
├─────────────────────────────────────────────────────────────┤
│ 21:30 - 22:00: Final Close                                │
├─────────────────────────────────────────────────────────────┤
│ ALL TEAM:                                                  │
│ [ ] AV equipment packed and returned                     │
│ [ ] Venue left clean and organized                        │
│ [ ] All trash removed                                     │
│ [ ] Doors locked/alarm set (if responsible)               │
│ [ ] Final headcount: Attendance numbers recorded         │
│                                                             │
│ COORDINATOR:                                               │
│ [ ] Send thank you email to speaker (template)            │
│ [ ] Upload photos to shared folder                        │
│ [ ] Create event recap document (notes for improvement)   │
│                                                             │
│ NEXT DAY TASKS (for tomorrow):                            │
│ [ ] Post event recap on social media                      │
│ [ ] Send thank you emails to attendees                    │
│ [ ] Collect and analyze feedback forms                    │
│ [ ] Update attendee database                              │
│ [ ] Start planning for next event                         │
└─────────────────────────────────────────────────────────────┘
```

## Architecture - Crisis Management Plan

### What If Scenarios

```markdown
SCENARIO 1: SPEAKER NO-SHOW OR LATE (> 15 min)

Trigger: Speaker not present by 18:45
Action Plan:
1. MC acknowledges situation at 18:50
2. Pivot to extended networking + panel discussion
3. If 30 min late: Cancel speaker portion, announce makeup speaker
4. Offer partial refunds if attendees upset

MC Script:
"Mọi người ơi, mình có một update: [Speaker Name] đã gặp
 một incident và không thể đến hôm nay được.

Thay vào đó, mình sẽ mở forum discussion - ai ở đây
 có startup story muốn share? Xin mời!"

SCENARIO 2: LOW ATTENDANCE (< 20 people)

Trigger: < 20 registrations by 1 week before
Action Plan:
1. Extend early bird pricing
2. Personal outreach to warm leads
3. Offer "bring a friend" 2-for-1 deal
4. Consider downscaling venue setup (intimate circle)
5. Send targeted messages to student groups

SCENARIO 3: EQUIPMENT FAILURE

Trigger: Projector/sound not working
Action Plan:
1. Technical team has 5 minutes to fix
2. If not fixable: Switch to mic-only presentation
3. Speaker presents without slides (use whiteboard)
4. Extra Q&A time to fill content gap

MC Script:
"Xin lỗi mọi người - chúng mình có một technical hiccup.
 Trong lúc team fix, mời [Speaker Name] share
 story đầu tiên - chưa bao giờ được tell before!"

SCENARIO 4: OVERFLOW (> 80 people show up)

Trigger: Walk-ins + registrations exceed capacity
Action Plan:
1. First priority: Registered attendees get seats
2. Overflow: Standing room at back
3. If severe: Split into 2 rooms, live stream to second room
4. Offer priority booking for next event to overflow people

SCENARIO 5: AWKWARD SILENCE DURING NETWORKING

Trigger: Room goes quiet, people not engaging
Action Plan:
1. MC jumps in with conversation starter
2. MC seeds a few conversations personally
3. Switch to structured activity (e.g., "Find someone who...")
4. Play background music louder to reduce awkwardness

MC Intervention:
"Này mọi người, mình thấy có vẻ shy thôi - challenge:
ai tìm được người đang làm trong cùng industry trong 2 phút tới,
 sẽ得到 một drink voucher!"

SCENARIO 6: MEDICAL EMERGENCY

Trigger: Attendee faints/gets injured
Action Plan:
1. Support staff calls emergency (113)
2. Coordinator clears area around person
3. MC pauses event, calmly asks for medical professional in room
4. First aid kit administered while waiting for ambulance
5. Resume event only when situation stable

SCENARIO 7: BAD WEATHER (Heavy rain/storm)

Trigger: Severe weather on event day
Action Plan:
1. Message all attendees: "Event still on, travel safe"
2. Provide covered parking info
3. Have towels/umbrellas at entrance
4. If dangerous: Reschedule with 24h notice
```

## Related Code Files

### Files to Create
- `areas/operations/event-day-checklist.md` - Full checklist for event day
- `areas/operations/mc-script-full-vietnamese.md` - Complete MC script
- `areas/operations/staff-roles-guide.md` - Detailed role descriptions
- `areas/operations/emergency-protocols.md` - Crisis management guide
- `areas/operations/venue-layout-diagram.pdf` - Floor plan with setup
- `areas/operations/timing-backup-plan.md` - Backup timing scenarios

### Files to Modify
- (None - new system)

## Implementation Steps

1. ✅ **Write complete MC script:** Vietnamese, professional, engaging
2. ✅ **Create staff role guides:** Detailed responsibilities per person
3. ✅ **Build event day checklist:** Hour-by-hour task list
4. ✅ **Design timing backup plans:** For overrun/underrun scenarios
5. ✅ **Create crisis management plan:** All "what if" scenarios documented
6. ✅ **Rehearse with team:** Full walk-through 1 week before event
7. ✅ **Print all materials:** Scripts, checklists, emergency contacts

## Todo List

- [ ] Write complete MC script in Vietnamese (all sections)
- [ ] Create staff briefing presentation (15 min before event)
- [ ] Build event day checklist (hour-by-hour from 14:00 to 22:00)
- [ ] Design crisis management quick-reference card
- [ ] Create role cards for each team member ( Coordinator, Support)
- [ ] Test all timing with team rehearsal (mock event)
- [ ] Print physical copies of all documents for event day
- [ ] Backup all documents to cloud/phone for access
- [ ] Create feedback form for post-event team debrief
- [ ] Document lessons learned template

## Success Criteria

- [ ] Complete MC script written (Vietnamese, 3000+ words)
- [ ] Staff role guides complete with detailed responsibilities
- [ ] Event day checklist covers all 8 hours (setup → breakdown)
- [ ] Crisis management plan addresses 6+ scenarios
- [ ] Team rehearsal conducted with feedback
- [ ] All materials printed and organized in event kit
- [ ] Backup plans tested (e.g., speaker no-show drill)

## Risk Assessment

### Risk 1: Timeline overrun (common issue)
- **Mitigation:** Strict timekeeping, pre-defined sections to skip
- **Backup Plan:** MC empowered to cut sections, reduce networking time
- **Severity:** High

### Risk 2: Team confusion during event
- **Mitigation:** Detailed role cards, pre-event briefing, clear handoffs
- **Backup Plan:** Coordinator as decision-maker for conflicts
- **Severity:** Medium

### Risk 3: Equipment failure derails event
- **Mitigation:** Redundant equipment, backup plans documented
- **Backup Plan:** Run without AV, focus on networking
- **Severity:** Medium

### Risk 4: Awkward transitions ruin energy
- **Mitigation:** Script all transitions, background music planned
- **Backup Plan:** MC fills gap with Q&A or audience interaction
- **Severity:** Low

### Risk 5: No-show speaker creates crisis
- **Mitigation:** Have backup speaker option, panel discussion pivot
- **Backup Plan:** Extended networking with structured activities
- **Severity:** High

## Security Considerations

- **Emergency exits:** Clearly marked and unblocked
- **First aid:** Kit accessible, staff trained on basic first aid
- **Crowd control:** Monitor room capacity, fire code compliance
- **Weather:** Monitor forecast, have contingency for severe weather

## Next Steps

1. Complete all scripts and guides
2. Conduct team rehearsal
3. Move to **Phase 6: Conversion Strategy** để maximize attendee value
4. Parallel: Begin setup for first event execution

---

**Giai đoạn tiếp theo:** [Phase 6 - Chuyển đổi người tham dự thành khách hàng](./phase-06-converting-attendees-to-paying-members.md)
