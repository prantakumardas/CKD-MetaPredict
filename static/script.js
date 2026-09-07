const form = document.getElementById("predict-form");
const resultSection = document.getElementById("result");
const resultContent = document.getElementById("result-content");
const pdfReport = document.getElementById("pdf-report");

let level0Chart, level1Chart, level2Chart;

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const formData = new FormData(form);

  // Collect patient info explicitly
  const patientInfo = {
    name: document.getElementById("name").value.trim(),
    age: document.getElementById("age").value.trim(),
    blood_group: document.getElementById("blood_group").value.trim(),
    sex: document.getElementById("sex").value.trim(),
    //height: document.getElementById("height").value.trim(),
    weight: document.getElementById("weight").value.trim()
  };

  // Collect all form data into payload
  const payload = {};
  for (const [key, value] of formData.entries()) {
    payload[key] = value.trim();
  }

  const fullPayload = { ...patientInfo, ...payload };

  try {
    const res = await fetch("/predict_endpoint", {
      method: "POST",
      body: new URLSearchParams(fullPayload),
      headers: { "Accept": "application/json" }
    });

    const data = await res.json();

    // Always hide sections first
    resultSection.classList.add("hidden");
    pdfReport.classList.add("hidden");

    if (data.status !== "ok") {
      throw new Error(data.message || "Prediction failed");
    }

    const { prediction, probability, level0, level1, final_meta } = data.result;
    const { name, age, blood_group, sex, weight, height } = data.patient_info || patientInfo;
    const egfr = data.egfr;  // comes from backend JSON

    function getRenalFunctionStatus(egfr) {
      if (egfr === null || egfr === undefined) return "-";
      if (egfr >= 90) return "Normal (Stage 1 if kidney damage present)";
      if (egfr >= 60) return "Mildly Decreased (Stage 2)";
      if (egfr >= 30) return "Moderately Decreased (Stage 3)";
      if (egfr >= 15) return "Severely Decreased (Stage 4)";
      return "Kidney Failure (Stage 5)";
    }

    // Textual result
    resultContent.innerHTML = `
      <h3 class="subheading">1. Patient Information</h3>
      <div class="result-row"><span class="label">Name</span><span class="value">${name || "-"}</span></div>
      <div class="result-row"><span class="label">Age</span><span class="value">${age || "-"}</span></div>
      <div class="result-row"><span class="label">Blood Group</span><span class="value">${blood_group || "-"}</span></div>
      <div class="result-row"><span class="label">Sex</span><span class="value">${sex || "-"}</span></div>
      <div class="result-row"><span class="label">Weight (kg)</span><span class="value">${weight || "-"}</span></div>

      <h3 class="subheading">2. Prediction</h3>
      <div class="result-row">
        <span class="label">Final Prediction</span>
        <span class="value">${prediction === 1 ? "Positive" : "Negative"}</span>
      </div>
      <div class="result-row">
        <span class="label">Final Confidence</span>
        <span class="value">${(probability * 100).toFixed(2)}%</span>
      </div>

      <h3 class="subheading">3. Renal Function</h3>
      <div class="result-row">
        <span class="label">eGFR</span>
        <span class="value">${egfr !== null && egfr !== undefined ? egfr + " mL/min/1.73m²" : "-"}</span>
      </div>
      <div class="result-row">
        <span class="label">Renal Function Status</span>
        <span class="value">${getRenalFunctionStatus(egfr)}</span>
      </div>
    `;

    // Charts
    const commonOptions = (titleText, maxY) => ({
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { ticks: { font: { size: 12 } } },
        y: { beginAtZero: true, max: maxY, ticks: { font: { size: 12 } } }
      },
      plugins: {
        legend: { display: true },
        title: { display: true, text: titleText, font: { size: 18 } },
        tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y}%` } }
      }
    });

    if (level0Chart) level0Chart.destroy();
    level0Chart = new Chart(document.getElementById("level0Chart"), {
      type: "bar",
      data: {
        labels: Object.keys(level0),
        datasets: [{
          label: "Base Model Probabilities (%)",
          data: Object.values(level0).map(v => Number((v * 100).toFixed(2))),
          backgroundColor: "#22c55e",
          barThickness: 20
        }]
      },
      options: commonOptions("Level-0 Base Models", 100)
    });

    if (level1Chart) level1Chart.destroy();
    level1Chart = new Chart(document.getElementById("level1Chart"), {
      type: "bar",
      data: {
        labels: Object.keys(level1),
        datasets: [{
          label: "Meta Learner Probabilities (%)",
          data: Object.values(level1).map(v => Number((v * 100).toFixed(2))),
          backgroundColor: "#3b82f6",
          barThickness: 20
        }]
      },
      options: commonOptions("Level-1 Meta Learners", 100)
    });

    if (level2Chart) level2Chart.destroy();
    level2Chart = new Chart(document.getElementById("level2Chart"), {
      type: "bar",
      data: {
        labels: ["Final Meta Learner"],
        datasets: [{
          label: "Final Probability (%)",
          data: [Number((final_meta * 100).toFixed(2))],
          backgroundColor: "#dc2626",
          barThickness: 30
        }]
      },
      options: commonOptions("Level-2 Final Meta Learner", 100)
    });

    // Show sections only if prediction succeeded
    resultSection.classList.remove("hidden");
    pdfReport.classList.remove("hidden");
    resultSection.scrollIntoView({ behavior: "smooth" });
    printResult();

  } catch (err) {
    // Show error below the form, not inside result section
    const errorBox = document.createElement("div");
    errorBox.className = "alert alert-danger mt-3";
    errorBox.innerText = err.message;

    // Insert after the form
    form.insertAdjacentElement("afterend", errorBox);

    // Remove after 5 seconds
    setTimeout(() => {
      errorBox.remove();
    }, 5000);
  }
});

function printResult() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // Load logo and add synchronously
  const logoImg = new Image();
  logoImg.src = "/static/images/pdf_logo.png"; // adjust path to your static folder
  logoImg.onload = function () {
    doc.addImage(logoImg, "PNG", 160, 10, 40, 15); // x, y, width, height

    // Collect patient info
    const name = document.getElementById("name").value || "-";
    const age = document.getElementById("age").value || "-";
    const bloodGroup = document.getElementById("blood_group").value || "-";
    const sex = document.getElementById("sex").value || "-";

    // Collect inputs (excluding patient info fields)
    const form = document.getElementById("predict-form");
    const formData = new FormData(form);
    const inputs = [];
    const excludeKeys = ["name", "age", "blood_group", "sex", "height", "weight"];
    for (const [key, value] of formData.entries()) {
      if (!excludeKeys.includes(key)) {
        inputs.push([key, value || "-"]);
      }
    }

    // Helper: reshape inputs into 2-column rows
    function chunkInputs(inputs) {
      const rows = [];
      for (let i = 0; i < inputs.length; i += 2) {
        const row = [];
        for (let j = 0; j < 2; j++) {
          if (i + j < inputs.length) {
            row.push(inputs[i + j][0]); // feature
            row.push(inputs[i + j][1]); // value
          } else {
            row.push(""); // empty cell if fewer than 2 left
            row.push("");
          }
        }
        rows.push(row);
      }
      return rows;
    }

    // Extract prediction + confidence + renal function
    const resultContent = document.getElementById("result-content").innerText || "No prediction yet";
    let prediction = "-";
    let confidence = "-";
    let egfr = "-";
    let renalStatus = "-";

    const lines = resultContent.split("\n");
    lines.forEach((line, idx) => {
      if (line.toLowerCase().includes("prediction")) {
        prediction = lines[idx + 1] || "-";
      }
      if (line.toLowerCase().includes("confidence")) {
        confidence = lines[idx + 1] || "-";
      }
      if (line.toLowerCase().includes("egfr")) {
        egfr = lines[idx + 1] || "-";
      }
      if (line.toLowerCase().includes("renal function status")) {
        renalStatus = lines[idx + 1] || "-";
      }
    });

    // Header
    const reportId = "CKD-" + Date.now();
    doc.setFontSize(18);
    doc.text("Chronic Kidney Disease Report", 14, 20);
    doc.setFontSize(12);
    doc.text("Report ID: " + reportId, 14, 30);
    doc.line(14, 35, 195, 35);

    // Patient Info Table
    doc.setFontSize(14);
    doc.text("Patient Information", 14, 42);
    doc.autoTable({
      startY: 46,
      head: [["Field", "Value"]],
      body: [
        ["Name", name],
        ["Age", age],
        ["Blood Group", bloodGroup],
        ["Sex", sex],
      ],
      theme: "grid"
    });

    // Inputs Table (reshaped into 2 columns)
    let inputsStartY = doc.lastAutoTable.finalY + 7;
    doc.setFontSize(14);
    doc.text("Clinical Inputs Provided", 14, inputsStartY);

    const inputsBody = chunkInputs(inputs);
    doc.autoTable({
      startY: inputsStartY + 4,
      head: [["Feature", "Value", "Feature", "Value"]],
      body: inputsBody,
      theme: "grid",
      styles: { fontSize: 10 }
    });

    // Prediction Result Table
    let resultStartY = doc.lastAutoTable.finalY + 7;
    if (resultStartY > 250) {
      doc.addPage();
      resultStartY = 20;
    }

    doc.setFontSize(14);
    doc.text("Prediction Result", 14, resultStartY);
    doc.autoTable({
      startY: resultStartY + 4,
      head: [["Metric", "Value"]],
      body: [
        ["Prediction", prediction],
        ["Confidence", confidence],
        ["eGFR", egfr],
        ["Renal Function Status", renalStatus],
      ],
      theme: "grid",
      headStyles: { fillColor: [220, 38, 38] }
    });

    // Footer
    doc.setFontSize(10);
    doc.text("Generated by CKD MetaPredict", 14, 280);
    doc.text("Research Conducted by the Center for Artificial Intelligence and Robotics (CAIR)", 14, 285);

    // Generate Blob URL
    const pdfBlob = doc.output("blob");
    const pdfUrl = URL.createObjectURL(pdfBlob);

    // Preview
    const pdfPreview = document.getElementById("pdf-preview");
    if (pdfPreview) {
      pdfPreview.src = pdfUrl;
    }

    // Download link
    const pdfLink = document.getElementById("pdf-link");
    if (pdfLink) {
      pdfLink.href = pdfUrl;
    }

    // Show section
    document.getElementById("pdf-report").classList.remove("hidden");
  };
}

