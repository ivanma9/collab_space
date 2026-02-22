export const tools = [
  {
    name: "createStickyNote",
    description: "Create a sticky note on the board",
    input_schema: {
      type: "object",
      properties: {
        id:    { type: "string", description: "UUID for this object — you must generate this" },
        text:  { type: "string" },
        x:     { type: "number" },
        y:     { type: "number" },
        color: { type: "string", enum: ["yellow", "pink", "blue", "green", "orange", "purple"] }
      },
      required: ["id", "text", "x", "y", "color"]
    }
  },
  {
    name: "createShape",
    description: "Create a rectangle, circle, or line",
    input_schema: {
      type: "object",
      properties: {
        id:        { type: "string" },
        shapeType: { type: "string", enum: ["rectangle", "circle", "line"] },
        x:         { type: "number" },
        y:         { type: "number" },
        width:     { type: "number" },
        height:    { type: "number" },
        color:     { type: "string", enum: ["red", "blue", "green", "yellow", "orange", "purple", "gray", "white"] }
      },
      required: ["id", "shapeType", "x", "y", "width", "height", "color"]
    }
  },
  {
    name: "createFrame",
    description: "Create a labeled frame to group content",
    input_schema: {
      type: "object",
      properties: {
        id:     { type: "string" },
        title:  { type: "string" },
        x:      { type: "number" },
        y:      { type: "number" },
        width:  { type: "number" },
        height: { type: "number" }
      },
      required: ["id", "title", "x", "y", "width", "height"]
    }
  },
  {
    name: "createTextBox",
    description: "Create a standalone text element on the board",
    input_schema: {
      type: "object",
      properties: {
        id:       { type: "string" },
        text:     { type: "string" },
        x:        { type: "number" },
        y:        { type: "number" },
        fontSize: { type: "number" },
        color:    { type: "string" }
      },
      required: ["id", "text", "x", "y"]
    }
  },
  {
    name: "createConnector",
    description: "Draw a connector arrow between two objects",
    input_schema: {
      type: "object",
      properties: {
        id:     { type: "string" },
        fromId: { type: "string", description: "ID of the source object" },
        toId:   { type: "string", description: "ID of the target object" },
        style:  { type: "string", enum: ["arrow", "line", "dashed"] }
      },
      required: ["id", "fromId", "toId", "style"]
    }
  },
  {
    name: "moveObject",
    description: "Move an existing object to new coordinates",
    input_schema: {
      type: "object",
      properties: {
        objectId: { type: "string" },
        x:        { type: "number" },
        y:        { type: "number" }
      },
      required: ["objectId", "x", "y"]
    }
  },
  {
    name: "resizeObject",
    description: "Resize an existing object",
    input_schema: {
      type: "object",
      properties: {
        objectId: { type: "string" },
        width:    { type: "number" },
        height:   { type: "number" }
      },
      required: ["objectId", "width", "height"]
    }
  },
  {
    name: "updateStickyNoteText",
    description: "Change the text content of a sticky note",
    input_schema: {
      type: "object",
      properties: {
        objectId: { type: "string" },
        newText:  { type: "string" }
      },
      required: ["objectId", "newText"]
    }
  },
  {
    name: "updateTextBoxContent",
    description: "Change the text content of a standalone text box",
    input_schema: {
      type: "object",
      properties: {
        objectId: { type: "string" },
        newText:  { type: "string" }
      },
      required: ["objectId", "newText"]
    }
  },
  {
    name: "changeColor",
    description: "Change the color of an existing object",
    input_schema: {
      type: "object",
      properties: {
        objectId: { type: "string" },
        color:    { type: "string" }
      },
      required: ["objectId", "color"]
    }
  },
  {
    name: "getBoardState",
    description: "Returns current board state — already included in your context, no need to call this",
    input_schema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "bulkCreateObjects",
    description: "Create many objects at once in a grid layout. Use this when the user asks for more than 5 of the same type of object (e.g. 'make 100 sticky notes', 'create 3000 stickies'). Much more efficient than calling individual create tools repeatedly.",
    input_schema: {
      type: "object",
      properties: {
        objectType: { type: "string", enum: ["sticky_note", "shape", "frame", "text"], description: "Type of object to create" },
        count: { type: "number", description: "Number of objects to create" },
        startX: { type: "number", description: "X coordinate of the top-left of the grid" },
        startY: { type: "number", description: "Y coordinate of the top-left of the grid" },
        columns: { type: "number", description: "Number of columns in the grid layout" },
        template: {
          type: "object",
          description: "Template for each created object",
          properties: {
            text: { type: "string", description: "Text content (supports {n} placeholder for 1-based index)" },
            color: { type: "string", description: "Color name or hex" },
            width: { type: "number" },
            height: { type: "number" },
            fontSize: { type: "number" },
            shapeType: { type: "string", enum: ["rectangle", "circle", "line"] },
            title: { type: "string", description: "For frames — supports {n} placeholder" },
          }
        }
      },
      required: ["objectType", "count", "startX", "startY", "columns", "template"]
    }
  }
]
