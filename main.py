from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import requests
from extractor import extract_quote

app = FastAPI(title="Voice to Quote API")

N8N_WEBHOOK_URL = "http://localhost:5678/webhook-test/receive-quote"

class QuoteRequest(BaseModel):
    transcript: str

@app.post("/generate-quote")
async def generate_quote(request: QuoteRequest):
    print(f"Received new request: {request.transcript}")
    try:
        # Pass the transcript to Llama 3.2
        extracted_data = extract_quote(request.transcript)

        # Convert Pydantic object back to JSON
        payload = extracted_data.model_dump()

        print("Sending data to n8n...")
        n8n_response = requests.post(N8N_WEBHOOK_URL, json=payload)

        if n8n_response.status_code == 200:
            return {
                "status": "success", 
                "message": "Quote successfully parsed and sent to pipeline.",
                "n8n_status": "received",
                "extracted_data": payload
            }
        else:
            raise HTTPException(status_code=n8n_response.status_code, detail="Failed to reach n8n")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

