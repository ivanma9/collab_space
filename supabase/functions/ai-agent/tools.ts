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
    name: "askClarification",
    description: "Ask the user a clarifying question when their request is ambiguous. Provide 2-4 suggestion options that become clickable buttons in the UI.",
    input_schema: {
      type: "object",
      properties: {
        question: { type: "string", description: "The clarifying question to ask the user" },
        suggestions: {
          type: "array",
          items: { type: "string" },
          description: "2-4 short suggestion options for the user to click",
          minItems: 2,
          maxItems: 4
        }
      },
      required: ["question", "suggestions"]
    }
  }
]
