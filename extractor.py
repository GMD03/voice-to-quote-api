from ollama import chat
from pydantic import BaseModel
from typing import List

class LineItem(BaseModel):
    item_name: str
    quantity: float
    unit: str

class ParsedQuote(BaseModel):
    items: List[LineItem]
    customer_details: str


def extract_quote(transcript: str) -> ParsedQuote:
    print(f"Analyzing transcript: '{transcript}'...\n")

    #Pass the Pydantic schema directly into Ollama's format parameter
    response = chat(
        model = 'llama3.2',
        messages = [
            {
                'role': 'system',
                'content': 'You are a precise data extraction tool for construction quotes. Extract the materials and labor. If a unit is not explicitly stated, infer the most logical unit (e.g., hours for labor, sq_ft for flooring). Format item names with underscores (e.g., oak_flooring).'
            },
            {
                'role': 'user',
                'content': transcript 
            }
        ],
        format=ParsedQuote.model_json_schema(),
        options={'temperature': 0}
    )

    return ParsedQuote.model_validate_json(response.message.content)

if __name__ == "__main__":
    test_transcript = "Just walked the Smith property. Needs 40 square feet of oak flooring and 10 hours of labor. Also, the client requested we avoid making noise before 9 AM."
    
    try:
        result = extract_quote(test_transcript)
        print(f"Extraction Successful!\n")
        print(result.model_dump_json(indent=2))
    except Exception as e:
        print(f"Extraction Failed: {e}")
    
    
