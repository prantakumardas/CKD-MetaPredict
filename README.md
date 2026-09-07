# CKD MetaPredict Web Application

This repository contains the **CKD MetaPredict web app**, a lightweight Flask application for **Chronic Kidney Disease (CKD) prediction**. It integrates a trained multilayer stacking ensemble model, provides a user‑friendly interface, and supports clinical interpretability.

---

## 📂 Folder Structure

- **app.py**  
  - Main Flask application entry point.  
  - Handles routing, form input, prediction requests, and rendering templates.  

- **model_utils.py**  
  - Utility functions for loading the trained model and performing predictions.  

- **stacking_full_pipeline.joblib**  
  - Serialized stacking ensemble pipeline (trained model).  

- **requirements.txt**  
  - A requirements.txt file is a plain text file used in Python projects to list all external libraries and packages needed for the code to run. 

- **static/**  
  - Contains CSS, JavaScript, and other static assets.  

- **templates/**  
  - HTML templates for rendering the web interface.  

---

## 🚀 Getting Started

### Prerequisites
- Python 3.12
- Required packages:
blinker==1.9.0
chartjs==1.2
click==8.5.0
Flask==3.1.2
gunicorn==26.2.0
itsdangerous==2.2.0
Jinja2==3.1.6
joblib==1.5.3
MarkupSafe==3.0.3
numpy==2.1.3
pandas==2.2.3
python-dateutil==2.9.0.post0
pytz==2026.3.post1
scikit-learn==1.6.1
scipy==1.18.1
six==1.17.0
threadpoolctl==3.6.0
tzdata==2026.3
Werkzeug==3.1.8
xgboost==3.4.1

## 📊 Usage
### Clone the repository
```bash
git clone https://github.com/prantakumardas/CKD_MetaPredict_Webapp.git
```
### Run locally
- Ensure you are inside the project folder.
- To run this project, you need to install the required Python packages. Open your terminal or command prompt in the project folder and run:

```bash
pip install -r requirements.txt
```

- Start the Flask server:
```bash
python app.py
```
- By default, the app runs on:
```bash
http://127.0.0.1:5000/
```
- Open this address in your browser to access the CKD MetaPredict interface.
### Workflow
- Input patient demographic and laboratory parameters via the form.
- The app loads stacking_full_pipeline.joblib and generates predictions.
- Results are displayed with charts (via Chart.js) and classification outcomes.
- A PDF report is automatically generated containing patient information, input features, prediction results, and confidence scores.
- The PDF can be previewed in the browser and downloaded for record‑keeping.
### 📈 Features
- Flask web interface for CKD prediction.
- Stacking ensemble model serialized with Joblib.
- Interactive charts using Chart.js for visualization.
- Reusable utilities in model_utils.py.
- Deployment ready with modular structure.
