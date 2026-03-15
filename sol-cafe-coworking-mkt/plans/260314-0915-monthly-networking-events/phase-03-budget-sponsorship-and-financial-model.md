# Giai đoạn 3: Ngân sách và Tài trợ

## Tổng quan

**Ưu tiên:** CAO ⚠️
**Trạng thái:** ⏳ Chưa bắt đầu
**Mục tiêu:** Xác định chi phí tổ chức, nguồn thu, và chiến lược tài trợ để đảm bảo financial sustainability

## Context

- **Target ROI:** 150% sau 6 tháng
- **Breakeven target:** 30 người tham dự/sự kiện
- **Currency:** VND (Vietnam Dong)
- **Tax considerations:** 10% VAT cho ticket sales, 5% PIT cho speaker fees

## Key Insights

### Event economics tại Việt Nam (2025-2026)

**Cost benchmarks:**
- Venue rental: 5-15 triệu VND/event (tùy capacity)
- Professional MC: 1-3 triệu VND/event
- Speaker fee: 500K - 5 triệu VND (hoặc equity/revenue share)
- Catering: 50K-150K VND/người (drinks + light snacks)
- Marketing: 2-5 triệu VND/event (ads, graphics)
- Photography: 500K-1.5 triệu VND/event

**Revenue benchmarks:**
- Ticket pricing: 100K-500K VND (early bird → regular)
- Sponsorship packages: 5-20 triệu VND/sponsor
- In-kind sponsorship: Value equivalent to 3-10 triệu VND
- Upsell opportunities: 10-30% conversion to memberships

### ROI pathways

1. **Direct revenue:** Ticket sales + sponsorship
2. **Indirect revenue:** Membership conversions (lifetime value: 10-50 triệu VND/member)
3. **Brand value:** Community building, social media reach

## Requirements

### Functional Requirements
1. Detailed cost breakdown cho tất cả 12 events
2. Revenue projections (conservative, moderate, aggressive)
3. Sponsorship tiers và benefits matrix
4. Breakeven analysis
5. Cash flow projections

### Non-functional Requirements
1. Financially sustainable (không burn money)
2. Scalable (có thể tăng attendance mà không linear cost increase)
3. Flexible (có thể adjust based on performance)
4. Transparent (dễ track và report)

## Architecture - Cost Structure

### Per-Event Cost Breakdown (Base scenario: 50 người)

```
┌────────────────────────────────────────────────────────────┐
│ FIXED COSTS (Dù bao nhiêu người cũng phải trả)            │
├────────────────────────────────────────────────────────────┤
│ Venue Setup (Sol Cafe internal)                            │
│ ├─ Space arrangement, cleaning                            │
│ ├─ AV equipment (projector, mic, speakers)                │
│ └─ Staff coordination                                     │
│ └─ Cost: 0 VND (internal resource)                        │
├────────────────────────────────────────────────────────────┤
│ Marketing & Promotion                                      │
│ ├─ Social media ads (Facebook/Instagram)                  │
│ ├─ Graphics design (event banner, posts)                  │
│ ├─ Copywriting (event description, ads)                   │
│ ├─ Event platform fee (Eventbrite, etc.)                  │
│ └─ Cost: 3,000,000 VND                                   │
├────────────────────────────────────────────────────────────┤
│ Content & Programming                                      │
│ ├─ Speaker fee (or honorarium)                            │
│ ├─ MC fee                                                  │
│ ├─ Content preparation                                    │
│ └─ Cost: 2,500,000 VND                                   │
├────────────────────────────────────────────────────────────┤
│ Materials & Supplies                                       │
│ ├─ Name tags, lanyards                                    │
│ ├─ Bingo cards, signage                                   │
│ ├─ Lucky draw prizes                                      │
│ └─ Stationery (markers, tape, etc.)                       │
│ └─ Cost: 1,500,000 VND                                   │
├────────────────────────────────────────────────────────────┤
│ Documentation & Content Creation                           │
│ ├─ Photography/Videography                                │
│ ├─ Post-production                                        │
│ └─ Cost: 1,000,000 VND                                   │
├────────────────────────────────────────────────────────────┤
│ SUBTOTAL FIXED: 8,000,000 VND                            │
├────────────────────────────────────────────────────────────┤
│ VARIABLE COSTS (Tùy theo số người tham dự)                │
├────────────────────────────────────────────────────────────┤
│ F&B per Person                                             │
│ ├─ Welcome drink (signature drink)                        │
│ ├─ Light snacks (finger food)                             │
│ ├─ Coffee/tea refills                                     │
│ └─ Cost: 80,000 VND/person × 50 = 4,000,000 VND          │
├────────────────────────────────────────────────────────────┤
│ Check-in Materials                                         │
│ ├─ Name tag printing                                      │
│ ├─ Program printout                                       │
│ └─ Cost: 10,000 VND/person × 50 = 500,000 VND            │
├────────────────────────────────────────────────────────────┤
│ SUBTOTAL VARIABLE: 4,500,000 VND                         │
├────────────────────────────────────────────────────────────┤
│ CONTINGENCY (10%)                                         │
│ └─ Cost: 1,250,000 VND                                   │
├────────────────────────────────────────────────────────────┤
│ TOTAL PER EVENT (50 people): 13,750,000 VND              │
│ = 275,000 VND/person                                     │
└────────────────────────────────────────────────────────────┘
```

### Cost Scaling Table

| Attendance | Fixed Costs | Variable Costs | Total | Cost/Person |
|------------|-------------|----------------|-------|-------------|
| 30 people  | 8,000,000   | 2,700,000      | 10,700,000 | 357,000     |
| 40 people  | 8,000,000   | 3,600,000      | 11,600,000 | 290,000     |
| 50 people  | 8,000,000   | 4,500,000      | 13,750,000 | 275,000     |
| 60 people  | 8,000,000   | 5,400,000      | 15,400,000 | 257,000     |
| 80 people  | 8,000,000   | 7,200,000      | 17,000,000 | 213,000     |
| 100 people | 8,000,000   | 9,000,000      | 18,500,000 | 185,000     |

**Note:** Above 80 người cần additional setup staff (+1,000,000 VND)

## Architecture - Revenue Model

### Revenue Streams

```
┌────────────────────────────────────────────────────────────┐
│ STREAM 1: TICKET SALES (Primary Revenue)                  │
├────────────────────────────────────────────────────────────┤
│ Pricing Tiers                                              │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ Early Bird (First 20 tickets)                        │ │
│ │ • 150,000 VND (40% discount)                         │ │
│ │ • Available until 2 weeks before event               │ │
│ │ • Goal: Create urgency, early commitment             │ │
│ ├──────────────────────────────────────────────────────┤ │
│ │ Regular Pricing                                       │ │
│ │ • 250,000 VND (standard price)                       │ │
│ │ • Available until 2 days before event                │ │
│ │ • Goal: Standard revenue stream                      │ │
│ ├──────────────────────────────────────────────────────┤ │
│ │ Door Price (Walk-in)                                 │ │
│ │ • 350,000 VND (40% premium)                          │ │
│ │ • Only if space available                            │ │
│ │ • Goal: Discourage walk-ins, encourage pre-booking   │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                             │
│ Membership Bundles (Best Value)                             │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ Event Pass (5 events)                                │ │
│ │ • 1,000,000 VND (20% savings = 200K/event)          │ │
│ │ • Transferable                                       │ │
│ ├──────────────────────────────────────────────────────┤ │
│ │ Community Membership (1 month coworking + events)    │ │
│ │ • 3,500,000 VND (includes 5 events + 1 month cowork) │
│ │ • Best conversion driver                             │ │
│ └──────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ STREAM 2: SPONSORSHIP (Secondary Revenue)                 │
├────────────────────────────────────────────────────────────┤
│ Sponsorship Tiers                                          │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ BRONZE SPONSOR (3-5 available)                      │ │
│ │ • Investment: 3,000,000 VND                          │ │
│ │ • Benefits:                                         │ │
│ │   - Logo on event materials                          │ │
│ │   - Social media shoutout (1 post)                   │ │
│ │   - 2 complimentary tickets                          │ │
│ │   - 1-minute announcement at event                   │ │
│ ├──────────────────────────────────────────────────────┤ │
│ │ SILVER SPONSOR (2-3 available)                      │ │
│ │ • Investment: 7,000,000 VND                          │ │
│ │ • Benefits:                                         │ │
│ │   - All Bronze benefits                             │ │
│ │   - Logo on name tag/backdrop                        │ │
│ │   - Social media shoutout (2 posts)                  │ │
│ │   - 5 complimentary tickets                          │ │
│ │   - Branded booth/table at event                     │ │
│ │   - Email mention to attendees                       │ │
│ ├──────────────────────────────────────────────────────┤ │
│ │ GOLD SPONSOR (1-2 available)                        │ │
│ │ • Investment: 15,000,000 VND                         │ │
│ │ • Benefits:                                         │ │
│ │   - All Silver benefits                             │ │
│ │   - "Powered by" or "Presented by" branding          │ │
│ │   - Speaking slot (5 min intro/pitch)               │ │
│ │   - 10 complimentary tickets                         │
│ │   - Exclusive data access (attendee list)            │ │
│ │   - Host one event (naming rights)                   │ │
│ │   - Quarterly package (4 events) discount 20%        │
│ └──────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ STREAM 3: IN-KIND SPONSORSHIP (Cost Reduction)            │
├────────────────────────────────────────────────────────────┤
│ Types of In-Kind Sponsorship                               │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ Venue/Space (Sol Cafe - internal)                    │ │
│ │ • Value: 10,000,000 VND/event                       │ │
│ │ • Already accounted (0 cash cost)                    │ │
│ ├──────────────────────────────────────────────────────┤ │
│ │ F&B Partners                                          │ │
│ │ • Local cafes, bakeries, beverage brands             │ │
│ │ • Provide snacks/drinks in exchange for branding     │ │
│ │ • Target: Reduce F&B cost by 30-50%                  │ │
│ ├──────────────────────────────────────────────────────┤ │
│ │ Prizes                                                │ │
│ │ • Coworking passes, software subscriptions,         │ │
│ │   consulting sessions, products                      │ │
│ │ • Reduce prize budget by 50-70%                      │ │
│ ├──────────────────────────────────────────────────────┤ │
│ │ Services                                              │ │
│ │ • Photography/videography (student/cheap rates)      │ │
│ │ • Design services (exchange for exposure)            │ │
│ │ • Reduce marketing/materials cost by 20%             │ │
│ └──────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ STREAM 4: CONVERSION REVENUE (Long-term Value)            │
├────────────────────────────────────────────────────────────┤
│ Membership Conversions                                      │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ Conversion Funnel                                     │ │
│ │ Event Attendee (100%)                                 │ │
│ │   ↓ 30% interested in coworking                      │ │
│ │   ↓ 15% take trial offer                             │ │
│ │   ↓ 8% convert to paid membership                   │ │
│ │                                                      │ │
│ │ Example (50 attendees/event):                        │ │
│ │ • 50 attendees                                       │ │
│ │ • 15 interested (30%)                                │ │
│ │ • 7.5 trials (15%) → ~8 people                       │ │
│ │ • 4 conversions (8%) @ 5,000,000 VND = 20M VND      │ │
│ │                                                      │ │
│ │ Lifetime Value (LTV):                                │ │
│ │ • Avg membership value: 5,000,000 V/month           │ │
│ │ • Avg tenure: 12 months                              │ │
│ │ • LTV per conversion: 60,000,000 VND                │ │
│ │ • 4 conversions × 60M = 240,000,000 VND/event       │ │
│ └──────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

### Revenue Scenarios

#### Scenario 1: Conservative (30 attendees, no sponsorship)

```
Ticket Revenue (mix of early bird + regular):
- 15 early bird × 150,000 = 2,250,000 VND
- 15 regular × 250,000 = 3,750,000 VND
Total Ticket Revenue: 6,000,000 VND

Cost: 10,700,000 VND (from scaling table)

Net Loss: -4,700,000 VND

Conversion Revenue (assuming 8% rate):
- 30 × 8% = 2.4 conversions → ~2 conversions
- 2 × 60,000,000 = 120,000,000 VND (LTV, but not immediate)

Total Immediate ROI: -78% (loss on event)
Total 12-month ROI: +1,022% (with LTV)
```

#### Scenario 2: Moderate (50 attendees, 1 silver sponsor)

```
Ticket Revenue (mix of pricing tiers):
- 20 early bird × 150,000 = 3,000,000 VND
- 25 regular × 250,000 = 6,250,000 VND
- 5 door × 350,000 = 1,750,000 VND
Total Ticket Revenue: 11,000,000 VND

Sponsorship: +7,000,000 VND (1 silver)

Total Revenue: 18,000,000 VND

Cost: 13,750,000 VND

Net Profit: +4,250,000 VND

Conversion Revenue (assuming 8% rate):
- 50 × 8% = 4 conversions
- 4 × 60,000,000 = 240,000,000 VND (LTV)

Total Immediate ROI: +31%
Total 12-month ROI: +1,744% (with LTV)
```

#### Scenario 3: Aggressive (80 attendees, 2 silver + 1 bronze sponsors)

```
Ticket Revenue (mix with pre-sales):
- 25 early bird × 150,000 = 3,750,000 VND
- 45 regular × 250,000 = 11,250,000 VND
- 10 door × 350,000 = 3,500,000 VND
Total Ticket Revenue: 18,500,000 VND

Sponsorship:
- 2 silver × 7,000,000 = 14,000,000 VND
- 1 bronze × 3,000,000 = 3,000,000 VND
Total Sponsorship: 17,000,000 VND

Total Revenue: 35,500,000 VND

Cost: 17,000,000 VND

Net Profit: +18,500,000 VND

Conversion Revenue (assuming 8% rate):
- 80 × 8% = 6.4 conversions → ~6 conversions
- 6 × 60,000,000 = 360,000,000 VND (LTV)

Total Immediate ROI: +109%
Total 12-month ROI: +2,217% (with LTV)
```

### Breakeven Analysis

```
Breakeven Point Calculation:

Fixed Costs: 8,000,000 VND
Variable Cost/Person: 90,000 VND (80K F&B + 10K materials)
Average Ticket Price: 220,000 VND (weighted average)

Contribution Margin per Ticket:
= Price - Variable Cost
= 220,000 - 90,000
= 130,000 VND

Breakeven Attendance:
= Fixed Costs / Contribution Margin
= 8,000,000 / 130,000
= 61.5 attendees

WITH 1 Silver Sponsor (7M VND):
Breakeven Attendance:
= (8,000,000 - 7,000,000) / 130,000
= 7.7 attendees ✅

Conclusion:
- Without sponsorship: Need 62 attendees to breakeven
- With 1 silver sponsor: Only 8 attendees to breakeven
- Sponsorship CRITICAL for financial sustainability
```

## Architecture - Potential Sponsors

### Sponsor Categories

#### 1. Tech & Software Companies (High Fit)

| Company | Type | Sponsorship Potential | Contact Approach |
|---------|------|----------------------|------------------|
| **Momo/Zalopay** | Fintech | Silver/Gold (high budget) | Partnership with startup community |
| **Grab/Gojek** | Tech platform | Silver (brand awareness) | Co-branding on mobility topics |
| **Shopee/Lazada** | E-commerce | Bronze/Silver | E-commerce education themes |
| **Viettel Digital** | Tech ecosystem | Gold (large budget) | Corporate social responsibility |
| **FPT Software** | Tech services | Silver | Talent hiring focus |
| **Saigon Technology** | Outsourcing | Bronze | Developer community |
| **TopCV/VietnamWorks** | HR tech | Silver (hiring focus) | Career themes |
| **Haravan** | E-commerce platform | Bronze/Silver | Entrepreneur topics |

**Why they'd sponsor:**
- Access to startup/freelancer community
- Brand awareness among young professionals
- Talent acquisition pipeline
- Product/service trial opportunities

#### 2. Financial Services

| Company | Type | Sponsorship Potential | Contact Approach |
|---------|------|----------------------|------------------|
| **TPBank** | Digital bank | Gold (startup banking) | Startup support programs |
| **Cake by VPBank** | Digital bank | Silver/Gold | Young professional targeting |
| **Techcombank** | Corporate banking | Silver | SME business focus |
| **Trusting Social** | Fintech lending | Bronze | Financial inclusion themes |

**Why they'd sponsor:**
- Customer acquisition for business accounts
- Brand positioning as startup-friendly
- Financial literacy education (CSR)
- Product demo opportunities

#### 3. Coworking/Office Space Competitors (Counter-intuitive but real)

| Company | Type | Sponsorship Potential | Contact Approach |
|---------|------|----------------------|------------------|
| **Toong** | Premium coworking | Gold (co-host events) | Knowledge sharing |
| **DreamPlex** | Corporate coworking | Silver | Corporate/startup bridge |
| **Coffice** | Cafe coworking | Bronze | Community building |

**Why they'd sponsor:**
- Not all areas compete directly
- Brand visibility in different geography
- Community positioning

#### 4. Education & Training

| Company | Type | Sponsorship Potential | Contact Approach |
|---------|------|----------------------|------------------|
| **MindX/CodeGym** | Coding bootcamp | Silver/Silver | Student themes |
| **UFM/Newton** | Short courses | Bronze | Skill development |
| **各大培训中心** | Professional skills | Bronze | Career themes |

**Why they'd sponsor:**
- Direct customer acquisition
- Course enrollment conversions
- Brand building in education

#### 5. Local Businesses (In-kind)

| Business Type | Examples | In-Kind Contribution |
|---------------|----------|---------------------|
| **Cafes/Bakeries** | local favorites | Snacks, drinks |
| **Print Shops** | Digi-tex, etc. | Printing discounts |
| **Photographers** | Freelancers | Event photography |
| **Event Services** | AV, decorators | Equipment discounts |

### Sponsor Outreach Strategy

```
┌────────────────────────────────────────────────────────────┐
│ OUTREACH TIMELINE                                         │
├────────────────────────────────────────────────────────────┤
│ 3 months before first event:                              │
│ ├─ Create sponsorship deck (PDF + presentation)          │
│ ├─ Identify top 20 potential sponsors                     │
│ ├─ Research decision makers (LinkedIn, company site)      │
│ └─ Warm-up: Engage on social media first                 │
├────────────────────────────────────────────────────────────┤
│ 2.5 months before:                                        │
│ ├─ Send initial outreach email                           │
│ ├─ Follow up within 1 week (LinkedIn message)            │
│ └─ Request for 15-min intro call                         │
├────────────────────────────────────────────────────────────┤
│ 2 months before:                                          │
│ ├─ Present sponsorship proposal                          │
│ ├─ Negotiate terms (custom packages allowed)              │
│ └─ Draft agreement (MOU)                                 │
├────────────────────────────────────────────────────────────┤
│ 1.5 months before:                                        │
│ ├─ Finalize agreement                                     │
│ ├─ Collect sponsorship fee                               │
│ ├─ Co-create branding materials                          │
│ └─ Start joint promotion planning                        │
└────────────────────────────────────────────────────────────┘
```

### Sponsorship Email Template

```markdown
Subject: Partnership Opportunity with Sol Cafe Community Events

Hi [Name],

I'm [Your Name] from Sol Cafe Coworking, and I'm reaching out
because [Company Name]'s mission to [their mission] aligns perfectly
with our community of [describe community: startups, freelancers, etc.]

We're launching a monthly event series starting this May, bringing together
50-100 young professionals, entrepreneurs, and creatives in Cau Giay, Hanoi.

I believe there's a strong partnership opportunity here:
- Your brand gains visibility with 600+ attendees annually
- Direct access to our community of potential customers
- Association with Hanoi's growing startup/professional community

Our sponsorship packages range from 3M to 15M VND, with flexible
customization available. I'd love to share our full deck with you.

Are you open to a 15-minute call next week to explore if this aligns
with [Company Name]'s marketing goals?

Best regards,
[Your Name]
[Title]
[Phone]
[LinkedIn Profile]
```

## Related Code Files

### Files to Create
- `areas/finance/event-budget-tracker.xlsx` - Budget tracking spreadsheet
- `areas/finance/sponsorship-deck.pdf` - Sponsorship presentation deck
- `areas/finance/sponsorship-agreement-template.md` - MOU template
- `areas/finance/revenue-tracker.xlsx` - Revenue tracking by event
- `areas/finance/sponsor-outreach-list.xlsx` - Contact management

### Files to Modify
- (None - đây là new system)

## Implementation Steps

1. ✅ **Create detailed budget spreadsheet:** Line items by category
2. ✅ **Build sponsorship deck:** Professional PDF with benefits, audience demographics, case studies (use projections)
3. ✅ **Draft sponsorship agreement:** Legal template with deliverables
4. ✅ **Set up tracking system:** Revenue/cost tracking by event
5. ✅ **Research 50 potential sponsors:** With contact info
6. ✅ **Create outreach templates:** Email, LinkedIn, follow-up scripts
7. ✅ **Start sponsor outreach:** 3 months before first event

## Todo List

- [ ] Create event budget tracker spreadsheet
- [ ] Build sponsorship deck (design content + design)
- [ ] Draft sponsorship agreement/MOU template
- [ ] Research top 30 potential sponsors with decision maker contacts
- [ ] Create sponsor outreach email sequence (3 emails)
- [ ] Create LinkedIn outreach template
- [ ] Set up payment collection system (bank transfer, invoicing)
- [ ] Create sponsor fulfillment checklist (ensure we deliver benefits)
- [ ] Price out all line items with real quotes
- [ ] Calculate breakeven for different scenarios

## Success Criteria

- [ ] Budget tracker created and approved
- [ ] Sponsorship deck completed with professional design
- [ ] Sponsorship agreement template reviewed by legal (if needed)
- [ ] 30+ sponsors identified with contact info
- [ ] Outreach templates created and tested
- [ ] First 5 sponsor outreach emails sent
- [ ] Payment system set up and tested

## Risk Assessment

### Risk 1: Không có sponsor, event lỗ
- **Mitigation:** Plan for worst case (break-even at 62 attendees), push ticket sales
- **Backup Plan:** Reduce scope (no paid speaker, simpler F&B)
- **Severity:** High

### Risk 2: Sponsor không fulfill payment
- **Mitigation:** 50% payment upfront, 50% post-event
- **Backup Plan:** Have cash reserve to cover gap
- **Severity:** Medium

### Risk 3: Chi phí unexpected tăng (inflation, price hikes)
- **Mitigation:** 10% contingency budget built in
- **Backup Plan:** Negotiate fixed-price contracts with vendors
- **Severity:** Medium

### Risk 4: Ticket sales thấp (không đạt break-even)
- **Mitigation:** Aggressive early bird pricing, membership bundles
- **Backup Plan:** Pivot to free events, focus on lead generation
- **Severity:** High

### Risk 5: Sponsor unhappy với ROI
- **Mitigation:** Clear expectation setting, deliverable tracking
- **Backup Plan:** Offer makeup exposure in future events
- **Severity:** Medium

## Security Considerations

- **Contractual:** Written agreements cho all sponsorships
- **Payment security:** Bank transfer tracking, receipts
- **Data privacy:** Sponsor access to attendee data must be opt-in

## Next Steps

1. Execute budget spreadsheet creation
2. Start sponsor research and outreach
3. Move to **Phase 4: Marketing và Promotion** để drive ticket sales
4. Parallel: Begin negotiation với venue/internal resource allocation

---

**Giai đoạn tiếp theo:** [Phase 4 - Marketing và thu hút tham dự](./phase-04-marketing-and-promotion.md)
