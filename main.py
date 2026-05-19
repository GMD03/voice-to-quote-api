from fastapi import FastAPI, HTTPException, File, UploadFile
from pydantic import BaseModel
import requests
import whisper
import os
import shutil
from extractor import extract_quote

app = FastAPI(title="Voice to Quote API")

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
        n8n_response = requests.post(N8N_WEBHOOK_URL, json=payload)

        if n8n_response.status_code == 200:
            return {
                "status": "success", 
                "transcript": transcript, # Returning the transcript so the user can see it
                "extracted_data": payload
            }
        else:
            raise HTTPException(status_code=n8n_response.status_code, detail="Failed to reach n8n")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        # Delete temp audio file 
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)