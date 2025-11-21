const map = L.map("map").setView([20.59, 78.96], 5);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

let mode = document.getElementById("mode").value;
let driverStops = [];
let riderPoints = [];

document.getElementById("mode").addEventListener("change", (e) => {
  mode = e.target.value;
});

map.on("click", (e) => {
  if (mode === "driver") {
    driverStops.push([e.latlng.lat, e.latlng.lng]);
    drawDriverRoute();
  } else {
    if (riderPoints.length < 2) {
      riderPoints.push([e.latlng.lat, e.latlng.lng]);
    }
    drawRiderPoints();
  }
});

function drawDriverRoute() {
  if (window.driverLine) map.removeLayer(window.driverLine);
  if (driverStops.length > 1) {
    window.driverLine = L.polyline(driverStops, { color: "blue" }).addTo(map);
  }
}

function drawRiderPoints() {
  if (window.riderMarkers) {
    window.riderMarkers.forEach((m) => map.removeLayer(m));
  }
  window.riderMarkers = riderPoints.map(([lat, lng]) =>
    L.marker([lat, lng], { icon: L.icon({
      iconUrl: "https://maps.gstatic.com/mapfiles/ms2/micons/red-dot.png",
      iconSize: [24, 24],
    }) }).addTo(map)
  );
}

document.getElementById("clear").onclick = () => {
  driverStops = [];
  riderPoints = [];
  if (window.driverLine) map.removeLayer(window.driverLine);
  if (window.riderMarkers) window.riderMarkers.forEach((m) => map.removeLayer(m));
};

document.getElementById("publish").onclick = () => {
  if (driverStops.length < 2) return alert("Driver route needs at least 2 stops");
  const rides = JSON.parse(localStorage.getItem("rides") || "[]");
  rides.push({ id: Date.now(), stops: driverStops });
  localStorage.setItem("rides", JSON.stringify(rides));
  alert("Ride published!");
};

document.getElementById("search").onclick = () => {
  if (riderPoints.length < 2) return alert("Set pickup & dropoff");

  const rides = JSON.parse(localStorage.getItem("rides") || "[]");

  let matches = rides.filter((ride) => {
    return (
      isPointNearLine(riderPoints[0], ride.stops) &&
      isPointNearLine(riderPoints[1], ride.stops)
    );
  });

  document.getElementById("output").textContent =
    matches.length ? JSON.stringify(matches, null, 2) : "No matches found.";
};

function isPointNearLine(point, line, tolerance = 0.01) {
  let [px, py] = point;
  for (let i = 0; i < line.length - 1; i++) {
    let [x1, y1] = line[i];
    let [x2, y2] = line[i + 1];
    let A = px - x1;
    let B = py - y1;
    let C = x2 - x1;
    let D = y2 - y1;

    let dot = A * C + B * D;
    let lenSq = C * C + D * D;
    let param = lenSq !== 0 ? dot / lenSq : -1;

    let xx, yy;
    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }

    let dx = px - xx;
    let dy = py - yy;
    let dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < tolerance) return true;
  }
  return false;
}
