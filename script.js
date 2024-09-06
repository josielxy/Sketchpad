const canvas = document.getElementById('sketchpad');
const context = canvas.getContext('2d', { willReadFrequently: true });
canvas.width = window.innerWidth * 0.8;
canvas.height = window.innerHeight * 0.8;

let painting = false;
let currentMode = 'freehand';
let startX, startY, points = [];
let objects = [];
let selectedObjects = [];
let selectedObject = null;
let selectedColor = '#000000';
let copiedObject = null;
let lineWidth = 1;  // Default line width
let undoStack = [];
let redoStack = [];

document.getElementById('freehand').addEventListener('click', () => setMode('freehand'));
document.getElementById('line').addEventListener('click', () => setMode('line'));
document.getElementById('rectangle').addEventListener('click', () => setMode('rectangle'));
document.getElementById('ellipse').addEventListener('click', () => setMode('ellipse'));
document.getElementById('square').addEventListener('click', () => setMode('square'));
document.getElementById('circle').addEventListener('click', () => setMode('circle'));
document.getElementById('polygon').addEventListener('click', () => setMode('polygon'));
document.getElementById('move').addEventListener('click', () => setMode('move'));
document.getElementById('cut').addEventListener('click', () => cutObject());
document.getElementById('paste').addEventListener('click', () => pasteObject());
document.getElementById('group').addEventListener('click', () => groupObjects());
document.getElementById('ungroup').addEventListener('click', () => ungroupObjects());
document.getElementById('clear').addEventListener('click', () => clearCanvas());
document.getElementById('colorPicker').addEventListener('change', (e) => {
    selectedColor = e.target.value;
});
document.getElementById('brushSize').addEventListener('change', (e) => {
    lineWidth = parseInt(e.target.value, 10);
});
document.getElementById('undo').addEventListener('click', () => undo());
document.getElementById('redo').addEventListener('click', () => redo());

canvas.addEventListener('mousedown', startPosition);
canvas.addEventListener('mouseup', endPosition);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('dblclick', finalizePolygon);

function saveState() {
    undoStack.push(JSON.parse(JSON.stringify(objects)));
    redoStack = [];  // Clear the redo stack whenever a new action is performed
}

function setMode(mode) {
    currentMode = mode;
    if (mode !== 'polygon') {
        points = [];
    }
    selectedObject = null;
    selectedObjects = [];
}

function startPosition(e) {
    startX = e.clientX - canvas.offsetLeft;
    startY = e.clientY - canvas.offsetTop;

    if (currentMode === 'move') {
        selectedObject = objects.find(obj => isInsideObject(startX, startY, obj));
        if (selectedObject) {
            painting = true;
            if (selectedObject.type === 'polygon') {
                const firstPoint = selectedObject.points[0];
                selectedObject.offsetX = startX - firstPoint.x;
                selectedObject.offsetY = startY - firstPoint.y;
            } else if (selectedObject.type === 'line') {
                // Calculate offset for the line
                selectedObject.offsetX = startX - selectedObject.x1;
                selectedObject.offsetY = startY - selectedObject.y1;
            } else {
                selectedObject.offsetX = startX - selectedObject.x;
                selectedObject.offsetY = startY - selectedObject.y;
            }
        }
    } else {
        painting = true;
        context.savedImage = context.getImageData(0, 0, canvas.width, canvas.height);
        draw(e);
    }
}

function endPosition(e) {
    if (painting) {
        saveState();
    }
    painting = false;
    context.beginPath();
    if (currentMode !== 'freehand' && currentMode !== 'move' && currentMode !== 'polygon') {
        const endX = e.clientX - canvas.offsetLeft;
        const endY = e.clientY - canvas.offsetTop;
        const newObj = createObject(currentMode, startX, startY, endX, endY, lineWidth, selectedColor);
        objects.push(newObj);
    }
    if (currentMode === 'polygon') {
        points.push({ x: startX, y: startY });
    }
}

function draw(e) {
    if (!painting) return;

    const x = e.clientX - canvas.offsetLeft;
    const y = e.clientY - canvas.offsetTop;

    context.lineWidth = lineWidth;  // Apply line width to all modes

    switch (currentMode) {
        case 'freehand':
            context.lineCap = 'round';
            context.strokeStyle = selectedColor;
            context.lineTo(x, y);
            context.stroke();
            context.beginPath();
            context.moveTo(x, y);
            break;
        case 'line':
            if (context.savedImage) {
                context.putImageData(context.savedImage, 0, 0);  // Restore state
            }
            context.strokeStyle = selectedColor;
            context.beginPath();
            context.moveTo(startX, startY);
            context.lineTo(x, y);
            context.stroke();
            context.beginPath();
            break;
        case 'rectangle':
            if (context.savedImage) {
                context.putImageData(context.savedImage, 0, 0);  // Restore state
            }
            context.strokeStyle = selectedColor;
            context.strokeRect(startX, startY, x - startX, y - startY);
            break;
        case 'ellipse':
            if (context.savedImage) {
                context.putImageData(context.savedImage, 0, 0);  // Restore state
            }
            context.strokeStyle = selectedColor;
            context.beginPath();
            context.ellipse(startX, startY, Math.abs(x - startX) / 2, Math.abs(y - startY) / 2, 0, 0, 2 * Math.PI);
            context.stroke();
            context.beginPath();
            break;
        case 'square':
            if (context.savedImage) {
                context.putImageData(context.savedImage, 0, 0);  // Restore state
            }
            const size = Math.max(Math.abs(x - startX), Math.abs(y - startY));
            context.strokeStyle = selectedColor;
            context.strokeRect(startX, startY, size, size);
            break;
        case 'circle':
            if (context.savedImage) {
                context.putImageData(context.savedImage, 0, 0);  // Restore state
            }
            const radius = Math.max(Math.abs(x - startX), Math.abs(y - startY)) / 2;
            context.strokeStyle = selectedColor;
            context.beginPath();
            context.arc(startX, startY, radius, 0, 2 * Math.PI);
            context.stroke();
            context.beginPath();
            break;
        case 'polygon':
            if (context.savedImage) {
                context.putImageData(context.savedImage, 0, 0);  // Restore state
            }
            context.strokeStyle = selectedColor;
            if (points.length > 0) {
                context.beginPath();
                context.moveTo(points[0].x, points[0].y);
                points.forEach(point => {
                    context.lineTo(point.x, point.y);
                });
                context.lineTo(x, y);
                context.stroke();
            }
            break;
        case 'move':
            if (selectedObject) {
                if (context.savedImage) {
                    context.putImageData(context.savedImage, 0, 0);  // Restore state
                }
                if (selectedObject.type === 'polygon') {
                    const dx = x - selectedObject.offsetX - selectedObject.points[0].x;
                    const dy = y - selectedObject.offsetY - selectedObject.points[0].y;

                    selectedObject.points = selectedObject.points.map(point => ({
                        x: point.x + dx,
                        y: point.y + dy
                    }));
                    selectedObject.offsetX = x - selectedObject.points[0].x;
                    selectedObject.offsetY = y - selectedObject.points[0].y;
                } else if (selectedObject.type === 'line') {
                    const dx = x - selectedObject.offsetX - selectedObject.x1;
                    const dy = y - selectedObject.offsetY - selectedObject.y1;
                    
                    selectedObject.x1 += dx;
                    selectedObject.y1 += dy;
                    selectedObject.x2 += dx;
                    selectedObject.y2 += dy;
                    selectedObject.offsetX = x - selectedObject.x1;
                    selectedObject.offsetY = y - selectedObject.y1;
                } else {
                    selectedObject.x = x - selectedObject.offsetX;
                    selectedObject.y = y - selectedObject.offsetY;
                }
                redrawCanvas();
                drawObject(selectedObject);
            }
            break;
    }
}

function finalizePolygon() {
    if (currentMode === 'polygon' && points.length > 1) {
        points.push(points[0]);  // Close the polygon
        context.beginPath();
        context.moveTo(points[0].x, points[0].y);
        points.forEach(point => {
            context.lineTo(point.x, point.y);
        });
        context.stroke();
        const newPolygon = {
            type: 'polygon',
            points: points.slice(),
            color: selectedColor,
            lineWidth: lineWidth  // Save line width for polygon
        };
        objects.push(newPolygon);
        points = [];
    }
}

function createObject(type, startX, startY, endX, endY, lineWidth, color) {
    let object = { type, x: startX, y: startY, width: endX - startX, height: endY - startY, color, lineWidth };
    if (type === 'line') {
        object = { type, x1: startX, y1: startY, x2: endX, y2: endY, color, lineWidth };
    }
    return object;
}

function drawObject(obj) {
    context.lineWidth = obj.lineWidth;  // Apply saved line width
    context.strokeStyle = obj.color;
    switch (obj.type) {
        case 'line':
            context.beginPath();
            context.moveTo(obj.x1, obj.y1);
            context.lineTo(obj.x2, obj.y2);
            context.stroke();
            context.beginPath();
            break;
        case 'rectangle':
            context.strokeRect(obj.x, obj.y, obj.width, obj.height);
            break;
        case 'ellipse':
            context.beginPath();
            context.ellipse(obj.x, obj.y, Math.abs(obj.width) / 2, Math.abs(obj.height) / 2, 0, 0, 2 * Math.PI);
            context.stroke();
            context.beginPath();
            break;
        case 'square':
            context.strokeRect(obj.x, obj.y, obj.width, obj.height);
            break;
        case 'circle':
            const radius = Math.max(Math.abs(obj.width), Math.abs(obj.height)) / 2;
            context.beginPath();
            context.arc(obj.x, obj.y, radius, 0, 2 * Math.PI);
            context.stroke();
            context.beginPath();
            break;
        case 'polygon':
            context.beginPath();
            context.moveTo(obj.points[0].x, obj.points[0].y);
            obj.points.forEach(point => {
                context.lineTo(point.x, point.y);
            });
            context.stroke();
            context.beginPath();
            break;
    }
}

function redrawCanvas() {
    context.clearRect(0, 0, canvas.width, canvas.height);
    objects.forEach(obj => drawObject(obj));
}

function isInsideObject(x, y, obj) {
    if (obj.type === 'rectangle' || obj.type === 'square') {
        return x > obj.x && x < obj.x + obj.width && y > obj.y && y < obj.y + obj.height;
    } else if (obj.type === 'ellipse' || obj.type === 'circle') {
        const radiusX = Math.abs(obj.width) / 2;
        const radiusY = Math.abs(obj.height) / 2;
        const centerX = obj.x + radiusX;
        const centerY = obj.y + radiusY;
        return Math.pow((x - centerX) / radiusX, 2) + Math.pow((y - centerY) / radiusY, 2) <= 1;
    } else if (obj.type === 'line') {
        const distance = Math.abs((obj.y2 - obj.y1) * x - (obj.x2 - obj.x1) * y + obj.x2 * obj.y1 - obj.y2 * obj.x1) /
            Math.sqrt(Math.pow(obj.y2 - obj.y1, 2) + Math.pow(obj.x2 - obj.x1, 2));
        return distance < lineWidth;  // Tolerance for selecting the line
    } else if (obj.type === 'polygon') {
        return isPointInPolygon({ x, y }, obj.points);
    }
    return false;
}

function isPointInPolygon(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y;
        const xj = polygon[j].x, yj = polygon[j].y;

        const intersect = ((yi > point.y) !== (yj > point.y)) &&
            (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function cutObject() {
    if (selectedObject) {
        saveState();
        copiedObject = selectedObject;
        objects = objects.filter(obj => obj !== selectedObject);
        redrawCanvas();
        selectedObject = null;
    }
}

function pasteObject() {
    if (copiedObject) {
        saveState();
        const pastedObject = JSON.parse(JSON.stringify(copiedObject));
        pastedObject.x += 10;
        pastedObject.y += 10;
        objects.push(pastedObject);
        redrawCanvas();
    }
}

function groupObjects() {
    if (selectedObjects.length > 1) {
        saveState();
        const group = {
            type: 'group',
            objects: selectedObjects.map(obj => ({ ...obj })),
            x: Math.min(...selectedObjects.map(obj => obj.x)),
            y: Math.min(...selectedObjects.map(obj => obj.y))
        };
        objects = objects.filter(obj => !selectedObjects.includes(obj));
        objects.push(group);
        redrawCanvas();
        selectedObjects = [];
    }
}

function ungroupObjects() {
    if (selectedObject && selectedObject.type === 'group') {
        saveState();
        objects = objects.filter(obj => obj !== selectedObject);
        selectedObject.objects.forEach(obj => objects.push(obj));
        redrawCanvas();
        selectedObject = null;
    }
}

function clearCanvas() {
    saveState();
    context.clearRect(0, 0, canvas.width, canvas.height);
    objects = [];
}

function undo() {
    if (undoStack.length > 0) {
        redoStack.push(JSON.parse(JSON.stringify(objects)));
        objects = undoStack.pop();
        redrawCanvas();
    }
}

function redo() {
    if (redoStack.length > 0) {
        undoStack.push(JSON.parse(JSON.stringify(objects)));
        objects = redoStack.pop();
        redrawCanvas();
    }
}
