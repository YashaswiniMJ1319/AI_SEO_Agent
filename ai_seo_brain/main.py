import uvicorn
import os
from fastapi import FastAPI
from pydantic import BaseModel
from bs4 import BeautifulSoup, Tag
import google.generativeai as genai
from dotenv import load_dotenv
import re
from fastapi.responses import RedirectResponse, JSONResponse  # ✅ Added

# --- Load environment variables (your API key) ---
load_dotenv()
GEMINI_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GEMINI_API_KEY:
    print("Error: GOOGLE_API_KEY not found. Please check your .env file.")
else:
    genai.configure(api_key=GEMINI_API_KEY)


# --- MODULE 1: The "Contract" (API Definition) ---
class SeoRequest(BaseModel):
    content: str
    contentType: str
    config: dict = {}

class Issue(BaseModel):
    type: str
    message: str
    line: int | None = None

class Suggestion(BaseModel):
    type: str
    message: str
    content: str
    context: str | None = None

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
    keywordAnalysis: KeywordAnalysis | None = None


# --- MODULE 3: The "AI Engine" (Gemini) ---
ai_model = genai.GenerativeModel('models/gemini-flash-latest')

def get_page_text(soup: BeautifulSoup) -> str:
    for script_or_style in soup(["script", "style"]):
        script_or_style.decompose()
    text = soup.get_text(separator=' ', strip=True)
    return re.sub(r'\s+', ' ', text)

async def generate_meta_description(page_text: str) -> str | None:
    prompt = f"""
    You are an expert SEO copywriter.
    Based on the following webpage text, write a compelling meta description.
    The meta description must be under 160 characters.
    It must be in active voice and encourage clicks.
    Respond with ONLY the meta description and no other text.

    Webpage Text:
    "{page_text[:2000]}"
    """
    try:
        response = await ai_model.generate_content_async(prompt)
        ai_content = response.text.strip().strip('"')
        return ai_content
    except Exception as e:
        print(f"Error calling Gemini API (meta): {e}")
        return None

async def generate_alt_text(image_src: str, page_text: str) -> str | None:
    filename = image_src.split('/')[-1].split('?')[0]
    filename_hint = filename.replace('-', ' ').replace('_', ' ').rsplit('.', 1)[0]

    prompt = f"""
    You are an expert SEO copywriter. Generate a concise, descriptive alt text for an image.
    The image's filename is: "{filename_hint}"
    The surrounding page text is: "{page_text[:1500]}"
    Respond with ONLY the descriptive alt text.
    """
    try:
        response = await ai_model.generate_content_async(prompt)
        ai_content = response.text.strip().strip('"')
        return ai_content
    except Exception as e:
        print(f"Error calling Gemini API (alt text): {e}")
        return None


# --- MODULE 4: The "Keyword Engine" ---
def perform_keyword_analysis(target_keyword: str, page_text: str, title_tag: Tag | None, meta_tag: Tag | None, h1_tags: list[Tag]) -> KeywordAnalysis:
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


# Initialize our FastAPI app
app = FastAPI(title="AI SEO Brain", version="1.0.0")

# ✅ Root route (fix for Docker localhost:8000)
@app.get("/", include_in_schema=False)
def root():
    """Redirects to the interactive API docs automatically."""
    return RedirectResponse(url="/docs")
    # OR: return JSONResponse({"message": "Welcome to AI SEO Brain API. Visit /docs for documentation."})


# --- MODULE 2: The "Rules Engine" (The Analyzer) ---
@app.post("/analyze", response_model=SeoResponse)
async def analyze_seo(request: SeoRequest):
    issues: list[Issue] = []
    suggestions: list[Suggestion] = []
    keyword_report: KeywordAnalysis | None = None
    seo_score = 100

    if request.contentType != 'html':
        return SeoResponse(
            seoScore=0,
            issues=[Issue(type='error', message='Invalid contentType. Only "html" is supported.')],
            suggestions=[]
        )

    soup = BeautifulSoup(request.content, 'html.parser')
    page_text = get_page_text(soup)
    target_keyword = request.config.get('targetKeyword')

    title_tag = soup.find('title')
    if not title_tag or not title_tag.string:
        issues.append(Issue(type='error', message='Missing <title> tag.'))
        seo_score -= 20
    elif len(title_tag.string) > 60:
        issues.append(Issue(type='warning', message='Title too long. Aim under 60 chars.'))
        seo_score -= 5

    meta_tag = soup.find('meta', attrs={'name': 'description'})
    if not meta_tag or not meta_tag.get('content'):
        issues.append(Issue(type='error', message='Missing <meta name="description"> tag.'))
        seo_score -= 20

        print("Meta description missing. Calling AI...")
        ai_generated_meta = await generate_meta_description(page_text)

        if ai_generated_meta:
            suggestions.append(Suggestion(
                type='ai_meta',
                message='AI-generated meta description:',
                content=ai_generated_meta
            ))

    h1_tags = soup.find_all('h1')
    if len(h1_tags) == 0:
        issues.append(Issue(type='error', message='Missing <h1> tag.'))
        seo_score -= 15
    elif len(h1_tags) > 1:
        issues.append(Issue(type='warning', message=f'Found {len(h1_tags)} <h1> tags.'))
        seo_score -= 10

    images = soup.find_all('img')
    for img in images:
        img_src = img.get('src', 'unknown image')
        if not img.get('alt'):
            issues.append(Issue(type='warning', message=f"Image missing alt text. (src: {img_src[:50]}...)"))
            seo_score -= 5

            print(f"Alt text missing for {img_src}. Calling AI...")
            ai_generated_alt = await generate_alt_text(img_src, page_text)
            if ai_generated_alt:
                suggestions.append(Suggestion(
                    type='ai_alt_text',
                    message=f'AI-generated alt text for "{img_src[:50]}...":',
                    content=ai_generated_alt,
                    context=img_src
                ))

    headings = soup.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])
    last_level = 0
    for h in headings:
        current_level = int(h.name[1])
        if current_level > last_level + 1:
            issues.append(Issue(
                type='warning',
                message=f"Heading hierarchy skip: <{h.name}> found after <h{last_level}>."
            ))
            seo_score -= 5
        last_level = current_level

    if target_keyword:
        keyword_report = perform_keyword_analysis(
            target_keyword=target_keyword,
            page_text=page_text,
            title_tag=title_tag,
            meta_tag=meta_tag,
            h1_tags=h1_tags
        )

    final_score = max(0, seo_score)
    return SeoResponse(seoScore=final_score, issues=issues, suggestions=suggestions, keywordAnalysis=keyword_report)


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
