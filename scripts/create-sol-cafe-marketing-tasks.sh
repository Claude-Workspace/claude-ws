#!/bin/bash

API_BASE="http://localhost:33333"

echo "=== Step 1: Create Project ==="
PROJECT_RESPONSE=$(curl -s -X POST "$API_BASE/api/projects" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "sol-cafe-coworking-mkt",
    "path": "data/projects/sol-cafe-coworking-mkt"
  }')

echo "Project Response: $PROJECT_RESPONSE"

PROJECT_ID=$(echo $PROJECT_RESPONSE | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

if [ -z "$PROJECT_ID" ]; then
  echo "Failed to create project"
  exit 1
fi

echo "✓ Project created with ID: $PROJECT_ID"
echo ""

# Array of 30 marketing tasks for Sol Cafe Coworking
declare -a TASKS=(
  "Tạo nội dung Instagram 7 ngày: Thiết kế lịch đăng bài Instagram cho 7 ngày với theme 'Coworking mornings at Sol Cafe'"
  "Viết caption TikTok: Viết 10 caption ngắn gọn cho TikTok về lợi ích làm việc tại không gian coworking"
  "Tạo LinkedIn post: Viết bài đăng LinkedIn targeting các công ty startup về không gian văn phòng tại Sol Cafe"
  "Viết blog post: Viết bài blog '5 lý do freelancer nên chọn Coworking Space thay vì làm việc tại nhà'"
  "Tạo Google Business Post: Viết 5 bài đăng Google Business Profile để tăng local SEO"
  "Thiết kế email chào mừng: Tạo email template chào mừng thành viên mới join Sol Cafe"
  "Viết newsletter: Soạn newsletter weekly cập nhật events và tips cho coworking community"
  "Tạo flyer events: Thiết kế nội dung flyer cho events networking monthly tại Sol Cafe"
  "Viết content Facebook Ads: Viết copy quảng cáo Facebook targeting freelancers Cầu Giấy"
  "Tạo YouTube script: Viết script video tour 3 phút giới thiệu Sol Cafe Coworking"
  "Viết review template: Tạo template email nhờ thành viên review trên Google Maps"
  "Tạo Zalo post: Viết nội dung đăng Zalo OA targeting các team startup Việt Nam"
  "Viết guest post outline: Đề xuất outline bài guest post cho các blog về startup/coworking"
  "Tạo story highlight: Lên nội dung cho 5 Instagram Story highlights về facilities"
  "Viết press release: Soạn thông cáo báo chí ra mắt gói membership mới"
  "Tạo landing page copy: Viết nội dung landing page cho gói 'Day Pass' tại Sol Cafe"
  "Viết referral email: Tạo email template giới thiệu bạn bè, tặng 3 ngày dùng thử"
  "Tạo playlist content: Lên danh sách 20 ý tưởng nội dung cho playlist 'Productivity Hacks'"
  "Viết partnership proposal: Soạn proposal hợp tác với các coffee shop lân cận"
  "Tạo community guidelines: Soạn quy tắc ứng xử cho cộng đồng Sol Cafe"
  "Viết testimonial questions: Lên 10 câu hỏi phỏng vấn thành viên làm case study"
  "Tạo AMA session: Lên 15 câu hỏi cho AMA session 'Building Startup Community'"
  "Viết Twitter thread: Viết Twitter thread về 'Future of Work in Vietnam'"
  "Tạo brochure content: Soạn nội dung brochure giới thiệu Sol Cafe cho corporate clients"
  "Viết job description: Tạo JD cho Community Manager position (nếu cần tuyển)"
  "Tạo event recap template: Lên template recap events sau mỗi tháng"
  "Viết pricing page: Soạn nội dung trang pricing với các gói membership"
  "Tạo FAQ section: Viết 20 FAQ thường gặp từ potential members"
  "Viết sustainability commitment: Soạn content về cam kết xanh và environmental friendly"
  "Tạo周年 content plan: Lên kế hoạch content kỷ niệm 1 năm (hoặc milestone)"
)

echo "=== Step 2: Create 30 Marketing Tasks ==="
TASK_IDS=()

for i in "${!TASKS[@]}"; do
  TITLE="Marketing Task $((i+1))/30"
  DESCRIPTION="${TASKS[$i]}"

  TASK_RESPONSE=$(curl -s -X POST "$API_BASE/api/tasks" \
    -H "Content-Type: application/json" \
    -d "{
      \"projectId\": \"$PROJECT_ID\",
      \"title\": \"$TITLE\",
      \"description\": \"$DESCRIPTION\"
    }")

  TASK_ID=$(echo $TASK_RESPONSE | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

  if [ -n "$TASK_ID" ]; then
    echo "✓ Task $((i+1))/30 created: $TITLE (ID: $TASK_ID)"
    TASK_IDS+=("$TASK_ID")
  else
    echo "✗ Failed to create task $((i+1))"
  fi
done

echo ""
echo "=== Step 3: Create Attempts for Each Task ==="

for i in "${!TASK_IDS[@]}"; do
  TASK_ID="${TASK_IDS[$i]}"
  TASK_TITLE="Marketing Task $((i+1))/30"
  TASK_DESCRIPTION="${TASKS[$i]}"

  # Build the prompt for AI execution
  PROMPT="Bạn là một chuyên gia marketing digital. Hãy thực hiện task marketing sau cho Sol Cafe Coworking (địa chỉ: 181 Trần Quốc Thượng, Cầu Giấy, Hà Nội).

**Task**: $TASK_DESCRIPTION

**Yêu cầu**:
1. Phân tích yêu cầu và tạo ra deliverable hoàn chỉnh
2. Output format: JSON với structure rõ ràng
3. Nội dung phải phù hợp với thị trường Việt Nam 2026
4. Tone: Professional nhưng friendly, suitable cho coworking community
5. Lưu ý: Sol Cafe tọa lạc tại Cầu Giấy - khu vực nhiều startup, freelancer, remote workers

**Context**:
- Target audience: Freelancers, remote workers, startups, SMEs
- Location: 181 Trần Quốc Thượng, Cầu Giấy, HN
- Unique selling points: Không gian sáng tạo, community mạnh, cafe ngon, giá hợp lý
- Brand voice: Friendly, professional, community-focused"

  ATTEMPT_RESPONSE=$(curl -s -X POST "$API_BASE/api/attempts" \
    -H "Content-Type: application/json" \
    -d "{
      \"taskId\": \"$TASK_ID\",
      \"prompt\": \"$PROMPT\",
      \"request_method\": \"queue\",
      \"output_format\": \"json\"
    }")

  ATTEMPT_ID=$(echo $ATTEMPT_RESPONSE | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

  if [ -n "$ATTEMPT_ID" ]; then
    echo "✓ Attempt created for task $((i+1))/30 (Attempt ID: $ATTEMPT_ID)"
  else
    echo "✗ Failed to create attempt for task $((i+1))"
  fi
done

echo ""
echo "=== Summary ==="
echo "Project ID: $PROJECT_ID"
echo "Total tasks created: ${#TASK_IDS[@]}/30"
echo ""
echo "Next steps:"
echo "1. Monitor attempts: curl $API_BASE/api/attempts?projectId=$PROJECT_ID"
echo "2. Check tasks: curl $API_BASE/api/tasks?projectId=$PROJECT_ID"
echo "3. View project: curl $API_BASE/api/projects/$PROJECT_ID"
