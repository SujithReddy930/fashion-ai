@echo off
echo Starting Fashion AI Backend...
start cmd /k "cd /d C:\Users\bhavi\fashion-ai && venv\Scripts\activate && python fashion_ai_colab.py"

timeout /t 5

echo Starting Fashion AI Frontend...
start cmd /k "cd /d C:\Users\bhavi\fashion-ai\frontend && npm start"