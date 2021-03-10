// Query the element
const resizer = document.getElementById('dragMe');
const leftSide = resizer.previousElementSibling;
const rightSide = resizer.nextElementSibling;

const prevSibling = resizer.previousElementSibling;
let prevSiblingHeight = 0;

// The current position of mouse
let x = 0;
let y = 0;

// Width of left side
let leftWidth = 0;

// Handle the mousedown event
// that's triggered when user drags the resizer
const mouseDownHandler = function(e) {
    // Get the current mouse position
    x = e.clientX;
    y = e.clientY;
    leftWidth = leftSide.getBoundingClientRect().width;

    const rect = prevSibling.getBoundingClientRect();
    prevSiblingHeight = rect.height;

    // Attach the listeners to `document`
    document.addEventListener('mousemove', mouseMoveHandler);
    document.addEventListener('mouseup', mouseUpHandler);
};

const mouseUpHandler = function() {
    resizer.style.removeProperty('cursor');
    document.body.style.removeProperty('cursor');

    leftSide.style.removeProperty('user-select');
    leftSide.style.removeProperty('pointer-events');

    rightSide.style.removeProperty('user-select');
    rightSide.style.removeProperty('pointer-events');

    // Remove the handlers of `mousemove` and `mouseup`
    document.removeEventListener('mousemove', mouseMoveHandler);
    document.removeEventListener('mouseup', mouseUpHandler);
};

const mouseMoveHandler = function(e) {
    // How far the mouse has been moved
    const dx = e.clientX - x;
    const dy = e.clientY - y;

    const newLeftWidth = (leftWidth + dx) * 100 / resizer.parentNode.getBoundingClientRect().width;
    leftSide.style.width = `${newLeftWidth}%`;

    const h = (prevSiblingHeight + dy) * 100 / resizer.parentNode.getBoundingClientRect().height;
    prevSibling.style.height = `${h}%`;

    resizer.style.cursor = 'col-resize';
    document.body.style.cursor = 'col-resize';

    //resizer.style.cursor = 'row-resize';
    //document.body.style.cursor = 'row-resize';


    leftSide.style.userSelect = 'none';
    leftSide.style.pointerEvents = 'none';

    rightSide.style.userSelect = 'none';
    rightSide.style.pointerEvents = 'none';
};

// Attach the handler
resizer.addEventListener('mousedown', mouseDownHandler);
