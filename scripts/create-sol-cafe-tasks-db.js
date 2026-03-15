#!/usr/bin/env node

/**
 * Script tạo project và 30 marketing tasks cho Sol Cafe Coworking
 * Sử dụng trực tiếp Better-SQLite3 để thao tác với database
 */

const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

// 30 tasks marketing cho Sol Cafe Coworking
const MARKETING_TASKS = [
  {
    title: "Instagram Content Calendar - Week 1",
    description: "Tạo lịch đăng bài Instagram 7 ngày với theme 'Coworking mornings at Sol Cafe'. Mỗi bài bao gồm: hình ảnh suggest, caption, hashtags (20-30 tags), và thời gian đăng tối ưu. Target: freelancers và remote workers tại Cầu Giấy."
  },
  {
    title: "TikTok Viral Content Scripts",
    description: "Viết 10 kịch bản video TikTok ngắn (15-30s) về lợi ích làm việc tại coworking space. Mỗi script gồm: hook, nội dung chính, CTA. Focus: visual appeal, trending sounds, text overlays."
  },
  {
    title: "LinkedIn Corporate Outreach",
    description: "Tạo 5 bài đăng LinkedIn targeting HR managers và startup founders về benefits của corporate memberships. Include: pain points, solutions, ROI metrics, case studies format."
  },
  {
    title: "Blog Post: Remote Work Productivity",
    description: "Viết blog post 1500 từ '5 Lý Do Freelancer Nên Chọn Coworking Space Thay Vì Làm Việc Tại Nhà'. SEO optimized với keywords: coworking space Hanoi, freelancer workspace, không gian làm việc chia sẻ."
  },
  {
    title: "Google Business Profile Posts",
    description: "Tạo 5 bài đăng Google Business Profile để tăng local SEO cho 'coworking space Cầu Giấy'. Mỗi bài 300-500 từ, include keywords local, geo-tags, và call-to-action."
  },
  {
    title: "Welcome Email Automation",
    description: "Tạo email sequence 5 phần cho thành viên mới: (1) Welcome + facilities tour, (2) Community guidelines, (3) Productivity tips, (4) Member benefits, (5) Feedback request. Mỗi email 200-300 từ, tone friendly professional."
  },
  {
    title: "Weekly Newsletter Template",
    description: "Design newsletter template với sections: Member spotlight, Upcoming events, Productivity tip of the week, Local business partner highlight, Community announcements. Include subject line options (A/B testing variants)."
  },
  {
    title: "Networking Event Flyer Content",
    description: "Tạo nội dung flyer cho monthly networking event 'Coworking Connect'. Include: event name, date/time, agenda, speaker bio, registration CTA, pricing (member/non-member)."
  },
  {
    title: "Facebook Ads Copy - Freelancers",
    description: "Viết 5 variants Facebook ad copy targeting freelancers 25-40 tuổi tại Hanoi. Each variant: headline (25 chars), primary text (125 chars), description (30 chars). Include pain points và solution angles khác nhau."
  },
  {
    title: "YouTube Tour Script",
    description: "Viết script video tour 3 phút giới thiệu Sol Cafe. Structure: Hook (5s) - Facility tour (90s) - Member testimonials (45s) - Pricing & CTA (40s). Include visual directions và B-roll suggestions."
  },
  {
    title: "Google Review Request Template",
    description: "Tạo email template.request thành viên review Google Maps. Include: personalized opening, review guidelines (what to mention), direct link to GMB, incentive (đền 1 ngày free pass), follow-up timing."
  },
  {
    title: "Zalo OA Content Strategy",
    description: "Lên content calendar 1 tháng cho Zalo Official Account targeting startup teams. 12 posts với mix: tips (40%), promotions (30%), community stories (30%). Include interactive elements (polls, quizzes)."
  },
  {
    title: "Guest Post Outreach - Tech Blogs",
    description: "Tạo list 10 tech blogs/startup publications tại Việt Nam để guest post. Đề xuất 5 topics phù hợp với audience của từng blog. Draft outreach email template với value proposition."
  },
  {
    title: "Instagram Story Highlights",
    description: "Design content cho 5 Story Highlights: (1) Our Space, (2) Membership Plans, (3) Community Events, (4) Member Success Stories, (5) Location & Contact. Mỗi highlight 10-15 stories với cover design suggestions."
  },
  {
    title: "Press Release - New Membership Tier",
    description: "Soạn press release ra mắt gói membership mới. Format: headline, dateline, introduction, quotes, details about new tier, pricing, benefits, contact info. Distribute to 20 tech/startup media outlets."
  },
  {
    title: "Landing Page Copy - Day Pass",
    description: "Viết nội dung landing page cho gói Day Pass. Sections: Hero (headline + subhead + CTA), Features (3-4 bullets), Benefits (pain points → solutions), Social proof (testimonials), Pricing, FAQ (5 questions), Final CTA."
  },
  {
    title: "Referral Program Email",
    description: "Tạo email template giới thiệu chương trình referral: mời bạn bè → tặng 3 ngày free cho cả hai. Include: program explanation, unique referral link mechanism, reward structure, terms & conditions, share buttons."
  },
  {
    title: "YouTube Playlist: Productivity Hacks",
    description: "Lên danh sách 20 ý tưởng video cho playlist 'Productivity Hacks for Remote Workers'. Each idea: title (searchable), thumbnail concept, key topics covered, target duration (5-15 mins), upload schedule."
  },
  {
    title: "Local Partnership Proposal",
    description: "Soạn proposal template hợp tác với local businesses (gyms, restaurants, coffee shops). Include: cross-promotion ideas, member discount structure, co-marketing opportunities, revenue sharing model, term sheet outline."
  },
  {
    title: "Community Guidelines Document",
    description: "Soạn quy tắc ứng xử cho cộng đồng Sol Cafe. Sections: Respect & Professionalism, Space Usage, Noise Policy, Guest Policy, Booking Rules, Conflict Resolution, Consequences for violations. Tone: friendly but firm."
  },
  {
    title: "Member Testimonial Questions",
    description: "Lên 10 câu hỏi phỏng vấn thành viên để làm case studies. Questions cover: background, challenges before Sol Cafe, experience with community, business impact, advice for new members. Include follow-up probing questions."
  },
  {
    title: "AMA Session: Building Startup Communities",
    description: "Lên 15 câu hỏi cho AMA session 'Building Startup Communities in Hanoi'. Topics: coworking trends, community engagement strategies, challenges, success metrics, future plans. Include audience Q&A preparation."
  },
  {
    title: "Twitter Thread: Future of Work",
    description: "Viết Twitter thread (20 tweets) về 'Future of Work in Vietnam'. Cover: remote work trends, hybrid models, coworking growth, startup ecosystem, Gen Z preferences, technology impact. Include thread hook và engagement tactics."
  },
  {
    title: "Corporate Brochure Content",
    description: "Soạn nội dung brochure B2B giới thiệu Sol Cafe cho corporate clients. Sections: About us, Facility highlights, Membership tiers, Corporate benefits (team building, events, private space), Case studies, Contact & pricing inquiry."
  },
  {
    title: "Community Manager Job Description",
    description: "Tạo JD cho vị trí Community Manager (nếu cần tuyển). Sections: Role overview, Key responsibilities (5-7 bullet), Requirements (skills + experience), Benefits, How to apply. Include culture fit questions."
  },
  {
    title: "Monthly Event Recap Template",
    description: "Lên template recap events sau mỗi tháng cho internal tracking và external communications. Include: Event name, date, attendance, engagement metrics, feedback highlights, photos/videos count, lessons learned, next month improvements."
  },
  {
    title: "Pricing Page Copy",
    description: "Viết nội dung trang pricing với 4 tiers: Day Pass, Part-time (10 days/month), Full-time (unlimited), Corporate (team). Mỗi tier: features list, price, use case, CTA. Include comparison table và FAQ section."
  },
  {
    title: "FAQ Section - 20 Questions",
    description: "Viết 20 FAQ thường gặp từ potential members: pricing, facilities, booking, parking, food/drinks policy, guest policy, cancellation, payment methods, community guidelines, etc. Group by category cho easy navigation."
  },
  {
    title: "Sustainability Commitment",
    description: "Soạn content về cam kết environmental friendly của Sol Cafe. Cover: eco-friendly practices (reusable cups, recycling, energy saving), community green initiatives, partnerships with sustainable vendors, future sustainability goals."
  },
  {
    title: "1-Year Anniversary Campaign Plan",
    description: "Lên kế hoạch campaign kỷ niệm 1 năm: Theme ideas, special promotions (flash sales, upgrade deals), member appreciation events, social media contest, user-generated content campaign, press outreach, timeline 4 weeks trước và sau."
  }
];

// Helper function để generate ID
function generateId(prefix = '') {
  const bytes = crypto.randomBytes(12);
  const id = bytes.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  return prefix ? `${prefix}_${id}` : id;
}

function main() {
  console.log('=== Sol Cafe Coworking Marketing Project Setup ===\n');

  // Connect to database
  const dbPath = path.join(process.cwd(), 'data', 'db.sqlite');
  console.log(`📦 Connecting to database: ${dbPath}`);
  const db = new Database(dbPath);

  try {
    // Step 1: Create project
    console.log('\n📁 Step 1: Creating project "sol-cafe-coworking-mkt"...');

    const projectPath = 'data/projects/sol-cafe-coworking-mkt';
    const projectId = generateId('proj');
    const now = Date.now();

    // Check if project already exists
    const existingProject = db.prepare('SELECT id FROM projects WHERE path = ?').get(projectPath);

    if (existingProject) {
      console.log(`ℹ️  Project already exists with ID: ${existingProject.id}`);
      var projectIdToUse = existingProject.id;
    } else {
      // Insert project
      const insertProject = db.prepare(`
        INSERT INTO projects (id, name, path, created_at)
        VALUES (?, ?, ?, ?)
      `);

      insertProject.run(projectId, 'sol-cafe-coworking-mkt', projectPath, now);
      console.log(`✓ Project created with ID: ${projectId}`);
      var projectIdToUse = projectId;

      // Create project directory
      const fs = require('fs');
      if (!fs.existsSync(projectPath)) {
        fs.mkdirSync(projectPath, { recursive: true });
        console.log(`✓ Created directory: ${projectPath}`);
      }

      // Create CLAUDE.md
      const claudeMdPath = path.join(projectPath, 'CLAUDE.md');
      if (!fs.existsSync(claudeMdPath)) {
        fs.writeFileSync(claudeMdPath, `# CLAUDE.md - Sol Cafe Coworking Marketing

This project contains 30 marketing tasks for Sol Cafe Coworking space.

## Location
181 Trần Quốc Thượng, Cầu Giấy, Hà Nội

## Project Overview
Marketing campaigns to promote Sol Cafe coworking space to:
- Freelancers
- Remote workers
- Startups
- Corporate teams

## Tasks
This project has 30 marketing tasks covering:
- Social media (Instagram, TikTok, LinkedIn)
- Content marketing (blogs, videos)
- Email marketing
- Local SEO
- Partnership marketing
- Events & community
- Referral programs

Each task has an AI agent attempt to execute the marketing deliverables.
`);
        console.log(`✓ Created CLAUDE.md`);
      }
    }

    // Step 2: Create 30 marketing tasks
    console.log(`\n📝 Step 2: Creating 30 marketing tasks...\n`);

    const tasks = [];
    for (let i = 0; i < MARKETING_TASKS.length; i++) {
      const taskData = MARKETING_TASKS[i];
      const taskId = generateId('task');
      const position = i;

      const insertTask = db.prepare(`
        INSERT INTO tasks (id, project_id, title, description, status, position, chat_init, rewind_session_id, rewind_message_uuid, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      try {
        insertTask.run(
          taskId,
          projectIdToUse,
          taskData.title,
          taskData.description,
          'todo',
          position,
          0, // chat_init
          null, // rewind_session_id
          null, // rewind_message_uuid
          now,
          now
        );
        tasks.push(taskId);
        console.log(`  ✓ Task ${i + 1}/30: ${taskData.title.substring(0, 45)}... (ID: ${taskId})`);
      } catch (error) {
        if (error.message.includes('UNIQUE constraint')) {
          console.log(`  ⊘ Task ${i + 1}/30 already exists, skipping...`);
        } else {
          console.error(`  ✗ Failed to create task ${i + 1}: ${error.message}`);
        }
      }
    }

    console.log(`\n✓ Created/verified ${tasks.length}/30 tasks`);

    // Step 3: Create attempts for each task
    console.log(`\n🚀 Step 3: Creating attempts for each task...\n`);

    const attempts = [];
    for (let i = 0; i < tasks.length; i++) {
      const taskId = tasks[i];
      const taskData = MARKETING_TASKS[i];
      const attemptId = generateId('atmp');

      const prompt = `Bạn là một chuyên gia marketing digital với kinh nghiệm về coworking spaces và startup communities tại Việt Nam.

**TASK**: ${taskData.title}

**MÔ TẢ**: ${taskData.description}

**CONTEXT VỀ SOL CAFE COWORKING**:
- Địa chỉ: 181 Trần Quốc Thượng, Cầu Giấy, Hà Nội
- Target audience: Freelancers, remote workers, startups, SMEs, corporate teams
- Unique selling points: Không gian sáng tạo, community mạnh, cafe ngon, giá hợp lý, location trung tâm Cầu Giấy
- Brand voice: Friendly, professional, community-focused, innovative

**YÊU CẦU DELIVERABLE**:
1. Phân tích yêu cầu task và tạo ra deliverable hoàn chỉnh
2. Output format: JSON với structure rõ ràng và dễ đọc
3. Nội dung phải phù hợp với thị trường Việt Nam 2026
4. Include actionable insights và specific recommendations
5. Add metrics/KPIs để measure success (nếu applicable)
6. Provide timeline/phases để implementation (nếu applicable)

**OUTPUT FORMAT EXAMPLE**:
{
  "task": "${taskData.title}",
  "deliverables": {
    "primary": "Main output here",
    "supporting_materials": ["item1", "item2"]
  },
  "recommendations": {
    "immediate_actions": ["action1", "action2"],
    "long_term_strategy": "strategy here"
  },
  "metrics": {
    "success_kpis": ["kpi1", "kpi2"],
    "measurement_methods": "method here"
  }
};

Hãy bắt đầu với deliverable chất lượng cao, ready để implement!`;

      const insertAttempt = db.prepare(`
        INSERT INTO attempts (id, task_id, prompt, display_prompt, status, output_format, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      try {
        insertAttempt.run(
          attemptId,
          taskId,
          prompt,
          taskData.title, // display_prompt
          'running', // status - sẽ tự động start agent
          'json', // output_format
          now
        );
        attempts.push(attemptId);
        console.log(`  ✓ Attempt ${i + 1}/30 created (ID: ${attemptId})`);
      } catch (error) {
        if (error.message.includes('UNIQUE constraint')) {
          console.log(`  ⊘ Attempt for task ${i + 1} already exists, skipping...`);
        } else {
          console.error(`  ✗ Failed to create attempt ${i + 1}: ${error.message}`);
        }
      }
    }

    console.log(`\n✓ Created/verified ${attempts.length}/30 attempts`);

    // Summary
    console.log('\n=== SUMMARY ===');
    console.log(`✓ Project ID: ${projectIdToUse}`);
    console.log(`✓ Project Name: sol-cafe-coworking-mkt`);
    console.log(`✓ Project Path: ${projectPath}`);
    console.log(`✓ Tasks: ${tasks.length}/30`);
    console.log(`✓ Attempts: ${attempts.length}/30`);
    console.log('\n🎉 Setup complete!');

    console.log('\n📊 Monitor progress:');
    console.log(`   - API: curl http://localhost:33333/api/tasks?projectId=${projectIdToUse}`);
    console.log(`   - API: curl http://localhost:33333/api/attempts?projectId=${projectIdToUse}`);

  } catch (error) {
    console.error('\n✗ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    db.close();
  }
}

// Run the script
main();
