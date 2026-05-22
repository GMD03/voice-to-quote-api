from fastapi import FastAPI, HTTPException, File, UploadFile
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests
import whisper
import os
import shutil
from extractor import extract_quote

app = FastAPI(title="Voice to Quote API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

N8N_WEBHOOK_URL = "http://localhost:5678/webhook-test/receive-quote"

print("Loading Whisper Model...")
whisper_model = whisper.load_model("small")
print("Whisper Model Loaded!")

# class QuoteRequest(BaseModel):
    # transcript: str

@app.post("/generate-quote")
async def generate_quote(audio_file: UploadFile = File(...)):
    print(f"Received audio file: {audio_file.filename}")
    temp_file_path = f"temp_{audio_file.filename}"

    try:
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(audio_file.file, buffer)

        print("Transcribing audio...")
        transcription_result = whisper_model.transcribe(
            temp_file_path,
            initial_prompt="This is a construction and contractor quote. Vocabulary: oak flooring, labor, square feet, hours, carpet removal."
        )

        transcript = transcription_result["text"]
        print(f"Transcript: {transcript}")

        # Pass the transcribed text to Llama 3.2
        extracted_data = extract_quote(transcript)
        payload = extracted_data.model_dump()
        
        print("Sending data to n8n...")
        try:
            n8n_response = requests.post(N8N_WEBHOOK_URL, json=payload)
            if n8n_response.status_code == 200:
                print("Successfully sent to n8n")
            else:
                print(f"n8n returned status: {n8n_response.status_code}")
        except requests.exceptions.RequestException as e:
            print(f"Warning: Could not reach n8n webhook. Is n8n running? Error: {e}")

        # Always return the data to the UI, even if n8n is down
        return {
            "status": "success", 
            "transcript": transcript, 
            "extracted_data": payload
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        # Delete temp audio file 
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)

# Mount the static directory to serve the frontend UI
app.mount("/", StaticFiles(directory="static", html=True), name="static")