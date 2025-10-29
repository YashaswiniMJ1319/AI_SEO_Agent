import uvicorn
import os
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from bs4 import BeautifulSoup, Tag
import google.generativeai as genai
from dotenv import load_dotenv
import re
from typing import Optional
from jose import JWTError, jwt

# --- Load environment variables ---
load_dotenv()
GEMINI_API_KEY = os.getenv("GOOGLE_API_KEY")
JWT_SECRET = os.getenv("JWT_SECRET") or "super_secret_jwt_key"
ALGORITHM = "HS256"

if not GEMINI_API_KEY:
    print("❌ Error: GOOGLE_API_KEY not found in .env")
else:
    genai.configure(api_key=GEMINI_API_KEY)

if not JWT_SECRET or JWT_SECRET == "super_secret_jwt_key":
    print("⚠️ Warning: Using default JWT secret. Set JWT_SECRET in .env")

# --- Models ---
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
    context: Optional[str] = None

class KeywordAnalysis(BaseModel):
    targetKeyword: str
    foundInTitle: bool
    foundInMeta: bool
    foundInH1: bool
    bodyCount: int
    density: float

class SeoResponse(BaseModel):
    seoScore: int
    issues: list[Issue]
    suggestions: list[Suggestion]
    keywordAnalysis: Optional[KeywordAnalysis] = None

class TokenData(BaseModel):
    userId: Optional[str] = None
    email: Optional[str] = None

# --- AI Engine ---
ai_model = genai.GenerativeModel('models/gemini-flash-latest')

def get_page_text(soup: BeautifulSoup) -> str:
    for tag in soup(["script", "style"]):
        tag.decompose()
    text = soup.get_text(separator=' ', strip=True)
    return re.sub(r'\s+', ' ', text)

async def generate_meta_description(page_text: str) -> Optional[str]:
    prompt = f"""
    You are an expert SEO copywriter.
    Based on the following webpage text, write a compelling meta description under 160 characters.
    It must be in active voice and encourage clicks.
    Respond with ONLY the meta description.

    Webpage Text:
    "{page_text[:2000]}"
    """
    try:
        response = await ai_model.generate_content_async(prompt)
        return response.text.strip().strip('"')
    except Exception as e:
        print(f"Error (meta): {e}")
        return None

async def generate_alt_text(image_src: str, page_text: str) -> Optional[str]:
    filename = image_src.split('/')[-1].split('?')[0]
    filename_hint = filename.replace('-', ' ').replace('_', ' ').rsplit('.', 1)[0]

    prompt = f"""
    You are an expert SEO copywriter and image optimization specialist.
    Generate a concise, keyword-rich, and descriptive alt text for the given image.

    Focus on clarity, accessibility, and SEO best practices — as if optimizing for Google Image Search.
    Avoid generic phrases like "image of" or "picture of". Describe the image naturally using context-relevant keywords.

    The image's filename is: "{filename_hint}"
    The surrounding page text (context) is: "{page_text[:1500]}"

    Respond with ONLY the optimized descriptive alt text.
    """

    try:
        response = await ai_model.generate_content_async(prompt)
        return response.text.strip().strip('"')
    except Exception as e:
        print(f"Error (alt text): {e}")
        return None

# --- Keyword Engine ---
def perform_keyword_analysis(target_keyword: str, page_text: str,
                             title_tag: Optional[Tag],
                             meta_tag: Optional[Tag],
                             h1_tags: list[Tag]) -> KeywordAnalysis:
    keyword_lower = target_keyword.lower()
    text_lower = page_text.lower()

    title_text = (title_tag.string or '') if title_tag else ''
    meta_text = (meta_tag.get('content', '') or '') if meta_tag else ''
    h1_text = ' '.join([h1.get_text(strip=True) for h1 in h1_tags])

    found_in_title = keyword_lower in title_text.lower()
    found_in_meta = keyword_lower in meta_text.lower()
    found_in_h1 = keyword_lower in h1_text.lower()

    body_count = text_lower.count(keyword_lower)
    total_words = len(text_lower.split())
    density = (body_count / total_words) * 100 if total_words > 0 else 0

    return KeywordAnalysis(
        targetKeyword=target_keyword,
        foundInTitle=found_in_title,
        foundInMeta=found_in_meta,
        foundInH1=found_in_h1,
        bodyCount=body_count,
        density=round(density, 2)
    )

# --- JWT Auth ---
auth_scheme = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(auth_scheme)) -> TokenData:
    token = credentials.credentials
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        user_id = payload.get("userId")
        email = payload.get("email")
        if not email:
            raise credentials_exception
        return TokenData(userId=user_id, email=email)
    except JWTError as e:
        print(f"JWTError: {e}")
        raise credentials_exception

# --- FastAPI App ---
app = FastAPI()

@app.post("/analyze", response_model=SeoResponse)
async def analyze_seo(request: SeoRequest):
    
    issues, suggestions = [], []
    seo_score = 100
    keyword_report = None

    if request.contentType != 'html':
        return SeoResponse(seoScore=0, issues=[Issue(type='error', message='Invalid contentType')], suggestions=[])

    try:
        soup = BeautifulSoup(request.content, 'html.parser')
        page_text = get_page_text(soup)
        target_keyword = request.config.get('targetKeyword') if request.config else None

        title_tag = soup.find('title')
        meta_tag = soup.find('meta', attrs={'name': 'description'})
        h1_tags = soup.find_all('h1')
        images = soup.find_all('img')

        # --- Check SEO tags ---
        if not title_tag:
            issues.append(Issue(type='error', message='Missing <title> tag'))
            seo_score -= 20
        elif len(title_tag.text) > 60:
            issues.append(Issue(type='warning', message='Title too long'))
            seo_score -= 5

        if not meta_tag:
            issues.append(Issue(type='error', message='Missing <meta description>'))
            seo_score -= 20
            ai_meta = await generate_meta_description(page_text)
            if ai_meta:
                suggestions.append(Suggestion(type='ai_meta', message='AI-generated meta description:', content=ai_meta))
        elif len(meta_tag.get('content', '')) > 160:
            issues.append(Issue(type='warning', message='Meta description too long'))
            seo_score -= 5

        if len(h1_tags) == 0:
            issues.append(Issue(type='error', message='Missing <h1> tag'))
            seo_score -= 15
        elif len(h1_tags) > 1:
            issues.append(Issue(type='warning', message='Multiple <h1> tags'))
            seo_score -= 10

        # --- Check images ---
        for img in images:
            src = img.get('src', '')
            if not img.get('alt'):
                issues.append(Issue(type='warning', message=f"Missing alt text for image: {src[:50]}"))
                ai_alt = await generate_alt_text(src, page_text)
                if ai_alt:
                    suggestions.append(Suggestion(type='ai_alt_text', message='AI alt text suggestion:', content=ai_alt, context=src))

        # --- Keyword analysis ---
        if target_keyword:
            keyword_report = perform_keyword_analysis(target_keyword, page_text, title_tag, meta_tag, h1_tags)

    except Exception as e:
        print(f"❌ Error during analysis: {e}")
        raise HTTPException(status_code=500, detail=f"Internal error: {e}")

    return SeoResponse(seoScore=max(0, seo_score), issues=issues, suggestions=suggestions, keywordAnalysis=keyword_report)

@app.get("/health")
async def health():
    return {"status": "ok", "message": "AI SEO Brain is running 🧠"}

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
