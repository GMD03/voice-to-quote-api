from ollama import chat
from pydantic import BaseModel
from typing import List, Literal

class LineItem(BaseModel):
    item_name: str
    quantity: float
    unit: str

class ParsedQuote(BaseModel):
    items: List[LineItem]
    customer_details: str
    action_type: Literal["draft", "generate"] 

def extract_quote_data(transcript: str) -> ParsedQuote:
    print(f"Analyzing transcript: '{transcript}'...\n")
    
    response = chat(
        model='llama3.2',
        messages=[{
            'role': 'system',
            'content': '''You are a precise data extraction tool for construction quotes. 
            Extract materials and labor. If a unit is not explicitly stated, infer the most logical unit.
            Format item names with underscores (e.g., oak_flooring).
            
            CRITICAL INSTRUCTION FOR ACTION_TYPE:
            - If the user is just listing materials or logging hours, set action_type to "draft".
            - If the user explicitly says to "generate", "finalize", "create", or "send" the quote/report, set action_type to "generate".'''
        },
        {
            'role': 'user',
            'content': transcript
        }],
        format=ParsedQuote.model_json_schema(),
        options={'temperature': 0} 
    )
    
    return ParsedQuote.model_validate_json(response.message.content)