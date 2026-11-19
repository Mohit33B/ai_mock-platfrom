from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.authentication import TokenAuthentication
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from rest_framework.authtoken.models import Token
from .models import MockTest, TestResult, TestProgress
import json
import re
from collections import defaultdict

# ================= 1. AUTHENTICATION =================
@api_view(['POST'])
def register_user(request):
    username = str(request.data.get('username', '')).strip()
    password = str(request.data.get('password', '')).strip()
    if not username or not password:
        return Response({"error": "Username and password required!"}, status=400)
    if User.objects.filter(username=username).exists():
        return Response({"error": "Username already taken!"}, status=400)
    user = User.objects.create_user(username=username, password=password)
    token, _ = Token.objects.get_or_create(user=user)
    return Response({"status": "success", "token": token.key})

@api_view(['POST'])
def login_user(request):
    username = str(request.data.get('username', '')).strip()
    password = str(request.data.get('password', '')).strip()
    user = authenticate(username=username, password=password)
    if user:
        token, _ = Token.objects.get_or_create(user=user)
        return Response({"status": "success", "token": token.key})
    return Response({"error": "Invalid Credentials!"}, status=400)

# ================= 2. GET ALL TESTS (DASHBOARD) =================
@api_view(['GET'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def get_all_tests(request):
    tests = MockTest.objects.filter(user=request.user).order_by('-created_at')
    data = []
    for t in tests:
        progress = TestProgress.objects.filter(user=request.user, mock_test=t).first()
        latest_result = TestResult.objects.filter(user=request.user, mock_test=t).order_by('-submitted_at').first()
        
        status = "Not Started"
        if progress:
            if progress.is_completed:
                status = "Completed"
            elif progress.saved_answers or progress.current_question_index > 0:
                status = "Resume"
                
        data.append({
            "id": t.id,
            "title": t.title,
            "exam_category": t.exam_category,
            "test_type": t.test_type,
            "time_limit": t.time_limit,
            "question_count": len(t.questions_data) if isinstance(t.questions_data, list) else 25,
            "attempt_status": status,
            "latest_score": latest_result.score if latest_result else None,
            "latest_accuracy": latest_result.accuracy if latest_result else None
        })
    return Response({"status": "success", "data": data})

# ================= 3. GET SINGLE TEST & PROGRESS =================
@api_view(['GET'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def get_single_test(request, test_id):
    try:
        test = MockTest.objects.get(id=test_id)
        mode = request.GET.get('mode', '').lower() # 'reattempt' resets progress

        progress, _ = TestProgress.objects.get_or_create(
            user=request.user,
            mock_test=test,
            defaults={'time_left_seconds': test.time_limit * 60}
        )

        # Agar user Re-attempt click karta hai, toh progress fresh reset kar do
        if mode == 'reattempt':
            progress.saved_answers = {}
            progress.marked_for_review = {}
            progress.current_question_index = 0
            progress.time_left_seconds = test.time_limit * 60
            progress.is_completed = False
            progress.save()

        # Latest result nikalo taaki scorecard aur analysis direct bhi khul sake
        latest_result = TestResult.objects.filter(user=request.user, mock_test=test).order_by('-submitted_at').first()
        result_payload = None
        if latest_result and progress.is_completed and mode != 'reattempt':
            result_payload = {
                "result_id": latest_result.id,
                "score": latest_result.score,
                "accuracy": latest_result.accuracy,
                "correct": latest_result.correct_count,
                "wrong": latest_result.wrong_count,
                "unattempted": latest_result.unattempted_count,
                "attempt_type": latest_result.attempt_history_type,
                "section_breakdown": latest_result.section_breakdown
            }

        return Response({
            "status": "success",
            "data": {
                "id": test.id,
                "title": test.title,
                "exam_category": test.exam_category,
                "test_type": test.test_type,
                "time_limit": test.time_limit,
                "questions_data": normalize_question_data(test.questions_data),
                "saved_progress": {
                    "saved_answers": progress.saved_answers or {},
                    "marked_for_review": progress.marked_for_review or {},
                    "current_index": progress.current_question_index or 0,
                    "time_left": progress.time_left_seconds if progress.time_left_seconds > 0 else (test.time_limit * 60),
                    "is_completed": progress.is_completed
                },
                "latest_result": result_payload
            }
        })
    except MockTest.DoesNotExist:
        return Response({"error": "Test not found"}, status=404)

# ================= 4. HELPER FUNCTIONS FOR ROBUST PARSING =================
HINDI_JOIN_STOPWORDS = {
    'और', 'का', 'की', 'के', 'को', 'से', 'में', 'पर', 'है', 'हैं',
    'था', 'थे', 'थी', 'तो', 'ही', 'भी', 'या', 'यह', 'वह', 'इस',
    'उस', 'एक', 'न', 'ना', 'कि', 'जो', 'तक', 'जब', 'अब',
}


def normalize_hindi_spacing(text):
    """Joins common OCR-split Hindi fragments without removing normal word spaces."""
    if not isinstance(text, str):
        return text

    text = re.sub(r'(?<![\u0900-\u097f])आर्क[ \t]+टिक(?![\u0900-\u097f])', 'आर्कटिक', text)
    fragment_pattern = re.compile(
        r'(?<![\u0900-\u097f])([\u0915-\u0939][\u093c]?(?:[\u093e-\u094c\u0962\u0963]))([ \t]+)(?=[\u0900-\u097f])'
    )

    def join_fragment(match):
        fragment = match.group(1)
        return fragment + (match.group(2) if fragment in HINDI_JOIN_STOPWORDS else '')

    return fragment_pattern.sub(join_fragment, text)


def normalize_question_data(questions):
    if isinstance(questions, list):
        return [normalize_question_data(question) for question in questions]
    if isinstance(questions, dict):
        return {key: normalize_question_data(value) for key, value in questions.items()}
    if isinstance(questions, str):
        return normalize_hindi_spacing(questions)
    return questions


def extract_clean_text(val):
    """Kisi bhi string ya nested dictionary se clean English/Hindi text nikalta hai"""
    if val is None:
        return ""
    if isinstance(val, (int, float)):
        return str(val)
    if isinstance(val, str):
        return val.strip()
    if isinstance(val, dict):
        eng = str(val.get('english') or val.get('en') or val.get('text') or val.get('value') or '').strip()
        hin = str(val.get('hindi') or val.get('hi') or '').strip()
        if eng and hin and eng != hin:
            return f"{eng} / {hin}"
        elif eng:
            return eng
        elif hin:
            return hin
        parts = [str(v).strip() for v in val.values() if v is not None and str(v).strip()]
        return " / ".join(parts)
    if isinstance(val, list):
        parts = [extract_clean_text(x) for x in val]
        return " ".join([p for p in parts if p])
    return str(val).strip()


def strip_question_noise(raw_text):
    """UI labels like 'Hindi', 'English', and 'Question 11 of 25' ko remove karta hai."""
    if raw_text is None:
        return ""

    text = str(raw_text).replace('\u00a0', ' ').strip()
    if not text:
        return ""

    text = re.sub(r'(?im)^\s*Question\s+\d+\s+of\s+\d+\s*[:\-–—\n]*', '', text)
    for _ in range(5):
        text = re.sub(r'(?im)^\s*(?:Hindi|English)\s*[:\-–—\n]*', '', text)
    text = re.sub(r'(?i)\s+\d{1,4}\s*(?:[\.)])?\s*(?=[A-Za-z\u0900-\u097F])', ' ', text)
    text = re.sub(r'\s+\d{1,4}\s*$', '', text)
    text = re.sub(r'^\s*(?:\d{1,3}\s*[\.)]\s*)+', '', text)
    text = re.sub(r'\s+', ' ', text).strip(' -:;,.()[]{}')
    return normalize_hindi_spacing(text)


def sanitize_question_text(raw_text):
    """Placeholder / generic text ko ignore karta hai jo actual question nahi hota."""
    if raw_text is None:
        return ""

    text = strip_question_noise(raw_text)
    if not text:
        return ""

    generic_markers = [
        'refer to the given options below',
        'see figure/question',
        'option a (see figure/question)',
        'option b (see figure/question)',
        'option c (see figure/question)',
        'option d (see figure/question)',
        'question text unavailable',
    ]

    lower = text.lower()
    if lower in generic_markers:
        return ""
    if lower.startswith('refer to the given options below'):
        return ""
    if 'see figure/question' in lower or 'figure/question' in lower:
        return ""
    if re.search(r'\boption\s*[a-d]\s*\(see figure/question\)\b', lower):
        return ""
    return text


def split_bilingual_text(raw_text):
    """English + Hindi ko ek hi string se alag karta hai agar data mixed form me aaya ho."""
    if raw_text is None:
        return {"english": "", "hindi": ""}

    text = sanitize_question_text(raw_text)
    if not text:
        return {"english": "", "hindi": ""}

    latin_has = bool(re.search(r'[A-Za-z]', text))
    hindi_has = bool(re.search(r'[\u0900-\u097F]', text))
    if not latin_has or not hindi_has:
        return {"english": text, "hindi": ""}

    match = re.search(r'[\u0900-\u097F]', text)
    if not match:
        return {"english": text, "hindi": ""}

    idx = match.start()
    english = text[:idx].strip(" -:;,.()[]{}")
    hindi = text[idx:].strip(" -:;,.()[]{}")
    if english and hindi:
        return {"english": english, "hindi": hindi}
    return {"english": text, "hindi": ""}


def extract_question_text_map(value):
    """Question text ko {english, hindi} me normalize karta hai."""
    if value is None:
        return {"english": "", "hindi": ""}

    if isinstance(value, dict):
        eng = extract_clean_text(
            value.get('english')
            or value.get('en')
            or value.get('text')
            or value.get('value')
            or value.get('question')
            or value.get('statement')
            or value.get('prompt')
            or value.get('question_text')
        )
        hin = extract_clean_text(
            value.get('hindi')
            or value.get('hi')
            or value.get('hn')
            or value.get('question_hindi')
            or value.get('question_hi')
        )
        if eng or hin:
            split = split_bilingual_text(eng) if eng and not hin else {"english": eng, "hindi": hin}
            if split["english"] or split["hindi"]:
                return {
                    "english": split["english"],
                    "hindi": split["hindi"] or hin,
                }
            return {"english": eng, "hindi": hin}

        gathered = []
        for nested in value.values():
            text = extract_clean_text(nested)
            if text:
                gathered.append(text)
        combined = " ".join(gathered)
        split = split_bilingual_text(combined)
        return {"english": split["english"], "hindi": split["hindi"]}

    text = extract_clean_text(value)
    split = split_bilingual_text(text)
    return {"english": split["english"], "hindi": split["hindi"]}


def extract_question_payload(item):
    if not isinstance(item, dict):
        return extract_question_text_map(item)

    english = ""
    hindi = ""

    for key in [
        'question', 'question_text', 'questionStatement', 'statement', 'stem',
        'prompt', 'question_data', 'description', 'content'
    ]:
        if key in item and item[key] is not None:
            payload = extract_question_text_map(item[key])
            if payload['english']:
                english = payload['english']
            if payload['hindi']:
                hindi = payload['hindi']

    for key in ['english', 'en', 'question_english', 'question_en']:
        if key in item and item[key] is not None:
            candidate = sanitize_question_text(item[key])
            if candidate:
                english = candidate or english

    for key in ['hindi', 'hi', 'hn', 'question_hindi', 'question_hi']:
        if key in item and item[key] is not None:
            candidate = sanitize_question_text(item[key])
            if candidate:
                hindi = candidate or hindi

    if not english and not hindi:
        nested_values = []
        for v in item.values():
            text = sanitize_question_text(v)
            if text and not isinstance(v, (dict, list)):
                nested_values.append(text)
        english = " ".join(nested_values)

    english = sanitize_question_text(english) or ""
    hindi = sanitize_question_text(hindi) or ""
    return {"english": english.strip(), "hindi": hindi.strip()}


def normalize_options(raw_options, item_dict):
    """Options ko clean {A, B, C, D} format me normalize karta hai, bina fake placeholders ke."""
    cleaned = {}
    keys_order = ['A', 'B', 'C', 'D', 'E']

    def normalize_key(key):
        k_upper = str(key).strip().upper()
        match = re.fullmatch(r'(?:OPTION|OPT)?\s*[\(\[]?\s*([A-E1-5])\s*[\)\].:]?', k_upper)
        if match:
            label = match.group(1)
            return {'1': 'A', '2': 'B', '3': 'C', '4': 'D', '5': 'E'}.get(label, label)
        return k_upper

    def tidy_option_value(value):
        if value is None:
            return ""
        if isinstance(value, dict):
            normalized_keys = {str(key).lower(): val for key, val in value.items()}
            english = extract_clean_text(
                normalized_keys.get('english') or normalized_keys.get('en')
            )
            english = normalize_hindi_spacing(english)
            hindi = normalize_hindi_spacing(extract_clean_text(
                normalized_keys.get('hindi') or normalized_keys.get('hi') or normalized_keys.get('hn')
            ))
            if english or hindi:
                return {"english": english, "hindi": hindi}
            text_value = normalized_keys.get('text') or normalized_keys.get('value')
            split = split_bilingual_text(text_value)
            if split['english'] or split['hindi']:
                return {
                    "english": split['english'],
                    "hindi": normalize_hindi_spacing(split['hindi']),
                }
            text = extract_clean_text(value)
            return {"english": text, "hindi": ""} if text else ""
        text = extract_clean_text(value)
        if not text or text.lower().startswith('refer to the given options below') or 'see figure/question' in text.lower() or re.search(r'\boption\s*[a-d]\s*\(see figure/question\)\b', text.lower()):
            return ""
        split = split_bilingual_text(text)
        if split['english'] and split['hindi']:
            return {"english": split['english'], "hindi": split['hindi']}
        return split['english'] or split['hindi'] or text

    if isinstance(raw_options, dict) and raw_options:
        for idx, (k, v) in enumerate(raw_options.items()):
            norm_key = normalize_key(k)
            if not norm_key:
                continue
            option_value = tidy_option_value(v)
            if option_value:
                cleaned[norm_key] = option_value
            elif idx < len(keys_order) and norm_key not in cleaned:
                cleaned[norm_key] = ""

    elif isinstance(raw_options, list) and raw_options:
        for idx, v in enumerate(raw_options):
            if idx >= len(keys_order):
                break
            norm_key = keys_order[idx]
            option_value = tidy_option_value(v)
            if option_value:
                cleaned[norm_key] = option_value

    if isinstance(item_dict, dict):
        alt_map = {
            'A': ['option_a', 'opt_a', 'a', 'option1', 'option_1', 'option 1', 'option a', 'opt 1', 'option1_text', 'option_1_text'],
            'B': ['option_b', 'opt_b', 'b', 'option2', 'option_2', 'option 2', 'option b', 'opt 2', 'option2_text', 'option_2_text'],
            'C': ['option_c', 'opt_c', 'c', 'option3', 'option_3', 'option 3', 'option c', 'opt 3', 'option3_text', 'option_3_text'],
            'D': ['option_d', 'opt_d', 'd', 'option4', 'option_4', 'option 4', 'option d', 'opt 4', 'option4_text', 'option_4_text'],
            'E': ['option_e', 'opt_e', 'e', 'option5', 'option_5', 'option 5', 'option e', 'opt 5', 'option5_text', 'option_5_text'],
        }
        source_fields = {str(key).lower(): key for key in item_dict}
        for letter, possible_keys in alt_map.items():
            if letter in cleaned:
                continue
            for pk in possible_keys:
                actual_key = source_fields.get(pk)
                if actual_key is not None and item_dict[actual_key] is not None:
                    text_val = tidy_option_value(item_dict[actual_key])
                    if text_val:
                        cleaned[letter] = text_val
                        break

    cleaned = {k: v for k, v in cleaned.items() if v not in [None, "", {}]}
    return cleaned

def normalize_correct_answer(raw_ans, cleaned_options):
    """Correct answer ko exact 'A', 'B', 'C', ya 'D' me normalize karta hai"""
    ans_str = extract_clean_text(raw_ans).upper()
    if not ans_str:
        return "A"

    num_to_letter = {'1': 'A', '2': 'B', '3': 'C', '4': 'D', '5': 'E'}
    if ans_str in ['A', 'B', 'C', 'D', 'E']:
        return ans_str
    if ans_str in num_to_letter:
        return num_to_letter[ans_str]

    # Match patterns like "Option B", "(C)", "Ans: 2"
    m = re.search(r'\b([A-D1-4])\b', ans_str)
    if m:
        token = m.group(1)
        return num_to_letter.get(token, token)

    # Check if raw_ans matches the text of one of the options
    for k, opt_text in cleaned_options.items():
        if ans_str == str(opt_text).strip().upper():
            return k

    return ans_str[0] if ans_str[0] in ['A', 'B', 'C', 'D'] else "A"

# ================= 5. UPLOAD SECTIONALS (JSON BANK) =================
@api_view(['POST'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def upload_json_bank(request):
    try:
        json_string = request.data.get('json_data', '[]')
        subject = request.data.get('subject', 'English Comprehension')
        exam_category = request.data.get('exam_category', 'SSC CGL Tier-1')
        time_limit = int(request.data.get('time_limit', 15))
        
        json_data = json.loads(json_string)
        if isinstance(json_data, dict):
            json_data = json_data.get('questions') or json_data.get('data') or list(json_data.values())[0]

        shifts_dict = defaultdict(list)
        
        for item in json_data:
            if not isinstance(item, dict):
                continue

            exam_info = item.get('exam_info', {}) if isinstance(item.get('exam_info'), dict) else {}
            raw_date = str(exam_info.get('date') or item.get('date') or '').strip()
            raw_shift = str(exam_info.get('shift') or item.get('shift') or '').strip()
            
            # Strict 2025/2026 date filter (blocks 2011 or invalid dates)
            date_match = re.search(r'\b(\d{1,2}\s+[A-Za-z]+\s+(2025|2026))\b', raw_date)
            if not date_match:
                continue
                
            clean_date = date_match.group(1)
            shift_match = re.search(r'Shift\s*[-:]?\s*(\d+)', raw_shift, re.IGNORECASE)
            clean_shift = f"Shift {shift_match.group(1)}" if shift_match else "Shift 1"
            key = f"{clean_date} - {clean_shift}"
            
            # Extract English & Hindi Question Text Properly
            q_payload = extract_question_payload(item)
            eng_text = sanitize_question_text(q_payload.get('english', '')) or ""
            hin_text = sanitize_question_text(q_payload.get('hindi', '')) or ""

            if not eng_text and not hin_text:
                continue

            # Keep both languages when present; if only one language exists, use that one.
            if not eng_text and hin_text:
                eng_text = hin_text
            if not hin_text and eng_text:
                hin_text = ""

            # Clean Options & Correct Answer
            cleaned_options = normalize_options(item.get('options'), item)
            if not cleaned_options:
                continue
            correct_ans = normalize_correct_answer(item.get('correct_answer') or item.get('answer'), cleaned_options)

            right_pct = exam_info.get('right_percentage', '')
            exp_raw = extract_clean_text(item.get('explanation') or item.get('solution') or '')
            explanation_text = exp_raw if exp_raw else (f"Exam Stats: {right_pct}" if right_pct else f"Correct Answer is Option {correct_ans}.")

            formatted_q = {
                "subject": subject,
                "topic": item.get('topic', 'PYQ'),
                "question": {
                    "english": eng_text,
                    "hindi": hin_text
                },
                "question_text": eng_text or hin_text,
                "options": cleaned_options,
                "correct_answer": correct_ans,
                "explanation": explanation_text
            }
            shifts_dict[key].append(formatted_q)

        # Target question count based on exam rule
        expected_q_count = 25
        if "CGL Tier-2" in exam_category:
            expected_q_count = 30
        elif "Banking" in exam_category:
            expected_q_count = 30

        created_count = 0
        updated_count = 0
        for shift_name, qs in shifts_dict.items():
            # Ensure exact question count per shift (pad from shift pool if 1-2 questions were corrupted in raw JSON)
            final_qs = list(qs[:expected_q_count])
            while len(final_qs) < expected_q_count and len(qs) > 0:
                needed = expected_q_count - len(final_qs)
                final_qs.extend(qs[:needed])

            title = f"{subject} Sectional ({shift_name})"
            existing_mock = MockTest.objects.filter(title=title, exam_category=exam_category, user=request.user).first()
            if existing_mock:
                existing_mock.questions_data = final_qs
                existing_mock.time_limit = time_limit
                existing_mock.save()
                updated_count += 1
            else:
                MockTest.objects.create(
                    user=request.user,
                    title=title,
                    exam_category=exam_category,
                    test_type="PYQ Sectional",
                    time_limit=time_limit,
                    language="Bilingual",
                    questions_data=final_qs
                )
                created_count += 1
                
        return Response({
            "status": "success",
            "message": f"Successfully processed {created_count} new and {updated_count} updated shifts for {subject} ({expected_q_count} Qs each)!"
        })
    except Exception as e:
        return Response({"status": "error", "error": str(e), "message": str(e)}, status=500)

# ================= 6. MERGE SECTIONALS INTO FULL MOCK =================
@api_view(['POST'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def merge_to_full_mock(request):
    try:
        exam_category = request.data.get('exam_category', 'SSC CGL Tier-1')
        user = request.user
        
        sectionals = MockTest.objects.filter(user=user, exam_category=exam_category, test_type__icontains="Sectional")
        if not sectionals.exists():
            return Response({"status": "error", "error": "No sectional mocks found for this exam! Upload sectionals first.", "message": "No sectional mocks found!"}, status=400)

        shifts_map = defaultdict(list)
        for s in sectionals:
            match = re.search(r'\((.*?)\)', s.title)
            shift_key = match.group(1) if match else "General Shift"
            if isinstance(s.questions_data, list):
                shifts_map[shift_key].extend(s.questions_data)

        created_full_count = 0
        updated_full_count = 0
        for shift_name, all_qs in shifts_map.items():
            full_title = f"{exam_category} Full Mock ({shift_name})"
            existing_full = MockTest.objects.filter(user=user, title=full_title, exam_category=exam_category).first()
            if existing_full:
                existing_full.questions_data = all_qs
                existing_full.time_limit = 60
                existing_full.save()
                updated_full_count += 1
            else:
                MockTest.objects.create(
                    user=user,
                    title=full_title,
                    exam_category=exam_category,
                    test_type="PYQ Full Mock",
                    time_limit=60,
                    language="Bilingual",
                    questions_data=all_qs
                )
                created_full_count += 1

        return Response({
            "status": "success",
            "message": f"Successfully created {created_full_count} Full Mocks (and updated {updated_full_count}) for {exam_category}!"
        })
    except Exception as e:
        return Response({"status": "error", "error": str(e), "message": str(e)}, status=500)

# ================= 7. LIVE AUTO-SAVE PROGRESS =================
@api_view(['POST'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def auto_save_progress(request, test_id):
    try:
        test = MockTest.objects.get(id=test_id)
        answers = request.data.get('answers', {})
        marked = request.data.get('marked', {})
        current_idx = int(request.data.get('current_index', 0))
        time_left = int(request.data.get('time_left', test.time_limit * 60))

        progress, _ = TestProgress.objects.get_or_create(user=request.user, mock_test=test)
        progress.saved_answers = answers
        progress.marked_for_review = marked
        progress.current_question_index = current_idx
        progress.time_left_seconds = time_left
        progress.is_completed = False
        progress.save()

        return Response({"status": "success", "message": "Progress auto-saved"})
    except Exception as e:
        return Response({"error": str(e)}, status=500)

# ================= 8. SUBMIT TEST & DETAILED SCORECARD =================
@api_view(['POST'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def submit_test(request, test_id):
    try:
        mock_test = MockTest.objects.get(id=test_id)
        user_answers = request.data.get('answers', {})
        is_reattempt = request.data.get('is_reattempt', False)
        questions = mock_test.questions_data if isinstance(mock_test.questions_data, list) else []
        
        correct, wrong, unattempted = 0, 0, 0
        section_stats = defaultdict(lambda: {"correct": 0, "wrong": 0, "unattempted": 0, "total": 0, "score": 0.0})

        for idx, q in enumerate(questions):
            sub = q.get('subject', 'General')
            section_stats[sub]["total"] += 1
            
            raw_user_ans = user_answers.get(str(idx)) if str(idx) in user_answers else user_answers.get(idx, "")
            ans = str(raw_user_ans or "").strip().upper()
            correct_ans = str(q.get('correct_answer', '')).strip().upper()
            
            if not ans:
                unattempted += 1
                section_stats[sub]["unattempted"] += 1
            elif ans == correct_ans:
                correct += 1
                section_stats[sub]["correct"] += 1
                section_stats[sub]["score"] += 2.0
            else:
                wrong += 1
                section_stats[sub]["wrong"] += 1
                section_stats[sub]["score"] -= 0.5

        score = round((correct * 2.0) - (wrong * 0.5), 2)
        total_attempted = correct + wrong
        accuracy = round((correct / total_attempted * 100), 2) if total_attempted > 0 else 0.0

        existing_attempts = TestResult.objects.filter(user=request.user, mock_test=mock_test).count()
        attempt_type = "Re-attempt" if (existing_attempts > 0 or is_reattempt) else "1st Attempt"

        result = TestResult.objects.create(
            user=request.user,
            mock_test=mock_test,
            score=score,
            accuracy=accuracy,
            correct_count=correct,
            wrong_count=wrong,
            unattempted_count=unattempted,
            section_breakdown=dict(section_stats),
            attempt_history_type=attempt_type
        )

        # Save final answers in progress and mark completed
        progress, _ = TestProgress.objects.get_or_create(user=request.user, mock_test=mock_test)
        progress.saved_answers = user_answers
        progress.is_completed = True
        progress.save()

        return Response({
            "status": "success",
            "data": {
                "result_id": result.id,
                "score": result.score,
                "accuracy": result.accuracy,
                "correct": correct,
                "wrong": wrong,
                "unattempted": unattempted,
                "attempt_type": attempt_type,
                "section_breakdown": result.section_breakdown
            }
        })
    except Exception as e:
        return Response({"error": str(e)}, status=500)