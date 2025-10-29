import os
import google.generativeai as genai
from dotenv import load_dotenv

# Load environment variables (your API key)
load_dotenv()
GEMINI_API_KEY = os.getenv("GOOGLE_API_KEY")

if not GEMINI_API_KEY:
    print("Error: GOOGLE_API_KEY not found in your .env file.")
    print("Please make sure your .env file is in the same folder and has your key.")
else:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        
        print("Fetching the list of models you have access to...")
        print("--------------------------------------------------")
        
        found_models = False
        # List all models
        for m in genai.list_models():
            # Check if the model supports the 'generateContent' method
            if 'generateContent' in m.supported_generation_methods:
                print(f"Found usable model: {m.name}")
                found_models = True
        
        if not found_models:
             print("No usable models found for your API key.")
             print("Please check your Google AI Studio / Google Cloud project to ensure the Generative AI API is enabled.")

    except Exception as e:
        print(f"An error occurred while trying to list models: {e}")
        print("This might be due to an invalid API key or a permissions issue in your Google Cloud project.")