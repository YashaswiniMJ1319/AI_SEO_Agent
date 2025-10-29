# AI SEO Brain Microservice

This is the AI service that handles all SEO analysis.

## How to Run

1.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

2.  **Add API Key:**
    Copy `.env.example` to a new file named `.env` and add your Google Gemini API key.

3.  **Run the server:**
    ```bash
    uvicorn main:app --reload --port 8000
    ```

4.  **Test it:**
    The API is now running. Go to `http://127.0.0.1:8000/docs` to test the endpoint.