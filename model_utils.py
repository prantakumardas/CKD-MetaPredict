import numpy as np
import pandas as pd
import joblib
import os
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PIPELINE = joblib.load(os.path.join(BASE_DIR, "stacking_full_pipeline.joblib"))

BASE_MODELS = PIPELINE["base_models"]
META1_MODELS = PIPELINE["meta1_models"]
FINAL_META = PIPELINE["final_meta"]
SCALER = PIPELINE["scaler"]
FEATURE_ORDER = PIPELINE["feature_order"]

ALLOWED_FEATURES = ['age', 'blood_pressure', 'specific_gravity', 'albumin', 'sugar', 'blood_glucose_random', 'blood_urea',
              'serum_creatinine', 'sodium', 'potassium', 'hemoglobin', 'packed_cell_volume', 'white_blood_cell_count',
              'red_blood_cell_count', 'red_blood_cells', 'pus_cell', 'pus_cell_clumps', 'bacteria',
              'hypertension', 'diabetes_mellitus', 'coronary_artery_disease', 'appetite', 'peda_edema',
              'anemia']

def _coerce_types(payload):
    """
    Coerce incoming dict values to numeric or categorical as expected.
    Handles only the selected features.
    """
    coerced = {}

    mappings = {
        "hypertension": {"no": 0, "yes": 1},
        "diabetes_mellitus": {"no": 0, "yes": 1},
        "appetite": {"poor": 0, "good": 1},
        "red_blood_cells": {"normal": 0, "abnormal": 1},
        "peda_edema": {"no": 0, "yes": 1},
        "pus_cell": {"normal": 0, "abnormal": 1},
        "pus_cell_clumps": {"notpresent": 0, "present": 1},
        "bacteria": {"notpresent": 0, "present": 1},
        "coronary_artery_disease": {"no": 0, "yes": 1},
        "anemia": {"no": 0, "yes": 1}
    }


    for feat in ALLOWED_FEATURES:
        val = payload.get(feat, None)

        if val is None or (isinstance(val, str) and val.strip() == ""):
            raise ValueError(f"Missing required feature: {feat}")

        if feat in mappings:
            if isinstance(val, str):
                v = val.strip().lower()
                if v in mappings[feat]:
                    coerced[feat] = mappings[feat][v]
                else:
                    raise ValueError(f"Invalid categorical value for {feat}: {val}")
            else:
                try:
                    val_num = int(round(float(val)))
                    if val_num in mappings[feat].values():
                        coerced[feat] = val_num
                    else:
                        raise ValueError(f"Invalid numeric categorical value for {feat}: {val}")
                except Exception:
                    raise ValueError(f"Invalid categorical value for {feat}: {val}")
        else:
            try:
                coerced[feat] = float(val)
            except Exception:
                raise ValueError(f"Invalid numeric value for {feat}: {val}")

    return coerced



def predict(payload):
    """
    Full stacking inference with passthrough:
    - Accepts 24 raw features
    - Scales all 24
    - Selects 12 chosen features (FEATURE_ORDER)
    - Runs stacked prediction
    """
    coerced = _coerce_types(payload)

    # Build DataFrame with all 24 features
    x_full = pd.DataFrame([coerced], columns=ALLOWED_FEATURES)

    # Scale all 24 features
    x_scaled_full = pd.DataFrame(
        SCALER.transform(x_full),
        columns=ALLOWED_FEATURES
    )

    # Select only the 12 features used for training
    x_scaled = x_scaled_full[FEATURE_ORDER].values   # shape (1, 12)

    # -----------------------------
    # Level-0 predictions
    # -----------------------------
    #print("feature names:", x_scaled_full.columns.tolist())

    l0_probs = {
        name: float(model.predict_proba(pd.DataFrame(x_scaled, columns=FEATURE_ORDER))[:, 1][0])
        for name, model in BASE_MODELS.items()
    }
    L0 = np.array(list(l0_probs.values())).reshape(1, -1)

    # -----------------------------
    # Level-1 passthrough: [L0 || x_scaled]
    # -----------------------------
    L1_input = np.concatenate([L0, x_scaled], axis=1)
    l1_probs = {
        name: float(meta.predict_proba(pd.DataFrame(L1_input))[:, 1][0])
        for name, meta in META1_MODELS.items()
    }
    L1 = np.array(list(l1_probs.values())).reshape(1, -1)

    # -----------------------------
    # Level-2 passthrough: [L1 || x_scaled]
    # -----------------------------
    L2_input = np.concatenate([L1, x_scaled], axis=1)
    prob = float(FINAL_META.predict_proba(pd.DataFrame(L2_input))[:, 1][0])
    pred = int(prob >= 0.5)
    label = "Positive" if pred == 1 else "Negative"

    return {
        "prediction": pred,
        "label": label,
        "probability": round(prob, 6),
        "confidence_percent": round(prob * 100, 2),
        "level0": l0_probs,
        "level1": l1_probs,
        "final_meta": round(prob, 6),
        "feature_order": list(FEATURE_ORDER)
    }


