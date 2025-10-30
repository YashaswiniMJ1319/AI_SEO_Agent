import uvicorn
import os
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from bs4 import BeautifulSoup, Tag
import google.generativeai as genai
from dotenv import load_dotenv
import re
from typing import Optional, Any
import json
from urllib.parse import urlparse
from jose import JWTError, jwt
from fastapi import Request
from db import get_db_connection 
from datetime import datetime
import psycopg2
from fastapi.middleware.cors import CORSMiddleware


# Note: db.py is not included, so database-related code (log_behavior) is commented out.

# --- Load environment variables ---
load_dotenv()
GEMINI_API_KEY = os.getenv("GOOGLE_API_KEY")
JWT_SECRET = os.getenv("JWT_SECRET") or "super_secret_jwt_key"
ALGORITHM = "HS256"

# --- AI Model Initialization ---
ai_model_flash = None # Use Flash for all calls
ai_model_pro = None # Will be aliased to flash to prevent 404s

if not GEMINI_API_KEY:
    print("❌ Error: GOOGLE_API_KEY not found. Please check your .env file. AI functions will be disabled.")
else:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        # Use the model that is known to work (even if quota is hit)
        ai_model_flash = genai.GenerativeModel('models/gemini-flash-latest') 
        ai_model_pro = genai.GenerativeModel('models/gemini-flash-latest') # Fallback Pro to Flash to fix 404
        print("✅ Google Generative AI configured successfully (using gemini-flash-latest for all models).")
    except Exception as e:
        print(f"❌ Error configuring Google Generative AI: {e}. AI functions will be disabled.")
        ai_model_flash = None
        ai_model_pro = None

if not JWT_SECRET or JWT_SECRET == "super_secret_jwt_key":
    print("⚠️ Warning: JWT_SECRET is using the default value or is not set in .env.")


# --- MODULE 1: API Models ---

class SeoRequest(BaseModel):
    content: str
    contentType: str
    config: Optional[dict] = {}

class Issue(BaseModel):
    type: str
    message: str
    line: Optional[int] = None

class Suggestion(BaseModel):
    type: str
    message: str
    content: str
    explanation: Optional[str] = None
    context: Optional[str] = None
    potential_score_gain: Optional[int] = None

class SemanticAnalysis(BaseModel):
    relevance_score: int
    justification: str

class KeywordAnalysis(BaseModel):
    targetKeyword: str
    foundInTitle: bool
    foundInMeta: bool
    foundInH1: bool
    bodyCount: int
    density: float

class WritingAssistance(BaseModel):
    suggestions: list[str] = []
    conclusion: Optional[str] = None

class LinkSuggestion(BaseModel):
    anchor_text: str
    suggested_topic: str

class LinkAnalysis(BaseModel):
    internal_link_count: int
    external_link_count: int
    external_domains: list[str]
    ai_suggestions: list[LinkSuggestion] = []

class CompetitorInfo(BaseModel):
    link: str
    description: str
    seoScore: int

class CompetitorAnalysis(BaseModel):
    competitors: list[CompetitorInfo]

class SeoResponse(BaseModel):
    seoScore: int
    issues: list[Issue]
    suggestions: list[Suggestion]
    keywordAnalysis: Optional[KeywordAnalysis] = None
    semanticAnalysis: Optional[SemanticAnalysis] = None
    writingAssistance: Optional[WritingAssistance] = None
    linkAnalysis: Optional[LinkAnalysis] = None
    appliedHtml: Optional[str] = None
    competitorAnalysis: Optional[CompetitorAnalysis] = None

class UserBehaviorMetrics(BaseModel):
    average_scroll_depth_percent: Optional[float] = None
    average_time_on_page_seconds: Optional[int] = None

class BehaviorAnalysisRequest(BaseModel):
    page_url: str
    page_content_html: str
    behavior_metrics: UserBehaviorMetrics

class BehaviorSuggestion(BaseModel):
    suggestion_type: str
    message: str
    justification: str
    suggested_rewrite: Optional[str] = None
    target_element_hint: Optional[str] = None

class BehaviorAnalysisResponse(BaseModel):
    summary: str
    suggestions: list[BehaviorSuggestion]

class TokenData(BaseModel):
    userId: Optional[str] = None
    email: Optional[str] = None


# --- MODULE 3: AI Engine ---

async def safe_gemini_call(client, prompt, task_name="unknown") -> dict[str, Any] | list[Any]:
    """
    Safely call Gemini model and handle empty or invalid JSON responses.
    """
    if not client:
        print(f"❌ AI Error during {task_name}: AI client is not initialized (check API key).")
        return {"error": "AI client not initialized"}
        
    try:
        response = await client.generate_content_async(prompt)
        raw_text = (response.text or "").strip()

        if not raw_text:
            print(f"⚠️ Empty response from AI for {task_name}.")
            return {"error": "empty response"}

        raw_text = re.sub(r"^\s*```json\s*", "", raw_text, flags=re.MULTILINE)
        raw_text = re.sub(r"\s*```\s*$", "", raw_text, flags=re.MULTILINE)
        raw_text = raw_text.strip()

        try:
            parsed = json.loads(raw_text)
            return parsed
        except json.JSONDecodeError as e:
            print(f"⚠️ Non-JSON output from AI ({task_name}):", raw_text)
            print(f"JSONDecodeError: {e}")
            # Fallback for meta/alt text if AI doesn't return JSON
            if task_name == "meta_description" or task_name.startswith("alt_text:"):
                 return {"suggestion": raw_text, "explanation": "AI generated (non-JSON response)."}
            return {"error": "invalid json", "raw_output": raw_text}

    except Exception as e:
        if "429" in str(e) and "quota" in str(e):
            print(f"❌ AI Quota Error during {task_name}: You have exceeded your API quota.")
            return {"error": "API quota exceeded. Please check your plan and billing."}
        print(f"❌ AI Error during {task_name}:", str(e))
        return {"error": str(e)}

def get_page_text(soup: BeautifulSoup) -> str:
    for script_or_style in soup(["script", "style"]):
        script_or_style.decompose()
    text = soup.get_text(separator=' ', strip=True)
    return re.sub(r'\s+', ' ', text)

async def generate_meta_description(page_text: str) -> Optional[dict[str, str]]:
    """Generates an SEO-optimized meta description and a brief explanation."""
    print("AI: Generating meta description...")
    prompt = f"""
    You are an expert SEO copywriter.
    Based on the following webpage text, generate an optimized meta description under 160 characters.
    It must be in active voice and encourage clicks.
    The response MUST be production-ready code/text, containing NO markdown, extra quotes, or trailing spaces in the 'suggestion' field.

    Webpage Text:
    "{page_text[:2000]}"

    Respond ONLY in JSON format with two keys:
    1. "suggestion": The suggested meta description text.
    2. "explanation": A brief (1-2 sentence) explanation of why this suggestion is effective (e.g., keyword use, call to action).
    Example Response: {{"suggestion": "Your compelling meta description here.", "explanation": "Includes target keywords and encourages clicks."}}
    """
    result = await safe_gemini_call(ai_model_flash, prompt, task_name="meta_description")

    if isinstance(result, dict) and "suggestion" in result and "error" not in result:
        result['suggestion'] = str(result.get('suggestion', '')).strip().strip('"').strip()
        result['explanation'] = str(result.get('explanation', 'AI generated suggestion.')).strip()
        print("AI: Meta description generated.")
        return result
    else:
        print(f"AI Error (meta_description): Invalid response struct or error: {result}")
        return None

async def generate_alt_text(image_src: str, page_text: str) -> Optional[dict[str, str]]:
    """Generates an SEO-optimized alt text and a brief explanation."""
    print(f"AI: Generating alt text for: {image_src[:60]}...")
    filename = image_src.split('/')[-1].split('?')[0] if image_src else 'unknown'
    filename_hint = filename.replace('-', ' ').replace('_', ' ').rsplit('.', 1)[0] if filename != 'unknown' else 'image'

    prompt = f"""
    You are an expert SEO copywriter and image optimization specialist.
    Generate a concise, descriptive, and keyword-rich alt text for the given image, suitable for SEO and accessibility.
    The response MUST be production-ready code/text, containing NO markdown, extra quotes, or trailing spaces in the 'suggestion' field.
    Avoid generic phrases like "image of".

    Image filename hint: "{filename_hint}"
    Surrounding page text: "{page_text[:1500]}"

    Respond ONLY in JSON format with two keys:
    1. "suggestion": The suggested alt text.
    2. "explanation": A brief (1 sentence) explanation (e.g., "Describes the image and includes relevant terms").
    Example Response: {{"suggestion": "Detailed alt text here.", "explanation": "Clearly describes the image content for accessibility and search engines."}}
    """
    result = await safe_gemini_call(ai_model_flash, prompt, task_name=f"alt_text:{filename_hint}")
    
    if isinstance(result, dict) and "suggestion" in result and "error" not in result:
        result['suggestion'] = str(result.get('suggestion', '')).strip().strip('"').strip()
        result['explanation'] = str(result.get('explanation', 'AI generated suggestion.')).strip()
        print(f"AI: Alt text generated for {image_src[:60]}.")
        return result
    else:
        print(f"AI Error (alt_text): Invalid response struct or error: {result}")
        return None

async def analyze_semantic_relevance(page_text: str, target_keyword: str) -> SemanticAnalysis | None:
    if not ai_model_pro: return None
    print(f"AI: Analyzing semantic relevance for keyword: '{target_keyword}'")
    text_snippet = page_text[:4000]
    prompt = f"""
    Analyze the following text for semantic relevance to the keyword '{target_keyword}'.
    Provide a relevance score from 0 to 100 and a brief justification (1-2 sentences).
    Respond ONLY with a valid JSON object: {{"relevance_score": <int>, "justification": "..."}}
    Text: "{text_snippet}"
    """
    result = await safe_gemini_call(ai_model_pro, prompt, task_name="semantic_relevance")

    try:
        if isinstance(result, dict) and isinstance(result.get("relevance_score"), int) and isinstance(result.get("justification"), str):
            print(f"AI: Semantic relevance score: {result.get('relevance_score')}")
            return SemanticAnalysis(**result)
        else:
            print(f"AI Error (semantic_relevance): Invalid JSON structure: {result}")
            return None
    except Exception as e:
        print(f"AI Error (semantic_relevance parsing): {e}")
        return None

async def suggest_content_improvements(page_text: str) -> WritingAssistance | None:
    if not ai_model_pro: return WritingAssistance(suggestions=[], conclusion=None)
    print("AI: Analyzing content flow and conclusion...")
    text_snippet = page_text[:8000]
    prompt = f"""
    Act as an expert content editor. Analyze the text for structure, flow, and engagement.
    Provide 2-3 actionable suggestions to improve the text.
    Also, if the conclusion is weak or missing, write a short replacement.
    If it's strong, set the conclusion field to null.
    Respond ONLY with a valid JSON object:
    {{
        "suggestions": ["..."],
        "conclusion": "..." or null
    }}
    Text: "{text_snippet}"
    """
    result = await safe_gemini_call(ai_model_pro, prompt, task_name="content_improvements")

    try:
        if isinstance(result, dict) and "suggestions" in result:
             # Use model_validate for Pydantic v2, parse_obj for v1
             # return WritingAssistance.model_validate(result) 
             return WritingAssistance.parse_obj(result)
        else:
            print(f"⚠️ Invalid AI result for content improvements: {result}")
            return WritingAssistance(suggestions=[], conclusion=None)
    except Exception as e:
        print(f"❌ AI Error (content_improvements parsing): {e}")
        return WritingAssistance(suggestions=[], conclusion=None)

async def suggest_internal_links(page_text: str, target_keyword: Optional[str]) -> list[LinkSuggestion]:
    if not ai_model_pro: return []
    print(f"AI: Suggesting internal links for '{target_keyword}'...")
    text_snippet = page_text[:4000]
    prompt = f"""
    Read the text about '{target_keyword}'. Identify 1-2 phrases suitable for internal links.
    For each, suggest a related topic for the link to point to.
    Respond ONLY with a valid JSON array of objects: [{{"anchor_text": "...", "suggested_topic": "..."}}]. If none, return an empty array.
    Text: "{text_snippet}"
    """
    try:
        result = await safe_gemini_call(ai_model_pro, prompt, task_name="internal_links")

        if isinstance(result, list):
            try:
                valid_suggestions = []
                for s in result:
                    if isinstance(s, dict) and 'anchor_text' in s and 'suggested_topic' in s:
                         valid_suggestions.append(LinkSuggestion.parse_obj(s)) # Pydantic v1
                return valid_suggestions
            except Exception as e:
                print(f"⚠️ Parsing Warning (internal_links): {e}")
                return []
        else:
            print(f"⚠️ Invalid result for internal_links: {result}")
            return []
    except Exception as e:
        print(f"❌ AI Error (internal_links): {e}")
        return []

async def analyze_competitors(target_keyword: str) -> CompetitorAnalysis | None:
    if not ai_model_pro: return CompetitorAnalysis(competitors=[])
    print(f"AI: Analyzing competitors for '{target_keyword}'...")
    prompt = f"""
    Act as an expert SEO analyst. Perform a web search for the top 5 ranking organic results for the keyword: "{target_keyword}".
    For each result, provide the full URL, a one-sentence analysis of why it likely ranks well, and an estimated SEO Score from 0-100.
    If you cannot find verifiable, real competitors, return an empty array for the "competitors" key.
    Respond ONLY with a valid JSON object.
    Example:
    {{
      "competitors": [
        {{"link": "https://www.real-website.com/article", "description": "This page is comprehensive.", "seoScore": 88}}
      ]
    }}
    """
    try:
        result = await safe_gemini_call(ai_model_pro, prompt, task_name="competitor_analysis")

        if isinstance(result, dict) and "competitors" in result:
            try:
                validated = [CompetitorInfo(**item) for item in result["competitors"]]
                return CompetitorAnalysis(competitors=validated)
            except Exception as e:
                print(f"⚠️ Parsing Warning (competitor_analysis): {e}")
                return CompetitorAnalysis(competitors=[])
        else:
            print(f"⚠️ Invalid AI result for competitor_analysis: {result}")
            return CompetitorAnalysis(competitors=[])
    except Exception as e:
        print(f"❌ AI Error (Competitor Analysis): {e}")
        return CompetitorAnalysis(competitors=[])

async def get_behavioral_insights(page_content_html: str, behavior_data: UserBehaviorMetrics) -> BehaviorAnalysisResponse | None:
    if not ai_model_pro:
        print("AI Error: Gemini model not initialized. Skipping behavior analysis.")
        return BehaviorAnalysisResponse(summary="AI model not initialized.", suggestions=[])

    print(f"AI: Analyzing user behavior... Scroll: {behavior_data.average_scroll_depth_percent}%, Time: {behavior_data.average_time_on_page_seconds}s")
    page_text = ""
    try:
        soup = BeautifulSoup(page_content_html, 'html.parser')
        page_text = get_page_text(soup)[:8000] # Truncate
    except Exception as e:
        print(f"Error parsing HTML for behavior analysis: {e}")
        page_text = "(Could not parse HTML content)"

    prompt = f"""
    Analyze user behavior metrics in context of the webpage text.
    Metrics: Avg Scroll: {behavior_data.average_scroll_depth_percent:.1f}%, Avg Time: {behavior_data.average_time_on_page_seconds}s
    Content: "{page_text}"
    Task: Provide a 1-2 sentence "summary" interpreting engagement, and 2-3 "suggestions" to improve content based on the data.
    Respond ONLY with a valid JSON object:
    {{
        "summary": "...",
        "suggestions": [
            {{
                "suggestion_type": "...", "message": "...", "justification": "...",
                "suggested_rewrite": "..." or null, "target_element_hint": "..."
            }}
        ]
    }}
    """
    try:
        result = await safe_gemini_call(ai_model_pro, prompt, task_name="behavior_insights")

        if isinstance(result, dict) and "summary" in result and "suggestions" in result:
            print("AI: Behavior analysis successful.")
            return BehaviorAnalysisResponse.parse_obj(result) # Pydantic v1
        else:
            print(f"AI Error (behavior_insights): Invalid JSON structure: {result}")
            return None
    except Exception as e:
        print(f"AI Error (behavior_insights): {e}")
        return None

def create_slug(text: str) -> str:
    text = text.lower()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[-\s]+', '-', text).strip('-')
    return f"/blog/{text}" # Simple slug

def apply_all_suggestions(soup: BeautifulSoup, suggestions_list: list[Suggestion], writing_report: Optional[WritingAssistance], link_report: Optional[LinkAnalysis]) -> str:
    # This function modifies the 'soup' object in-place
    try:
        if soup.body and writing_report and writing_report.conclusion:
            soup.body.append(BeautifulSoup(f"<p>{writing_report.conclusion}</p>", 'html.parser'))
        
        meta_sugg = next((s for s in suggestions_list if s.type == 'ai_meta'), None)
        if meta_sugg and soup.head:
            meta_tag = soup.find('meta', attrs={'name': 'description'})
            if meta_tag: meta_tag['content'] = meta_sugg.content
            else: soup.head.append(soup.new_tag('meta', attrs={'name': 'description', 'content': meta_sugg.content}))
        
        alt_suggs = (s for s in suggestions_list if s.type == 'ai_alt_text' and s.context)
        for sugg in alt_suggs:
            img_tag = soup.find('img', src=sugg.context)
            if img_tag:
                img_tag['alt'] = sugg.content

        if link_report and link_report.ai_suggestions:
            for link_sugg in link_report.ai_suggestions:
                text_node = soup.find(string=re.compile(re.escape(link_sugg.anchor_text), re.IGNORECASE))
                if text_node and text_node.parent and text_node.parent.name != 'a':
                    try:
                        new_link = soup.new_tag("a", href=create_slug(link_sugg.suggested_topic))
                        new_text = text_node.string.replace(link_sugg.anchor_text, "", 1)
                        new_link.string = link_sugg.anchor_text
                        text_node.replace_with(new_link)
                        if new_text:
                            new_link.insert_after(new_text)
                    except Exception as e:
                        print(f"Error applying link suggestion: {e}")
        return soup.prettify()
    except Exception as e:
        print(f"Error in apply_all_suggestions: {e}")
        return str(soup)

# --- MODULE 4: Keyword Engine ---
def perform_keyword_analysis(
    target_keyword: str, page_text: str, title_tag: Optional[Tag],
    meta_tag: Optional[Tag], h1_tags: list[Tag]
) -> KeywordAnalysis:
    keyword_lower = target_keyword.lower()
    text_lower = page_text.lower()
    title_text = (title_tag.string or '') if title_tag else ''
    meta_text = (meta_tag.get('content', '') or '') if meta_tag else ''
    h1_text = ' '.join([h1.get_text(strip=True) for h1 in h1_tags])
    
    total_words = len(text_lower.split())
    body_count = text_lower.count(keyword_lower)
    density = (body_count / total_words * 100) if total_words > 0 else 0
    
    return KeywordAnalysis(
        targetKeyword=target_keyword,
        foundInTitle=keyword_lower in title_text.lower(),
        foundInMeta=keyword_lower in meta_text.lower(),
        foundInH1=keyword_lower in h1_text.lower(),
        bodyCount=body_count,
        density=round(density, 2)
    )

# --- Security Dependency ---
auth_scheme = HTTPBearer()
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(auth_scheme)) -> TokenData:
    token = credentials.credentials
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        email: Optional[str] = payload.get("email")
        if email is None:
            print("JWTError: Token payload missing 'email'")
            raise credentials_exception
        token_data = TokenData(userId=payload.get("userId"), email=email)
    except JWTError:
        print("JWTError: Token could not be validated")
        raise credentials_exception
    return token_data

# --- FastAPI App Initialization ---
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # or specify your frontend origins e.g. ["https://your-site.com"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- MODULE 2: Endpoints ---

# Commented out DB logging as db.py is not present
# @app.post("/api/behavior")
# async def log_behavior(request: Request):
#    ...

# --- Live User Behavior Logging (NeonDB Integration) ---

@app.post("/api/behavior")
async def log_behavior(request: Request):
    """
    Collects user behavior metrics sent from the front-end plugin when users
    visit or leave a page. Stores time spent, scroll depth, etc. in NeonDB.
    """
    try:
        data = await request.json()
        conn = get_db_connection()
        cur = conn.cursor()

        # ✅ Ensure table exists
        cur.execute("""
            CREATE TABLE IF NOT EXISTS behavior_logs (
                id SERIAL PRIMARY KEY,
                page_url TEXT,
                time_spent_seconds INT,
                scroll_depth_percent INT,
                timestamp TIMESTAMP DEFAULT NOW(),
                user_agent TEXT
            );
        """)
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_behavior_page_url 
            ON behavior_logs(page_url);
        """)

        # ✅ Extract and safely parse timestamp
        timestamp_str = data.get("timestamp", "")
        try:
            parsed_timestamp = datetime.fromisoformat(timestamp_str.replace("Z", "").replace("T", " "))
        except Exception:
            parsed_timestamp = datetime.utcnow()

        # ✅ Insert into table
        cur.execute("""
            INSERT INTO behavior_logs (page_url, time_spent_seconds, scroll_depth_percent, timestamp, user_agent)
            VALUES (%s, %s, %s, %s, %s)
        """, (
            data.get("page_url"),
            data.get("time_spent_seconds"),
            data.get("scroll_depth_percent"),
            parsed_timestamp,
            data.get("user_agent")
        ))

        conn.commit()
        print(f"✅ Logged behavior for {data.get('page_url')}")
        return {"status": "ok"}

    except Exception as e:
        if 'conn' in locals():
            conn.rollback()
        print(f"❌ Behavior logging failed: {e}")
        return {"error": str(e)}

    finally:
        if 'cur' in locals():
            cur.close()
        if 'conn' in locals():
            conn.close()



@app.get("/api/behavior-insights")
def get_behavior_summary():
    """
    Returns overall engagement insights from recent logs.
    Useful for dashboard analytics or AI fine-tuning.
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT COUNT(*), AVG(time_spent_seconds), AVG(scroll_depth_percent)
            FROM behavior_logs
        """)
        total, avg_time, avg_scroll = cur.fetchone()
        cur.close()
        conn.close()

        return {
            "total_records": total or 0,
            "avg_time_spent": round(avg_time or 0, 2),
            "avg_scroll_depth": round(avg_scroll or 0, 2)
        }
    except Exception as e:
        print(f"⚠️ Behavior summary error: {e}")
        return {"error": str(e)}


@app.post("/analyze", response_model=SeoResponse)
async def analyze_seo(request: SeoRequest): # Auth is disabled for MVP
    print("Received SEO analysis request...")
    issues: list[Issue] = []
    suggestions: list[Suggestion] = []
    seo_score = 100
    
    # Define penalties
    missing_title_penalty = 10
    missing_meta_penalty = 10
    missing_h1_penalty = 10
    missing_alt_penalty = 5 # Per image
    heading_skip_penalty = 5 # Per skip
    
    try:
        soup = BeautifulSoup(request.content, 'html.parser')
        page_text = get_page_text(soup)
        target_keyword = request.config.get('targetKeyword')
        
        writing_report = await suggest_content_improvements(page_text)
        
        title_tag = soup.find('title')
        if not title_tag or not title_tag.string:
            issues.append(Issue(type='error', message='Missing <title> tag.'))
            seo_score -= missing_title_penalty
        elif len(title_tag.string) > 60:
             issues.append(Issue(type='warning', message='Title is too long. Aim for under 60 characters.'))
             seo_score -= 3

        meta_tag = soup.find('meta', attrs={'name': 'description'})
        if not meta_tag or not meta_tag.get('content'):
            issues.append(Issue(type='error', message='Missing <meta name="description"> tag.'))
            seo_score -= missing_meta_penalty
            ai_meta_data = await generate_meta_description(page_text)
            if ai_meta_data and 'suggestion' in ai_meta_data:
                suggestions.append(Suggestion(
                    type='ai_meta', 
                    message='AI-generated meta description:', 
                    content=ai_meta_data['suggestion'],
                    explanation=ai_meta_data.get('explanation'),
                    potential_score_gain=missing_meta_penalty
                ))
        elif meta_tag and len(meta_tag.get('content', '')) > 160:
            issues.append(Issue(type='warning', message='Meta description is too long. Aim for under 160 characters.'))
            seo_score -= 3
        
        h1_tags = soup.find_all('h1')
        if not h1_tags:
            issues.append(Issue(type='error', message='Missing <h1> tag.'))
            seo_score -= missing_h1_penalty
        elif len(h1_tags) > 1:
            issues.append(Issue(type='warning', message=f'Found {len(h1_tags)} <h1> tags. A page should only have one.'))
            seo_score -= (len(h1_tags) - 1) * 2
            
        images = soup.find_all('img')
        for img in images:
            img_src = img.get('src', 'unknown') # Get src for context
            if not img.get('alt'):
                issues.append(Issue(type='warning', message=f"Image is missing alt text (src: {img_src[:50]}...)."))
                seo_score -= missing_alt_penalty
                ai_alt_data = await generate_alt_text(img_src, page_text)
                if ai_alt_data and 'suggestion' in ai_alt_data:
                    suggestions.append(Suggestion(
                        type='ai_alt_text', 
                        message=f'AI-generated alt text for "{img_src[:50]}...":', 
                        content=ai_alt_data['suggestion'],
                        explanation=ai_alt_data.get('explanation'),
                        potential_score_gain=missing_alt_penalty,
                        context=img_src # Pass the src as context
                    ))

        links = soup.find_all('a')
        internal_links = [l.get('href') for l in links if l.get('href') and not l.get('href').startswith('http') and not l.get('href').startswith('mailto:')]
        external_links = [l.get('href') for l in links if l.get('href') and l.get('href').startswith('http')]
        external_domains = {urlparse(href).netloc for href in external_links if urlparse(href).netloc and urlparse(href).netloc != ''} # Added empty check

        if not internal_links:
            issues.append(Issue(type='warning', message='No internal links found. Internal links help SEO.'))
            seo_score -= 2
        if not external_links:
            issues.append(Issue(type='info', message='No external links found. Linking to reputable external sources can be beneficial.'))

        headings = soup.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])
        last_level = 0
        for h in headings:
            try:
                current_level = int(h.name[1])
                if current_level > last_level + 1:
                    issues.append(Issue(type='warning', message=f"Heading hierarchy skip: <{h.name}> found after <h{last_level}>. Use <h{last_level + 1}> first."))
                    seo_score -= heading_skip_penalty
                last_level = current_level
            except (IndexError, ValueError):
                print(f"Warning: Could not parse heading level from tag name: {h.name}")

        keyword_report = None
        semantic_report = None
        ai_link_suggestions = []
        competitor_report = None
        if target_keyword:
            keyword_report = perform_keyword_analysis(target_keyword, page_text, title_tag, meta_tag, h1_tags)
            semantic_report = await analyze_semantic_relevance(page_text, target_keyword)
            ai_link_suggestions = await suggest_internal_links(page_text, target_keyword)
            competitor_report = await analyze_competitors(target_keyword)

            if competitor_report and competitor_report.competitors:
                print("Sorting competitors by SEO score...")
                competitor_report.competitors.sort(key=lambda c: c.seoScore, reverse=True)
            
            if semantic_report:
                if semantic_report.relevance_score < 40:
                    issues.append(Issue(type='warning', message=f"Content relevance to '{target_keyword}' is low."))
                    seo_score -= 10
                elif semantic_report.relevance_score > 80:
                    seo_score += 5
            
            if keyword_report and not keyword_report.foundInTitle:
                 issues.append(Issue(type='info', message=f"Target keyword '{target_keyword}' not found in <title>."))
                 seo_score -= 3
            if keyword_report and not keyword_report.foundInH1:
                 issues.append(Issue(type='info', message=f"Target keyword '{target_keyword}' not found in <h1>."))
                 seo_score -= 3


        link_report = LinkAnalysis(
            internal_link_count=len(internal_links),
            external_link_count=len(external_links),
            external_domains=list(external_domains),
            ai_suggestions=ai_link_suggestions
        )

        applied_html = apply_all_suggestions(soup, suggestions, writing_report, link_report)
        
        
    except Exception as e:
        print(f"Error during analysis: {e}")
        import traceback
        traceback.print_exc() # Print full traceback
        raise HTTPException(status_code=500, detail=f"An error occurred during SEO analysis: {e}")

    final_score = max(0, min(100, seo_score)) # Clamp score
        # --- Save AI suggestions into the database (only if not local) ---
    try:
        current_host = os.getenv("DEPLOYMENT_HOST", "")
        if not ("localhost" in current_host or "127.0.0.1" in current_host):
            conn = get_db_connection()
            cur = conn.cursor()

            cur.execute("""
                CREATE TABLE IF NOT EXISTS suggestions (
                    id SERIAL PRIMARY KEY,
                    page_url TEXT,
                    suggestion_type TEXT,
                    message TEXT,
                    content TEXT,
                    explanation TEXT,
                    potential_score_gain INT,
                    created_at TIMESTAMP DEFAULT NOW()
                );
            """)

            for s in suggestions:
                cur.execute("""
                    INSERT INTO suggestions (page_url, suggestion_type, message, content, explanation, potential_score_gain)
                    VALUES (%s, %s, %s, %s, %s, %s)
                """, (
                    request.config.get("page_url", "unknown"),
                    s.type,
                    s.message,
                    s.content,
                    s.explanation,
                    s.potential_score_gain
                ))

            conn.commit()
            print(f"💾 Saved {len(suggestions)} suggestions to DB.")
    except Exception as e:
        if 'conn' in locals():
            conn.rollback()
        print(f"⚠️ Failed to save suggestions: {e}")
    finally:
        if 'cur' in locals():
            cur.close()
        if 'conn' in locals():
            conn.close()

    return SeoResponse(
        seoScore=final_score,
        issues=issues,
        suggestions=suggestions,
        keywordAnalysis=keyword_report,
        semanticAnalysis=semantic_report,
        writingAssistance=writing_report,
        linkAnalysis=link_report,
        appliedHtml=applied_html,
        competitorAnalysis=competitor_report
        
    )

@app.post("/analyze-behavior", response_model=BehaviorAnalysisResponse)
async def analyze_behavior_endpoint(request: BehaviorAnalysisRequest):
    print(f"Received behavior analysis for URL: {request.page_url}")

    # Skip AI behavior analysis for local/staging
    current_host = os.getenv("DEPLOYMENT_HOST", "")
    if "localhost" in current_host or "127.0.0.1" in current_host:
        return BehaviorAnalysisResponse(
            summary="Behavior analysis is only active on live sites.",
            suggestions=[]
        )

    if not request.page_content_html or not request.behavior_metrics:
        raise HTTPException(status_code=400, detail="Missing page content or behavior metrics")

    try:
        analysis_result = await get_behavioral_insights(
            request.page_content_html,
            request.behavior_metrics
        )
        if not analysis_result:
            raise HTTPException(status_code=500, detail="AI failed to generate behavioral insights.")
        return analysis_result
    except Exception as e:
        print(f"Error during behavior analysis: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"An error occurred during behavior analysis: {e}")

@app.get("/health")
async def health_check():
    gemini_status = "Initialized" if ai_model_flash or ai_model_pro else "Not Initialized (No API Key?)"
    return {"status": "ok", "message": f"AI SEO Brain is running 🧠. Gemini Status: {gemini_status}"}

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True) 
