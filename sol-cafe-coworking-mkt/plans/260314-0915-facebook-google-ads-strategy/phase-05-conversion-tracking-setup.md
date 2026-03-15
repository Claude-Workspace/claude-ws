# Giai đoạn 5: Cài Đặt Conversion Tracking Chi Tiết

## Bối cảnh
- **Mục tiêu:** Track toàn bộ user journey từ ad → conversion
- **Công cụ:** Facebook Pixel, Google Analytics 4, Google Tag Manager
- **Importance:** Không thể optimize ads mà không có tracking chính xác

---

## 1. Facebook Pixel Setup

### 1.1 Pixel Installation

#### Base Pixel Code
```javascript
<!-- Facebook Pixel Code -->
<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', 'YOUR_PIXEL_ID');
fbq('track', 'PageView');
</script>
<noscript>
<img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=YOUR_PIXEL_ID&ev=PageView&noscript=1"/>
</noscript>
<!-- End Facebook Pixel Code -->
```

#### Installation Location
- **Wordpress:** Install via header.php or plugin (Pixel Caffeine)
- **Custom website:** Add to `<head>` section of all pages
- **Single page app:** Initialize on app load, track route changes

### 1.2 Standard Events

#### Required Events
```javascript
// Page View - Automatic
fbq('track', 'PageView');

// View Content - Pricing page viewed
fbq('track', 'ViewContent', {
  content_name: 'Pricing Page',
  content_category: 'Pricing'
});

// Search - Site search used
fbq('track', 'Search', {
  search_string: 'coworking cau giay'
});

// Lead - Form submitted
fbq('track', 'Lead', {
  content_name: 'Contact Form',
  value: 50.00,
  currency: 'VND'
});

// Complete Registration - Trial signup
fbq('track', 'CompleteRegistration', {
  content_name: '3 Day Trial',
  value: 99.00,
  currency: 'VND'
});

// Purchase - Membership purchased
fbq('track', 'Purchase', {
  content_name: 'Month Pass',
  value: 800.00,
  currency: 'VND'
});
```

#### Custom Events
```javascript
// Click Call Button
fbq('trackCustom', 'ClickCallButton', {
  phone: '84XXXXXXXXX'
});

// Click WhatsApp
fbq('trackCustom', 'ClickWhatsApp', {
  contact_method: 'whatsapp'
});

// Download Pricing PDF
fbq('trackCustom', 'DownloadPricing', {
  content_type: 'pdf',
  content_name: 'Pricing Guide 2026'
});

// Book Meeting Room
fbq('trackCustom', 'InitiateBooking', {
  content_type: 'meeting_room',
  content_name: 'Meeting Room A'
});
```

### 1.3 Custom Conversions

#### Setup Custom Conversions (in Events Manager)

**Conversion 1: View Pricing Page**
- Rule: URL contains "/pricing" or "/bang-gia"
- Event: PageView
- Value: Low (informational)
- Attribution: 7-day click or 1-day view

**Conversion 2: Submit Contact Form**
- Rule: URL contains "/thank-you" after form submit
- Event: Lead
- Value: Medium (lead captured)
- Attribution: 7-day click or 1-day view

**Conversion 3: Click WhatsApp**
- Rule: Custom event "ClickWhatsApp"
- Event: CustomEvent
- Value: Medium (direct contact)
- Attribution: 7-day click

**Conversion 4: Complete Trial Signup**
- Rule: URL contains "/trial-success"
- Event: CompleteRegistration
- Value: High (trial signup)
- Attribution: 7-day click or 1-day view

**Conversion 5: Purchase Membership**
- Rule: URL contains "/payment-success"
- Event: Purchase
- Value: Highest (revenue)
- Attribution: 7-day click or 1-day view

---

## 2. Google Analytics 4 Setup

### 2.1 GA4 Property Creation

#### Create GA4 Property
1. Go to admin.google.com/analytics
2. Click "Create Account"
3. Account name: "Sol Cafe Coworking"
4. Property name: "Sol Cafe - Website"
5. Reporting time zone: (GMT+07:00) Vietnam
6. Currency: Vietnamese Dong (VND)
7. Click "Create" and accept terms

#### Get Measurement ID
- Property → Data Streams → Web Stream
- Copy Measurement ID: G-XXXXXXXXXX

### 2.2 GA4 Installation

#### Global Site Tag (gtag.js)
```html
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'G-XXXXXXXXXX');
</script>
```

#### Add to Website
- **Location:** `<head>` section, immediately after Facebook Pixel
- **All pages:** Must be on every page
- **Test:** Use GA4 Debugger Chrome extension

### 2.3 GA4 Events

#### Recommended Events (Automatic)
```javascript
// Page View - Automatic
// No code needed, GA4 tracks automatically

// Scroll Tracking - 90% scroll
gtag('event', 'scroll', {
  percent_scrolled: 90
});

// File Download
gtag('event', 'file_download', {
  file_name: 'pricing-guide.pdf',
  file_extension: 'pdf'
});

// Video Play
gtag('event', 'video_start', {
  video_title: 'Sol Cafe Tour',
  video_duration: 45
});

// Click Outbound Link
gtag('event', 'click', {
  link_type: 'outbound',
  link_url: 'https://facebook.com/solcafe'
});
```

#### Custom Business Events
```javascript
// View Pricing Page
gtag('event', 'view_pricing', {
  page_title: 'Pricing',
  page_location: 'https://solcafe.com/pricing'
});

// Initiate Checkout
gtag('event', 'begin_checkout', {
  value: 99000,
  currency: 'VND',
  items: [{
    item_name: '3 Day Trial',
    item_category: 'Trial',
    price: 99000,
    quantity: 1
  }]
});

// Purchase Membership
gtag('event', 'purchase', {
  transaction_id: 'T_12345',
  value: 800000,
  currency: 'VND',
  items: [{
    item_name: 'Month Pass',
    item_category: 'Membership',
    price: 800000,
    quantity: 1
  }]
});

// Submit Lead Form
gtag('event', 'generate_lead', {
  form_name: 'Contact Form',
  lead_type: 'Inquiry'
});

// Phone Call Click
gtag('event', 'phone_call', {
  phone_number: '84XXXXXXXXX',
  call_page: 'Homepage'
});

// WhatsApp Click
gtag('event', 'whatsapp_click', {
  contact_method: 'whatsapp',
  page_location: 'pricing'
});
```

---

## 3. Google Tag Manager Setup

### 3.1 GTM Account Setup

#### Create GTM Account
1. Go to tagmanager.google.com
2. Click "Create Account"
3. Account name: "Sol Cafe Coworking"
4. Container name: "Sol Cafe - Website"
5. Target platform: Web
6. Click "Create" and accept terms

#### Install GTM Container
```html
<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-XXXXXXX');</script>
<!-- End Google Tag Manager -->

<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-XXXXXXX"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->
```

#### Location
- ** `<head>`:** Script immediately after opening `<head>` tag
- ** `<body>`:** Noscript immediately after opening `<body>` tag

### 3.2 GTM Tags Configuration

#### Tag 1: Facebook Pixel Base Code
- **Tag type:** Custom HTML
- **Trigger:** All Pages
- **Priority:** 1
- **HTML:** Paste Facebook Pixel code

#### Tag 2: GA4 Configuration
- **Tag type:** Google Analytics: GA4 Configuration
- **Measurement ID:** G-XXXXXXXXXX
- **Trigger:** All Pages

#### Tag 3: Facebook - View Content
- **Tag type:** Custom HTML
- **Trigger:** Page View - URL contains /pricing
- **HTML:**
```javascript
<script>
fbq('track', 'ViewContent', {
  content_name: 'Pricing Page',
  content_category: 'Pricing'
});
</script>
```

#### Tag 4: Facebook - Lead
- **Tag type:** Custom HTML
- **Trigger:** Form Submission
- **HTML:**
```javascript
<script>
fbq('track', 'Lead', {
  content_name: 'Contact Form',
  value: 50.00,
  currency: 'VND'
});
</script>
```

#### Tag 5: GA4 - View Pricing
- **Tag type:** Google Analytics: GA4 Event
- **Configuration Tag:** GA4 Config
- **Event Name:** view_pricing
- **Trigger:** Page View - URL contains /pricing

#### Tag 6: GA4 - Generate Lead
- **Tag type:** Google Analytics: GA4 Event
- **Configuration Tag:** GA4 Config
- **Event Name:** generate_lead
- **Parameters:** form_name = Contact Form
- **Trigger:** Form Submission

### 3.3 GTM Triggers

#### Trigger 1: All Pages
- **Type:** Page View
- **Trigger Type:** All Pages

#### Trigger 2: Pricing Page View
- **Type:** Page View
- **Trigger Type:** Some Page Views
- **Condition:** Page URL contains /pricing or /bang-gia

#### Trigger 3: Form Submission
- **Type:** Form Submission
- **Wait for Tags:** 2000ms
- **Enable validation:** No
- **Condition:** All Forms (or specific form ID)

#### Trigger 4: Click - Phone Number
- **Type:** Click - All Elements
- **Condition:** Click Text matches phone pattern
- **Wait for Tags:** 2000ms
- **Validation:** No

#### Trigger 5: Click - WhatsApp
- **Type:** Click - All Elements
- **Condition:** Click URL contains whatsapp.me or wa.me
- **Wait for Tags:** 2000ms

### 3.4 GTM Variables

#### Data Layer Variables
- **pageCategory:** Page category (homepage, pricing, contact)
- **leadSource:** Lead source (facebook, google, organic)
- **userType:** User type (new, returning, member)

#### URL Variables
- **Page URL:** Built-in variable
- **Page Path:** Built-in variable
- **Referrer:** Built-in variable

#### Click Variables
- **Click Text:** Built-in variable
- **Click URL:** Built-in variable
- **Click Class:** Built-in variable

---

## 4. UTM Parameter Strategy

### 4.1 UTM Structure

#### Standard UTM Parameters
```
utm_source: Platform (facebook, google, tiktok, email)
utm_medium: Placement (cpc, display, social, email)
utm_campaign: Campaign name (brand-awareness-q1-2026)
utm_content: Ad variation (carousel-a, video-b)
utm_term: Keyword (for search ads)
```

### 4.2 UTM Examples

#### Facebook Ads
```
Campaign: Brand Awareness Q1 2026
https://solcafe.com/?utm_source=facebook&utm_medium=social&utm_campaign=brand-awareness-q1-2026&utm_content=carousel-transformation&utm_term=coworking-hanoi

Campaign: Lead Generation - Freelancers
https://solcafe.com/?utm_source=facebook&utm_medium=cpc&utm_campaign=lead-gen-freelancers&utm_content=video-lifestyle&utm_term=day-pass-99k
```

#### Google Ads
```
Campaign: Search - Core Business
https://solcafe.com/?utm_source=google&utm_medium=cpc&utm_campaign=search-core-business&utm_content=text-ad-coworking&utm_term=coworking+hanoi

Campaign: Display - Remarketing
https://solcafe.com/?utm_source=google&utm_medium=display&utm_campaign=display-remarketing&utm_content=responsive-ad-variant-a&utm_term=website-visitors-30d
```

#### Email Campaigns
```
Campaign: March Newsletter - Trial Offer
https://solcafe.com/?utm_source=newsletter&utm_medium=email&utm_campaign=march-trial-offer&utm_content=hero-cta&utm_term=3-day-99k

Campaign: Abandoned Cart Recovery
https://solcafe.com/?utm_source=email&utm_medium=email&utm_campaign=cart-recovery&utm_content=recovery-email-1&utm_term=pricing-abandoned
```

#### Social Media (Organic)
```
Facebook Post:
https://solcafe.com/?utm_source=facebook&utm_medium=social&utm_campaign=organic-march-2026&utm_content=post-networking-event&utm_term=none

Instagram Story:
https://solcafe.com/?utm_source=instagram&utm_medium=social&utm_campaign=organic-march-2026&utm_content=story-poll&utm_term=none
```

### 4.3 UTM Best Practices

#### Naming Conventions
- **Lowercase only:** Avoid case sensitivity issues
- **Hyphens not spaces:** Use "lead-gen" not "lead gen"
- **Consistent format:** Always use same structure
- **Descriptive but concise:** Balance clarity with length
- **No campaign-specific tokens:** Keep consistent across campaigns

#### URL Builder Tool
- Use Google's Campaign URL Builder: ga-dev-tools.appspot.com/campaign-url-builder/
- Save templates in spreadsheet
- Share with team for consistency

#### Shortening
- Use bit.ly or own shortener
- Keep UTMs intact in shortened URL
- Track clicks on shortener too

---

## 5. Attribution Models

### 5.1 Attribution Model Comparison

#### Last Click Attribution
- **Definition:** 100% credit to last touchpoint
- **Pros:** Simple, easy to understand
- **Cons:** Ignores earlier touchpoints
- **Best for:** Quick decisions, limited touchpoints

#### First Click Attribution
- **Definition:** 100% credit to first touchpoint
- **Pros:** Highlights awareness channels
- **Cons:** Ignores nurturing touchpoints
- **Best for:** Top-of-funnel optimization

#### Linear Attribution
- **Definition:** Equal credit to all touchpoints
- **Pros:** Values entire journey
- **Cons:** Doesn't weight importance
- **Best for:** Understanding full funnel

#### Time Decay Attribution
- **Definition:** More credit to recent touchpoints
- **Pros:** Reflects recency bias
- **Cons:** May undervalue awareness
- **Best for:** Short sales cycles

#### Position-Based Attribution
- **Definition:** 40% first + 40% last + 20% middle
- **Pros:** Values first and last touch
- **Cons:** Arbitrary percentages
- **Best for:** Balanced view

#### Data-Driven Attribution (Recommended)
- **Definition:** AI assigns credit based on data
- **Pros:** Most accurate, learns from data
- **Cons:** Requires 600+ conversions
- **Best for:** Accounts with sufficient data

### 5.2 Recommended Attribution Setup

#### Facebook Ads
- **Attribution Setting:** 7-day click or 1-day view
- **For awareness campaigns:** 1-day view
- **For conversion campaigns:** 7-day click

#### Google Ads
- **Model:** Data-driven (after 600+ conversions)
- **Fallback:** Time decay (before enough data)
- **Lookback window:** 30 days for search, 14 days for display

#### GA4
- **Primary model:** Data-driven
- **Comparison model:** Last click
- **Conversion window:** 90 days

---

## 6. Conversion Value Setup

### 6.1 Assigning Values to Conversions

#### Value Framework
```
Stage 1: Micro-Conversions (Informational)
- Page View: 0 VND (track volume, not value)
- Time on Site > 2 min: 5,000 VND
- 50% Scroll: 5,000 VND
- Video View (50%): 10,000 VND

Stage 2: Macro-Conversions (Lead)
- Click Phone Number: 30,000 VND
- Click WhatsApp: 30,000 VND
- Submit Contact Form: 50,000 VND
- Download Pricing PDF: 40,000 VND

Stage 3: Revenue Conversions
- Trial Signup (99K): 99,000 VND
- Day Pass Purchase (50K): 50,000 VND
- Week Pass Purchase (250K): 250,000 VND
- Month Pass Purchase (800K): 800,000 VND
- Private Office (3M): 3,000,000 VND
```

#### Custom Value Calculation
```javascript
// For GA4 custom events
gtag('event', 'generate_lead', {
  form_name: 'Contact Form',
  value: 50000,
  currency: 'VND'
});

// For Facebook custom events
fbq('trackCustom', 'ClickPhoneButton', {
  value: 30000,
  currency: 'VND'
});
```

---

## 7. Enhanced Conversions

### 7.1 Google Ads Enhanced Conversions

#### Setup Enhanced Conversions
1. **Tag setup:** Add enhanced conversion tag to form submit page
2. **Data matching:** Upload customer data (email, phone)
3. **Privacy:** Hash data before sending (GTM auto-hashes)
4. **Verification:** Verify matching rate in Google Ads

#### Code Implementation
```javascript
// Enhanced conversions for leads
gtag('set', 'user_data', {
  'email': 'customer.email@example.com',
  'phone_number': '84123456789',
  'address': {
    'first_name': 'John',
    'last_name': 'Doe',
    'country': 'VN'
  }
});
```

### 7.2 Facebook Conversions API

#### Why Use Conversions API?
- **Server-side tracking:** More reliable than pixel
- **Privacy compliance:** Better data control
- **Offline conversions:** Track in-store visits
- **Deduplication:** Match with pixel events

#### Setup Steps
1. **Create Business app:** In Facebook Business Manager
2. **Generate access token:** For server-side API
3. **Implement on server:** Or use Zapier/Make
4. **Test events:** Verify in Events Manager

---

## 8. Offline Conversion Tracking

### 8.1 Tracking In-Store Visits

#### Google Store Visits
- **Eligibility:** Physical location, verified business
- **Setup:** Link Google Ads to Google Business Profile
- **Attribution:** Location extension + ad click
- **Reporting:** View in "Store visits" column

#### Facebook Location Visits
- **Setup:** Add location to Facebook Page
- **Tracking:** Location-aware ads
- **Reporting:** "Offline visits" in Ads Reporting

### 8.2 Importing Offline Conversions

#### Google Ads Offline Conversions
1. **Create conversion action:** Type "Import"
2. **Upload data:** CSV with click ID + conversion details
3. **Mapping:** Match GCLID to conversion
4. **Schedule:** Daily or weekly uploads

#### Data Format (CSV)
```
GCLID,ConversionName,ConversionTime,ConversionValue,ConversionCurrency
1234567890,Trial_Signup,2026-03-14 14:30:00,99000,VND
0987654321,Month_Pass,2026-03-15 10:15:00,800000,VND
```

---

## 9. Testing & Verification

### 9.1 Testing Checklist

#### Facebook Pixel Testing
- [ ] Pixel fires on all pages (use Pixel Helper)
- [ ] PageView event fires
- [ ] ViewContent fires on pricing page
- [ ] Lead fires on form submit
- [ ] CompleteRegistration fires on trial signup
- [ ] Purchase fires on membership purchase
- [ ] Custom events fire correctly
- [ ] Parameters pass correctly

#### GA4 Testing
- [ ] GA4 config tag fires (use DebugView)
- [ ] Page views track correctly
- [ ] Custom events fire in DebugView
- [ ] Event parameters pass correctly
- [ ] Conversions appear in reports
- [ ] Real-time report shows activity

#### GTM Testing
- [ ] GTM container loads (use Tag Assistant)
- [ ] All tags fire on correct triggers
- [ ] Tags fire in correct order
- [ ] Variables populate correctly
- [ ] No errors in console
- [ ] Data layer variables accessible

#### UTM Testing
- [ ] UTMs appear in URL
- [ ] UTMs capture in GA4 (Campaign dimension)
- [ ] UTMs pass to Facebook (URL parameters)
- [ ] Consistent naming across channels
- [ ] No broken links with UTMs

### 9.2 Verification Tools

#### Browser Extensions
- **Facebook Pixel Helper:** Verify Pixel setup
- **GA Debugger:** Verify GA4 tracking
- **Tag Assistant:** Verify GTM setup
- **Google UTM Builder:** Build consistent UTMs

#### Real-Time Reporting
- **Facebook Events Manager:** Real-time pixel events
- **GA4 DebugView:** Real-time events
- **Google Ads Preview:** Ad diagnosis tool

---

## 10. Privacy & Compliance

### 10.1 Data Privacy Laws

#### Vietnam's Data Protection
- **Law:** Decree 13/2023/ND-CP
- **Requirements:** User consent for data collection
- **Compliance:** Privacy policy + cookie consent

#### GDPR (If targeting EU)
- **Consent:** Opt-in consent required
- **Rights:** Access, delete, portability
- **Breach notification:** 72-hour requirement

### 10.2 Consent Mode Setup

#### Google Consent Mode
```javascript
// Consent mode implementation
gtag('consent', 'default', {
  'ad_storage': 'denied',
  'analytics_storage': 'denied',
  'personalization_storage': 'denied'
});

// Update after user consent
gtag('consent', 'update', {
  'ad_storage': 'granted',
  'analytics_storage': 'granted'
});
```

#### Facebook Consent
```javascript
// Facebook Limited Data Use (LDU)
fbq('set', 'ldu', true); // Enable for California/other regions
```

### 10.3 Cookie Consent Banner

#### Implementation
- **Tool:** CookieBot, OneTrust, or custom
- **Placement:** First thing on website
- **Options:** Accept all, Reject all, Customize
- **GPC Support:** Honor Global Privacy Control

---

## 11. Maintenance & Monitoring

### 11.1 Weekly Tasks
- Check real-time reports for anomalies
- Verify conversion tracking firing
- Review data quality
- Check for broken tags

### 11.2 Monthly Tasks
- Audit conversion setup
- Review attribution settings
- Update value assignments
- Check for new tracking opportunities

### 11.3 Quarterly Tasks
- Full audit of tracking implementation
- Test all user journeys
- Update documentation
- Train team on new features

---

## 12. Troubleshooting Guide

### Common Issues & Solutions

#### Issue: Pixel not firing
**Check:** Pixel code in `<head>` tag
**Solution:** Reinstall pixel, check browser extensions

#### Issue: Double counting conversions
**Check:** Duplicate tags firing
**Solution:** Use tag sequencing or priority

#### Issue: UTMs not tracking
**Check:** URL parameters in Google Analytics
**Solution:** Verify campaign URL builder settings

#### Issue: Offline conversions not importing
**Check:** GCLID format, date format
**Solution:** Use Google Ads offline conversion editor

#### Issue: Attribution seems wrong
**Check:** Attribution model settings
**Solution:** Compare models in model comparison tool

---

**Document Status:** ✅ Complete
**Last Updated:** 14/03/2026
**Next Review:** 21/03/2026
**Tracking Lead:** [Assign team member]
**Implementation Priority:** CRITICAL (Must complete before ad launch)
