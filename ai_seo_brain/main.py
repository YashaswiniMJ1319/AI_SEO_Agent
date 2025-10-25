import uvicorn
import os
from fastapi import FastAPI, Depends, HTTPException, status # Added Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials # Added security imports
from pydantic import BaseModel
from bs4 import BeautifulSoup, Tag
import google.generativeai as genai
from dotenv import load_dotenv
import re
from typing import Optional # Import Optional

# --- Add JWT imports ---
from jose import JWTError, jwt
# -----------------------

# --- Load environment variables ---
load_dotenv()
GEMINI_API_KEY = os.getenv("GOOGLE_API_KEY")
# --- Get JWT Secret (MUST match the one in Node.js API) ---
JWT_SECRET = os.getenv("JWT_SECRET") or "super_secret_jwt_key" # Use the same default or set in .env
ALGORITHM = "HS256" # Algorithm used by Node.js API
# -----------------------------------------------------------

if not GEMINI_API_KEY:
    print("Error: GOOGLE_API_KEY not found. Please check your .env file.")
# else: # Keep genai configured even if JWT_SECRET is missing initially
genai.configure(api_key=GEMINI_API_KEY)
if not JWT_SECRET or JWT_SECRET == "super_secret_jwt_key":
     print("Warning: JWT_SECRET is using the default value or is not set in .env. Ensure this matches the Node.js API's secret.")


# --- MODULE 1: API Models ---

class SeoRequest(BaseModel):
    content: str
    contentType: str
    config: Optional[dict] = {} # Make config optional

class Issue(BaseModel):
    type: str
    message: str
    line: Optional[int] = None # Use Optional

class Suggestion(BaseModel):
    type: str
    message: str
    content: str
    context: Optional[str] = None # Use Optional

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
    keywordAnalysis: Optional[KeywordAnalysis] = None # Use Optional

# --- Add Token Payload Model ---
class TokenData(BaseModel):
    userId: Optional[str] = None
    email: Optional[str] = None
# -----------------------------

# --- MODULE 3: AI Engine ---
# ... (get_page_text, generate_meta_description, generate_alt_text remain the same) ...
# --- Assuming these functions exist as before ---
ai_model = genai.GenerativeModel('models/gemini-flash-latest')

def get_page_text(soup: BeautifulSoup) -> str:
    """Helper function to extract clean text from HTML."""
    for script_or_style in soup(["script", "style"]):
        script_or_style.decompose()
    text = soup.get_text(separator=' ', strip=True)
    return re.sub(r'\s+', ' ', text)

async def generate_meta_description(page_text: str) -> str | None:
    """Uses the Gemini API to generate a meta description."""
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
        # Note: Make sure your genai library version supports async properly
        # If not, remove 'async' and 'await' and use the synchronous call
        response = await ai_model.generate_content_async(prompt)
        ai_content = response.text.strip().strip('"')
        return ai_content
    except Exception as e:
        print(f"Error calling Gemini API (meta): {e}")
        return None

async def generate_alt_text(image_src: str, page_text: str) -> str | None:
    """Uses the Gemini API to generate alt text for an image."""

    filename = image_src.split('/')[-1].split('?')[0]
    filename_hint = filename.replace('-', ' ').replace('_', ' ').rsplit('.', 1)[0]

    prompt = f"""
    You are an expert SEO copywriter. Generate a concise, descriptive alt text for an image.
    The image's filename is: "{filename_hint}"
    This filename is a strong hint.
    The surrounding page text is: "{page_text[:1500]}"
    Use both filename and page text to infer the image's content.
    Respond with ONLY the descriptive alt text (e.g., "A red car driving on a highway").
    """

    try:
        # Note: Make sure your genai library version supports async properly
        response = await ai_model.generate_content_async(prompt)
        ai_content = response.text.strip().strip('"')
        return ai_content
    except Exception as e:
        print(f"Error calling Gemini API (alt text): {e}")
        return None
# --- End AI Engine ---


# --- MODULE 4: Keyword Engine ---
# ... (perform_keyword_analysis remains the same) ...
def perform_keyword_analysis(
    target_keyword: str,
    page_text: str,
    title_tag: Optional[Tag], # Use Optional
    meta_tag: Optional[Tag],  # Use Optional
    h1_tags: list[Tag]
) -> KeywordAnalysis:
    """Runs a full keyword analysis on the page content."""

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
# --- End Keyword Engine ---


# --- Define Security Scheme ---
auth_scheme = HTTPBearer()
# ----------------------------

# --- Define Security Dependency ---
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(auth_scheme)) -> TokenData:
    """
    Dependency function to validate the Bearer token.
    Returns the token payload if valid, otherwise raises HTTPException.
    """
    token = credentials.credentials
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        # Decode the token using the same secret and algorithm as the Node.js API
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        # --- Extract expected fields (adjust based on Node.js token payload) ---
        user_id: Optional[str] = payload.get("userId")
        email: Optional[str] = payload.get("email")
        if email is None: # Check for at least one identifier
             print("JWTError: Token payload missing 'email'")
             raise credentials_exception
        # -------------------------------------------------------------------
        token_data = TokenData(userId=user_id, email=email)
        print(f"Token validated successfully for user: {email or user_id}") # Log success
    except JWTError as e:
        print(f"JWTError: {e}") # Log the specific JWT error
        raise credentials_exception
    except Exception as e:
         print(f"Unexpected error during token decoding: {e}") # Log other errors
         raise credentials_exception
    return token_data
# --------------------------------

# Initialize FastAPI app
app = FastAPI()

# --- MODULE 2: Analyzer Endpoint (Now Protected) ---

# --- Add Depends(get_current_user) to protect the endpoint ---
@app.post("/analyze", response_model=SeoResponse)
async def analyze_seo(request: SeoRequest, current_user: TokenData = Depends(get_current_user)):
# -----------------------------------------------------------
    """
    Main analysis endpoint. Requires valid Bearer token.
    Access token payload via `current_user`.
    """
    print(f"Received analysis request from user: {current_user.email or current_user.userId}")

    issues: list[Issue] = []
    suggestions: list[Suggestion] = []
    keyword_report: Optional[KeywordAnalysis] = None # Use Optional
    seo_score = 100

    if request.contentType != 'html':
        # Return valid SeoResponse structure even for errors
        return SeoResponse(
            seoScore=0,
            issues=[Issue(type='error', message='Invalid contentType. Only "html" is supported.')],
            suggestions=[],
            keywordAnalysis=None
        )

    try:
        soup = BeautifulSoup(request.content, 'html.parser')
        page_text = get_page_text(soup)
        # Safely get targetKeyword from potentially missing config
        target_keyword = request.config.get('targetKeyword') if request.config else None

        # --- Run SEO Rules (Same as before) ---
        title_tag = soup.find('title')
        if not title_tag or not title_tag.string:
            issues.append(Issue(type='error', message='Missing <title> tag.'))
            seo_score -= 20
        elif len(title_tag.string) > 60:
            issues.append(Issue(type='warning', message='Title is too long. Aim for under 60 characters.'))
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
                    message='An AI-generated meta description to fix this issue:',
                    content=ai_generated_meta
                ))
        elif len(meta_tag.get('content', '')) > 160:
            issues.append(Issue(type='warning', message='Meta description is too long. Aim for under 160 characters.'))
            seo_score -= 5

        h1_tags = soup.find_all('h1')
        if len(h1_tags) == 0:
            issues.append(Issue(type='error', message='Missing <h1> tag. Every page needs one main heading.'))
            seo_score -= 15
        elif len(h1_tags) > 1:
            issues.append(Issue(type='warning', message=f'Found {len(h1_tags)} <h1> tags. A page should only have one.'))
            seo_score -= 10

        images = soup.find_all('img')
        for img in images:
            img_src = img.get('src', 'unknown image')
            if not img.get('alt'):
                issues.append(Issue(
                    type='warning',
                    message=f"Image is missing alt text. (src: {img_src[:50]}...)"
                ))
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

        print("Checking heading hierarchy...")
        headings = soup.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])
        last_level = 0
        for h in headings:
            try:
                current_level = int(h.name[1])
                if current_level > last_level + 1:
                    issues.append(Issue(
                        type='warning',
                        message=f"Heading hierarchy skip: <{h.name}> found after <h{last_level}>. Use <h{last_level + 1}> first."
                    ))
                    seo_score -= 5
                last_level = current_level
            except (IndexError, ValueError):
                print(f"Warning: Could not parse heading level from tag name: {h.name}")
        # --- End Rules ---

        # --- Run Keyword Analysis ---
        if target_keyword:
            print(f"Running keyword analysis for: {target_keyword}")
            keyword_report = perform_keyword_analysis(
                target_keyword=target_keyword,
                page_text=page_text,
                title_tag=title_tag,
                meta_tag=meta_tag,
                h1_tags=h1_tags
            )
            if not keyword_report.foundInTitle:
                issues.append(Issue(type='info', message=f"Target keyword '{target_keyword}' not found in <title>."))
                seo_score -= 5
            if not keyword_report.foundInH1:
                issues.append(Issue(type='info', message=f"Target keyword '{target_keyword}' not found in <h1>."))
                seo_score -= 5
        # --- End Keyword Analysis ---

    except Exception as e:
         print(f"Error during analysis processing: {e}")
         # Raise HTTPException for internal errors during analysis
         raise HTTPException(
             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
             detail=f"An error occurred during SEO analysis: {e}"
         )

    # --- Return the final report ---
    final_score = max(0, seo_score)

    return SeoResponse(
        seoScore=final_score,
        issues=issues,
        suggestions=suggestions,
        keywordAnalysis=keyword_report
    )

# Run the server (optional health check endpoint)
@app.get("/health")
async def health_check():
    return {"status": "ok", "message": "AI SEO Brain is running 🧠"}

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000)) # Allow port configuration via env var
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
