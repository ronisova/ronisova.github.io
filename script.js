const canvas = document.getElementById("mapCanvas");
const ctx = canvas.getContext("2d");
const coordsList = document.getElementById("coordsList");
const imageUploadInput = document.getElementById("imageUpload");
const clearButton = document.getElementById("clearPoints");

let img = new Image();
let points = []; //clicked or loaded image points
let scaleRatio = 1; //keeps track of how the image was resized for display
let referencePoints = []; //includes both image and real-world coordinates
let currentClickedImagePoint = null;
let currentEditedImagePoint = null;
let isReplacingLast = false;
let parsedCSVRows = []; //temporarily stores CSV data before user clicks "Load"
let selectedPoints = [];

let formMode = "add";

// Load default image
img.src = "images/land.jpg";

img.onload = () => drawScaledImage(img);

// Handle image upload
imageUploadInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    img = new Image();
    img.onload = () => {
      drawScaledImage(img);
      redrawPoints();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
});

clearButton.addEventListener("click", () => {
  points = [];
  referencePoints = [];
  file = null;
  drawScaledImage(img);
  updateCoordsList();
  coordsList.classList.add("hidden");
})

// Draw image scaled to fit screen
function drawScaledImage(image) {
  const maxWidth = window.innerWidth * 0.9;
  const maxHeight = window.innerHeight * 0.7;

  let scale = Math.min(maxWidth / image.width, maxHeight / image.height);
  scaleRatio = scale;

  canvas.width = image.width * scale;
  canvas.height = image.height * scale;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
}

// Handle canvas click
canvas.addEventListener("click", (e) => {
  if (points.length < 3){
    alert('please load at least 3 points to start')
    return;
  }

  if (formMode !== 'edit'){
    document.getElementById('editPointText').classList.add('hidden');
    document.getElementById('currentPointName').innerText = 'New Point';
  }

  const form = document.getElementById("coordsForm");

  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) / scaleRatio;
  const y = (e.clientY - rect.top) / scaleRatio;

  currentClickedImagePoint = { imageX: x, imageY: y };

  document.getElementById("imgCoordsPreview").innerText = `(${x.toFixed(1)}, ${y.toFixed(1)})`;
  form.classList.remove("hidden");

  fillRealCoordinates();
});

// Save real-world coordinates
function saveRealCoords() {
  const realX = parseFloat(document.getElementById("realX").value);
  const realY = parseFloat(document.getElementById("realY").value);

  if (isNaN(realX) || isNaN(realY)) {
    alert("Please enter valid real-world coordinates.");
    return;
  }

  if (!currentClickedImagePoint) {
    alert("No image point selected.");
    return;
  }

  const imageX = currentClickedImagePoint.imageX;
  const imageY = currentClickedImagePoint.imageY;

  const newPoint = {
    image: { x: imageX, y: imageY },
    real: { x: realX, y: realY },
    timestamp: new Date().toISOString()
  };

  if (formMode === 'edit') {
    // Update existing point
    referencePoints[currentEditedImagePoint.editingIndex] = newPoint;
    points[currentEditedImagePoint.editingIndex] = { x: imageX, y: imageY };
    formMode = 'add';
  } else {
    referencePoints.push(newPoint);
    points.push({ x: imageX, y: imageY });
  }

  // Reset form
  document.getElementById("coordsForm").classList.add("hidden");
  document.getElementById("realX").value = "";
  document.getElementById("realY").value = "";

  redrawPoints();
  updateCoordsList();
  currentClickedImagePoint = null;
}

// Redraw points on the image
function redrawPoints() {
  
  drawScaledImage(img);

  points.forEach((pt, index) => {
    // Set the fill color to red for the points
    ctx.fillStyle = "red";
    ctx.beginPath();
    ctx.arc(pt.x * scaleRatio, pt.y * scaleRatio, 5, 0, Math.PI * 2);
    ctx.fill();

    // Set the fill color to black for the serial number
    ctx.fillStyle = "black";
    ctx.font = "14px Arial";
    ctx.fillText(index + 1, pt.x * scaleRatio + 10, pt.y * scaleRatio - 10);
  });
}

// Update the list of mapped coordinates
function updateCoordsList() {
  coordsList.innerHTML = "<h3>Mapped Points:</h3>";

  referencePoints.forEach((pt, i) => {
    coordsList.innerHTML += `
      <p>
        <strong>Point ${i + 1}</strong><br>
        Image: (${pt.image.x.toFixed(1)}, ${pt.image.y.toFixed(1)}) → 
        <input type="checkbox" id="selectPoint${i}" onclick="togglePointSelection(${i})"> Select for Export
        Real: (${pt.real.x}, ${pt.real.y})<br>
        <button onclick="editPoint(${i})">Edit</button>
        <button onclick="deletePoint(${i})">Delete</button>
      </p>`;
  });
}

// Make sure form is hidden on initial load
window.addEventListener("DOMContentLoaded", () => {
  // Hide the form initially
  document.getElementById("coordsForm").classList.add("hidden");

  // Add event listener for Save button
  document.getElementById("saveBtn").addEventListener("click", saveRealCoords);
});

const fillRealCoordinates = () => {
  if (!currentClickedImagePoint) {
    alert("No image point selected.");
    return;
  }

  const result = transformImageToReal(currentClickedImagePoint.imageX, currentClickedImagePoint.imageY);

  if (result) {
    document.getElementById("realX").value = result.x.toFixed(6);
    document.getElementById("realY").value = result.y.toFixed(6);
  }
}

// Upload and parse CSV (store rows in memory) 
document.getElementById("csvUpload").addEventListener("change", function (event) {
  let file = event.target.files[0];
  if (!file) return;

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: function(results) {
      parsedCSVRows = results.data;
    }
  });
  file = null;
});

// Button to load points to image and list
document.getElementById("loadCSVBtn").addEventListener("click", function () {
  if (!parsedCSVRows.length) {
    alert("No CSV data to load. Please upload a CSV file first.");
    return;
  }

  coordsList.classList.remove("hidden");

  parsedCSVRows.forEach((row, i) => {
    // Use pixel values directly from CSV
    const imageX = parseFloat(row["coulmn[pixel]"]); // note: typo in column name!
    const imageY = parseFloat(row["row[pixel]"]);
    const realX = parseFloat(row["Longitude [DD]"]);
    const realY = parseFloat(row["Latitude [DD]"]);

    if (!isNaN(imageX) && !isNaN(imageY) && !isNaN(realX) && !isNaN(realY)) {
      points.push({ x: imageX, y: imageY });
      referencePoints.push({
        image: { x: imageX, y: imageY },
        real: { x: realX, y: realY }
      });
    }
  });

  redrawPoints();
  updateCoordsList();
});

document.getElementById('exportCSVBtn').addEventListener('click', () => {
  const selectedPoints = referencePoints.filter((_, i) => {
    const checkbox = document.getElementById(`selectPoint${i}`);
    return checkbox && checkbox.checked;
  });

  const csvData = selectedPoints.map(pt => ({
    imageX: pt.image.x,
    imageY: pt.image.y,
    realX: pt.real.x,
    realY: pt.real.y
  }));

  const csv = Papa.unparse(csvData);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "selected_points.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});

document.getElementById('clearForm').addEventListener('click', () => {
  document.getElementById("realX").value = null;
  document.getElementById("realY").value = null;
  document.getElementById("coordsForm").classList.add("hidden");
})


function editPoint(index) {
  formMode = 'edit';
  const pt = referencePoints[index];
  currentEditedImagePoint = {
    imageX: pt.image.x,
    imageY: pt.image.y
  };

  document.getElementById('currentPointName').innerText = `Point ${index + 1}`;
  document.getElementById('editPointText').classList.remove('hidden');

  // Pre-fill the form with existing values
  document.getElementById("imgCoordsPreview").innerText =
    `(${pt.image.x.toFixed(1)}, ${pt.image.y.toFixed(1)})`;
  document.getElementById("realX").value = pt.real.x;
  document.getElementById("realY").value = pt.real.y;

  document.getElementById("coordsForm").classList.remove("hidden");

  // Store the index we are editing
  currentEditedImagePoint.editingIndex = index;
}

function deletePoint(index) {
  
  points.splice(index, 1);
  referencePoints.splice(index, 1);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  redrawPoints();
  updateCoordsList();
}

function transformRealToImage(realX, realY) {
  if (referencePoints.length < 3) {
    alert("At least 3 reference points are needed for transformation.");
    return null;
  }

  // Use the first 3 reference points
  const A = referencePoints.slice(0, 3);

  // Build matrix for real coords
  const realMat = [
    [A[0].real.x, A[0].real.y, 1],
    [A[1].real.x, A[1].real.y, 1],
    [A[2].real.x, A[2].real.y, 1]
  ];

  const imageMatX = [A[0].image.x, A[1].image.x, A[2].image.x];
  const imageMatY = [A[0].image.y, A[1].image.y, A[2].image.y];

  const coeffsX = solveLinear(realMat, imageMatX);
  const coeffsY = solveLinear(realMat, imageMatY);

  const imgX = coeffsX[0] * realX + coeffsX[1] * realY + coeffsX[2];
  const imgY = coeffsY[0] * realX + coeffsY[1] * realY + coeffsY[2];

  return { x: imgX, y: imgY };
}

function solveLinear(A, b) {
  const m = math.inv(A);
  const result = math.multiply(m, b);
  return result;
}

function transformImageToReal(imageX, imageY) {
  if (referencePoints.length < 3) {
    return null;
  }

  const A = referencePoints.slice(0, 3);

  const imageMat = [
    [A[0].image.x, A[0].image.y, 1],
    [A[1].image.x, A[1].image.y, 1],
    [A[2].image.x, A[2].image.y, 1]
  ];

  const realMatX = [A[0].real.x, A[1].real.x, A[2].real.x];
  const realMatY = [A[0].real.y, A[1].real.y, A[2].real.y];

  const coeffsX = solveLinear(imageMat, realMatX);
  const coeffsY = solveLinear(imageMat, realMatY);

  const realX = coeffsX[0] * imageX + coeffsX[1] * imageY + coeffsX[2];
  const realY = coeffsY[0] * imageX + coeffsY[1] * imageY + coeffsY[2];

  return { x: realX, y: realY };
}

function togglePointSelection(index) {
  const checkbox = document.getElementById(`selectPoint${index}`);
  if (checkbox.checked) {
    selectedPoints.push(referencePoints[index]);
  } else {
    selectedPoints = selectedPoints.filter(pt => pt !== referencePoints[index]);
  }

  // Show the export button if any points are selected
  document.getElementById("exportCSVBtn").style.display = selectedPoints.length > 0 ? "block" : "none";
}
