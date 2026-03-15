# Phase 2: Technical SEO & On-Page Optimization
**Timeline:** Tuần 3-4
**Status:** ⏳ Pending
**Priority:** 🔥 Critical

---

## Overview

Phase này tập trung vào việc xây dựng nền tảng kỹ thuật vững chắc cho website, bao gồm technical SEO audit, on-page optimization, và schema markup implementation.

---

## 1. Technical SEO Audit Checklist

### 1.1 Crawlability & Indexing

**Priority: 🔴 Critical**

#### Robots.txt Check
```robots.txt
# Allow all bots
User-agent: *
Allow: /

# Disallow admin areas (if applicable)
Disallow: /admin/
Disallow: /wp-admin/
Disallow: /api/private/

# Sitemap location
Sitemap: https://solcafe.com.vn/sitemap.xml
```

**Tasks:**
- [ ] Verify robots.txt is accessible at `https://solcafe.com.vn/robots.txt`
- [ ] Ensure important pages are not blocked
- [ ] Add sitemap reference
- [ ] Test with Google Robots.txt Tester

#### XML Sitemap
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://solcafe.com.vn/</loc>
    <lastmod>2026-03-14</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://solcafe.com.vn/thue-mat-bang-su-kien-cau-giay</loc>
    <lastmod>2026-03-14</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <!-- Add all important pages -->
</urlset>
```

**Tasks:**
- [ ] Create XML sitemap with all important pages
- [ ] Include last modification dates
- [ ] Set appropriate priority levels
- [ ] Submit to Google Search Console
- [ ] Submit to Bing Webmaster Tools

#### Canonical URLs
```html
<!-- Add to all pages -->
<link rel="canonical" href="https://solcafe.com.vn/thue-mat-bang-su-kien-cau-giay" />
```

**Tasks:**
- [ ] Implement canonical tags on all pages
- [ ] Fix duplicate content issues
- [ ] Ensure HTTPS canonicals
- [ ] Test with URL Inspection Tool

### 1.2 Site Speed Optimization

**Priority: 🟠 High**

#### Core Web Vitals Targets
- **LCP (Largest Contentful Paint):** < 2.5 seconds
- **FID (First Input Delay):** < 100 milliseconds
- **CLS (Cumulative Layout Shift):** < 0.1

#### Image Optimization
**Tasks:**
- [ ] Compress all images (use WebP format when possible)
- [ ] Add lazy loading to below-the-fold images
- [ ] Implement responsive images with srcset
- [ ] Add proper alt text (see Section 2)

**Example:**
```html
<img
  src="venue-large.webp"
  srcset="venue-small.webp 400w,
          venue-medium.webp 800w,
          venue-large.webp 1200w"
  sizes="(max-width: 600px) 400px,
         (max-width: 1200px) 800px,
         1200px"
  alt="Không gian sự kiện tại Sol Cafe Cầu Giấy có đầy đủ chỗ ngồi và trang thiết bị"
  loading="lazy"
  width="1200"
  height="800"
/>
```

#### Code Minification
**Tasks:**
- [ ] Minify HTML (use HTMLMinifier or similar)
- [ ] Minify CSS (use cssnano or similar)
- [ ] Minify JavaScript (use Terser or similar)
- [ ] Remove unused CSS (use PurgeCSS)

#### Caching Strategy
**.htaccess or Nginx config:**
```apache
# Enable browser caching
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType image/jpg "access plus 1 year"
  ExpiresByType image/jpeg "access plus 1 year"
  ExpiresByType image/gif "access plus 1 year"
  ExpiresByType image/png "access plus 1 year"
  ExpiresByType image/webp "access plus 1 year"
  ExpiresByType text/css "access plus 1 month"
  ExpiresByType application/javascript "access plus 1 month"
</IfModule>
```

**Tasks:**
- [ ] Implement browser caching headers
- [ ] Enable GZIP compression
- [ ] Use CDN for static assets (if applicable)
- [ ] Test with PageSpeed Insights

### 1.3 Mobile Optimization

**Priority: 🟠 High**

#### Responsive Design
**Tasks:**
- [ ] Test with Google Mobile-Friendly Test
- [ ] Ensure touch targets are at least 48x48px
- [ ] Use readable font sizes (16px minimum)
- [ ] Optimize for thumb zone navigation
- [ ] Test on real devices (iOS, Android)

#### Mobile-Specific Issues
**Common problems to fix:**
- [ ] Remove interstitial popups on mobile
- [ ] Ensure viewport is properly configured
- [ ] Fix text that's too small to read
- [ ] Fix elements too close together
- [ ] Optimize mobile page speed

---

## 2. On-Page SEO Optimization

### 2.1 Title Tag Strategy

**Formula for Service Pages:**
```
[Primary Keyword] | [Secondary Keyword] | [Brand]
```

**Actual Implementations:**

| Page URL | Title Tag | Length | Target Keyword |
|----------|-----------|--------|----------------|
| /thue-mat-bang-su-kien-cau-giay | Thuê Mặt Bằng Sự Kiện Cầu Giấy Giá Rẻ \| Sol Cafe | 60 chars | thuê mặt bằng sự kiện Cầu Giấy |
| /thue-phong-hoi-thao-ha-noi | Thuê Phòng Hội Thảo Hà Nội Có Projector & WiFi \| Sol Cafe | 59 chars | thuê phòng hội thảo Hà Nội |
| /dia-diem-to-chuc-workshop-sinh-vien | Địa Điểm Tổ Chức Workshop Sinh Viên Giá Tốt \| Sol Cafe | 58 chars | địa điểm tổ chức workshop sinh viên |
| /thue-khong-gian-dao-tao-ha-noi | Thuê Không Gian Đào Tạo Hà Nội Có Chỗ Đậu Xe \| Sol Cafe | 59 chars | thuê không gian đào tạo Hà Nội |
| /venue-su-kien-nho-ha-noi | Venue Tổ Chức Sự Kiện Nhỏ Hà Nội Dưới 50 Người \| Sol Cafe | 60 chars | venue tổ chức sự kiện nhỏ Hà Nội |

**Tasks:**
- [ ] Update all title tags according to template
- [ ] Keep length between 50-60 characters
- [ ] Include primary keyword at the beginning
- [ ] Make them click-worthy (add benefits like "Giá Rẻ", "Có Projector")
- [ ] Avoid keyword stuffing

### 2.2 Meta Description Strategy

**Formula:**
```
[CTA] + [Benefit] + [Keywords] + [Location] + [Urgency/Incentive]
```

**Actual Implementations:**

| Page URL | Meta Description | Length |
|----------|------------------|--------|
| /thue-mat-bang-su-kien-cau-giay | Thuê mặt bằng sự kiện Cầu Giấy giá tốt. Đầy đủ tiện nghi: projector, WiFi, chỗ đậu xe. Booking ngay hôm nay để nhận ưu đãi 20%! | 158 chars |
| /thue-phong-hoi-thao-ha-noi | Tìm thuê phòng hội thảo Hà Nội trọn gói? Có catering, âm thanh ánh sáng. Giá từ 2 triệu. Call hotline để được tư vấn miễn phí. | 158 chars |
| /dia-diem-to-chuc-workshop-sinh-vien | Địa điểm tổ chức workshop sinh viên Hà Nội giá sinh viên. Không gian hiện đại, đầy đủ tiện nghi. Xem bảng giá & booking online ngay! | 159 chars |
| /thue-khong-gian-dao-tao-ha-noi | Thuê không gian đào tạo Hà Nội tại Cầu Giấy. Có máy chiếu, sound system, WiFi. Giá theo giờ/ngày. Đặt phòng ngay hôm nay! | 159 chars |
| /venue-su-kien-nho-ha-noi | Venue tổ chức sự kiện nhỏ Hà Nội dưới 50 người. Không gian ấm cúng, trang thiết bị đầy đủ. Giá chỉ từ 1.5 triệu. Book ngay! | 159 chars |

**Tasks:**
- [ ] Write compelling meta descriptions
- [ ] Keep length between 150-160 characters
- [ ] Include primary keyword naturally
- [ ] Add clear CTA (Call to Action)
- [ ] Include location keywords
- [ ] A/B test different CTAs

### 2.3 Heading Structure (H1-H6)

**Template for Service Pages:**

```html
<!-- H1: Primary keyword + brand/modifier -->
<h1>Thuê Mặt Bằng Sự Kiện Tại Cầu Giấy - Sol Cafe Coworking</h1>

<!-- H2: Main sections -->
<h2>Tại sao chọn Sol Cafe cho sự kiện của bạn?</h2>

  <!-- H3: Supporting points -->
  <h3>✅ Vị trí đắc địa tại trung tâm Cầu Giấy</h3>
  <h3>✅ Cơ sở vật chất đầy đủ và hiện đại</h3>
  <h3>✅ Giá cả cạnh tranh, không phí ẩn</h3>
  <h3>✅ Hỗ trợ setup và coordination chuyên nghiệp</h3>

<h2>Các dịch vụ cho thuê mặt bằng sự kiện tại Sol Cafe</h2>

  <!-- H3: Service types -->
  <h3>Phòng hội thảo nhỏ (10-30 người)</h3>
  <h3>Phòng hội thảo vừa (30-50 người)</h3>
  <h3>Sảnh tiệc lớn (50-100+ người)</h3>

<h2>Bảng giá thuê mặt bằng sự kiện 2026</h2>

  <!-- H3: Pricing tables -->
  <h3>Giá thuê theo giờ</h3>
  <h3>Giá thuê theo ngày (full-day package)</h3>
  <h3>Combo trọn gói (bao gồm catering)</h3>

<h2>Cơ sở vật chất và trang thiết bị</h2>

  <!-- H3: Amenities -->
  <h3>🎤 Hệ thống âm thanh chuyên nghiệp</h3>
  <h3>📺 Máy chiếu và màn hình LED</h3>
  <h3>📶 WiFi tốc độ cao</h3>
  <h3>❄️ Điều hòa nhiệt độ</h3>

<h2>Quy trình đặt thuê mặt bằng sự kiện</h2>

  <!-- H3: Process steps -->
  <h3>Bước 1: Liên hệ tư vấn</h3>
  <h3>Bước 2: Xem không gian thực tế</h3>
  <h3>Bước 3: Xác nhận booking</h3>
  <h3>Bước 4: Setup và tổ chức sự kiện</h3>

<h2>Hình ảnh không gian sự kiện tại Sol Cafe</h2>

<h2>Đánh giá từ khách hàng</h2>

<h2>FAQ - Câu hỏi thường gặp</h2>

  <!-- H3: Questions -->
  <h3>Cần đặt thuê trước bao lâu?</h3>
  <h3>Giá thuê đã bao gồm những gì?</h3>
  <h3>Có thể hủy hoặc thay đổi lịch không?</h3>

<h2>Liên hệ đặt thuê mặt bằng sự kiện</h2>

  <!-- H3: Contact info -->
  <h3>📞 Hotline: [Phone number]</h3>
  <h3>📧 Email: [Email address]</h3>
  <h3>📍 Địa chỉ: 181 Trần Quốc Vượng, Cầu Giấy, Hà Nội</h3>
```

**Best Practices:**
- [ ] Use only ONE H1 tag per page
- [ ] H1 should include primary keyword
- [ ] H2 tags for main sections (4-6 per page)
- [ ] H3 tags for subsections
- [ ] Don't skip heading levels (H1 → H2 → H3)
- [ ] Include keywords naturally in headings
- [ ] Make headings descriptive and scannable

### 2.4 Image Alt Text Strategy

**Formula:**
```
[Descriptive text of image] - [Keywords if natural, don't force]
```

**Examples for Different Image Types:**

#### Venue/Space Images
```html
<!-- Hero image of main event space -->
<img src="main-hall.jpg"
     alt="Không gian sự kiện chính tại Sol Cafe Cầu Giấy được trang bị đầy đủ chỗ ngồi và hệ thống âm thanh ánh sáng">

<!-- Meeting room -->
<img src="meeting-room.jpg"
     alt="Phòng họp riêng tư tại Sol Cafe có sức chứa 15 người với bàn hội thảo và view cửa sổ">

<!-- Workshop setup -->
<img src="workshop-setup.jpg"
     alt="Setup không gian workshop tại Sol Cafe với projector, micro và không gian mở phù hợp cho thảo luận nhóm">
```

#### Equipment Images
```html
<!-- Projector and screen -->
<img src="projector-setup.jpg"
     alt="Hệ thống máy chiếu và màn hình LED tại Sol Cafe hỗ trợ thuyết trình chuyên nghiệp">

<!-- Sound system -->
<img src="sound-system.jpg"
     alt="Hệ thống âm thanh chuyên nghiệp với micro không dây và loa karaoke chất lượng cao">
```

#### Event Examples
```html
<!-- Corporate event -->
<img src="corporate-event.jpg"
     alt="Sự kiện doanh nghiệp được tổ chức tại Sol Cafe với không gian chuyên nghiệp và trang thiết bị đầy đủ">

<!-- Workshop in progress -->
<img src="workshop-event.jpg"
     alt="Workshop đang diễn ra tại Sol Cafe với không gian tương tác và thảo luận nhóm sôi nổi">

<!-- Team building -->
<img src="team-building.jpg"
     alt="Hoạt động team building được tổ chức tại không gian rộng rãi của Sol Cafe Cầu Giấy">
```

#### Food/Catering
```html
<!-- Catering setup -->
<img src="catering.jpg"
     alt="Dịch vụ catering cho sự kiện tại Sol Cafe với buffet tea break và set lunch đầy đủ">

<!-- Coffee break -->
<img src="tea-break.jpg"
     alt="Tea break được chuẩn bị sẵn sàng cho hội thảo tại Sol Cafe với bánh ngọt và cà phê">
```

**Alt Text Best Practices:**
- [ ] Be descriptive and specific
- [ ] Include location keywords naturally (Sol Cafe, Cầu Giấy, Hà Nội)
- [ ] Include service keywords when relevant (sự kiện, hội thảo, workshop)
- [ ] Keep under 125 characters
- [ ] Don't keyword stuff
- [ ] Use Vietnamese language naturally
- [ ] Describe what's actually in the image
- [ ] For decorative images, use empty alt="" or alt="decorative"

### 2.5 URL Structure

**Best Practices:**
- [ ] Use lowercase letters
- [ ] Separate words with hyphens (-)
- [ ] Keep URLs short and descriptive
- [ ] Include primary keyword
- [ ] Avoid stop words (a, an, the, của, tại - unless natural)

**Example URL Structure:**
```
✅ Good URLs:
/thue-mat-bang-su-kien-cau-giay
/thue-phong-hoi-thao-ha-noi
/dia-diem-to-chuc-workshop-sinh-vien
/thue-khong-gian-dao-tao-ha-noi
/venue-su-kien-nho-ha-noi

❌ Bad URLs:
/page?id=123
/services/event-space
/thuematbangsu_kien_caugiay
/thue-mat-bang-su-kien-tai-cau-giay-ha-noi-viet-nam
```

### 2.6 Internal Linking Strategy

**Link Distribution:**
```html
<!-- Homepage → Service pages -->
<a href="/thue-mat-bang-su-kien-cau-giay">Thuê mặt bằng sự kiện</a>
<a href="/thue-phong-hoi-thao-ha-noi">Thuê phòng hội thảo</a>
<a href="/dia-diem-to-chuc-workshop-sinh-vien">Địa điểm workshop</a>

<!-- Service pages → Related services -->
<p>Bên cạnh dịch vụ <a href="/thue-phong-hoi-thao-ha-noi">thuê phòng hội thảo</a>,
chúng tôi còn cung cấp <a href="/thue-khong-gian-dao-tao-ha-noi">không gian đào tạo</a>
và <a href="/venue-su-kien-nho-ha-noi">venue cho sự kiện nhỏ</a>.</p>

<!-- Service pages → Blog posts -->
<p>Xem thêm: <a href="/blog/huong-dan-chon-dia-diem-workshop">Hướng dẫn chọn địa điểm workshop</a></p>

<!-- Blog posts → Service pages -->
<p>Nếu bạn đang tìm <a href="/thue-mat-bang-su-kien-cau-giay">thuê mặt bằng sự kiện tại Cầu Giấy</a>,
Sol Cafe là lựa chọn hàng đầu với giá cả cạnh tranh và cơ sở vật chất đầy đủ.</p>
```

**Internal Link Best Practices:**
- [ ] Use descriptive anchor text (include keywords)
- [ ] Link to related content naturally
- [ ] Don't overlink (2-5 internal links per page max)
- [ ] Fix broken links regularly
- [ ] Create hub pages for main topics
- [ ] Use breadcrumb navigation

---

## 3. Schema Markup Implementation

### 3.1 LocalBusiness Schema

**Add to all pages or homepage:**

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "Sol Cafe Coworking",
  "alternateName": "Sol Cafe Event Space",
  "description": "Dịch vụ cho thuê mặt bằng sự kiện, phòng hội thảo, workshop tại Cầu Giấy, Hà Nội",
  "url": "https://solcafe.com.vn",
  "telephone": "+84-XXX-XXX-XXX",
  "email": "contact@solcafe.com.vn",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "181 Trần Quốc Vượng",
    "addressLocality": "Cầu Giấy",
    "addressRegion": "Hà Nội",
    "postalCode": "100000",
    "addressCountry": "VN"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": "21.0333",
    "longitude": "105.7833"
  },
  "openingHoursSpecification": [
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      "opens": "08:00",
      "closes": "22:00"
    }
  ],
  "priceRange": "$$",
  "currenciesAccepted": "VND",
  "paymentAccepted": ["Cash", "Credit Card", "Bank Transfer"],
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.7",
    "reviewCount": "45"
  },
  "sameAs": [
    "https://www.facebook.com/solcafecoworking",
    "https://www.instagram.com/solcafecoworking"
  ],
  "hasMap": "https://www.google.com/maps/place/?q=21.0333,105.7833"
}
</script>
```

### 3.2 EventVenue Schema

**Add to service pages:**

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "EventVenue",
  "name": "Sol Cafe Coworking - Không Gian Sự Kiện",
  "description": "Venue chuyên nghiệp cho hội thảo, workshop, sự kiện doanh nghiệp tại Cầu Giấy, Hà Nội",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "181 Trần Quốc Vượng",
    "addressLocality": "Cầu Giấy",
    "addressRegion": "Hà Nội",
    "addressCountry": "VN"
  },
  "telephone": "+84-XXX-XXX-XXX",
  "url": "https://solcafe.com.vn/thue-mat-bang-su-kien-cau-giay",
  "maximumAttendeeCapacity": "100",
  "amenityFeature": [
    {
      "@type": "LocationFeatureSpecification",
      "name": "Free WiFi",
      "value": true
    },
    {
      "@type": "LocationFeatureSpecification",
      "name": "Free Parking",
      "value": true
    },
    {
      "@type": "LocationFeatureSpecification",
      "name": "Projector",
      "value": true
    },
    {
      "@type": "LocationFeatureSpecification",
      "name": "Sound System",
      "value": true
    },
    {
      "@type": "LocationFeatureSpecification",
      "name": "Air Conditioning",
      "value": true
    },
    {
      "@type": "LocationFeatureSpecification",
      "name": "Catering Service",
      "value": true
    }
  ],
  "photo": [
    "https://solcafe.com.vn/images/venue-main.jpg",
    "https://solcafe.com.vn/images/venue-meeting.jpg",
    "https://solcafe.com.vn/images/venue-event.jpg"
  ],
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.7",
    "reviewCount": "45",
    "bestRating": "5",
    "worstRating": "1"
  }
}
</script>
```

### 3.3 FAQPage Schema

**Add to FAQ sections:**

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Cần đặt thuê mặt bằng sự kiện trước bao lâu?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Nên đặt thuê trước ít nhất 3-7 ngày cho sự kiện nhỏ, và 2-4 tuần cho sự kiện lớn để đảm bảo có chỗ và chuẩn bị tốt nhất. Tuy nhiên, chúng tôi luôn cố gắng hỗ trợ cả các yêu cầu last-minute."
      }
    },
    {
      "@type": "Question",
      "name": "Giá thuê đã bao gồm những gì?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Giá thuê cơ bản bao gồm: sử dụng không gian, điều hòa, WiFi, máy chiếu và màn hình, hệ thống âm thanh cơ bản. Các dịch vụ thêm như catering, decor chi tiết, và coordination được tính riêng theo yêu cầu."
      }
    },
    {
      "@type": "Question",
      "name": "Có thể hủy hoặc thay đổi lịch không?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Có, bạn có thể hủy hoặc thay đổi lịch miễn phí trước 72 giờ. Hủy trong vòng 48-72 giờ sẽ chịu phí 30%, hủy trong vòng 24-48 giờ phí 50%, và hủy dưới 24 giờ phí 100%."
      }
    },
    {
      "@type": "Question",
      "name": "Không gian có sức chứa bao nhiêu người?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Sol Cafe có các không gian linh hoạt: phòng họp nhỏ (10-15 người), phòng hội thảo (20-30 người), và sảnh chính (50-100 người). Chúng tôi có thể điều chỉnh setup theo yêu cầu."
      }
    },
    {
      "@type": "Question",
      "name": "Có hỗ trợ setup và coordination không?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Có, chúng tôi có đội ngũ support onsite suốt sự kiện, giúp đỡ setup ban đầu, điều khiển âm thanh/light, và hỗ trợ các vấn đề phát sinh. Dịch vụ này đã bao gồm trong giá thuê."
      }
    }
  ]
}
</script>
```

### 3.4 BreadcrumbList Schema

**Add to all inner pages:**

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Trang chủ",
      "item": "https://solcafe.com.vn/"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Dịch vụ",
      "item": "https://solcafe.com.vn/dich-vu"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "Thuê Mặt Bằng Sự Kiện Cầu Giấy",
      "item": "https://solcafe.com.vn/thue-mat-bang-su-kien-cau-giay"
    }
  ]
}
</script>
```

### 3.5 Review Schema

**Add when you have reviews:**

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Dịch vụ Thuê Mặt Bằng Sự Kiện tại Sol Cafe Coworking",
  "description": "Cho thuê không gian sự kiện, hội thảo, workshop chuyên nghiệp tại Cầu Giấy, Hà Nội",
  "brand": {
    "@type": "Brand",
    "name": "Sol Cafe Coworking"
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.7",
    "reviewCount": "45",
    "bestRating": "5",
    "worstRating": "1"
  },
  "review": [
    {
      "@type": "Review",
      "reviewRating": {
        "@type": "Rating",
        "ratingValue": "5",
        "bestRating": "5"
      },
      "author": {
        "@type": "Person",
        "name": "Nguyễn Văn A"
      },
      "reviewBody": "Không gian rất đẹp và chuyên nghiệp, đội ngũ support nhiệt tình. Đã tổ chức thành công 2 workshop tại đây!"
    },
    {
      "@type": "Review",
      "reviewRating": {
        "@type": "Rating",
        "ratingValue": "5",
        "bestRating": "5"
      },
      "author": {
        "@type": "Person",
        "name": "Trần Thị B"
      },
      "reviewBody": "Giá cả hợp lý, trang thiết bị đầy đủ. WiFi tốc độ cao, điều hòa mát. Sẽ quay lại!"
    }
  ]
}
</script>
```

**Schema Implementation Tasks:**
- [ ] Add LocalBusiness schema to homepage
- [ ] Add EventVenue schema to service pages
- [ ] Add FAQPage schema to FAQ sections
- [ ] Add BreadcrumbList schema to all inner pages
- [ ] Add Review schema when have 5+ reviews
- [ ] Test with Google Rich Results Test
- [ ] Monitor in Search Console for errors

---

## 4. Technical SEO Testing Checklist

### 4.1 Pre-Launch Testing

**Tools to use:**
- Google Search Console
- Google Mobile-Friendly Test
- Google PageSpeed Insights
- Google Rich Results Test
- Screaming Frog SEO Spider
- GTmetrix

**Checklist:**
- [ ] Run crawl with Screaming Frog (find broken links, redirects)
- [ ] Test all pages with Mobile-Friendly Test
- [ ] Check PageSpeed (aim for Green score on both mobile/desktop)
- [ ] Validate schema markup with Rich Results Test
- [ ] Submit XML sitemap to Google Search Console
- [ ] Submit sitemap to Bing Webmaster Tools
- [ ] Check robots.txt is accessible
- [ ] Test canonical tags are working
- [ ] Verify no duplicate content issues
- [ ] Check all internal links work
- [ ] Test on multiple browsers (Chrome, Firefox, Safari)
- [ ] Test on multiple devices (desktop, tablet, mobile)

### 4.2 Post-Launch Monitoring

**Week 1:**
- [ ] Check Google Search Console daily for errors
- [ ] Monitor crawl stats
- [ ] Check indexing status
- [ ] Look for mobile usability issues

**Week 2-4:**
- [ ] Track keyword rankings
- [ ] Monitor organic traffic in GA4
- [ ] Check Core Web Vitals in Search Console
- [ ] Review crawl errors and fix
- [ ] Analyze user behavior (bounce rate, time on page)

---

## 5. Deliverables Summary

### End of Phase 2 Deliverables

**Technical SEO:**
- [ ] Robots.txt configured
- [ ] XML sitemap created and submitted
- [ ] Canonical tags implemented
- [ ] HTTPS enforced
- [ ] Page speed optimized (target: Green score)

**On-Page SEO:**
- [ ] All title tags optimized (5+ pages)
- [ ] All meta descriptions written (5+ pages)
- [ ] Proper heading structure (H1-H3) on all pages
- [ ] Image alt text added to all images
- [ ] Clean URL structure implemented
- [ ] Internal linking structure set up

**Schema Markup:**
- [ ] LocalBusiness schema on homepage
- [ ] EventVenue schema on service pages
- [ ] FAQPage schema on FAQ pages
- [ ] BreadcrumbList schema on inner pages
- [ ] All schema tested with Rich Results Test

**Documentation:**
- [ ] Technical SEO audit report
- [ ] On-page optimization spreadsheet
- [ ] Schema markup documentation
- [ ] Weekly progress reports

---

## Success Metrics (Phase 2)

**Technical Metrics:**
- PageSpeed Score: 85+ on mobile, 90+ on desktop
- Mobile-Friendly: 100% pages passing
- Core Web Vitals: Good status
- Schema Errors: 0 critical errors

**On-Page Metrics:**
- Title tags: 100% optimized
- Meta descriptions: 100% implemented
- Heading structure: 100% correct (H1-H3)
- Alt text: 100% coverage
- Internal links: 5+ per page

**Indexing:**
- All important pages indexed
- 0 crawl errors
- XML sitemap submitted and accepted
- Robots.txt working correctly

---

## Next Steps After Phase 2

1. ✅ Complete technical SEO audit
2. ✅ Implement all on-page optimizations
3. ✅ Add schema markup
4. [ ] **Move to Phase 3: Local SEO Implementation**
5. [ ] **Begin content creation for Phase 4**

---

## Potential Issues & Solutions

**Issue 1: Page speed slow**
- Solution: Image optimization, lazy loading, CDN, caching

**Issue 2: Mobile usability issues**
- Solution: Fix text size, touch targets, viewport configuration

**Issue 3: Schema markup errors**
- Solution: Use validation tools, fix syntax errors, test with Google tool

**Issue 4: Duplicate content**
- Solution: Canonical tags, 301 redirects, rewrite content

**Issue 5: Low word count**
- Solution: Expand content, add more details, case studies

---

**Phase 2 Status:** ⏳ Pending
**Estimated Completion:** End of Week 4
**Dependencies:** Phase 1 research completed ✅
**Next Phase:** Phase 3 - Local SEO Implementation

---

*Last Updated: 14/03/2026*
*Version: 1.0*
