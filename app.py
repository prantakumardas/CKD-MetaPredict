from flask import Flask, request, jsonify, render_template
from model_utils import predict, FEATURE_ORDER

app = Flask(__name__)

ALLOWED_FEATURES =['age', 'blood_pressure', 'specific_gravity', 'albumin', 'sugar', 'blood_glucose_random', 'blood_urea',
              'serum_creatinine', 'sodium', 'potassium', 'hemoglobin', 'packed_cell_volume', 'white_blood_cell_count',
              'red_blood_cell_count', 'red_blood_cells', 'pus_cell', 'pus_cell_clumps', 'bacteria',
              'hypertension', 'diabetes_mellitus', 'coronary_artery_disease', 'appetite', 'peda_edema',
              'anemia']

# --- CKD-EPI helper function ---
def calculate_egfr(scr, age, sex):
    """
    CKD-EPI 2021 Creatinine Equation
    scr: serum creatinine (mg/dL)
    age: years
    sex: 'male' or 'female'
    """
    if sex.lower() == 'female':
        kappa = 0.7
        alpha = -0.241
        sex_factor = 1.012
    else:
        kappa = 0.9
        alpha = -0.302
        sex_factor = 1.0

    ratio = scr / kappa
    egfr = 142 * (min(ratio, 1) ** alpha) * (max(ratio, 1) ** -1.200) * (0.9938 ** age) * sex_factor
    return round(egfr, 2)

# Custom 404 error handler
@app.errorhandler(404)
def page_not_found(e):
    return render_template("404.html"), 404

@app.route("/", methods=["GET"])
def index():
    # Pass feature order to template for dynamic form rendering if needed
    return render_template("index.html", feature_order=FEATURE_ORDER)

@app.route("/about")
def about():
    return render_template("about.html") 

@app.route("/predict_endpoint", methods=["POST"])
def predict_endpoint():
    print("Incoming request JSON:", request.get_json(silent=True)) 
    print("Incoming form data:", request.form)

    try:
        
        # --- Patient Info Validation ---
        patient_info = {
            "name": request.form.get("name"),
            "age": request.form.get("age"),
            "blood_group": request.form.get("blood_group"),
            "sex": request.form.get("sex"),
            #"height": request.form.get("height"),
            "weight": request.form.get("weight"),
        }

        
        errors = []

        # Name: must not be empty
        if not patient_info["name"]:
            errors.append("Name is required")

        # Age: must be a positive integer
        try:
            if patient_info["age"]:
                age_val = int(patient_info["age"])
                if age_val <= 0:
                    errors.append("Age must be greater than 0")
                patient_info["age"] = age_val
            else:
                errors.append("Age is required")
        except ValueError:
            errors.append("Age must be a valid integer")

        # Blood group validation
        allowed_blood_groups = {"A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"}
        if not patient_info["blood_group"]:
            errors.append("Blood group is required")
        elif patient_info["blood_group"] not in allowed_blood_groups:
            errors.append(f"Invalid blood group: {patient_info['blood_group']}")

        # Sex validation
        if not patient_info["sex"]:
            errors.append("Sex is required")
        elif patient_info["sex"].lower() not in {"male", "female"}:
            errors.append(f"Invalid sex: {patient_info['sex']}")

        '''
        # Height validation
        try:
            if patient_info["height"]:
                height_val = float(patient_info["height"])
                if height_val <= 0:
                    errors.append("Height must be greater than 0")
                patient_info["height"] = height_val
            else:
                errors.append("Height is required")
        except ValueError:
            errors.append("Height must be a valid number")
        '''

        # Weight validation
        try:
            if patient_info["weight"]:
                weight_val = float(patient_info["weight"])
                if weight_val <= 0:
                    errors.append("Weight must be greater than 0")
                patient_info["weight"] = weight_val
            else:
                errors.append("Weight is required")
        except ValueError:
            errors.append("Weight must be a valid number")
        
        # --- Model Features Validation ---
        payload = {}
        for feat in ALLOWED_FEATURES:
            val = request.form.get(feat)
            if val is None or val == "":
                errors.append(feat)
            else:
                payload[feat] = val

        if errors:
            return jsonify({
                "status": "error",
                "message": f"Missing required features: {', '.join(errors)}"
            }), 400

        # Run prediction
        result = predict(payload)

        # --- eGFR Calculation ---
        egfr_result = None
        scr_val = request.form.get("serum_creatinine")
        if scr_val:
            try:
                scr_val = float(scr_val)
                egfr_result = calculate_egfr(scr_val, patient_info["age"], patient_info["sex"])
            except ValueError:
                pass  # ignore invalid input
        print("eGFR_result:", egfr_result)
        return jsonify({
            "status": "ok",
            "result": result,
            "patient_info": patient_info,
            "egfr": egfr_result
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400


if __name__ == "__main__":
    app.run(debug=True)
